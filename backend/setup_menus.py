import os
import sys
import django

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from register_app.models import Menu, SubMenu, SubSubMenu, Role, RoleMenuPermission

def setup_menus():
    # 1. Create Menu: Common Master
    menu, _ = Menu.objects.get_or_create(
        name='Common Master', 
        defaults={'code': 'common_master', 'order': 99, 'icon': 'flaticon-025-dashboard'}
    )

    # 2. Create SubMenu: Master
    submenu, _ = SubMenu.objects.get_or_create(
        menu=menu, 
        name='Master', 
        defaults={'code': 'master', 'order': 1, 'icon': 'flaticon-022-copy'}
    )

    # 3. Create SubSubMenu: Area Creation
    area_sub, _ = SubSubMenu.objects.get_or_create(
        submenu=submenu, 
        name='Area Creation', 
        defaults={'code': 'area_creation', 'url': 'common-master/master/area-creation', 'order': 1, 'icon': ''}
    )

    # 4. Create SubSubMenu: Salesman Mapping
    sales_sub, _ = SubSubMenu.objects.get_or_create(
        submenu=submenu, 
        name='Salesman Mapping', 
        defaults={'code': 'salesman_mapping', 'url': 'common-master/master/salesman-mapping', 'order': 2, 'icon': ''}
    )

    # 4.1. Create SubSubMenu: Salesman Visitings
    visitings_sub, _ = SubSubMenu.objects.get_or_create(
        submenu=submenu, 
        name='Salesman Visitings', 
        defaults={'code': 'salesman_visitings', 'url': 'common-master/master/salesman-visitings', 'order': 3, 'icon': ''}
    )

    # 4.2. Create SubSubMenu: Area Location Mapping
    area_loc_sub, _ = SubSubMenu.objects.get_or_create(
        submenu=submenu, 
        name='Area Location Mapping', 
        defaults={'code': 'area_location_mapping', 'url': 'common-master/master/area-location-mapping', 'order': 4, 'icon': ''}
    )

    # 5. Grant access to all existing roles to ensure it shows up for testing
    roles = Role.objects.all()

    for role in roles:
        # Grant Menu
        RoleMenuPermission.objects.get_or_create(
            role=role, menu=menu, submenu=None, sub_submenu=None,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
        # Grant SubMenu
        RoleMenuPermission.objects.get_or_create(
            role=role, menu=menu, submenu=submenu, sub_submenu=None,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
        # Grant SubSubMenu - Area
        RoleMenuPermission.objects.get_or_create(
            role=role, menu=menu, submenu=submenu, sub_submenu=area_sub,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
        # Grant SubSubMenu - Salesman
        RoleMenuPermission.objects.get_or_create(
            role=role, menu=menu, submenu=submenu, sub_submenu=sales_sub,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
        # Grant SubSubMenu - Visitings
        RoleMenuPermission.objects.get_or_create(
            role=role, menu=menu, submenu=submenu, sub_submenu=visitings_sub,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
        # Grant SubSubMenu - Area Location
        RoleMenuPermission.objects.get_or_create(
            role=role, menu=menu, submenu=submenu, sub_submenu=area_loc_sub,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
    print("Menus and permissions created successfully.")

if __name__ == '__main__':
    setup_menus()
