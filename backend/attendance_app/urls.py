from django.urls import path, include
from rest_framework.routers import DefaultRouter
from attendance_app.views import (
    LeaveTypeViewSet,
    LeaveRequestViewSet,
    LeaveRequestDateViewSet,
    LeaveRequestForwardingViewSet,
    EmployeeLeaveTypeViewSet,
    EmployeeLeaveTransactionViewSet,
)

router = DefaultRouter()
router.register(r'leave-types', LeaveTypeViewSet, basename='leave-type')
router.register(r'leave-requests', LeaveRequestViewSet, basename='leave-request')
router.register(r'leave-request-dates', LeaveRequestDateViewSet, basename='leave-request-date')
router.register(r'leave-request-forwardings', LeaveRequestForwardingViewSet, basename='leave-request-forwarding')
router.register(r'employee-leave-types', EmployeeLeaveTypeViewSet, basename='employee-leave-type')
router.register(r'employee-leave-transactions', EmployeeLeaveTransactionViewSet, basename='employee-leave-transaction')

urlpatterns = [
    path('', include(router.urls)),
]