from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    UserRegistrationView, UserLoginView, UserProfileView, LogoutView, SetupCustomerLoginView,
    MenuViewSet, SubMenuViewSet, SubSubMenuViewSet, RoleViewSet,
    RoleMenuPermissionViewSet, UserPermissionsView, UserInactivityTimeoutView,
    ChangePasswordView, DatabaseDownloadView, DashboardViewSet
)

# Create router for viewsets
router = DefaultRouter()
router.register(r'menus', MenuViewSet, basename='menu')
router.register(r'submenus', SubMenuViewSet, basename='submenu')
router.register(r'subsubmenus', SubSubMenuViewSet, basename='subsubmenu')
router.register(r'roles', RoleViewSet, basename='role')
router.register(r'role-permissions', RoleMenuPermissionViewSet, basename='role-permission')
router.register(r'dashboards', DashboardViewSet, basename='dashboard')


urlpatterns = [
    # Authentication & Backup endpoints
    path('register/', UserRegistrationView.as_view(), name='register'),
    path('setup-customer-login/', SetupCustomerLoginView.as_view(), name='setup-customer-login'),
    path('login/', UserLoginView.as_view(), name='login'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('inactivity-timeout/', UserInactivityTimeoutView.as_view(), name='inactivity-timeout'),
    path('permissions/', UserPermissionsView.as_view(), name='user-permissions'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('download-db/', DatabaseDownloadView.as_view(), name='download-db'),
]

# Add router URLs
urlpatterns += router.urls
