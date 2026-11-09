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

### 🐛 Fix: Internal Mail Recipient API and Frontend Fetch (Part 2)
**Files:** `frontend/src/jsx/components/AppsMenu/Email/Compose/Compose.jsx`, `frontend/src/services/EmailService.js`

- Discovered `import.meta.env.VITE_API_URL` was occasionally returning undefined in dev environments, causing the raw `axios.get` to hit `undefined/emails/internal_users/` resulting in 404 and "Failed to fetch internal users. Check API configuration" errors.
- Removed the raw `axios` import in `Compose.jsx`.
- Added a `getInternalUsers` service function to `EmailService.js` to utilize the globally configured `axiosInstance` which resolves the correct backend URL (`VITE_BACKEND_URL`).
- Refactored `Compose.jsx` to fetch recipients using the robust `EmailService.getInternalUsers()`.

*Last updated: {time_str}*
"""

with codecs.open('WORKLOG.md', 'w', encoding='utf-8') as f:
    f.write(content + '\n' + new_entry)
