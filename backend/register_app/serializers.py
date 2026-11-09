from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import models

User = get_user_model()


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration
    """
    password = serializers.CharField(
        write_only=True, 
        required=True, 
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password2 = serializers.CharField(
        write_only=True, 
        required=True,
        style={'input_type': 'password'}
    )
    name = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ('email', 'name', 'password', 'password2', 'phone')

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        
        # Split name into first_name and last_name
        name = validated_data.pop('name')
        name_parts = name.strip().split(maxsplit=1)
        first_name = name_parts[0] if len(name_parts) > 0 else ''
        last_name = name_parts[1] if len(name_parts) > 1 else ''
        
        # Auto-generate username from email (part before @)
        email = validated_data.get('email')
        username = email.split('@')[0]
        
        # Ensure username is unique by appending numbers if needed
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1
        
        # Explicitly set is_staff and is_superuser to False for new registrations
        validated_data['is_staff'] = False
        validated_data['is_superuser'] = False
        validated_data['username'] = username
        validated_data['first_name'] = first_name
        validated_data['last_name'] = last_name
        
        user = User.objects.create_user(**validated_data)
        return user


class UserLoginSerializer(serializers.Serializer):
    """
    Serializer for user login
    """
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for user details
    """
    designation = serializers.SerializerMethodField()
    profile_picture = serializers.SerializerMethodField()
    is_board_of_director = serializers.SerializerMethodField()
    customer_type = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    def get_designation(self, obj):
        """Return the employee's or BOD's designation name, role name, or a default."""
        try:
            if hasattr(obj, 'bod_profile') and obj.bod_profile and obj.bod_profile.designation:
                return obj.bod_profile.designation.name
        except Exception:
            pass

        employee = getattr(obj, 'employee', None)
        if not employee:
            try:
                from rarenett_app.models import Employee
                employee = Employee.objects.filter(user=obj).first()
            except Exception:
                pass
        if employee:
            if employee.dept_designation and employee.dept_designation.designation:
                return employee.dept_designation.designation.name
            if employee.bod and employee.bod.designation:
                return employee.bod.designation.name

        try:
            from rarenett_app.models import BoardOfDirector
            bod = BoardOfDirector.objects.filter(email=obj.email, is_active=True).first()
            if bod and bod.designation:
                return bod.designation.name
        except Exception:
            pass

        if obj.role:
            return obj.role.name
        return None

    def get_profile_picture(self, obj):
        try:
            if hasattr(obj, 'bod_profile') and obj.bod_profile and obj.bod_profile.profile_picture:
                return obj.bod_profile.profile_picture.url
        except Exception:
            pass

        try:
            from rarenett_app.models import Employee
            employee = getattr(obj, 'employee', None) or Employee.objects.filter(user=obj).first()
            if employee:
                if employee.profile_picture:
                    return employee.profile_picture.url
                if employee.bod and employee.bod.profile_picture:
                    return employee.bod.profile_picture.url
                if employee.candidate and employee.candidate.photo:
                    return employee.candidate.photo.url
        except Exception:
            pass

        try:
            from rarenett_app.models import BoardOfDirector
            bod = BoardOfDirector.objects.filter(email=obj.email, is_active=True).first()
            if bod and bod.profile_picture:
                return bod.profile_picture.url
        except Exception:
            pass

        return None

    def get_is_board_of_director(self, obj):
        try:
            if hasattr(obj, 'bod_profile') and obj.bod_profile:
                return True
        except Exception:
            pass
        try:
            from rarenett_app.models import Employee, BoardOfDirector
            employee = getattr(obj, 'employee', None) or Employee.objects.filter(user=obj).first()
            if employee and employee.bod:
                return True
            if BoardOfDirector.objects.filter(email=obj.email, is_active=True).exists():
                return True
        except Exception:
            pass
        if obj.role and any(keyword in obj.role.name.lower() for keyword in ['board', 'director', 'bod']):
            return True
        return False

    def get_customer_type(self, obj):
        """Return the customer type if the user is linked to a customer profile."""
        try:
            from hr_app.models import HrDistributor, HrVendor, HrOtherCustomer
            if HrDistributor.objects.filter(linked_user=obj).exists():
                return 'Distributor'
            if HrVendor.objects.filter(linked_user=obj).exists():
                return 'Vendor'
            if HrOtherCustomer.objects.filter(linked_user=obj).exists():
                return 'Others'
        except Exception:
            pass
        return None
        
    def get_role(self, obj):
        try:
            role = obj.role
            if not role:
                from register_app.permissions_utils import get_active_roles
                active_roles = get_active_roles(obj)
                if active_roles:
                    role = active_roles[0]
            if role:
                return {
                    'id': role.id,
                    'name': role.name,
                    'assigned_dashboards': [
                        {
                            'dashboard_id': rd.dashboard.id,
                            'name': rd.dashboard.name,
                            'route': rd.dashboard.route,
                            'is_default': rd.is_default
                        } for rd in role.role_dashboards.select_related('dashboard').all()
                    ]
                }
        except Exception:
            pass
        return None

    class Meta:
        model = User
        fields = ('id', 'email', 'username', 'first_name', 'last_name', 'phone', 'is_superuser', 'is_staff', 'created_at', 'designation', 'profile_picture', 'is_board_of_director', 'customer_type', 'role')
        read_only_fields = ('id', 'created_at', 'designation', 'profile_picture', 'is_board_of_director', 'customer_type', 'role')



