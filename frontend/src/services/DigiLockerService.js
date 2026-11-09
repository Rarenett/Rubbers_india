import axiosInstance from './AxiosInstance';

const DigiLockerService = {
    // Folders
    getFolders: (params = {}) => axiosInstance.get('/api/digilocker/folders/', { params }),
    createFolder: (data) => axiosInstance.post('/api/digilocker/folders/', data),
    updateFolder: (id, data) => axiosInstance.patch(`/api/digilocker/folders/${id}/`, data),
    deleteFolder: (id) => axiosInstance.delete(`/api/digilocker/folders/${id}/`),

    // Mappings
    getMappings: (params = {}) => axiosInstance.get('/api/digilocker/mappings/', { params }),
    createMapping: (data) => axiosInstance.post('/api/digilocker/mappings/', data),
    updateMapping: (id, data) => axiosInstance.patch(`/api/digilocker/mappings/${id}/`, data),
    deleteMapping: (id, params = {}) => axiosInstance.delete(`/api/digilocker/mappings/${id}/`, { params }),

    // Documents
    getDocuments: (params = {}) => axiosInstance.get('/api/digilocker/documents/', { params }),
    uploadDocuments: (formData) => axiosInstance.post('/api/digilocker/documents/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    updateDocument: (id, data) => axiosInstance.patch(`/api/digilocker/documents/${id}/`, data),
    deleteDocument: (id) => axiosInstance.delete(`/api/digilocker/documents/${id}/`),
    requestEditApproval: (id, data) => axiosInstance.post(`/api/digilocker/documents/${id}/request-edit/`, data),
    getDocumentApprovalHistory: (id) => axiosInstance.get(`/api/digilocker/documents/${id}/approval-history/`),

    // Admin File Approvals
    getFileApprovals: (params = {}) => axiosInstance.get('/api/digilocker/approvals/', { params }),
    approveFile: (id) => axiosInstance.post(`/api/digilocker/approvals/${id}/approve/`),
    rejectFile: (id, data) => axiosInstance.post(`/api/digilocker/approvals/${id}/reject/`, data),
    setFilePending: (id, data = {}) => axiosInstance.post(`/api/digilocker/approvals/${id}/set-pending/`, data),

    // Edit Approval Requests (Admin & Employee)
    getEditRequests: (params = {}) => axiosInstance.get('/api/digilocker/edit-requests/', { params }),
    approveEditRequest: (id) => axiosInstance.post(`/api/digilocker/edit-requests/${id}/approve/`),
    rejectEditRequest: (id, data) => axiosInstance.post(`/api/digilocker/edit-requests/${id}/reject/`),

    // Access & OTP
    getAccessData: (params = {}) => axiosInstance.get('/api/digilocker/access/', { params }),
    requestOtp: (data) => axiosInstance.post('/api/digilocker/access/request-otp/', data),
    verifyOtp: (data) => axiosInstance.post('/api/digilocker/access/verify-otp/', data),

    // Reports / Audit logs
    getReports: (params = {}) => axiosInstance.get('/api/digilocker/reports/', { params }),
    getFilesViewReport: (params = {}) => axiosInstance.get('/api/digilocker/reports/files-view/', { params }),
    getFileDownloadReport: (params = {}) => axiosInstance.get('/api/digilocker/reports/file-download/', { params }),

    // Binary Blob fetch helpers for preview & download
    previewDocumentBlob: (url) => axiosInstance.get(url, { responseType: 'blob' }),
    downloadDocumentBlob: (url) => axiosInstance.get(url, { responseType: 'blob' }),

    // Employees & Departments helpers
    getDepartments: () => axiosInstance.get('/api/hr/departments/'),
    getEmployees: (params = {}) => axiosInstance.get('/api/hr/employees/', { params }),

    // Ownership Transfer
    transferFolderOwnership: (id, data) => axiosInstance.post(`/api/digilocker/folders/${id}/transfer-ownership/`, data),
    getFolderOwnershipHistory: (id) => axiosInstance.get(`/api/digilocker/folders/${id}/ownership-history/`),
    getAllOwnershipTransfers: (params = {}) => axiosInstance.get('/api/digilocker/folders/ownership-transfers/', { params }),
    updateFolderOtpEmail: (id, data) => axiosInstance.post(`/api/digilocker/folders/${id}/update-otp-email/`, data),
    getSettings: () => axiosInstance.get('/api/digilocker/settings/'),
};

export default DigiLockerService;
