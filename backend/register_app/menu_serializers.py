from rest_framework import serializers
from .models import Menu, SubMenu, SubSubMenu


class SubSubMenuSerializer(serializers.ModelSerializer):
    """Serializer for third-level menus"""
    
    class Meta:
        model = SubSubMenu
        fields = ['id', 'name', 'description', 'icon', 'url', 'order', 'is_active', 'has_create', 'has_edit', 'has_delete', 'has_approve', 'has_reject', 'has_details', 'has_history']


class SubMenuSerializer(serializers.ModelSerializer):
    """Serializer for second-level menus with nested subsubmenus"""
    subsubmenus = SubSubMenuSerializer(many=True, read_only=True)
    
    class Meta:
        model = SubMenu
        fields = ['id', 'name', 'description', 'icon', 'url', 'order', 'is_active', 'has_create', 'has_edit', 'has_delete', 'has_approve', 'has_reject', 'has_details', 'has_history', 'subsubmenus']


class MenuSerializer(serializers.ModelSerializer):
    """Serializer for top-level menus with nested structure"""
    submenus = SubMenuSerializer(many=True, read_only=True)
    
    class Meta:
        model = Menu
        fields = ['id', 'name', 'code', 'description', 'icon', 'url', 'order', 'is_active', 'has_create', 'has_edit', 'has_delete', 'has_approve', 'has_reject', 'has_details', 'has_history', 'submenus']



