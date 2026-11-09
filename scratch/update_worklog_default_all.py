import re

worklog_path = r'c:\Paul@Rarenett\glenda_vite\WORKLOG.md'
with open(worklog_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_entry = """### 🎨 UX: Default Employee Filter to 'All Employees' on Page Load
**Files:** `frontend/src/jsx/components/DigiLocker/DigiLockerAccess.jsx`

- Updated `loadInitialData` in `DigiLockerAccess.jsx` so administrators see **"All Employees"** selected by default whenever opening the DigiLocker Document Access page.
- Initial load automatically requests access data with `employee_id="all"`, displaying all accessible mapped folders and documents across the organization.

*Last updated: 2026-11-03 17:05 IST*"""

if "*Last updated:" in content:
    pattern = r"\*Last updated:[^\n]*\*"
    content = re.sub(pattern, new_entry, content)
else:
    content = content.rstrip() + "\n\n" + new_entry + "\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("WORKLOG updated successfully.")

