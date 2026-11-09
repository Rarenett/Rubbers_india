from django.contrib import admin
from .models import (
    LeadSource, CrmService, LeadCategory, Industry, Lead, LeadAttachment, LeadImage,
    CrmLeadFollowUp, LeadImportBatch, LeadImportStaging, CrmOffer
)

@admin.register(CrmOffer)
class CrmOfferAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'code', 'offer_type', 'status', 'is_active', 'start_date', 'end_date', 'created_at')
    search_fields = ('title', 'code', 'description')
    list_filter = ('offer_type', 'status', 'is_active', 'start_date', 'end_date')

@admin.register(LeadSource)
class LeadSourceAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'is_active', 'created_at')
    search_fields = ('name', 'description')
    list_filter = ('is_active',)

@admin.register(CrmService)
class CrmServiceAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'is_active', 'created_at')
    search_fields = ('name', 'description')
    list_filter = ('is_active',)

@admin.register(LeadCategory)
class LeadCategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'is_active', 'created_at')
    search_fields = ('name', 'description')
    list_filter = ('is_active',)

@admin.register(Industry)
class IndustryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'is_active', 'created_at')
    search_fields = ('name', 'description')
    list_filter = ('is_active',)

class LeadAttachmentInline(admin.TabularInline):
    model = LeadAttachment
    extra = 1

class LeadImageInline(admin.TabularInline):
    model = LeadImage
    extra = 1

@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ('id', 'first_name', 'last_name', 'company', 'phone', 'category', 'lead_source', 'lead_status', 'priority', 'created_at')
    search_fields = ('first_name', 'last_name', 'company', 'phone', 'email', 'other_owner_name')
    list_filter = ('lead_status', 'priority', 'category', 'lead_source', 'has_product_interest', 'has_service_interest')
    inlines = [LeadAttachmentInline, LeadImageInline]

@admin.register(LeadAttachment)
class LeadAttachmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'lead', 'file_name', 'uploaded_at')

@admin.register(LeadImage)
class LeadImageAdmin(admin.ModelAdmin):
    list_display = ('id', 'lead', 'image_name', 'image_size', 'uploaded_at')

@admin.register(CrmLeadFollowUp)
class CrmLeadFollowUpAdmin(admin.ModelAdmin):
    list_display = ('id', 'lead', 'visit_date', 'status', 'telecaller', 'executive', 'created_at')
    search_fields = ('lead__shop_name', 'remarks', 'purpose', 'narration')
    list_filter = ('status', 'category')

class LeadImportStagingInline(admin.TabularInline):
    model = LeadImportStaging
    extra = 0
    fields = ('row_number', 'phone', 'first_name', 'last_name', 'company', 'industry_name', 'validation_status', 'is_duplicate_in_file')
    readonly_fields = fields

@admin.register(LeadImportBatch)
class LeadImportBatchAdmin(admin.ModelAdmin):
    list_display = ('id', 'file_name', 'status', 'total_rows', 'valid_rows', 'invalid_rows', 'uploaded_by', 'created_at', 'pushed_at')
    list_filter = ('status', 'created_at')
    search_fields = ('file_name',)
    inlines = [LeadImportStagingInline]

@admin.register(LeadImportStaging)
class LeadImportStagingAdmin(admin.ModelAdmin):
    list_display = ('id', 'batch', 'row_number', 'phone', 'first_name', 'last_name', 'company', 'validation_status', 'is_duplicate_in_file')
    list_filter = ('validation_status', 'is_duplicate_in_file', 'batch')
    search_fields = ('phone', 'normalized_phone', 'first_name', 'last_name', 'company')