# Import menu models
from register_app.models import Role, Menu, SubMenu, SubSubMenu, RoleMenuPermission, Dashboard, RoleDashboard


class DashboardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dashboard
        fields = ('id', 'name', 'code', 'route', 'is_active')


class RoleMenuPermissionSerializer(serializers.ModelSerializer):
    """Serializer for RoleMenuPermission model"""
    class Meta:
        model = RoleMenuPermission
        fields = '__all__'


class RoleDashboardSerializer(serializers.ModelSerializer):
    dashboard_id = serializers.IntegerField(source='dashboard.id', read_only=True)
    name = serializers.CharField(source='dashboard.name', read_only=True)
    route = serializers.CharField(source='dashboard.route', read_only=True)

    class Meta:
        model = RoleDashboard
        fields = ('id', 'dashboard_id', 'name', 'route', 'is_default')


class RoleSerializer(serializers.ModelSerializer):
    """Serializer for the Role model"""
    dashboards = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )
    assigned_dashboards = RoleDashboardSerializer(source='role_dashboards', many=True, read_only=True)

    class Meta:
        model = Role
        fields = ('id', 'company', 'name', 'description', 'dashboard_name', 'dashboards', 'assigned_dashboards')
        
    def create(self, validated_data):
        dashboards_data = validated_data.pop('dashboards', [])
        role = super().create(validated_data)
        
        for d_data in dashboards_data:
            dashboard_id = d_data.get('dashboard') or d_data.get('dashboard_id')
            is_default = d_data.get('is_default', False)
            if dashboard_id:
                try:
                    dashboard = Dashboard.objects.get(id=dashboard_id)
                    RoleDashboard.objects.create(role=role, dashboard=dashboard, is_default=is_default)
                except Dashboard.DoesNotExist:
                    pass
        return role

    def update(self, instance, validated_data):
        dashboards_data = validated_data.pop('dashboards', None)
        role = super().update(instance, validated_data)
        
        if dashboards_data is not None:
            # Clear existing
            RoleDashboard.objects.filter(role=role).delete()
            for d_data in dashboards_data:
                dashboard_id = d_data.get('dashboard') or d_data.get('dashboard_id')
                is_default = d_data.get('is_default', False)
                if dashboard_id:
                    try:
                        dashboard = Dashboard.objects.get(id=dashboard_id)
                        RoleDashboard.objects.create(role=role, dashboard=dashboard, is_default=is_default)
                    except Dashboard.DoesNotExist:
                        pass
        return role


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_active_roles_for_user(user):
    """
    Return the list of all currently-active roles for a user:
      1. Primary role (user.role)
      2. Additional roles from EmploymentDetails if today < roles_applicable_date
    Deduplication is guaranteed.
    """
    from .permissions_utils import get_active_roles
    return get_active_roles(user)


