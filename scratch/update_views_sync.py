with open('backend/digilocker_app/views.py', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update perform_create in DigiLockerFolderViewSet to set uses_default_otp_email
old_create = """        default_email = (validated_data.get('default_otp_email') or self.request.data.get('default_otp_email') or get_central_default_otp_email() or 'digilocker@rarenett.com').strip()
        phone = (validated_data.get('phone_number') or self.request.data.get('phone_number') or '').strip()
        folder = serializer.save(
            created_by=user,
            owner=user if folder_type == 'personal' else None,
            folder_type=folder_type,
            default_otp_email=default_email,
            phone_number=phone
        )"""

new_create = """        central_email = (get_central_default_otp_email() or 'digilocker@rarenett.com').strip()
        input_email = (validated_data.get('default_otp_email') or self.request.data.get('default_otp_email') or '').strip()

        # If user did not provide an email, or provided exactly the central default email, mark uses_default_otp_email=True
        if not input_email or input_email.lower() == central_email.lower():
            uses_default = True
            effective_email = central_email
        else:
            uses_default = False
            effective_email = input_email

        phone = (validated_data.get('phone_number') or self.request.data.get('phone_number') or '').strip()
        folder = serializer.save(
            created_by=user,
            owner=user if folder_type == 'personal' else None,
            folder_type=folder_type,
            default_otp_email=effective_email,
            uses_default_otp_email=uses_default,
            phone_number=phone
        )"""

if '\r\n' in text:
    old_create = old_create.replace('\n', '\r\n')
    new_create = new_create.replace('\n', '\r\n')

assert old_create in text, "old_create not found"
text = text.replace(old_create, new_create, 1)

# 2. Update perform_update in DigiLockerFolderViewSet
old_update = """        validated_email = serializer.validated_data.get('default_otp_email') or self.request.data.get('default_otp_email')
        if validated_email:
            serializer.validated_data['default_otp_email'] = validated_email.strip()"""

new_update = """        central_email = (get_central_default_otp_email() or 'digilocker@rarenett.com').strip()
        validated_email = serializer.validated_data.get('default_otp_email') or self.request.data.get('default_otp_email')
        if validated_email is not None:
            email_val = validated_email.strip()
            serializer.validated_data['default_otp_email'] = email_val
            if not email_val or email_val.lower() == central_email.lower():
                serializer.validated_data['uses_default_otp_email'] = True
            else:
                serializer.validated_data['uses_default_otp_email'] = False"""

if '\r\n' in text:
    old_update = old_update.replace('\n', '\r\n')
    new_update = new_update.replace('\n', '\r\n')

assert old_update in text, "old_update not found"
text = text.replace(old_update, new_update, 1)

# 3. Update update_otp_email action to handle use_default_otp_email toggle
old_action = """        old_email = folder.default_otp_email or 'None'
        folder.default_otp_email = new_email
        folder.save(update_fields=['default_otp_email'])

        DigiLockerAuditLog.objects.create(
            actor=user,
            folder=folder,
            action='folder_updated',
            status='SUCCESS',
            details=f"Updated OTP recipient email for folder '{folder.name}' from '{old_email}' to '{new_email}'.",
            ip_address=get_client_ip(request)
        )"""

new_action = """        central_email = (get_central_default_otp_email() or 'digilocker@rarenett.com').strip()
        use_default = request.data.get('use_default_otp_email')
        if use_default is True or (isinstance(use_default, str) and use_default.lower() == 'true') or new_email.lower() == central_email.lower():
            folder.uses_default_otp_email = True
            folder.default_otp_email = central_email
            status_desc = f"Switched OTP email for folder '{folder.name}' to central default ({central_email})."
        else:
            folder.uses_default_otp_email = False
            folder.default_otp_email = new_email
            status_desc = f"Updated custom OTP email for folder '{folder.name}' from '{folder.default_otp_email}' to '{new_email}'."

        folder.save(update_fields=['default_otp_email', 'uses_default_otp_email'])

        DigiLockerAuditLog.objects.create(
            actor=user,
            folder=folder,
            action='folder_updated',
            status='SUCCESS',
            details=status_desc,
            ip_address=get_client_ip(request)
        )"""

if '\r\n' in text:
    old_action = old_action.replace('\n', '\r\n')
    new_action = new_action.replace('\n', '\r\n')

assert old_action in text, "old_action not found"
text = text.replace(old_action, new_action, 1)

# 4. Update DigiLockerRequestOTPView recipient_email resolution
old_otp_res = """        # ALWAYS send OTP to the configured Default OTP Email, NEVER to employee personal email
        folder_default_email = getattr(document.folder, 'default_otp_email', None)
        central_default_email = get_central_default_otp_email()
        recipient_email = (folder_default_email or central_default_email or 'digilocker@rarenett.com').strip()"""

new_otp_res = """        # ALWAYS send OTP to the effective OTP Email, NEVER to employee personal email
        central_default_email = (get_central_default_otp_email() or 'digilocker@rarenett.com').strip()
        if getattr(document.folder, 'uses_default_otp_email', True):
            recipient_email = central_default_email
        else:
            folder_custom_email = getattr(document.folder, 'default_otp_email', None)
            recipient_email = (folder_custom_email or central_default_email).strip()"""

if '\r\n' in text:
    old_otp_res = old_otp_res.replace('\n', '\r\n')
    new_otp_res = new_otp_res.replace('\n', '\r\n')

assert old_otp_res in text, "old_otp_res not found"
text = text.replace(old_otp_res, new_otp_res, 1)

with open('backend/digilocker_app/views.py', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Updated backend/digilocker_app/views.py successfully.")

