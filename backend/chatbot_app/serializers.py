from rest_framework import serializers
from .models import ChatMessage

class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'user', 'text', 'sender', 'created_at']
        read_only_fields = ['user', 'sender', 'created_at']
