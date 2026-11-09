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

### 🐛 Fix: Resolved Visit Report API issues and data rendering
**Files:** `backend/project_app/urls.py`, `backend/project_app/views.py`, `frontend/src/jsx/components/MarketingConnect/MarketingVisitReport.jsx`

- Fixed URL namespace issue where `/api/project/` was duplicated in `project_app/urls.py`.
- Fixed `AttributeError` where the API attempted to access `stock_name` instead of `name` on the `StockItem` model.
- Set the default `filterDate` in `MarketingVisitReport.jsx` to an empty string instead of today's date so that users see historical visit data immediately upon opening the page without having to clear the filter.
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
