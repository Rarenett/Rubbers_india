import re
log_path = 'c:/Paul@Rarenett/glenda_vite1/WORKLOG.md'
with open(log_path, 'r', encoding='utf-8') as f:
    content = f.read()

entry = """
### 🎨 Improvement: Update Step 1 to Customer Details in Marketing Orders
**Files:** `OrdersModule.jsx`

- Renamed "Delivery Details" to "Customer Details" in Step 1 of the Marketing Orders page.
- Replaced the Delivery/Vehicle section with a "New Customer Name" input field to better align with the use case of capturing details for unlisted customers.
- Ensured `new_customer_name` is sent in the order payload.

"""

content = re.sub(r'(\*Last updated:.*)', entry + r'\1', content)
with open(log_path, 'w', encoding='utf-8') as f:
    f.write(content)
