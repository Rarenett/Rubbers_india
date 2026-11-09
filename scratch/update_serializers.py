with open('backend/digilocker_app/serializers.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = "'can_upload', 'can_view', 'can_download',"
replacement = "'can_upload', 'can_view', 'view_otp_required', 'can_download', 'download_otp_required',"

assert target in text, f"{target} not found"
text = text.replace(target, replacement, 1)

with open('backend/digilocker_app/serializers.py', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Updated serializers.py successfully.")
