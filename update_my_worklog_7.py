import re
from datetime import datetime

now = datetime.now()
timestamp = now.strftime('%Y-%m-%d %H:%M IST')
date_str = now.strftime('%Y-%m-%d')

entry = f"""

## {date_str}

### 🎨 Improvement: Compact Edit Team Modal Architecture
**Files:** `TeamManagementDashboard.jsx`

- Reconfigured `.edit-modal-container` to max-width: 650px and max-height: 75vh, abandoning the excessive full-page width inherited from the create screen.
- Restructured the Edit Modal header layout to natively support a cleaner `.edit-modal-header` featuring a minimal title and standard right-aligned close/cancel trigger.
- Rewrote `renderFormContent` to conditionally return a highly compressed, single-column internal JSX structure specifically for `isModal === true`. 
- Repackaged the personnel selection panel into a dense list array nested inside a strictly constrained 30vh scroll container, stripping redundant spacing and visual weight from the cards while retaining complete interactive parity.

*Last updated: {timestamp}*
"""

with open('WORKLOG.md', 'a', encoding='utf-8') as f:
    f.write(entry)
