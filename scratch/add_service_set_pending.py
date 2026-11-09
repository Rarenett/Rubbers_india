with open('frontend/src/services/DigiLockerService.js', 'r', encoding='utf-8') as f:
    content = f.read()

target = "rejectFile: (id, data) => axiosInstance.post(`/api/digilocker/approvals/${id}/reject/`, data),"
replacement = """rejectFile: (id, data) => axiosInstance.post(`/api/digilocker/approvals/${id}/reject/`, data),
    setFilePending: (id, data = {}) => axiosInstance.post(`/api/digilocker/approvals/${id}/set-pending/`, data),"""

assert target in content, "target not found in DigiLockerService.js"
content = content.replace(target, replacement, 1)

with open('frontend/src/services/DigiLockerService.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully added setFilePending to DigiLockerService.js!")

