import re
from datetime import datetime

now = datetime.now()
timestamp = now.strftime('%Y-%m-%d %H:%M IST')
date_str = now.strftime('%Y-%m-%d')

entry = f"""

## {date_str}

### 🎨 Improvement: Replaced Native Alerts with SweetAlert2
**Files:** `TeamManagementDashboard.jsx`

- Migrated all browser-native `alert()` dialogs (e.g., successful creation/update, missing validation fields, Team Lead validation) to clean, user-friendly `Swal.fire` notifications utilizing the project's existing SweetAlert2 dependency.
- Extracted the clunky custom React Delete Modal and replaced the deletion execution flow with a native `Swal.fire` warning confirmation chain (`showCancelButton: true`, etc).
- Configured dynamic error handling to parse actual backend JSON validation dictionaries into the SweetAlert `text` properties rather than obfuscating them behind generic error strings.
- Completely removed redundant `teamToDelete` React state and the associated `.warning-modal-overlay` JSX block from the DOM.

*Last updated: {timestamp}*
"""

with open('WORKLOG.md', 'a', encoding='utf-8') as f:
    f.write(entry)
