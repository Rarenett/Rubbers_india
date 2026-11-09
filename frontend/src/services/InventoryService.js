import axiosInstance from './AxiosInstance';

const INVENTORY_API_BASE = '/api/inventory';

// ==================== UNIT ENDPOINTS ====================

/**
 * Get all inventory units
 */
export const getUnits = async () => {
    try {
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/units/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching inventory units:', error);
        throw error;
    }
};

/**
 * Create a new inventory unit
 */
export const createUnit = async (unitData) => {
    try {
        const response = await axiosInstance.post(`${INVENTORY_API_BASE}/units/`, unitData);
        return response.data;
    } catch (error) {
        console.error('Error creating inventory unit:', error);
        throw error;
    }
};

/**
 * Update an inventory unit
 */
export const updateUnit = async (id, unitData) => {
    try {
        const response = await axiosInstance.put(`${INVENTORY_API_BASE}/units/${id}/`, unitData);
        return response.data;
    } catch (error) {
        console.error(`Error updating inventory unit ${id}:`, error);
        throw error;
    }
};

/**
 * Delete an inventory unit
 */
export const deleteUnit = async (id) => {
    try {
        const response = await axiosInstance.delete(`${INVENTORY_API_BASE}/units/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting inventory unit ${id}:`, error);
        throw error;
    }
};


// ==================== STOCK GROUP ENDPOINTS ====================

/**
 * Get all stock groups
 */
export const getStockGroups = async () => {
    try {
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/stock-groups/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching stock groups:', error);
        throw error;
    }
};

/**
 * Create a new stock group
 */
export const createStockGroup = async (groupData) => {
    try {
        const response = await axiosInstance.post(`${INVENTORY_API_BASE}/stock-groups/`, groupData);
        return response.data;
    } catch (error) {
        console.error('Error creating stock group:', error);
        throw error;
    }
};

/**
 * Update a stock group
 */
export const updateStockGroup = async (id, groupData) => {
    try {
        const response = await axiosInstance.put(`${INVENTORY_API_BASE}/stock-groups/${id}/`, groupData);
        return response.data;
    } catch (error) {
        console.error(`Error updating stock group ${id}:`, error);
        throw error;
    }
};

/**
 * Delete a stock group
 */
export const deleteStockGroup = async (id) => {
    try {
        const response = await axiosInstance.delete(`${INVENTORY_API_BASE}/stock-groups/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting stock group ${id}:`, error);
        throw error;
    }
};

/**
 * Download stock group excel template
 */
export const downloadStockGroupTemplate = async () => {
    try {
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/stock-groups/download_template/`, {
            responseType: 'blob'
        });
        return response;
    } catch (error) {
        console.error('Error downloading template:', error);
        throw error;
    }
};

/**
 * Import stock groups from excel
 */
export const importStockGroupsExcel = async (formData) => {
    try {
        const response = await axiosInstance.post(`${INVENTORY_API_BASE}/stock-groups/import_excel/`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error importing stock groups:', error);
        throw error;
    }
};

// ==================== STOCK CATEGORY ENDPOINTS ====================

/**
 * Get all stock categories
 */
export const getStockCategories = async () => {
    try {
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/stock-categories/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching stock categories:', error);
        throw error;
    }
};

/**
 * Create a new stock category
 */
export const createStockCategory = async (categoryData) => {
    try {
        const response = await axiosInstance.post(`${INVENTORY_API_BASE}/stock-categories/`, categoryData);
        return response.data;
    } catch (error) {
        console.error('Error creating stock category:', error);
        throw error;
    }
};

/**
 * Update a stock category
 */
export const updateStockCategory = async (id, categoryData) => {
    try {
        const response = await axiosInstance.put(`${INVENTORY_API_BASE}/stock-categories/${id}/`, categoryData);
        return response.data;
    } catch (error) {
        console.error(`Error updating stock category ${id}:`, error);
        throw error;
    }
};

/**
 * Delete a stock category
 */
export const deleteStockCategory = async (id) => {
    try {
        const response = await axiosInstance.delete(`${INVENTORY_API_BASE}/stock-categories/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting stock category ${id}:`, error);
        throw error;
    }
};

/**
 * Download stock category excel template
 */
export const downloadStockCategoryTemplate = async () => {
    try {
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/stock-categories/download_template/`, {
            responseType: 'blob'
        });
        return response;
    } catch (error) {
        console.error('Error downloading template:', error);
        throw error;
    }
};

