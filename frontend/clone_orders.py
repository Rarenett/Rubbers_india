import os

distributor_file = 'c:/Paul@Rarenett/glenda_vite1/frontend/src/jsx/components/Sales/DistributorSalesOrder.jsx'
marketing_file = 'c:/Paul@Rarenett/glenda_vite1/frontend/src/jsx/components/MarketingConnect/OrdersModule.jsx'

with open(distributor_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace imports
content = content.replace("import SalesService from '../../../services/SalesService';", "import SalesService from '../../../services/SalesService';\nimport axiosInstance from '../../../services/axiosInstance';")

# Replace Component Name
content = content.replace("DistributorSalesOrder", "OrdersModule")

# Replace Page Title
content = content.replace('usePageTitle("Distributor Order");', 'usePageTitle("Orders - Marketing Connect");')

# Replace API Call
old_api_call = "await SalesService.createSalesOrder(payload);"
new_api_call = "await axiosInstance.post('/api/project/marketing/orders/', payload);"
content = content.replace(old_api_call, new_api_call)

# Adjust success redirect
content = content.replace("navigate('/distributor-orders')", "navigate('/market_connect_master')")
content = content.replace("navigate('/sales-order-distributor')", "navigate('/market_connect_master/orders')")

# Remove is_distributor_order
content = content.replace("is_distributor_order: true,", "")

# Change Title in UI
content = content.replace("Distributor Connect", "Marketing Connect")

# Write to OrdersModule.jsx (overwriting the old basic one)
with open(marketing_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("OrdersModule.jsx updated to be a clone of DistributorSalesOrder.")
