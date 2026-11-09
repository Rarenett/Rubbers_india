import re

worklog_path = r'c:\Paul@Rarenett\glenda_vite\WORKLOG.md'
with open(worklog_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_entry = """### 🟢 Feature: Add 'All Employees' Filter in DigiLocker Document Access
**Files:** `backend/digilocker_app/views.py`, `frontend/src/jsx/components/DigiLocker/DigiLockerAccess.jsx`

- Added `<option value="all">All Employees</option>` to the Employee selector dropdown in `DigiLockerAccess.jsx`.
- Updated `DigiLockerAccessView.get` in `views.py` to handle `employee_id='all'` for administrators, fetching and aggregating mapped folders across all employees.

*Last updated: 2026-11-03 17:03 IST*"""

if "*Last updated:" in content:
    pattern = r"\*Last updated:[^\n]*\*"
    content = re.sub(pattern, new_entry, content)
else:
    content = content.rstrip() + "\n\n" + new_entry + "\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("WORKLOG updated successfully.")

