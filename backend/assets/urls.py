from django.urls import path
from .views import (
    DashboardStatsView, RecentAllocationsView, AssetSplitView,
    AllocationTrendView, RoomDistributionView, StorageRoomListView,
    StorageRoomDetailView, ShelfListView, ShelfDetailView, RackListView, 
    RackDetailView, AssetTypeListView, AssetTypeDetailView, FileListView,
    FileDetailView, FileAllocationListView, AllocateFileView,
    ReturnFileView, ReallocateFileView, UpdateAllocationResponseView,
    FileAllocationReportView,
    KeyListView, KeyDetailView, KeyAllocationListView, AllocateKeyView,
    UpdateKeyAllocationResponseView, ReturnKeyView, ReallocateKeyView,
    KeyAllocationReportView, FileAllocationHistoryView, KeyAllocationHistoryView
)

urlpatterns = [
    # Dashboard
    path('dashboard/stats/', DashboardStatsView.as_view(), name='asset-stats'),
    path('dashboard/recent-allocations/', RecentAllocationsView.as_view(), name='recent-allocations'),
    path('dashboard/asset-split/', AssetSplitView.as_view(), name='asset-split'),
    path('dashboard/allocation-trend/', AllocationTrendView.as_view(), name='allocation-trend'),
    path('dashboard/room-distribution/', RoomDistributionView.as_view(), name='room-distribution'),

    # Storage structure
    path('rooms/', StorageRoomListView.as_view(), name='room-list'),
    path('rooms/<int:pk>/', StorageRoomDetailView.as_view(), name='room-detail'),
    path('shelves/', ShelfListView.as_view(), name='shelf-list'),
    path('shelves/<int:pk>/', ShelfDetailView.as_view(), name='shelf-detail'),
    path('racks/', RackListView.as_view(), name='rack-list'),
    path('racks/<int:pk>/', RackDetailView.as_view(), name='rack-detail'),
    path('asset-types/', AssetTypeListView.as_view(), name='asset-type-list'),
    path('asset-types/<int:pk>/', AssetTypeDetailView.as_view(), name='asset-type-detail'),

    # Files
    path('files/', FileListView.as_view(), name='file-list'),
    path('files/<int:pk>/', FileDetailView.as_view(), name='file-detail'),
    path('files/<int:pk>/history/', FileAllocationHistoryView.as_view(), name='file-history'),

    # Allocations
    path('allocations/', FileAllocationListView.as_view(), name='allocation-list'),
    path('allocations/report/', FileAllocationReportView.as_view(), name='allocation-report'),
    path('allocations/allocate/', AllocateFileView.as_view(), name='allocate-file'),
    path('allocations/<int:pk>/response/', UpdateAllocationResponseView.as_view(), name='allocation-response'),
    path('allocations/<int:pk>/return/', ReturnFileView.as_view(), name='return-file'),
    path('allocations/<int:pk>/reallocate/', ReallocateFileView.as_view(), name='reallocate-file'),

    # Keys
    path('keys/', KeyListView.as_view(), name='key-list'),
    path('keys/<int:pk>/', KeyDetailView.as_view(), name='key-detail'),
    path('keys/<int:pk>/history/', KeyAllocationHistoryView.as_view(), name='key-history'),

    # Key Allocations
    path('key-allocations/', KeyAllocationListView.as_view(), name='key-allocation-list'),
    path('key-allocations/report/', KeyAllocationReportView.as_view(), name='key-allocation-report'),
    path('key-allocations/allocate/', AllocateKeyView.as_view(), name='allocate-key'),
    path('key-allocations/<int:pk>/response/', UpdateKeyAllocationResponseView.as_view(), name='key-allocation-response'),
    path('key-allocations/<int:pk>/return/', ReturnKeyView.as_view(), name='return-key'),
    path('key-allocations/<int:pk>/reallocate/', ReallocateKeyView.as_view(), name='reallocate-key'),
]

from rest_framework.routers import DefaultRouter
from .views import (
    AssetCategoryViewSet, AssetAttributeDefinitionViewSet,
    AssetAttributeValueViewSet, AssetDocumentViewSet, AssetMaintenanceViewSet,
    AssetViewSet, AssetAllocationViewSet, AssetAllocationItemViewSet, AssetTransferViewSet
)

router = DefaultRouter()
router.register(r'entities/categories', AssetCategoryViewSet, basename='assetcategory')
router.register(r'entities/attribute-definitions', AssetAttributeDefinitionViewSet, basename='attribute-definition')
router.register(r'entities/attribute-values', AssetAttributeValueViewSet, basename='attribute-value')
router.register(r'entities/documents', AssetDocumentViewSet, basename='asset-document')
router.register(r'entities/maintenances', AssetMaintenanceViewSet, basename='asset-maintenance')
router.register(r'entities/assets', AssetViewSet, basename='asset-entity')
router.register(r'entities/allocations', AssetAllocationViewSet, basename='asset-allocation')
router.register(r'entities/allocation-items', AssetAllocationItemViewSet, basename='allocation-item')
router.register(r'entities/transfers', AssetTransferViewSet, basename='asset-transfer')

urlpatterns += router.urls
