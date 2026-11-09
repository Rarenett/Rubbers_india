import re

worklog_path = r'c:\Paul@Rarenett\glenda_vite\WORKLOG.md'
with open(worklog_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_entry = """### 🎨 Improvement: Bind Transfer Button Directly to Edit Folder OTP Email Modal
**Files:** `frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx`

- Updated the `Transfer` button in the Ownership Transfer table action column to open the **Edit Folder OTP Recipient Email** modal (`handleOpenEditEmailModal`).
- Clicking `Transfer` now immediately presents the form displaying Folder Name, Current Owner, Existing OTP Email, the "Use Centralized Default OTP Email" toggle, and the editable OTP Recipient Email input.

*Last updated: 2026-11-03 16:58 IST*"""

if "*Last updated:" in content:
    pattern = r"\*Last updated:[^\n]*\*"
    content = re.sub(pattern, new_entry, content)
else:
    content = content.rstrip() + "\n\n" + new_entry + "\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("WORKLOG updated successfully.")

