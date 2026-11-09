with open('backend/digilocker_app/views.py', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update has_mapping_permission function after has_file_approval_permission
old_fn = """def has_file_approval_permission(user):
    \"\"\"
    Check if user is a designated administrator or has the File Approval menu permission.
    \"\"\"
    if is_user_admin(user):
        return True
    try:
        from register_app.permissions_utils import get_user_permissions
        user_perms = get_user_permissions(user)
        if user_perms.get('digilocker_approval', {}).get('view', False):
            return True
    except Exception:
        pass
    return False"""

new_fn = """def has_file_approval_permission(user):
    \"\"\"
    Check if user is a designated administrator or has the File Approval menu permission.
    \"\"\"
    if is_user_admin(user):
        return True
    try:
        from register_app.permissions_utils import get_user_permissions
        user_perms = get_user_permissions(user)
        if user_perms.get('digilocker_approval', {}).get('view', False):
            return True
    except Exception:
        pass
    return False

def has_mapping_permission(user):
    \"\"\"
    Check if user is a designated administrator or has DigiLocker Mapping permission.
    \"\"\"
    if is_user_admin(user):
        return True
    try:
        from register_app.permissions_utils import get_user_permissions
        user_perms = get_user_permissions(user)
        if user_perms.get('digilocker_mapping', {}).get('view', False):
            return True
    except Exception:
        pass
    return False"""

assert old_fn in text, "old_fn not found"
text = text.replace(old_fn, new_fn, 1)

# 2. Update DigiLockerFolderViewSet.get_queryset:
# When listing folders for mapping or management by administrators/managers with mapping permission,
# return all active folders (both shared and personal folders)
old_folder_qs = """        elif not is_user_admin(user):
            # General listing: non-admin employees only see shared folders mapped to them (including nested subfolders) or personal folders
            emp = get_employee_for_user(user)
            if emp:\n                allowed_folder_ids = get_allowed_folder_ids_for_employee(emp)
                qs = qs.filter(Q(id__in=allowed_folder_ids) | Q(owner=user))
            else:
                qs = qs.filter(owner=user)"""

new_folder_qs = """        elif not has_mapping_permission(user):
            # General listing: non-admin employees without mapping permission only see shared folders mapped to them (including nested subfolders) or personal folders
            emp = get_employee_for_user(user)
            if emp:
                allowed_folder_ids = get_allowed_folder_ids_for_employee(emp)
                qs = qs.filter(Q(id__in=allowed_folder_ids) | Q(owner=user))
            else:
                qs = qs.filter(owner=user)"""

assert old_folder_qs in text, "old_folder_qs not found"
text = text.replace(old_folder_qs, new_folder_qs, 1)

# 3. Update DigiLockerMappingViewSet permissions and queryset:
# Allow users with has_mapping_permission(user) to view all mappings and manage mappings
old_mapping_qs = """    def get_queryset(self):
        user = self.request.user
        qs = DigiLockerFolderMapping.objects.filter(is_active=True, folder__is_active=True)

        if not is_user_admin(user):
            emp = get_employee_for_user(user)
            if emp:
                qs = qs.filter(employee=emp)
            else:
                return qs.none()"""

new_mapping_qs = """    def get_queryset(self):
        user = self.request.user
        qs = DigiLockerFolderMapping.objects.filter(is_active=True, folder__is_active=True)

        if not has_mapping_permission(user):
            emp = get_employee_for_user(user)
            if emp:
                qs = qs.filter(employee=emp)
            else:
                return qs.none()"""

assert old_mapping_qs in text, "old_mapping_qs not found"
text = text.replace(old_mapping_qs, new_mapping_qs, 1)

old_mapping_perform_update = """    def perform_update(self, serializer):
        if not is_user_admin(self.request.user):
            raise permissions.PermissionDenied("Only administrators can modify folder mappings.")
        serializer.save()"""

new_mapping_perform_update = """    def perform_update(self, serializer):
        if not has_mapping_permission(self.request.user):
            raise permissions.PermissionDenied("Only administrators can modify folder mappings.")
        serializer.save()"""

assert old_mapping_perform_update in text, "old_mapping_perform_update not found"
text = text.replace(old_mapping_perform_update, new_mapping_perform_update, 1)

old_mapping_create = """    def create(self, request, *args, **kwargs):
        if not is_user_admin(request.user):
            return Response({"error": "Only administrators can map folders to employees."}, status=status.HTTP_403_FORBIDDEN)"""

new_mapping_create = """    def create(self, request, *args, **kwargs):
        if not has_mapping_permission(request.user):
            return Response({"error": "Only administrators can map folders to employees."}, status=status.HTTP_403_FORBIDDEN)"""

assert old_mapping_create in text, "old_mapping_create not found"
text = text.replace(old_mapping_create, new_mapping_create, 1)

old_mapping_destroy = """    def destroy(self, request, *args, **kwargs):
        if not is_user_admin(request.user):
            return Response({"error": "Only administrators can remove folder mappings."}, status=status.HTTP_403_FORBIDDEN)"""

new_mapping_destroy = """    def destroy(self, request, *args, **kwargs):
        if not has_mapping_permission(request.user):
            return Response({"error": "Only administrators can remove folder mappings."}, status=status.HTTP_403_FORBIDDEN)"""

assert old_mapping_destroy in text, "old_mapping_destroy not found"
text = text.replace(old_mapping_destroy, new_mapping_destroy, 1)

with open('backend/digilocker_app/views.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("views.py updated successfully for personal folder mapping.")

