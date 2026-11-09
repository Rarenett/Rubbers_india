from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _

from settings_app.models import Company


class CustomUserManager(BaseUserManager):
    """
    Custom user manager where email is the unique identifier
    for authentication instead of username.
    """
    
    def create_user(self, email, username, password=None, **extra_fields):
        """
        Create and save a regular user with the given email, username, and password.
        """
        if not email:
            raise ValueError(_('The Email field must be set'))
        if not username:
            raise ValueError(_('The Username field must be set'))
        
        email = self.normalize_email(email)
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
       
    def create_superuser(self, email, username, password=None, **extra_fields):
        """
        Create and save a superuser with the given email, username, and password.
        """
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser must have is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser must have is_superuser=True.'))
        
        return self.create_user(email, username, password, **extra_fields)


class CustomUser(AbstractUser):
    """
    Custom User model with email as the primary identifier.
    """
    email = models.EmailField(
        _('email address'),
        unique=True,
        error_messages={
            'unique': _("A user with that email already exists."),
        },
    )
    username = models.CharField(
        _('username'),
        max_length=150,
        unique=True,
        help_text=('Required. 150 characters or fewer. Letters, digits and @/./+/-/ only.'),
        error_messages={
            'unique': _("A user with that username already exists."),
        },
    )
    first_name = models.CharField(_('first name'), max_length=150)
    last_name = models.CharField(_('last name'), max_length=150)
    phone = models.CharField(_('phone number'), max_length=15, blank=True, null=True)
    role = models.ForeignKey('Role', on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    inactivity_timeout_minutes = models.PositiveIntegerField(default=10, help_text="Inactivity auto-logout timeout in minutes for this user")
    active_session_token = models.CharField(max_length=255, null=True, blank=True, help_text="Active JWT session token for single session enforcement across devices")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Use email as the unique identifier for authentication
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']
    
    # Attach the custom manager
    objects = CustomUserManager()
    
    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')
        ordering = ['-created_at']
    
    def _str_(self):
        return self.email
    
    def get_full_name(self):
        """
        Return the first_name plus the last_name, with a space in between.
        """
        full_name = f'{self.first_name} {self.last_name}'
        return full_name.strip()
    
    def get_short_name(self):
        """
        Return the short name for the user.
        """
        return self.first_name

    @property
    def name(self):
        return self.get_full_name() or self.username or self.email

    @property
    def designation(self):
        employee = getattr(self, 'employee', None)
        if employee and employee.dept_designation and employee.dept_designation.designation:
            return employee.dept_designation.designation.name
        if self.role:
            return self.role.name
        return "Employee"


class Role(models.Model):
    company = models.ForeignKey(
        'settings_app.Company',
        on_delete=models.CASCADE,
        related_name="roles"
    )

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    dashboard_name = models.CharField(max_length=255, blank=True, null=True)

    def _str_(self):
        return self.name


class Menu(models.Model):
    """Top-level menu model"""
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=100, unique=True, null=True, blank=True, help_text="Unique identifier for permission checks")
    description = models.TextField(blank=True, null=True, help_text="Short description of the menu")
    icon = models.CharField(max_length=50, blank=True, null=True, help_text="Icon class name (e.g., 'home', 'grid')")
    url = models.CharField(max_length=200, blank=True, null=True, help_text="URL path, null for parent menus")
    order = models.IntegerField(default=0, help_text="Display order")
    is_active = models.BooleanField(default=True)
    has_create = models.BooleanField(default=True)
    has_edit = models.BooleanField(default=True)
    has_delete = models.BooleanField(default=True)
    has_approve = models.BooleanField(default=False)
    has_reject = models.BooleanField(default=False)
    has_details = models.BooleanField(default=False)
    has_allocate = models.BooleanField(default=False)
    has_history = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'Menu'
        verbose_name_plural = 'Menus'

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.is_active:
            # If a menu is inactive, its submenus and subsubmenus must also be inactive
            SubMenu.objects.filter(menu=self, is_active=True).update(is_active=False)
            SubSubMenu.objects.filter(submenu__menu=self, is_active=True).update(is_active=False)


