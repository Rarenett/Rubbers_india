from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DistributionZoneListView, DistributionZoneDetailView,
    LeadViewSet, LeadCategoryViewSet,
    TeleCallingProjectViewSet, LeadAssignmentViewSet,
    LeadInteractionLogViewSet, TelecallerPerformanceView,
    CallSessionViewSet
)

from .views import DistributorLeadViewSet, VendorLeadViewSet
from crm.views import CrmPurposeViewSet, CrmOfferViewSet
router = DefaultRouter()
router.register(r'offers', CrmOfferViewSet, basename='crm-app-offer')
router.register(r'purposes', CrmPurposeViewSet, basename='crm-app-purpose')
router.register(r'distributor-leads', DistributorLeadViewSet, basename='distributor-lead')
router.register(r'vendor-leads', VendorLeadViewSet, basename='vendor-lead')
router.register(r'leads', LeadViewSet, basename='lead')
router.register(r'categories', LeadCategoryViewSet, basename='lead-category')
router.register(r'projects', TeleCallingProjectViewSet, basename='tele-project')
router.register(r'assignments', LeadAssignmentViewSet, basename='lead-assignment')
router.register(r'interaction-logs', LeadInteractionLogViewSet, basename='interaction-log')
router.register(r'call-sessions', CallSessionViewSet, basename='call-session')

urlpatterns = [
    path('distribution-zones/', DistributionZoneListView.as_view(), name='distribution_zone_list'),
    path('distribution-zones/<int:pk>/', DistributionZoneDetailView.as_view(), name='distribution_zone_detail'),

    path('', include(router.urls)),
    path('performance-stats/', TelecallerPerformanceView.as_view(), name='performance-stats'),
]
