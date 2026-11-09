import axiosInstance from './AxiosInstance';

// --- ACCOUNT GROUP API ---

export const getAccountGroups = async () => {
    try {
        const response = await axiosInstance.get('/api/finance/account-groups/');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const createAccountGroup = async (data) => {
    try {
        const response = await axiosInstance.post('/api/finance/account-groups/', data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updateAccountGroup = async (id, data) => {
    try {
        const response = await axiosInstance.put(`/api/finance/account-groups/${id}/`, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const deleteAccountGroup = async (id) => {
    try {
        const response = await axiosInstance.delete(`/api/finance/account-groups/${id}/`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const downloadAccountGroupTemplate = async () => {
    try {
        const response = await axiosInstance.get('/api/finance/account-groups/download_template/', {
            responseType: 'blob'
        });
        return response;
    } catch (error) {
        throw error;
    }
};

export const importAccountGroupsExcel = async (formData) => {
    try {
        const response = await axiosInstance.post('/api/finance/account-groups/import_excel/', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

// --- LEDGER API ---

export const getLedgers = async (params = {}) => {
    try {
        const response = await axiosInstance.get('/api/finance/ledgers/', { params });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const createLedger = async (data) => {
    try {
        const response = await axiosInstance.post('/api/finance/ledgers/', data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updateLedger = async (id, data) => {
    try {
        const response = await axiosInstance.put(`/api/finance/ledgers/${id}/`, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const deleteLedger = async (id) => {
    try {
        const response = await axiosInstance.delete(`/api/finance/ledgers/${id}/`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const checkTallyLedgerImportStatus = async () => {
    try {
        const response = await axiosInstance.get('/api/finance/ledgers/import-tally-status/');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const downloadLedgerTemplate = async () => {
    try {
        const response = await axiosInstance.get('/api/finance/ledgers/download_template/', {
            responseType: 'blob'
        });
        return response;
    } catch (error) {
        throw error;
    }
};

export const importLedgersExcel = async (formData) => {
    try {
        const response = await axiosInstance.post('/api/finance/ledgers/import_excel/', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const importTallyLedgers = async (onStatusUpdate = null) => {
    try {
        const response = await axiosInstance.post('/api/finance/ledgers/import-tally/');
        const data = response.data;

        // If server queued the command for the client-side Tally Agent, poll until complete
        if (data && data.queued) {
            if (onStatusUpdate) onStatusUpdate({ status: 'pending', message: data.message });

            const maxAttempts = 30; // 30 * 2s = 60s
            for (let i = 0; i < maxAttempts; i++) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                const statusRes = await checkTallyLedgerImportStatus();

                if (onStatusUpdate) onStatusUpdate(statusRes);

                if (statusRes.status === 'done') {
                    return {
                        success: true,
                        message: statusRes.message || 'Ledgers imported from Tally successfully!',
                        ...statusRes,
                    };
                }

                if (statusRes.status === 'failed') {
                    throw new Error(statusRes.error || 'Failed to import ledgers via Tally Agent.');
                }
            }
            throw new Error('Tally import timed out. Please check if Tally Agent is running and Tally Prime is open.');
        }

        return data;
    } catch (error) {
        throw error;
    }
};

export const bulkMapPriceList = async (data) => {
    try {
        const response = await axiosInstance.post('/api/inventory/price-lists-mapping/', data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getPriceListMappings = async (params = {}) => {
    try {
        const response = await axiosInstance.get('/api/inventory/price-lists-mapping/', { params });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const deletePriceListMapping = async (id, params = {}) => {
    try {
        const url = id
            ? `/api/inventory/price-lists-mapping/${id}/`
            : '/api/inventory/price-lists-mapping/';
        const response = await axiosInstance.delete(url, { params });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updatePriceListMapping = async (id, data) => {
    try {
        const url = id
            ? `/api/inventory/price-lists-mapping/${id}/`
            : '/api/inventory/price-lists-mapping/';
        const response = await axiosInstance.put(url, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// --- SERVICE INVOICE API ---

export const getServiceInvoices = async () => {
    try {
        const response = await axiosInstance.get('/api/finance/service-invoices/');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const createServiceInvoice = async (data) => {
    try {
        const response = await axiosInstance.post('/api/finance/service-invoices/', data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updateServiceInvoice = async (id, data) => {
    try {
        const response = await axiosInstance.put(`/api/finance/service-invoices/${id}/`, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const deleteServiceInvoice = async (id) => {
    try {
        const response = await axiosInstance.delete(`/api/finance/service-invoices/${id}/`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// --- JOURNAL VOUCHER API ---

export const getJournals = async () => {
    try {
        const response = await axiosInstance.get('/api/finance/journals/');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const createJournal = async (data) => {
    try {
        const response = await axiosInstance.post('/api/finance/journals/', data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updateJournal = async (id, data) => {
    try {
        const response = await axiosInstance.put(`/api/finance/journals/${id}/`, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const deleteJournal = async (id) => {
    try {
        const response = await axiosInstance.delete(`/api/finance/journals/${id}/`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// --- RECEIPT VOUCHER API ---

export const getReceipts = async () => {
    try {
        const response = await axiosInstance.get('/api/finance/receipts/');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const createReceipt = async (data) => {
    try {
        const response = await axiosInstance.post('/api/finance/receipts/', data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updateReceipt = async (id, data) => {
    try {
        const response = await axiosInstance.put(`/api/finance/receipts/${id}/`, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const deleteReceipt = async (id) => {
    try {
        const response = await axiosInstance.delete(`/api/finance/receipts/${id}/`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// --- PAYMENT VOUCHER API ---

export const getPayments = async () => {
    try {
        const response = await axiosInstance.get('/api/finance/payments/');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const createPayment = async (data) => {
    try {
        const response = await axiosInstance.post('/api/finance/payments/', data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updatePayment = async (id, data) => {
    try {
        const response = await axiosInstance.put(`/api/finance/payments/${id}/`, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const deletePayment = async (id) => {
    try {
        const response = await axiosInstance.delete(`/api/finance/payments/${id}/`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// --- CONTRA VOUCHER API ---

export const getContras = async () => {
    try {
        const response = await axiosInstance.get('/api/finance/contras/');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const createContra = async (data) => {
    try {
        const response = await axiosInstance.post('/api/finance/contras/', data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updateContra = async (id, data) => {
    try {
        const response = await axiosInstance.put(`/api/finance/contras/${id}/`, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const deleteContra = async (id) => {
    try {
        const response = await axiosInstance.delete(`/api/finance/contras/${id}/`);
        return response.data;
    } catch (error) {
        throw error;
    }
};


// --- QUOTATION API ---

export const getQuotations = async () => {
    try {
        const response = await axiosInstance.get('/api/finance/quotations/');
        return response.data;
    } catch (error) {
        throw error;
    }
};


export const getNextQuotationNumber = async (prefixConfigId) => {
    try {
        const params = prefixConfigId ? { prefix_config_id: prefixConfigId } : {};
        const response = await axiosInstance.get('/api/finance/quotations/next-number/', { params });
        return response.data;
    } catch (error) {
        throw error;
    }
}; 

export const getQuotationById = async (id) => {
    try {
        const response = await axiosInstance.get(`/api/finance/quotations/${id}/`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const createQuotation = async (data) => {
    try {
        const response = await axiosInstance.post('/api/finance/quotations/', data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updateQuotation = async (id, data) => {
    try {
        const response = await axiosInstance.put(`/api/finance/quotations/${id}/`, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const deleteQuotation = async (id) => {
    try {
        const response = await axiosInstance.delete(`/api/finance/quotations/${id}/`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// --- VOUCHER TYPE API ---

export const getVoucherTypes = async () => {
    try {
        const response = await axiosInstance.get('/api/finance/voucher-types/');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const createVoucherType = async (data) => {
    try {
        const response = await axiosInstance.post('/api/finance/voucher-types/', data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updateVoucherType = async (id, data) => {
    try {
        const response = await axiosInstance.put(`/api/finance/voucher-types/${id}/`, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};



export const deleteVoucherType = async (id) => {
    try {
        const response = await axiosInstance.delete(`/api/finance/voucher-types/${id}/`);
        return response.data;
    } catch (error) {
        throw error;
    }
};


// --- STOCK JOURNAL TYPE API ---

export const getStockJournalTypes = async () => {
    try {
        const response = await axiosInstance.get('/api/finance/stock-journal-types/');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const createStockJournalType = async (data) => {
    try {
        const response = await axiosInstance.post('/api/finance/stock-journal-types/', data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updateStockJournalType = async (id, data) => {
    try {
        const response = await axiosInstance.put(`/api/finance/stock-journal-types/${id}/`, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const deleteStockJournalType = async (id) => {
    try {
        const response = await axiosInstance.delete(`/api/finance/stock-journal-types/${id}/`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// --- STOCK JOURNAL API ---

export const getStockJournals = async () => {
    try {
        const response = await axiosInstance.get('/api/finance/stock-journals/');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getStockJournal = async (id) => {
    try {
        const response = await axiosInstance.get(`/api/finance/stock-journals/${id}/`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const createStockJournal = async (data) => {
    try {
        const response = await axiosInstance.post('/api/finance/stock-journals/', data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updateStockJournal = async (id, data) => {
    try {
        const response = await axiosInstance.put(`/api/finance/stock-journals/${id}/`, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};


export const deleteStockJournal = async (id) => {
    try {
        const response = await axiosInstance.delete(`/api/finance/stock-journals/${id}/`);
        return response.data;
    } catch (error) {
        throw error;
    }
};















export const getStockJournalPrefixConfigs = async (typeName = '') => {
    try {
        const params = typeName ? { type_name: typeName } : {};
        const response = await axiosInstance.get('/api/finance/stock-journal-prefix-configs/', { params });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getNextJournalNumber = async (prefixConfigId) => {
    try {
        const response = await axiosInstance.get(
            `/api/finance/stock-journals/next-number/?prefix_config_id=${prefixConfigId}`
        );
        return response.data;
    } catch (error) {
        throw error;
    }
};

// --- MANUFACTURAL JOURNAL TYPE API ---

export const getManufacturalJournalTypes = async () => {
    try {
        const response = await axiosInstance.get('/api/finance/manufactural-journal-types/');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const createManufacturalJournalType = async (data) => {
    try {
        const response = await axiosInstance.post('/api/finance/manufactural-journal-types/', data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updateManufacturalJournalType = async (id, data) => {
    try {
        const response = await axiosInstance.put(`/api/finance/manufactural-journal-types/${id}/`, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const deleteManufacturalJournalType = async (id) => {
    try {
        const response = await axiosInstance.delete(`/api/finance/manufactural-journal-types/${id}/`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// --- MANUFACTURAL JOURNAL API ---

export const getManufacturalJournals = async () => {
    try {
        const response = await axiosInstance.get('/api/finance/manufactural-journals/');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getManufacturalJournal = async (id) => {
    try {
        const response = await axiosInstance.get(`/api/finance/manufactural-journals/${id}/`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const createManufacturalJournal = async (data) => {
    try {
        const response = await axiosInstance.post('/api/finance/manufactural-journals/', data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updateManufacturalJournal = async (id, data) => {
    try {
        const response = await axiosInstance.put(`/api/finance/manufactural-journals/${id}/`, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const deleteManufacturalJournal = async (id) => {
    try {
        const response = await axiosInstance.delete(`/api/finance/manufactural-journals/${id}/`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getManufacturalJournalPrefixConfigs = async (typeName = '') => {
    try {
        const params = typeName ? { type_name: typeName } : {};
        const response = await axiosInstance.get('/api/finance/manufactural-journal-prefix-configs/', { params });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getNextManufacturalJournalNumber = async (prefixConfigId) => {
    try {
        const url = prefixConfigId ? `/api/finance/manufactural-journals/next-number/?prefix_config_id=${prefixConfigId}` : '/api/finance/manufactural-journals/next-number/';
        const response = await axiosInstance.get(url);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// --- TRIAL BALANCE API ---

export const getTrialBalance = async (params = {}) => {
    try {
        const response = await axiosInstance.get('/api/finance/trial-balance/', { params });
        return response.data;
    } catch (error) {
        throw error;
    }
};

// --- PROFIT AND LOSS API ---

export const getProfitAndLoss = async (params = {}) => {
    try {
        const response = await axiosInstance.get('/api/finance/profit-loss/', { params });
        return response.data;
    } catch (error) {
        throw error;
    }
};

// --- BILLS RECEIVABLE & PAYABLES API ---

export const getReceivables = async (params = {}) => {
    try {
        const response = await axiosInstance.get('/api/finance/receivables/', { params });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getPayables = async (params = {}) => {
    try {
        const response = await axiosInstance.get('/api/finance/payables/', { params });
        return response.data;
    } catch (error) {
        throw error;
    }
};

// --- BALANCE SHEET API ---

export const getBalanceSheet = async (params = {}) => {
    try {
        const response = await axiosInstance.get('/api/finance/balance-sheet/', { params });
        return response.data;
    } catch (error) {
        throw error;
    }
};

// --- DAY BOOK API ---

export const getDayBook = async (params = {}) => {
    try {
        const response = await axiosInstance.get('/api/finance/day-book/', { params });
        return response.data;
    } catch (error) {
        throw error;
    }
};

// --- LEDGER BOOK API ---

export const getLedgersList = async () => {
    try {
        const response = await axiosInstance.get('/api/finance/ledgers/');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getLedgerBook = async (ledgerId, params = {}) => {
    try {
        const response = await axiosInstance.get(`/api/finance/ledgers/${ledgerId}/vouchers/`, { params });
        return response.data;
    } catch (error) {
        throw error;
    }
};





export const fetchVoucherSubTypes = async (voucherTypeId) => {
    try {
        const response = await axiosInstance.get(`/api/finance/voucher-types/${voucherTypeId}/subtypes/`);
        return response.data;
    } catch (error) {
        throw error;
    }
};
