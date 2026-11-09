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
if not user:
    print("No user")
    sys.exit(1)

refresh = RefreshToken.for_user(user)
token = str(refresh.access_token)

headers = {'Authorization': f'Bearer {token}'}
res = requests.get('http://localhost:8000/api/area/delivery-locations/', headers=headers)
print("Response Status:", res.status_code)
if res.status_code != 200:
    print(res.text)
else:
    data = res.json()
    print("Data type:", type(data))
    if isinstance(data, dict):
        print("Keys:", data.keys())
    elif isinstance(data, list):
        print("List length:", len(data))
