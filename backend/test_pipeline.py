import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from team_app.serializers import TeamSerializer
from team_app.models import Team
from django.contrib.auth import get_user_model
from rarenett_app.models import Department, Employee, DepartmentDesignation, Designation

User = get_user_model()

dept, _ = Department.objects.get_or_create(name="Tele Calling")
desig, _ = Designation.objects.get_or_create(name="Caller")

dept_desig, _ = DepartmentDesignation.objects.get_or_create(
    department=dept, designation=desig
)

# create test user
user, _ = User.objects.get_or_create(username="testuser_tele")
emp, _ = Employee.objects.get_or_create(user=user)
emp.dept_designation = dept_desig
emp.save()

data = {
    "name": "Test Team 12345",
    "department": dept.id,
    "lead": None,
    "members": [user.id],
    "is_active": True
}

serializer = TeamSerializer(data=data)
if serializer.is_valid():
    print("Valid!")
    team = serializer.save()
    print("Saved team ID:", team.id)
else:
    print("Errors:", serializer.errors)
