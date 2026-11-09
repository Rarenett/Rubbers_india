from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ItemMovementAPIView,
    ItemReportAPIView,
    GodownReportAPIView,
    BatchwiseStockReportAPIView,
    StockItemBookAPIView,
    PriceListViewSet,
    PriceListMappingView,
)

from inventory_app.views import (
    UnitViewSet,
    UnitListView,
    StockGroupViewSet,
    StockCategoryViewSet,
    StockItemViewSet,
    StockItemListView,
    ProductConfigurationListCreateView,
    ProductConfigurationDetailView,
    BillOfEntryViewSet,
    PhysicalStockViewSet,
    WarehouseTransferViewSet,
)

router = DefaultRouter()
router.register(r'price-lists', PriceListViewSet, basename='pricelist')
router.register(r'units', UnitViewSet, basename='unit')
router.register(r'stock-groups', StockGroupViewSet, basename='stock-group')
router.register(r'stock-categories', StockCategoryViewSet, basename='stock-category')
router.register(r'stock-items', StockItemViewSet, basename='stock-item')
router.register(r'recipes', BillOfEntryViewSet, basename='recipe')
router.register(r'physical-stock', PhysicalStockViewSet, basename='physical-stock')
router.register(r'warehouse-transfers', WarehouseTransferViewSet, basename='warehouse-transfer')

from inventory_app.views import (
    StockItemListView,
    ProductConfigurationListCreateView,
    ProductConfigurationDetailView,
    UnitListView,
    StockTableDuplicateBatchesView,
    StockItemWarehousesView,
)




urlpatterns = [
    path('reports/item-report/', ItemReportAPIView.as_view(), name='item-report'),
    path('reports/godown-report/', GodownReportAPIView.as_view(), name='godown-report'),
    path('reports/batchwise-report/', BatchwiseStockReportAPIView.as_view(), name='batchwise-report'),
    path('stock-item-book/', StockItemBookAPIView.as_view(), name='stock_item_book'),
    path('stock-items/<int:item_id>/book/', StockItemBookAPIView.as_view(), name='stock_item_book_detail'),
    path('item-movement/<int:item_id>/', ItemMovementAPIView.as_view(), name='item-movement'),
    path('stock-items/simple/', StockItemListView.as_view(), name='stock_item_list'),
    path('', include(router.urls)),
    path('units/all/', UnitListView.as_view(), name='unit_list_all'),
    path('units/', UnitListView.as_view(), name='unit_list'),
    path('stock-items/', StockItemListView.as_view(), name='stock_item_list'),
    path('batches/', StockTableDuplicateBatchesView.as_view(), name='stock_item_batches'),
    path('warehouses/', StockItemWarehousesView.as_view(), name='stock_item_warehouses'),
    path('price-lists-mapping/', PriceListMappingView.as_view(), name='price_list_mapping_api'),
    path('price-lists-mapping/<int:pk>/', PriceListMappingView.as_view(), name='price_list_mapping_detail_api'),
    path(
        'product-configurations/',
        ProductConfigurationListCreateView.as_view(),
        name='product_configuration_list'
    ),
    path(
        'product-configurations/<int:pk>/',
        ProductConfigurationDetailView.as_view(),
        name='product_configuration_detail'
    ),
]

