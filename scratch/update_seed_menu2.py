with open('backend/seed_digilocker_menu.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Update seed_digilocker_menu.py so that approval_ssm is in all_subsubmenus
old_block = """    # Grant permissions:
    # Standard subsubmenus to all roles
    standard_subsubmenus = [folder_ssm, upload_ssm, mapping_ssm, access_ssm, files_view_ssm, file_dl_ssm]
    roles = Role.objects.all()

    for role in roles:
        role_name = (role.name or '').strip().lower()
        is_admin = role_name in ['admin', 'super admin', 'superadmin', 'administrator']

        # Top-level permission
        RoleMenuPermission.objects.update_or_create(
            role=role,
            menu=digilocker_menu,
            submenu=None,
            sub_submenu=None,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
        # Submenu permissions
        for sm in [master_submenu, trans_submenu, report_submenu]:
            RoleMenuPermission.objects.update_or_create(
                role=role,
                menu=digilocker_menu,
                submenu=sm,
                sub_submenu=None,
                defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
            )
        # Standard SubSubmenus
        for ssm in standard_subsubmenus:
            RoleMenuPermission.objects.update_or_create(
                role=role,
                menu=digilocker_menu,
                submenu=ssm.submenu,
                sub_submenu=ssm,
                defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
            )
        # File Approval is strictly for Admin roles
        RoleMenuPermission.objects.update_or_create(
            role=role,
            menu=digilocker_menu,
            submenu=approval_ssm.submenu,
            sub_submenu=approval_ssm,
            defaults={
                'can_view': is_admin,
                'can_create': is_admin,
                'can_edit': is_admin,
                'can_delete': is_admin
            }
        )"""

new_block = """    # Grant permissions to all roles
    all_subsubmenus = [folder_ssm, upload_ssm, mapping_ssm, access_ssm, approval_ssm, files_view_ssm, file_dl_ssm]
    roles = Role.objects.all()

    for role in roles:
        # Top-level permission
        RoleMenuPermission.objects.update_or_create(
            role=role,
            menu=digilocker_menu,
            submenu=None,
            sub_submenu=None,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
        # Submenu permissions
        for sm in [master_submenu, trans_submenu, report_submenu]:
            RoleMenuPermission.objects.update_or_create(
                role=role,
                menu=digilocker_menu,
                submenu=sm,
                sub_submenu=None,
                defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
            )
        # SubSubmenu permissions
        for ssm in all_subsubmenus:
            RoleMenuPermission.objects.update_or_create(
                role=role,
                menu=digilocker_menu,
                submenu=ssm.submenu,
                sub_submenu=ssm,
                defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
            )"""

assert old_block in text, "old_block not found"
text = text.replace(old_block, new_block, 1)

with open('backend/seed_digilocker_menu.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("seed_digilocker_menu.py updated.")

