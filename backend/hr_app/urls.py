from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UnitViewSet,
    DutyNameViewSet, ResponsibilityViewSet, AssignDutyandResponsibilityViewSet,
    EmployeeDutyStatusViewSet,
    CustomerTypeViewSet, HrDistributorViewSet, HrVendorViewSet, HrOtherCustomerViewSet,
    ResponsibilityReminderMasterViewSet, ResponsibilityReminderDetailViewSet, ResponsibilityUpdateViewSet
)

router = DefaultRouter()
router.register(r'units', UnitViewSet, basename='unit')
router.register(r'dutynames', DutyNameViewSet, basename='dutyname')
router.register(r'responsibilities', ResponsibilityViewSet, basename='responsibility')
router.register(r'assignduties', AssignDutyandResponsibilityViewSet, basename='assignduty')
router.register(r'employee-duty-status', EmployeeDutyStatusViewSet, basename='employee-duty-status')
router.register(r'customer-types', CustomerTypeViewSet, basename='customer-type')
router.register(r'hr-distributors', HrDistributorViewSet, basename='hr-distributor')
router.register(r'hr-vendors', HrVendorViewSet, basename='hr-vendor')
router.register(r'hr-other-customers', HrOtherCustomerViewSet, basename='hr-other-customer')
router.register(r'responsibility-reminders', ResponsibilityReminderMasterViewSet, basename='responsibility-reminders-master')
router.register(r'responsibility-reminders-detail', ResponsibilityReminderDetailViewSet, basename='responsibility-reminders-detail')
router.register(r'responsibility-updates', ResponsibilityUpdateViewSet, basename='responsibility-update')

urlpatterns = [
    path('', include(router.urls)),
]