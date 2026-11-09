with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

print("Length:", len(text))
print("Occurrences of can_view / permission / Default Document Permissions:")
for line in text.splitlines():
    if any(k in line for k in ['Default Document Permissions', 'can_view', 'can_download', 'can_upload', 'otp']):
        print(line[:120])

