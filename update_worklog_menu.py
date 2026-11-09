import os
import re
from datetime import datetime

worklog_path = r"c:\Paul@Rarenett\glenda_vite1\WORKLOG.md"

with open(worklog_path, 'r', encoding='utf-8') as f:
    content = f.read()

today_str = datetime.now().strftime("%Y-%m-%d")
time_str = datetime.now().strftime("%H:%M IST")

entry = f"""
## {today_str}

### 🎨 Improvement: Added Visit Report to Marketing Connect menu
**Files:** `backend/add_visit_report_menu.py`

- Created and ran a script to register `Visit Report` as a SubSubMenu under `Market Connect` -> `Reports` dynamically in the database.
- Handled `RoleMenuPermission` associations so that all roles have permission to view the Visit Report sidebar menu link.
"""

if "## " + today_str in content:
    pass

last_updated_regex = r"\*Last updated:.*?\*"

if re.search(last_updated_regex, content):
    content = re.sub(last_updated_regex, "", content).rstrip()

content += "\n\n---\n" + entry + f"\n\n*Last updated: {today_str} {time_str}*\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("WORKLOG updated successfully.")
