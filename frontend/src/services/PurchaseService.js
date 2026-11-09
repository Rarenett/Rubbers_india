import axiosInstance from './AxiosInstance';

const PurchaseService = {

    // Purchase Orders

    getPurchaseOrders: () =>
        axiosInstance.get('/api/purchase/purchase-orders/'),

    getPurchaseOrdersBySupplier: (supplierId) =>
        axiosInstance.get('/api/purchase/purchase-orders/', {
            params: { supplier_ledger: supplierId }
        }),

    getPurchaseOrderNextNo: (prefixId) =>
        axiosInstance.get('/api/purchase/purchase-orders/next-po-no/', { params: { prefix_id: prefixId } }),

    getPurchaseOrder: (id) =>
        axiosInstance.get(`/api/purchase/purchase-orders/${id}/`),

    createPurchaseOrder: (data) =>
        axiosInstance.post('/api/purchase/purchase-orders/', data),

    getNextMobilePurchaseOrderNo: () =>
        axiosInstance.get('/api/purchase/mobile-purchase-orders/next-no/'),

    createMobilePurchaseOrder: (data) =>
        axiosInstance.post('/api/purchase/mobile-purchase-orders/', data),

    updatePurchaseOrder: (id, data) =>
        axiosInstance.put(`/api/purchase/purchase-orders/${id}/`, data),

    deletePurchaseOrder: (id) =>
        axiosInstance.delete(`/api/purchase/purchase-orders/${id}/`),

    // Ledgers

    getLedgers: () =>
        axiosInstance.get('/api/finance/ledgers/'),

    // Stock Items

    getStockItems: () =>
        axiosInstance.get('/api/inventory/stock-items/'),

    // Warehouses (from settings_app)

    getWarehouses: () =>
        axiosInstance.get('/api/settings/warehouses/'),

    getGodowns: () =>
        axiosInstance.get('/api/settings/warehouses/'),

    // Units (from inventory_app)

    getUnits: () =>
        axiosInstance.get('/api/inventory/units/'),

    // Dynamic GST/HSN resolver
    resolveGstHsn: (productId, date) =>
        axiosInstance.get('/api/purchase/purchase-orders/resolve-gst-hsn/', {
            params: { product_id: productId, date }
        }),

    resolveInvoiceGstHsn: (productId, date) =>
        axiosInstance.get('/api/purchase/purchase-invoices/resolve-gst-hsn/', {
            params: { product_id: productId, date }
        }),

    

    // Purchase Invoices

    getPurchaseInvoices: () =>
        axiosInstance.get('/api/purchase/purchase-invoices/'),

    getPurchaseInvoicesBySupplier: (supplierId) =>
        axiosInstance.get('/api/purchase/purchase-invoices/', {
            params: { supplier_ledger_id: supplierId }
        }),

    getPurchaseInvoiceNextNo: (prefixId) =>
        axiosInstance.get('/api/purchase/purchase-invoices/next-invoice-no/', { params: { prefix_id: prefixId } }),

    getPurchaseInvoice: (id) =>
        axiosInstance.get(`/api/purchase/purchase-invoices/${id}/`),

    createPurchaseInvoice: (data) =>
        axiosInstance.post('/api/purchase/purchase-invoices/', data),

    updatePurchaseInvoice: (id, data) =>
        axiosInstance.put(`/api/purchase/purchase-invoices/${id}/`, data),

    deletePurchaseInvoice: (id) =>
        axiosInstance.delete(`/api/purchase/purchase-invoices/${id}/`),


    // Purchase Returns

    getPurchaseReturns: () =>
        axiosInstance.get('/api/purchase/purchase-returns/'),

    getPurchaseReturnNextNo: (prefixId) =>
        axiosInstance.get('/api/purchase/purchase-returns/next-return-no/', { params: { prefix_id: prefixId } }),

    getPurchaseReturn: (id) =>
        axiosInstance.get(`/api/purchase/purchase-returns/${id}/`),

    createPurchaseReturn: (data) =>
        axiosInstance.post('/api/purchase/purchase-returns/', data),

    updatePurchaseReturn: (id, data) =>
        axiosInstance.put(`/api/purchase/purchase-returns/${id}/`, data),

    deletePurchaseReturn: (id) =>
        axiosInstance.delete(`/api/purchase/purchase-returns/${id}/`),

    resolveReturnGstHsn: (productId, date) =>
        axiosInstance.get('/api/purchase/purchase-returns/resolve-gst-hsn/', {
            params: { product_id: productId, date }
        }),

    lookupPurchaseInvoice: (supplierLedger, invoiceNo, invoiceDate) =>
        axiosInstance.get('/api/purchase/purchase-invoices/lookup/', {
            params: {
                supplier_ledger: supplierLedger,
                supplier_invoice_no: invoiceNo,
                supplier_invoice_date: invoiceDate
            }
        }),

    getProductBatches: (productId) =>
        axiosInstance.get('/api/purchase/purchase-invoices/batches/', {
            params: { product_id: productId }
        }),

    // Tally Synchronization — Purchase Invoice

    getPurchaseTallyConfig: (params) =>
        axiosInstance.get('/api/purchase/purchase-invoices/tally/config/', { params }),

    updatePurchaseTallyConfig: (data) =>
        axiosInstance.post('/api/purchase/purchase-invoices/tally/config/', data),

    pushPurchaseInvoicesToTally: (data) =>
        axiosInstance.post('/api/purchase/purchase-invoices/tally/push/', data),

    getTallyPurchaseInvoices: (params) =>
        axiosInstance.get('/api/purchase/purchase-invoices/tally/list/', { params }),

    testPurchaseTallyConnection: (data) =>
        axiosInstance.post('/api/purchase/purchase-invoices/tally/test-connection/', data),

    // Tally Synchronization — Purchase Return

    getPurchaseReturnTallyConfig: (params) =>
        axiosInstance.get('/api/purchase/purchase-returns/tally/config/', { params }),

    updatePurchaseReturnTallyConfig: (data) =>
        axiosInstance.post('/api/purchase/purchase-returns/tally/config/', data),

    pushPurchaseReturnsToTally: (data) =>
        axiosInstance.post('/api/purchase/purchase-returns/tally/push/', data),

    getTallyPurchaseReturns: (params) =>
        axiosInstance.get('/api/purchase/purchase-returns/tally/list/', { params }),

    testPurchaseReturnTallyConnection: (data) =>
        axiosInstance.post('/api/purchase/purchase-returns/tally/test-connection/', data),
};

export default PurchaseService;