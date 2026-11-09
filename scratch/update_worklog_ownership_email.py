import re

worklog_path = r'c:\Paul@Rarenett\glenda_vite\WORKLOG.md'
with open(worklog_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_entry = """### 🟢 Feature: Folder OTP Recipient Email Display & Editing in Ownership Transfer
**Files:** `backend/digilocker_app/serializers.py`, `backend/digilocker_app/views.py`, `frontend/src/services/DigiLockerService.js`, `frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx`

- Updated `DigiLockerFolderSerializer.get_current_owner_email` to return the actual configured OTP recipient email saved for that folder (`folder.default_otp_email`), rather than the employee's personal registered account email.
- Added `@action(detail=True, methods=['post', 'patch'], url_path='update-otp-email')` to `DigiLockerFolderViewSet` allowing authorized administrators to update the folder's configured OTP recipient email with email regex validation, audit logging, and zero impact on folder ownership or mappings.
- Added `updateFolderOtpEmail` API call in `DigiLockerService.js`.
- In `DigiLockerMapping.jsx` (Ownership Transfer Tab):
  - Updated the "Current Owner Email" column to show the folder's configured OTP email with a dedicated edit pencil button.
  - Added an intuitive editing modal displaying folder name, current owner, and editable OTP recipient email with format validation and confirmation before saving.
  - Preserved independence between folder ownership and OTP recipient email: transferring ownership leaves the email intact, and editing the email leaves ownership intact.
- Confirmed that `DigiLockerRequestOTPView` dynamically resolves `folder.default_otp_email` for all future OTP requests for that folder.

*Last updated: 2026-11-03 16:25 IST*"""

if "*Last updated:" in content:
    pattern = r"\*Last updated:[^\n]*\*"
    content = re.sub(pattern, new_entry, content)
else:
    content = content.rstrip() + "\n\n" + new_entry + "\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("WORKLOG updated successfully.")

