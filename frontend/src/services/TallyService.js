import axiosInstance from './AxiosInstance';

const TALLY_API_BASE = '/api/sales/tally';

export const getTallyConfig = async (params = {}) => {
    const response = await axiosInstance.get(`${TALLY_API_BASE}/config/`, { params });
    return response.data;
};

export const updateTallyConfig = async (data) => {
    const response = await axiosInstance.post(`${TALLY_API_BASE}/config/`, data);
    return response.data;
};

export const pushSalesOrdersToTally = async (payload = {}) => {
    const response = await axiosInstance.post(`${TALLY_API_BASE}/push/`, { ...payload, voucher_type: 'Sales Order' });
    return response.data;
};

export const pushSalesInvoicesToTally = async (payload = {}) => {
    const response = await axiosInstance.post(`${TALLY_API_BASE}/push/`, { ...payload, voucher_type: 'Sales Invoice' });
    return response.data;
};

export const getTallySalesOrders = async (params = {}) => {
    const response = await axiosInstance.get(`${TALLY_API_BASE}/orders/`, { params });
    return response.data;
};

export const getTallySalesInvoices = async (params = {}) => {
    const response = await axiosInstance.get(`${TALLY_API_BASE}/invoices/`, { params });
    return response.data;
};

export const pushSalesReturnsToTally = async (payload = {}) => {
    const response = await axiosInstance.post(`${TALLY_API_BASE}/push/`, { ...payload, voucher_type: 'Sales Return' });
    return response.data;
};

export const getTallySalesReturns = async (params = {}) => {
    const response = await axiosInstance.get(`${TALLY_API_BASE}/returns/`, { params });
    return response.data;
};

export const testTallyConnection = async (payload = {}) => {
    const response = await axiosInstance.post(`${TALLY_API_BASE}/test-connection/`, payload);
    return response.data;
};

const TallyService = {
    getTallyConfig,
    updateTallyConfig,
    pushSalesOrdersToTally,
    pushSalesInvoicesToTally,
    pushSalesReturnsToTally,
    getTallySalesOrders,
    getTallySalesInvoices,
    getTallySalesReturns,
    testTallyConnection,
};

export default TallyService;

