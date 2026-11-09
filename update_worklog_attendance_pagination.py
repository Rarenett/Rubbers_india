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

### 🟢 Feature: Added Pagination to Marketing Attendance Report
**Files:** `frontend/src/jsx/components/MarketingConnect/MarketingAttendanceReport.jsx`

- Fully implemented client-side pagination for the Marketing Attendance Report.
- Applied identical pagination logic as seen in other reports: chunks 10 rows per page.
- Auto-resets back to page 1 whenever the Date Filter is toggled.
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
