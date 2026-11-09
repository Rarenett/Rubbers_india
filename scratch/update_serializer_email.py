with open('backend/digilocker_app/serializers.py', 'r', encoding='utf-8') as f:
    text = f.read()

old_func = """    def get_current_owner_email(self, obj):
        return self.get_owner_email(obj)"""

new_func = """    def get_current_owner_email(self, obj):
        # Return the folder's configured OTP recipient email, falling back to central default or owner's email
        from .views import get_central_default_otp_email
        if obj.default_otp_email and obj.default_otp_email.strip():
            return obj.default_otp_email.strip()
        central = get_central_default_otp_email()
        if central and central.strip():
            return central.strip()
        return self.get_owner_email(obj)"""

if '\r\n' in text:
    old_func = old_func.replace('\n', '\r\n')
    new_func = new_func.replace('\n', '\r\n')

assert old_func in text, "old_func not found"
text = text.replace(old_func, new_func, 1)

with open('backend/digilocker_app/serializers.py', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Updated serializers.py get_current_owner_email successfully.")

