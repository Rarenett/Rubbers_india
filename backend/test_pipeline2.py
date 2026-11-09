import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from team_app.serializers import TeamSerializer
from django.contrib.auth import get_user_model

User = get_user_model()
user = User.objects.filter(username="testuser_tele").first()

data = {
    "name": "Test Team Final Verification 1",
    "lead": None,
    "members": [user.id] if user else [],
    "is_active": True
}

# we omit department
serializer = TeamSerializer(data=data)
if serializer.is_valid():
    print("Valid!")
    team = serializer.save()
    print("Saved team ID:", team.id, "Dept:", team.department.name)
else:
    print("Errors:", serializer.errors)
