from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Menu, SubMenu, SubSubMenu


class CustomUserAdmin(UserAdmin):
    """Custom admin for CustomUser model"""
    model = CustomUser
    list_display = ['email', 'username', 'first_name', 'last_name', 'is_staff', 'is_superuser', 'is_active']
    list_filter = ['is_staff', 'is_superuser', 'is_active']
    search_fields = ['email', 'username', 'first_name', 'last_name']
    ordering = ['-created_at']
    
    fieldsets = (
        (None, {'fields': ('email', 'username', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'phone', 'role')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important Dates', {'fields': ('last_login', 'date_joined')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'password1', 'password2', 'first_name', 'last_name', 'is_staff', 'is_superuser')}
        ),
    )


# Inline admin for SubMenu
class SubMenuInline(admin.TabularInline):
    """Inline admin to manage submenus within a menu"""
    model = SubMenu
    extra = 1
    fields = ['name', 'code', 'icon', 'url', 'order', 'is_active']
    ordering = ['order', 'name']


# Inline admin for SubSubMenu
class SubSubMenuInline(admin.TabularInline):
    """Inline admin to manage subsubmenus within a submenu"""
    model = SubSubMenu
    extra = 1
    fields = ['name', 'icon', 'url', 'order', 'is_active']
    ordering = ['order', 'name']


@admin.register(Menu)
class MenuAdmin(admin.ModelAdmin):
    """Admin for Menu model with inline submenus"""
    list_display = ['name', 'icon', 'url', 'order', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name']
    ordering = ['order', 'name']
    inlines = [SubMenuInline]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'icon', 'url', 'order', 'is_active')
        }),
    )


@admin.register(SubMenu)
class SubMenuAdmin(admin.ModelAdmin):
    """Admin for SubMenu model with inline subsubmenus"""
    list_display = ['name', 'menu', 'code', 'icon', 'url', 'order', 'is_active', 'created_at']
    list_filter = ['is_active', 'menu']
    search_fields = ['name', 'code', 'menu__name']
    ordering = ['menu__order', 'order', 'name']
    inlines = [SubSubMenuInline]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('menu', 'name', 'code', 'icon', 'url', 'order', 'is_active')
        }),
    )


@admin.register(SubSubMenu)
class SubSubMenuAdmin(admin.ModelAdmin):
    """Admin for SubSubMenu model"""
    list_display = ['name', 'submenu', 'get_menu', 'icon', 'url', 'order', 'is_active', 'created_at']
    list_filter = ['is_active', 'submenu__menu']
    search_fields = ['name', 'submenu__name', 'submenu__menu__name']
    ordering = ['submenu__menu__order', 'submenu__order', 'order', 'name']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('submenu', 'name', 'icon', 'url', 'order', 'is_active')
        }),
    )
    
    def get_menu(self, obj):
        """Display parent menu name"""
        return obj.submenu.menu.name
    get_menu.short_description = 'Menu'
    get_menu.admin_order_field = 'submenu__menu__name'



# Register CustomUser
admin.site.register(CustomUser, CustomUserAdmin)
