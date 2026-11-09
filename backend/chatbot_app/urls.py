from django.urls import path
from .views import ChatListCreateView

urlpatterns = [
    path('messages/', ChatListCreateView.as_view(), name='chat-messages'),
]
