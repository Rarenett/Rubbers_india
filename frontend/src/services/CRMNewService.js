import axiosInstance from './AxiosInstance';

// ==========================================
// CRM New - Lead Sources APIs
// ==========================================
export const getSources = (params) => axiosInstance.get('/api/crm_new/sources/', { params });
export const getSource = (id) => axiosInstance.get(`/api/crm_new/sources/${id}/`);
export const createSource = (data) => axiosInstance.post('/api/crm_new/sources/', data);
export const updateSource = (id, data) => axiosInstance.put(`/api/crm_new/sources/${id}/`, data);
export const patchSource = (id, data) => axiosInstance.patch(`/api/crm_new/sources/${id}/`, data);
export const deleteSource = (id) => axiosInstance.delete(`/api/crm_new/sources/${id}/`);

// Aliases for Lead Sources
export const getLeadSources = getSources;
export const getLeadSource = getSource;
export const createLeadSource = createSource;
export const updateLeadSource = updateSource;
export const patchLeadSource = patchSource;
export const deleteLeadSource = deleteSource;

// ==========================================
// CRM New - Services APIs
// ==========================================
export const getServices = (params) => axiosInstance.get('/api/crm_new/services/', { params });
export const getService = (id) => axiosInstance.get(`/api/crm_new/services/${id}/`);
export const createService = (data) => axiosInstance.post('/api/crm_new/services/', data);
export const updateService = (id, data) => axiosInstance.put(`/api/crm_new/services/${id}/`, data);
export const patchService = (id, data) => axiosInstance.patch(`/api/crm_new/services/${id}/`, data);
export const deleteService = (id) => axiosInstance.delete(`/api/crm_new/services/${id}/`);

// Aliases for CRM Services
export const getCrmServices = getServices;
export const getCrmService = getService;
export const createCrmService = createService;
export const updateCrmService = updateService;
export const patchCrmService = patchService;
export const deleteCrmService = deleteService;

// ==========================================
// CRM New - Lead Categories APIs
// ==========================================
export const getCategories = (params) => axiosInstance.get('/api/crm_new/categories/', { params });
export const getCategory = (id) => axiosInstance.get(`/api/crm_new/categories/${id}/`);
export const createCategory = (data) => axiosInstance.post('/api/crm_new/categories/', data);
export const updateCategory = (id, data) => axiosInstance.put(`/api/crm_new/categories/${id}/`, data);
export const patchCategory = (id, data) => axiosInstance.patch(`/api/crm_new/categories/${id}/`, data);
export const deleteCategory = (id) => axiosInstance.delete(`/api/crm_new/categories/${id}/`);

// Aliases for Lead Categories
export const getLeadCategories = getCategories;
export const getLeadCategory = getCategory;
export const createLeadCategory = createCategory;
export const updateLeadCategory = updateCategory;
export const patchLeadCategory = patchCategory;
export const deleteLeadCategory = deleteCategory;

// ==========================================
// CRM New - Industries APIs
// ==========================================
export const getIndustries = (params) => axiosInstance.get('/api/crm_new/industries/', { params });
export const getIndustry = (id) => axiosInstance.get(`/api/crm_new/industries/${id}/`);
export const createIndustry = (data) => axiosInstance.post('/api/crm_new/industries/', data);
export const updateIndustry = (id, data) => axiosInstance.put(`/api/crm_new/industries/${id}/`, data);
export const patchIndustry = (id, data) => axiosInstance.patch(`/api/crm_new/industries/${id}/`, data);
export const deleteIndustry = (id) => axiosInstance.delete(`/api/crm_new/industries/${id}/`);

// Aliases for Industries
export const getLeadIndustries = getIndustries;
export const getLeadIndustry = getIndustry;
export const createLeadIndustry = createIndustry;
export const updateLeadIndustry = updateIndustry;
export const patchLeadIndustry = patchIndustry;
export const deleteLeadIndustry = deleteIndustry;

