from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    VehicleCategoryListView, VehicleCategoryDetailView,
    VehicleListView, VehicleDetailView,DriverDetailView,DriverListCreateView,ServiceTypeListView,ServiceTypeDetailView,
    VehicleHistoryListView,VehicleHistoryDetailView,VehicleLookupView,VehicleHistoryNextNumberView,DriverAuditLogListView,
    VehicleAuditLogListView,VehicleHistoryAuditLogListView, FineAndTokenListView, FineAndTokenDetailView,
    DriverJourneyListCreateView, DriverJourneyDetailView, DriverRouteListCreateView, DriverRouteDetailView, ServiceRequestListCreateView, ServiceRequestDetailView,
    RouteMasterListView, RouteMasterDetailView, TripMasterListView, TripMasterDetailView,
    PackageTypeListView, PackageTypeDetailView,
    ItemSpecificationListView, ItemSpecificationDetailView,
    TripLoadingDataView, TripAvailableOrdersView, TripLoadOrderView, TripUnloadOrderView, TripEditLoadedOrderView,
    TyreSizeViewSet,
    RouteStopMasterListView, RouteStopMasterDetailView
)

router = DefaultRouter()
router.register(r'tyre-sizes', TyreSizeViewSet, basename='tyresize')


urlpatterns = [
    path('', include(router.urls)),
    path('vehicle-categories/', VehicleCategoryListView.as_view(), name='vehicle_category_list'),
    path('vehicle-categories/<int:pk>/', VehicleCategoryDetailView.as_view(), name='vehicle_category_detail'),
    path('vehicles/', VehicleListView.as_view(), name='vehicle_list'),
    path('vehicles/<int:pk>/', VehicleDetailView.as_view(), name='vehicle_detail'),
    path('drivers/<int:pk>/',DriverDetailView.as_view(),name='driver-detail'),
    path('drivers/',DriverListCreateView.as_view(),name='driver-list-create'),
    # Service Types
    path('service-types/',ServiceTypeListView.as_view(),   name='service_type_list'),
    path('service-types/<int:pk>/', ServiceTypeDetailView.as_view(), name='service_type_detail'),

    # Vehicle History
    path('vehicle-history/',          VehicleHistoryListView.as_view(),   name='vehicle_history_list'),
    path('vehicle-history/<int:pk>/', VehicleHistoryDetailView.as_view(), name='vehicle_history_detail'),
    path('vehicle-lookup/<int:pk>/',VehicleLookupView.as_view(),name='vehicle_lookup'),

    path('vehicle-history-next-no/',VehicleHistoryNextNumberView.as_view(),name='vehicle_history_next_no'),

    # Log
    path('driver-audit-log/',DriverAuditLogListView.as_view(),name='driver_audit_log'),

    path('vehicle-audit-log/', VehicleAuditLogListView.as_view(), name='vehicle_audit_log'),

     path('vehicle-history-audit-log/', VehicleHistoryAuditLogListView.as_view(), name='vehicle_history_audit_log'),

     path('fines/', FineAndTokenListView.as_view(), name='fine_and_token_list'),
     path('fines/<int:pk>/', FineAndTokenDetailView.as_view(), name='fine_and_token_detail'),
     
     path('journeys/', DriverJourneyListCreateView.as_view(), name='driver_journey_list'),
     path('journeys/<int:pk>/', DriverJourneyDetailView.as_view(), name='driver_journey_detail'),
     
     path('routes/', DriverRouteListCreateView.as_view(), name='driver_route_list'),
     path('routes/<int:pk>/', DriverRouteDetailView.as_view(), name='driver_route_detail'),
     
     path('service-requests/', ServiceRequestListCreateView.as_view(), name='service_request_list'),
     path('service-requests/<int:pk>/', ServiceRequestDetailView.as_view(), name='service_request_detail'),
     
     path('route-masters/', RouteMasterListView.as_view(), name='route_master_list'),
     path('route-masters/<int:pk>/', RouteMasterDetailView.as_view(), name='route_master_detail'),
     
     path('trip-masters/', TripMasterListView.as_view(), name='trip_master_list'),
     path('trip-masters/<int:pk>/', TripMasterDetailView.as_view(), name='trip_master_detail'),
     path('trips/<int:pk>/loading-data/', TripLoadingDataView.as_view(), name='trip_loading_data'),
     path('trips/<int:pk>/available-orders/', TripAvailableOrdersView.as_view(), name='trip_available_orders'),
     path('trips/<int:pk>/load-order/', TripLoadOrderView.as_view(), name='trip_load_order'),
     path('trips/<int:pk>/unload-order/', TripUnloadOrderView.as_view(), name='trip_unload_order'),
     path('trips/<int:pk>/edit-loaded-order/', TripEditLoadedOrderView.as_view(), name='trip_edit_loaded_order'),
     
     path('package-types/', PackageTypeListView.as_view(), name='package_type_list'),
     path('package-types/<int:pk>/', PackageTypeDetailView.as_view(), name='package_type_detail'),
     
     path('item-specifications/', ItemSpecificationListView.as_view(), name='item_specification_list'),
     path('item-specifications/<int:pk>/', ItemSpecificationDetailView.as_view(), name='item_specification_detail'),

     path('route-stop-masters/', RouteStopMasterListView.as_view(), name='route_stop_master_list'),
     path('route-stop-masters/<int:pk>/', RouteStopMasterDetailView.as_view(), name='route_stop_master_detail'),
]
