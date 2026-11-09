with open('frontend/src/services/DigiLockerService.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_docs = """    // Documents
    getDocuments: (params = {}) => axiosInstance.get('/api/digilocker/documents/', { params }),
    uploadDocuments: (formData) => axiosInstance.post('/api/digilocker/documents/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    updateDocument: (id, data) => axiosInstance.patch(`/api/digilocker/documents/${id}/`, data),
    deleteDocument: (id) => axiosInstance.delete(`/api/digilocker/documents/${id}/`),"""

new_docs = """    // Documents
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

    // Edit Approval Requests (Admin & Employee)
    getEditRequests: (params = {}) => axiosInstance.get('/api/digilocker/edit-requests/', { params }),
    approveEditRequest: (id) => axiosInstance.post(`/api/digilocker/edit-requests/${id}/approve/`),
    rejectEditRequest: (id, data) => axiosInstance.post(`/api/digilocker/edit-requests/${id}/reject/`),"""

assert old_docs in text, "old_docs not found"
text = text.replace(old_docs, new_docs, 1)

with open('frontend/src/services/DigiLockerService.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("DigiLockerService.js updated successfully.")

