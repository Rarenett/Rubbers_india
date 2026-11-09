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

/**
 * Fetch all languages
 */
export const fetchLanguages = () => {
    return axios.get(`${API_BASE_URL}/languages/`, {
        headers: getAuthHeaders()
    });
};

/**
 * Create a new language
 */
export const createLanguage = (languageData) => {
    return axios.post(`${API_BASE_URL}/languages/`, languageData, {
        headers: getAuthHeaders()
    });
};

/**
 * Update an existing language
 */
export const updateLanguage = (id, languageData) => {
    return axios.put(`${API_BASE_URL}/languages/${id}/`, languageData, {
        headers: getAuthHeaders()
    });
};

/**
 * Delete a language
 */
export const deleteLanguage = (id) => {
    return axios.delete(`${API_BASE_URL}/languages/${id}/`, {
        headers: getAuthHeaders()
    });
};

/**
 * Format API errors for display
 */
export const formatLanguageError = (error) => {
    if (error.response && error.response.data) {
        const data = error.response.data;
        if (typeof data === 'string') return data;

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
