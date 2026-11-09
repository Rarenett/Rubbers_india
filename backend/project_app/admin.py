from django.contrib import admin
from .models import MarketingWishlist, MarketingOrder, MarketingOrderItem

@admin.register(MarketingWishlist)
class MarketingWishlistAdmin(admin.ModelAdmin):
    list_display = ('id', 'employee', 'customer_ledger', 'stock_item', 'quantity', 'get_company_price', 'negotiated_price', 'approval_status')
    list_filter = ('approval_status',)
    search_fields = ('employee__user__username', 'customer_ledger__name', 'stock_item__name')

    def get_company_price(self, obj):
        return obj.stock_item.ss_rate if obj.stock_item else '-'
    get_company_price.short_description = 'Company Price (ss_rate)'

@admin.register(MarketingOrder)
class MarketingOrderAdmin(admin.ModelAdmin):
    list_display = ('order_no', 'customer_ledger', 'new_customer_name', 'total_amount', 'created_at')
    search_fields = ('order_no', 'customer_ledger__name', 'new_customer_name')

@admin.register(MarketingOrderItem)
class MarketingOrderItemAdmin(admin.ModelAdmin):
    list_display = ('marketing_order', 'stock_item', 'quantity', 'rate', 'amount')
    search_fields = ('marketing_order__order_no', 'stock_item__name')


from .models import MarketingAttendance

@admin.register(MarketingAttendance)
class MarketingAttendanceAdmin(admin.ModelAdmin):
    list_display = ('employee', 'attendance_date', 'attendance_time', 'face_verification_status', 'status')
    list_filter = ('attendance_date', 'face_verification_status', 'status')
    search_fields = ('employee__user__username', 'employee__name')
