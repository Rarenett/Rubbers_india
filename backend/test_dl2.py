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

response = client.get('/api/area/delivery-locations/')
data = response.json()
print("Data type:", type(data))
if isinstance(data, dict):
    print("Keys:", data.keys())
    print("Count:", data.get('count'))
