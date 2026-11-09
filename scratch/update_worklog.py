import re

worklog_path = r'c:\Paul@Rarenett\glenda_vite\WORKLOG.md'
with open(worklog_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_entry = """### 🟢 Feature: Allow Reverting Approved Documents to Pending in File Approval
**Files:** `backend/digilocker_app/views.py`, `frontend/src/services/DigiLockerService.js`, `frontend/src/jsx/components/DigiLocker/FileApproval.jsx`

- Added `set-pending` endpoint (`@action(detail=True, methods=['post'])`) to `DigiLockerFileApprovalViewSet` allowing authorized admins to revert an approved file's status back to `pending`.
- Created `setFilePending` method in `DigiLockerService.js`.
- Updated `FileApproval.jsx` to keep a prominent green tick button visible for already approved items in the Action column.
- Clicking the tick button displays a SweetAlert2 confirmation dialog (*"Do you want to change this document back to Pending status? This will allow the document to be edited or re-reviewed."*).
- When confirmed, sets the status back to `pending`, logs the event in approval history and audit logs, notifies the uploader, and refreshes the table to allow re-review or editing.

*Last updated: 2026-11-03 15:15 IST*"""

if "*Last updated:" in content:
    pattern = r"\*Last updated:[^\n]*\*"
    content = re.sub(pattern, new_entry, content)
else:
    content = content.rstrip() + "\n\n" + new_entry + "\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("WORKLOG updated successfully.")
