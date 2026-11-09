from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    marketing_visit_report, marketing_followup_report, marketing_executive_visit_report, MarketingLeadViewSet, MarketingAttendanceViewSet, MarketingTravelViewSet, 
    MarketingShopVisitViewSet, MarketingShopPhotoViewSet, MarketingWishlistViewSet,
    area_customers, delivery_location_customers, area_location_customers)

router = DefaultRouter()
router.register(r'marketing/lead', MarketingLeadViewSet)
router.register(r'marketing/attendance', MarketingAttendanceViewSet)
router.register(r'marketing/travel', MarketingTravelViewSet)
router.register(r'marketing/shop-visit', MarketingShopVisitViewSet)
router.register(r'marketing/shop-photo', MarketingShopPhotoViewSet)
router.register(r'marketing/wishlist', MarketingWishlistViewSet)


from .views import MarketingOrderViewSet
router.register(r'marketing/orders', MarketingOrderViewSet, basename='marketing-orders')

urlpatterns = [
    path('marketing/visit_report/', marketing_visit_report, name='marketing_visit_report'),
    path('marketing/followup_report/', marketing_followup_report, name='marketing_followup_report'),
    path('marketing/executive_visit_report/', marketing_executive_visit_report, name='marketing_executive_visit_report'),
    path('marketing/orders/area-customers/', area_customers, name='area_customers'),
    path('marketing/orders/delivery-location-customers/', delivery_location_customers, name='delivery_location_customers'),
    path('marketing/orders/area-location-customers/', area_location_customers, name='area_location_customers'),
    path('', include(router.urls)),
]
