import axiosInstance from './AxiosInstance';

const GATE_API_BASE = '/api/gate';

// ==================== CACHE STATE ====================
let gateCache = {
    gates: null,
    gatesTime: 0,
    categories: null,
    categoriesTime: 0
};
const CACHE_DURATION = 60000; // 60 seconds

// Gates
export const getGates = async () => {
    if (gateCache.gates && (Date.now() - gateCache.gatesTime < CACHE_DURATION)) {
        return gateCache.gates;
    }
    const response = await axiosInstance.get(`${GATE_API_BASE}/gates/`);
    gateCache.gates = response.data;
    gateCache.gatesTime = Date.now();
    return response.data;
};

export const createGate = async (data) => {
    const response = await axiosInstance.post(`${GATE_API_BASE}/gates/`, data);
    gateCache.gates = null; // Invalidate cache
    return response.data;
};

export const updateGate = async (id, data) => {
    const response = await axiosInstance.put(`${GATE_API_BASE}/gates/${id}/`, data);
    return response.data;
};

export const deleteGate = async (id) => {
    const response = await axiosInstance.delete(`${GATE_API_BASE}/gates/${id}/`);
    return response.data;
};

// Gate Categories
export const getGateCategories = async () => {
    if (gateCache.categories && (Date.now() - gateCache.categoriesTime < CACHE_DURATION)) {
        return gateCache.categories;
    }
    const response = await axiosInstance.get(`${GATE_API_BASE}/categories/`);
    gateCache.categories = response.data;
    gateCache.categoriesTime = Date.now();
    return response.data;
};

export const createGateCategory = async (data) => {
    const response = await axiosInstance.post(`${GATE_API_BASE}/categories/`, data);
    gateCache.categories = null; // Invalidate cache
    return response.data;
};

export const updateGateCategory = async (id, data) => {
    const response = await axiosInstance.put(`${GATE_API_BASE}/categories/${id}/`, data);
    return response.data;
};

export const deleteGateCategory = async (id) => {
    const response = await axiosInstance.delete(`${GATE_API_BASE}/categories/${id}/`);
    return response.data;
};

// Gate SubCategories
export const getGateSubCategories = async (categoryId = null) => {
    let url = `${GATE_API_BASE}/subcategories/`;
    const params = categoryId ? { category: categoryId } : {};
    const response = await axiosInstance.get(url, { params });
    return response.data;
};

export const createGateSubCategory = async (data) => {
    const response = await axiosInstance.post(`${GATE_API_BASE}/subcategories/`, data);
    return response.data;
};

export const updateGateSubCategory = async (id, data) => {
    const response = await axiosInstance.put(`${GATE_API_BASE}/subcategories/${id}/`, data);
    return response.data;
};

export const deleteGateSubCategory = async (id) => {
    const response = await axiosInstance.delete(`${GATE_API_BASE}/subcategories/${id}/`);
    return response.data;
};

// Entry Tags
export const getEntryTags = async () => {
    const response = await axiosInstance.get(`${GATE_API_BASE}/entry-tags/`);
    return response.data;
};

export const createEntryTag = async (data) => {
    const response = await axiosInstance.post(`${GATE_API_BASE}/entry-tags/`, data);
    return response.data;
};

export const updateEntryTag = async (id, data) => {
    const response = await axiosInstance.put(`${GATE_API_BASE}/entry-tags/${id}/`, data);
    return response.data;
};

export const deleteEntryTag = async (id) => {
    const response = await axiosInstance.delete(`${GATE_API_BASE}/entry-tags/${id}/`);
    return response.data;
};

// Generated Tags
export const getGeneratedTags = async (params = {}) => {
    const response = await axiosInstance.get(`${GATE_API_BASE}/generated-tags/`, { params });
    return response.data;
};

// Visitors
export const getVisitors = async () => {
    const response = await axiosInstance.get(`${GATE_API_BASE}/visitors/`);
    return response.data;
};

