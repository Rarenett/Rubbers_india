import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model

User = get_user_model()
client = Client()

# Find an active user
user = User.objects.filter(is_active=True).first()
if not user:
    print("No active users found.")
else:
    print(f"Testing with user: {user.email}")
    client.force_login(user)
    response = client.get('/api/emails/internal_users/')
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.content.decode('utf-8')}")

