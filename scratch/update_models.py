with open('backend/digilocker_app/models.py', 'r', encoding='utf-8') as f:
    text = f.read()

old_part = "    can_upload = models.BooleanField(default=False)\n    can_view = models.BooleanField(default=True)\n    can_download = models.BooleanField(default=False)"
# If CRLF:
if old_part not in text:
    old_part = old_part.replace('\n', '\r\n')

new_part = """    can_upload = models.BooleanField(default=False)
    can_view = models.BooleanField(default=True)
    view_otp_required = models.BooleanField(default=True, help_text="Require OTP verification when viewing documents")
    can_download = models.BooleanField(default=False)
    download_otp_required = models.BooleanField(default=True, help_text="Require OTP verification when downloading documents")"""
if '\r\n' in old_part:
    new_part = new_part.replace('\n', '\r\n')

assert old_part in text, "old_part not found"
text = text.replace(old_part, new_part, 1)

with open('backend/digilocker_app/models.py', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Updated models.py successfully.")
