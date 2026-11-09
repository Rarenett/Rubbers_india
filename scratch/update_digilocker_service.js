const fs = require('fs');

let s = fs.readFileSync('frontend/src/services/DigiLockerService.js', 'utf8');

const target = `    // Ownership Transfer
    transferFolderOwnership: (id, data) => axiosInstance.post(\`/api/digilocker/folders/\${id}/transfer-ownership/\`, data),
    getFolderOwnershipHistory: (id) => axiosInstance.get(\`/api/digilocker/folders/\${id}/ownership-history/\`),
    getAllOwnershipTransfers: (params = {}) => axiosInstance.get('/api/digilocker/folders/ownership-transfers/', { params }),
};`;

const replacement = `    // Ownership Transfer
    transferFolderOwnership: (id, data) => axiosInstance.post(\`/api/digilocker/folders/\${id}/transfer-ownership/\`, data),
    getFolderOwnershipHistory: (id) => axiosInstance.get(\`/api/digilocker/folders/\${id}/ownership-history/\`),
    getAllOwnershipTransfers: (params = {}) => axiosInstance.get('/api/digilocker/folders/ownership-transfers/', { params }),

    // DigiLocker Settings (Default OTP Email)
    getSettings: () => axiosInstance.get('/api/digilocker/settings/'),
    updateSettings: (data) => axiosInstance.put('/api/digilocker/settings/', data),
};`;

s = s.replace(target, replacement);
fs.writeFileSync('frontend/src/services/DigiLockerService.js', s, 'utf8');
console.log('Successfully updated DigiLockerService.js with getSettings & updateSettings');

