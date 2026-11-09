import axiosInstance from './AxiosInstance';

const API_BASE_URL = '/api/settings';

/**
 * Fetch company details
 */
export const fetchCompany = () => {
    return axiosInstance.get(`${API_BASE_URL}/company/`);
};

/**
 * Create company details
 */
export const createCompany = (companyData) => {
    return axiosInstance.post(`${API_BASE_URL}/company/`, companyData);
};

/**
 * Update company details
 */
export const updateCompany = (id, companyData) => {
    return axiosInstance.patch(`${API_BASE_URL}/company/${id}/`, companyData);
};

/**
 * ADDRESSES
 */
export const fetchCompanyAddresses = (companyId) => {
    return axiosInstance.get(`${API_BASE_URL}/company-addresses/?company=${companyId}`, {
    });
};

export const createCompanyAddress = (data) => {
    return axiosInstance.post(`${API_BASE_URL}/company-addresses/`, data, {
    });
};

export const updateCompanyAddress = (id, data) => {
    return axiosInstance.patch(`${API_BASE_URL}/company-addresses/${id}/`, data, {
    });
};

export const deleteCompanyAddress = (id) => {
    return axiosInstance.delete(`${API_BASE_URL}/company-addresses/${id}/`, {
    });
};

/**
 * CONTACTS
 */
export const fetchCompanyContacts = (companyId) => {
    return axiosInstance.get(`${API_BASE_URL}/company-contacts/?company=${companyId}`, {
    });
};

export const createCompanyContact = (data) => {
    return axiosInstance.post(`${API_BASE_URL}/company-contacts/`, data, {
    });
};

export const updateCompanyContact = (id, data) => {
    return axiosInstance.patch(`${API_BASE_URL}/company-contacts/${id}/`, data, {
    });
};

export const deleteCompanyContact = (id) => {
    return axiosInstance.delete(`${API_BASE_URL}/company-contacts/${id}/`, {
    });
};

/**
 * FINANCIAL YEARS
 */
export const fetchCompanyFinancialYears = (companyId) => {
    return axiosInstance.get(`${API_BASE_URL}/company-financial-years/?company=${companyId}`, {
    });
};

export const createCompanyFinancialYear = (data) => {
    return axiosInstance.post(`${API_BASE_URL}/company-financial-years/`, data, {
    });
};

export const updateCompanyFinancialYear = (id, data) => {
    return axiosInstance.patch(`${API_BASE_URL}/company-financial-years/${id}/`, data, {
    });
};

export const deleteCompanyFinancialYear = (id) => {
    return axiosInstance.delete(`${API_BASE_URL}/company-financial-years/${id}/`, {
    });
};

/**
 * BRANCHES
 */
export const fetchBranches = (companyId) => {
    let url = `${API_BASE_URL}/branches/`;
    if (companyId) {
        url += `?company=${companyId}`;
    }
    return axiosInstance.get(url);
};

export const fetchBranchById = (id) => {
    return axiosInstance.get(`${API_BASE_URL}/branches/${id}/`);
};

export const createBranch = (data) => {
    return axiosInstance.post(`${API_BASE_URL}/branches/`, data, {
    });
};

export const updateBranch = (id, data) => {
    return axiosInstance.patch(`${API_BASE_URL}/branches/${id}/`, data, {
    });
};

export const deleteBranch = (id) => {
    return axiosInstance.delete(`${API_BASE_URL}/branches/${id}/`, {
    });
};

export const updateBranchDepartments = (id, departmentIds) => {
    return axiosInstance.post(`${API_BASE_URL}/branches/${id}/update_departments/`, {
        department_ids: departmentIds
    });
};

/**
 * BRANCH ADDRESSES
 */
export const fetchBranchAddresses = (branchId) => {
    return axiosInstance.get(`${API_BASE_URL}/branch-addresses/?branch=${branchId}`, {
    });
};

export const createBranchAddress = (data) => {
    return axiosInstance.post(`${API_BASE_URL}/branch-addresses/`, data, {
    });
};

export const updateBranchAddress = (id, data) => {
    return axiosInstance.patch(`${API_BASE_URL}/branch-addresses/${id}/`, data, {
    });
};

export const deleteBranchAddress = (id) => {
    return axiosInstance.delete(`${API_BASE_URL}/branch-addresses/${id}/`, {
    });
};

/**
 * BRANCH CONTACTS
 */
export const fetchBranchContacts = (branchId) => {
    return axiosInstance.get(`${API_BASE_URL}/branch-contacts/?branch=${branchId}`, {
    });
};

export const createBranchContact = (data) => {
    return axiosInstance.post(`${API_BASE_URL}/branch-contacts/`, data, {
    });
};

export const updateBranchContact = (id, data) => {
    return axiosInstance.patch(`${API_BASE_URL}/branch-contacts/${id}/`, data, {
    });
};

export const deleteBranchContact = (id) => {
    return axiosInstance.delete(`${API_BASE_URL}/branch-contacts/${id}/`, {
    });
};

/**
 * BRANCH BANK ACCOUNTS
 */
export const fetchBranchBankAccounts = (branchId) => {
    return axiosInstance.get(`${API_BASE_URL}/branch-bank-accounts/?branch=${branchId}`, {
    });
};

export const createBranchBankAccount = (data) => {
    return axiosInstance.post(`${API_BASE_URL}/branch-bank-accounts/`, data, {
    });
};

export const updateBranchBankAccount = (id, data) => {
    return axiosInstance.patch(`${API_BASE_URL}/branch-bank-accounts/${id}/`, data, {
    });
};

