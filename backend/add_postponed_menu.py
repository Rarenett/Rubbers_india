import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from register_app.models import Menu, SubMenu, SubSubMenu, RoleMenuPermission, Role

task_menu = Menu.objects.filter(name='Task Management').first()
reports_submenu = SubMenu.objects.filter(menu=task_menu, name='Reports').first()

if reports_submenu:
    ssm, created = SubSubMenu.objects.get_or_create(
        submenu=reports_submenu,
        name='Postponed Task Report',
        defaults={
            'code': 'postponed-report',
            'url': 'task-management/postponed-report',
            'order': 3
        }
    )
    
    roles = Role.objects.all()
    for role in roles:
        RoleMenuPermission.objects.update_or_create(
            role=role, menu=task_menu, submenu=reports_submenu, sub_submenu=ssm,
            defaults={'can_view': True, 'can_create': True, 'can_edit': True, 'can_delete': True}
        )
    print("Added Postponed Task Report to Reports submenu.")
else:
    print("Reports submenu not found!")
