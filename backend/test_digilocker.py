import os
import sys
import secrets
import hashlib
from datetime import timedelta
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.conf import settings
if 'testserver' not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS.append('testserver')

from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rarenett_app.models import Employee
from digilocker_app.models import (
    DigiLockerFolder,
    DigiLockerFolderMapping,
    DigiLockerDocument,
    DigiLockerOTPChallenge,
    DigiLockerAuditLog
)

def run_tests():
    print("=== STARTING DIGILOCKER END-TO-END SUITE ===")
    User = get_user_model()
    admin_user = User.objects.filter(is_superuser=True).first() or User.objects.first()
    if not admin_user:
        print("[-] Error: No user found in database.")
        return

    employee = Employee.objects.first()
    if not employee:
        print("[-] Error: No employee found in database.")
        return

    emp_display_name = employee.user.get_full_name() if employee.user else (employee.candidate.full_name if employee.candidate else f"Employee #{employee.id}")
    print(f"[+] Target Employee: {emp_display_name} (ID: {employee.id})")

    client = APIClient()
    client.force_authenticate(user=admin_user)

    # 1. API: Create Folder
    print("\n--- 1. Testing POST /api/digilocker/folders/ ---")
    folder_payload = {
        "name": f"Automated_Test_Folder_{secrets.randbelow(10000)}",
        "description": "Folder created during automated test run",
        "folder_type": "shared",
        "is_active": True
    }
    resp = client.post('/api/digilocker/folders/', folder_payload, format='json')
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.data}"
    folder_id = resp.data['id']
    folder_name = resp.data['name']
    print(f"[PASS] Created folder '{folder_name}' (ID: {folder_id})")

    # 2. API: Duplicate Folder Name Validation
    print("\n--- 2. Testing Duplicate Folder Name Rejection ---")
    dup_resp = client.post('/api/digilocker/folders/', folder_payload, format='json')
    assert dup_resp.status_code == 400, f"Expected 400 for duplicate, got {dup_resp.status_code}"
    print("[PASS] Duplicate folder name correctly rejected with 400 Bad Request.")

    # 3. API: Upload Document
    print("\n--- 3. Testing POST /api/digilocker/documents/ ---")
    dummy_pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Title (Test Document) >>\nendobj\ntrailer\n<< >>\n%%EOF"
    test_pdf = SimpleUploadedFile("sample_agreement.pdf", dummy_pdf_content, content_type="application/pdf")

    upload_data = {
        'folder': folder_id,
        'description': 'Important employee test agreement',
        'files': [test_pdf]
    }
    upload_resp = client.post('/api/digilocker/documents/', upload_data, format='multipart')
    assert upload_resp.status_code == 201, f"Expected 201, got {upload_resp.status_code}: {upload_resp.data}"
    created_docs = upload_resp.data.get('documents', [])
    assert len(created_docs) > 0, "No document returned from upload response"
    doc_id = created_docs[0]['id']
    doc_record = DigiLockerDocument.objects.get(id=doc_id)
    assert doc_record.checksum is not None, "Checksum must be generated"
    print(f"[PASS] Document uploaded: '{doc_record.original_filename}' (ID: {doc_id}, Checksum: {doc_record.checksum[:16]}...)")

    # 4. API: Dangerous File Upload Rejection
    print("\n--- 4. Testing Dangerous File Upload Rejection (.exe) ---")
    bad_file = SimpleUploadedFile("malicious.exe", b"MZ\x90\x00\x03\x00\x00\x00", content_type="application/x-msdownload")
    bad_upload_resp = client.post('/api/digilocker/documents/', {
        'folder': folder_id,
        'files': [bad_file]
    }, format='multipart')
    assert bad_upload_resp.status_code == 400, f"Dangerous file must be rejected with 400, got {bad_upload_resp.status_code}"
    print("[PASS] Dangerous executable file upload rejected successfully.")

    # 5. API: Mapping Folder to Employee
    print("\n--- 5. Testing POST /api/digilocker/mappings/ ---")
    map_payload = {
        'employee_id': employee.id,
        'folder_ids': [folder_id],
        'can_view': True,
        'can_upload': True,
        'can_download': True
    }
    map_resp = client.post('/api/digilocker/mappings/', map_payload, format='json')
    assert map_resp.status_code == 201, f"Expected 201, got {map_resp.status_code}: {map_resp.data}"
    mapping_obj = DigiLockerFolderMapping.objects.filter(folder_id=folder_id, employee=employee).first()
    assert mapping_obj is not None, "Mapping must exist in DB"
    print(f"[PASS] Folder mapped to employee (ID: {mapping_obj.id}, can_view={mapping_obj.can_view}, can_download={mapping_obj.can_download})")

    # 6. API: Access Endpoint (Locked Documents)
    print("\n--- 6. Testing GET /api/digilocker/access/employee/<id>/ ---")
    access_resp = client.get(f'/api/digilocker/access/employee/{employee.id}/')
    assert access_resp.status_code == 200, f"Expected 200, got {access_resp.status_code}: {access_resp.data}"
    folders_list = access_resp.data.get('folders', [])
    assert any(f['folder_id'] == folder_id for f in folders_list), "Mapped folder not listed in access response"
    print(f"[PASS] Employee folder listing retrieved, mapped folders count: {len(folders_list)}")

    # 7. OTP Challenge Generation & Verification
    print("\n--- 7. Testing OTP Challenge Flow (View & Download) ---")
    # Simulate a challenge directly in DB to test verification logic cleanly
    otp_code = f"{secrets.randbelow(10000):04d}"
    salt = secrets.token_hex(16)
    otp_hash = hashlib.sha256(f"{otp_code}:{salt}".encode('utf-8')).hexdigest() + f":{salt}"
    
    challenge = DigiLockerOTPChallenge.objects.create(
        requester=admin_user,
        target_employee=employee,
        document=doc_record,
        operation='view',
        otp_hash=otp_hash,
        expires_at=timezone.now() + timedelta(minutes=5),
        max_attempts=5
    )

    # Test invalid OTP
    bad_otp = "0000" if otp_code != "0000" else "1111"
    verify_bad_resp = client.post('/api/digilocker/access/verify-otp/', {
        'challenge_id': challenge.id,
        'otp': bad_otp
    }, format='json')
    assert verify_bad_resp.status_code == 400, f"Expected 400 for bad OTP, got {verify_bad_resp.status_code}"
    challenge.refresh_from_db()
    assert challenge.attempt_count == 1, "Attempt count was not incremented"
    print(f"[PASS] Invalid OTP rejected, attempt count incremented to {challenge.attempt_count}")

    # Test valid OTP
    verify_good_resp = client.post('/api/digilocker/access/verify-otp/', {
        'challenge_id': challenge.id,
        'otp': otp_code
    }, format='json')
    assert verify_good_resp.status_code == 200, f"Expected 200 for valid OTP, got {verify_good_resp.status_code}: {verify_good_resp.data}"
    access_token = verify_good_resp.data.get('access_token')
    assert access_token is not None, "Access token not returned upon verification"
    challenge.refresh_from_db()
    assert challenge.is_verified, "Challenge not marked verified"
    assert challenge.consumed_at is not None, "Challenge not marked consumed"
    print(f"[PASS] OTP verified successfully, access token issued: {access_token[:16]}...")

    # 8. API: Preview Document using Token
    print("\n--- 8. Testing Secure Document Preview ---")
    preview_resp = client.get(f'/api/digilocker/access/documents/{doc_id}/preview/?token={access_token}')
    assert preview_resp.status_code == 200, f"Expected 200 for preview, got {preview_resp.status_code}"
    assert preview_resp['Content-Type'] == 'application/pdf', f"Expected PDF content type, got {preview_resp['Content-Type']}"
    assert 'inline' in preview_resp['Content-Disposition'], "Expected inline disposition"
    print("[PASS] Document preview served securely with inline disposition.")

    # 9. API: Download Document using Token
    print("\n--- 9. Testing Secure Document Download ---")
    # Generate download challenge
    dl_otp = f"{secrets.randbelow(10000):04d}"
    dl_salt = secrets.token_hex(16)
    dl_hash = hashlib.sha256(f"{dl_otp}:{dl_salt}".encode('utf-8')).hexdigest() + f":{dl_salt}"
    dl_challenge = DigiLockerOTPChallenge.objects.create(
        requester=admin_user,
        target_employee=employee,
        document=doc_record,
        operation='download',
        otp_hash=dl_hash,
        expires_at=timezone.now() + timedelta(minutes=5),
        max_attempts=5
    )
    # Verify download OTP
    v_dl = client.post('/api/digilocker/access/verify-otp/', {
        'challenge_id': dl_challenge.id,
        'otp': dl_otp
    }, format='json')
    assert v_dl.status_code == 200
    dl_token = v_dl.data['access_token']

    dl_resp = client.get(f'/api/digilocker/access/documents/{doc_id}/download/?token={dl_token}')
    assert dl_resp.status_code == 200, f"Expected 200 for download, got {dl_resp.status_code}"
    assert 'attachment' in dl_resp['Content-Disposition'], "Expected attachment disposition"
    assert doc_record.original_filename in dl_resp['Content-Disposition'], "Original filename missing in Content-Disposition"
    print(f"[PASS] Document download served securely with attachment disposition: {dl_resp['Content-Disposition']}")

    # 10. API: Audit Report
    print("\n--- 10. Testing GET /api/digilocker/reports/ ---")
    report_resp = client.get('/api/digilocker/reports/')
    assert report_resp.status_code == 200, f"Expected 200 for reports, got {report_resp.status_code}"
    logs = report_resp.data
    assert len(logs) > 0, "No audit logs found"
    print(f"[PASS] Audit reports retrieved successfully (Total logged events: {len(logs)})")

    # Cleanup test data
    try:
        preview_resp.close()
        dl_resp.close()
    except Exception:
        pass

    try:
        if doc_record.stored_file and os.path.exists(doc_record.stored_file.path):
            os.remove(doc_record.stored_file.path)
    except Exception as e:
        print(f"[!] Info: cleanup file deferral: {e}")
    doc_record.delete()
    mapping_obj.delete()
    DigiLockerFolder.objects.filter(id=folder_id).delete()
    print("[PASS] Test cleanup completed.")

    print("\n=======================================================")
    print(" ALL DIGILOCKER TESTS PASSED WITH 100% SUCCESS RATE! ")
    print("=======================================================")

if __name__ == '__main__':
    run_tests()
