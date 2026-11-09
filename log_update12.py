import re
log_path = 'c:/Paul@Rarenett/glenda_vite1/WORKLOG.md'
with open(log_path, 'r', encoding='utf-8') as f:
    content = f.read()

entry = """
### 🟢 Feature: Require Shop Photos for Visit
**Files:** `ShopVisitModule.jsx`

- Made the "Upload Photos" field mandatory in the Shop Visit form. 
- The form will now block submission and show an alert if no photos are selected. 
- Added a visual red asterisk to the field label to clearly indicate it as a required field.

"""

content = re.sub(r'(\*Last updated:.*)', entry + r'\1', content)
with open(log_path, 'w', encoding='utf-8') as f:
    f.write(content)
