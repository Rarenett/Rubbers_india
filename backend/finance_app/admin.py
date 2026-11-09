from finance_app.models import VoucherType, BillAllocation, PaymentVoucher, PaymentVoucherDetail, ReceiptVoucher, ReceiptVoucherDetail, JournalVoucher, JournalVoucherDetail
from django.contrib import admin

@admin.register(VoucherType)
class VoucherTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'is_active', 'created_at')
    search_fields = ('name', 'code')
    list_filter = ('is_active',)
    readonly_fields = ('created_at', 'updated_at')

@admin.register(BillAllocation)
class BillAllocationAdmin(admin.ModelAdmin):
    list_display = ('allocation_type', 'name', 'amount', 'payment_detail', 'receipt_detail', 'journal_detail')
    search_fields = ('name', 'allocation_type')

class PaymentVoucherDetailInline(admin.TabularInline):
    model = PaymentVoucherDetail
    extra = 1

@admin.register(PaymentVoucher)
class PaymentVoucherAdmin(admin.ModelAdmin):
    list_display = ('voucher_no', 'voucher_date', 'created_by')
    inlines = [PaymentVoucherDetailInline]

class ReceiptVoucherDetailInline(admin.TabularInline):
    model = ReceiptVoucherDetail
    extra = 1

@admin.register(ReceiptVoucher)
class ReceiptVoucherAdmin(admin.ModelAdmin):
    list_display = ('voucher_no', 'voucher_date', 'created_by')
    inlines = [ReceiptVoucherDetailInline]

class JournalVoucherDetailInline(admin.TabularInline):
    model = JournalVoucherDetail
    extra = 1

@admin.register(JournalVoucher)
class JournalVoucherAdmin(admin.ModelAdmin):
    list_display = ('voucher_no', 'voucher_date', 'created_by')
    inlines = [JournalVoucherDetailInline]