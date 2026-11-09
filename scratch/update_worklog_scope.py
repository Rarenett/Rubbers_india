import re

worklog_path = r'c:\Paul@Rarenett\glenda_vite\WORKLOG.md'
with open(worklog_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_entry = """### 🐛 Fix: Scope Folder List by Employee Ownership in Folder Creation
**Files:** `backend/digilocker_app/views.py`

- Identified that non-admin employees in Folder Creation (`/digilocker/folder-creation`) could previously see folders created by other employees if they were an admin/mapping manager, or conversely couldn't see their own newly created folders if strictly filtered by mapping only.
- Updated `DigiLockerFolderViewSet.get_queryset`:
  - Non-admin employees now see their own folders (`created_by=user` or `owner=user`) plus any folders actively mapped to them.
  - Document viewing, downloading, and uploading continue to enforce strict mapping and OTP permissions independently in DigiLocker Access and Document APIs.

*Last updated: 2026-11-03 15:44 IST*"""

if "*Last updated:" in content:
    pattern = r"\*Last updated:[^\n]*\*"
    content = re.sub(pattern, new_entry, content)
else:
    content = content.rstrip() + "\n\n" + new_entry + "\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("WORKLOG updated successfully.")

