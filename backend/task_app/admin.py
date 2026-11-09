# Register your models here.
from django.contrib import admin
from .models import TaskCategory, TaskProgressUpdate


@admin.register(TaskCategory)
class TaskCategoryAdmin(admin.ModelAdmin):
    list_display = ('category_name', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('category_name',)


@admin.register(TaskProgressUpdate)
class TaskProgressUpdateAdmin(admin.ModelAdmin):
    list_display = ('assignment', 'percentage', 'cumulative_percentage', 'created_by', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('assignment__subtask__subtask_name',)