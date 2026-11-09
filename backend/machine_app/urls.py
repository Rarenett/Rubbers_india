from django.urls import path, include
from rest_framework.routers import DefaultRouter
# pyrefly: ignore [missing-import]
from .views import (
    SparePartViewSet,
    LifespanViewSet,
    TypeNameViewSet,
    CategoryNameViewSet,
    SubCategoryNameViewSet,
    ProcessNameViewSet,
    MachineDataCollectionViewSet,
    RepairRequestViewSet,
    MachineProductMappingViewSet,
    MachineOutputViewSet,
    MachineDataCollectionFieldsView,
    MachineDataCollectionConfigurationViewSet,
    RepairPartViewSet
)

router = DefaultRouter()
router.register(r'repair-parts', RepairPartViewSet)
router.register(r'spareparts', SparePartViewSet)
router.register(r'lifespans', LifespanViewSet)
router.register(r'typename', TypeNameViewSet)
router.register(r'categoryname', CategoryNameViewSet)
router.register(r'subcategoryname', SubCategoryNameViewSet)
router.register(r'processname', ProcessNameViewSet)
router.register(r'machinedatacollections', MachineDataCollectionViewSet)
router.register(r'repairrequests', RepairRequestViewSet)
router.register(r'machineproductmappings', MachineProductMappingViewSet)
router.register(r'machineoutputs', MachineOutputViewSet)
router.register(r'machine-data-configuration', MachineDataCollectionConfigurationViewSet,
    RepairPartViewSet)

urlpatterns = [
    path('machine-data-fields/', MachineDataCollectionFieldsView.as_view(), name='machine-data-fields'),
    path('', include(router.urls)),
]