import os

file_path = 'c:/Paul@Rarenett/glenda_vite1/frontend/src/jsx/components/MarketingConnect/OrdersModule.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the Promise.all array and the variables assignment
old_promise = """                const [ledgersRes, vehiclesRes, driversRes, stockItemsRes, warehousesRes, salesOrdersRes, mappingsData, priceListsData] = await Promise.all([
                    SalesService.getLedgers(),
                    LogisticsService.getVehicles(),
                    LogisticsService.getDrivers(),
                    SalesService.getStockItems(),
                    SalesService.getWarehouses(),
                    Promise.resolve({data: []}), // removed SalesService.getSalesOrders() to fix lag
                    getPriceListMappings(),
                    getPriceLists(),
                ]);

                const loadedLedgers = Array.isArray(ledgersRes.data) ? ledgersRes.data : [];
                setLedgers(loadedLedgers);"""

new_promise = """                const [ledgersRes, vehiclesRes, driversRes, stockItemsRes, warehousesRes, salesOrdersRes, mappingsData, priceListsData, approvedCustomersRes] = await Promise.all([
                    SalesService.getLedgers(),
                    LogisticsService.getVehicles(),
                    LogisticsService.getDrivers(),
                    SalesService.getStockItems(),
                    SalesService.getWarehouses(),
                    Promise.resolve({data: []}), // removed SalesService.getSalesOrders() to fix lag
                    getPriceListMappings(),
                    getPriceLists(),
                    axiosInstance.get('/api/project/marketing/wishlist/approved_customers/').catch(() => ({ data: [] }))
                ]);

                const allLedgers = Array.isArray(ledgersRes.data) ? ledgersRes.data : [];
                const approvedCustomerIds = Array.isArray(approvedCustomersRes.data) ? approvedCustomersRes.data : [];
                const loadedLedgers = allLedgers.filter(l => approvedCustomerIds.includes(l.id));
                setLedgers(loadedLedgers);"""

content = content.replace(old_promise, new_promise)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated OrdersModule.jsx to filter ledgers by approved customers")
