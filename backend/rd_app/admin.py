from django.contrib import admin
from rd_app.models import RnDEntry, ExtraQuantity


@admin.register(RnDEntry)
class RnDEntryAdmin(admin.ModelAdmin):
    list_display = ('id', 'post_production_entry', 'manufactured_quantity', 'damaged_quantity', 'balance_quantity', 'created_at')
    search_fields = ('post_production_entry__production_line__production_line__name',)
    list_filter = ('created_at',)


@admin.register(ExtraQuantity)
class ExtraQuantityAdmin(admin.ModelAdmin):
    list_display = ('id', 'stock_item', 'production_line', 'post_production', 'in_quantity', 'out_quantity', 'unit', 'created_at')
    search_fields = ('stock_item__name', 'production_line__production_line__name')
    list_filter = ('unit', 'stock_item', 'created_at')

