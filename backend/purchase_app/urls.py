from django.urls import path
from .views import (
    MobilePurchaseOrderCreateView,
    NextPurchaseOrderNumberView,
    PurchaseOrderListCreateView,
    PurchaseOrderDetailView,
    PurchaseOrderResolveGstHsnView,
    PurchaseInvoiceListCreateView,
    PurchaseInvoiceDetailView,
    PurchaseInvoiceResolveGstHsnView,
    PurchaseInvoiceLookupView,
    PurchaseInvoiceBatchListView,
    NextPurchaseInvoiceNumberView,
    PurchaseReturnListCreateView,
    PurchaseReturnDetailView,
    PurchaseReturnResolveGstHsnView,
    NextPurchaseReturnNumberView,
    PurchaseTallySyncConfigView,
    PurchaseTallySyncPushView,
    PurchaseTallySyncInvoicesView,
    PurchaseTallyTestConnectionView,
    PurchaseReturnTallySyncConfigView,
    PurchaseReturnTallySyncPushView,
    PurchaseReturnTallySyncReturnsView,
    PurchaseReturnTallyTestConnectionView,
)

urlpatterns = [
    path('mobile-purchase-orders/next-no/', NextPurchaseOrderNumberView.as_view(), name='next-purchase-order-no'),
    path('mobile-purchase-orders/', MobilePurchaseOrderCreateView.as_view(), name='mobile-purchase-order-create'),
    path('purchase-orders/', PurchaseOrderListCreateView.as_view(), name='purchase-order-list'),
    path('purchase-orders/next-po-no/', NextPurchaseOrderNumberView.as_view(), name='purchase-order-next-no'),
    path('purchase-orders/<int:pk>/', PurchaseOrderDetailView.as_view(), name='purchase-order-detail'),
    path('purchase-orders/resolve-gst-hsn/', PurchaseOrderResolveGstHsnView.as_view(), name='resolve-gst-hsn'),

    path('purchase-invoices/next-invoice-no/', NextPurchaseInvoiceNumberView.as_view(), name='purchase-invoice-next-no'),
    path('purchase-invoices/lookup/', PurchaseInvoiceLookupView.as_view(), name='purchase-invoice-lookup'),
    path('purchase-invoices/batches/', PurchaseInvoiceBatchListView.as_view(), name='purchase-invoice-batches'),
    path('purchase-invoices/', PurchaseInvoiceListCreateView.as_view(), name='purchase-invoice-list'),
    path('purchase-invoices/<int:pk>/', PurchaseInvoiceDetailView.as_view(), name='purchase-invoice-detail'),
    path('purchase-invoices/resolve-gst-hsn/', PurchaseInvoiceResolveGstHsnView.as_view(), name='purchase-invoice-resolve-gst-hsn'),

    path('purchase-returns/', PurchaseReturnListCreateView.as_view(), name='purchase-return-list'),
    path('purchase-returns/next-return-no/', NextPurchaseReturnNumberView.as_view(), name='purchase-return-next-no'),
    path('purchase-returns/<int:pk>/', PurchaseReturnDetailView.as_view(), name='purchase-return-detail'),
    path('purchase-returns/resolve-gst-hsn/', PurchaseReturnResolveGstHsnView.as_view(), name='purchase-return-resolve-gst-hsn'),

     # posted to Tally; Purchase Return sync will be added later)
    path('purchase-invoices/tally/config/', PurchaseTallySyncConfigView.as_view(), name='purchase-invoice-tally-config'),
    path('purchase-invoices/tally/push/', PurchaseTallySyncPushView.as_view(), name='purchase-invoice-tally-push'),
    path('purchase-invoices/tally/list/', PurchaseTallySyncInvoicesView.as_view(), name='purchase-invoice-tally-list'),
    path('purchase-invoices/tally/test-connection/', PurchaseTallyTestConnectionView.as_view(), name='purchase-invoice-tally-test-connection'),

    # Purchase Return Tally Sync
    path('purchase-returns/tally/config/', PurchaseReturnTallySyncConfigView.as_view(), name='purchase-return-tally-config'),
    path('purchase-returns/tally/push/', PurchaseReturnTallySyncPushView.as_view(), name='purchase-return-tally-push'),
    path('purchase-returns/tally/list/', PurchaseReturnTallySyncReturnsView.as_view(), name='purchase-return-tally-list'),
    path('purchase-returns/tally/test-connection/', PurchaseReturnTallyTestConnectionView.as_view(), name='purchase-return-tally-test-connection'),
]
