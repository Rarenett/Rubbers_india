file_path = r'C:\Users\ADMIN\Documents\GitHub\glenda_vite\frontend\src\jsx\components\AccessPoint\GateEntryForm.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 2101 is index 2100
old = lines[2100]
print('Before:', repr(old))
lines[2100] = old.replace("top: '0px'", "top: '56px'")
print('After:', repr(lines[2100]))

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
