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

// ==================== CURRENCY CRUD ====================

/**
 * Fetch all currencies
 */
export function fetchCurrencies() {
    return axios.get(`${API_BASE_URL}/currencies/`, {
        headers: getAuthHeaders()
    });
}

/**
 * Create a new currency
 */
export function createCurrency(currencyData) {
    return axios.post(`${API_BASE_URL}/currencies/`, currencyData, {
        headers: getAuthHeaders()
    });
}

/**
 * Update an existing currency
 */
export function updateCurrency(id, currencyData) {
    return axios.put(`${API_BASE_URL}/currencies/${id}/`, currencyData, {
        headers: getAuthHeaders()
    });
}

/**
 * Delete a currency
 */
export function deleteCurrency(id) {
    return axios.delete(`${API_BASE_URL}/currencies/${id}/`, {
        headers: getAuthHeaders()
    });
}

// ==================== EXCHANGE RATE CRUD ====================
/**
 * Fetch all exchange rates with optional filtering
 * params: { from_currency, to_currency, is_active }
 */
export function fetchExchangeRates(params = {}) {
    return axios.get(`${API_BASE_URL}/exchange-rates/`, {
        headers: getAuthHeaders(),
        params
    });
}

/**
 * Create a new exchange rate
 */
export function createExchangeRate(rateData) {
    return axios.post(`${API_BASE_URL}/exchange-rates/`, rateData, {
        headers: getAuthHeaders()
    });
}

/**
 * Delete an exchange rate
 */
export function deleteExchangeRate(id) {
    return axios.delete(`${API_BASE_URL}/exchange-rates/${id}/`, {
        headers: getAuthHeaders()
    });
}

/**
 * Format error message from API response
 */
export function formatError(error) {
    if (error.response && error.response.data) {
        const data = error.response.data;
        
        // Handle HTML responses (likely Django debug/error page)
        if (typeof data === 'string' && data.includes('<!DOCTYPE html>')) {
            return 'Server error (500): Please contact administrator.';
        }
        
        if (typeof data === 'string') {
            return data;
        }
        if (data.detail) {
            return data.detail;
        }
        
        // Handle field errors
        const errors = [];
        for (const [field, messages] of Object.entries(data)) {
            if (Array.isArray(messages)) {
                errors.push(`${field}: ${messages.join(', ')}`);
            } else {
                errors.push(`${field}: ${messages}`);
            }
        }
        return errors.length > 0 ? errors.join('; ') : 'An unknown error occurred';
    }
    return error.message || 'An error occurred';
}
