from rest_framework import viewsets, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import get_user_model
from .models import Team
from .serializers import TeamSerializer

User = get_user_model()

class TeamViewSet(viewsets.ModelViewSet):
    queryset = Team.objects.all()
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['department', 'lead', 'is_active']
    search_fields = ['name']

class DepartmentEmployeesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, department_id):
        users = User.objects.filter(
            employee__dept_designation__department_id=department_id, 
            is_active=True
        ).select_related('employee__dept_designation__designation')
        
        data = []
        for user in users:
            designation_name = "N/A"
            if hasattr(user, 'employee') and user.employee and user.employee.dept_designation:
                designation_name = user.employee.dept_designation.designation.name
            
            data.append({
                'id': user.id,
                'username': user.username,
                'full_name': f"{user.first_name} {user.last_name}".strip() or user.username,
                'email': user.email,
                'designation': designation_name
            })
            
        return Response(data)
