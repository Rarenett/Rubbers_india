from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ComplaintCategoryViewSet, 
    ComplaintViewSet,
    PatternViewSet,
    CommentActionViewSet,
    PriorityRuleViewSet
)

router = DefaultRouter()
router.register(r'categories', ComplaintCategoryViewSet)
router.register(r'complaints', ComplaintViewSet)
router.register(r'patterns', PatternViewSet)
router.register(r'actions', CommentActionViewSet)
router.register(r'priority-rules', PriorityRuleViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
