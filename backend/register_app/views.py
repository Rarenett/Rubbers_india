import uuid
import time
import re
from rest_framework import status, generics
from register_app.permissions import module_permission
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from django.core.cache import cache
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .serializers import UserRegistrationSerializer, UserLoginSerializer
from rarenett_app.serializers import CustomUserSerializer as UserSerializer

User = get_user_model()


class UserRegistrationView(generics.CreateAPIView):
    """
    API endpoint for user registration
    """
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Generate JWT tokens
        session_token = str(uuid.uuid4())
        cache.set(f'active_session_{user.id}', session_token, timeout=None)

        refresh = RefreshToken.for_user(user)
        refresh['session_token'] = session_token
        
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'message': 'User registered successfully'
        }, status=status.HTTP_201_CREATED)


class UserLoginView(APIView):
    """
    API endpoint for user login with single active session management
    """
    permission_classes = (AllowAny,)
    serializer_class = UserLoginSerializer

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        force_logout = request.data.get('force_logout', False)
        if isinstance(force_logout, str):
            force_logout = force_logout.lower() == 'true'
        
        # Authenticate user
        user = authenticate(request, username=email, password=password)
        
        if user is not None:
            active_session = getattr(user, 'active_session_token', None) or cache.get(f'active_session_{user.id}')
            last_activity = cache.get(f'last_activity_{user.id}')

            timeout_minutes = getattr(user, 'inactivity_timeout_minutes', 10) or 10
            timeout_seconds = timeout_minutes * 60

            # Session is considered active ONLY if user was active within their inactivity timeout window
            is_currently_active = False
            if active_session and last_activity:
                try:
                    if (time.time() - float(last_activity)) < timeout_seconds:
                        is_currently_active = True
                except Exception:
                    is_currently_active = False

            # Support agent authentication (e.g., Desktop Screenshot Capture Agent)
            # Agents shouldn't invalidate the interactive browser session or generate a conflicting session token
            is_agent = request.data.get('is_agent', False)
            if isinstance(is_agent, str):
                is_agent = is_agent.lower() == 'true'

            # Prompt user only if another session is actively in use right now (and this is not an agent login)
            if not is_agent and active_session and is_currently_active and not force_logout:
                return Response({
                    'error': 'already_logged_in',
                    'message': f'This account ({user.email}) is currently active on another system.',
                    'active_session': True
                }, status=status.HTTP_409_CONFLICT)

            # Generate or reuse session token
            if is_agent and active_session:
                session_token = active_session
            else:
                session_token = str(uuid.uuid4())
                user.active_session_token = session_token
                user.save(update_fields=['active_session_token'])
                cache.set(f'active_session_{user.id}', session_token, timeout=None)

            if not is_agent:
                cache.set(f'last_activity_{user.id}', time.time(), timeout=86400)

            # Embed session_token inside JWT
            refresh = RefreshToken.for_user(user)
            refresh['session_token'] = session_token
            if is_agent:
                refresh['is_agent'] = True

            # Synchronize user.role if empty
            if not user.role:
                try:
                    from register_app.permissions_utils import get_active_roles
                    active_roles = get_active_roles(user)
                    if active_roles:
                        user.role = active_roles[0]
                        user.save(update_fields=['role'])
                except Exception:
                    pass
            
            return Response({
                'user': UserSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                },
                'message': 'Login successful'
            }, status=status.HTTP_200_OK)
        else:
            try:
                candidate_user = User.objects.filter(email=email).first() or User.objects.filter(username=email).first()
                if candidate_user and candidate_user.check_password(password) and not candidate_user.is_active:
                    return Response({
                        'error': 'Your login access has been deactivated. Please contact your administrator.'
                    }, status=status.HTTP_403_FORBIDDEN)
            except Exception:
                pass
            return Response({
                'error': 'Invalid email or password'
            }, status=status.HTTP_401_UNAUTHORIZED)


