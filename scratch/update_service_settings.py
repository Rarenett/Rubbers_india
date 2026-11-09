with open('frontend/src/services/DigiLockerService.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = "    updateFolderOtpEmail: (id, data) => axiosInstance.post(`/api/digilocker/folders/${id}/update-otp-email/`, data),"
replacement = """    updateFolderOtpEmail: (id, data) => axiosInstance.post(`/api/digilocker/folders/${id}/update-otp-email/`, data),
    getSettings: () => axiosInstance.get('/api/digilocker/settings/'),"""

if '\r\n' in text:
    target = target.replace('\n', '\r\n')
    replacement = replacement.replace('\n', '\r\n')

assert target in text, "target not found"
text = text.replace(target, replacement, 1)

with open('frontend/src/services/DigiLockerService.js', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Updated DigiLockerService.js with getSettings successfully.")

