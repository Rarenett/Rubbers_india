import re

worklog_path = r'c:\Paul@Rarenett/glenda_vite/WORKLOG.md'
with open(worklog_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_entry = """### 🔒 Security / Scope: Strict Folder List Scoping by Creator in Folder Creation
**Files:** `backend/digilocker_app/views.py`, `frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx`

- Updated `DigiLockerFolderViewSet.get_queryset`:
  - When loading the Folder Creation page (`/digilocker/folder-creation`), every non-superuser strictly sees **only** their own created/owned folders (`created_by=user` or `owner=user`).
  - Folders created by other employees are excluded from their Folder Creation table.
  - Added `for_mapping=true` parameter in `DigiLockerMapping.jsx` so mapping administrators can load and map all folders in the Folder Mapping hierarchy view.

*Last updated: 2026-11-03 15:52 IST*"""

if "*Last updated:" in content:
    pattern = r"\*Last updated:[^\n]*\*"
    content = re.sub(pattern, new_entry, content)
else:
    content = content.rstrip() + "\n\n" + new_entry + "\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("WORKLOG updated successfully.")

