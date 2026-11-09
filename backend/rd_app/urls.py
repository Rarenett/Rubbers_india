from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RnDEntryViewSet, ExtraQuantityViewSet

router = DefaultRouter()
router.register(r'entries', RnDEntryViewSet, basename='rnd-entry')
router.register(r'extra-quantities', ExtraQuantityViewSet, basename='extra-quantity')

urlpatterns = [
    path('', include(router.urls)),
]