export const createVisitor = async (formData) => {
    const response = await axiosInstance.post(`${GATE_API_BASE}/visitors/`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

export const updateVisitor = async (id, formData) => {
    const response = await axiosInstance.put(`${GATE_API_BASE}/visitors/${id}/`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

export const deleteVisitor = async (id) => {
    const response = await axiosInstance.delete(`${GATE_API_BASE}/visitors/${id}/`);
    return response.data;
};

export const searchVisitorByMobile = async (mobileNo) => {
    const response = await axiosInstance.get(`${GATE_API_BASE}/visitors/search_by_mobile/`, {
        params: { mobile_no: mobileNo }
    });
    return response.data;
};

export const searchVisitors = async (query) => {
    const response = await axiosInstance.get(`${GATE_API_BASE}/visitors/`, {
        params: { search: query }
    });
    return response.data;
};

// ==================== GATE ENTRY APIS ====================

/**
 * Get all gate entries
 * @param {object} params - Filter parameters
 * @returns {Promise} Array of gate entry objects
 */
export const getGateEntries = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${GATE_API_BASE}/gate-entries/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching gate entries:', error);
        throw error;
    }
};

export const getGateEntry = async (id) => {
    try {
        const response = await axiosInstance.get(`${GATE_API_BASE}/gate-entries/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching gate entry ${id}:`, error);
        throw error;
    }
};

export const markExitGateEntry = async (id, payload = {}) => {
    try {
        const response = await axiosInstance.post(`${GATE_API_BASE}/gate-entries/${id}/mark_exit/`, payload);
        return response.data;
    } catch (error) {
        console.error(`Error marking exit for gate entry ${id}:`, error);
        throw error;
    }
};

export const resumeGateEntry = async (id, payload = {}) => {
    try {
        const response = await axiosInstance.post(`${GATE_API_BASE}/gate-entries/${id}/resume_entry/`, payload);
        return response.data;
    } catch (error) {
        console.error(`Error resuming gate entry ${id}:`, error);
        throw error;
    }
};

export const checkUnclosedGateEntry = async (mobile, visitorId = null) => {
    try {
        const params = {};
        if (mobile) params.mobile = mobile;
        if (visitorId) params.visitor_id = visitorId;
        const response = await axiosInstance.get(`${GATE_API_BASE}/gate-entries/check_unclosed_entry/`, {
            params
        });
        return response.data?.unclosed_entry || null;
    } catch (error) {
        console.error('Error checking unclosed gate entry:', error);
        return null;
    }
};

export const approveGateEntry = async (id) => {
    try {
        const response = await axiosInstance.post(`${GATE_API_BASE}/gate-entries/${id}/approve_entry/`);
        return response.data;
    } catch (error) {
        console.error(`Error approving gate entry ${id}:`, error);
        throw error;
    }
};

export const rejectGateEntry = async (id) => {
    try {
        const response = await axiosInstance.post(`${GATE_API_BASE}/gate-entries/${id}/reject_entry/`);
        return response.data;
    } catch (error) {
        console.error(`Error rejecting gate entry ${id}:`, error);
        throw error;
    }
};

export const getMyPendingApprovals = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${GATE_API_BASE}/gate-entries/my_pending_approvals/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching pending approvals:', error);
        throw error;
    }
};

/**
 * Get visitors and accompanied vehicles allocated to an employee
 * @param {object} params - { employee, status, all, search }
 */
export const getAllocatedVisitors = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${GATE_API_BASE}/gate-entries/allocated_visitors/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching allocated visitors:', error);
        throw error;
    }
};

/**
 * Reallocate visitor to another employee
 * @param {number} gateEntryId
 * @param {object} payload - { to_employee, to_department, reason }
 */
export const reallocateVisitor = async (gateEntryId, payload, entryType = 'visitor') => {
    try {
        const url = entryType === 'vehicle'
            ? `${GATE_API_BASE}/vehicle-entries/${gateEntryId}/reallocate/`
            : `${GATE_API_BASE}/gate-entries/${gateEntryId}/reallocate/`;
        const response = await axiosInstance.post(url, payload);
        return response.data;
    } catch (error) {
        console.error(`Error reallocating ${entryType} for gate entry ${gateEntryId}:`, error);
        throw error;
    }
};

