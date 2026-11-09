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

### 🟢 Feature: Added Marketing Visit Report
**Files:** `backend/project_app/views.py`, `backend/project_app/urls.py`, `frontend/src/jsx/components/MarketingConnect/MarketingVisitReport.jsx`, `frontend/src/jsx/index.jsx`

- Created the Visit Report API to query and combine data from `MarketingWishlist` and `MarketingShopVisit` from `db_glendatest`.
- Joined wishlist and visit data on mobile number and date.
- Added new `MarketingVisitReport` UI component mimicking the existing balance-report styles, search, pagination, loading states, and export options.
- Registered `/market-connect/reports/visit-report` in `index.jsx` routing.
"""

if "## " + today_str in content:
    # Append under the existing date
    parts = content.split("## " + today_str)
    # The first part is everything before the date.
    # The second part is everything after the date.
    # We want to insert our entry right after the date heading, or before the next date.
    # It's easier to just append at the end, but before "Last updated"
    pass

# We will just append before the last updated line.
last_updated_regex = r"\*Last updated:.*?\*"

if re.search(last_updated_regex, content):
    content = re.sub(last_updated_regex, "", content).rstrip()

content += "\n\n---\n" + entry + f"\n\n*Last updated: {today_str} {time_str}*\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("WORKLOG updated successfully.")
