with open('backend/digilocker_app/views.py', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer('requires_otp', text)]
for idx in matches:
    print(text[max(0, idx-100):min(len(text), idx+300)])
    print("="*60)

