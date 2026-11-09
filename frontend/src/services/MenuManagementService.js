import axios from 'axios';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'}/auth`;

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

// ==================== HELPER FUNCTIONS ====================

/**
 * Sanitize data by converting empty strings to null for optional fields.
 * This prevents IntegrityErrors (unique constraint) on fields like 'code'.
 */
function sanitizeData(data) {
    const sanitized = { ...data };
    const fieldsToSanitize = ['code', 'url', 'icon', 'description'];
    
    fieldsToSanitize.forEach(field => {
        if (sanitized[field] === '') {
            sanitized[field] = null;
        }
    });
    
    return sanitized;
}

// ==================== MENU CRUD ====================

/**
 * Fetch all menus
 */
export function fetchMenus() {
    return axios.get(`${API_BASE_URL}/menus/`, {
        headers: getAuthHeaders()
    });
}

/**
 * Force restore default system menus
 */
export function restoreDefaultMenus() {
    return axios.post(`${API_BASE_URL}/menus/restore-defaults/`, {}, {
        headers: getAuthHeaders()
    });
}

/**
 * Create a new menu
 */
export function createMenu(menuData) {
    return axios.post(`${API_BASE_URL}/menus/`, sanitizeData(menuData), {
        headers: getAuthHeaders()
    });
}

/**
 * Update an existing menu
 */
export function updateMenu(id, menuData) {
    return axios.put(`${API_BASE_URL}/menus/${id}/`, sanitizeData(menuData), {
        headers: getAuthHeaders()
    });
}

/**
 * Delete a menu
 */
export function deleteMenu(id) {
    return axios.delete(`${API_BASE_URL}/menus/${id}/`, {
        headers: getAuthHeaders()
    });
}

// ==================== SUBMENU CRUD ====================

/**
 * Fetch all submenus (optionally filter by menu_id)
 */
export function fetchSubMenus(menuId = null) {
    const url = menuId
        ? `${API_BASE_URL}/submenus/?menu_id=${menuId}`
        : `${API_BASE_URL}/submenus/`;

    return axios.get(url, {
        headers: getAuthHeaders()
    });
}

/**
 * Create a new submenu
 */
export function createSubMenu(submenuData) {
    return axios.post(`${API_BASE_URL}/submenus/`, sanitizeData(submenuData), {
        headers: getAuthHeaders()
    });
}

/**
 * Update an existing submenu
 */
export function updateSubMenu(id, submenuData) {
    return axios.put(`${API_BASE_URL}/submenus/${id}/`, sanitizeData(submenuData), {
        headers: getAuthHeaders()
    });
}

/**
 * Delete a submenu
 */
export function deleteSubMenu(id) {
    return axios.delete(`${API_BASE_URL}/submenus/${id}/`, {
        headers: getAuthHeaders()
    });
}

// ==================== SUBSUBMENU CRUD ====================

/**
 * Fetch all subsubmenus (optionally filter by submenu_id)
 */
export function fetchSubSubMenus(submenuId = null) {
    const url = submenuId
        ? `${API_BASE_URL}/subsubmenus/?submenu_id=${submenuId}`
        : `${API_BASE_URL}/subsubmenus/`;

    return axios.get(url, {
        headers: getAuthHeaders()
    });
}

/**
 * Create a new subsubmenu
 */
export function createSubSubMenu(subsubmenuData) {
    return axios.post(`${API_BASE_URL}/subsubmenus/`, sanitizeData(subsubmenuData), {
        headers: getAuthHeaders()
    });
}

/**
 * Update an existing subsubmenu
 */
export function updateSubSubMenu(id, subsubmenuData) {
    return axios.put(`${API_BASE_URL}/subsubmenus/${id}/`, sanitizeData(subsubmenuData), {
        headers: getAuthHeaders()
    });
}

/**
 * Delete a subsubmenu
 */
export function deleteSubSubMenu(id) {
    return axios.delete(`${API_BASE_URL}/subsubmenus/${id}/`, {
        headers: getAuthHeaders()
    });
}

// ==================== PERMISSION CRUD ====================

/**
 * Fetch all permissions (optionally filter by role_id)
 */
export function fetchPermissions(roleId = null) {
    const url = roleId
        ? `${API_BASE_URL}/role-permissions/?role_id=${roleId}`
        : `${API_BASE_URL}/role-permissions/`;

    return axios.get(url, {
        headers: getAuthHeaders()
    });
}

/**
 * Create a new permission
 */
export function createPermission(permissionData) {
    return axios.post(`${API_BASE_URL}/role-permissions/`, permissionData, {
        headers: getAuthHeaders()
    });
}

/**
 * Update an existing permission
 */
export function updatePermission(id, permissionData) {
    return axios.put(`${API_BASE_URL}/role-permissions/${id}/`, permissionData, {
        headers: getAuthHeaders()
    });
}

/**
 * Delete a permission
 */
export function deletePermission(id) {
    return axios.delete(`${API_BASE_URL}/role-permissions/${id}/`, {
        headers: getAuthHeaders()
    });
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Fetch all users (for permission assignment)
 */
export function fetchManageableUsers() {
    return axios.get(`${API_BASE_URL}/manageable-users/`, {
        headers: getAuthHeaders()
    });
}

/**
 * Format error message from API response
 */
export function formatError(error) {
    if (!error) return 'An error occurred';
    
    let data = error.response?.data || error.data || error;

    const cleanMessage = (key, msgVal) => {
        let msgStr = Array.isArray(msgVal) ? msgVal.join(', ') : String(msgVal);
        let lower = msgStr.toLowerCase();
        let fieldName = (!key || key.toLowerCase() === 'non_field_errors' || key.toLowerCase() === 'detail')
            ? ''
            : key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        if (lower.includes('must make a unique set') || lower.includes('already exists') || lower.includes('must be unique')) {
            if (fieldName) {
                return `Duplicate Entry: A record with this ${fieldName.toLowerCase()} already exists.`;
            }
            return `Duplicate Entry: An entry with these details already exists.`;
        }

        if (lower.includes('this field is required') || lower.includes('may not be null') || lower.includes('may not be blank')) {
            return `${fieldName || 'This field'} is required.`;
        }

        msgStr = msgStr.replace(/The fields (.+) must make a unique set\.?/gi, 'Duplicate Entry: An entry with these details already exists.');
        msgStr = msgStr.replace(/NON_FIELD_ERRORS:?\s*/gi, '');
        msgStr = msgStr.replace(/non_field_errors:?\s*/gi, '');

        return fieldName ? `${fieldName}: ${msgStr}` : msgStr;
    };

    if (typeof data === 'string') {
        return cleanMessage('', data);
    }

    if (typeof data === 'object' && data !== null) {
        if (data.detail) {
            return cleanMessage('', data.detail);
        }

        const messages = [];
        for (const [key, value] of Object.entries(data)) {
            messages.push(cleanMessage(key, value));
        }

        if (messages.length > 0) {
            return messages.join('\n');
        }
    }

    return error.message || 'An error occurred';
}
