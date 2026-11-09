import os, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'glenda_vite.settings')
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model
User = get_user_model()
u = User.objects.first()
c = Client()
c.force_login(u)
res = c.get('/api/geofence-history/?area=71')
print("Status:", res.status_code)
print("Content:", res.json())
