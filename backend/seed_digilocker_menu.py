import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from register_app.models import Menu, SubMenu, SubSubMenu, Role, RoleMenuPermission

def seed_digilocker():
    print("Seeding DigiLocker Menus...")

    # 1. Top-level Menu
    max_order = Menu.objects.order_by('-order').values_list('order', flat=True).first() or 50
    digilocker_menu, created = Menu.objects.update_or_create(
        name="DigiLocker",
        defaults={
            'code': 'digilocker',
            'icon': 'fa fa-folder-open',
            'order': max_order + 1,
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True
        }
    )
    print(f"Top-level Menu: {digilocker_menu.name} (Created: {created})")

    # 2. SubMenu: Master
    master_submenu, _ = SubMenu.objects.update_or_create(
        menu=digilocker_menu,
        name="Master",
        defaults={
            'code': 'digilocker-master',
            'order': 1,
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True
        }
    )

    # 2a. SubSubMenu: Folder Creation
    folder_ssm, _ = SubSubMenu.objects.update_or_create(
        submenu=master_submenu,
        name="Folder Creation",
        defaults={
            'code': 'digilocker_folder',
            'url': '/digilocker/folder-creation',
            'order': 1,
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True
        }
    )
    print("  -> Master > Folder Creation created/updated")

    # 3. SubMenu: Transactions
    trans_submenu, _ = SubMenu.objects.update_or_create(
        menu=digilocker_menu,
        name="Transactions",
        defaults={
            'code': 'digilocker-transactions',
            'order': 2,
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True
        }
    )

    # 3a. SubSubMenu: Upload Files
    upload_ssm, _ = SubSubMenu.objects.update_or_create(
        submenu=trans_submenu,
        name="Upload Files",
        defaults={
            'code': 'digilocker_upload',
            'url': '/digilocker/upload-files',
            'order': 1,
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True
        }
    )

    # 3b. SubSubMenu: Mapping
    mapping_ssm, _ = SubSubMenu.objects.update_or_create(
        submenu=trans_submenu,
        name="Mapping",
        defaults={
            'code': 'digilocker_mapping',
            'url': '/digilocker/mapping',
            'order': 2,
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True
        }
    )

    # 3c. SubSubMenu: Access
    access_ssm, _ = SubSubMenu.objects.update_or_create(
        submenu=trans_submenu,
        name="Access",
        defaults={
            'code': 'digilocker_access',
            'url': '/digilocker/access',
            'order': 3,
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True
        }
    )

    # 3d. SubSubMenu: File Approval (Admin Only)
    approval_ssm, _ = SubSubMenu.objects.update_or_create(
        submenu=trans_submenu,
        name="File Approval",
        defaults={
            'code': 'digilocker_approval',
            'url': '/digilocker/file-approval',
            'order': 4,
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True
        }
    )
    print("  -> Transactions > Upload Files, Mapping, Access, File Approval created/updated")

    # 4. SubMenu: Report
    report_submenu, _ = SubMenu.objects.update_or_create(
        menu=digilocker_menu,
        name="Report",
        defaults={
            'code': 'digilocker_report',
            'url': None,
            'order': 3,
            'is_active': True,
            'has_create': False,
            'has_edit': False,
            'has_delete': False
        }
    )

    # 4a. SubSubMenu: Files View Report
    files_view_ssm, _ = SubSubMenu.objects.update_or_create(
        submenu=report_submenu,
        name="Files View Report",
        defaults={
            'code': 'digilocker_files_view_report',
            'url': '/digilocker/reports/files-view',
            'order': 1,
            'is_active': True,
            'has_create': False,
            'has_edit': False,
            'has_delete': False
        }
    )

    # 4b. SubSubMenu: File Download Report
    file_dl_ssm, _ = SubSubMenu.objects.update_or_create(
        submenu=report_submenu,
        name="File Download Report",
        defaults={
            'code': 'digilocker_file_download_report',
            'url': '/digilocker/reports/file-download',
            'order': 2,
            'is_active': True,
            'has_create': False,
            'has_edit': False,
            'has_delete': False
        }
    )

    # Ensure old generic DigiLocker Report subsubmenu is removed
    SubSubMenu.objects.filter(submenu=report_submenu, code='digilocker_report_view').delete()
    print("  -> Report > Files View Report, File Download Report created/updated")

    # Grant permissions to all roles
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
            )

    print(f"Granted permissions to {roles.count()} roles successfully.")

if __name__ == '__main__':
    seed_digilocker()
