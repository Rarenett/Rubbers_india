import re
log_path = 'c:/Paul@Rarenett/glenda_vite1/WORKLOG.md'
with open(log_path, 'r', encoding='utf-8') as f:
    content = f.read()

entry = """
### 🐛 Fix: Filter Customer Dropdown by Approved Status in Orders
**Files:** `project_app/views.py`, `OrdersModule.jsx`

- Created `approved_customers` endpoint to fetch IDs of ledgers with an 'Accepted' wishlist status.
- Updated `OrdersModule.jsx` to filter the Customer dropdown to strictly only include customers that have been approved by the company.

"""

content = re.sub(r'(\*Last updated:.*)', entry + r'\1', content)
with open(log_path, 'w', encoding='utf-8') as f:
    f.write(content)