/**
 * Import stock categories from excel
 */
export const importStockCategoriesExcel = async (formData) => {
    try {
        const response = await axiosInstance.post(`${INVENTORY_API_BASE}/stock-categories/import_excel/`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error importing stock categories:', error);
        throw error;
    }
};


// ==================== STOCK ITEM ENDPOINTS ====================

/**
 * Get all stock items
 */
export const getStockItems = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/stock-items/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching stock items:', error);
        throw error;
    }
};

/**
 * Get Item Report with optional fromDate and toDate
 */
export const getItemReport = async (fromDate, toDate) => {
    try {
        const params = {};
        if (fromDate) params.from_date = fromDate;
        if (toDate) params.to_date = toDate;
        
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/reports/item-report/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching item report:', error);
        throw error;
    }
};

/**
 * Get Godown Report with optional fromDate and toDate
 */
export const getGodownReport = async (fromDate, toDate) => {
    try {
        const params = {};
        if (fromDate) params.from_date = fromDate;
        if (toDate) params.to_date = toDate;
        
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/reports/godown-report/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching godown report:', error);
        throw error;
    }
};

/**
 * Get Batchwise Stock Report with optional fromDate and toDate
 */
export const getBatchwiseReport = async (fromDate, toDate) => {
    try {
        const params = {};
        if (fromDate) params.from_date = fromDate;
        if (toDate) params.to_date = toDate;
        
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/reports/batchwise-report/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching batchwise report:', error);
        throw error;
    }
};

/**
 * Create a new stock item
 */
export const createStockItem = async (itemData) => {
    try {
        const response = await axiosInstance.post(`${INVENTORY_API_BASE}/stock-items/`, itemData);
        return response.data;
    } catch (error) {
        console.error('Error creating stock item:', error);
        throw error;
    }
};

/**
 * Update a stock item
 */
export const updateStockItem = async (id, itemData) => {
    try {
        const response = await axiosInstance.put(`${INVENTORY_API_BASE}/stock-items/${id}/`, itemData);
        return response.data;
    } catch (error) {
        console.error(`Error updating stock item ${id}:`, error);
        throw error;
    }
};

/**
 * Delete a stock item
 */
export const deleteStockItem = async (id) => {
    try {
        const response = await axiosInstance.delete(`${INVENTORY_API_BASE}/stock-items/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting stock item ${id}:`, error);
        throw error;
    }
};

/**
 * Check status of queued Tally stock item import
 */
export const checkTallyStockImportStatus = async () => {
    try {
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/stock-items/import-tally-status/`);
        return response.data;
    } catch (error) {
        console.error('Error checking stock import status:', error);
        throw error;
    }
};

/**
 * Download stock item excel template
 */
export const downloadStockItemTemplate = async () => {
    try {
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/stock-items/download_template/`, {
            responseType: 'blob'
        });
        return response;
    } catch (error) {
        console.error('Error downloading template:', error);
        throw error;
    }
};

/**
 * Import stock items from excel
 */
export const importStockItemsExcel = async (formData) => {
    try {
        const response = await axiosInstance.post(`${INVENTORY_API_BASE}/stock-items/import_excel/`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error importing stock items:', error);
        throw error;
    }
};

/**
 * Import stock items from Tally
 */
export const importTallyStockItems = async (onStatusUpdate = null) => {
    try {
        const response = await axiosInstance.post(`${INVENTORY_API_BASE}/stock-items/import-tally/`);
        const data = response.data;

        // If server queued the command for the client-side Tally Agent, poll until complete
        if (data && data.queued) {
            if (onStatusUpdate) onStatusUpdate({ status: 'pending', message: data.message });

            const maxAttempts = 30; // 30 * 2s = 60s
            for (let i = 0; i < maxAttempts; i++) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                const statusRes = await checkTallyStockImportStatus();

                if (onStatusUpdate) onStatusUpdate(statusRes);

                if (statusRes.status === 'done') {
                    return {
                        success: true,
                        message: statusRes.message || 'Stock items imported from Tally successfully!',
                        ...statusRes,
                    };
                }

                if (statusRes.status === 'failed') {
                    throw new Error(statusRes.error || 'Failed to import stock items via Tally Agent.');
                }
            }
            throw new Error('Tally import timed out. Please check if Tally Agent is running and Tally Prime is open.');
        }

        return data;
    } catch (error) {
        console.error('Error importing stock items from Tally:', error);
        throw error;
    }
};

