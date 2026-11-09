with open('frontend/src/jsx/components/DigiLocker/DigiLockerAccess.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer('const handleView|const handleDownload|initiateOtp', text)]
for idx in matches:
    print(text[idx:idx+1200])
    print("="*60)

