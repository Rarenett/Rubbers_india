import axiosInstance from './AxiosInstance';

/**
 * Machine / Equipment Management Service
 * Handles API calls for machinery and spare parts
 */

const MACHINE_API_BASE = '/api/machine';

// ─── Spare Parts ───────────────────────────────────────────────────────────────

export const getSpareParts = async () => {
    try {
        const response = await axiosInstance.get(`${MACHINE_API_BASE}/spareparts/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching spare parts:', error);
        throw error;
    }
};

export const createSparePart = async (sparePartData) => {
    try {
        const response = await axiosInstance.post(`${MACHINE_API_BASE}/spareparts/`, sparePartData);
        return response.data;
    } catch (error) {
        console.error('Error creating spare part:', error);
        throw error;
    }
};

export const updateSparePart = async (id, sparePartData) => {
    try {
        const response = await axiosInstance.put(`${MACHINE_API_BASE}/spareparts/${id}/`, sparePartData);
        return response.data;
    } catch (error) {
        console.error(`Error updating spare part ${id}:`, error);
        throw error;
    }
};

export const deleteSparePart = async (id) => {
    try {
        const response = await axiosInstance.delete(`${MACHINE_API_BASE}/spareparts/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting spare part ${id}:`, error);
        throw error;
    }
};

export const deleteSparePartImage = async (sparePartId, imageId) => {
    try {
        const response = await axiosInstance.post(`${MACHINE_API_BASE}/spareparts/${sparePartId}/delete-image/`, {
            image_id: imageId
        });
        return response.data;
    } catch (error) {
        console.error(`Error deleting spare part image ${imageId}:`, error);
        throw error;
    }
};

// ─── Lifespans ─────────────────────────────────────────────────────────────────

export const getLifespans = async () => {
    try {
        const response = await axiosInstance.get(`${MACHINE_API_BASE}/lifespans/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching lifespans:', error);
        throw error;
    }
};

export const createLifespan = async (lifespanData) => {
    try {
        const response = await axiosInstance.post(`${MACHINE_API_BASE}/lifespans/`, lifespanData);
        return response.data;
    } catch (error) {
        console.error('Error creating lifespan:', error);
        throw error;
    }
};

export const updateLifespan = async (id, lifespanData) => {
    try {
        const response = await axiosInstance.put(`${MACHINE_API_BASE}/lifespans/${id}/`, lifespanData);
        return response.data;
    } catch (error) {
        console.error(`Error updating lifespan ${id}:`, error);
        throw error;
    }
};

export const deleteLifespan = async (id) => {
    try {
        const response = await axiosInstance.delete(`${MACHINE_API_BASE}/lifespans/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting lifespan ${id}:`, error);
        throw error;
    }
};

// ─── TypeName ──────────────────────────────────────────────────────────────────

export const getTypeNames = async () => {
    try {
        const response = await axiosInstance.get(`${MACHINE_API_BASE}/typename/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching type names:', error);
        throw error;
    }
};

export const createTypeName = async (data) => {
    try {
        const response = await axiosInstance.post(`${MACHINE_API_BASE}/typename/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating type name:', error);
        throw error;
    }
};

export const updateTypeName = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${MACHINE_API_BASE}/typename/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating type name ${id}:`, error);
        throw error;
    }
};

export const deleteTypeName = async (id) => {
    try {
        const response = await axiosInstance.delete(`${MACHINE_API_BASE}/typename/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting type name ${id}:`, error);
        throw error;
    }
};

// ─── CategoryName ──────────────────────────────────────────────────────────────

export const getCategoryNames = async () => {
    try {
        const response = await axiosInstance.get(`${MACHINE_API_BASE}/categoryname/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching category names:', error);
        throw error;
    }
};

export const createCategoryName = async (data) => {
    try {
        const response = await axiosInstance.post(`${MACHINE_API_BASE}/categoryname/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating category name:', error);
        throw error;
    }
};

export const updateCategoryName = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${MACHINE_API_BASE}/categoryname/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating category name ${id}:`, error);
        throw error;
    }
};

export const deleteCategoryName = async (id) => {
    try {
        const response = await axiosInstance.delete(`${MACHINE_API_BASE}/categoryname/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting category name ${id}:`, error);
        throw error;
    }
};

// ─── SubCategoryName ───────────────────────────────────────────────────────────

