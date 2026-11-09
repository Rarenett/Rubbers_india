import re

with open('backend/digilocker_app/views.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update get_allowed_folder_ids_for_employee
old_func1 = '''def get_allowed_folder_ids_for_employee(employee, need_upload=False):
    """
    Returns all folder IDs actively mapped to this employee,
    including all nested subfolders inherited from mapped parent folders.
    """
    if not employee:
        return set()

    qs = DigiLockerFolderMapping.objects.filter(
        employee=employee, is_active=True, folder__is_active=True
    )
    if need_upload:
        qs = qs.filter(can_upload=True)

    direct_ids = set(qs.values_list('folder_id', flat=True))
    allowed_ids = set(direct_ids)

    # Propagate to all nested subfolders
    queue = list(direct_ids)
    while queue:
        parent_id = queue.pop(0)
        children = DigiLockerFolder.objects.filter(
            parent_folder_id=parent_id, is_active=True
        ).values_list('id', flat=True)
        for child_id in children:
            if child_id not in allowed_ids:
                allowed_ids.add(child_id)
                queue.append(child_id)
    return allowed_ids'''

new_func1 = '''def get_allowed_folder_ids_for_employee(employee, need_upload=False, need_view=False, need_download=False):
    """
    Returns all folder IDs actively mapped to this employee matching required permission flags,
    including all nested subfolders inherited from mapped parent folders.
    No automatic permissions are granted to folder creators or owners.
    """
    if not employee:
        return set()

    qs = DigiLockerFolderMapping.objects.filter(
        employee=employee, is_active=True, folder__is_active=True
    )
    if need_upload:
        qs = qs.filter(can_upload=True)
    if need_view:
        qs = qs.filter(can_view=True)
    if need_download:
        qs = qs.filter(can_download=True)

    direct_ids = set(qs.values_list('folder_id', flat=True))
    allowed_ids = set(direct_ids)

    # Propagate to all nested subfolders
    queue = list(direct_ids)
    while queue:
        parent_id = queue.pop(0)
        children = DigiLockerFolder.objects.filter(
            parent_folder_id=parent_id, is_active=True
        ).values_list('id', flat=True)
        for child_id in children:
            if child_id not in allowed_ids:
                allowed_ids.add(child_id)
                queue.append(child_id)
    return allowed_ids'''

assert old_func1 in content, "old_func1 not found in views.py"
content = content.replace(old_func1, new_func1)

# 2. Update DigiLockerFolderViewSet.get_queryset
old_folder_qs = '''        for_upload = self.request.query_params.get('for_upload') == 'true'

        if for_upload:
            # In Upload Files, every employee/user only sees folders actively mapped to them with upload permission (or their own folders)
            emp = get_employee_for_user(user)
            if emp:
                allowed_folder_ids = get_allowed_folder_ids_for_employee(emp, need_upload=True)
                qs = qs.filter(Q(id__in=allowed_folder_ids) | Q(owner=user))
            elif not is_user_admin(user):
                qs = qs.filter(owner=user)
        elif not has_mapping_permission(user):
            # General listing: non-admin employees without mapping permission only see shared folders mapped to them (including nested subfolders) or personal folders
            emp = get_employee_for_user(user)
            if emp:
                allowed_folder_ids = get_allowed_folder_ids_for_employee(emp)
                qs = qs.filter(Q(id__in=allowed_folder_ids) | Q(owner=user))
            else:
                qs = qs.filter(owner=user)'''

new_folder_qs = '''        for_upload = self.request.query_params.get('for_upload') == 'true'

        if is_user_admin(user) or has_mapping_permission(user):
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
            # General listing: non-admin employees strictly only see folders explicitly mapped to them.
            # Folder creators and owners receive NO automatic access without explicit mapping.
            emp = get_employee_for_user(user)
            if emp:
                allowed_folder_ids = get_allowed_folder_ids_for_employee(emp)
                qs = qs.filter(id__in=allowed_folder_ids)
            else:
                qs = qs.none()'''

assert old_folder_qs in content, "old_folder_qs not found in views.py"
content = content.replace(old_folder_qs, new_folder_qs)

# 3. Update DigiLockerDocumentViewSet.create
old_doc_create_perm = '''        # Upload permission check
        if not is_user_admin(user):
            emp = get_employee_for_user(user)
            has_perm = False
            if folder.owner == user:
                has_perm = True
            elif emp:
                allowed_upload_ids = get_allowed_folder_ids_for_employee(emp, need_upload=True)
                has_perm = folder.id in allowed_upload_ids

            if not has_perm:
                return Response(
                    {"error": "You do not have permission to upload files into this folder."},
                    status=status.HTTP_403_FORBIDDEN
                )'''

new_doc_create_perm = '''        # Strict Upload permission check:
        # Every employee must receive explicit Upload permission through Folder Mapping before uploading.
        # No employee, including the folder creator or owner, receives automatic upload access.
        if not is_user_admin(user):
            emp = get_employee_for_user(user)
            has_perm = False
            if emp:
                perms = get_employee_permissions_for_folder(folder, emp)
                has_perm = bool(perms.get('can_upload'))
                if not has_perm:
                    allowed_upload_ids = get_allowed_folder_ids_for_employee(emp, need_upload=True)
                    has_perm = folder.id in allowed_upload_ids

            if not has_perm:
                return Response(
                    {"error": "Access Denied: You do not have Upload permission for this folder. Explicit folder mapping is required."},
                    status=status.HTTP_403_FORBIDDEN
                )'''

assert old_doc_create_perm in content, "old_doc_create_perm not found in views.py"
content = content.replace(old_doc_create_perm, new_doc_create_perm)

# 4. Update DigiLockerAccessView.get
old_access_view = '''                # Check ownership from the target employee\'s perspective
                is_target_employee_owner = (
                    (target_employee.user and owner_user == target_employee.user) or
                    (target_employee.user and d.uploaded_by == target_employee.user) or
                    (target_employee.user and folder.owner == target_employee.user)
                )

                # Check if current caller has direct unlock access without OTP
                can_access_direct = (
                    is_admin or 
                    (owner_user == user) or 
                    (folder.owner == user) or 
                    (d.uploaded_by == user)
                )

                # View & download direct permissions based on mapping
                can_view_direct = can_access_direct or p_info[\'can_view\']
                can_download_direct = can_access_direct or p_info[\'can_download\']

                requires_otp = not can_access_direct
                is_locked = requires_otp

                doc_entry = {
                    \'id\': d.id,
                    \'original_filename\': d.original_filename,
                    \'file_extension\': d.file_extension,
                    \'file_size_display\': d.file_size_display,
                    \'uploaded_at\': d.uploaded_at,
                    \'description\': d.description,
                    \'owner_name\': owner_name,
                    \'owner_email_masked\': mask_email(owner_email),
                    \'is_owner\': is_target_employee_owner,
                    \'is_locked\': is_locked,
                    \'requires_otp\': requires_otp,
                    \'direct_preview_url\': f"/api/digilocker/access/documents/{d.id}/preview/" if can_view_direct else None,
                    \'direct_download_url\': f"/api/digilocker/access/documents/{d.id}/download/" if can_download_direct else None,
                    \'can_view\': is_admin or p_info[\'can_view\'] or is_target_employee_owner,
                    \'can_download\': is_admin or p_info[\'can_download\'] or is_target_employee_owner
                }

                if is_target_employee_owner:
                    my_docs_list.append(doc_entry)
                else:
                    other_docs_list.append(doc_entry)

            # Combined docs list for backward compatibility, keeping my_docs first
            combined_docs = my_docs_list + other_docs_list

            # Calculate human-readable folder path
            parts = [folder.name]
            curr = folder.parent_folder
            visited = set([folder.id])
            while curr and curr.id not in visited:
                parts.append(curr.name)
                visited.add(curr.id)
                curr = curr.parent_folder
            display_path = \' / \'.join(reversed(parts))

            folders_data.append({
                \'folder_id\': folder.id,
                \'folder_name\': folder.name,
                \'folder_path\': display_path,
                \'parent_folder_id\': folder.parent_folder_id,
                \'description\': folder.description,
                \'folder_type\': folder.folder_type,
                \'can_upload\': is_admin or p_info[\'can_upload\'] or is_self_access,
                \'can_view\': is_admin or p_info[\'can_view\'],
                \'can_download\': is_admin or p_info[\'can_download\'],
                \'my_documents\': my_docs_list,
                \'other_documents\': other_docs_list,
                \'documents\': combined_docs
            })

        # Also include any personal folders owned by the employee / user
        if is_self_access:
            personal_folders = DigiLockerFolder.objects.filter(
                owner=user, folder_type=\'personal\', is_active=True
            ).exclude(id__in=mapped_folder_ids)

            for folder in personal_folders:
                docs = folder.documents.filter(is_active=True).order_by(\'-uploaded_at\')
                my_docs_list = []
                for d in docs:
                    owner_user, owner_emp, owner_name, owner_email = resolve_document_owner_info(d)
                    doc_entry = {
                        \'id\': d.id,
                        \'original_filename\': d.original_filename,
                        \'file_extension\': d.file_extension,
                        \'file_size_display\': d.file_size_display,
                        \'uploaded_at\': d.uploaded_at,
                        \'description\': d.description,
                        \'owner_name\': owner_name,
                        \'owner_email_masked\': mask_email(owner_email),
                        \'is_owner\': True,
                        \'is_locked\': False,
                        \'requires_otp\': False,
                        \'direct_preview_url\': f"/api/digilocker/access/documents/{d.id}/preview/",
                        \'direct_download_url\': f"/api/digilocker/access/documents/{d.id}/download/",
                        \'can_view\': True,
                        \'can_download\': True
                    }
                    my_docs_list.append(doc_entry)

                parts = [folder.name]
                curr = folder.parent_folder
                visited = set([folder.id])
                while curr and curr.id not in visited:
                    parts.append(curr.name)
                    visited.add(curr.id)
                    curr = curr.parent_folder
                display_path = \' / \'.join(reversed(parts))

                folders_data.append({
                    \'folder_id\': folder.id,
                    \'folder_name\': folder.name,
                    \'folder_path\': display_path,
                    \'parent_folder_id\': folder.parent_folder_id,
                    \'description\': folder.description,
                    \'folder_type\': folder.folder_type,
                    \'can_upload\': True,
                    \'can_view\': True,
                    \'can_download\': True,
                    \'my_documents\': my_docs_list,
                    \'other_documents\': [],
                    \'documents\': my_docs_list
                })'''

new_access_view = '''                # Strict permission mapping:
                # Individual permissions work independently.
                # Neither folder creation nor ownership grants automatic permissions.
                can_view_perm = is_admin or bool(p_info[\'can_view\'])
                can_download_perm = is_admin or bool(p_info[\'can_download\'])

                # If an employee has no View permission, documents in this folder must not be shown
                if not can_view_perm and not can_download_perm:
                    continue

                # Document requires OTP verification to unlock unless caller is an admin
                # Folder creators and owners must also complete OTP verification to access documents
                requires_otp = not is_admin
                is_locked = requires_otp

                doc_entry = {
                    \'id\': d.id,
                    \'original_filename\': d.original_filename,
                    \'file_extension\': d.file_extension,
                    \'file_size_display\': d.file_size_display,
                    \'uploaded_at\': d.uploaded_at,
                    \'description\': d.description,
                    \'owner_name\': owner_name,
                    \'owner_email_masked\': mask_email(owner_email),
                    \'is_owner\': False,
                    \'is_locked\': is_locked,
                    \'requires_otp\': requires_otp,
                    \'direct_preview_url\': f"/api/digilocker/access/documents/{d.id}/preview/" if (is_admin and can_view_perm) else None,
                    \'direct_download_url\': f"/api/digilocker/access/documents/{d.id}/download/" if (is_admin and can_download_perm) else None,
                    \'can_view\': can_view_perm,
                    \'can_download\': can_download_perm
                }

                # Categorize based on whether current user uploaded it, for UX convenience
                if d.uploaded_by == user:
                    my_docs_list.append(doc_entry)
                else:
                    other_docs_list.append(doc_entry)

            # Combined docs list for backward compatibility, keeping my_docs first
            combined_docs = my_docs_list + other_docs_list

            # Calculate human-readable folder path
            parts = [folder.name]
            curr = folder.parent_folder
            visited = set([folder.id])
            while curr and curr.id not in visited:
                parts.append(curr.name)
                visited.add(curr.id)
                curr = curr.parent_folder
            display_path = \' / \'.join(reversed(parts))

            folders_data.append({
                \'folder_id\': folder.id,
                \'folder_name\': folder.name,
                \'folder_path\': display_path,
                \'parent_folder_id\': folder.parent_folder_id,
                \'description\': folder.description,
                \'folder_type\': folder.folder_type,
                \'can_upload': is_admin or bool(p_info[\'can_upload\']),
                \'can_view\': is_admin or bool(p_info[\'can_view\']),
                \'can_download\': is_admin or bool(p_info[\'can_download\']),
                \'my_documents\': my_docs_list,
                \'other_documents\': other_docs_list,
                \'documents\': combined_docs
            })

        # STRICT RULE: Personal folders and newly created folders receive NO automatic access without explicit mapping.
        # Only explicitly mapped folders (processed above) are returned in the response.'''

assert old_access_view in content, "old_access_view not found in views.py"
content = content.replace(old_access_view, new_access_view)

# 5. Update DigiLockerRequestOTPView
old_otp_view = '''        # Check mapping & operation permissions for the requester
        requester_perms = get_employee_permissions_for_folder(document.folder, requester_emp)
        is_admin = is_user_admin(user)
        is_mapped = is_folder_mapped_or_inherited(document.folder, requester_emp)

        if not is_admin and not is_mapped and not (document.folder.owner == user):
            return Response({"error": "You do not have access to this folder."}, status=status.HTTP_403_FORBIDDEN)

        # Determine the actual folder creator / owner for permissions & notification
        owner_user, owner_emp, owner_name, owner_email = resolve_folder_owner_info(document.folder)

        if not owner_user:
            return Response({"error": "Document owner could not be identified."}, status=status.HTTP_400_BAD_REQUEST)

        # Direct access if requester is the owner
        if owner_user == user:
            return Response({"message": "You are the owner of this document. No OTP required.", "is_owner": True}, status=status.HTTP_200_OK)'''

new_otp_view = '''        # Check strict mapping & operation permissions for the requester
        requester_perms = get_employee_permissions_for_folder(document.folder, requester_emp)
        is_admin = is_user_admin(user)

        if not is_admin:
            if operation == 'view' and not requester_perms.get('can_view'):
                return Response({"error": "Access Denied: You do not have View permission for this folder. Explicit folder mapping is required."}, status=status.HTTP_403_FORBIDDEN)
            if operation == 'download' and not requester_perms.get('can_download'):
                return Response({"error": "Access Denied: You do not have Download permission for this folder. Explicit folder mapping is required."}, status=status.HTTP_403_FORBIDDEN)

        # Determine the actual folder creator / owner for permissions & notification
        owner_user, owner_emp, owner_name, owner_email = resolve_folder_owner_info(document.folder)

        if not owner_user:
            return Response({"error": "Document owner could not be identified."}, status=status.HTTP_400_BAD_REQUEST)'''

assert old_otp_view in content, "old_otp_view not found in views.py"
content = content.replace(old_otp_view, new_otp_view)

# 6. Update DigiLockerPreviewDocumentView
old_preview_view = '''            # Re-verify requester still has folder view permission
            req_emp = get_employee_for_user(actor)
            perms = get_employee_permissions_for_folder(doc.folder, req_emp)
            if not perms['can_view'] and not is_user_admin(actor) and not (doc.folder.owner == actor):
                return HttpResponse("Access Denied: Folder view permission is revoked.", status=403)
        elif request.user and request.user.is_authenticated:
            try:
                doc = DigiLockerDocument.objects.get(id=document_id, is_active=True, folder__is_active=True)
            except DigiLockerDocument.DoesNotExist:
                raise Http404("Document not found.")

            owner_user, owner_emp, owner_name, owner_email = resolve_folder_owner_info(doc.folder)
            req_emp = get_employee_for_user(request.user)
            perms = get_employee_permissions_for_folder(doc.folder, req_emp)
            is_folder_owner = (owner_user == request.user) or (doc.folder.owner == request.user)
            is_admin = is_user_admin(request.user) or has_file_approval_permission(request.user)
            can_view_direct = is_admin or is_folder_owner or perms['can_view'] or (doc.uploaded_by == request.user)

            if not can_view_direct:
                return HttpResponse("Access Denied: OTP verification from folder owner is required to view this document.", status=403)'''

new_preview_view = '''            # Re-verify requester still has folder view permission through explicit mapping
            req_emp = get_employee_for_user(actor)
            perms = get_employee_permissions_for_folder(doc.folder, req_emp)
            if not is_user_admin(actor) and not perms.get('can_view'):
                return HttpResponse("Access Denied: Folder View permission is revoked or not mapped.", status=403)
        elif request.user and request.user.is_authenticated:
            try:
                doc = DigiLockerDocument.objects.get(id=document_id, is_active=True, folder__is_active=True)
            except DigiLockerDocument.DoesNotExist:
                raise Http404("Document not found.")

            owner_user, owner_emp, owner_name, owner_email = resolve_folder_owner_info(doc.folder)
            req_emp = get_employee_for_user(request.user)
            perms = get_employee_permissions_for_folder(doc.folder, req_emp)
            is_admin = is_user_admin(request.user) or has_file_approval_permission(request.user)

            # Strict mapping check: Non-admins must have explicit View permission
            if not is_admin and not perms.get('can_view'):
                return HttpResponse("Access Denied: You do not have View permission for this folder. Explicit folder mapping is required.", status=403)

            # Direct preview without OTP is strictly reserved for authorized administrators
            can_view_direct = is_admin

            if not can_view_direct:
                return HttpResponse("Access Denied: OTP verification is required to view this document.", status=403)'''

assert old_preview_view in content, "old_preview_view not found in views.py"
content = content.replace(old_preview_view, new_preview_view)

# 7. Update DigiLockerDownloadDocumentView
old_download_view = '''            # Re-verify requester still has folder download permission
            req_emp = get_employee_for_user(actor)
            perms = get_employee_permissions_for_folder(doc.folder, req_emp)
            if not perms['can_download'] and not is_user_admin(actor) and not (doc.folder.owner == actor):
                return HttpResponse("Access Denied: Folder download permission is revoked.", status=403)
        elif request.user and request.user.is_authenticated:
            try:
                doc = DigiLockerDocument.objects.get(id=document_id, is_active=True, folder__is_active=True)
            except DigiLockerDocument.DoesNotExist:
                raise Http404("Document not found.")

            owner_user, owner_emp, owner_name, owner_email = resolve_folder_owner_info(doc.folder)
            req_emp = get_employee_for_user(request.user)
            perms = get_employee_permissions_for_folder(doc.folder, req_emp)
            is_folder_owner = (owner_user == request.user) or (doc.folder.owner == request.user)
            is_admin = is_user_admin(request.user)
            can_dl_direct = is_admin or is_folder_owner or perms['can_download'] or (doc.uploaded_by == request.user)

            if not can_dl_direct:
                return HttpResponse("Access Denied: OTP verification from folder owner is required to download this document.", status=403)'''

new_download_view = '''            # Re-verify requester still has folder download permission through explicit mapping
            req_emp = get_employee_for_user(actor)
            perms = get_employee_permissions_for_folder(doc.folder, req_emp)
            if not is_user_admin(actor) and not perms.get('can_download'):
                return HttpResponse("Access Denied: Folder Download permission is revoked or not mapped.", status=403)
        elif request.user and request.user.is_authenticated:
            try:
                doc = DigiLockerDocument.objects.get(id=document_id, is_active=True, folder__is_active=True)
            except DigiLockerDocument.DoesNotExist:
                raise Http404("Document not found.")

            owner_user, owner_emp, owner_name, owner_email = resolve_folder_owner_info(doc.folder)
            req_emp = get_employee_for_user(request.user)
            perms = get_employee_permissions_for_folder(doc.folder, req_emp)
            is_admin = is_user_admin(request.user)

            # Strict mapping check: Non-admins must have explicit Download permission
            if not is_admin and not perms.get('can_download'):
                return HttpResponse("Access Denied: You do not have Download permission for this folder. Explicit folder mapping is required.", status=403)

            # Direct download without OTP is strictly reserved for authorized administrators
            can_dl_direct = is_admin

            if not can_dl_direct:
                return HttpResponse("Access Denied: OTP verification is required to download this document.", status=403)'''

assert old_download_view in content, "old_download_view not found in views.py"
content = content.replace(old_download_view, new_download_view)

with open('backend/digilocker_app/views.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated backend/digilocker_app/views.py with strict mapping permissions!")

