from django.contrib import admin
from .models import Gate, GateCategory, GateSubCategory, EntryTag, GeneratedTag, Visitor

@admin.register(Gate)
class GateAdmin(admin.ModelAdmin):
    list_display = ('gate_no', 'created_by', 'date')
    search_fields = ('gate_no',)

@admin.register(GateCategory)
class GateCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'category_no', 'colour_code', 'created_by', 'date')
    search_fields = ('name', 'category_no')

@admin.register(GateSubCategory)
class GateSubCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'subcategory_no', 'created_by', 'date')
    search_fields = ('name', 'subcategory_no')
    list_filter = ('category',)

@admin.register(EntryTag)
class EntryTagAdmin(admin.ModelAdmin):
    list_display = ('tag_type', 'tag_code', 'category', 'sl_no_from', 'sl_no_to', 'created_by', 'date')
    search_fields = ('tag_type', 'tag_code')
    list_filter = ('category', 'tag_type')

@admin.register(GeneratedTag)
class GeneratedTagAdmin(admin.ModelAdmin):
    list_display = ('tag_number', 'entry_tag', 'status', 'created_at')
    list_filter = ('status', 'entry_tag')
    search_fields = ('tag_number',)

@admin.register(Visitor)
class VisitorAdmin(admin.ModelAdmin):
    list_display = ('visitor_name', 'mobile_no', 'company_name', 'is_blacklisted', 'date')
    search_fields = ('visitor_name', 'mobile_no', 'company_name')
    list_filter = ('is_blacklisted', 'date')