/**
 * Complete visitor/vehicle movement in campus (releases visitor back to gate)
 * @param {number} gateEntryId
 * @param {object} payload - { notes }
 * @param {string} entryType - 'visitor' | 'vehicle'
 */
export const completeVisitorMovement = async (gateEntryId, payload = {}, entryType = 'visitor') => {
    try {
        const url = entryType === 'vehicle'
            ? `${GATE_API_BASE}/vehicle-entries/${gateEntryId}/complete_movement/`
            : `${GATE_API_BASE}/gate-entries/${gateEntryId}/complete_movement/`;
        const response = await axiosInstance.post(url, payload);
        return response.data;
    } catch (error) {
        console.error(`Error completing movement for ${entryType} ${gateEntryId}:`, error);
        throw error;
    }
};

/**
 * Get reallocation audit trail for a gate entry / vehicle entry
 * @param {number} gateEntryId
 * @param {string} entryType - 'visitor' | 'vehicle'
 */
export const getReallocationHistory = async (gateEntryId, entryType = 'visitor') => {
    try {
        const url = entryType === 'vehicle'
            ? `${GATE_API_BASE}/vehicle-entries/${gateEntryId}/reallocation_history/`
            : `${GATE_API_BASE}/gate-entries/${gateEntryId}/reallocation_history/`;
        const response = await axiosInstance.get(url);
        return response.data;
    } catch (error) {
        console.error(`Error fetching reallocation history for ${entryType} ${gateEntryId}:`, error);
        throw error;
    }
};

/**
 * Fetch pending reallocation requests directed to the logged-in employee for approval
 */
