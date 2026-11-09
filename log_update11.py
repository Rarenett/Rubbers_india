import re
log_path = 'c:/Paul@Rarenett/glenda_vite1/WORKLOG.md'
with open(log_path, 'r', encoding='utf-8') as f:
    content = f.read()

entry = """
### 🎨 Improvement: Stack Wishlist Preview Details
**Files:** `OrderModal.jsx`

- Formatted the Selected Wishlist preview so that the Quantity, Company Price, and Shop Owner Price are stacked cleanly on separate lines rather than inline.

"""

content = re.sub(r'(\*Last updated:.*)', entry + r'\1', content)
with open(log_path, 'w', encoding='utf-8') as f:
    f.write(content)
