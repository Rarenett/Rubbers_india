import os
from datetime import datetime

worklog_path = r'c:\Archana\glenda_vite\WORKLOG.md'

with open(worklog_path, 'r', encoding='utf-8') as f:
    content = f.read()

date_str = datetime.now().strftime('%Y-%m-%d')

new_entry = """
### 🎨 Improvement: Fix overlapping in sidebar menus
**Files:** `index.css`

- Made the sidebar (metismenu) fully responsive to prevent long menu names (like "Common Master" and submenus) from overlapping.
- Applied `height: auto` and flexbox alignment to sidebar links to ensure wrapped text expands the container vertically instead of bleeding out.
"""

if '## ' + date_str in content:
    lines = content.splitlines()
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].startswith('*Last updated:'):
            lines.insert(i, new_entry)
            break
    content = '\n'.join(lines)
else:
    content = content.replace('*Last updated:', f'## {date_str}\n{new_entry}\n\n*Last updated:')

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)
