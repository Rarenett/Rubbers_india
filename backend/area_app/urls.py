from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AreaViewSet, SalesmanMappingViewSet, SalesmanVisitingViewSet, DeliveryLocationViewSet, AreaLocationMappingViewSet, AreaGeofenceHistoryViewSet, DeliveryLocationCoordinateViewSet, geocode_search, geocode_reverse

router = DefaultRouter()
router.register(r'areas', AreaViewSet)
router.register(r'delivery-locations', DeliveryLocationViewSet)
router.register(r'salesman-mappings', SalesmanMappingViewSet)
router.register(r'salesman-visitings', SalesmanVisitingViewSet)
router.register(r'area-location-mappings', AreaLocationMappingViewSet)
router.register(r'geofence-history', AreaGeofenceHistoryViewSet, basename='geofence-history')
router.register(r'delivery-location-coordinates', DeliveryLocationCoordinateViewSet, basename='delivery-location-coordinates')

urlpatterns = [
    path('geocode/', geocode_search, name='geocode_search'),
    path('geocode_reverse/', geocode_reverse, name='geocode_reverse'),
    path('', include(router.urls)),
]
