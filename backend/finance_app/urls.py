from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AccountGroupViewSet, LedgerViewSet, ServiceInvoiceViewSet, JournalVoucherViewSet,
    ReceiptVoucherViewSet, PaymentVoucherViewSet, ContraVoucherViewSet, QuotationViewSet,
    VoucherTypeViewSet, StockJournalTypeViewSet, StockJournalViewSet, StockJournalPrefixConfigListView,
    ManufacturalJournalTypeViewSet, ManufacturalJournalViewSet, ManufacturalJournalPrefixConfigListView,
    TrialBalanceAPIView, ProfitAndLossAPIView, ReceivablesAPIView, PayablesAPIView, BalanceSheetAPIView,
    DayBookAPIView, DashboardAPIView
)

router = DefaultRouter()
router.register(r'account-groups', AccountGroupViewSet, basename='accountgroup')
router.register(r'ledgers', LedgerViewSet, basename='ledger')
router.register(r'service-invoices', ServiceInvoiceViewSet, basename='serviceinvoice')
router.register(r'journals', JournalVoucherViewSet, basename='journalvoucher')
router.register(r'receipts', ReceiptVoucherViewSet, basename='receiptvoucher')
router.register(r'payments', PaymentVoucherViewSet, basename='paymentvoucher')
router.register(r'contras', ContraVoucherViewSet, basename='contravoucher')
router.register(r'quotations', QuotationViewSet, basename='quotation')
router.register(r'voucher-types', VoucherTypeViewSet, basename='voucher-type')
router.register(r'stock-journal-types', StockJournalTypeViewSet, basename='stockjournaltype')
router.register(r'stock-journals', StockJournalViewSet, basename='stockjournal')
router.register(r'manufactural-journal-types', ManufacturalJournalTypeViewSet, basename='manufacturaljournaltype')
router.register(r'manufactural-journals', ManufacturalJournalViewSet, basename='manufacturaljournal')

urlpatterns = [
    path('', include(router.urls)),

    path('stock-journal-prefix-configs/', StockJournalPrefixConfigListView.as_view(), name='stock_journal_prefix_configs'),
    path('manufactural-journal-prefix-configs/', ManufacturalJournalPrefixConfigListView.as_view(), name='manufactural_journal_prefix_configs'),
    path('trial-balance/', TrialBalanceAPIView.as_view(), name='trial_balance'),
    path('profit-loss/', ProfitAndLossAPIView.as_view(), name='profit_loss'),
    path('receivables/', ReceivablesAPIView.as_view(), name='receivables'),
    path('payables/', PayablesAPIView.as_view(), name='payables'),
    path('balance-sheet/', BalanceSheetAPIView.as_view(), name='balance_sheet'),
    path('day-book/', DayBookAPIView.as_view(), name='day_book'),
    path('dashboard/', DashboardAPIView.as_view(), name='finance_dashboard'),
]
