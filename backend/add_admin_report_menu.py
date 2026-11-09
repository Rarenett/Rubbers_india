import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from register_app.models import Menu, SubMenu, RoleMenuPermission, Role

def run():
    print("Finding Task Management menu...")
    task_menu = Menu.objects.filter(name__icontains='Task').first()
    
    if not task_menu:
        print("Task Management menu not found. Creating it.")
        task_menu = Menu.objects.create(
            name="Task Management",
            code="task-management",
            icon="flaticon-381-notepad",
            order=10
        )
    
    print(f"Found/Created Menu: {task_menu.name}")
    
    # Check if Admin Task Report already exists
    submenu = SubMenu.objects.filter(menu=task_menu, name="Admin Task Report").first()
    if not submenu:
        print("Creating Admin Task Report submenu...")
        submenu = SubMenu.objects.create(
            menu=task_menu,
            name="Admin Task Report",
            code="admin-report",
            url="task-management/admin-report",
            order=4,
            has_create=True,
            has_edit=True,
            has_delete=True
        )
    else:
        print("Admin Task Report submenu already exists.")
        
    # Give all roles permission
    roles = Role.objects.all()
    for role in roles:
        RoleMenuPermission.objects.update_or_create(
            role=role,
            menu=task_menu,
            submenu=submenu,
            defaults={
                'can_view': True,
                'can_create': True,
                'can_edit': True,
                'can_delete': True
            }
        )
    print("Permissions granted.")

if __name__ == '__main__':
    run()
