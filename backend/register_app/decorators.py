from functools import wraps
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import PermissionDenied

from .permissions_utils import get_user_permissions

def permission_required(module_code, action):
    """
    Decorator for views that checks whether a user has a specific permission.
    
    :param module_code: The string code of the SubSubMenu (e.g., 'leads')
    :param action: The required action ('view', 'create', 'edit', 'delete', 'approve')
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            user = request.user
            if not user or not user.is_authenticated:
                return Response({"error": "Authentication credentials were not provided."}, status=status.HTTP_401_UNAUTHORIZED)
            
            # Superusers bypass all permission checks
            if getattr(user, 'is_superuser', False):
                return view_func(request, *args, **kwargs)
                
            # Retrieve all permissions for the user
            permissions = get_user_permissions(user)
            
            # Check if the module exists in their permissions
            if module_code not in permissions:
                return Response(
                    {"error": f"You do not have permission to access module '{module_code}'."}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Check if the specific action is allowed
            if not permissions[module_code].get(action, False):
                return Response(
                    {"error": f"You do not have '{action}' permission for module '{module_code}'."}, 
                    status=status.HTTP_403_FORBIDDEN
                )
                
            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator
