import os
import sys
import django
import requests
sys.path.append(r'c:\Archana\glenda_vite\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()
user = User.objects.first()
token = str(RefreshToken.for_user(user).access_token)
headers = {'Authorization': f'Bearer {token}'}

res = requests.get('http://localhost:8000/api/area/delivery-locations/?limit=10000&page_size=10000', headers=headers)
print("Status:", res.status_code)
if res.status_code != 200:
    print(res.text[:200])
else:
    data = res.json()
    print("Type:", type(data))
    if isinstance(data, list):
        print("Length:", len(data))
    elif isinstance(data, dict):
        print("Keys:", data.keys())
