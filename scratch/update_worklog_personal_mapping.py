import re

file_path = "WORKLOG.md"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

last_updated_pattern = r"\*Last updated:.*?\*"

new_entry = """### 🟢 Feature: Enable Personal Folders in Hierarchical Folder Mapping
**Files:** `backend/digilocker_app/views.py`, `frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx`

- Updated `frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx` to include both shared and personal folders in the mapping tree instead of filtering exclusively for shared folders.
- Added visual indicator badge for personal folders (`fa-user Personal (Owner Name)`) in the folder mapping modal tree.
- Updated backend `DigiLockerFolderViewSet` and `DigiLockerMappingViewSet` in `backend/digilocker_app/views.py` so authorized users with mapping permissions can fetch and map all active folders (both personal and shared) to any employee.

*Last updated: 2026-11-03 11:05 IST*"""

if re.search(last_updated_pattern, content):
    content = re.sub(last_updated_pattern, new_entry, content)
else:
    content = content.rstrip() + "\n\n" + new_entry + "\n"

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("WORKLOG.md updated successfully.")

