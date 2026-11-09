with open('backend/digilocker_app/serializers.py', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add 'uses_default_otp_email' to fields
target_fields = "'documents_count', 'mappings_count', 'latest_transfer', 'default_otp_email', 'phone_number'"
replacement_fields = "'documents_count', 'mappings_count', 'latest_transfer', 'default_otp_email', 'uses_default_otp_email', 'phone_number'"

if '\r\n' in text:
    target_fields = target_fields.replace('\n', '\r\n')
    replacement_fields = replacement_fields.replace('\n', '\r\n')

assert target_fields in text, "target_fields not found"
text = text.replace(target_fields, replacement_fields, 1)

# 2. Update get_current_owner_email to obey uses_default_otp_email
old_get_email = """    def get_current_owner_email(self, obj):
        # Return the folder's configured OTP recipient email, falling back to central default or owner's email
        from .views import get_central_default_otp_email
        if obj.default_otp_email and obj.default_otp_email.strip():
            return obj.default_otp_email.strip()
        central = get_central_default_otp_email()
        if central and central.strip():
            return central.strip()
        return self.get_owner_email(obj)"""

new_get_email = """    def get_current_owner_email(self, obj):
        # If uses_default_otp_email is True, always resolve dynamically from central default
        from .views import get_central_default_otp_email
        central = get_central_default_otp_email()
        if getattr(obj, 'uses_default_otp_email', True):
            if central and central.strip():
                return central.strip()
            if obj.default_otp_email and obj.default_otp_email.strip():
                return obj.default_otp_email.strip()
            return 'digilocker@rarenett.com'

        # If custom (uses_default_otp_email is False), use the individually saved folder OTP email
        if obj.default_otp_email and obj.default_otp_email.strip():
            return obj.default_otp_email.strip()
        if central and central.strip():
            return central.strip()
        return self.get_owner_email(obj)"""

if '\r\n' in text:
    old_get_email = old_get_email.replace('\n', '\r\n')
    new_get_email = new_get_email.replace('\n', '\r\n')

assert old_get_email in text, "old_get_email not found"
text = text.replace(old_get_email, new_get_email, 1)

with open('backend/digilocker_app/serializers.py', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Updated DigiLockerFolderSerializer successfully.")

