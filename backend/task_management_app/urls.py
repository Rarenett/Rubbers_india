from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, AdminTaskViewSet

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'admin-tasks', AdminTaskViewSet, basename='admin-task')

urlpatterns = [
    path('', include(router.urls)),
]
