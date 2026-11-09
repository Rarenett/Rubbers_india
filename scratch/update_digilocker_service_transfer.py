with open('frontend/src/services/DigiLockerService.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_folders = """    // Folders
    getFolders: (params = {}) => axiosInstance.get('/api/digilocker/folders/', { params }),
    createFolder: (data) => axiosInstance.post('/api/digilocker/folders/', data),
    updateFolder: (id, data) => axiosInstance.patch(`/api/digilocker/folders/${id}/`, data),
    deleteFolder: (id) => axiosInstance.delete(`/api/digilocker/folders/${id}/`),"""

new_folders = """    // Folders
    getFolders: (params = {}) => axiosInstance.get('/api/digilocker/folders/', { params }),
    createFolder: (data) => axiosInstance.post('/api/digilocker/folders/', data),
    updateFolder: (id, data) => axiosInstance.patch(`/api/digilocker/folders/${id}/`, data),
    deleteFolder: (id) => axiosInstance.delete(`/api/digilocker/folders/${id}/`),
    transferFolderOwnership: (id, data) => axiosInstance.post(`/api/digilocker/folders/${id}/transfer-ownership/`, data),
    getFolderOwnershipHistory: (id) => axiosInstance.get(`/api/digilocker/folders/${id}/ownership-history/`),
    getAllOwnershipTransfers: () => axiosInstance.get('/api/digilocker/folders/ownership-transfers/'),"""

assert old_folders in text, "old_folders not found"
text = text.replace(old_folders, new_folders, 1)

with open('frontend/src/services/DigiLockerService.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("DigiLockerService.js updated with ownership transfer methods.")

