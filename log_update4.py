import re
log_path = 'c:/Paul@Rarenett/glenda_vite1/WORKLOG.md'
with open(log_path, 'r', encoding='utf-8') as f:
    content = f.read()

entry = """
### ⚡ Performance: Fix Marketing Orders Loading Lag
**Files:** `OrdersModule.jsx`

- Removed the unnecessary call to `SalesService.getSalesOrders()` during the initial page load for Marketing Orders, which was downloading the entire sales order history and causing massive lag.

"""

content = re.sub(r'(\*Last updated:.*)', entry + r'\1', content)
with open(log_path, 'w', encoding='utf-8') as f:
    f.write(content)
