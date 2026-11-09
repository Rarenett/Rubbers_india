file_path = r'C:\Users\ADMIN\Documents\GitHub\glenda_vite\frontend\src\jsx\components\AccessPoint\GateEntryForm.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove lines 2111-2123 (0-indexed: 2110-2122) — orphaned floating tab remnant
# Replace them with just a closing </div> and );
del lines[2110:2123]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f'Done. Lines: {len(lines)}')
print('Around removal area:')
for i, l in enumerate(lines[2106:2116], 2107):
    print(i, l.rstrip())
