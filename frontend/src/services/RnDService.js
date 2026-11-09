import axiosInstance from './AxiosInstance';

export const RnDService = {
    // List Post Production entries with R&D status (supports from_date, to_date, status, search, page)
    getPostProductionRnDEntries: (params = '') => axiosInstance.get(`/api/rd/entries/post-production-entries/${params}`),

    // Standard CRUD for RnDEntry
    getRnDEntries: (params = '') => axiosInstance.get(`/api/rd/entries/${params}`),
    getRnDEntry: (id) => axiosInstance.get(`/api/rd/entries/${id}/`),
    createRnDEntry: (data) => axiosInstance.post('/api/rd/entries/', data),
    updateRnDEntry: (id, data) => axiosInstance.put(`/api/rd/entries/${id}/`, data),
    patchRnDEntry: (id, data) => axiosInstance.patch(`/api/rd/entries/${id}/`, data),
    // Extra Quantities (Balance Alternate tracking)
    getExtraQuantities: (params = '') => axiosInstance.get(`/api/rd/extra-quantities/${params}`),
    getExtraQuantity: (id) => axiosInstance.get(`/api/rd/extra-quantities/${id}/`),
    createExtraQuantity: (data) => axiosInstance.post('/api/rd/extra-quantities/', data),
    updateExtraQuantity: (id, data) => axiosInstance.put(`/api/rd/extra-quantities/${id}/`, data),
    deleteExtraQuantity: (id) => axiosInstance.delete(`/api/rd/extra-quantities/${id}/`),
};

export default RnDService;
