from django.contrib import admin
from .models import SalesOrder, SalesOrderItem, SalesOrderTransaction, DeliveryLocation


@admin.register(DeliveryLocation)
class DeliveryLocationAdmin(admin.ModelAdmin):
    list_display = ('id', 'delivery_location', 'customer')
    list_filter = ('customer',)
    search_fields = ('delivery_location__stop_name', 'customer__name')
    ordering = ('delivery_location__stop_name',)
