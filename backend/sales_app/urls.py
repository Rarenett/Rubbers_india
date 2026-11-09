from django.urls import path
from sales_app.views import (
    SalesOrderListView, SalesOrderDetailView,
    SalesOrderTransactionListView, SalesOrderTransactionDetailView,
    SalesOrderNextNoView, SalesOrderBulkUpdateView,
    SalesInvoiceListView, SalesInvoiceDetailView, SalesInvoiceNextNoView, DeliveryLocationListView, DeliveryLocationDetailView,
    DailyEntryListView, DailyEntryDetailView,SalesReturnNextNoView,SalesReturnResolveGstHsnView,SalesReturnListCreateView,SalesReturnDetailView,
    ProductSalesQuantitiesView,
    TallySyncConfigView, TallySyncPushView, TallySyncOrdersView, TallySyncInvoicesView, TallySyncReturnsView, TallyTestConnectionView,
    TallyAgentHeartbeatView, TallyAgentPollView, TallyAgentResultView, TallyAgentImportResultView,
    DistributorTopPickView, DistributorTopPickListView
)
from .dashboard_views import CommonDashboardAPIView

urlpatterns = [
    # Tally Synchronization endpoints
    path('tally/config/', TallySyncConfigView.as_view(), name='tally_sync_config'),
    path('sales/tally/config/', TallySyncConfigView.as_view(), name='sales_tally_sync_config'),
    path('tally/push/', TallySyncPushView.as_view(), name='tally_sync_push'),
    path('sales/tally/push/', TallySyncPushView.as_view(), name='sales_tally_sync_push'),
    path('tally/orders/', TallySyncOrdersView.as_view(), name='tally_sync_orders'),
    path('sales/tally/orders/', TallySyncOrdersView.as_view(), name='sales_tally_sync_orders'),
    path('tally/invoices/', TallySyncInvoicesView.as_view(), name='tally_sync_invoices'),
    path('sales/tally/invoices/', TallySyncInvoicesView.as_view(), name='sales_tally_sync_invoices'),
    path('tally/returns/', TallySyncReturnsView.as_view(), name='tally_sync_returns'),
    path('sales/tally/returns/', TallySyncReturnsView.as_view(), name='sales_tally_sync_returns'),
    path('tally/test-connection/', TallyTestConnectionView.as_view(), name='tally_test_connection'),
    path('sales/tally/test-connection/', TallyTestConnectionView.as_view(), name='sales_tally_test_connection'),

    # Tally Local Agent Endpoints (Option 1 - Pull / Queue Sync)
    path('tally/agent/heartbeat/', TallyAgentHeartbeatView.as_view(), name='tally_agent_heartbeat'),
    path('sales/tally/agent/heartbeat/', TallyAgentHeartbeatView.as_view(), name='sales_tally_agent_heartbeat'),
    path('tally/agent/poll/', TallyAgentPollView.as_view(), name='tally_agent_poll'),
    path('sales/tally/agent/poll/', TallyAgentPollView.as_view(), name='sales_tally_agent_poll'),
    path('tally/agent/result/', TallyAgentResultView.as_view(), name='tally_agent_result'),
    path('sales/tally/agent/result/', TallyAgentResultView.as_view(), name='sales_tally_agent_result'),
    path('tally/agent/import-result/', TallyAgentImportResultView.as_view(), name='tally_agent_import_result'),
    path('sales/tally/agent/import-result/', TallyAgentImportResultView.as_view(), name='sales_tally_agent_import_result'),

    path('sales/top-picks/', DistributorTopPickListView.as_view(), name='distributor_top_picks_list'),
    path('top-picks/', DistributorTopPickListView.as_view(), name='distributor_top_picks_list_clean'),
    path('sales/top-picks/<int:ledger_id>/', DistributorTopPickView.as_view(), name='distributor_top_picks'),
    path('top-picks/<int:ledger_id>/', DistributorTopPickView.as_view(), name='distributor_top_picks_clean'),

    path('sales/orders/', SalesOrderListView.as_view(), name='sales_order_list'),
    path('sales/orders/bulk-update/', SalesOrderBulkUpdateView.as_view(), name='sales_order_bulk_update'),
    path('sales/orders/next-so-no/', SalesOrderNextNoView.as_view(), name='sales_order_next_no'),
    path('sales/orders/<int:pk>/', SalesOrderDetailView.as_view(), name='sales_order_detail'),
    path('sales/transactions/', SalesOrderTransactionListView.as_view(), name='sales_order_transaction_list'),
    path('sales/transactions/<int:pk>/', SalesOrderTransactionDetailView.as_view(), name='sales_order_transaction_detail'),
    
    path('sales/invoices/', SalesInvoiceListView.as_view(), name='sales_invoice_list'),
    path('sales/invoices/next-invoice-no/', SalesInvoiceNextNoView.as_view(), name='sales_invoice_next_no'),
    path('sales/invoices/<int:pk>/', SalesInvoiceDetailView.as_view(), name='sales_invoice_detail'),

    path('orders/', SalesOrderListView.as_view(), name='sales_order_list'),
    path('orders/bulk-update/', SalesOrderBulkUpdateView.as_view(), name='sales_order_bulk_update_clean'),
    path('orders/next-so-no/', SalesOrderNextNoView.as_view(), name='sales_order_next_no'),
    path('orders/<int:pk>/', SalesOrderDetailView.as_view(), name='sales_order_detail'),
    path('transactions/', SalesOrderTransactionListView.as_view(), name='sales_order_transaction_list'),
    path('transactions/<int:pk>/', SalesOrderTransactionDetailView.as_view(), name='sales_order_transaction_detail'),
    path('invoices/', SalesInvoiceListView.as_view(), name='sales_invoice_list_clean'),
    path('invoices/next-invoice-no/', SalesInvoiceNextNoView.as_view(), name='sales_invoice_next_no_clean'),
    path('invoices/<int:pk>/', SalesInvoiceDetailView.as_view(), name='sales_invoice_detail_clean'),
    path('delivery-locations/', DeliveryLocationListView.as_view(), name='delivery_location_list'),
    path('delivery-locations/<int:pk>/', DeliveryLocationDetailView.as_view(), name='delivery_location_detail'),
    
    # Daily entries
    path('sales/daily-entries/sales-quantities/', ProductSalesQuantitiesView.as_view(), name='product_sales_quantities'),
    path('sales/daily-entries/', DailyEntryListView.as_view(), name='daily_entry_list'),
    path('sales/daily-entries/<int:pk>/', DailyEntryDetailView.as_view(), name='daily_entry_detail'),
    path('daily-entries/sales-quantities/', ProductSalesQuantitiesView.as_view(), name='product_sales_quantities_clean'),
    path('daily-entries/', DailyEntryListView.as_view(), name='daily_entry_list_clean'),
    path('daily-entries/<int:pk>/', DailyEntryDetailView.as_view(), name='daily_entry_detail_clean'),

     # static paths must come before <int:pk>
    path('returns/next-return-no/', SalesReturnNextNoView.as_view(), name='sales-return-next-no'),
    path('returns/resolve-gst-hsn/', SalesReturnResolveGstHsnView.as_view(), name='sales-return-resolve-gst-hsn'),
    path('returns/', SalesReturnListCreateView.as_view(), name='sales-return-list'),
    path('returns/<int:pk>/', SalesReturnDetailView.as_view(), name='sales-return-detail'),
    
    path('common-dashboard/', CommonDashboardAPIView.as_view(), name='common-dashboard'),
]
