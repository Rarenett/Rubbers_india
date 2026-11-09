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

### 🐛 Fix: Email Attachment Upload and Delivery
**Files:** `frontend/src/jsx/components/AppsMenu/Email/Compose/DropFile.jsx`, `frontend/src/jsx/components/AppsMenu/Email/Compose/Compose.jsx`, `frontend/src/jsx/components/AppsMenu/Email/Read/Read.jsx`

- Identified that the React `DropFile.jsx` component was essentially a mock. It swallowed the file drops and never passed the binary File objects to its parent because it ignored the `onFilesChange` prop entirely.
- Rewrote `DropFile.jsx` to correctly map the Dropzone lifecycle hooks (`onChangeStatus`), extracting native `File` objects and propagating them to `Compose.jsx`.
- Verified `EmailService.js` correctly builds multi-part `FormData` appending `files`.
- Validated that the backend `EmailViewSet` and `EmailSerializer` natively process `files` loops to populate the `Attachment` model.
- The `Read.jsx` component seamlessly extracts the serialized `att.file` URLs from the DRF `AttachmentSerializer` mapping, allowing recipients to download/open attachments securely under Django's `/media/` root.

*Last updated: {time_str}*
"""

with codecs.open('WORKLOG.md', 'w', encoding='utf-8') as f:
    f.write(content + '\n' + new_entry)
