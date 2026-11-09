import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings') # Change backend.settings to actual settings if needed
import sys

# find the correct settings module
sys.path.append(r'C:\Archana\glenda_vite\backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
user = User.objects.first()

client = APIClient()
client.force_authenticate(user=user)

try:
    response = client.get('/api/auth/inactivity-timeout/', HTTP_ACCEPT='application/json', HTTP_HOST='127.0.0.1:8000')
    print("Status:", response.status_code)
    with open('c:/Archana/glenda_vite/scratch/500_error.html', 'wb') as f:
        f.write(response.content)
except Exception as e:
    import traceback
    traceback.print_exc()

