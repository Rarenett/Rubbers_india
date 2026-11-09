import os
import sys
import django
from django.test import Client

sys.path.append(r'c:\Archana\glenda_vite\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User
user = User.objects.first()
client = Client()
client.force_login(user)

response = client.get('/api/area/delivery-locations/')
print(response.json())
