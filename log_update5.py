import re
log_path = 'c:/Paul@Rarenett/glenda_vite1/WORKLOG.md'
with open(log_path, 'r', encoding='utf-8') as f:
    content = f.read()

entry = """
### 🎨 Improvement: Revert Marketing Dashboard to Legacy Design
**Files:** `MarketingConnectDashboard.jsx`

- Reverted the Marketing Connect dashboard back to its previous custom layout, bringing back the emoji logos and tailored card styling as requested by the user.

"""

content = re.sub(r'(\*Last updated:.*)', entry + r'\1', content)
with open(log_path, 'w', encoding='utf-8') as f:
    f.write(content)
