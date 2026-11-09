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

### 🎨 Improvement: Fix Action Icons and Support Team Editing
**Files:** `frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx`, `backend/crm/views.py`, `backend/crm/serializers.py`

- Replaced native Bootstrap buttons for View/Edit/Delete actions in the Projects table with `EditButton` and `DeleteButton` components to match existing ERP standards (colors, icons, hover styles).
- Implemented robust `update` and `partial_update` methods in `TelecallingTeamViewSet` to support dynamic editing of team names and lead assignments via PATCH requests.
- Augmented `TelecallingLeadAssignmentSerializer` with a `SerializerMethodField` to embed detailed lead metadata, allowing the frontend to easily pre-fill selected leads during team edits.
- Refactored `TeleCallingDashboard.jsx` to dynamically reuse the existing "Make Team" modal for editing. This seamlessly supports adding/removing leads across multiple repositories with the same robust selection mechanics as creation.
- Added strict routing to ensure the old Telecalling Department feature continues to use its original editing flow, isolating all structural edits purely to the new Team structures.

"""

content += "\n" + entry + f"\n*Last updated: {time_str}*\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)
