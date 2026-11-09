with open('backend/digilocker_app/views.py', 'r', encoding='utf-8') as f:
    text = f.read()

# 2. Update DigiLockerMappingViewSet.create
old_create = """        folder_ids = request.data.get('folder_ids', [])
        employee_id = request.data.get('employee') or request.data.get('employee_id')
        can_upload = request.data.get('can_upload', False)
        can_view = request.data.get('can_view', True)
        can_download = request.data.get('can_download', False)"""

new_create = """        folder_ids = request.data.get('folder_ids', [])
        employee_id = request.data.get('employee') or request.data.get('employee_id')
        can_upload = request.data.get('can_upload', False)
        can_view = request.data.get('can_view', True)
        view_otp_required = request.data.get('view_otp_required', True)
        can_download = request.data.get('can_download', False)
        download_otp_required = request.data.get('download_otp_required', True)"""

old_loop = """            # Determine granular permissions for this folder if provided
            if folder_permissions and str(f_id) in folder_permissions:
                f_perm = folder_permissions[str(f_id)]
                item_view = f_perm.get('can_view', can_view)
                item_upload = f_perm.get('can_upload', can_upload)
                item_download = f_perm.get('can_download', can_download)
            elif folder_permissions and f_id in folder_permissions:
                f_perm = folder_permissions[f_id]
                item_view = f_perm.get('can_view', can_view)
                item_upload = f_perm.get('can_upload', can_upload)
                item_download = f_perm.get('can_download', can_download)
            else:
                item_view = can_view
                item_upload = can_upload
                item_download = can_download

            mapping, created = DigiLockerFolderMapping.objects.update_or_create(
                folder=folder,
                employee=employee,
                defaults={
                    'can_upload': bool(item_upload),
                    'can_view': bool(item_view),
                    'can_download': bool(item_download),
                    'assigned_by': request.user,
                    'is_active': True
                }
            )

            if created:
                created_count += 1
            else:
                updated_count += 1

            DigiLockerAuditLog.objects.create(
                actor=request.user,
                target_employee=employee,
                folder=folder,
                action='mapping_created' if created else 'mapping_updated',
                status='SUCCESS',
                details=f"Mapped folder '{folder.name}' to employee '{employee}' (View: {item_view}, Upload: {item_upload}, Download: {item_download}).",
                ip_address=get_client_ip(request)
            )"""

new_loop = """            # Determine granular permissions for this folder if provided
            if folder_permissions and str(f_id) in folder_permissions:
                f_perm = folder_permissions[str(f_id)]
                item_view = f_perm.get('can_view', can_view)
                item_view_otp = f_perm.get('view_otp_required', view_otp_required)
                item_upload = f_perm.get('can_upload', can_upload)
                item_download = f_perm.get('can_download', can_download)
                item_download_otp = f_perm.get('download_otp_required', download_otp_required)
            elif folder_permissions and f_id in folder_permissions:
                f_perm = folder_permissions[f_id]
                item_view = f_perm.get('can_view', can_view)
                item_view_otp = f_perm.get('view_otp_required', view_otp_required)
                item_upload = f_perm.get('can_upload', can_upload)
                item_download = f_perm.get('can_download', can_download)
                item_download_otp = f_perm.get('download_otp_required', download_otp_required)
            else:
                item_view = can_view
                item_view_otp = view_otp_required
                item_upload = can_upload
                item_download = can_download
                item_download_otp = download_otp_required

            mapping, created = DigiLockerFolderMapping.objects.update_or_create(
                folder=folder,
                employee=employee,
                defaults={
                    'can_upload': bool(item_upload),
                    'can_view': bool(item_view),
                    'view_otp_required': bool(item_view_otp) if item_view else True,
                    'can_download': bool(item_download),
                    'download_otp_required': bool(item_download_otp) if item_download else True,
                    'assigned_by': request.user,
                    'is_active': True
                }
            )

            if created:
                created_count += 1
            else:
                updated_count += 1

            DigiLockerAuditLog.objects.create(
                actor=request.user,
                target_employee=employee,
                folder=folder,
                action='mapping_created' if created else 'mapping_updated',
                status='SUCCESS',
                details=f"Mapped folder '{folder.name}' to employee '{employee}' (View: {item_view} [OTP: {item_view_otp}], Upload: {item_upload}, Download: {item_download} [OTP: {item_download_otp}]).",
                ip_address=get_client_ip(request)
            )"""

if '\r\n' in text:
    old_create = old_create.replace('\n', '\r\n')
    new_create = new_create.replace('\n', '\r\n')
    old_loop = old_loop.replace('\n', '\r\n')
    new_loop = new_loop.replace('\n', '\r\n')

assert old_create in text, "old_create not found"
text = text.replace(old_create, new_create, 1)

assert old_loop in text, "old_loop not found"
text = text.replace(old_loop, new_loop, 1)

with open('backend/digilocker_app/views.py', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Step 2 (DigiLockerMappingViewSet.create) updated successfully.")

