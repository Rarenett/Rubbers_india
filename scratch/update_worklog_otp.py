import re

worklog_path = r'c:\Paul@Rarenett\glenda_vite\WORKLOG.md'
with open(worklog_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_entry = """### 🟢 Feature: Independent View & Download OTP Settings in DigiLocker Folder Mapping
**Files:** `backend/digilocker_app/models.py`, `backend/digilocker_app/migrations/0008_digilockerfoldermapping_download_otp_required_and_more.py`, `backend/digilocker_app/serializers.py`, `backend/digilocker_app/views.py`, `frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx`, `frontend/src/jsx/components/DigiLocker/DigiLockerAccess.jsx`

- Added `view_otp_required` and `download_otp_required` boolean fields to `DigiLockerFolderMapping` model (with migration `0008`), defaulting to True.
- Included `view_otp_required` and `download_otp_required` in `DigiLockerFolderMappingSerializer`.
- Updated `DigiLockerMappingViewSet` (`create` & `perform_update`) to persist independent OTP configuration for both bulk and granular folder mappings.
- Enhanced `DigiLockerAccessView.get` to resolve `view_otp_required` and `download_otp_required` (including subfolder inheritance) and expose corresponding endpoints and direct URLs.
- Updated `DigiLockerPreviewDocumentView` and `DigiLockerDownloadDocumentView` to allow direct access without OTP when `view_otp_required` or `download_otp_required` is configured as False (or for administrators), while strictly enforcing mapping permissions (`can_view`, `can_download`).
- In `DigiLockerMapping.jsx`:
  - Added mutually exclusive "With OTP" and "Without OTP" options under "View Documents" and "Download Documents" in the Hierarchical Folder Mapping modal.
  - Automatically clears and resets OTP options when View or Download permission is disabled.
  - Retained and updated granular permission settings for hierarchical folder nodes.
  - Displayed OTP indicators (`(OTP)` / `(No OTP)`) on mapping badges in the folder mapping table.
- In `DigiLockerAccess.jsx`:
  - Evaluated operation-specific OTP requirements (`view_otp_required` vs `download_otp_required`), opening previews directly or initiating direct downloads when OTP is not required, while initiating the OTP challenge workflow when OTP is required.

*Last updated: 2026-11-03 15:30 IST*"""

if "*Last updated:" in content:
    pattern = r"\*Last updated:[^\n]*\*"
    content = re.sub(pattern, new_entry, content)
else:
    content = content.rstrip() + "\n\n" + new_entry + "\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("WORKLOG updated successfully.")

