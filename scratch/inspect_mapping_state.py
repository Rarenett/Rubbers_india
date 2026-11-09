with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

import re
funcs = [
    'formData',
    'handleBulkPermChange',
    'handleGranularPermChange',
    'handleOpenModal',
    'handleEdit',
    'handleSubmit',
    'fetchMappings',
    'folderPermsMap'
]

for func in funcs:
    matches = [m.start() for m in re.finditer(func, text)]
    print(f"=== {func} ({len(matches)} occurrences) ===")
    for idx in matches[:3]:
        snippet = text[max(0, idx-100):min(len(text), idx+200)]
        print("---")
        print(snippet.replace('\n', ' '))

