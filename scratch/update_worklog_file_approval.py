import re

file_path = "WORKLOG.md"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

last_updated_pattern = r"\*Last updated:.*?\*"

new_entry = """### 🟢 Feature: DigiLocker File Approval and Edit Approval Workflow
**Files:** `backend/digilocker_app/models.py`, `backend/digilocker_app/serializers.py`, `backend/digilocker_app/views.py`, `backend/digilocker_app/urls.py`, `backend/seed_digilocker_menu.py`, `frontend/src/services/DigiLockerService.js`, `frontend/src/jsx/components/DigiLocker/FileApproval.jsx`, `frontend/src/jsx/components/DigiLocker/UploadFiles.jsx`, `frontend/src/jsx/index.jsx`

- Created the **File Approval** feature in the DigiLocker module under **Transactions > File Approval** (`/digilocker/file-approval`) accessible strictly to authorized administrators via role permissions.
- Added model fields and database models:
  - `DigiLockerDocument.approval_status` (`pending`, `approved`, `rejected`), `reviewed_by`, `reviewed_at`, `rejection_reason`.
  - `DigiLockerEditRequest`: document, requested_by, request_reason, status (`pending`, `approved`, `rejected`, `used`), reviewed_by, reviewed_at, rejection_reason.
  - `DigiLockerApprovalHistory`: document, action_type, previous_status, new_status, performed_by, remarks, created_at.
- Backend API implementation:
  - Initial upload automatically sets document status to `pending` and notifies admins.
  - Admins can preview, approve, or reject files with reason through `DigiLockerFileApprovalViewSet`.
  - Approved documents are locked against editing or deletion by employees at both API and UI level.
  - Employees can request edit approval with an optional reason via `/request-edit/`.
  - Admins review and approve/reject edit requests in `DigiLockerEditRequestViewSet`.
  - An approved edit request unlocks only that specific document for its owner.
  - Once modified, document status automatically resets to `pending` and locks again for admin re-approval.
  - Maintained complete immutable audit history for every action (`DigiLockerApprovalHistory`).
- Frontend implementation:
  - Created `FileApproval.jsx` with two tabs: **Tab 1: File Approvals** (consolidated all-employee uploads with filters, search, preview, approve, reject, history) and **Tab 2: Edit Approval Requests** (with preview, approve, reject).
  - Updated `UploadFiles.jsx` for employees to display approval status badges, rejection feedback, and conditional "Request Edit" vs direct edit buttons.
  - Added routes in `jsx/index.jsx` wrapped with `ProtectedRoute module="digilocker_approval"`.

*Last updated: 2026-11-03 10:15 IST*"""

if re.search(last_updated_pattern, content):
    content = re.sub(last_updated_pattern, new_entry, content)
else:
    content = content.rstrip() + "\n\n" + new_entry + "\n"

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("WORKLOG.md updated successfully.")