export const deleteBranchBankAccount = (id) => {
    return axiosInstance.delete(`${API_BASE_URL}/branch-bank-accounts/${id}/`, {
    });
};

/**
 * FACTORIES
 */
export const fetchFactories = (params = {}) => {
    let url = `${API_BASE_URL}/factories/`;
    if (params.company) url += `?company=${params.company}`;
    if (params.branch) url += (url.includes('?') ? '&' : '?') + `branch=${params.branch}`;

    return axiosInstance.get(url);
};

export const createFactory = (data) => {
    return axiosInstance.post(`${API_BASE_URL}/factories/`, data, {
    });
};

export const updateFactory = (id, data) => {
    return axiosInstance.patch(`${API_BASE_URL}/factories/${id}/`, data, {
    });
};

export const deleteFactory = (id) => {
    return axiosInstance.delete(`${API_BASE_URL}/factories/${id}/`, {
    });
};

export const fetchFactoryById = (id) => {
    return axiosInstance.get(`${API_BASE_URL}/factories/${id}/`);
};

/**
 * FACTORY ADDRESSES
 */
export const fetchFactoryAddresses = (factoryId) => {
    return axiosInstance.get(`${API_BASE_URL}/factory-addresses/?factory=${factoryId}`, {
    });
};

export const createFactoryAddress = (data) => {
    return axiosInstance.post(`${API_BASE_URL}/factory-addresses/`, data, {
    });
};

export const updateFactoryAddress = (id, data) => {
    return axiosInstance.patch(`${API_BASE_URL}/factory-addresses/${id}/`, data, {
    });
};

export const deleteFactoryAddress = (id) => {
    return axiosInstance.delete(`${API_BASE_URL}/factory-addresses/${id}/`, {
    });
};

/**
 * FACTORY CONTACTS
 */
export const fetchFactoryContacts = (factoryId) => {
    return axiosInstance.get(`${API_BASE_URL}/factory-contacts/?factory=${factoryId}`, {
    });
};

export const createFactoryContact = (data) => {
    return axiosInstance.post(`${API_BASE_URL}/factory-contacts/`, data, {
    });
};

export const updateFactoryContact = (id, data) => {
    return axiosInstance.patch(`${API_BASE_URL}/factory-contacts/${id}/`, data, {
    });
};

export const deleteFactoryContact = (id) => {
    return axiosInstance.delete(`${API_BASE_URL}/factory-contacts/${id}/`, {
    });
};

/**
 * WAREHOUSES
 */
export const fetchWarehouses = (params = {}) => {
    let url = `${API_BASE_URL}/warehouses/`;
    const queryParams = [];
    if (params.company) queryParams.push(`company=${params.company}`);
    if (params.branch !== undefined) queryParams.push(`branch=${params.branch}`);
    if (params.factory !== undefined) queryParams.push(`factory=${params.factory}`);

    if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
    }

    return axiosInstance.get(url);
};

export const createWarehouse = (data) => {
    return axiosInstance.post(`${API_BASE_URL}/warehouses/`, data, {
    });
};

export const updateWarehouse = (id, data) => {
    return axiosInstance.patch(`${API_BASE_URL}/warehouses/${id}/`, data, {
    });
};

export const deleteWarehouse = (id) => {
    return axiosInstance.delete(`${API_BASE_URL}/warehouses/${id}/`, {
    });
};

export const fetchWarehouseById = (id) => {
    return axiosInstance.get(`${API_BASE_URL}/warehouses/${id}/`);
};

/**
 * WAREHOUSE ADDRESSES
 */
export const fetchWarehouseAddresses = (warehouseId) => {
    return axiosInstance.get(`${API_BASE_URL}/warehouse-addresses/?warehouse=${warehouseId}`, {
    });
};

export const createWarehouseAddress = (data) => {
    return axiosInstance.post(`${API_BASE_URL}/warehouse-addresses/`, data, {
    });
};

export const updateWarehouseAddress = (id, data) => {
    return axiosInstance.patch(`${API_BASE_URL}/warehouse-addresses/${id}/`, data, {
    });
};

export const deleteWarehouseAddress = (id) => {
    return axiosInstance.delete(`${API_BASE_URL}/warehouse-addresses/${id}/`, {
    });
};

/**
 * WAREHOUSE CONTACTS
 */
export const fetchWarehouseContacts = (warehouseId) => {
    return axiosInstance.get(`${API_BASE_URL}/warehouse-contacts/?warehouse=${warehouseId}`, {
    });
};

export const createWarehouseContact = (data) => {
    return axiosInstance.post(`${API_BASE_URL}/warehouse-contacts/`, data, {
    });
};

export const updateWarehouseContact = (id, data) => {
    return axiosInstance.patch(`${API_BASE_URL}/warehouse-contacts/${id}/`, data, {
    });
};

export const deleteWarehouseContact = (id) => {
    return axiosInstance.delete(`${API_BASE_URL}/warehouse-contacts/${id}/`, {
    });
};

/**
 * Format API errors for display
 */
export const formatCompanyError = (error) => {
    if (error.response && error.response.data) {
        const data = error.response.data;
        if (typeof data === 'string') return data;
        if (data.detail) return data.detail;

        let messages = [];
        for (let key in data) {
            if (Array.isArray(data[key])) {
                messages.push(`${key}: ${data[key].join(', ')}`);
            } else {
                messages.push(`${key}: ${data[key]}`);
            }
        }
        return messages.join('\n');
    }
    return error.message || 'An unexpected error occurred';
};
