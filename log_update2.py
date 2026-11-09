import re
log_path = 'c:/Paul@Rarenett/glenda_vite1/WORKLOG.md'
with open(log_path, 'r', encoding='utf-8') as f:
    content = f.read()

entry = """
## 2026-09-25

### 🟢 Feature: Display Approved Negotiated Prices in Marketing Orders
**Files:** `project_app/views.py`, `OrdersModule.jsx`

- Added `@action` endpoint `approved_prices` to `MarketingWishlistViewSet` to return only 'Accepted' wishlist items for a given ledger.
- Updated `OrdersModule.jsx` to fetch these approved prices automatically when a customer ledger is selected.
- Order catalog and cart calculations now automatically prioritize the approved negotiated price over the standard company rate.

"""

content = re.sub(r'(\*Last updated:.*)', entry + r'\1', content)
with open(log_path, 'w', encoding='utf-8') as f:
    f.write(content)
