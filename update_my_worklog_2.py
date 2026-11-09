import re
from datetime import datetime

now = datetime.now()
timestamp = now.strftime('%Y-%m-%d %H:%M IST')
date_str = now.strftime('%Y-%m-%d')

entry = f"""

## {date_str}

### 🟢 Feature: Team Lead UI Strict Enforcement
**Files:** `TeamManagementDashboard.jsx`

- Enforced that an employee must be selected as a team member before they can be made Team Lead.
- Disabled the "Make Lead" button for unselected employees.
- Team Lead status is automatically cleared if the employee is unselected from the team.
- Selecting a new Team Lead automatically overwrites the previous lead selection.

*Last updated: {timestamp}*
"""

with open('WORKLOG.md', 'a', encoding='utf-8') as f:
    f.write(entry)
