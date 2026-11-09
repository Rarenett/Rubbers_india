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

### 🎨 Improvement: Match View Details Modal Close Button UI Exactly
**Files:** `frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx`

- Realigned the Telecalling View Details modal CSS to exactly match `ParkArea.jsx`.
- The footer "Close" button has been properly restyled to `#7A70BA` (purple) instead of the previous generic grey implementation, matching the ERP convention exactly.
- Re-verified the `modal-close-x` top right icon structure.

"""

content += "\n" + entry + f"\n*Last updated: {time_str}*\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)
