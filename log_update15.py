import re
log_path = 'c:/Paul@Rarenett/glenda_vite1/WORKLOG.md'
with open(log_path, 'r', encoding='utf-8') as f:
    content = f.read()

entry = """
### 🐛 Fix: Tiny Icon Buttons in Mobile View
**Files:** `marketing-cute.css`

- Added specific CSS overrides for `.btn-sm`, `.btn-xs`, and `.sharp` classes on mobile screens.
- This prevents the large pill-shaped padding from being applied to small action buttons (like the Edit pencil in the Leads table), keeping them perfectly round and centered.

"""

content = re.sub(r'(\*Last updated:.*)', entry + r'\1', content)
with open(log_path, 'w', encoding='utf-8') as f:
    f.write(content)
