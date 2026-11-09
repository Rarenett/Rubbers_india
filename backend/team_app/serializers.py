from rest_framework import serializers
from .models import Team
from django.contrib.auth import get_user_model
from rarenett_app.models import Department

User = get_user_model()

class BasicUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    designation = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'designation']

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username

    def get_designation(self, obj):
        if hasattr(obj, 'employee') and obj.employee and obj.employee.dept_designation:
            return obj.employee.dept_designation.designation.name
        return "N/A"

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name']

class TeamSerializer(serializers.ModelSerializer):
    lead_detail = BasicUserSerializer(source='lead', read_only=True)
    members_detail = BasicUserSerializer(source='members', many=True, read_only=True)
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=False)
    department_detail = DepartmentSerializer(source='department', read_only=True)

    class Meta:
        model = Team
        fields = [
            'id', 'name', 'department', 'department_detail',
            'lead', 'lead_detail', 'members', 'members_detail',
            'is_active', 'created_at', 'updated_at'
        ]

    def validate_members(self, value):
        if not value:
            raise serializers.ValidationError("A team must contain at least one Tele Calling employee.")

        for user in value:
            # Check if user has employee and department
            if not hasattr(user, 'employee') or not user.employee or not user.employee.dept_designation:
                raise serializers.ValidationError(f"Employee {user.username} does not have a department.")
            if user.employee.dept_designation.department.name != "Tele Calling":
                raise serializers.ValidationError(f"Employee {user.username} does not belong to the Tele Calling department.")

            # Check if already assigned to another team
            existing_teams = user.member_teams.all()
            if self.instance:
                existing_teams = existing_teams.exclude(id=self.instance.id)
            if existing_teams.exists():
                raise serializers.ValidationError(f"Employee {user.username} is already assigned to another team.")
        
        return value

    def validate_lead(self, value):
        if value:
            if not hasattr(value, 'employee') or not value.employee or not value.employee.dept_designation:
                raise serializers.ValidationError(f"Lead {value.username} does not have a department.")
            if value.employee.dept_designation.department.name != "Tele Calling":
                raise serializers.ValidationError(f"Lead {value.username} does not belong to the Tele Calling department.")
        return value

    def validate(self, data):
        data = super().validate(data)
        
        tele_calling_dept = Department.objects.filter(name="Tele Calling").first()
        if not tele_calling_dept:
            raise serializers.ValidationError({"department": "Tele Calling department does not exist in the database."})
        
        data['department'] = tele_calling_dept

        members = data.get('members')
        if members is None and self.instance:
            members = self.instance.members.all()
            
        lead = data.get('lead')
        if 'lead' not in data and self.instance:
            lead = self.instance.lead

        if lead and members is not None:
            if lead not in members:
                raise serializers.ValidationError({"lead": "The team lead must be one of the selected team members."})

        return data
