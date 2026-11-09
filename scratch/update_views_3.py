with open('backend/digilocker_app/views.py', 'r', encoding='utf-8') as f:
    text = f.read()

# 3. Update DigiLockerAccessView.get
old_access = """        folder_perms = {}
        for m in direct_mappings:
            folder_perms[m.folder.id] = {
                'folder': m.folder,
                'can_upload': m.can_upload,
                'can_view': m.can_view,
                'can_download': m.can_download
            }

        # Propagate permissions to active subfolders
        queue = list(folder_perms.keys())
        while queue:
            parent_id = queue.pop(0)
            p_perm = folder_perms[parent_id]
            subfolders = DigiLockerFolder.objects.filter(parent_folder_id=parent_id, is_active=True)
            for sf in subfolders:
                if sf.id not in folder_perms:
                    folder_perms[sf.id] = {
                        'folder': sf,
                        'can_upload': p_perm['can_upload'],
                        'can_view': p_perm['can_view'],
                        'can_download': p_perm['can_download']
                    }
                    queue.append(sf.id)

        folders_data = []
        mapped_folder_ids = set(folder_perms.keys())

        for f_id, p_info in folder_perms.items():
            folder = p_info['folder']
            docs = folder.documents.filter(is_active=True).order_by('-uploaded_at')
            
            my_docs_list = []
            other_docs_list = []

            for d in docs:
                owner_user, owner_emp, owner_name, owner_email = resolve_document_owner_info(d)
                
                # Strict permission mapping:
                # Individual permissions work independently.
                # Neither folder creation nor ownership grants automatic permissions.
                can_view_perm = is_admin or bool(p_info['can_view'])
                can_download_perm = is_admin or bool(p_info['can_download'])

                # If an employee has no View permission, documents in this folder must not be shown
                if not can_view_perm and not can_download_perm:
                    continue

                # Document requires OTP verification to unlock unless caller is an admin
                # Folder creators and owners must also complete OTP verification to access documents
                requires_otp = not is_admin
                is_locked = requires_otp

                doc_entry = {
                    'id': d.id,
                    'original_filename': d.original_filename,
                    'file_extension': d.file_extension,
                    'file_size_display': d.file_size_display,
                    'uploaded_at': d.uploaded_at,
                    'description': d.description,
                    'owner_name': owner_name,
                    'owner_email_masked': mask_email(owner_email),
                    'is_owner': False,
                    'is_locked': is_locked,
                    'requires_otp': requires_otp,
                    'direct_preview_url': f"/api/digilocker/access/documents/{d.id}/preview/" if (is_admin and can_view_perm) else None,
                    'direct_download_url': f"/api/digilocker/access/documents/{d.id}/download/" if (is_admin and can_download_perm) else None,
                    'can_view': can_view_perm,
                    'can_download': can_download_perm
                }"""

new_access = """        folder_perms = {}
        for m in direct_mappings:
            folder_perms[m.folder.id] = {
                'folder': m.folder,
                'can_upload': m.can_upload,
                'can_view': m.can_view,
                'view_otp_required': getattr(m, 'view_otp_required', True),
                'can_download': m.can_download,
                'download_otp_required': getattr(m, 'download_otp_required', True)
            }

        # Propagate permissions to active subfolders
        queue = list(folder_perms.keys())
        while queue:
            parent_id = queue.pop(0)
            p_perm = folder_perms[parent_id]
            subfolders = DigiLockerFolder.objects.filter(parent_folder_id=parent_id, is_active=True)
            for sf in subfolders:
                if sf.id not in folder_perms:
                    folder_perms[sf.id] = {
                        'folder': sf,
                        'can_upload': p_perm['can_upload'],
                        'can_view': p_perm['can_view'],
                        'view_otp_required': p_perm.get('view_otp_required', True),
                        'can_download': p_perm['can_download'],
                        'download_otp_required': p_perm.get('download_otp_required', True)
                    }
                    queue.append(sf.id)

        folders_data = []
        mapped_folder_ids = set(folder_perms.keys())

        for f_id, p_info in folder_perms.items():
            folder = p_info['folder']
            docs = folder.documents.filter(is_active=True).order_by('-uploaded_at')
            
            my_docs_list = []
            other_docs_list = []

            for d in docs:
                owner_user, owner_emp, owner_name, owner_email = resolve_document_owner_info(d)
                
                # Strict permission mapping:
                # Individual permissions work independently.
                # Neither folder creation nor ownership grants automatic permissions.
                can_view_perm = is_admin or bool(p_info['can_view'])
                can_download_perm = is_admin or bool(p_info['can_download'])

                # If an employee has no View permission, documents in this folder must not be shown
                if not can_view_perm and not can_download_perm:
                    continue

                # Independent OTP requirements for View and Download
                view_otp_req = (not is_admin) and bool(p_info.get('view_otp_required', True))
                download_otp_req = (not is_admin) and bool(p_info.get('download_otp_required', True))

                # Document requires OTP for viewing if view_otp_req is True
                requires_otp = view_otp_req
                is_locked = view_otp_req

                doc_entry = {
                    'id': d.id,
                    'original_filename': d.original_filename,
                    'file_extension': d.file_extension,
                    'file_size_display': d.file_size_display,
                    'uploaded_at': d.uploaded_at,
                    'description': d.description,
                    'owner_name': owner_name,
                    'owner_email_masked': mask_email(owner_email),
                    'is_owner': False,
                    'is_locked': is_locked,
                    'requires_otp': requires_otp,
                    'view_otp_required': view_otp_req,
                    'download_otp_required': download_otp_req,
                    'direct_preview_url': f"/api/digilocker/access/documents/{d.id}/preview/" if (can_view_perm and not view_otp_req) else None,
                    'direct_download_url': f"/api/digilocker/access/documents/{d.id}/download/" if (can_download_perm and not download_otp_req) else None,
                    'can_view': can_view_perm,
                    'can_download': can_download_perm
                }"""

if '\r\n' in text:
    old_access = old_access.replace('\n', '\r\n')
    new_access = new_access.replace('\n', '\r\n')

assert old_access in text, "old_access not found"
text = text.replace(old_access, new_access, 1)

with open('backend/digilocker_app/views.py', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Step 3 (DigiLockerAccessView.get) updated successfully.")

