import time
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.core.cache import cache

class SingleSessionJWTAuthentication(JWTAuthentication):
    """
    Enforces single active session per user. If another device logs in and forces logout,
    previous sessions fail authentication.
    """
    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)

        is_agent = validated_token.get('is_agent', False)
        token_session_id = validated_token.get('session_token')
        active_session_id = getattr(user, 'active_session_token', None) or cache.get(f'active_session_{user.id}')

        if not is_agent and token_session_id and active_session_id and token_session_id != active_session_id:
            raise AuthenticationFailed('Your session has been terminated because this account logged in from another system.')

        # Update last activity timestamp for interactive user sessions (not background agents)
        if not is_agent:
            cache.set(f'last_activity_{user.id}', time.time(), timeout=86400)

        return user, validated_token
