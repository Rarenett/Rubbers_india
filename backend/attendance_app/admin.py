from django.contrib import admin
from attendance_app.models import (
    LeaveType,
    LeaveRequest,
    LeaveRequestDate,
    LeaveRequestForwarding,
    LeaveRequestDocument,
    EmployeeLeaveType,
    EmployeeLeaveTransaction,
)


@admin.register(LeaveType)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'name', 'code', 'is_paid', 'annual_limit',
        'is_cumulative', 'max_limit', 'can_surrender',
        'apply_before_days', 'need_approval', 'is_active'
    )
    list_filter = ('is_paid', 'is_cumulative', 'can_surrender', 'need_approval', 'is_active')
    search_fields = ('name', 'code')
    ordering = ('name',)
    list_editable = ('is_active', 'need_approval')


class LeaveRequestDateInline(admin.TabularInline):
    model = LeaveRequestDate
    extra = 0
    fields = ('date', 'status')


class LeaveRequestForwardingInline(admin.TabularInline):
    model = LeaveRequestForwarding
    extra = 0
    fields = ('forwarded_by', 'forwarded_to', 'forwarded_at', 'remarks')
    readonly_fields = ('forwarded_at',)


class LeaveRequestDocumentInline(admin.TabularInline):
    model = LeaveRequestDocument
    extra = 0
    fields = ('file', 'original_name', 'uploaded_at')
    readonly_fields = ('uploaded_at',)


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'employee', 'leave_type', 'total_days',
        'status', 'approved_by', 'approved_at', 'created_at'
    )
    list_filter = ('status', 'leave_type', 'created_at')
    search_fields = (
        'employee__user__first_name',
        'employee__user__last_name',
        'employee__user__username',
        'leave_type__name',
        'reason'
    )
    inlines = [LeaveRequestDateInline, LeaveRequestForwardingInline, LeaveRequestDocumentInline]


@admin.register(LeaveRequestDate)
class LeaveRequestDateAdmin(admin.ModelAdmin):
    list_display = ('id', 'leave_request', 'date', 'status', 'created_at')
    list_filter = ('status', 'date')
    search_fields = ('leave_request__employee__user__username', 'leave_request__employee__user__first_name')


@admin.register(LeaveRequestForwarding)
class LeaveRequestForwardingAdmin(admin.ModelAdmin):
    list_display = ('id', 'leave_request', 'forwarded_by', 'forwarded_to', 'forwarded_at')
    list_filter = ('forwarded_at',)
    search_fields = (
        'forwarded_by__username', 'forwarded_to__username', 'remarks'
    )


@admin.register(EmployeeLeaveType)
class EmployeeLeaveTypeAdmin(admin.ModelAdmin):
    list_display = ('id', 'employee', 'leave_type', 'effective_from', 'is_active', 'created_at')
    list_filter = ('is_active', 'leave_type', 'effective_from')
    search_fields = (
        'employee__user__first_name',
        'employee__user__last_name',
        'employee__user__username',
        'leave_type__name',
        'leave_type__code',
    )
    ordering = ('-effective_from', 'leave_type__name')


@admin.register(EmployeeLeaveTransaction)
class EmployeeLeaveTransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'employee', 'leave_type', 'date', 'IN', 'OUT', 'is_approved', 'created_at')
    list_filter = ('is_approved', 'leave_type', 'date')
    search_fields = (
        'employee__user__first_name',
        'employee__user__last_name',
        'employee__user__username',
        'leave_type__name',
        'leave_type__code',
    )
    ordering = ('-date', '-id')

