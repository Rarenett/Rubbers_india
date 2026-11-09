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

### 🎨 Improvement: Email Body Sentence Capitalization
**Files:** `frontend/src/jsx/components/AppsMenu/Email/Compose/Compose.jsx`

- Replaced strict static casing with a dynamic regex-based sentence capitalization handler `/(^|[.?!]\s+|\n+)([a-z])/g` in the `onChange` event of the Email Compose message field.
- Ensures natural typing automatically capitalizes the first character of sentences, following periods, question marks, exclamation marks, or new paragraphs natively.
- Explicitly scoped to NOT mutate existing uppercase strings (e.g., preserves "ERP", "API", or proper names like "John").
- Excludes other input fields such as the Subject or other dashboard elements by utilizing isolated local state evaluation.

*Last updated: {time_str}*
"""

with codecs.open('WORKLOG.md', 'w', encoding='utf-8') as f:
    f.write(content + '\n' + new_entry)
