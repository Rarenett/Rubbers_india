with open('backend/digilocker_app/views.py', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update get_employee_permissions_for_folder
old_get_perms = """def get_employee_permissions_for_folder(folder, employee):
    \"\"\"
    Resolves the effective permissions (can_view, can_download, can_upload)
    for an employee on a folder, inheriting from the nearest ancestor mapping if nested.
    \"\"\"
    if not folder or not employee:
        return {'can_view': False, 'can_download': False, 'can_upload': False}
    curr = folder
    visited = set()
    while curr and curr.id not in visited:
        visited.add(curr.id)
        m = DigiLockerFolderMapping.objects.filter(
            folder=curr, employee=employee, is_active=True
        ).first()
        if m:
            return {
                'can_view': m.can_view,
                'can_download': m.can_download,
                'can_upload': m.can_upload
            }
        curr = curr.parent_folder
    return {'can_view': False, 'can_download': False, 'can_upload': False}"""

new_get_perms = """def get_employee_permissions_for_folder(folder, employee):
    \"\"\"
    Resolves the effective permissions (can_view, view_otp_required, can_download, download_otp_required, can_upload)
    for an employee on a folder, inheriting from the nearest ancestor mapping if nested.
    \"\"\"
    if not folder or not employee:
        return {
            'can_view': False,
            'view_otp_required': True,
            'can_download': False,
            'download_otp_required': True,
            'can_upload': False
        }
    curr = folder
    visited = set()
    while curr and curr.id not in visited:
        visited.add(curr.id)
        m = DigiLockerFolderMapping.objects.filter(
            folder=curr, employee=employee, is_active=True
        ).first()
        if m:
            return {
                'can_view': m.can_view,
                'view_otp_required': getattr(m, 'view_otp_required', True),
                'can_download': m.can_download,
                'download_otp_required': getattr(m, 'download_otp_required', True),
                'can_upload': m.can_upload
            }
        curr = curr.parent_folder
    return {
        'can_view': False,
        'view_otp_required': True,
        'can_download': False,
        'download_otp_required': True,
        'can_upload': False
    }"""

if '\r\n' in text:
    old_get_perms = old_get_perms.replace('\n', '\r\n')
    new_get_perms = new_get_perms.replace('\n', '\r\n')

assert old_get_perms in text, "old_get_perms not found"
text = text.replace(old_get_perms, new_get_perms, 1)

with open('backend/digilocker_app/views.py', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Step 1 updated successfully.")