export const getMyPendingReallocations = async () => {
    try {
        const response = await axiosInstance.get(`${GATE_API_BASE}/reallocations/my_pending_reallocations/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching pending reallocations:', error);
        throw error;
    }
};

/**
 * Approve or reject an incoming visitor reallocation
 * @param {number} reallocationId
 * @param {'approve'|'reject'} action
 * @param {string} notes
 */
export const respondReallocation = async (reallocationId, action, notes = '') => {
    try {
        const response = await axiosInstance.post(`${GATE_API_BASE}/reallocations/${reallocationId}/respond/`, {
            action,
            notes
        });
        return response.data;
    } catch (error) {
        console.error(`Error responding to reallocation ${reallocationId}:`, error);
        throw error;
    }
};

/**
 * Cancel a pending reallocation request
 * @param {number} reallocationId
 * @param {string} notes
 */
export const cancelReallocation = async (reallocationId, notes = '') => {
    try {
        const response = await axiosInstance.post(`${GATE_API_BASE}/reallocations/${reallocationId}/cancel/`, {
            notes
        });
        return response.data;
    } catch (error) {
        console.error(`Error cancelling reallocation ${reallocationId}:`, error);
        throw error;
    }
};

/**
 * Create new gate entry
 * @param {object} data - Gate entry data
 * @returns {Promise} Created gate entry object
 */
export const createGateEntry = async (data) => {
    try {
        const response = await axiosInstance.post(`${GATE_API_BASE}/gate-entries/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating gate entry:', error);
        throw error;
    }
};

/**
 * Update existing gate entry
 * @param {number} id - Gate entry ID
 * @param {object} data - Updated gate entry data
 * @returns {Promise} Updated gate entry object
 */
export const updateGateEntry = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${GATE_API_BASE}/gate-entries/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating gate entry ${id}:`, error);
        throw error;
    }
};

/**
 * Delete gate entry
 * @param {number} id - Gate entry ID
 * @returns {Promise} Response object
 */
export const deleteGateEntry = async (id) => {
    try {
        const response = await axiosInstance.delete(`${GATE_API_BASE}/gate-entries/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting gate entry ${id}:`, error);
        throw error;
    }
};

// ==================== VEHICLE GATE MANAGEMENT APIS ====================

export const getVehicleTypes = async () => {
    const response = await axiosInstance.get(`${GATE_API_BASE}/vehicle-types/`);
    return response.data;
};

export const createVehicleType = async (data) => {
    const response = await axiosInstance.post(`${GATE_API_BASE}/vehicle-types/`, data);
    return response.data;
};

export const updateVehicleType = async (id, data) => {
    const response = await axiosInstance.put(`${GATE_API_BASE}/vehicle-types/${id}/`, data);
    return response.data;
};

export const deleteVehicleType = async (id) => {
    const response = await axiosInstance.delete(`${GATE_API_BASE}/vehicle-types/${id}/`);
    return response.data;
};

export const getVehicles = async (params = {}) => {
    const response = await axiosInstance.get(`${GATE_API_BASE}/vehicles/`, { params });
    return response.data;
};

export const searchVehicleByNumber = async (vehicleNumber) => {
    const response = await axiosInstance.get(`${GATE_API_BASE}/vehicles/search_by_number/`, {
        params: { vehicle_number: vehicleNumber }
    });
    return response.data;
};

export const createVehicle = async (formData) => {
    const response = await axiosInstance.post(`${GATE_API_BASE}/vehicles/`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

export const updateVehicle = async (id, formData) => {
    const response = await axiosInstance.put(`${GATE_API_BASE}/vehicles/${id}/`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

export const deleteVehicle = async (id) => {
    const response = await axiosInstance.delete(`${GATE_API_BASE}/vehicles/${id}/`);
    return response.data;
};

export const getVehicleEntries = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${GATE_API_BASE}/vehicle-entries/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching vehicle entries:', error);
        throw error;
    }
};

export const getVehicleEntry = async (id) => {
    try {
        const response = await axiosInstance.get(`${GATE_API_BASE}/vehicle-entries/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching vehicle entry ${id}:`, error);
        throw error;
    }
};

export const createVehicleEntry = async (data) => {
    try {
        const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
        const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
        const response = await axiosInstance.post(`${GATE_API_BASE}/vehicle-entries/`, data, config);
        return response.data;
    } catch (error) {
        console.error('Error creating vehicle entry:', error);
        throw error;
    }
};

export const deleteVehicleEntry = async (id) => {
    try {
        const response = await axiosInstance.delete(`${GATE_API_BASE}/vehicle-entries/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting vehicle entry ${id}:`, error);
        throw error;
    }
};

export const markExitVehicleEntry = async (id, payload = {}) => {
    try {
        let data = payload;
        let config = {};
        if (typeof FormData !== 'undefined' && payload instanceof FormData) {
            config.headers = { 'Content-Type': 'multipart/form-data' };
        } else if (payload && (payload.delivery_note_photo instanceof File || payload.delivery_note_photo instanceof Blob)) {
            const formData = new FormData();
            Object.keys(payload).forEach(key => {
                if (payload[key] !== null && payload[key] !== undefined) {
                    formData.append(key, payload[key]);
                }
            });
            data = formData;
            config.headers = { 'Content-Type': 'multipart/form-data' };
        }
        const response = await axiosInstance.post(`${GATE_API_BASE}/vehicle-entries/${id}/mark_exit/`, data, config);
        return response.data;
    } catch (error) {
        console.error(`Error marking exit for vehicle entry ${id}:`, error);
        throw error;
    }
};

export const getLiveGateStatusReport = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${GATE_API_BASE}/gate-entries/live_status_report/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching live gate status report:', error);
        throw error;
    }
};

export const scanFastPassVehicle = async (payload) => {
    try {
        let data = payload;
        let config = {};
        if (typeof FormData !== 'undefined' && payload instanceof FormData) {
            config.headers = { 'Content-Type': 'multipart/form-data' };
        } else if (payload && (payload.delivery_note_photo instanceof File || payload.delivery_note_photo instanceof Blob)) {
            const formData = new FormData();
            Object.keys(payload).forEach(key => {
                if (payload[key] !== null && payload[key] !== undefined) {
                    formData.append(key, payload[key]);
                }
            });
            data = formData;
            config.headers = { 'Content-Type': 'multipart/form-data' };
        }
        const response = await axiosInstance.post(`${GATE_API_BASE}/vehicle-entries/fast-pass-scan/`, data, config);
        return response.data;
    } catch (error) {
        console.error('Error scanning fast-pass vehicle:', error);
        throw error;
    }
};

export const getFastPassStatus = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${GATE_API_BASE}/vehicle-entries/fast-pass-status/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching fast-pass status:', error);
        throw error;
    }
};

export const scanEmployeeGateEntry = async (payload) => {
    try {
        const response = await axiosInstance.post(`${GATE_API_BASE}/employee-entries/scan/`, payload);
        return response.data;
    } catch (error) {
        console.error('Error scanning employee gate entry:', error);
        throw error;
    }
};

export const checkoutEmployeeGateEntry = async (id, payload) => {
    try {
        const response = await axiosInstance.post(`${GATE_API_BASE}/employee-entries/${id}/checkout/`, payload);
        return response.data;
    } catch (error) {
        console.error(`Error checking out employee gate entry ${id}:`, error);
        throw error;
    }
};

export const lookupEmployeeGateEntry = async (employmentNo) => {
    try {
        const response = await axiosInstance.get(`${GATE_API_BASE}/employee-entries/lookup/`, {
            params: { employment_no: employmentNo }
        });
        return response.data;
    } catch (error) {
        console.error('Error looking up employee gate entry:', error);
        throw error;
    }
};

export const getEmployeeGateEntries = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${GATE_API_BASE}/employee-entries/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching employee gate entries:', error);
        throw error;
    }
};

export const deleteEmployeeGateEntry = async (id) => {
    try {
        const response = await axiosInstance.delete(`${GATE_API_BASE}/employee-entries/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting employee gate entry ${id}:`, error);
        throw error;
    }
};

export const scanEmployeeFaceGateEntry = async (payload) => {
    try {
        const config = (payload instanceof FormData)
            ? { headers: { 'Content-Type': 'multipart/form-data' } }
            : {};
        const response = await axiosInstance.post(`${GATE_API_BASE}/employee-entries/face-scan/`, payload, config);
        return response.data;
    } catch (error) {
        console.error('Error in face recognition employee gate entry:', error);
        throw error;
    }
};

export const enrollEmployeeFace = async (payload) => {
    try {
        const config = (payload instanceof FormData)
            ? { headers: { 'Content-Type': 'multipart/form-data' } }
            : {};
        const response = await axiosInstance.post(`${GATE_API_BASE}/employee-entries/enroll-face/`, payload, config);
        return response.data;
    } catch (error) {
        console.error('Error enrolling employee face data:', error);
        throw error;
    }
};

export const getEnrolledEmployees = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${GATE_API_BASE}/employee-entries/enrolled-employees/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching enrolled employees:', error);
        throw error;
    }
};


export const markVehicleExit = markExitVehicleEntry;

// ==========================================
// APPROVELESS ENTRY CONFIGURATIONS
// ==========================================

export const getApprovelessConfigs = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${GATE_API_BASE}/approveless-configs/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching approveless configs:', error);
        throw error;
    }
};

export const createApprovelessConfig = async (data) => {
    try {
        const response = await axiosInstance.post(`${GATE_API_BASE}/approveless-configs/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating approveless config:', error);
        throw error;
    }
};

