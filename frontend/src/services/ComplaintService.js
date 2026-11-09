import axiosInstance from './AxiosInstance';

const ComplaintService = {
    // Categories
    getCategories: () => axiosInstance.get(`/api/complaints/categories/`),
    createCategory: (data) => axiosInstance.post(`/api/complaints/categories/`, data),
    updateCategory: (id, data) => axiosInstance.put(`/api/complaints/categories/${id}/`, data),
    deleteCategory: (id) => axiosInstance.delete(`/api/complaints/categories/${id}/`),


    // Patterns
    getPatterns: (params = {}) => axiosInstance.get(`/api/complaints/patterns/`, { params }),
    createPattern: (data) => axiosInstance.post(`/api/complaints/patterns/`, data),
    updatePattern: (id, data) => axiosInstance.put(`/api/complaints/patterns/${id}/`, data),
    deletePattern: (id) => axiosInstance.delete(`/api/complaints/patterns/${id}/`),

    // Complaints
    getComplaints: (params = {}) => axiosInstance.get(`/api/complaints/complaints/`, { 
        params: params 
    }),
    getNextComplaintId: () => axiosInstance.get(`/api/complaints/complaints/next_id/`),
    getDueReminder: () => axiosInstance.get(`/api/complaints/complaints/due_reminder/`),
    getComplaint: (id, params = {}) => axiosInstance.get(`/api/complaints/complaints/${id}/`, { params }),
    createComplaint: (data) => {
        // AxiosInstance will handle the Authorization header.
        // For FormData, we let the browser set the Content-Type automatically.
        return axiosInstance.post(`/api/complaints/complaints/`, data);
    },
    updateComplaint: (id, data, params = {}) => axiosInstance.patch(`/api/complaints/complaints/${id}/`, data, { params }),
    deleteComplaint: (id) => axiosInstance.delete(`/api/complaints/complaints/${id}/`),
    
    // Actions & Stats
    addUpdate: (id, data) => {
         return axiosInstance.post(`/api/complaints/complaints/${id}/add_update/`, data);
    },
    getStatistics: () => axiosInstance.get(`/api/complaints/complaints/statistics/`),
    submitDecision: (id, data) => {
        // multipart/form-data for attachments
        return axiosInstance.post(`/api/complaints/complaints/${id}/submit_decision/`, data, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    setAdminDecision: (id, adminDecision, adminRemarks = '', params = {}) => axiosInstance.post(`/api/complaints/complaints/${id}/set_admin_decision/`, { admin_decision: adminDecision, admin_remarks: adminRemarks }, { params }),

    // HR Integration for Patterns
    getDepartments: () => axiosInstance.get(`/api/hr/departments/`),
    getDesignations: () => axiosInstance.get(`/api/hr/designations/`),
    getDepartmentDesignations: () => axiosInstance.get(`/api/hr/department-designations/`),
    getEmployees: () => axiosInstance.get(`/api/hr/employees/`),
    getBoardOfDirectors: () => axiosInstance.get(`/api/hr/bod/`),
};

export default ComplaintService;