import re
log_path = 'c:/Paul@Rarenett/glenda_vite1/WORKLOG.md'
with open(log_path, 'r', encoding='utf-8') as f:
    content = f.read()

entry = """
### 🎨 Improvement: Add Company Price to Wishlist Preview
**Files:** `OrderModal.jsx`

- Updated the "Selected Wishlist" cart preview in the Create Order modal to display both the "Company Price" and the "Shop Owner Price" side-by-side for better clarity before submitting the negotiation.

"""

content = re.sub(r'(\*Last updated:.*)', entry + r'\1', content)
with open(log_path, 'w', encoding='utf-8') as f:
    f.write(content)
