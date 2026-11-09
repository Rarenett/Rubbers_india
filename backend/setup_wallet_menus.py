import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from register_app.models import Menu, SubMenu, SubSubMenu, Role, RoleMenuPermission

def setup_wallet_menus():
    print("Setting up Wallet menu, submenus, and subsubmenus...")

    # 1. Top-level Menu: Wallet
    wallet_menu, created = Menu.objects.get_or_create(
        name='Wallet',
        defaults={
            'code': 'wallet',
            'order': 32,
            'icon': 'fa fa-wallet',
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True,
        }
    )
    if not created:
        wallet_menu.is_active = True
        wallet_menu.code = 'wallet'
        wallet_menu.icon = 'fa fa-wallet'
        wallet_menu.save()
    print(f"Top-level Menu: {wallet_menu.name} (id={wallet_menu.id}, code={wallet_menu.code})")

    # 2. SubMenu: Master (expandable parent for subsubmenus, url=None)
    master_sub, created = SubMenu.objects.get_or_create(
        menu=wallet_menu,
        name='Master',
        defaults={
            'code': 'wallet_master',
            'url': None,
            'order': 1,
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True,
        }
    )
    master_sub.code = 'wallet_master'
    master_sub.url = None
    master_sub.is_active = True
    master_sub.save()
    print(f"  SubMenu: {master_sub.name} (url={master_sub.url})")

    # 2a. SubSubMenu: Owner Type (under Master)
    owner_type_ssm, created = SubSubMenu.objects.get_or_create(
        submenu=master_sub,
        name='Owner Type',
        defaults={
            'code': 'wallet_ownertype',
            'url': 'wallet/master/owner-type',
            'order': 1,
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True,
        }
    )
    owner_type_ssm.code = 'wallet_ownertype'
    owner_type_ssm.url = 'wallet/master/owner-type'
    owner_type_ssm.order = 1
    owner_type_ssm.is_active = True
    owner_type_ssm.save()
    print(f"    SubSubMenu: {owner_type_ssm.name} (url={owner_type_ssm.url})")

    # 2b. SubSubMenu: Schemes (under Master)
    schemes_ssm, created = SubSubMenu.objects.get_or_create(
        submenu=master_sub,
        name='Schemes',
        defaults={
            'code': 'wallet_schemes',
            'url': 'wallet/master/schemes',
            'order': 2,
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True,
        }
    )
    schemes_ssm.code = 'wallet_schemes'
    schemes_ssm.url = 'wallet/master/schemes'
    schemes_ssm.order = 2
    schemes_ssm.is_active = True
    schemes_ssm.save()
    print(f"    SubSubMenu: {schemes_ssm.name} (url={schemes_ssm.url})")

    # 2c. SubSubMenu: Reason (under Master)
    reason_ssm, created = SubSubMenu.objects.get_or_create(
        submenu=master_sub,
        name='Reason',
        defaults={
            'code': 'wallet_reason',
            'url': 'wallet/master/reason',
            'order': 3,
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True,
        }
    )
    reason_ssm.code = 'wallet_reason'
    reason_ssm.url = 'wallet/master/reason'
    reason_ssm.order = 3
    reason_ssm.is_active = True
    reason_ssm.save()
    print(f"    SubSubMenu: {reason_ssm.name} (url={reason_ssm.url})")

    # 2d. SubSubMenu: Working (under Master)
    working_ssm, created = SubSubMenu.objects.get_or_create(
        submenu=master_sub,
        name='Working',
        defaults={
            'code': 'wallet_working',
            'url': 'wallet/master/working',
            'order': 4,
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True,
        }
    )
    working_ssm.code = 'wallet_working'
    working_ssm.url = 'wallet/master/working'
    working_ssm.order = 4
    working_ssm.is_active = True
    working_ssm.save()
    print(f"    SubSubMenu: {working_ssm.name} (url={working_ssm.url})")

    # 2e. SubSubMenu: Calendar (under Master)
    calendar_ssm, created = SubSubMenu.objects.get_or_create(
        submenu=master_sub,
        name='Calendar',
        defaults={
            'code': 'wallet_calendar',
            'url': 'wallet/master/calendar',
            'order': 5,
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True,
        }
    )
    calendar_ssm.code = 'wallet_calendar'
    calendar_ssm.url = 'wallet/master/calendar'
    calendar_ssm.order = 5
    calendar_ssm.is_active = True
    calendar_ssm.save()
    print(f"    SubSubMenu: {calendar_ssm.name} (url={calendar_ssm.url})")

    # 3. SubMenu: Transactions
    trans_sub, created = SubMenu.objects.get_or_create(
        menu=wallet_menu,
        name='Transactions',
        defaults={
            'code': 'wallet_transactions',
            'url': None,
            'order': 2,
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True,
        }
    )
    if not created:
        trans_sub.code = 'wallet_transactions'
        trans_sub.url = None
        trans_sub.is_active = True
        trans_sub.save()
    print(f"  SubMenu: {trans_sub.name} (url={trans_sub.url})")

    # 3a. SubSubMenu: Wallet Creation (Order 1)
    wallet_creation_sub, created = SubSubMenu.objects.get_or_create(
        submenu=trans_sub,
        name='Wallet Creation',
        defaults={
            'code': 'wallet_creation',
            'url': 'wallet/transactions/wallet-creation',
            'order': 1,
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True,
        }
    )
    if not created:
        wallet_creation_sub.code = 'wallet_creation'
        wallet_creation_sub.url = 'wallet/transactions/wallet-creation'
        wallet_creation_sub.order = 1
        wallet_creation_sub.is_active = True
        wallet_creation_sub.save()
    print(f"    SubSubMenu: {wallet_creation_sub.name} (url={wallet_creation_sub.url})")

    # 3b. SubSubMenu: Points Entry (Order 2)
    points_entry_sub, created = SubSubMenu.objects.get_or_create(
        submenu=trans_sub,
        name='Points Entry',
        defaults={
            'code': 'wallet_points_entry',
            'url': 'wallet/transactions/points-entry',
            'order': 2,
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True,
        }
    )
    if not created:
        points_entry_sub.code = 'wallet_points_entry'
        points_entry_sub.url = 'wallet/transactions/points-entry'
        points_entry_sub.order = 2
        points_entry_sub.is_active = True
        points_entry_sub.save()
    print(f"    SubSubMenu: {points_entry_sub.name} (url={points_entry_sub.url})")

    # 4. SubMenu: Report
    report_sub, created = SubMenu.objects.get_or_create(
        menu=wallet_menu,
        name='Report',
        defaults={
            'code': 'wallet_report',
            'url': 'wallet/report',
            'order': 3,
            'is_active': True,
            'has_create': True,
            'has_edit': True,
            'has_delete': True,
        }
    )
    if not created:
        report_sub.code = 'wallet_report'
        report_sub.url = 'wallet/report'
        report_sub.is_active = True
        report_sub.save()
    print(f"  SubMenu: {report_sub.name} (url={report_sub.url})")

    # 5. Grant RoleMenuPermission to all active roles
    roles = Role.objects.all()
    print(f"Granting Wallet permissions to {roles.count()} roles...")
    for role in roles:
        # Parent Menu Permission
        RoleMenuPermission.objects.update_or_create(
            role=role,
            menu=wallet_menu,
            submenu=None,
            sub_submenu=None,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
        # Master Submenu Permission
        RoleMenuPermission.objects.update_or_create(
            role=role,
            menu=wallet_menu,
            submenu=master_sub,
            sub_submenu=None,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
        # Owner Type SubSubMenu Permission
        RoleMenuPermission.objects.update_or_create(
            role=role,
            menu=wallet_menu,
            submenu=master_sub,
            sub_submenu=owner_type_ssm,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
        # Schemes SubSubMenu Permission
        RoleMenuPermission.objects.update_or_create(
            role=role,
            menu=wallet_menu,
            submenu=master_sub,
            sub_submenu=schemes_ssm,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
        # Reason SubSubMenu Permission
        RoleMenuPermission.objects.update_or_create(
            role=role,
            menu=wallet_menu,
            submenu=master_sub,
            sub_submenu=reason_ssm,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
        # Working SubSubMenu Permission
        RoleMenuPermission.objects.update_or_create(
            role=role,
            menu=wallet_menu,
            submenu=master_sub,
            sub_submenu=working_ssm,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
        # Calendar SubSubMenu Permission
        RoleMenuPermission.objects.update_or_create(
            role=role,
            menu=wallet_menu,
            submenu=master_sub,
            sub_submenu=calendar_ssm,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
        # Transactions Submenu Permission
        RoleMenuPermission.objects.update_or_create(
            role=role,
            menu=wallet_menu,
            submenu=trans_sub,
            sub_submenu=None,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
        # Wallet Creation SubSubMenu Permission
        RoleMenuPermission.objects.update_or_create(
            role=role,
            menu=wallet_menu,
            submenu=trans_sub,
            sub_submenu=wallet_creation_sub,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
        # Points Entry SubSubMenu Permission
        RoleMenuPermission.objects.update_or_create(
            role=role,
            menu=wallet_menu,
            submenu=trans_sub,
            sub_submenu=points_entry_sub,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
        # Report Submenu Permission
        RoleMenuPermission.objects.update_or_create(
            role=role,
            menu=wallet_menu,
            submenu=report_sub,
            sub_submenu=None,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )

    print("Wallet menus, submenus, and Owner Type successfully configured.")

if __name__ == '__main__':
    setup_wallet_menus()
