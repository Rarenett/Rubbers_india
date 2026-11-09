with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'Default Document Permissions' in line:
        for j in range(max(0, i-5), min(len(lines), i+80)):
            print(f"{j+1}: {lines[j]}", end='')
        break

