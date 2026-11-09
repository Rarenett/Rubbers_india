from django.contrib import admin
from register_app.models import CustomUser
from .models import (
    Department, DepartmentDesignation, Designation,
    Employee, Candidate, Holiday, EmploymentDetails,
    EmployeeDocumentUpload, BankDetails,
    Comment
)


# Note: CustomUser is registered in register_app/admin.py
# Note: Menu, SubMenu, MenuPermission are registered in register_app/admin.py
# Note: Notification is registered in notifications_app/admin.py
# Note: Message/Email are registered in emails_app/admin.py
@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'company', 'created_by')
    list_filter = ('company',)
    search_fields = ('name',)


@admin.register(Designation)
class DesignationAdmin(admin.ModelAdmin):
    list_display = ('name', 'company', 'created_by')
    list_filter = ('company',)
    search_fields = ('name',)


@admin.register(DepartmentDesignation)
class DepartmentDesignationAdmin(admin.ModelAdmin):
    list_display = ('department', 'designation', 'level', 'company')
    list_filter = ('company', 'department', 'designation', 'level')
    search_fields = (
        'department__name',
        'designation__name',
    )



@admin.register(Candidate)
class CandidateAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'email', 'position_applied', 'department_applied', 'status', 'created_at')
    list_filter = ('status', 'gender', 'created_at')
    search_fields = ('first_name', 'last_name', 'email')
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ('Basic Information', {
            'fields': ('first_name', 'last_name', 'gender', 'date_of_birth', 'email', 'mobile_number', 'address', 'photo')
        }),
        ('Recruitment Details', {
            'fields': ('position_applied', 'department_applied', 'expected_salary', 'notice_period', 'experience_years', 'qualification', 'skills', 'resume')
        }),
        ('Selection Status', {
            'fields': ('status',)
        }),
        ('System Information', {
            'fields': ('created_by', 'created_at', 'updated_at')
        }),
    )


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):

    list_display = (
        'user',
        'get_department',
        'get_designation',
        'company',
        'branch',
        'factory',
        'date_of_joining',
        'phone'
    )

    list_filter = (
        'company',
        'branch',
        'factory',
        'dept_designation__department',
        'dept_designation__designation',
        'date_of_joining'
    )

    search_fields = (
        'user__email',
        'user__first_name',
        'user__last_name',
        'phone',
        'dept_designation__department__name',
        'dept_designation__designation__name'
    )

    raw_id_fields = ('user', 'candidate')

    def get_department(self, obj):
        return obj.dept_designation.department.name
    get_department.short_description = "Department"

    def get_designation(self, obj):
        return obj.dept_designation.designation.name
    get_designation.short_description = "Designation"


# Note: Menu and SubMenu are registered in register_app/admin.py
# Note: MenuPermission is registered in register_app/admin.py
# Note: Notification is registered in notifications_app/admin.py
# Note: Message/Email are registered in emails_app/admin.py



@admin.register(EmploymentDetails)
class EmploymentDetailsAdmin(admin.ModelAdmin):

    list_display = (
        'user',
        'employment_no',
        'employment_type',
        'work_mode',
        'date_of_joining'
    )

    list_filter = (
        'employment_type',
        'work_mode',
        'date_of_joining'
    )

    search_fields = (
        'user__full_name',
        'employment_no'
    )

    raw_id_fields = ('user', 'reporting_manager')


@admin.register(EmployeeDocumentUpload)
class EmployeeDocumentUploadAdmin(admin.ModelAdmin):
    list_display = ('user', 'document_type', 'is_signed', 'uploaded_at')
    list_filter = ('is_signed', 'document_type')
    search_fields = ('user__full_name', 'document_type')


@admin.register(BankDetails)
class BankDetailsAdmin(admin.ModelAdmin):
    list_display = ('user', 'bank_name', 'account_no', 'ifsc_code')
    search_fields = ('user__full_name', 'bank_name', 'account_no')



@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'phone', 'message')
