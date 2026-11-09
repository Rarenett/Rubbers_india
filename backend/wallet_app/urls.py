from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    WalletMasterViewSet,
    WalletTransactionViewSet,
    WalletReportView,
    WalletOwnerTypeViewSet,
    WalletSchemeViewSet,
    WalletSchemeCriteriaViewSet,
    WalletCriteriaValueViewSet,
    WalletReasonViewSet,
    WalletPointsEntryViewSet,
    WalletWorkingViewSet,
    WalletCalendarViewSet,
)

router = DefaultRouter()
router.register(r'master', WalletMasterViewSet, basename='wallet-master')
router.register(r'transactions', WalletTransactionViewSet, basename='wallet-transactions')
router.register(r'owner-types', WalletOwnerTypeViewSet, basename='wallet-ownertypes')
router.register(r'schemes', WalletSchemeViewSet, basename='wallet-schemes')
router.register(r'scheme-criteria', WalletSchemeCriteriaViewSet, basename='wallet-scheme-criteria')
router.register(r'criteria-values', WalletCriteriaValueViewSet, basename='wallet-criteria-values')
router.register(r'reasons', WalletReasonViewSet, basename='wallet-reasons')
router.register(r'points-entry', WalletPointsEntryViewSet, basename='wallet-points-entry')
router.register(r'working', WalletWorkingViewSet, basename='wallet-working')
router.register(r'calendar', WalletCalendarViewSet, basename='wallet-calendar')

urlpatterns = [
    path('report/', WalletReportView.as_view(), name='wallet-report'),
    path('report/<int:wallet_id>/ledger/', WalletReportView.as_view(), name='wallet-report-ledger'),
    path('', include(router.urls)),
]