class SubMenu(models.Model):
    """Second-level menu model"""
    menu = models.ForeignKey(
        'Menu',
        on_delete=models.CASCADE,
        related_name='submenus'   # ✅ FIX
    )    
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True, help_text="Short description of the submenu")
    code = models.CharField(max_length=100, unique=True, null=True, blank=True, help_text="Unique identifier for permission checks")
    icon = models.CharField(max_length=50, blank=True, null=True)
    url = models.CharField(max_length=200, blank=True, null=True)
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    has_create = models.BooleanField(default=True)
    has_edit = models.BooleanField(default=True)
    has_delete = models.BooleanField(default=True)
    has_approve = models.BooleanField(default=False)
    has_reject = models.BooleanField(default=False)
    has_details = models.BooleanField(default=False)
    has_allocate = models.BooleanField(default=False)
    has_history = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'SubMenu'
        verbose_name_plural = 'SubMenus'

    def __str__(self):
        return f"{self.menu.name} > {self.name}"

    def save(self, *args, **kwargs):
        # If parent menu is inactive, this submenu must also be inactive
        if self.menu_id and not self.menu.is_active:
            self.is_active = False
        super().save(*args, **kwargs)
        if not self.is_active:
            # If a submenu is inactive, its subsubmenus must also be inactive
            SubSubMenu.objects.filter(submenu=self, is_active=True).update(is_active=False)


class SubSubMenu(models.Model):
    """Third-level menu model"""
    submenu = models.ForeignKey(
        'SubMenu',
        on_delete=models.CASCADE,
        related_name='subsubmenus'   # ✅ FIX
    )   
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True, help_text="Short description of the subsubmenu")
    code = models.CharField(max_length=100, unique=True, null=True, blank=True, help_text="Unique identifier for permission checks (e.g., 'leads', 'rfq')")
    icon = models.CharField(max_length=50, blank=True, null=True)
    url = models.CharField(max_length=200)
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    has_create = models.BooleanField(default=True)
    has_edit = models.BooleanField(default=True)
    has_delete = models.BooleanField(default=True)
    has_approve = models.BooleanField(default=False)
    has_reject = models.BooleanField(default=False)
    has_details = models.BooleanField(default=False)
    has_allocate = models.BooleanField(default=False)
    has_history = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'SubSubMenu'
        verbose_name_plural = 'SubSubMenus'

    def __str__(self):
        return f"{self.submenu.menu.name} > {self.submenu.name} > {self.name}"

    def save(self, *args, **kwargs):
        # If parent submenu or grandparent menu is inactive, this subsubmenu must also be inactive
        if self.submenu_id:
            parent_inactive = not self.submenu.is_active or (self.submenu.menu_id and not self.submenu.menu.is_active)
            if parent_inactive:
                self.is_active = False
        super().save(*args, **kwargs)


class RoleMenuPermission(models.Model):

    role = models.ForeignKey(
        'Role',
        on_delete=models.CASCADE,
        related_name="permissions"
    )

    menu = models.ForeignKey(
        'Menu',
        on_delete=models.CASCADE,
        related_name="role_permissions"
    )

    submenu = models.ForeignKey(
        'SubMenu',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="role_permissions"
    )

    sub_submenu = models.ForeignKey(
        'SubSubMenu',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="role_permissions"
    )

    can_view = models.BooleanField(default=True)
    can_create = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)
    can_approve = models.BooleanField(default=False)
    can_reject = models.BooleanField(default=False)
    can_details = models.BooleanField(default=False)
    can_allocate = models.BooleanField(default=False)
    can_history = models.BooleanField(default=False)

    class Meta:
        unique_together = ('role', 'menu', 'submenu', 'sub_submenu')

    def _str_(self):

        parts = [
            self.menu.name if self.menu else "",
            self.submenu.name if self.submenu else "",
            self.sub_submenu.name if self.sub_submenu else ""
        ]

        return f"{self.role.name} → {' > '.join([p for p in parts if p])}"

class Dashboard(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=100, unique=True)
    route = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return self.name

class RoleDashboard(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_dashboards')
    dashboard = models.ForeignKey(Dashboard, on_delete=models.CASCADE, related_name='role_dashboards')
    is_default = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['role', 'dashboard'], name='unique_role_dashboard')
        ]

    def __str__(self):
        return f"{self.role.name} - {self.dashboard.name} (Default: {self.is_default})"