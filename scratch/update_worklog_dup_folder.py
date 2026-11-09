import re

worklog_path = r'c:\Paul@Rarenett\glenda_vite\WORKLOG.md'
with open(worklog_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_entry = """### 🛡️ Validation: Prevent Duplicate Folder Names in Folder Creation
**Files:** `backend/digilocker_app/serializers.py`, `frontend/src/jsx/components/DigiLocker/FolderCreation.jsx`

- Updated `DigiLockerFolderSerializer.validate` in `serializers.py`:
  - Disallows creating or renaming a folder to an existing active folder name (case-insensitive check across active folders).
  - Returns a clear validation error: *"A folder with the name '<name>' already exists. Duplicate folder names are not allowed."*
- Updated `validateForm` in `FolderCreation.jsx`:
  - Added instant client-side validation preventing form submission when the entered folder name matches any existing folder name.

*Last updated: 2026-11-03 17:08 IST*"""

if "*Last updated:" in content:
    pattern = r"\*Last updated:[^\n]*\*"
    content = re.sub(pattern, new_entry, content)
else:
    content = content.rstrip() + "\n\n" + new_entry + "\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("WORKLOG updated successfully.")

