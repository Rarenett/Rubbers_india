import datetime
import re
import codecs

try:
    with codecs.open('WORKLOG.md', 'r', encoding='utf-8') as f:
        content = f.read()
except UnicodeDecodeError:
    with codecs.open('WORKLOG.md', 'r', encoding='utf-16le') as f:
        content = f.read()

content = re.sub(r'\*Last updated:.*?\*', '', content)
content = content.strip()

today = datetime.datetime.now().strftime('%Y-%m-%d')
time_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M IST')

new_entry = f"""
---

## {today}

### 🎨 Improvement: Expose Mail in Profile Dropdown
**Files:** `frontend/src/jsx/layouts/nav/Header.jsx`

- Uncommented the existing internal mail link in the top-right user profile dropdown.
- Changed the label from 'Inbox' to 'Mail' for clarity and better UX.
- The link navigates securely to `/email-inbox` without altering any permissions or creating new routes.

*Last updated: {time_str}*
"""

with codecs.open('WORKLOG.md', 'w', encoding='utf-8') as f:
    f.write(content + '\n' + new_entry)
