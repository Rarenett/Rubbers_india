from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CurrencyViewSet, ExchangeRateViewSet, LanguageViewSet, 
    CompanyViewSet, CompanyAddressViewSet, CompanyContactViewSet, CompanyFinancialYearViewSet,
    BranchViewSet, BranchAddressViewSet, BranchContactViewSet, BranchBankAccountViewSet,
    FactoryViewSet, FactoryAddressViewSet, FactoryContactViewSet,
    WarehouseViewSet, WarehouseAddressViewSet, WarehouseContactViewSet,
    PrefixTypeViewSet, PrefixConfigurationViewSet,
    DatabaseInfoView, DatabaseDownloadView, DatabaseScheduleView, ClearDataView
)

router = DefaultRouter()
router.register(r'currencies', CurrencyViewSet, basename='currency')
router.register(r'exchange-rates', ExchangeRateViewSet, basename='exchange-rate')
router.register(r'languages', LanguageViewSet, basename='language')
router.register(r'company', CompanyViewSet, basename='company')
router.register(r'company-addresses', CompanyAddressViewSet, basename='company-address')
router.register(r'company-contacts', CompanyContactViewSet, basename='company-contact')
router.register(r'company-financial-years', CompanyFinancialYearViewSet, basename='company-financial-year')
router.register(r'branches', BranchViewSet, basename='branch')
router.register(r'branch-addresses', BranchAddressViewSet, basename='branch-address')
router.register(r'branch-contacts', BranchContactViewSet, basename='branch-contact')
router.register(r'branch-bank-accounts', BranchBankAccountViewSet, basename='branch-bank-account')
router.register(r'factories', FactoryViewSet, basename='factory')
router.register(r'factory-addresses', FactoryAddressViewSet, basename='factory-address')
router.register(r'factory-contacts', FactoryContactViewSet, basename='factory-contact')
router.register(r'warehouses', WarehouseViewSet, basename='warehouse')
router.register(r'warehouse-addresses', WarehouseAddressViewSet, basename='warehouse-address')
router.register(r'warehouse-contacts', WarehouseContactViewSet, basename='warehouse-contact')
router.register(r'prefix-types', PrefixTypeViewSet, basename='prefix-type')
router.register(r'prefix-configurations', PrefixConfigurationViewSet, basename='prefix-configuration')

urlpatterns = [
    path('backup/info/', DatabaseInfoView.as_view(), name='database-info'),
    path('backup/download/', DatabaseDownloadView.as_view(), name='database-download'),
    path('backup/schedule/', DatabaseScheduleView.as_view(), name='database-schedule'),
    path('backup/clear-data/', ClearDataView.as_view(), name='database-clear-data'),
    path('', include(router.urls)),
]