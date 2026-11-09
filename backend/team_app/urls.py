from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TeamViewSet, DepartmentEmployeesView

router = DefaultRouter()
router.register(r'teams', TeamViewSet)

urlpatterns = [
    path('department-employees/<int:department_id>/', DepartmentEmployeesView.as_view(), name='department-employees'),
    path('', include(router.urls)),
]