export const updateApprovelessConfig = async (id, data) => {
    try {
        const response = await axiosInstance.patch(`${GATE_API_BASE}/approveless-configs/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating approveless config ${id}:`, error);
        throw error;
    }
};

export const deleteApprovelessConfig = async (id) => {
    try {
        const response = await axiosInstance.delete(`${GATE_API_BASE}/approveless-configs/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting approveless config ${id}:`, error);
        throw error;
    }
};

export const toggleApprovelessConfig = async (id) => {
    try {
        const response = await axiosInstance.patch(`${GATE_API_BASE}/approveless-configs/${id}/toggle_active/`);
        return response.data;
    } catch (error) {
        console.error(`Error toggling approveless config ${id}:`, error);
        throw error;
    }
};

export const checkApprovelessStatus = async (employeeId, departmentId = null) => {
    try {
        const params = { employee_id: employeeId };
        if (departmentId) params.department_id = departmentId;
        const response = await axiosInstance.get(`${GATE_API_BASE}/approveless-configs/check/`, { params });
        return response.data;
    } catch (error) {
        console.error(`Error checking approveless status for employee ${employeeId}:`, error);
        return { is_approveless_allowed: false };
    }
};

// ==================== EQUIPMENTS / TOOLS APIS ====================

export const getEquipments = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${GATE_API_BASE}/equipments/`, { params });
        return response.data;
    } catch (error) {
        console.error("Error fetching equipments:", error);
        throw error;
    }
};

export const createEquipment = async (data) => {
    try {
        const isFormData = data instanceof FormData;
        const response = await axiosInstance.post(
            `${GATE_API_BASE}/equipments/`,
            data,
            isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
        );
        return response.data;
    } catch (error) {
        console.error("Error creating equipment:", error);
        throw error;
    }
};

export const updateEquipment = async (id, data) => {
    try {
        const isFormData = data instanceof FormData;
        const response = await axiosInstance.patch(
            `${GATE_API_BASE}/equipments/${id}/`,
            data,
            isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
        );
        return response.data;
    } catch (error) {
        console.error(`Error updating equipment ${id}:`, error);
        throw error;
    }
};

export const deleteEquipment = async (id) => {
    try {
        const response = await axiosInstance.delete(`${GATE_API_BASE}/equipments/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting equipment ${id}:`, error);
        throw error;
    }
};

export const toggleEquipmentActive = async (id) => {
    try {
        const response = await axiosInstance.patch(`${GATE_API_BASE}/equipments/${id}/toggle_active/`);
        return response.data;
    } catch (error) {
        console.error(`Error toggling equipment active ${id}:`, error);
        throw error;
    }
};

const GateManagementService = {
    scanEmployeeGateEntry,
    checkoutEmployeeGateEntry,
    scanEmployeeFaceGateEntry,
    enrollEmployeeFace,
    getEnrolledEmployees,
    lookupEmployeeGateEntry,
    getEmployeeGateEntries,
    deleteEmployeeGateEntry,
    getLiveGateStatusReport,
    getGates,
    createGate,
    updateGate,
    deleteGate,
    getGateCategories,
    createGateCategory,
    updateGateCategory,
    deleteGateCategory,
    getGateSubCategories,
    createGateSubCategory,
    updateGateSubCategory,
    deleteGateSubCategory,
    getEntryTags,
    createEntryTag,
    updateEntryTag,
    deleteEntryTag,
    getGeneratedTags,
    getVisitors,
    createVisitor,
    updateVisitor,
    deleteVisitor,
    searchVisitorByMobile,
    searchVisitors,

    // Gate Entries
    getGateEntries,
    createGateEntry,
    updateGateEntry,
    deleteGateEntry,
    markExitGateEntry,
    resumeGateEntry,
    checkUnclosedGateEntry,
    approveGateEntry,
    rejectGateEntry,
    getMyPendingApprovals,

    // Reallocations
    getAllocatedVisitors,
    reallocateVisitor,
    completeVisitorMovement,
    getReallocationHistory,
    getMyPendingReallocations,
    respondReallocation,
    cancelReallocation,

    // Vehicles
    getVehicleTypes,
    createVehicleType,
    updateVehicleType,
    deleteVehicleType,
    getVehicles,
    searchVehicleByNumber,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    getVehicleEntries,
    getVehicleEntry,
    createVehicleEntry,
    deleteVehicleEntry,
    markExitVehicleEntry,
    markVehicleExit,
    scanFastPassVehicle,
    getFastPassStatus,

    // Approveless Entry
    getApprovelessConfigs,
    createApprovelessConfig,
    updateApprovelessConfig,
    deleteApprovelessConfig,
    toggleApprovelessConfig,
    checkApprovelessStatus,

    // Equipments / Tools
    getEquipments,
    createEquipment,
    updateEquipment,
    deleteEquipment,
    toggleEquipmentActive
};

export default GateManagementService;

// ==================== PARK AREA ====================
export const getParkAreas = async (params = {}) => {
    const response = await axiosInstance.get(`${GATE_API_BASE}/park-areas/`, { params });
    return response.data;
};

export const getMainParkAreas = async (params = {}) => {
    const response = await axiosInstance.get(`${GATE_API_BASE}/park-areas/`, { params: { ...params, is_main_area: 'true' } });
    return response.data;
};

export const createParkArea = async (data) => {
    const response = await axiosInstance.post(`${GATE_API_BASE}/park-areas/`, data);
    return response.data;
};

export const updateParkArea = async (id, data) => {
    const response = await axiosInstance.put(`${GATE_API_BASE}/park-areas/${id}/`, data);
    return response.data;
};

export const deleteParkArea = async (id) => {
    const response = await axiosInstance.delete(`${GATE_API_BASE}/park-areas/${id}/`);
    return response.data;
};

export const getParkAreaSlots = async (id) => {
    const response = await axiosInstance.get(`${GATE_API_BASE}/park-areas/${id}/slots/`);
    return response.data;
};

// ==================== PARKING FEE MASTER APIS ====================
export const getParkingFees = async (params = {}) => {
    const response = await axiosInstance.get(`${GATE_API_BASE}/parking-fees/`, { params });
    return response.data;
};

export const createParkingFee = async (data) => {
    const response = await axiosInstance.post(`${GATE_API_BASE}/parking-fees/`, data);
    return response.data;
};

export const updateParkingFee = async (id, data) => {
    const response = await axiosInstance.put(`${GATE_API_BASE}/parking-fees/${id}/`, data);
    return response.data;
};

export const deleteParkingFee = async (id) => {
    const response = await axiosInstance.delete(`${GATE_API_BASE}/parking-fees/${id}/`);
    return response.data;
};

// ==================== EMPLOYEE VEHICLE APIS ====================
export const getEmployeeVehicleDirectory = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${GATE_API_BASE}/vehicles/employee-directory/`, { params });
        return response.data;
    } catch (error) {
        console.error("Error fetching employee vehicle directory:", error);
        throw error;
    }
};