class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    API endpoint to retrieve and update user profile
    """
    permission_classes = (IsAuthenticated,)
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class LogoutView(APIView):
    """
    API endpoint for user logout
    """
    permission_classes = (AllowAny,)

    def post(self, request):
        try:
            if request.user and request.user.is_authenticated:
                request.user.active_session_token = None
                request.user.save(update_fields=['active_session_token'])
                cache.delete(f'active_session_{request.user.id}')
                cache.delete(f'last_activity_{request.user.id}')

            refresh_token = request.data.get("refresh_token")
            if refresh_token:
                try:
                    token = RefreshToken(refresh_token)
                    user_id = token.get('user_id')
                    if user_id:
                        User.objects.filter(id=user_id).update(active_session_token=None)
                        cache.delete(f'active_session_{user_id}')
                        cache.delete(f'last_activity_{user_id}')
                    token.blacklist()
                except Exception:
                    pass

            return Response({
                'message': 'Logout successful'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'message': 'Logout successful'
            }, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    """
    API endpoint for authenticated users to change their own password.
    Clears the active session token to force re-login.
    """
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        new_password = request.data.get('new_password', '').strip()
        confirm_password = request.data.get('confirm_password', '').strip()

        if not new_password or not confirm_password:
            return Response({'error': 'Both new password and confirm password are required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        if new_password != confirm_password:
            return Response({'error': 'Passwords do not match.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_password, user=request.user)
        except DjangoValidationError as e:
            return Response({'error': e.messages[0]},
                            status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        user.set_password(new_password)
        # Invalidate the active session so the user must log in again
        user.active_session_token = None
        user.save(update_fields=['password', 'active_session_token'])
        cache.delete(f'active_session_{user.id}')
        cache.delete(f'last_activity_{user.id}')

        return Response({'message': 'Password changed successfully. Please log in again.'},
                        status=status.HTTP_200_OK)


class UserInactivityTimeoutView(APIView):
    """
    API endpoint to retrieve and update session inactivity timeout minutes.
    Non-admin users can view their own timeout. Only Administrators can update timeouts.
    """
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        target_user = request.user
        user_id = request.query_params.get('user_id')
        if user_id and (request.user.is_staff or request.user.is_superuser):
            try:
                target_user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response({'error': 'Target user not found'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'user_id': target_user.id,
            'email': target_user.email,
            'inactivity_timeout_minutes': getattr(target_user, 'inactivity_timeout_minutes', 10) or 10
        }, status=status.HTTP_200_OK)

    def patch(self, request):
        is_admin = request.user.is_staff or request.user.is_superuser or (getattr(request.user, 'role', None) and request.user.role.name.lower() in ['admin', 'administrator', 'super admin'])
        if not is_admin:
            return Response({'error': 'Permission denied. Only Administrators can modify session inactivity timeout settings.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            target_user = request.user
            user_id = request.data.get('user_id')
            if user_id:
                try:
                    target_user = User.objects.get(id=user_id)
                except User.DoesNotExist:
                    return Response({'error': 'Target user not found'}, status=status.HTTP_404_NOT_FOUND)

            minutes = int(request.data.get('inactivity_timeout_minutes', 10))
            if minutes < 1 or minutes > 1440:
                return Response({'error': 'Inactivity timeout must be between 1 and 1440 minutes.'}, status=status.HTTP_400_BAD_REQUEST)
            
            target_user.inactivity_timeout_minutes = minutes
            target_user.save(update_fields=['inactivity_timeout_minutes'])
            
            return Response({
                'message': f'Session inactivity timeout updated to {minutes} minutes for {target_user.email}.',
                'user_id': target_user.id,
                'inactivity_timeout_minutes': target_user.inactivity_timeout_minutes,
                'user': UserSerializer(target_user).data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# Menu Management Views
from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser
from rest_framework.decorators import action
from django.db import models
from .models import Role, Menu, SubMenu, SubSubMenu, RoleMenuPermission, Dashboard
from .serializers import (
    UserRegistrationSerializer, UserLoginSerializer,
    RoleSerializer, MenuSerializer, SubMenuSerializer, SubSubMenuSerializer,
    UserMenuTreeSerializer, RoleMenuPermissionSerializer, DashboardSerializer
)


class RoleMenuPermissionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for RoleMenuPermission CRUD operations
    """
    queryset = RoleMenuPermission.objects.all()
    serializer_class = RoleMenuPermissionSerializer
    permission_classes = [module_permission('permissions')]

    def get_queryset(self):
        """Filter by role_id if provided"""
        queryset = super().get_queryset()
        role_id = self.request.query_params.get('role_id')
        if role_id:
            queryset = queryset.filter(role_id=role_id)
        return queryset

    def create(self, request, *args, **kwargs):
        """
        Custom create that updates existing records if (role, menu, submenu, sub_submenu) already exists,
        preventing duplicate entry errors.
        """
        role_id = request.data.get('role')
        menu_id = request.data.get('menu')
        submenu_id = request.data.get('submenu') or None
        sub_submenu_id = request.data.get('sub_submenu') or None

        existing = RoleMenuPermission.objects.filter(
            role_id=role_id,
            menu_id=menu_id,
            submenu_id=submenu_id,
            sub_submenu_id=sub_submenu_id
        ).first()

        if existing:
            serializer = self.get_serializer(existing, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        return super().create(request, *args, **kwargs)


class MenuViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Menu CRUD operations
    Admin only
    """
    queryset = Menu.objects.all().order_by('order')
    serializer_class = MenuSerializer
    permission_classes = [module_permission('menus')]

    def get_queryset(self):
        return Menu.objects.all().order_by('order')

    def perform_update(self, serializer):
        instance = serializer.save()
        if not instance.is_active:
            SubMenu.objects.filter(menu=instance, is_active=True).update(is_active=False)
            SubSubMenu.objects.filter(submenu__menu=instance, is_active=True).update(is_active=False)

    @action(detail=False, methods=['post'], permission_classes=[module_permission('menus')], url_path='restore-defaults')
    def restore_defaults(self, request):
        """
        Force-restore default menus when requested by admin.
        """
        return Response({'message': 'Default menus feature is managed manually.'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='user-menus')
    def user_menus(self, request):
        """
        Return the tree array of menus the currently authenticated user is allowed to see,
        merging permissions from the primary role and any unexpired additional roles.
        """
        from .permissions_utils import get_user_permissions, get_active_roles
        user = request.user
        
        # If user is superuser, they can see all menus
        if user.is_superuser:
            menus = Menu.objects.filter(is_active=True).order_by('order')
        else:
            base_qs = Menu.objects.filter(is_active=True)

            # Collect all active roles (primary + unexpired additional)
            active_roles = get_active_roles(user)
            if not active_roles:
                return Response([])

            menus = base_qs.order_by('order')

        # Get precomputed user permissions dictionary to avoid N+1 queries in serializers
        from .permissions_utils import get_user_permissions
        user_perms = get_user_permissions(user)

        # The serializer handles filtering the submenus based on the user
        serializer = UserMenuTreeSerializer(menus, many=True, context={'request': request, 'user': user, 'user_perms': user_perms})
        return Response(serializer.data)



class SubMenuViewSet(viewsets.ModelViewSet):
    """
    ViewSet for SubMenu CRUD operations
    Admin only
    """
    queryset = SubMenu.objects.all().order_by('order')
    serializer_class = SubMenuSerializer
    permission_classes = [module_permission('submenus')]

    def perform_update(self, serializer):
        instance = serializer.save()
        if not instance.is_active:
            SubSubMenu.objects.filter(submenu=instance, is_active=True).update(is_active=False)

    def get_queryset(self):
        """Filter by menu_id if provided"""
        queryset = super().get_queryset()
        menu_id = self.request.query_params.get('menu_id')
        if menu_id:
            queryset = queryset.filter(menu_id=menu_id)
        return queryset


class SubSubMenuViewSet(viewsets.ModelViewSet):
    """
    ViewSet for SubSubMenu CRUD operations
    Admin only
    """
    queryset = SubSubMenu.objects.all().order_by('order')
    serializer_class = SubSubMenuSerializer
    permission_classes = [module_permission('subsubmenus')]

    def get_queryset(self):
        """Filter by submenu_id if provided"""
        queryset = super().get_queryset()
        submenu_id = self.request.query_params.get('submenu_id')
        if submenu_id:
            queryset = queryset.filter(submenu_id=submenu_id)
        return queryset


class RoleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Role CRUD operations
    """
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [module_permission('roles')]

    def perform_destroy(self, instance):
        if hasattr(instance, 'system_permissions') and instance.system_permissions.exists():
            instance.is_active = False
            instance.save()
            return Response(status=status.HTTP_204_NO_CONTENT)
        instance.delete()


class UserPermissionsView(APIView):
    """
    API endpoint to retrieve the currently logged in user's role-based permissions.
    """
    permission_classes = [IsAuthenticated]
    

    def get(self, request):
        from .permissions_utils import get_user_permissions, get_active_roles
        user = request.user
        role_name = user.role.name if hasattr(user, 'role') and user.role else None
        
        return Response({
            "role": role_name,
            "permissions": get_user_permissions(user)
        }, status=status.HTTP_200_OK)
    
class SetupCustomerLoginView(APIView):
    """
    API endpoint for setting up or resetting a customer's login.
    If the customer already has a linked user, it updates their password.
    Otherwise, it checks if the email exists. If so, it fails. If not, creates it.
    """
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        from hr_app.models import HrDistributor, HrVendor, HrOtherCustomer

        # Need admin/staff privileges to setup customer logins
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Unauthorized to setup customer credentials'}, status=status.HTTP_403_FORBIDDEN)

        email = request.data.get('email')
        password = request.data.get('password')
        customer_id = request.data.get('customer_id')
        customer_category = request.data.get('customer_category')
        role_id = request.data.get('role_id')

        if not all([email, password, customer_id, customer_category, role_id]):
            return Response({'error': 'Missing required fields. Role is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from register_app.models import Role
            role = Role.objects.get(id=role_id)
        except Role.DoesNotExist:
            return Response({'error': 'Selected role does not exist.'}, status=status.HTTP_400_BAD_REQUEST)

        def send_credentials_email(user_email, raw_password, customer_name, is_update=False):
            from django.core.mail import send_mail
            from django.conf import settings
            
            action_text = "updated" if is_update else "created"
            
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #1e293b; margin: 0;">Login Credentials</h2>
                </div>
                <p style="color: #334155; font-size: 16px;">Dear {customer_name},</p>
                <p style="color: #334155; font-size: 16px;">Your customer portal login credentials have been successfully {action_text}. You can use the details below to access the system.</p>
                <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
                    <p style="margin: 0; color: #475569; font-size: 15px;"><strong>Login Email:</strong> {user_email}</p>
                    <p style="margin: 10px 0 0 0; color: #475569; font-size: 15px;"><strong>Password:</strong> {raw_password}</p>
                </div>
                <p style="color: #334155; font-size: 14px;"><em>Please log in and change your password at your earliest convenience for security purposes.</em></p>
                <br/>
                <p style="color: #334155; font-size: 14px; margin-bottom: 0;">Best regards,</p>
                <p style="color: #1e293b; font-weight: bold; font-size: 14px; margin-top: 5px;">Glenda Support</p>
            </div>
            """
            try:
                send_mail(
                    subject='Your Customer Portal Login Credentials',
                    message=(
                        f"Dear {customer_name},\n\n"
                        f"Your customer portal login credentials have been {action_text}.\n\n"
                        f"Login Email: {user_email}\n"
                        f"Password: {raw_password}\n\n"
                        f"Please log in and change your password at your earliest convenience.\n\n"
                        f"Best regards,\nGlenda Support"
                    ),
                    html_message=html_content,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user_email],
                    fail_silently=False,
                )
            except Exception as e:
                print(f"Failed to send credentials email: {e}")

        # 1. Fetch customer
        customer_model = None
        if customer_category == 'Distributor':
            customer_model = HrDistributor
        elif customer_category == 'Vendor':
            customer_model = HrVendor
        elif customer_category == 'Others':
            customer_model = HrOtherCustomer
        else:
            return Response({'error': 'Invalid customer category.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            customer = customer_model.objects.get(id=customer_id)
        except customer_model.DoesNotExist:
            return Response({'error': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)

        customer_name = customer.contact_person or customer.name or 'Customer'

        # 2. Check linked_user
        if customer.linked_user:
            # Update existing credentials
            try:
                validate_password(password, user=customer.linked_user)
            except DjangoValidationError as e:
                return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
                
            linked_user = customer.linked_user
            linked_user.set_password(password)
            linked_user.role = role
            linked_user.save()
            send_credentials_email(linked_user.email, password, customer_name, is_update=True)
            return Response({'message': 'Login credentials updated successfully.'}, status=status.HTTP_200_OK)

        # 3. Create new credentials
        # Check if email exists
        if User.objects.filter(email=email).exists():
            return Response({
                'error': 'already_exists',
                'email': [f"User with email {email} already exists."]
            }, status=status.HTTP_400_BAD_REQUEST)

        # Create user
        name = request.data.get('name', 'Customer User')
        name_parts = name.strip().split(maxsplit=1)
        first_name = name_parts[0] if len(name_parts) > 0 else ''
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        username = email.split('@')[0]
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        phone = request.data.get('phone', '')

        try:
            validate_password(password)
        except DjangoValidationError as e:
            return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

        new_user = User.objects.create_user(
            email=email,
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            is_staff=False,
            is_superuser=False,
            role=role
        )

        customer.linked_user = new_user
        customer.save(update_fields=['linked_user'])

        send_credentials_email(new_user.email, password, customer_name, is_update=False)

        return Response({'message': 'Login access configured successfully.'}, status=status.HTTP_201_CREATED)


class DatabaseDownloadView(APIView):
    """
    API endpoint to download database backup (JSON fixture or SQL dump).
    GET /api/register/download-db/ -> downloads JSON dump
    GET /api/register/download-db/?format=sql -> downloads SQL dump if available
    """
    permission_classes = (AllowAny,)

    def get(self, request, *args, **kwargs):
        import io
        import subprocess
        from django.core.management import call_command
        from django.http import HttpResponse
        from django.conf import settings

        export_format = request.query_params.get('format', 'json').lower()

        if export_format == 'sql':
            db_config = settings.DATABASES.get('default', {})
            engine = db_config.get('ENGINE', '')
            if 'mysql' in engine:
                db_name = db_config.get('NAME', '')
                user = db_config.get('USER', '')
                password = db_config.get('PASSWORD', '')
                host = db_config.get('HOST', 'localhost')
                port = str(db_config.get('PORT', '3306'))

                try:
                    cmd = ['mysqldump', f'--host={host}', f'--port={port}', f'--user={user}']
                    if password:
                        cmd.append(f'--password={password}')
                    cmd.append(db_name)

                    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    stdout, stderr = process.communicate()

                    if process.returncode == 0 and stdout:
                        response = HttpResponse(stdout, content_type='application/sql')
                        response['Content-Disposition'] = f'attachment; filename="{db_name}_backup.sql"'
                        return response
                except Exception as e:
                    print("mysqldump failed, falling back to JSON dump:", e)

        # Default JSON dump via Django dumpdata
        buf = io.StringIO()
        try:
            call_command(
                'dumpdata',
                natural_foreign=True,
                natural_primary=True,
                exclude=['contenttypes', 'auth.permission', 'sessions', 'admin.logentry'],
                stdout=buf
            )
            buf.seek(0)
            json_data = buf.getvalue()
            response = HttpResponse(json_data, content_type='application/json')
            db_name = settings.DATABASES.get('default', {}).get('NAME', 'db')
            response['Content-Disposition'] = f'attachment; filename="{db_name}_backup.json"'
            return response
        except Exception as err:
            return Response({'error': f'Failed to generate database dump: {str(err)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DashboardViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Dashboard CRUD operations
    """
    queryset = Dashboard.objects.all().order_by('name')
    serializer_class = DashboardSerializer
    permission_classes = [IsAuthenticated]
