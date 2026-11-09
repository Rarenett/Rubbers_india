import re
log_path = 'c:/Paul@Rarenett/glenda_vite1/WORKLOG.md'
with open(log_path, 'r', encoding='utf-8') as f:
    content = f.read()

entry = """
## 2026-09-25

### 🟢 Feature: Marketing Connect Orders (Distributor Clone)
**Files:** `project_app/models.py`, `project_app/serializers.py`, `project_app/views.py`, `project_app/urls.py`, `OrdersModule.jsx`

- Created `MarketingOrder` and `MarketingOrderItem` database models to store marketing connect orders in a separate location.
- Built corresponding DRF ViewSets and Serializers and exposed them at `/api/project/marketing/orders/`.
- Replaced the basic `OrdersModule.jsx` with a complete functional clone of the `DistributorSalesOrder.jsx` workflow, tailored to save orders into the newly created MarketingOrder backend endpoint.

"""

content = re.sub(r'(\*Last updated:.*)', entry + r'\1', content)
with open(log_path, 'w', encoding='utf-8') as f:
    f.write(content)
