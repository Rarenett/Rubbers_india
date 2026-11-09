import axios from 'axios';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'}/settings`;

/**
 * Get JWT token from localStorage
 */
function getAuthHeaders() {
    const userDetails = localStorage.getItem('userDetails');
    if (!userDetails) {
        throw new Error('No authentication token found');
    }
    const { access } = JSON.parse(userDetails);
    return {
        'Authorization': `Bearer ${access}`,
        'Content-Type': 'application/json',
    };
}

// ==================== PREFIX TYPE CRUD ====================

export function fetchPrefixTypes() {
    return axios.get(`${API_BASE_URL}/prefix-types/`, {
        headers: getAuthHeaders()
    });
}

export function fetchPrefixSubTypes(prefixTypeId) {
    return axios.get(`${API_BASE_URL}/prefix-types/${prefixTypeId}/subtypes/`, {
        headers: getAuthHeaders()
    });
}

export function createPrefixType(data) {
    return axios.post(`${API_BASE_URL}/prefix-types/`, data, {
        headers: getAuthHeaders()
    });
}

export function updatePrefixType(id, data) {
    return axios.put(`${API_BASE_URL}/prefix-types/${id}/`, data, {
        headers: getAuthHeaders()
    });
}

export function deletePrefixType(id) {
    return axios.delete(`${API_BASE_URL}/prefix-types/${id}/`, {
        headers: getAuthHeaders()
    });
}

// ==================== PREFIX CONFIGURATION CRUD ====================

export function fetchPrefixConfigurations(params = {}) {
    return axios.get(`${API_BASE_URL}/prefix-configurations/`, {
        headers: getAuthHeaders(),
        params
    });
}

export function createPrefixConfiguration(data) {
    return axios.post(`${API_BASE_URL}/prefix-configurations/`, data, {
        headers: getAuthHeaders()
    });
}

export function updatePrefixConfiguration(id, data) {
    return axios.put(`${API_BASE_URL}/prefix-configurations/${id}/`, data, {
        headers: getAuthHeaders()
    });
}

export function deletePrefixConfiguration(id) {
    return axios.delete(`${API_BASE_URL}/prefix-configurations/${id}/`, {
        headers: getAuthHeaders()
    });
}

/**
 * Format error message from API response
 */
export function formatError(error) {
    if (error.response && error.response.data) {
        const data = error.response.data;
        if (typeof data === 'string') {
            return data;
        }
        if (data.detail) {
            return data.detail;
        }
        const errors = [];
        for (const [field, messages] of Object.entries(data)) {
            if (Array.isArray(messages)) {
                errors.push(`${field}: ${messages.join(', ')}`);
            } else {
                errors.push(`${field}: ${messages}`);
            }
        }
        return errors.join('; ');
    }
    return error.message || 'An error occurred';
}

/**
 * Generate next voucher number based on PrefixConfiguration table
 * @param {Object} config - PrefixConfiguration object from database
 * @param {Array} existingVouchers - list of vouchers (e.g. journals, contras, receipts, payments)
 * @param {string} defaultPrefix - fallback prefix (e.g. 'JV', 'CV', 'RV', 'PV')
 * @param {Array} branches - branches list to resolve branch code
 */
export function generateNextVoucherNumber(config, existingVouchers = [], defaultPrefix = 'VOC', branches = []) {
    if (!config) {
        let maxNum = 0;
        (existingVouchers || []).forEach(v => {
            const vNo = v?.voucher_no || '';
            const match = vNo.match(/(\d+)(?:\/\d+)?$/) || vNo.match(/\d+/g);
            if (match) {
                const num = parseInt(Array.isArray(match) ? match[match.length - 1] : match[1], 10);
                if (num > maxNum) maxNum = num;
            }
        });
        return `${defaultPrefix}-${String(maxNum + 1).padStart(4, '0')}`;
    }

    const prefix = config.prefix || defaultPrefix;
    const padding = parseInt(config.number_padding || 4, 10);
    const startingNo = parseInt(config.starting_number || 1, 10);
    const postfix = config.postfix ? `/${config.postfix}` : '';
    const selectedBranch = (branches || []).find(b => b.id === config.branch);
    const branchCode = selectedBranch?.branch_code ? `${selectedBranch.branch_code}-` : '';

    let maxNum = 0;
    let foundAny = false;

    (existingVouchers || []).forEach(v => {
        const vNo = v?.voucher_no || '';
        const escapedPrefix = prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const prefixRegex = new RegExp(`(?:^|[-_/])${escapedPrefix}[-_/]?(\\d+)`, 'i');
        const m = vNo.match(prefixRegex);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxNum) maxNum = n;
            foundAny = true;
        } else {
            const mDigits = vNo.match(/(\d+)(?:\/[^/]+)?$/);
            if (mDigits) {
                const n = parseInt(mDigits[1], 10);
                if (n > maxNum) maxNum = n;
                foundAny = true;
            }
        }
    });

    const nextNum = foundAny && maxNum >= startingNo ? maxNum + 1 : startingNo;
    return `${branchCode}${prefix}-${String(nextNum).padStart(padding, '0')}${postfix}`;
}
