import re
from datetime import datetime

now = datetime.now()
timestamp = now.strftime('%Y-%m-%d %H:%M IST')
date_str = now.strftime('%Y-%m-%d')

entry = f"""

## {date_str}

### 🟢 Feature: Team Management Dashboard Modifications
**Files:** `TeamManagementDashboard.jsx`, `team_app/serializers.py`

- Fixed department to 'Tele Calling' in Team Dashboard.
- Prevented employees from being allocated to multiple teams simultaneously.
- Added backend validation in TeamSerializer for department and duplicate team membership.
- Added backend validation for Team Lead to belong to Tele Calling.

*Last updated: {timestamp}*
"""

with open('WORKLOG.md', 'a', encoding='utf-8') as f:
    f.write(entry)
