import json
from register_app.models import Menu
from register_app.serializers import UserMenuTreeSerializer
from django.contrib.auth import get_user_model

User = get_user_model()
user = User.objects.filter(role_id=18).first()
if user:
    menus = Menu.objects.filter(is_active=True).distinct().order_by('order')
    serializer = UserMenuTreeSerializer(menus, many=True, context={'user': user})
    with open('gg_menus.json', 'w') as f:
        json.dump(serializer.data, f, indent=2)
else:
    print('No user with role 18')
