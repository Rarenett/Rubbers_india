with open('backend/digilocker_app/views.py', 'r', encoding='utf-8') as f:
    text = f.read()

import re
keywords = [
    'DigiLockerRequestOTPView',
    'DigiLockerPreviewDocumentView',
    'DigiLockerDownloadDocumentView',
    'DigiLockerFolderMappingViewSet',
    'can_view',
    'can_download'
]

for kw in keywords:
    matches = [m.start() for m in re.finditer(kw, text)]
    print(f"=== {kw} ({len(matches)} occurrences) ===")
    for idx in matches[:2]:
        line_num = text[:idx].count('\n') + 1
        snippet = text[max(0, idx-50):min(len(text), idx+150)]
        print(f"Line {line_num}: {snippet.replace(chr(10), ' ')}")

