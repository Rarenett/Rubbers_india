with open('backend/digilocker_app/views.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Locate DigiLockerFolderViewSet.get_queryset
old_block = """        if is_user_admin(user) or has_mapping_permission(user):
            # Authorized administrators retain access to manage and view all folders
            pass
        elif for_upload:
            # In Upload Files, non-admin employees strictly only see folders actively mapped to them with upload permission.
            # Folder creators and owners receive NO automatic access without explicit mapping.
            emp = get_employee_for_user(user)
            if emp:
                allowed_folder_ids = get_allowed_folder_ids_for_employee(emp, need_upload=True)
                qs = qs.filter(id__in=allowed_folder_ids)
            else:
                qs = qs.none()
        else:
            # General listing (Folder Creation list): employees see folders created by/owned by them,
            # as well as folders actively mapped to them.
            emp = get_employee_for_user(user)
            mapped_ids = get_allowed_folder_ids_for_employee(emp) if emp else set()
            qs = qs.filter(
                Q(created_by=user) |
                Q(owner=user) |
                Q(id__in=mapped_ids)
            )"""

new_block = """        for_mapping = self.request.query_params.get('for_mapping') == 'true'

        if for_mapping:
            # Administrators and mapping managers need to view all active folders to map them
            if is_user_admin(user) or has_mapping_permission(user):
                pass
            else:
                qs = qs.none()
        elif for_upload:
            # In Upload Files, employees strictly only see folders actively mapped to them with upload permission.
            emp = get_employee_for_user(user)
            if emp:
                allowed_folder_ids = get_allowed_folder_ids_for_employee(emp, need_upload=True)
                qs = qs.filter(id__in=allowed_folder_ids)
            else:
                qs = qs.none()
        else:
            # Folder Creation list: EVERY user (including staff/employees) ONLY sees their own folders created by them (created_by=user or owner=user)
            # Only superusers/system administrators see all folders.
            if user.is_superuser:
                pass
            else:
                qs = qs.filter(Q(created_by=user) | Q(owner=user))"""

if old_block not in text and old_block.replace('\n', '\r\n') in text:
    old_block = old_block.replace('\n', '\r\n')
    new_block = new_block.replace('\n', '\r\n')

assert old_block in text, "old_block not found"
text = text.replace(old_block, new_block, 1)

with open('backend/digilocker_app/views.py', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Updated DigiLockerFolderViewSet.get_queryset successfully.")

