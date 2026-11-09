from django.contrib import admin
from .models import ProductConfiguration, StockGroup, StockDefinition


class ProductConfigurationAdmin(admin.ModelAdmin):
    list_display = (
        'voucher_type',
        'maintain_batch',
        'maintain_manufacture_date',
        'maintain_expiry_date',
        'maintain_warehouse',
        'updated_at',
    )
    list_filter = (
        'maintain_batch',
        'maintain_manufacture_date',
        'maintain_expiry_date',
        'maintain_warehouse',
    )
    search_fields = ('voucher_type__name',)
    readonly_fields = ('created_at', 'updated_at')

try:
    admin.site.register(ProductConfiguration, ProductConfigurationAdmin)
except admin.sites.AlreadyRegistered:
    pass


class StockGroupAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'parent_group')
    search_fields = ('name',)

try:
    admin.site.register(StockGroup, StockGroupAdmin)
except admin.sites.AlreadyRegistered:
    pass


class StockDefinitionAdmin(admin.ModelAdmin):
    list_display = ('id', 'stock_group', 'status', 'created_at', 'updated_at')
    list_filter = ('status',)
    search_fields = ('stock_group__name',)

try:
    admin.site.register(StockDefinition, StockDefinitionAdmin)
except admin.sites.AlreadyRegistered:
    pass
