import os, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
from register_app.models import Menu
from register_app.serializers import UserMenuTreeSerializer
from rest_framework.request import Request
from django.test import RequestFactory
factory = RequestFactory()
request = factory.get('/')
user = User.objects.filter(role__name__icontains='Associate').first()
if not user:
    user = User.objects.filter(role__name__icontains='Distributor').first()
request.user = user
drf_request = Request(request)
from register_app.permissions_utils import get_user_permissions
user_perms = get_user_permissions(user)
menus = Menu.objects.filter(is_active=True).order_by('order')
serializer = UserMenuTreeSerializer(menus, many=True, context={'request': drf_request, 'user': user, 'user_perms': user_perms})
for m in serializer.data:
    if m['name'] == 'Sales':
        for sm in m.get('submenus', []):
            if sm['name'] == 'Transaction':
                print('Transaction subsubmenus:')
                for ssm in sm.get('subsubmenus', []):
                    print(f"  {ssm['name']}: {ssm.get('can_view')}")
