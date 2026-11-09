import datetime
import re

file_path = 'c:/Paul@Rarenett/glenda_vite1/WORKLOG.md'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'\*Last updated:.*?\*\n?', '', content)

log_entry = f"""
### 🟢 Feature: Order and Wishlist popup on Shop Visit
**Files:** `frontend/src/jsx/components/MarketingConnect/OrderModal.jsx`, `frontend/src/jsx/components/MarketingConnect/ShopVisitModule.jsx`

- Created an OrderModal component to capture wishlist and negotiated price.
- Connected OrderModal to ShopVisitModule to appear after saving a shop visit.
- Sent negotiated prices along with wishlist items to backend for approval.

*Last updated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')} IST*
"""

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content.strip() + '\n\n' + log_entry.strip() + '\n')