// ==================== PRICE LIST ENDPOINTS ====================

/**
 * Get all price lists
 */
export const getPriceLists = async () => {
    try {
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/price-lists/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching price lists:', error);
        throw error;
    }
};

/**
 * Get a single price list by ID
 */
export const getPriceList = async (id) => {
    try {
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/price-lists/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching price list ${id}:`, error);
        throw error;
    }
};

/**
 * Create a new price list
 */
export const createPriceList = async (priceListData) => {
    try {
        const response = await axiosInstance.post(`${INVENTORY_API_BASE}/price-lists/`, priceListData);
        return response.data;
    } catch (error) {
        console.error('Error creating price list:', error);
        throw error;
    }
};

/**
 * Update a price list
 */
export const updatePriceList = async (id, priceListData) => {
    try {
        const response = await axiosInstance.put(`${INVENTORY_API_BASE}/price-lists/${id}/`, priceListData);
        return response.data;
    } catch (error) {
        console.error(`Error updating price list ${id}:`, error);
        throw error;
    }
};

/**
 * Delete a price list
 */
export const deletePriceList = async (id) => {
    try {
        const response = await axiosInstance.delete(`${INVENTORY_API_BASE}/price-lists/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting price list ${id}:`, error);
        throw error;
    }
};


/**
 * Get active Price List and rates for a Ledger on a specific transaction Date
 */
export const getApplicablePriceListForLedger = async (ledgerId, date) => {
    try {
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/price-lists/applicable-for-ledger/`, {
            params: { ledger_id: ledgerId, date }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching applicable price list for ledger ${ledgerId}:`, error);
        throw error;
    }
};

// ==================== RECIPES ENDPOINTS ====================

/**
 * Get all recipes (Bill of Materials)
 */
export const getRecipes = async () => {
    try {
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/recipes/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching recipes:', error);
        throw error;
    }
};

/**
 * Create a new recipe
 */
export const createRecipe = async (recipeData) => {
    try {
        const response = await axiosInstance.post(`${INVENTORY_API_BASE}/recipes/`, recipeData);
        return response.data;
    } catch (error) {
        console.error('Error creating recipe:', error);
        throw error;
    }
};

/**
 * Update a recipe
 */
export const updateRecipe = async (id, recipeData) => {
    try {
        const response = await axiosInstance.put(`${INVENTORY_API_BASE}/recipes/${id}/`, recipeData);
        return response.data;
    } catch (error) {
        console.error(`Error updating recipe ${id}:`, error);
        throw error;
    }
};

/**
 * Delete a recipe
 */
export const deleteRecipe = async (id) => {
    try {
        const response = await axiosInstance.delete(`${INVENTORY_API_BASE}/recipes/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting recipe ${id}:`, error);
        throw error;
    }
};

// ==================== WAREHOUSE ENDPOINTS ====================

/**
 * Get all warehouses
 */
export const getWarehouses = async () => {
    try {
        const response = await axiosInstance.get('/api/settings/warehouses/');
        return response.data;
    } catch (error) {
        console.error('Error fetching warehouses:', error);
        throw error;
    }
};

const InventoryService = {
    // Product Configurations
    getProductConfigurations: () =>
        axiosInstance.get('/api/inventory/product-configurations/'),

    getProductConfiguration: (id) =>
        axiosInstance.get(`/api/inventory/product-configurations/${id}/`),

    createProductConfiguration: (data) =>
        axiosInstance.post('/api/inventory/product-configurations/', data),

    updateProductConfiguration: (id, data) =>
        axiosInstance.put(`/api/inventory/product-configurations/${id}/`, data),

    deleteProductConfiguration: (id) =>
        axiosInstance.delete(`/api/inventory/product-configurations/${id}/`),

    // Voucher Types (from finance_accounts — read-only)
    getVoucherTypes: () =>
        axiosInstance.get('/api/finance/voucher-types/'),

    // Units of measurement
    getUnits: () =>
        axiosInstance.get('/api/inventory/units/'),

    // Stock Items
    getStockItems: () =>
        axiosInstance.get('/api/inventory/stock-items/'),

    // Batches
    getItemBatches: (itemId) =>
        axiosInstance.get(`/api/inventory/batches/?item_id=${itemId}`),

    // Item Warehouses (only those with stock for the item)
    getItemWarehouses: (itemId) =>
        axiosInstance.get(`/api/inventory/warehouses/?item_id=${itemId}`),

    // All active warehouses for an item (including those with zero stock) — used for Production (IN)
    getItemAllWarehouses: (itemId) =>
        axiosInstance.get(`/api/inventory/warehouses/?item_id=${itemId}&all=true`),

    // Physical Stock
    getPhysicalStocks: () =>
        axiosInstance.get('/api/inventory/physical-stock/'),

    getPhysicalStockNextNo: () =>
        axiosInstance.get('/api/inventory/physical-stock/next-no/'),

    getPhysicalStock: (id) =>
        axiosInstance.get(`/api/inventory/physical-stock/${id}/`),

    createPhysicalStock: (data) =>
        axiosInstance.post('/api/inventory/physical-stock/', data),

    updatePhysicalStock: (id, data) =>
        axiosInstance.put(`/api/inventory/physical-stock/${id}/`, data),

    deletePhysicalStock: (id) =>
        axiosInstance.delete(`/api/inventory/physical-stock/${id}/`),
};

export const deletePhysicalStock = (id) =>
    axiosInstance.delete(`/api/inventory/physical-stock/${id}/`);

export default InventoryService;

// ==================== WAREHOUSE TRANSFER ENDPOINTS ====================

export const getWarehouseTransfers = async () => {
    try {
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/warehouse-transfers/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching warehouse transfers:', error);
        throw error;
    }
};

export const getWarehouseTransferNextNo = async () => {
    try {
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/warehouse-transfers/next-no/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching next warehouse transfer no:', error);
        throw error;
    }
};

export const createWarehouseTransfer = async (data) => {
    try {
        const response = await axiosInstance.post(`${INVENTORY_API_BASE}/warehouse-transfers/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating warehouse transfer:', error);
        throw error;
    }
};

export const updateWarehouseTransfer = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${INVENTORY_API_BASE}/warehouse-transfers/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating warehouse transfer ${id}:`, error);
        throw error;
    }
};

export const deleteWarehouseTransfer = async (id) => {
    try {
        const response = await axiosInstance.delete(`${INVENTORY_API_BASE}/warehouse-transfers/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting warehouse transfer:`, error);
        throw error;
    }
};

// ==================== REPORTS ENDPOINTS ====================

export const getItemMovements = async (itemId) => {
    try {
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/item-movement/${itemId}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching movements for item ${itemId}:`, error);
        throw error;
    }
};

export const getItemBatches = async (itemId) => {
    try {
        const response = await axiosInstance.get(`${INVENTORY_API_BASE}/batches/?item_id=${itemId}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching batches for item ${itemId}:`, error);
        throw error;
    }
};

export const getItemWarehouses = async (itemId, fetchAll=false) => {
    try {
        const url = fetchAll ? `${INVENTORY_API_BASE}/warehouses/?item_id=${itemId}&all=true` : `${INVENTORY_API_BASE}/warehouses/?item_id=${itemId}`;
        const response = await axiosInstance.get(url);
        return response.data;
    } catch (error) {
        console.error(`Error fetching warehouses for item ${itemId}:`, error);
        throw error;
    }
};

export const getStockItemBook = async (itemId, params = {}) => {
    try {
        const url = itemId && itemId !== 'All' ? `${INVENTORY_API_BASE}/stock-items/${itemId}/book/` : `${INVENTORY_API_BASE}/stock-item-book/`;
        const response = await axiosInstance.get(url, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching stock item book:', error);
        throw error;
    }
};

