import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from team_app.serializers import TeamSerializer
from team_app.models import Team
from django.contrib.auth import get_user_model
from rarenett_app.models import Department

User = get_user_model()
user = User.objects.first()
dept = Department.objects.filter(name="Tele Calling").first()

data = {
    "name": "Test Team 123",
    "department": dept.id if dept else None,
    "lead": None,
    "members": [user.id] if user else [],
    "is_active": True
}

serializer = TeamSerializer(data=data)
if serializer.is_valid():
    print("Valid!")
else:
    print("Errors:", serializer.errors)
