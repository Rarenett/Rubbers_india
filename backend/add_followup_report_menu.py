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
        
    reports_submenu = SubMenu.objects.filter(menu=market_connect, name='Reports').first()
    if not reports_submenu:
        print("Reports submenu not found.")
        return
        
    print(f"Found Reports Submenu: {reports_submenu.name}")
    
    # Check if Follow-Up Report already exists
    followup_report = SubSubMenu.objects.filter(submenu=reports_submenu, name="Follow-Up Report").first()
    if not followup_report:
        print("Creating Follow-Up Report subsubmenu...")
        followup_report = SubSubMenu.objects.create(
            submenu=reports_submenu,
            name="Follow-Up Report",
            code="follow-up-report",
            url="market-connect/reports/follow-up-report",
            order=3,
            is_active=True,
            has_create=False,
            has_edit=False,
            has_delete=False
        )
        print("Created successfully:", followup_report.id)
    else:
        print("Follow-Up Report already exists:", followup_report.id)
        followup_report.url = "market-connect/reports/follow-up-report"
        followup_report.is_active = True
        followup_report.order = 3
        followup_report.save()

    # Assign permissions to all roles
    roles = Role.objects.all()
    count = 0
    for role in roles:
        RoleMenuPermission.objects.update_or_create(
            role=role,
            menu=market_connect,
            submenu=reports_submenu,
            sub_submenu=followup_report,
            defaults={
                'can_view': True,
                'can_create': True,
                'can_edit': True,
                'can_delete': True
            }
        )
        count += 1
    print(f"Updated permissions for {count} roles.")

if __name__ == '__main__':
    run()
