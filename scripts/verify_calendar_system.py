"""
End-to-end verification script for Wallet Calendar Automatic Screenshot Capture & Security.
"""
import os
import sys
import io
import requests

# Set up Django environment to obtain token
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from wallet_app.models import ScreenshotSchedule, ScreenshotExecution, get_wallet_local_date, get_wallet_local_time

User = get_user_model()
user = User.objects.filter(email='wallet_cal_test@example.com').first()
if not user:
    user = User.objects.create_user(
        email='wallet_cal_test@example.com',
        username='wallet_cal_test',
        password='Password123!'
    )

token = str(RefreshToken.for_user(user).access_token)
server_url = "http://127.0.0.1:8000"
headers = {"Authorization": f"Bearer {token}"}

print("=" * 65)
print("WALLET CALENDAR AUTOMATIC CAPTURE & SECURITY VERIFICATION")
print("=" * 65)

# Step 1: Clean up any prior test schedule
today = get_wallet_local_date()
now_time = get_wallet_local_time()
ScreenshotExecution.objects.filter(user=user).delete()
ScreenshotSchedule.objects.filter(user=user, scheduled_date=today).delete()

# Step 2: Create a schedule for today
sched = ScreenshotSchedule.objects.create(
    user=user,
    scheduled_date=today,
    scheduled_time=now_time,
    is_active=True
)
print(f"[OK] Created test schedule #{sched.id} for {today} at {now_time}")

# Step 3: Test GET /api/wallet/calendar/pending-captures/
pending_res = requests.get(f"{server_url}/api/wallet/calendar/pending-captures/", headers=headers)
assert pending_res.status_code == 200, f"Failed pending-captures: {pending_res.text}"
pending_data = pending_res.json()
print(f"[OK] pending-captures returned {pending_data['pending_count']} pending items.")
due_item = next((i for i in pending_data['pending_schedules'] if i['id'] == sched.id), None)
assert due_item is not None, "Created schedule not found in pending-captures"
assert due_item['is_due'] is True, f"Schedule #{sched.id} should be due"
print(f"[OK] Schedule #{sched.id} is flagged is_due=True correctly for automatic capture.")

# Step 4: Test Agent Heartbeat & Status
hb_res = requests.post(f"{server_url}/api/wallet/calendar/agent-heartbeat/", headers=headers, json={
    'version': '1.2.0',
    'hostname': 'VERIFY-AGENT-HOST'
})
assert hb_res.status_code == 200, f"Heartbeat failed: {hb_res.text}"
status_res = requests.get(f"{server_url}/api/wallet/calendar/agent-status/", headers=headers)
assert status_res.status_code == 200, f"Agent status failed: {status_res.text}"
assert status_res.json()['is_online'] is True, "Agent should report online"
print(f"[OK] Desktop Agent heartbeat active: status is ONLINE on '{status_res.json()['agent_info']['hostname']}'.")

# Step 5: Test Automated Screenshot Upload (Simulating background agent / session)
dummy_png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82'
files = {'screenshot_file': ('auto_capture.png', io.BytesIO(dummy_png), 'image/png')}
data = {
    'schedule_id': sched.id,
    'scheduled_date': str(today),
    'scheduled_time': now_time.strftime("%H:%M:%S"),
    'status': 'Captured',
    'capture_source': 'Windows Desktop Agent'
}
upload_res = requests.post(f"{server_url}/api/wallet/calendar/capture/", headers=headers, data=data, files=files)
assert upload_res.status_code in (200, 201), f"Upload failed: {upload_res.text}"
exec_id = upload_res.json()['execution']['id']
print(f"[OK] Screenshot automatically captured & saved in database (execution #{exec_id}, status: Captured).")

# Step 6: Test Deduplication Protection (Same schedule captured again)
files_dup = {'screenshot_file': ('auto_capture.png', io.BytesIO(dummy_png), 'image/png')}
dup_res = requests.post(f"{server_url}/api/wallet/calendar/capture/", headers=headers, data=data, files=files_dup)
assert dup_res.status_code == 200, f"Duplicate check failed: {dup_res.text}"
assert "already captured" in dup_res.json()['message'].lower(), "Expected deduplication message"
print(f"[OK] Deduplication verified: prevented duplicate screenshot for schedule #{sched.id}.")

# Step 7: Verify pending-captures no longer lists the schedule (already captured)
pending_res_after = requests.get(f"{server_url}/api/wallet/calendar/pending-captures/", headers=headers)
assert not any(i['id'] == sched.id for i in pending_res_after.json()['pending_schedules']), "Captured schedule should not be pending"
print("[OK] Pending captures correctly excludes completed capture.")

# Step 8: Verify Schedule list status is 'Captured' and secure URL is generated
cal_res = requests.get(f"{server_url}/api/wallet/calendar/?date={today}", headers=headers)
sched_item = next((s for s in cal_res.json() if s['id'] == sched.id), None)
assert sched_item is not None, "Schedule not found in calendar"
assert sched_item['status'] == 'Captured', f"Schedule status should be Captured, got {sched_item['status']}"
assert f"/api/wallet/calendar/{exec_id}/view-screenshot/" in sched_item['screenshot_url'], f"Expected secure view-screenshot URL, got {sched_item['screenshot_url']}"
print(f"[OK] Calendar schedule status is 'Captured' with secure URL: {sched_item['screenshot_url']}")

# Step 9: Verify Secure view-screenshot Endpoint
# 9a. Authenticated with Bearer Header
view_res = requests.get(f"{server_url}/api/wallet/calendar/{exec_id}/view-screenshot/", headers=headers)
assert view_res.status_code == 200, f"View screenshot failed: {view_res.status_code}"
assert view_res.headers.get('content-type') == 'image/png', "Expected image/png content type"
print("[OK] Secure image served successfully with Bearer authentication.")

# 9b. Authenticated with ?token=<jwt> query parameter (for <img> tags)
view_query_res = requests.get(f"{server_url}/api/wallet/calendar/{exec_id}/view-screenshot/?token={token}")
assert view_query_res.status_code == 200, f"Query token view failed: {view_query_res.status_code}"
print("[OK] Secure image served successfully with ?token=<jwt> query parameter.")

# 9c. Anonymous (no token) should return 401 Unauthorized
anon_res = requests.get(f"{server_url}/api/wallet/calendar/{exec_id}/view-screenshot/")
assert anon_res.status_code == 401, f"Expected 401 for anonymous access, got {anon_res.status_code}"
print("[OK] Anonymous direct access rejected with 401 Unauthorized (public URLs prevented).")

# 9d. Different non-admin user should return 403 Forbidden
other_user = User.objects.filter(email='other_unauth_user@example.com').first()
if not other_user:
    other_user = User.objects.create_user(
        email='other_unauth_user@example.com',
        username='other_unauth_user',
        password='Password123!'
    )
other_token = str(RefreshToken.for_user(other_user).access_token)
other_res = requests.get(f"{server_url}/api/wallet/calendar/{exec_id}/view-screenshot/", headers={"Authorization": f"Bearer {other_token}"})
assert other_res.status_code == 403, f"Expected 403 for unauthorized user, got {other_res.status_code}"
print("[OK] Unauthorized user access rejected with 403 Forbidden.")

# Cleanup
sched.delete()
ScreenshotExecution.objects.filter(id=exec_id).delete()
print("=" * 65)
print("ALL AUTOMATIC SCREENSHOT & SECURITY TESTS PASSED SUCCESSFULLY!")
print("=" * 65)
