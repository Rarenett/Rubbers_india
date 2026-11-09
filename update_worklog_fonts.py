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

### 🎨 Improvement: Aligned Marketing Reports Typography with Task Management
**Files:** `frontend/src/jsx/components/MarketingConnect/MarketingVisitReport.jsx`, `frontend/src/jsx/components/MarketingConnect/MarketingAttendanceReport.jsx`

- Replaced React-Bootstrap's `<Table striped bordered>` styling with standard `<table className="table w-100">` enclosed in a `.table-responsive` block.
- Applied `<strong>` tags to all table header columns (`<th>`) across both Attendance and Visit Reports.
- This ensures consistency in layout, spacing, and font weight/family to match exactly with the Task Management module reports.
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
