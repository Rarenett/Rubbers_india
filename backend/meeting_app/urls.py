from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet, SubcategoryViewSet, MeetingRoomViewSet, 
    MeetingViewSet, MeetingParticipantViewSet, AgendaViewSet, 
    ParticipantEntryLogViewSet, CommentViewSet, AgendaTaskViewSet,
    AudioToTextView
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'subcategories', SubcategoryViewSet)
router.register(r'meeting-rooms', MeetingRoomViewSet)
router.register(r'meetings', MeetingViewSet)
router.register(r'meeting-participants', MeetingParticipantViewSet)
router.register(r'agendas', AgendaViewSet)
router.register(r'entry-logs', ParticipantEntryLogViewSet)
router.register(r'comments', CommentViewSet)
router.register(r'tasks', AgendaTaskViewSet)

urlpatterns = [
    path('meetings/my_meetings/', MeetingViewSet.as_view({'get': 'my_meetings'}), name='my-meetings'),
    path('meetings/<int:pk>/enter_meeting/', MeetingViewSet.as_view({'post': 'enter_meeting'}), name='enter-meeting'),
    path('audio-to-text/', AudioToTextView.as_view(), name='audio-to-text'),
    path('', include(router.urls)),
]
