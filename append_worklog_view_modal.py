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

### 🎨 Improvement: Fix View Details Modal UI
**Files:** `frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx`

- Reconstructed the View Details modal to strictly conform to the ERP application's design system (matching `ParkArea.jsx`).
- Upgraded the default Bootstrap modal layout to use custom namespaced `.telecalling-team-modal` classes, inheriting the correct borders, shadows, header/footer spacing, and corner radius.
- Replaced the default close button with the standard `.modal-close-x` element for consistency across the application.
- Redesigned the assigned leads list into a structured data table.
- Dynamically mapped lead data to display the actual Company Name (`lead_details.company`) instead of the arbitrary Repository Source, correctly handling multiple repositories. Fallbacks to "Unknown" are provided when data is genuinely missing.

"""

content += "\n" + entry + f"\n*Last updated: {time_str}*\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)
