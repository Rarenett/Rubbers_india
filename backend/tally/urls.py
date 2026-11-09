from django.urls import path
from .views import (
    PendingPurchaseReturnsView, 
    ReportSyncStatusView,
    PendingPurchaseInvoicesView,
    ReportPurchaseInvoiceSyncView
)

urlpatterns = [
    path('purchase-returns/pending/', PendingPurchaseReturnsView.as_view(), name='tally_pr_pending'),
    path('purchase-returns/report/', ReportSyncStatusView.as_view(), name='tally_pr_report'),
    path('purchase-invoices/pending/', PendingPurchaseInvoicesView.as_view(), name='tally-pending-purchases'),
    path('purchase-invoices/report/', ReportPurchaseInvoiceSyncView.as_view(), name='tally-report-purchase-sync'),
]
