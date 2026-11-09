from django.urls import path, include
from rest_framework.routers import DefaultRouter
from production_app.views import (
    EmployeeGroupViewSet, EmployeeGroupMemberViewSet,
    ShiftViewSet, ProductionLineViewSet, ShiftPlanViewSet,
    ShiftPlanDayViewSet, ShiftProductionLineViewSet, ShiftProductionEmployeeViewSet,
    ProductionAttendanceViewSet, ProductionBreakLogViewSet, BreakTypeMasterViewSet,
    PostProductionEntryViewSet, PostProductionResponsibilityViewSet,
    AdjustmentViewSet
)

router = DefaultRouter()
router.register(r'employee-groups', EmployeeGroupViewSet)
router.register(r'employee-group-members', EmployeeGroupMemberViewSet)
router.register(r'shifts', ShiftViewSet)
router.register(r'production-lines', ProductionLineViewSet)
router.register(r'shift-plans', ShiftPlanViewSet)
router.register(r'shift-plan-days', ShiftPlanDayViewSet)
router.register(r'shift-production-lines', ShiftProductionLineViewSet)
router.register(r'shift-production-employees', ShiftProductionEmployeeViewSet)
router.register(r'attendance', ProductionAttendanceViewSet, basename='attendance')
router.register(r'break-logs', ProductionBreakLogViewSet, basename='break-logs')
router.register(r'break-types', BreakTypeMasterViewSet)
router.register(r'post-production-entries', PostProductionEntryViewSet)
router.register(r'post-production-responsibilities', PostProductionResponsibilityViewSet)
router.register(r'adjustments', AdjustmentViewSet, basename='adjustments')

urlpatterns = [
    path('', include(router.urls)),
]