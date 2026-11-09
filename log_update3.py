import re
log_path = 'c:/Paul@Rarenett/glenda_vite1/WORKLOG.md'
with open(log_path, 'r', encoding='utf-8') as f:
    content = f.read()

entry = """
### 🐛 Fix: Filter Active Leads in Shop Visit
**Files:** `ShopVisitModule.jsx`

- Updated the "Import Existing Lead" dropdown in the Shop Visit page to only reflect leads with an 'Active' status.

"""

content = re.sub(r'(\*Last updated:.*)', entry + r'\1', content)
with open(log_path, 'w', encoding='utf-8') as f:
    f.write(content)
