from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LeadSourceViewSet, CrmServiceViewSet, LeadCategoryViewSet, IndustryViewSet,
    LeadViewSet, CrmLeadFollowUpViewSet, CrmPurposeViewSet, CrmOfferViewSet,
    LeadImportBatchViewSet, LeadImportStagingViewSet, CrmTelecallingViewSet
)

router = DefaultRouter()
router.register(r'offers', CrmOfferViewSet, basename='crm-offer')
router.register(r'purposes', CrmPurposeViewSet, basename='crm-purpose')
router.register(r'sources', LeadSourceViewSet, basename='lead-source')
router.register(r'services', CrmServiceViewSet, basename='crm-service')
router.register(r'categories', LeadCategoryViewSet, basename='lead-category')
router.register(r'industries', IndustryViewSet, basename='industry')
router.register(r'leads', LeadViewSet, basename='lead')
router.register(r'batches', LeadImportBatchViewSet, basename='lead-import-batch')
router.register(r'import-batches', LeadImportBatchViewSet, basename='lead-import-batch-alt')
router.register(r'staging-rows', LeadImportStagingViewSet, basename='lead-import-staging')
router.register(r'followups', CrmLeadFollowUpViewSet, basename='crm-followup')
router.register(r'telecalling', CrmTelecallingViewSet, basename='crm-telecalling')
from .views import (
    TelecallingTeamViewSet, TelecallingLeadAssignmentViewSet, CallerCallLogViewSet,
    CallerReportsView, LeadsReportView, ConvertedLeadsReportView, OpportunityAccountViewSet, OpportunityApprovalViewSet
)
router.register(r'telecalling-teams', TelecallingTeamViewSet, basename='crm-telecalling-teams')
router.register(r'telecalling-assignments', TelecallingLeadAssignmentViewSet, basename='crm-telecalling-assignments')
router.register(r'call-logs', CallerCallLogViewSet, basename='crm-call-logs')
router.register(r'opportunity-accounts', OpportunityAccountViewSet, basename='crm-opportunity-accounts')
router.register(r'opportunity-approvals', OpportunityApprovalViewSet, basename='crm-opportunity-approvals')

urlpatterns = [
    path('reports/call-logs/', CallerReportsView.as_view(), name='crm-caller-reports'),
    path('reports/leads/', LeadsReportView.as_view(), name='crm-leads-report'),
    path('reports/converted-leads/', ConvertedLeadsReportView.as_view(), name='crm-converted-leads-report'),
    path('', include(router.urls)),
]


