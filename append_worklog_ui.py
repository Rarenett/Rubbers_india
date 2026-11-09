import os
from datetime import datetime
import re

worklog_path = r"c:\Archana\glenda_vite\WORKLOG.md"

with open(worklog_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove old timestamp
content = re.sub(r'\n\*Last updated:.*?\*\n', '', content).strip()

now = datetime.now()
date_str = now.strftime('%Y-%m-%d')
time_str = now.strftime('%Y-%m-%d %H:%M IST')

entry = f"""
---

## {date_str}

### 🎨 Improvement: Redesign Create Telecalling Team Modal
**Files:** `frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx`

- Redesigned the Create Telecalling Team modal to match the exact styling conventions (CSS classes, modal structure, buttons) used in the Park Area page.
- Scoped all CSS to a `.telecalling-team-modal` class to ensure no global interference.
- Implemented frontend pagination for the selected leads list within the modal using the shared `Pagination` component.
- Ensure that creating the team submits all selected leads across all pages, preserving existing validation and API submission logic.

"""

content += "\n" + entry + f"\n*Last updated: {time_str}*\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)
