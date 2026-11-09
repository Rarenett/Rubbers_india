import os
import sys
import django
from django.test import Client
from django.contrib.auth import get_user_model

sys.path.append(r'c:\Archana\glenda_vite\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

User = get_user_model()
user = User.objects.first()
client = Client()
client.force_login(user)

response = client.get('/api/logistics/route-stop-masters/')
print("Status:", response.status_code)
if response.status_code != 200:
    print(response.content.decode('utf-8'))
