import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
import requests

User = get_user_model()
user = User.objects.filter(is_active=True).first()

if not user:
    print("No active users found.")
else:
    print(f"Testing with user: {user.email}")
    refresh = RefreshToken.for_user(user)
    access_token = str(refresh.access_token)
    
    headers = {
        'Authorization': f'Bearer {access_token}'
    }
    
    response = requests.get('http://127.0.0.1:8000/api/emails/internal_users/', headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
