from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RenewalSubjectViewSet, RenewalReminderViewSet

router = DefaultRouter()
router.register(r'subjects', RenewalSubjectViewSet, basename='renewalsubject')
router.register(r'reminders', RenewalReminderViewSet, basename='renewalreminder')

urlpatterns = [
    path('', include(router.urls)),
]
