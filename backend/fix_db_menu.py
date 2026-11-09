import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from register_app.models import Menu, SubMenu, SubSubMenu

access_point = Menu.objects.filter(name='Access Point').first()
if access_point:
    # Ensure 'Transaction' exists under Access Point
    transaction_menu = SubMenu.objects.filter(name__iexact='Transaction', menu=access_point).first()
    if not transaction_menu:
        # Check if 'Transactions' exists and rename
        transaction_menu = SubMenu.objects.filter(name__iexact='Transactions', menu=access_point).first()
        if transaction_menu:
            transaction_menu.name = 'Transaction'
            transaction_menu.save()
            print("Renamed Transactions to Transaction")
        else:
            # Maybe it doesn't exist at all? Wait, "Transaction" already exists according to prompt.
            # But let's create it if missing, for safety
            order = SubMenu.objects.filter(menu=access_point).count() + 1
            transaction_menu = SubMenu.objects.create(name='Transaction', menu=access_point, is_active=True, order=order)
            print("Created Transaction menu")

    # Handle Entry Card
    entry_card = SubSubMenu.objects.filter(name='Entry Card').first()
    if entry_card:
        entry_card.submenu = transaction_menu
        entry_card.url = 'access-point/entry-card'
        entry_card.code = 'entry_card'
        entry_card.save()
        print("Moved existing Entry Card to Transaction")
    else:
        order = SubSubMenu.objects.filter(submenu=transaction_menu).count() + 1
        entry_card = SubSubMenu.objects.create(
            name='Entry Card',
            submenu=transaction_menu,
            url='access-point/entry-card',
            code='entry_card',
            is_active=True,
            order=order
        )
        print("Created new Entry Card menu under Transaction")

else:
    print("Could not find Access Point menu!")
