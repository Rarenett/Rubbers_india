with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = "const res = await DigiLockerService.getFolders();"
replacement = "const res = await DigiLockerService.getFolders({ for_mapping: 'true' });"

assert target in text, "target not found"
text = text.replace(target, replacement, 1)

with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Updated DigiLockerMapping.jsx with for_mapping=true successfully.")

