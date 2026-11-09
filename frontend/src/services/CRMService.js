import axiosInstance from './AxiosInstance';

const CRMService = {
    // --- Distribution Zones ---
    
    // Partner Leads
    getDistributorLeads: () => axiosInstance.get('/api/crm/distributor-leads/'),
    getVendorLeads: () => axiosInstance.get('/api/crm/vendor-leads/'),
    getDistributorLead: (id) => axiosInstance.get(`/api/crm/distributor-leads/${id}/`),
    getVendorLead: (id) => axiosInstance.get(`/api/crm/vendor-leads/${id}/`),
    deleteDistributorLead: (id) => axiosInstance.delete(`/api/crm/distributor-leads/${id}/`),
    deleteVendorLead: (id) => axiosInstance.delete(`/api/crm/vendor-leads/${id}/`),
    updateDistributorLead: (id, data) => axiosInstance.patch(`/api/crm/distributor-leads/${id}/`, data),
    updateVendorLead: (id, data) => axiosInstance.patch(`/api/crm/vendor-leads/${id}/`, data),

    // Services
    getServices: () => axiosInstance.get('/api/crm/services/'),
    getService: (id) => axiosInstance.get(`/api/crm/services/${id}/`),
    createService: (data) => axiosInstance.post('/api/crm/services/', data),
    updateService: (id, data) => axiosInstance.put(`/api/crm/services/${id}/`, data),
    deleteService: (id) => axiosInstance.delete(`/api/crm/services/${id}/`),

    // Offers (Master)
    getOffers: (params) => axiosInstance.get('/api/crm_new/offers/', { params }),
    getActiveOffers: () => axiosInstance.get('/api/crm_new/offers/active_offers/'),
    getOffer: (id) => axiosInstance.get(`/api/crm_new/offers/${id}/`),
    createOffer: (data) => axiosInstance.post('/api/crm_new/offers/', data),
    updateOffer: (id, data) => axiosInstance.put(`/api/crm_new/offers/${id}/`, data),
    deleteOffer: (id) => axiosInstance.delete(`/api/crm_new/offers/${id}/`),

    getDistributionZones: () => {
        return axiosInstance.get('/api/crm/distribution-zones/');
    },
    getDistributionZone: (id) => {
        return axiosInstance.get(`/api/crm/distribution-zones/${id}/`);
    },
    createDistributionZone: (data) => {
        return axiosInstance.post('/api/crm/distribution-zones/', data);
    },
    updateDistributionZone: (id, data) => {
        return axiosInstance.put(`/api/crm/distribution-zones/${id}/`, data);
    },
    deleteDistributionZone: (id) => {
        return axiosInstance.delete(`/api/crm/distribution-zones/${id}/`);
    }
};

export default CRMService;
