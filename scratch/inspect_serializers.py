with open('backend/digilocker_app/serializers.py', 'r', encoding='utf-8') as f:
    text = f.read()

for line in text.splitlines():
    if 'DigiLockerFolderMapping' in line or 'can_view' in line or 'Mapping' in line:
        print(line)