export const getVehiclesByEmployee = async (employeeId) => {
    try {
        const response = await axiosInstance.get(`${GATE_API_BASE}/vehicles/`, { params: { employee: employeeId } });
        return response.data?.results || response.data || [];
    } catch (error) {
        console.error(`Error fetching vehicles for employee ${employeeId}:`, error);
        throw error;
    }
};

export const setVehicleAsPreferred = async (vehicleId, payload = {}) => {
    try {
        const response = await axiosInstance.post(`${GATE_API_BASE}/vehicles/${vehicleId}/set-preferred/`, payload);
        return response.data;
    } catch (error) {
        console.error(`Error setting vehicle ${vehicleId} as preferred:`, error);
        throw error;
    }
};

export const createEmployeeVehicle = async (vehicleData) => {
    try {
        const isFormData = vehicleData instanceof FormData;
        const headers = isFormData ? { 'Content-Type': 'multipart/form-data' } : {};
        const response = await axiosInstance.post(`${GATE_API_BASE}/vehicles/`, vehicleData, { headers });
        return response.data;
    } catch (error) {
        console.error("Error creating employee vehicle:", error);
        throw error;
    }
};

export const updateEmployeeVehicle = async (vehicleId, vehicleData) => {
    try {
        const isFormData = vehicleData instanceof FormData;
        const headers = isFormData ? { 'Content-Type': 'multipart/form-data' } : {};
        const response = await axiosInstance.patch(`${GATE_API_BASE}/vehicles/${vehicleId}/`, vehicleData, { headers });
        return response.data;
    } catch (error) {
        console.error(`Error updating vehicle ${vehicleId}:`, error);
        throw error;
    }
};

export const deleteEmployeeVehicle = async (vehicleId) => {
    try {
        const response = await axiosInstance.delete(`${GATE_API_BASE}/vehicles/${vehicleId}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting vehicle ${vehicleId}:`, error);
        throw error;
    }
};

export const switchEmployeeGateEntryVehicle = async (entryId, payload) => {
    try {
        const response = await axiosInstance.post(`${GATE_API_BASE}/employee-entries/${entryId}/switch-vehicle/`, payload);
        return response.data;
    } catch (error) {
        console.error(`Error switching gate entry ${entryId} vehicle:`, error);
        throw error;
    }
};

