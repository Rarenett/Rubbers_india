import re
log_path = 'c:/Paul@Rarenett/glenda_vite1/WORKLOG.md'
with open(log_path, 'r', encoding='utf-8') as f:
    content = f.read()

entry = """
### ⚙️ Config: Update Django Admin for Marketing Wishlists
**Files:** `project_app/admin.py`

- Registered `MarketingWishlist` in Django Admin.
- Added a custom column to display the "Company Price" (`ss_rate`) side-by-side with the "Shop Owner Price" (`negotiated_price`) so the company can easily compare both when reviewing/approving deals.

"""

content = re.sub(r'(\*Last updated:.*)', entry + r'\1', content)
with open(log_path, 'w', encoding='utf-8') as f:
    f.write(content)
