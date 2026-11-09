import re
log_path = 'c:/Paul@Rarenett/glenda_vite1/WORKLOG.md'
with open(log_path, 'r', encoding='utf-8') as f:
    content = f.read()

entry = """
### 🎨 Improvement: Simplified Marketing Order Modal
**Files:** `OrderModal.jsx`

- Removed the "Shop Owner Favourites" top picks section from the Marketing Connect order popup to restore the simpler original format requested by the user.

"""

content = re.sub(r'(\*Last updated:.*)', entry + r'\1', content)
with open(log_path, 'w', encoding='utf-8') as f:
    f.write(content)
