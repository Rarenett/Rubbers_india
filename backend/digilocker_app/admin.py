from django.contrib import admin
from .models import (
    DigiLockerFolder,
    DigiLockerFolderMapping,
    DigiLockerDocument,
    DigiLockerOTPChallenge,
    DigiLockerAuditLog
)

@admin.register(DigiLockerFolder)
class DigiLockerFolderAdmin(admin.ModelAdmin):
    list_display = ('name', 'folder_type', 'owner', 'created_by', 'is_active', 'created_at')
    list_filter = ('folder_type', 'is_active')
    search_fields = ('name', 'description')

@admin.register(DigiLockerFolderMapping)
class DigiLockerFolderMappingAdmin(admin.ModelAdmin):
    list_display = ('folder', 'employee', 'can_view', 'can_upload', 'can_download', 'assigned_by', 'is_active', 'assigned_at')
    list_filter = ('can_view', 'can_upload', 'can_download', 'is_active')
    search_fields = ('folder__name', 'employee__user__first_name', 'employee__user__last_name')

@admin.register(DigiLockerDocument)
class DigiLockerDocumentAdmin(admin.ModelAdmin):
    list_display = ('original_filename', 'folder', 'uploaded_by', 'file_extension', 'file_size', 'is_active', 'uploaded_at')
    list_filter = ('file_extension', 'is_active')
    search_fields = ('original_filename', 'folder__name', 'description')

@admin.register(DigiLockerOTPChallenge)
class DigiLockerOTPChallengeAdmin(admin.ModelAdmin):
    list_display = ('document', 'requester', 'target_employee', 'operation', 'is_verified', 'attempt_count', 'expires_at', 'created_at')
    list_filter = ('operation', 'is_verified')
    search_fields = ('document__original_filename', 'requester__email')

@admin.register(DigiLockerAuditLog)
class DigiLockerAuditLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'status', 'actor', 'target_employee', 'folder', 'document', 'timestamp')
    list_filter = ('action', 'status')
    search_fields = ('details', 'document__original_filename', 'folder__name')
