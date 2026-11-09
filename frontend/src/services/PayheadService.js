import axiosInstance from './AxiosInstance';

const HRM_API_BASE = '/api/hrm';

// ─── Unit Management ───────────────────────────────────────────────

/**
 * Get all units
 * @param {number} companyId - Optional filter by company
 * @returns {Promise} Array of unit objects
 */
export const getUnits = async (companyId = null) => {
    try {
        const params = companyId ? { company_id: companyId } : {};
        const response = await axiosInstance.get(`${HRM_API_BASE}/units/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching units:', error);
        throw error;
    }
};

/**
 * Create a new unit
 * @param {object} data - { name, abbreviation }
 * @returns {Promise} Created unit object
 */
export const createUnit = async (data) => {
    try {
        const response = await axiosInstance.post(`${HRM_API_BASE}/units/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating unit:', error);
        throw error;
    }
};

/**
 * Update a unit
 * @param {number} id - Unit ID
 * @param {object} data - Updated data
 * @returns {Promise} Updated unit object
 */
export const updateUnit = async (id, data) => {
    try {
        const response = await axiosInstance.patch(`${HRM_API_BASE}/units/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error('Error updating unit:', error);
        throw error;
    }
};

/**
 * Delete a unit
 * @param {number} id - Unit ID
 * @returns {Promise} Response
 */
export const deleteUnit = async (id) => {
    try {
        const response = await axiosInstance.delete(`${HRM_API_BASE}/units/${id}/`);
        return response.data;
    } catch (error) {
        console.error('Error deleting unit:', error);
        throw error;
    }
};
