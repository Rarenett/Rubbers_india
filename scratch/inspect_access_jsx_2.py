with open('frontend/src/jsx/components/DigiLocker/DigiLockerAccess.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer('otp|download|preview', text, re.IGNORECASE)]
print(f"Total matches: {len(matches)}")
for idx in matches[:10]:
    print("---")
    print(text[max(0, idx-30):min(len(text), idx+100)].replace('\n', ' '))

