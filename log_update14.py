import re
log_path = 'c:/Paul@Rarenett/glenda_vite1/WORKLOG.md'
with open(log_path, 'r', encoding='utf-8') as f:
    content = f.read()

entry = """
### 🟢 Feature: Preview Step in Order/Wishlist Modal
**Files:** `OrderModal.jsx`

- Added a completely new "Preview" step to the Create Order modal. 
- Clicking "Preview Wishlist" now hides the product catalog and instead displays a clean, full-width summary table containing all the selected products, quantities, and a side-by-side comparison of the Company Price vs Shop Owner Price.
- Added a "Back" button to return to the catalog and a "Confirm & Submit Approval" button to finalize the request.

"""

content = re.sub(r'(\*Last updated:.*)', entry + r'\1', content)
with open(log_path, 'w', encoding='utf-8') as f:
    f.write(content)
