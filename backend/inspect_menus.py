import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from register_app.models import Menu, SubMenu
try:
    from register_app.models import SubSubMenu
except ImportError:
    SubSubMenu = None

market_connect = Menu.objects.filter(name='Market Connect').first()
if market_connect:
    print('Found Market Connect')
    submenus = SubMenu.objects.filter(menu=market_connect)
    for s in submenus:
        print(f'SubMenu: {s.name} (url: {getattr(s, "url", "")})')
        if SubSubMenu:
            subsubmenus = SubSubMenu.objects.filter(submenu=s)
            for ss in subsubmenus:
                print(f'  - SubSubMenu: {ss.name} (url: {getattr(ss, "url", "")})')