def _best_permission_for_roles(roles, **filter_kwargs):
    """
    Given a list of roles, return the first RoleMenuPermission that matches
    the filter, or None. If multiple roles grant the same resource, the one
    with the most generous permissions wins via OR in the caller.
    """
    return RoleMenuPermission.objects.filter(role__in=roles, **filter_kwargs).first()


def _extract_permission_from_context(obj_type, obj_id, context):
    user_perms = context.get('user_perms')
    if user_perms is not None:
        perm = user_perms.get(f"{obj_type}_{obj_id}")
        if perm:
            return {
                'can_view': perm.get('view', False),
                'can_create': perm.get('create', False),
                'can_edit': perm.get('edit', False),
                'can_delete': perm.get('delete', False),
                'can_approve': perm.get('approve', False),
                'can_reject': perm.get('reject', False),
                'can_details': perm.get('details', False),
                'can_allocate': perm.get('allocate', False),
                'can_history': perm.get('history', False),
            }
        # Key not found in precomputed perms — it means user has no permissions for this object
        return {
            'can_view': False,
            'can_create': False,
            'can_edit': False,
            'can_delete': False,
            'can_approve': False,
            'can_reject': False,
            'can_details': False,
            'can_allocate': False,
            'can_history': False,
        }
    return False

def _merge_permission_actions(roles, **filter_kwargs):
    """
    Return a merged RoleMenuPermission-like dict (OR across all matching roles).
    Returns None if no permissions exist.
    """
    perms = list(RoleMenuPermission.objects.filter(role__in=roles, **filter_kwargs))
    if not perms:
        return None
    # Merge with OR logic
    merged = {
        'can_view': any(p.can_view for p in perms),
        'can_create': any(p.can_create for p in perms),
        'can_edit': any(p.can_edit for p in perms),
        'can_delete': any(p.can_delete for p in perms),
        'can_approve': any(p.can_approve for p in perms),
        'can_reject': any(p.can_reject for p in perms),
        'can_details': any(p.can_details for p in perms),
        'can_allocate': any(p.can_allocate for p in perms),
        'can_history': any(p.can_history for p in perms),
    }
    return merged


# ─── SubSubMenu Serializer ────────────────────────────────────────────────────

