from django.urls import path, include
from rest_framework.routers import DefaultRouter
from payroll_app.views import (
    PayrollUnitViewSet,
    PayrollCompoundUnitViewSet,
    AttendanceProductionTypeViewSet,
    CalculationTypeViewSet,
    PayHeadViewSet,
    EmployeePayHeadViewSet,
)

router = DefaultRouter()
router.register(r'payroll-units', PayrollUnitViewSet, basename='payroll-unit')
router.register(r'payroll-compound-units', PayrollCompoundUnitViewSet, basename='payroll-compound-unit')
router.register(r'attendance-production-types', AttendanceProductionTypeViewSet, basename='attendance-production-type')
router.register(r'calculation-types', CalculationTypeViewSet, basename='calculation-type')
router.register(r'calculationtypes', CalculationTypeViewSet, basename='calculationtype')
router.register(r'pay-heads', PayHeadViewSet, basename='pay-head')
router.register(r'payheads', PayHeadViewSet, basename='payhead')
router.register(r'employee-payheads', EmployeePayHeadViewSet, basename='employee-payhead')
router.register(r'employeepayheads', EmployeePayHeadViewSet, basename='employeepayhead')

urlpatterns = [
    path('', include(router.urls)),
]