with open('backend/digilocker_app/views.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Define has_file_approval_permission right after is_user_admin
old_is_admin = """def is_user_admin(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    if hasattr(user, 'role') and user.role and getattr(user.role, 'name', None):
        role_name = user.role.name.strip().lower()
        # Strictly admin/superadmin roles only (exclude HOD, Managers, Employees, Staff)
        if role_name in ['admin', 'super admin', 'superadmin', 'administrator']:
            return True
    return False"""

new_is_admin = """def is_user_admin(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    if hasattr(user, 'role') and user.role and getattr(user.role, 'name', None):
        role_name = user.role.name.strip().lower()
        # Strictly admin/superadmin roles only (exclude HOD, Managers, Employees, Staff)
        if role_name in ['admin', 'super admin', 'superadmin', 'administrator']:
            return True
    return False

def has_file_approval_permission(user):
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

assert old_is_admin in text, "old_is_admin not found"
text = text.replace(old_is_admin, new_is_admin, 1)

# Now update DigiLockerFileApprovalViewSet to check has_file_approval_permission
old_approval_qs = """    def get_queryset(self):
        user = self.request.user
        if not is_user_admin(user):
            # Only administrators can access file approval
            return DigiLockerDocument.objects.none()"""

new_approval_qs = """    def get_queryset(self):
        user = self.request.user
        if not has_file_approval_permission(user):
            # Only administrators or users with file approval permissions can access
            return DigiLockerDocument.objects.none()"""

assert old_approval_qs in text, "old_approval_qs not found"
text = text.replace(old_approval_qs, new_approval_qs, 1)

# Update approve and reject actions in DigiLockerFileApprovalViewSet
old_approve_check = """    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        user = request.user
        if not is_user_admin(user):
            return Response({"error": "Only authorized administrators can approve files."}, status=status.HTTP_403_FORBIDDEN)"""

new_approve_check = """    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        user = request.user
        if not has_file_approval_permission(user):
            return Response({"error": "Only authorized administrators can approve files."}, status=status.HTTP_403_FORBIDDEN)"""

assert old_approve_check in text, "old_approve_check not found"
text = text.replace(old_approve_check, new_approve_check, 1)

old_reject_check = """    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        user = request.user
        if not is_user_admin(user):
            return Response({"error": "Only authorized administrators can reject files."}, status=status.HTTP_403_FORBIDDEN)"""

new_reject_check = """    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        user = request.user
        if not has_file_approval_permission(user):
            return Response({"error": "Only authorized administrators can reject files."}, status=status.HTTP_403_FORBIDDEN)"""

assert old_reject_check in text, "old_reject_check not found"
text = text.replace(old_reject_check, new_reject_check, 1)

# Now update DigiLockerEditRequestViewSet to check has_file_approval_permission
old_edit_req_qs = """    def get_queryset(self):
        user = self.request.user
        if is_user_admin(user):
            qs = DigiLockerEditRequest.objects.all()
        else:
            qs = DigiLockerEditRequest.objects.filter(requested_by=user)"""

new_edit_req_qs = """    def get_queryset(self):
        user = self.request.user
        if has_file_approval_permission(user):
            qs = DigiLockerEditRequest.objects.all()
        else:
            qs = DigiLockerEditRequest.objects.filter(requested_by=user)"""

assert old_edit_req_qs in text, "old_edit_req_qs not found"
text = text.replace(old_edit_req_qs, new_edit_req_qs, 1)

old_edit_approve_check = """    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        user = request.user
        if not is_user_admin(user):
            return Response({"error": "Only authorized administrators can approve edit requests."}, status=status.HTTP_403_FORBIDDEN)"""

new_edit_approve_check = """    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        user = request.user
        if not has_file_approval_permission(user):
            return Response({"error": "Only authorized administrators can approve edit requests."}, status=status.HTTP_403_FORBIDDEN)"""

assert old_edit_approve_check in text, "old_edit_approve_check not found"
text = text.replace(old_edit_approve_check, new_edit_approve_check, 1)

old_edit_reject_check = """    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        user = request.user
        if not is_user_admin(user):
            return Response({"error": "Only authorized administrators can reject edit requests."}, status=status.HTTP_403_FORBIDDEN)"""

new_edit_reject_check = """    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        user = request.user
        if not has_file_approval_permission(user):
            return Response({"error": "Only authorized administrators can reject edit requests."}, status=status.HTTP_403_FORBIDDEN)"""

assert old_edit_reject_check in text, "old_edit_reject_check not found"
text = text.replace(old_edit_reject_check, new_edit_reject_check, 1)

with open('backend/digilocker_app/views.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("views.py updated with has_file_approval_permission successfully.")