class SubSubMenuSerializer(serializers.ModelSerializer):
    """Serializer for SubSubMenu (third-level)"""
    class Meta:
        model = SubSubMenu
        fields = ('id', 'name', 'description', 'code', 'icon', 'url', 'order', 'is_active', 'submenu', 'can_view', 'can_create', 'can_edit', 'can_delete', 'can_approve', 'can_reject', 'can_details', 'can_allocate', 'can_history', 'has_create', 'has_edit', 'has_delete', 'has_approve', 'has_reject', 'has_details', 'has_allocate', 'has_history', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')

    can_view = serializers.SerializerMethodField()
    can_create = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    can_approve = serializers.SerializerMethodField()
    can_reject = serializers.SerializerMethodField()
    can_details = serializers.SerializerMethodField()
    can_allocate = serializers.SerializerMethodField()
    can_history = serializers.SerializerMethodField()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        is_active = attrs.get('is_active')
        if is_active is None and self.instance:
            is_active = self.instance.is_active
        submenu = attrs.get('submenu') or (self.instance.submenu if self.instance else None)
        if is_active and submenu:
            if not submenu.is_active:
                raise serializers.ValidationError({
                    'is_active': f"Cannot activate subsubmenu because parent submenu '{submenu.name}' is inactive."
                })
            if submenu.menu and not submenu.menu.is_active:
                raise serializers.ValidationError({
                    'is_active': f"Cannot activate subsubmenu because parent menu '{submenu.menu.name}' is inactive."
                })
        return attrs

    def _get_merged_permission(self, obj):
        user = self.context.get('user')
        if not user or user.is_superuser:
            return None
            
        extracted = _extract_permission_from_context('subsubmenu', obj.id, self.context)
        if extracted is not False:
            return extracted
            
        roles = _get_active_roles_for_user(user)
        if not roles:
            return None

        # Try explicit permission for this subsubmenu
        merged = _merge_permission_actions(roles, sub_submenu=obj)
        if merged:
            return merged

        return None

    def get_can_view(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_view'] if perm else False

    def get_can_create(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_create'] if perm else False

    def get_can_edit(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_edit'] if perm else False

    def get_can_delete(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_delete'] if perm else False

    def get_can_approve(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_approve'] if perm else False

    def get_can_reject(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_reject'] if perm else False

    def get_can_details(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_details'] if perm else False

    def get_can_allocate(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_allocate'] if perm else False

    def get_can_history(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_history'] if perm else False


# ─── SubMenu Serializer (admin) ───────────────────────────────────────────────

class SubMenuSerializer(serializers.ModelSerializer):
    """Serializer for SubMenu (second-level) with nested subsubmenus"""
    subsubmenus = SubSubMenuSerializer(many=True, read_only=True)
    
    class Meta:
        model = SubMenu
        fields = ('id', 'name', 'description', 'code', 'icon', 'url', 'order', 'is_active', 'menu', 'subsubmenus', 'has_create', 'has_edit', 'has_delete', 'has_approve', 'has_reject', 'has_details', 'has_allocate', 'has_history', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate(self, attrs):
        attrs = super().validate(attrs)
        is_active = attrs.get('is_active')
        if is_active is None and self.instance:
            is_active = self.instance.is_active
        menu = attrs.get('menu') or (self.instance.menu if self.instance else None)
        if is_active and menu and not menu.is_active:
            raise serializers.ValidationError({
                'is_active': f"Cannot activate submenu because parent menu '{menu.name}' is inactive."
            })
        return attrs


# ─── Menu Serializer (admin) ──────────────────────────────────────────────────

class MenuSerializer(serializers.ModelSerializer):
    """Serializer for Menu (top-level) with nested submenus"""
    submenus = SubMenuSerializer(many=True, read_only=True)
    
    class Meta:
        model = Menu
        fields = ('id', 'name', 'code', 'description', 'icon', 'url', 'order', 'is_active', 'submenus', 'has_create', 'has_edit', 'has_delete', 'has_approve', 'has_reject', 'has_details', 'has_allocate', 'has_history', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')


# ─── User Menu Tree Serializers (permission-filtered) ────────────────────────

class UserMenuTreeSerializer(serializers.ModelSerializer):
    """
    Serializer for user's accessible menu tree (hierarchical structure).
    Filters menus based on the user's merged active-role permissions.
    """
    submenus = serializers.SerializerMethodField()
    
    class Meta:
        model = Menu
        fields = ('id', 'name', 'code', 'description', 'icon', 'url', 'order', 'submenus', 'can_view', 'can_create', 'can_edit', 'can_delete', 'can_approve', 'can_reject', 'can_details', 'can_allocate', 'can_history')
    
    can_view = serializers.SerializerMethodField()
    can_create = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    can_approve = serializers.SerializerMethodField()
    can_reject = serializers.SerializerMethodField()
    can_details = serializers.SerializerMethodField()
    can_allocate = serializers.SerializerMethodField()
    can_history = serializers.SerializerMethodField()

    def _get_merged_permission(self, obj):
        user = self.context.get('user')
        if not user or user.is_superuser:
            return None
            
        extracted = _extract_permission_from_context('menu', obj.id, self.context)
        if extracted is not False:
            return extracted
            
        roles = _get_active_roles_for_user(user)
        if not roles:
            return None
        return _merge_permission_actions(
            roles, menu=obj, submenu__isnull=True, sub_submenu__isnull=True
        )

    def get_can_view(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_view'] if perm else False

    def get_can_create(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_create'] if perm else False

    def get_can_edit(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_edit'] if perm else False

    def get_can_delete(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_delete'] if perm else False

    def get_can_approve(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_approve'] if perm else False
    
    def get_can_reject(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_reject'] if perm else False

    def get_can_details(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_details'] if perm else False

    def get_can_allocate(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_allocate'] if perm else False

    def get_can_history(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_history'] if perm else False
    
    def get_submenus(self, obj):
        """Get submenus that user has access to (merged across all active roles)."""
        user = self.context.get('user')
        if not user:
            return []
        
        # Superuser sees all submenus
        if user.is_superuser:
            accessible_submenus = SubMenu.objects.filter(menu=obj, is_active=True).order_by('order')
            return SubMenuTreeSerializer(accessible_submenus, many=True, context=self.context).data

        roles = _get_active_roles_for_user(user)
        if not roles:
            return []
            
        accessible_submenus = SubMenu.objects.filter(
            menu=obj,
            is_active=True
        ).order_by('order')
        
        return SubMenuTreeSerializer(accessible_submenus, many=True, context=self.context).data


class SubMenuTreeSerializer(serializers.ModelSerializer):
    """Serializer for submenu tree with accessible subsubmenus (merged across all active roles)."""
    subsubmenus = serializers.SerializerMethodField()
    
    class Meta:
        model = SubMenu
        fields = ('id', 'name', 'code', 'description', 'icon', 'url', 'order', 'subsubmenus', 'can_view', 'can_create', 'can_edit', 'can_delete', 'can_approve', 'can_reject', 'can_details', 'can_allocate', 'can_history')
    
    can_view = serializers.SerializerMethodField()
    can_create = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    can_approve = serializers.SerializerMethodField()
    can_reject = serializers.SerializerMethodField()
    can_details = serializers.SerializerMethodField()
    can_allocate = serializers.SerializerMethodField()
    can_history = serializers.SerializerMethodField()

    def _get_merged_permission(self, obj):
        user = self.context.get('user')
        if not user or user.is_superuser:
            return None
            
        extracted = _extract_permission_from_context('submenu', obj.id, self.context)
        if extracted is not False:
            return extracted
            
        roles = _get_active_roles_for_user(user)
        if not roles:
            return None

        # Try explicit permission for this submenu
        merged = _merge_permission_actions(roles, submenu=obj, sub_submenu__isnull=True)
        if merged:
            return merged

        return None

    def get_can_view(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_view'] if perm else False

    def get_can_create(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_create'] if perm else False

    def get_can_edit(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_edit'] if perm else False

    def get_can_delete(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_delete'] if perm else False

    def get_can_approve(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_approve'] if perm else False
    
    def get_can_reject(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_reject'] if perm else False

    def get_can_details(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_details'] if perm else False

    def get_can_allocate(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_allocate'] if perm else False

    def get_can_history(self, obj):
        user = self.context.get('user')
        if user and user.is_superuser: return True
        perm = self._get_merged_permission(obj)
        return perm['can_history'] if perm else False

    def get_subsubmenus(self, obj):
        """Get subsubmenus that user has access to (merged across all active roles)."""
        user = self.context.get('user')
        if not user:
            return []
        
        # Superuser sees all subsubmenus
        if user.is_superuser:
            accessible_subsubmenus = SubSubMenu.objects.filter(submenu=obj, is_active=True).order_by('order')
            return SubSubMenuSerializer(accessible_subsubmenus, many=True, context=self.context).data

        roles = _get_active_roles_for_user(user)
        if not roles:
            return []
            
        accessible_subsubmenus = SubSubMenu.objects.filter(
            submenu=obj,
            is_active=True
        ).order_by('order')
        
        return SubSubMenuSerializer(accessible_subsubmenus, many=True, context=self.context).data
