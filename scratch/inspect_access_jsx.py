with open('frontend/src/jsx/components/DigiLocker/DigiLockerAccess.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer('request-otp|verify-otp|handlePreview|handleDownload', text)]
for idx in matches:
    print("---")
    print(text[max(0, idx-50):min(len(text), idx+200)].replace('\n', ' '))

