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

### 🐛 Fix: Email Read Page Blank Screen
**Files:** `frontend/src/jsx/index.jsx`, `frontend/src/jsx/components/AppsMenu/Email/Read/Read.jsx`

- Identified that the React Router in `index.jsx` lacked an `/:id` parameter for `/email-read`, causing a fallback UI crash (blank page) when navigating to individual emails.
- Updated `index.jsx` to register `{{ url: 'email-read/:id', component: <Read /> }}`.
- Completely rewrote `Read.jsx` which was previously a static, hardcoded HTML mockup.
- Implemented dynamic data fetching in `Read.jsx` using `EmailService.getEmailById(id)`.
- Handled loading states, graceful "Email not found" 404 UI, and dynamic sender/recipient mapping.
- Automatically marks unread emails as read upon successful retrieval via `EmailService.markAsRead(id)`.
- Retained the existing responsive layout and connected the delete/archive actions.

*Last updated: {time_str}*
"""

with codecs.open('WORKLOG.md', 'w', encoding='utf-8') as f:
    f.write(content + '\n' + new_entry)
