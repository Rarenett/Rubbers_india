import os

files = [
    'backend/digilocker_app/models.py',
    'backend/digilocker_app/serializers.py',
    'backend/digilocker_app/views.py',
    'frontend/src/jsx/components/DigiLocker/FolderMapping.jsx',
    'frontend/src/jsx/components/DigiLocker/DigiLockerAccess.jsx',
    'frontend/src/services/DigiLockerService.js'
]
for f in files:
    print(f, os.path.exists(f))

