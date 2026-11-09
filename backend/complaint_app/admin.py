from django.contrib import admin
from .models import ComplaintCategory, Complaint, ComplaintUpdate, Pattern, CommentAction, PriorityRule

# Register your models here.

@admin.register(PriorityRule)
class PriorityRuleAdmin(admin.ModelAdmin):
    list_display = ('rule_name', 'priority_level', 'is_active', 'created_at')
    list_filter = ('priority_level', 'is_active')
    search_fields = ('rule_name', 'description')

@admin.register(ComplaintCategory)
class ComplaintCategoryAdmin(admin.ModelAdmin):
    list_display = ('category_code', 'category_name', 'is_active')
    search_fields = ('category_code', 'category_name')

@admin.register(Pattern)
class PatternAdmin(admin.ModelAdmin):
    list_display = ('pattern_no', 'pattern_head', 'category', 'pattern_type', 'priority', 'is_active')
    list_filter = ('pattern_type', 'is_active', 'category', 'priority')
    search_fields = ('pattern_no', 'pattern_head')

@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'user', 'category', 'status', 'priority', 'assigned_to', 'created_at')
    list_filter = ('status', 'priority', 'category')
    search_fields = ('title', 'description', 'user__email')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(ComplaintUpdate)
class ComplaintUpdateAdmin(admin.ModelAdmin):
    list_display = ('complaint', 'user', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('complaint__title', 'user__email')

@admin.register(CommentAction)
class CommentActionAdmin(admin.ModelAdmin):
    list_display = (
        'id', 
        'complaint_id_display',
        'complaint_head_display',
        'pattern_details_display', 
        'designation_ids_display', 
        'comment_name', 
        'decision', 
        'created_at'
    )
    list_filter = ('decision', 'created_at')
    search_fields = (
        'comment_name', 
        'notes', 
        'complaint_post__title', 
        'complaint_post__pattern__pattern_no',
        'complaint_post__pattern__pattern_head'
    )
    readonly_fields = ('created_at',)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'complaint_post', 
            'complaint_post__pattern'
        ).prefetch_related('complaint_post__pattern__designations')

    def complaint_id_display(self, obj):
        return obj.complaint_post.id if obj.complaint_post else "-"
    complaint_id_display.short_description = 'Complaint ID'

    def complaint_head_display(self, obj):
        return obj.complaint_post.title if obj.complaint_post else "-"
    complaint_head_display.short_description = 'Complaint Head'

    def pattern_details_display(self, obj):
        pattern = obj.pattern_details
        if pattern:
            return f"{pattern.pattern_no} ({pattern.pattern_head})"
        return "-"
    pattern_details_display.short_description = 'Pattern'

    def designation_ids_display(self, obj):
        return obj.designation_ids
    designation_ids_display.short_description = 'Designation IDs'
