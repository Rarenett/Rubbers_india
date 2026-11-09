import re

file_path = "WORKLOG.md"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

last_updated_pattern = r"\*Last updated:.*?\*"

new_entry = """### 🐛 Fix: Harmonize File Approval Permission Check with Role Menu Permissions
**Files:** `backend/digilocker_app/views.py`

- Root Cause: `DigiLockerFileApprovalViewSet` and `DigiLockerEditRequestViewSet` previously checked only hardcoded admin role names via `is_user_admin()`, returning empty lists for authorized administrators or department managers whose primary role in the user profile is specialized (such as IT Support / HOD).
- Fix: Introduced `has_file_approval_permission(user)` which checks superuser status, administrator roles, and dynamic `digilocker_approval` permissions granted in the role permission system.
- All documents uploaded across all employees are now correctly queryable and reviewable in the File Approval interface for authorized users.

*Last updated: 2026-11-03 10:31 IST*"""

if re.search(last_updated_pattern, content):
    content = re.sub(last_updated_pattern, new_entry, content)
else:
    content = content.rstrip() + "\n\n" + new_entry + "\n"

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("WORKLOG.md updated successfully.")

