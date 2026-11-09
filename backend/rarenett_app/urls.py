from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rarenett_app import views
from rarenett_app.dashboard_views import CompanyDashboardAPIView


router = DefaultRouter()
router.register(r'users', views.CustomUserViewSet)
router.register(r'departments', views.DepartmentViewSet)
router.register(r'designations', views.DesignationViewSet)
router.register(r'department-designations', views.DepartmentDesignationViewSet)
router.register(r'candidates', views.CandidateViewSet)
router.register(r'employees', views.EmployeeViewSet)
router.register(r'employment-details', views.EmploymentDetailsViewSet)
router.register(r'documents', views.EmployeeDocumentUploadViewSet)
router.register(r'bank-details', views.BankDetailsViewSet)
router.register(r'bod', views.BoardOfDirectorViewSet)

router.register(r'work-experiences', views.EmployeeWorkExperienceViewSet)
router.register(r'employee-department-history', views.EmployeeDepartmentHistoryViewSet, basename='employee-department-history')

urlpatterns = [
    path('', include(router.urls)),
    path('company-dashboard/', CompanyDashboardAPIView.as_view(), name='company-dashboard'),
]