export const getSubCategoryNames = async () => {
    try {
        const response = await axiosInstance.get(`${MACHINE_API_BASE}/subcategoryname/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching sub category names:', error);
        throw error;
    }
};

export const createSubCategoryName = async (data) => {
    try {
        const response = await axiosInstance.post(`${MACHINE_API_BASE}/subcategoryname/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating sub category name:', error);
        throw error;
    }
};

export const updateSubCategoryName = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${MACHINE_API_BASE}/subcategoryname/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating sub category name ${id}:`, error);
        throw error;
    }
};

export const deleteSubCategoryName = async (id) => {
    try {
        const response = await axiosInstance.delete(`${MACHINE_API_BASE}/subcategoryname/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting sub category name ${id}:`, error);
        throw error;
    }
};

// ─── ProcessName ───────────────────────────────────────────────────────────────

export const getProcessNames = async () => {
    try {
        const response = await axiosInstance.get(`${MACHINE_API_BASE}/processname/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching process names:', error);
        throw error;
    }
};

export const createProcessName = async (data) => {
    try {
        const response = await axiosInstance.post(`${MACHINE_API_BASE}/processname/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating process name:', error);
        throw error;
    }
};

export const updateProcessName = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${MACHINE_API_BASE}/processname/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating process name ${id}:`, error);
        throw error;
    }
};

export const deleteProcessName = async (id) => {
    try {
        const response = await axiosInstance.delete(`${MACHINE_API_BASE}/processname/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting process name ${id}:`, error);
        throw error;
    }
};

// ─── Machine Data Collection ───────────────────────────────────────────────────

export const getMachineDataCollections = async () => {
    try {
        const response = await axiosInstance.get(`${MACHINE_API_BASE}/machinedatacollections/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching machine data collections:', error);
        throw error;
    }
};

export const createMachineDataCollection = async (data) => {
    try {
        const response = await axiosInstance.post(`${MACHINE_API_BASE}/machinedatacollections/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating machine data collection:', error);
        throw error;
    }
};

export const updateMachineDataCollection = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${MACHINE_API_BASE}/machinedatacollections/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating machine data collection ${id}:`, error);
        throw error;
    }
};

export const deleteMachineDataCollection = async (id) => {
    try {
        const response = await axiosInstance.delete(`${MACHINE_API_BASE}/machinedatacollections/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting machine data collection ${id}:`, error);
        throw error;
    }
};

// ─── Repair Request ───────────────────────────────────────────────────────────

export const getRepairRequests = async () => {
    try {
        const response = await axiosInstance.get(`${MACHINE_API_BASE}/repairrequests/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching repair requests:', error);
        throw error;
    }
};
export const getAllMachineDataCollectionConfigurations = async () => {
    try {
        const response = await axiosInstance.get(`${MACHINE_API_BASE}/machine-data-configuration/all_configs/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching all configurations:', error);
        throw error;
    }
};

export const createRepairRequest = async (data) => {
    try {
        const response = await axiosInstance.post(`${MACHINE_API_BASE}/repairrequests/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating repair request:', error);
        throw error;
    }
};
export const getMachineDataCollectionFields = async () => {
    try {
        const response = await axiosInstance.get(`${MACHINE_API_BASE}/machine-data-fields/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching machine data collection fields:', error);
        throw error;
    }
};

export const updateRepairRequest = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${MACHINE_API_BASE}/repairrequests/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating repair request ${id}:`, error);
        throw error;
    }
};
export const getMachineDataCollectionConfiguration = async (stockItemId = null) => {
    try {
        const url = stockItemId 
            ? `${MACHINE_API_BASE}/machine-data-configuration/?stock_item_id=${stockItemId}`
            : `${MACHINE_API_BASE}/machine-data-configuration/`;
        const response = await axiosInstance.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching machine data collection configuration:', error);
        throw error;
    }
};

export const deleteRepairRequest = async (id) => {
    try {
        const response = await axiosInstance.delete(`${MACHINE_API_BASE}/repairrequests/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting repair request ${id}:`, error);
        throw error;
    }
};
export const updateMachineDataCollectionConfiguration = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${MACHINE_API_BASE}/machine-data-configuration/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error('Error updating machine data collection configuration:', error);
        throw error;
    }
};

export const deleteRepairRequestImage = async (requestId, imageId) => {
    try {
        const response = await axiosInstance.post(`${MACHINE_API_BASE}/repairrequests/${requestId}/delete-image/`, {
            image_id: imageId
        });
        return response.data;
    } catch (error) {
        console.error(`Error deleting repair request image ${imageId}:`, error);
        throw error;
    }
};

export const getReceivedRepairRequests = async () => {
    try {
        const response = await axiosInstance.get(`${MACHINE_API_BASE}/repairrequests/received/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching received repair requests:', error);
        throw error;
    }
};

export const updateRepairRequestStatus = async (id, status, remarks = '') => {
    try {
        const response = await axiosInstance.post(`${MACHINE_API_BASE}/repairrequests/${id}/update-status/`, {
            status,
            remarks
        });
        return response.data;
    } catch (error) {
        console.error(`Error updating repair request status for ${id}:`, error);
        throw error;
    }
};

export const submitRepairRequestDecision = async (id, formData) => {
    try {
        const response = await axiosInstance.post(`${MACHINE_API_BASE}/repairrequests/${id}/submit-decision/`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error submitting repair request decision for ${id}:`, error);
        throw error;
    }
};

export const adminUpdateRepairRequestStatus = async (id, status, decision_notes = null) => {
    try {
        const payload = { status };
        if (decision_notes) payload.decision_notes = decision_notes;
        const response = await axiosInstance.post(`${MACHINE_API_BASE}/repairrequests/${id}/admin-update-status/`, payload);
        return response.data;
    } catch (error) {
        console.error(`Error admin-updating repair request status for ${id}:`, error);
        throw error;
    }
};

// ─── Machine Product Mapping ───────────────────────────────────────────────────────────

export const getMachineProductMappings = async () => {
    try {
        const response = await axiosInstance.get(`${MACHINE_API_BASE}/machineproductmappings/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching machine product mappings:', error);
        throw error;
    }
};

export const createMachineProductMapping = async (data) => {
    try {
        const response = await axiosInstance.post(`${MACHINE_API_BASE}/machineproductmappings/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating machine product mapping:', error);
        throw error;
    }
};

export const deleteMachineProductMapping = async (id) => {
    try {
        const response = await axiosInstance.delete(`${MACHINE_API_BASE}/machineproductmappings/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting machine product mapping ${id}:`, error);
        throw error;
    }
};

// ─── Machine Output ───────────────────────────────────────────────────────────

export const getMachineOutputs = async () => {
    try {
        const response = await axiosInstance.get(`${MACHINE_API_BASE}/machineoutputs/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching machine outputs:', error);
        throw error;
    }
};

export const createMachineOutput = async (data) => {
    try {
        const response = await axiosInstance.post(`${MACHINE_API_BASE}/machineoutputs/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating machine output:', error);
        throw error;
    }
};

export const updateMachineOutput = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${MACHINE_API_BASE}/machineoutputs/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating machine output ${id}:`, error);
        throw error;
    }
};

export const deleteMachineOutput = async (id) => {
    try {
        const response = await axiosInstance.delete(`${MACHINE_API_BASE}/machineoutputs/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting machine output ${id}:`, error);
        throw error;
    }
};

// ─── Repair Part ────────────────────────────────────────────────────────────────

export const getRepairParts = async () => {
    try {
        const response = await axiosInstance.get(`${MACHINE_API_BASE}/repair-parts/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching repair parts:', error);
        throw error;
    }
};

export const createRepairPart = async (data) => {
    try {
        const response = await axiosInstance.post(`${MACHINE_API_BASE}/repair-parts/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating repair part:', error);
        throw error;
    }
};

export const updateRepairPart = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${MACHINE_API_BASE}/repair-parts/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating repair part ${id}:`, error);
        throw error;
    }
};

export const deleteRepairPart = async (id) => {
    try {
        const response = await axiosInstance.delete(`${MACHINE_API_BASE}/repair-parts/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting repair part ${id}:`, error);
        throw error;
    }
};

export const getEmployeesByDepartment = async (departmentId, patternType = '') => {
    try {
        const response = await axiosInstance.get(`${MACHINE_API_BASE}/repair-parts/employees-by-department/`, {
            params: { department_id: departmentId, pattern_type: patternType }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching employees for department ${departmentId}:`, error);
        throw error;
    }
};

export const getBoardOfDirectors = async () => {
    try {
        const response = await axiosInstance.get(`/api/hr/bod/`);
        return response.data?.results || response.data || [];
    } catch (error) {
        console.error('Error fetching Board of Directors:', error);
        return [];
    }
};