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

### 🐛 Fix: Email Body Auto-Capitalization Issue
**Files:** `frontend/src/jsx/components/AppsMenu/Email/Compose/Compose.jsx`

- Identified the root cause of automatic text capitalization: a global `handleInputCapitalize` React `useEffect` listener inside `App.jsx` intercepts all input globally to force title case.
- Passed the `no-capitalize` CSS class to the Email Compose `textarea` (`id="email-compose-editor"`).
- This explicitly signals the global hook to ignore the email message field, allowing users to write naturally cased emails (e.g., lowercased, sentence-cased).
- Confirmed this change is 100% scoped to the email feature, preserving the global auto-capitalization behavior elsewhere in the ERP dashboard.

*Last updated: {time_str}*
"""

with codecs.open('WORKLOG.md', 'w', encoding='utf-8') as f:
    f.write(content + '\n' + new_entry)
