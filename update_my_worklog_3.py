import re
from datetime import datetime

now = datetime.now()
timestamp = now.strftime('%Y-%m-%d %H:%M IST')
date_str = now.strftime('%Y-%m-%d')

entry = f"""

## {date_str}

### 🐛 Fix: Team Creation with Optional Team Lead
**Files:** `TeamManagementDashboard.jsx`

- Fixed an issue where the frontend blocked team creation if no Team Lead was selected.
- Removed the mandatory `teamLead` validation requirement in `handleSubmit` and the `disabled` property of the Finalize button.
- Team creation now successfully processes payloads with an optional or null Team Lead without changing existing payload shapes or backend models.

*Last updated: {timestamp}*
"""

with open('WORKLOG.md', 'a', encoding='utf-8') as f:
    f.write(entry)
