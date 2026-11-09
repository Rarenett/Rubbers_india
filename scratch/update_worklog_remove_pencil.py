import re

worklog_path = r'c:\Paul@Rarenett\glenda_vite\WORKLOG.md'
with open(worklog_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_entry = """### 🎨 UI: Remove Pencil Edit Button Beside Email in Ownership Transfer Table
**Files:** `frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx`

- Removed the pencil icon edit button beside the email in the "Current Owner Email" column of the Ownership Transfer table.
- The email is now displayed cleanly as text, with all editing handled through the **Transfer** button in the Action column.

*Last updated: 2026-11-03 17:00 IST*"""

if "*Last updated:" in content:
    pattern = r"\*Last updated:[^\n]*\*"
    content = re.sub(pattern, new_entry, content)
else:
    content = content.rstrip() + "\n\n" + new_entry + "\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("WORKLOG updated successfully.")

