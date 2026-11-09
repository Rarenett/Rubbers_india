from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ExitCardViewSet,
    EntryCardViewSet,
    ParkAreaViewSet, ParkingFeeViewSet,
    GateViewSet, GateCategoryViewSet, GateSubCategoryViewSet,
    EntryTagViewSet, GeneratedTagViewSet, VisitorViewSet, GateEntryViewSet,
    GateEntryReallocationViewSet, VehicleTypeViewSet, VehicleViewSet, VehicleEntryViewSet,
    EmployeeGateEntryViewSet, ApprovelessEntryConfigViewSet, EquipmentViewSet
)

router = DefaultRouter()
router.register(r'gates', GateViewSet)
router.register(r'categories', GateCategoryViewSet)
router.register(r'subcategories', GateSubCategoryViewSet)
router.register(r'entry-tags', EntryTagViewSet)
router.register(r'generated-tags', GeneratedTagViewSet)
router.register(r'visitors', VisitorViewSet)
router.register(r'gate-entries', GateEntryViewSet)
router.register(r'employee-entries', EmployeeGateEntryViewSet)
router.register(r'reallocations', GateEntryReallocationViewSet)
router.register(r'vehicle-types', VehicleTypeViewSet)
router.register(r'vehicles', VehicleViewSet)
router.register(r'vehicle-entries', VehicleEntryViewSet)
router.register(r'approveless-configs', ApprovelessEntryConfigViewSet, basename='approveless-config')
router.register(r'equipments', EquipmentViewSet)
router.register(r'entry-cards', EntryCardViewSet)
router.register(r'exit-cards', ExitCardViewSet)
router.register(r'park-areas', ParkAreaViewSet)
router.register(r'parking-fees', ParkingFeeViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