// ==========================================
// CRM New - Leads APIs
// ==========================================
export const getLeads = (params) => axiosInstance.get('/api/crm_new/leads/', { params });
export const getLead = (id) => axiosInstance.get(`/api/crm_new/leads/${id}/`);
export const createLead = (data, isMultipart = false) => {
    const config = isMultipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    return axiosInstance.post('/api/crm_new/leads/', data, config);
};
export const updateLead = (id, data, isMultipart = false) => {
    const config = isMultipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    return axiosInstance.put(`/api/crm_new/leads/${id}/`, data, config);
};
export const patchLead = (id, data) => axiosInstance.patch(`/api/crm_new/leads/${id}/`, data);
export const deleteLead = (id) => axiosInstance.delete(`/api/crm_new/leads/${id}/`);
export const uploadLeadAttachments = (leadId, formData) =>
    axiosInstance.post(`/api/crm_new/leads/${leadId}/upload_attachments/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
export const deleteLeadAttachment = (leadId, attachmentId) =>
    axiosInstance.delete(`/api/crm_new/leads/${leadId}/delete_attachment/${attachmentId}/`);

export const uploadLeadImages = (leadId, formData) =>
    axiosInstance.post(`/api/crm_new/leads/${leadId}/upload_images/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
export const deleteLeadImage = (leadId, imageId) =>
    axiosInstance.delete(`/api/crm_new/leads/${leadId}/delete_image/${imageId}/`);

export const downloadLeadsTemplate = () =>
    axiosInstance.get('/api/crm_new/leads/download_template/', { responseType: 'blob' });

export const uploadLeadsExcel = (formData) =>
    axiosInstance.post('/api/crm_new/batches/upload_excel/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data);

export const getImportBatches = (params) =>
    axiosInstance.get('/api/crm_new/batches/', { params }).then(res => res.data);

export const getImportBatch = (id) =>
    axiosInstance.get(`/api/crm_new/batches/${id}/`).then(res => res.data);

export const revalidateImportBatch = (id) =>
    axiosInstance.post(`/api/crm_new/batches/${id}/revalidate/`).then(res => res.data);

export const pushImportBatch = (id, data = {}) =>
    axiosInstance.post(`/api/crm_new/batches/${id}/push/`, data).then(res => res.data);

export const cancelImportBatch = (id) =>
    axiosInstance.post(`/api/crm_new/batches/${id}/cancel/`).then(res => res.data);

export const cleanupImportBatches = () =>
    axiosInstance.post('/api/crm_new/batches/cleanup/').then(res => res.data);

export const patchStagingRow = (id, data) =>
    axiosInstance.patch(`/api/crm_new/staging-rows/${id}/`, data).then(res => res.data);

export const updateStagingRow = patchStagingRow;

export const previewLeadsExcel = (formData) =>
    uploadLeadsExcel(formData);

export const createMissingMasters = (data) =>
    axiosInstance.post('/api/crm_new/leads/create_missing_masters/', data).then(res => res.data);

export const confirmLeadsImport = (data) =>
    axiosInstance.post('/api/crm_new/leads/confirm_import/', data).then(res => res.data);

export const importLeadsExcel = (formData) =>
    uploadLeadsExcel(formData);

// Related helpers
export const getEmployees = (params) => axiosInstance.get('/api/hr/users/', { params });
export const getStockItems = async () => {
    try {
        const res = await axiosInstance.get('/api/inventory/stock-items/simple/');
        return res;
    } catch {
        return axiosInstance.get('/api/inventory/stock-items/');
    }
};

// Telecalling & Caller Lead Assignments
export const getMyCallerLeads = () =>
    axiosInstance.get('/api/crm_new/telecalling-assignments/my-leads/');

export const getTelecallingAssignments = (params) =>
    axiosInstance.get('/api/crm_new/telecalling-assignments/', { params });

export const assignIndividualLead = (data) =>
    axiosInstance.post('/api/crm_new/telecalling-teams/assign-individual/', data);

export const assignTeamLeads = (teamId, data) =>
    axiosInstance.post(`/api/crm_new/telecalling-teams/${teamId}/assign-leads/`, data);

export const createCallerCallLog = (data) =>
    axiosInstance.post('/api/crm_new/call-logs/', data);

export const getCallerCallLogs = (params) =>
    axiosInstance.get('/api/crm_new/call-logs/', { params });

export const getCallerReports = (params) =>
    axiosInstance.get('/api/crm_new/reports/call-logs/', { params });

export const getLeadsReport = (params) =>
    axiosInstance.get('/api/crm_new/reports/leads/', { params });

export const getConvertedLeadsReport = (params) =>
    axiosInstance.get('/api/crm_new/reports/converted-leads/', { params });



const CRMNewService = {
    // Lead Sources
    getSources,
    getSource,
    createSource,
    updateSource,
    patchSource,
    deleteSource,
    getLeadSources,
    getLeadSource,
    createLeadSource,
    updateLeadSource,
    patchLeadSource,
    deleteLeadSource,

    // CRM Services
    getServices,
    getService,
    createService,
    updateService,
    patchService,
    deleteService,
    getCrmServices,
    getCrmService,
    createCrmService,
    updateCrmService,
    patchCrmService,
    deleteCrmService,

    // Lead Categories
    getCategories,
    getCategory,
    createCategory,
    updateCategory,
    patchCategory,
    deleteCategory,
    getLeadCategories,
    getLeadCategory,
    createLeadCategory,
    updateLeadCategory,
    patchLeadCategory,
    deleteLeadCategory,

    // Industries
    getIndustries,
    getIndustry,
    createIndustry,
    updateIndustry,
    patchIndustry,
    deleteIndustry,
    getLeadIndustries,
    getLeadIndustry,
    createLeadIndustry,
    updateLeadIndustry,
    patchLeadIndustry,
    deleteLeadIndustry,

    // Leads
    getLeads,
    getLead,
    createLead,
    updateLead,
    patchLead,
    deleteLead,
    uploadLeadAttachments,
    deleteLeadAttachment,
    uploadLeadImages,
    deleteLeadImage,
    downloadLeadsTemplate,
    uploadLeadsExcel,
    getImportBatches,
    getImportBatch,
    revalidateImportBatch,
    pushImportBatch,
    cancelImportBatch,
    cleanupImportBatches,
    patchStagingRow,
    updateStagingRow,
    previewLeadsExcel,
    createMissingMasters,
    confirmLeadsImport,
    importLeadsExcel,
    getEmployees,
    getStockItems,

    // Telecalling & Caller Assignments
    getMyCallerLeads,
    getTelecallingAssignments,
    assignIndividualLead,
    assignTeamLeads,
    createCallerCallLog,
    getCallerCallLogs,
    getCallerReports,
    getLeadsReport,
    getConvertedLeadsReport,
};

export default CRMNewService;


