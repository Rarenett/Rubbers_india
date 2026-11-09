import axiosInstance from './AxiosInstance';

const SalesService = {
    // Sales Orders
    getSalesOrders: (params = {}) =>
        axiosInstance.get('/api/sales/orders/', { params }),

    getSalesOrderNextNo: (params = {}) =>
        axiosInstance.get('/api/sales/orders/next-so-no/', { params }),

    getSalesOrder: (id) =>
        axiosInstance.get(`/api/sales/orders/${id}/`),

    createSalesOrder: (data) =>
        axiosInstance.post('/api/sales/orders/', data),

    updateSalesOrder: (id, data) =>
        axiosInstance.put(`/api/sales/orders/${id}/`, data),

    patchSalesOrder: (id, data) =>
        axiosInstance.patch(`/api/sales/orders/${id}/`, data),

    deleteSalesOrder: (id) =>
        axiosInstance.delete(`/api/sales/orders/${id}/`),

    bulkUpdateSalesOrders: (data) =>
        axiosInstance.post('/api/sales/orders/bulk-update/', data),

    // Sales Invoices
    getSalesInvoices: (params = {}) => {
        if (typeof params === 'string' || typeof params === 'number') {
            return axiosInstance.get('/api/sales/invoices/', { params: { customer_id: params } });
        }
        return axiosInstance.get('/api/sales/invoices/', { params });
    },

    getSalesInvoiceNextNo: (params = {}) =>
        axiosInstance.get('/api/sales/invoices/next-invoice-no/', { params }),

    getSalesInvoice: (id) =>
        axiosInstance.get(`/api/sales/invoices/${id}/`),

    createSalesInvoice: (data) =>
        axiosInstance.post('/api/sales/invoices/', data),

    updateSalesInvoice: (id, data) =>
        axiosInstance.put(`/api/sales/invoices/${id}/`, data),

    deleteSalesInvoice: (id) =>
        axiosInstance.delete(`/api/sales/invoices/${id}/`),

    // Ledgers (from finance_accounts)
    getLedgers: () =>
        axiosInstance.get('/api/finance/ledgers/'),

    // Stock Items (from inventory_app)
    getStockItems: () =>
        axiosInstance.get('/api/inventory/stock-items/'),

    // Warehouses (from settings_app)
    getWarehouses: () =>
        axiosInstance.get('/api/settings/warehouses/'),

    // Delivery Locations (filtered by customer ledger ID)
    getDeliveryLocations: (customerId) => {
        console.log('Fetching delivery locations for customer:', customerId);
        return axiosInstance.get('/api/sales/delivery-locations/', {
            params: customerId ? { customer_id: customerId } : {}
        });
    },

    createDeliveryLocation: (data) => {
        console.log('Creating delivery location:', data);
        return axiosInstance.post('/api/sales/delivery-locations/', data);
    },
    
    updateDeliveryLocation: (id, data) => {
        console.log('Updating delivery location:', id, data);
        return axiosInstance.put(`/api/sales/delivery-locations/${id}/`, data);
    },
    
    deleteDeliveryLocation: (id) => {
        console.log('Deleting delivery location:', id);
        return axiosInstance.delete(`/api/sales/delivery-locations/${id}/`);
    },

    // Daily Entries
    getDailyEntries: () =>
        axiosInstance.get('/api/sales/daily-entries/'),

    getProductSalesQuantities: (date) =>
        axiosInstance.get('/api/sales/daily-entries/sales-quantities/', { params: { date } }),

    getDailyEntry: (id) =>
        axiosInstance.get(`/api/sales/daily-entries/${id}/`),

    createDailyEntry: (data) =>
        axiosInstance.post('/api/sales/daily-entries/', data),

    updateDailyEntry: (id, data) =>
        axiosInstance.put(`/api/sales/daily-entries/${id}/`, data),

    deleteDailyEntry: (id) =>
        axiosInstance.delete(`/api/sales/daily-entries/${id}/`),

    // Sales Returns
    getSalesReturns: (params = {}) => {
        if (typeof params === 'string' || typeof params === 'number') {
            return axiosInstance.get('/api/sales/returns/', { params: { customer_id: params } });
        }
        return axiosInstance.get('/api/sales/returns/', { params });
    },

    getSalesReturnNextNo: (prefixId) =>
        axiosInstance.get('/api/sales/returns/next-return-no/', { params: { prefix_id: prefixId } }),

    getSalesReturn: (id) =>
        axiosInstance.get(`/api/sales/returns/${id}/`),

    createSalesReturn: (data) =>
        axiosInstance.post('/api/sales/returns/', data),

    updateSalesReturn: (id, data) =>
        axiosInstance.put(`/api/sales/returns/${id}/`, data),

    deleteSalesReturn: (id) =>
        axiosInstance.delete(`/api/sales/returns/${id}/`),

    resolveReturnGstHsn: (productId, date) =>
        axiosInstance.get('/api/sales/returns/resolve-gst-hsn/', {
            params: { product_id: productId, date }
        }),

    // Distributor Top Picks
    getAllDistributorTopPicks: () =>
        axiosInstance.get('/api/sales/top-picks/'),

    getDistributorTopPicks: (ledgerId) =>
        axiosInstance.get(`/api/sales/top-picks/${ledgerId}/`),

    updateDistributorTopPicks: (ledgerId, products) =>
        axiosInstance.post(`/api/sales/top-picks/${ledgerId}/`, { products }),

    deleteDistributorTopPicks: (ledgerId) =>
        axiosInstance.delete(`/api/sales/top-picks/${ledgerId}/`),
};

export default SalesService;

