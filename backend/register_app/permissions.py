from rest_framework import permissions
from .permissions_utils import get_user_permissions

class HasModulePermission(permissions.BasePermission):
    """
    Custom permission for DRF ViewSets based on module_code.
    """
    module_code = None

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
            
        # Superusers and staff have all permissions
        if request.user.is_superuser or getattr(request.user, 'is_staff', False):
            return True
        
        module = self.module_code or getattr(view, 'module_code', None)
        if not module:
            return False
            
        permissions = get_user_permissions(request.user)
        
        if module not in permissions:
            return False
            
        # Map DRF actions to our permission actions
        # GET (list/retrieve) -> view
        # POST -> create
        # PUT/PATCH -> edit
        # DELETE -> delete
        
        # Determine required action based on DRF view action or HTTP method
        drf_action = getattr(view, 'action', None)
        
        action_map = {
            'list': 'view',
            'retrieve': 'view',
            'create': 'create',
            'update': 'edit',
            'partial_update': 'edit',
            'destroy': 'delete',
            'select': 'approve',
        }
        
        required_action = action_map.get(drf_action)
        
        if not required_action:
            # Fallback to HTTP methods if action is not determined
            method_map = {
                'GET': 'view',
                'POST': 'create',
                'PUT': 'edit',
                'PATCH': 'edit',
                'DELETE': 'delete'
            }
            required_action = method_map.get(request.method, 'view')
        
        return permissions[module].get(required_action, False)

def module_permission(code):
    """
    Returns a class with the specified module code.
    """
    return type(f"Has{code.replace('-', '').capitalize()}Permission", (HasModulePermission,), {'module_code': code})

