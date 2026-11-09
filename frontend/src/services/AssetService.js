import axiosInstance from './AxiosInstance';

const AssetService = {
    getDashboardStats: () => {
        return axiosInstance.get('/api/assets/dashboard/stats/');
    },
    getRecentAllocations: () => {
        return axiosInstance.get('/api/assets/dashboard/recent-allocations/');
    },
    getAssetSplit: () => {
        return axiosInstance.get('/api/assets/dashboard/asset-split/');
    },
    getAllocationTrend: () => {
        return axiosInstance.get('/api/assets/dashboard/allocation-trend/');
    },
    getRoomDistribution: () => {
        return axiosInstance.get('/api/assets/dashboard/room-distribution/');
    },
    getStorageRooms: () => {
        return axiosInstance.get('/api/assets/rooms/');
    },
    createRoom: (data) => axiosInstance.post('/api/assets/rooms/', data),
    updateRoom: (id, data) => axiosInstance.put(`/api/assets/rooms/${id}/`, data),
    deleteRoom: (id) => axiosInstance.delete(`/api/assets/rooms/${id}/`),
    createShelf: (data) => axiosInstance.post('/api/assets/shelves/', data),
    updateShelf: (id, data) => axiosInstance.put(`/api/assets/shelves/${id}/`, data),
    deleteShelf: (id) => axiosInstance.delete(`/api/assets/shelves/${id}/`),

    createRack: (data) => axiosInstance.post('/api/assets/racks/', data),
    updateRack: (id, data) => axiosInstance.put(`/api/assets/racks/${id}/`, data),
    deleteRack: (id) => axiosInstance.delete(`/api/assets/racks/${id}/`),

    createAssetType: (data) => axiosInstance.post('/api/assets/asset-types/', data),
    updateAssetType: (id, data) => axiosInstance.put(`/api/assets/asset-types/${id}/`, data),
    deleteAssetType: (id) => axiosInstance.delete(`/api/assets/asset-types/${id}/`),

    createFile: (data) => axiosInstance.post('/api/assets/files/', data),
    updateFile: (id, data) => axiosInstance.put(`/api/assets/files/${id}/`, data),
    deleteFile: (id) => axiosInstance.delete(`/api/assets/files/${id}/`),

    getShelves: () => axiosInstance.get('/api/assets/shelves/'),
    getRacks: () => axiosInstance.get('/api/assets/racks/'),
    getAssetTypes: () => axiosInstance.get('/api/assets/asset-types/'),
    getFiles: () => axiosInstance.get('/api/assets/files/'),
    getCompanies: () => axiosInstance.get('/api/hr/companies/'),

    // Allocation management
    getAllocations: () => axiosInstance.get('/api/assets/allocations/'),
    allocateFile: (data) => axiosInstance.post('/api/assets/allocations/allocate/', data),
    returnFile: (allocationId, data) => axiosInstance.post(`/api/assets/allocations/${allocationId}/return/`, data),
    reallocateFile: (allocationId, data) => axiosInstance.post(`/api/assets/allocations/${allocationId}/reallocate/`, data),
    updateAllocationResponse: (id, response) => axiosInstance.post(`/api/assets/allocations/${id}/response/`, { holder_response: response }),
    getAllocationReport: () => axiosInstance.get('/api/assets/allocations/report/'),

    // Key management
    getKeys: () => axiosInstance.get('/api/assets/keys/'),
    createKey: (data) => axiosInstance.post('/api/assets/keys/', data),
    updateKey: (id, data) => axiosInstance.put(`/api/assets/keys/${id}/`, data),
    deleteKey: (id) => axiosInstance.delete(`/api/assets/keys/${id}/`),

    // Key Allocation management
    getKeyAllocations: () => axiosInstance.get('/api/assets/key-allocations/'),
    allocateKey: (data) => axiosInstance.post('/api/assets/key-allocations/allocate/', data),
    returnKey: (allocationId, data) => axiosInstance.post(`/api/assets/key-allocations/${allocationId}/return/`, data),
    reallocateKey: (allocationId, data) => axiosInstance.post(`/api/assets/key-allocations/${allocationId}/reallocate/`, data),
    updateKeyAllocationResponse: (id, response) => axiosInstance.post(`/api/assets/key-allocations/${id}/response/`, { holder_response: response }),
    getKeyAllocationReport: () => axiosInstance.get('/api/assets/key-allocations/report/'),
    getFileHistory: (fileId) => axiosInstance.get(`/api/assets/files/${fileId}/history/`),
    getKeyHistory: (keyId) => axiosInstance.get(`/api/assets/keys/${keyId}/history/`),

    // IT Assets Management
    getITAssetCategories: () => axiosInstance.get('/api/assets/entities/categories/'),
    createITAssetCategory: (data) => axiosInstance.post('/api/assets/entities/categories/', data),
    updateITAssetCategory: (id, data) => axiosInstance.put(`/api/assets/entities/categories/${id}/`, data),
    deleteITAssetCategory: (id) => axiosInstance.delete(`/api/assets/entities/categories/${id}/`),

    getITAssets: () => axiosInstance.get('/api/assets/entities/assets/'),
    createITAsset: (data) => axiosInstance.post('/api/assets/entities/assets/', data),
    updateITAsset: (id, data) => axiosInstance.put(`/api/assets/entities/assets/${id}/`, data),
    deleteITAsset: (id) => axiosInstance.delete(`/api/assets/entities/assets/${id}/`),

    getITAssetAllocations: () => axiosInstance.get('/api/assets/entities/allocations/'),
    createITAssetAllocation: (data) => axiosInstance.post('/api/assets/entities/allocations/', data),
    updateITAssetAllocation: (id, data) => axiosInstance.put(`/api/assets/entities/allocations/${id}/`, data),
    deleteITAssetAllocation: (id) => axiosInstance.delete(`/api/assets/entities/allocations/${id}/`),
    returnITAsset: (id, data) => axiosInstance.post(`/api/assets/entities/allocations/${id}/return_asset/`, data),

    getITAssetAttributeDefinitions: () => axiosInstance.get('/api/assets/entities/attribute-definitions/'),
    createITAssetAttributeDefinition: (data) => axiosInstance.post('/api/assets/entities/attribute-definitions/', data),
    updateITAssetAttributeDefinition: (id, data) => axiosInstance.put(`/api/assets/entities/attribute-definitions/${id}/`, data),
    deleteITAssetAttributeDefinition: (id) => axiosInstance.delete(`/api/assets/entities/attribute-definitions/${id}/`),
    getITAssetAttributeValues: () => axiosInstance.get('/api/assets/entities/attribute-values/'),
    getITAssetDocuments: () => axiosInstance.get('/api/assets/entities/documents/'),
    createITAssetDocument: (data) => {
        return axiosInstance.post('/api/assets/entities/documents/', data, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    deleteITAssetDocument: (id) => axiosInstance.delete(`/api/assets/entities/documents/${id}/`),
    getITAssetMaintenances: () => axiosInstance.get('/api/assets/entities/maintenances/'),
    getITAssetTransfers: () => axiosInstance.get('/api/assets/entities/transfers/'),
};

export default AssetService;