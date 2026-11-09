from rest_framework import generics, permissions
from rest_framework.response import Response
from .models import ChatMessage
from .serializers import ChatMessageSerializer
import time

from .utils import get_ai_response

class ChatListCreateView(generics.ListCreateAPIView):
    serializer_class = ChatMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ChatMessage.objects.filter(user=self.request.user).order_by('created_at')

    def perform_create(self, serializer):
        # Save user message
        user_message = serializer.save(user=self.request.user, sender='user')
        
        # Generate Bot Response
        text = user_message.text.lower().strip()
        response_text = None
        
        # 1. Try AI Response
        ai_reply = get_ai_response(user_message.text)
        if ai_reply:
            response_text = ai_reply
        
        # 2. Fallback to Keyword Logic if AI failed or no key
        if not response_text:
            response_text = "I'm not sure how to respond to that. You can ask me about 'pricing', 'tools', or say 'hello'."
            
            if any(word in text for word in ["hello", "hi", "hey", "hyy", "yo", "greetings"]):
                response_text = "Hello! How can I assist you today? You can ask about our pricing or tools."
            elif "pricing" in text or "cost" in text or "price" in text:
                response_text = "We have plans starting at $10/month. Would you like to know more about our Enterprise options?"
            elif "tools" in text or "feature" in text:
                response_text = "Our platform offers usage analytics, task management, team collaboration, and automated reports."
            elif any(word in text for word in ["yes", "sure", "okay", "yeah"]):
                response_text = "Great! Is there anything specific you'd like to dive into?"
            elif "help" in text or "support" in text:
                response_text = "I can help with Pricing, Tools, or Technical queries. Or you can contact support@jampack.com."
            elif "thank" in text:
                response_text = "You're welcome! Happy to help."
        
        # Create bot message
        ChatMessage.objects.create(
            user=self.request.user,
            text=response_text,
            sender='bot'
        )

    def create(self, request, *args, **kwargs):
        # Override create to return the full list or just the new messages? 
        # Standard create returns the created object (User message).
        # But we want the frontend to see the bot response too.
        # Let's return the User message as normal. 
        # The frontend can fetch the updated list OR we can return a custom response.
        # For simplicity, we just save. Frontend should probably re-fetch or we send back both.
        # Let's send back the user message first, 
        # BUT wait, the Frontend adds the user message optimistically. 
        # It needs the BOT RESPONSE.
        
        response = super().create(request, *args, **kwargs)
        
        # Append bot response to the returned data if we want, OR
        # better: Frontend polls or checks.
        # actually, let's return the BOT message in the response too, 
        # or just return the list of new messages.
        
        # Let's get the latest bot message
        bot_message = ChatMessage.objects.filter(user=request.user, sender='bot').last()
        bot_serializer = self.get_serializer(bot_message)
        
        return Response({
            'user_message': response.data,
            'bot_message': bot_serializer.data
        })
