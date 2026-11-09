import re

worklog_path = r'c:\Paul@Rarenett\glenda_vite\WORKLOG.md'
with open(worklog_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_entry = """### 🟢 Feature: Central Default Sync & Toggle for Folder OTP Recipient Emails
**Files:** `backend/digilocker_app/models.py`, `backend/digilocker_app/migrations/0009_digilockerfolder_uses_default_otp_email.py`, `backend/digilocker_app/serializers.py`, `backend/digilocker_app/views.py`, `frontend/src/services/DigiLockerService.js`, `frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx`

- Added `uses_default_otp_email` boolean field (default True) to `DigiLockerFolder` with migration `0009`.
- When creating a folder or editing its email, if the email matches the centralized default (or if the default option is chosen), `uses_default_otp_email` is set to True.
- In `DigiLockerFolderSerializer.get_current_owner_email`, folders where `uses_default_otp_email=True` dynamically resolve the latest centralized default email, automatically synchronizing whenever the administrator updates the centralized default without requiring individual folder edits.
- Folders with custom emails (`uses_default_otp_email=False`) preserve their custom email independently.
- In `DigiLockerMapping.jsx` (Ownership Transfer):
  - Added a "Use Centralized Default OTP Email" toggle in the Edit Folder OTP Email modal allowing administrators to switch any customized folder back to the central default.
  - The Current Owner Email column automatically displays the effective OTP recipient email (synced central default or custom).
  - The existing Transfer button executes the complete ownership transfer with searchable active employee selection, confirmation dialog, database transaction, and table update.
  - The History icon opens the full immutable audit log for that folder.
- Dynamic OTP verification requests in `DigiLockerRequestOTPView` now resolve the latest effective email (`uses_default_otp_email` check).

*Last updated: 2026-11-03 16:35 IST*"""

if "*Last updated:" in content:
    pattern = r"\*Last updated:[^\n]*\*"
    content = re.sub(pattern, new_entry, content)
else:
    content = content.rstrip() + "\n\n" + new_entry + "\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("WORKLOG updated successfully.")

