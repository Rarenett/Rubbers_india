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

### 🟢 Feature: Add & Remove Leads from Edit Team Modal
**Files:** `frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx`

- Added a "Remove" (`fa-trash`) icon button aligned to the right of each row in the Selected Leads table inside the Team modal.
- Integrated SweetAlert confirmation logic when removing a lead to prevent accidental removals, matching the ERP design standard.
- Removing a lead correctly preserves the underlying CRM lead record; it only drops the team association in state, which is pushed upon save.
- Introduced an "Add Lead" UI toggle in the Team modal header. Expanding this exposes the standard Repository `Select` dropdown and corresponding checkboxes.
- Implemented robust lead selection bridging allowing users to source new leads from multiple distinct repositories inside the active modal context.
- Existing duplicate prevention checks automatically sync checkbox states if a lead is already assigned to the team.
- The `btn-save-custom` action dynamically orchestrates the final `PATCH` request, replacing the backend relationships cleanly.

"""

content += "\n" + entry + f"\n*Last updated: {time_str}*\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)
