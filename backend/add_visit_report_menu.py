import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from register_app.models import Menu, SubMenu, SubSubMenu, RoleMenuPermission, Role

def run():
    print("Finding Market Connect menu...")
    market_connect = Menu.objects.filter(name='Market Connect').first()
    
    if not market_connect:
        print("Market Connect menu not found.")
        return
        
    print(f"Found Menu: {market_connect.name}")
    
    reports_submenu = SubMenu.objects.filter(menu=market_connect, name='Reports').first()
    if not reports_submenu:
        print("Reports submenu not found.")
        return
        
    print(f"Found Reports Submenu: {reports_submenu.name}")
    
    # Check if Visit Report already exists
    visit_report = SubSubMenu.objects.filter(submenu=reports_submenu, name="Visit Report").first()
    if not visit_report:
        print("Creating Visit Report subsubmenu...")
        visit_report = SubSubMenu.objects.create(
            submenu=reports_submenu,
            name="Visit Report",
            code="visit-report",
            url="market-connect/reports/visit-report",
            order=2,
            has_create=False,
            has_edit=False,
            has_delete=False
        )
    else:
        print("Visit Report subsubmenu already exists.")
        
    # Give all roles permission
    # In this app, RoleMenuPermission usually has menu, submenu, and subsubmenu fields?
    # Let's try to fetch fields of RoleMenuPermission.
    roles = Role.objects.all()
    for role in roles:
        try:
            RoleMenuPermission.objects.update_or_create(
                role=role,
                menu=market_connect,
                submenu=reports_submenu,
                sub_submenu=visit_report,
                defaults={
                    'can_view': True,
                    'can_create': True,
                    'can_edit': True,
                    'can_delete': True
                }
            )
        except Exception as e:
            print(f"Error giving permission to role {role.name}: {e}")
            
    print("Permissions granted.")

if __name__ == '__main__':
    run()
