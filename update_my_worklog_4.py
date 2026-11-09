import re
from datetime import datetime

now = datetime.now()
timestamp = now.strftime('%Y-%m-%d %H:%M IST')
date_str = now.strftime('%Y-%m-%d')

entry = f"""

## {date_str}

### 🟢 Feature: Team Edit and Delete Functionality
**Files:** `TeamManagementDashboard.jsx`

- Added Edit action to team cards, populating the form with existing team data.
- Employee availability during edit calculates correctly: members belonging to the current team remain available, while members of other teams stay hidden.
- Modified form submission to cleanly route to PUT `/api/teams/teams/<id>/` when saving an edited team.
- Added Delete action with a stylistic confirmation modal matching the project theme.
- Configured deletion to call DELETE `/api/teams/teams/<id>/`, safely dropping only team relationships and freeing up employees without altering underlying employee master data.

*Last updated: {timestamp}*
"""

with open('WORKLOG.md', 'a', encoding='utf-8') as f:
    f.write(entry)
