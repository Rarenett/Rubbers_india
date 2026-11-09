import axiosInstance from './AxiosInstance';

const LogisticsService = {
    getVehicleCategories: () =>
        axiosInstance.get('/api/logistics/vehicle-categories/'),

    getVehicleCategory: (id) =>
        axiosInstance.get(`/api/logistics/vehicle-categories/${id}/`),

    createVehicleCategory: (data) =>
        axiosInstance.post('/api/logistics/vehicle-categories/', data),

    updateVehicleCategory: (id, data) =>
        axiosInstance.put(`/api/logistics/vehicle-categories/${id}/`, data),

    patchVehicleCategory: (id, data) =>
        axiosInstance.patch(`/api/logistics/vehicle-categories/${id}/`, data),

    deleteVehicleCategory: (id) =>
        axiosInstance.delete(`/api/logistics/vehicle-categories/${id}/`),


    getVehicles: () =>
        axiosInstance.get('/api/logistics/vehicles/'),

    getVehicle: (id) =>
        axiosInstance.get(`/api/logistics/vehicles/${id}/`),

    createVehicle: (data) =>
        axiosInstance.post(
            '/api/logistics/vehicles/',
            data,
            {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            }
        ),

    updateVehicle: (id, data) =>
        axiosInstance.put(
            `/api/logistics/vehicles/${id}/`,
            data,
            {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            }
        ),

    patchVehicle: (id, data) =>
        axiosInstance.patch(
            `/api/logistics/vehicles/${id}/`,
            data,
            {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            }
        ),

    deleteVehicle: (id) =>
        axiosInstance.delete(`/api/logistics/vehicles/${id}/`),

        // Drivers
   
    getDrivers: () =>
        axiosInstance.get('/api/logistics/drivers/'),

    getDriver: (id) =>
        axiosInstance.get(`/api/logistics/drivers/${id}/`),

    createDriver: (data) =>
        axiosInstance.post(
            '/api/logistics/drivers/',
            data,
            {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            }
        ),

    updateDriver: (id, data) =>
        axiosInstance.put(
            `/api/logistics/drivers/${id}/`,
            data,
            {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            }
        ),
    

    //Service Types 

    deleteDriver: (id) =>
        axiosInstance.delete(`/api/logistics/drivers/${id}/`),


    getServiceTypes: () =>
        axiosInstance.get('/api/logistics/service-types/'),
 
    getServiceType: (id) =>
        axiosInstance.get(`/api/logistics/service-types/${id}/`),
 
    createServiceType: (data) =>
        axiosInstance.post('/api/logistics/service-types/', data),
 
    updateServiceType: (id, data) =>
        axiosInstance.put(`/api/logistics/service-types/${id}/`, data),
 
    patchServiceType: (id, data) =>
        axiosInstance.patch(`/api/logistics/service-types/${id}/`, data),
 
    deleteServiceType: (id) =>
        axiosInstance.delete(`/api/logistics/service-types/${id}/`),

     //  Vehicle History 
    getVehicleHistories:   (params) => axiosInstance.get('/api/logistics/vehicle-history/', { params }),
    getVehicleHistory:     (id)     => axiosInstance.get(`/api/logistics/vehicle-history/${id}/`),
    createVehicleHistory:  (data)   => axiosInstance.post('/api/logistics/vehicle-history/', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    updateVehicleHistory:  (id, d)  => axiosInstance.put(`/api/logistics/vehicle-history/${id}/`, d, { headers: { 'Content-Type': 'multipart/form-data' } }),
    patchVehicleHistory:   (id, d)  => axiosInstance.patch(`/api/logistics/vehicle-history/${id}/`, d),
    deleteVehicleHistory:  (id)     => axiosInstance.delete(`/api/logistics/vehicle-history/${id}/`),

    

    getVehicleHistoryNextNo: () =>axiosInstance.get('/api/logistics/vehicle-history-next-no/'),

    getVehicleLookup: (id) => axiosInstance.get(`/api/logistics/vehicle-lookup/${id}/`),

    getDriverAuditLogs: () =>axiosInstance.get('/api/logistics/driver-audit-log/'),
    getVehicleAuditLogs: () => axiosInstance.get('/api/logistics/vehicle-audit-log/'),
    // In LogisticsService
    getVehicleHistoryAuditLogs: () => axiosInstance.get('/api/logistics/vehicle-history-audit-log/'),

    // Fines And Tokens
    getFines: () => axiosInstance.get('/api/logistics/fines/'),
    getFine: (id) => axiosInstance.get(`/api/logistics/fines/${id}/`),
    createFine: (data) => axiosInstance.post('/api/logistics/fines/', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    updateFine: (id, data) => axiosInstance.put(`/api/logistics/fines/${id}/`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    patchFine: (id, data) => axiosInstance.patch(`/api/logistics/fines/${id}/`, data),
    deleteFine: (id) => axiosInstance.delete(`/api/logistics/fines/${id}/`),
    // Driver Journeys
    getJourneys: (params) => axiosInstance.get('/api/logistics/journeys/', { params }),
    getJourney: (id) => axiosInstance.get(`/api/logistics/journeys/${id}/`),
    createJourney: (data) => axiosInstance.post('/api/logistics/journeys/', data),
    patchJourney: (id, data) => axiosInstance.patch(`/api/logistics/journeys/${id}/`, data),
    deleteJourney: (id) => axiosInstance.delete(`/api/logistics/journeys/${id}/`),

    // Demo Table
    getDemoTableFields: () => axiosInstance.get('/api/logistics/demo-table-fields/'),
    getDemoTableConfiguration: () => axiosInstance.get('/api/logistics/demo-table-configuration/'),
    updateDemoTableConfiguration: (id, data) => axiosInstance.put(`/api/logistics/demo-table-configuration/${id}/`, data),
    
    getDemoTables: () => axiosInstance.get('/api/logistics/demo-table/'),
    createDemoTable: (data) => axiosInstance.post('/api/logistics/demo-table/', data),
    updateDemoTable: (id, data) => axiosInstance.put(`/api/logistics/demo-table/${id}/`, data),
    deleteDemoTable: (id) => axiosInstance.delete(`/api/logistics/demo-table/${id}/`),
    
    // Driver Routes
    getRoutes: (params) => axiosInstance.get('/api/logistics/routes/', { params }),
    patchRoute: (id, data) => axiosInstance.patch(`/api/logistics/routes/${id}/`, data),
    changeRoute: (data) => axiosInstance.post('/api/logistics/routes/', data),

    // Service Requests
    getServiceRequests: (params) => axiosInstance.get('/api/logistics/service-requests/', { params }),
    getServiceRequest: (id) => axiosInstance.get(`/api/logistics/service-requests/${id}/`),
    createServiceRequest: (data) => axiosInstance.post('/api/logistics/service-requests/', data),
    patchServiceRequest: (id, data) => axiosInstance.patch(`/api/logistics/service-requests/${id}/`, data),
    deleteServiceRequest: (id) => axiosInstance.delete(`/api/logistics/service-requests/${id}/`),
    // --- Route Masters ---
    getRouteMasters: () => {
        return axiosInstance.get('/api/logistics/route-masters/');
    },
    createRouteMaster: (data) => {
        return axiosInstance.post('/api/logistics/route-masters/', data);
    },
    patchRouteMaster: (id, data) => {
        return axiosInstance.patch(`/api/logistics/route-masters/${id}/`, data);
    },
    deleteRouteMaster: (id) => {
        return axiosInstance.delete(`/api/logistics/route-masters/${id}/`);
    },

    // --- Trip Masters ---
    getTripMasters: () => {
        return axiosInstance.get('/api/logistics/trip-masters/');
    },
    createTripMaster: (data) => {
        return axiosInstance.post('/api/logistics/trip-masters/', data);
    },
    patchTripMaster: (id, data) => {
        return axiosInstance.patch(`/api/logistics/trip-masters/${id}/`, data);
    },
    deleteTripMaster: (id) => {
        return axiosInstance.delete(`/api/logistics/trip-masters/${id}/`);
    },
    // --- Package Types ---
    getPackageTypes: () => {
        return axiosInstance.get('/api/logistics/package-types/');
    },
    getPackageType: (id) => {
        return axiosInstance.get(`/api/logistics/package-types/${id}/`);
    },
    createPackageType: (data) => {
        return axiosInstance.post('/api/logistics/package-types/', data);
    },
    patchPackageType: (id, data) => {
        return axiosInstance.patch(`/api/logistics/package-types/${id}/`, data);
    },
    putPackageType: (id, data) => {
        return axiosInstance.put(`/api/logistics/package-types/${id}/`, data);
    },
    deletePackageType: (id) => {
        return axiosInstance.delete(`/api/logistics/package-types/${id}/`);
    },
    // --- Item Specifications ---
    getItemSpecifications: () => {
        return axiosInstance.get('/api/logistics/item-specifications/');
    },
    getItemSpecification: (id) => {
        return axiosInstance.get(`/api/logistics/item-specifications/${id}/`);
    },
    createItemSpecification: (data) => {
        return axiosInstance.post('/api/logistics/item-specifications/', data);
    },
    updateItemSpecification: (id, data) => {
        return axiosInstance.put(`/api/logistics/item-specifications/${id}/`, data);
    },
    deleteItemSpecification: (id) => {
        return axiosInstance.delete(`/api/logistics/item-specifications/${id}/`);
    },
    // --- Route Stop Masters ---
    getRouteStopMasters: () => {
        return axiosInstance.get('/api/logistics/route-stop-masters/');
    },
    getRouteStopMaster: (id) => {
        return axiosInstance.get(`/api/logistics/route-stop-masters/${id}/`);
    },
    createRouteStopMaster: (data) => {
        return axiosInstance.post('/api/logistics/route-stop-masters/', data);
    },
    updateRouteStopMaster: (id, data) => {
        return axiosInstance.put(`/api/logistics/route-stop-masters/${id}/`, data);
    },
    deleteRouteStopMaster: (id) => {
        return axiosInstance.delete(`/api/logistics/route-stop-masters/${id}/`);
    },
};

export default LogisticsService;