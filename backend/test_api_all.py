import os
import sys
import django

sys.path.append(r'c:\Archana\glenda_vite\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
import requests

User = get_user_model()
user = User.objects.first()

refresh = RefreshToken.for_user(user)
token = str(refresh.access_token)
headers = {'Authorization': f'Bearer {token}'}

urls = [
    '/api/area/area-location-mappings/',
    '/api/area/areas/',
    '/api/logistics/route-stop-masters/'
]

for url in urls:
    res = requests.get(f'http://localhost:8000{url}', headers=headers)
    print(f"URL: {url}")
    print(f"Status: {res.status_code}")
    if res.status_code != 200:
        print(f"Error: {res.text[:200]}")
