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

### 🎨 Improvement: Final Polish for Telecalling Team Modal
**Files:** `frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx`

- Completely removed pagination from the selected leads list within the modal, as requested.
- Verified that all selected leads now render in one continuous scrollable list.
- Confirmed that the modal-close button (`×`) now correctly inherits the `.modal-close-x` CSS (which perfectly matches the Park Area reference styles: `#aaa` color, no borders, etc.) since the previously missing stylesheet has been fully injected.
- Ensured the `modal-body-custom` handles internal `overflow-y: auto` with a constrained max-height so that the footer and action buttons remain visible at all times.

"""

content += "\n" + entry + f"\n*Last updated: {time_str}*\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)
