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

response = client.get('/api/area/delivery-locations/?limit=10')
data = response.json()
print("Status:", response.status_code)
if response.status_code == 200:
    results = data.get('results', data)
    if isinstance(results, list) and len(results) > 0:
        print("First item keys:", results[0].keys())
        print("First item 'area' field:", results[0].get('area'))
