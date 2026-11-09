import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from team_app.serializers import TeamSerializer
from team_app.models import Team
from django.contrib.auth import get_user_model

# Clean up previously created teams
Team.objects.filter(name__startswith="Test Team").delete()

User = get_user_model()
user = User.objects.filter(username="testuser_tele").first()

data = {
    "name": "Test Team Final Verification 2",
    "lead": None,
    "members": [user.id] if user else [],
    "is_active": True
}

serializer = TeamSerializer(data=data)
if serializer.is_valid():
    print("Valid!")
    team = serializer.save()
    print("Saved team ID:", team.id, "Dept:", team.department.name)
else:
    print("Errors:", serializer.errors)
