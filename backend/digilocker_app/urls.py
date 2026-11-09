from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DigiLockerFolderViewSet,
    DigiLockerMappingViewSet,
    DigiLockerDocumentViewSet,
    DigiLockerAccessView,
    DigiLockerRequestOTPView,
    DigiLockerVerifyOTPView,
    DigiLockerPreviewDocumentView,
    DigiLockerDownloadDocumentView,
    DigiLockerReportViewSet,
    DigiLockerFilesViewReportView,
    DigiLockerFileDownloadReportView,
    DigiLockerFileApprovalViewSet,
    DigiLockerEditRequestViewSet,
    DigiLockerSettingsView
)

router = DefaultRouter()
router.register(r'folders', DigiLockerFolderViewSet, basename='digilocker-folder')
router.register(r'mappings', DigiLockerMappingViewSet, basename='digilocker-mapping')
router.register(r'documents', DigiLockerDocumentViewSet, basename='digilocker-document')
router.register(r'reports', DigiLockerReportViewSet, basename='digilocker-report')
router.register(r'approvals', DigiLockerFileApprovalViewSet, basename='digilocker-approval')
router.register(r'edit-requests', DigiLockerEditRequestViewSet, basename='digilocker-edit-request')

urlpatterns = [
    # Access and OTP endpoints
    path('access/', DigiLockerAccessView.as_view(), name='digilocker-access'),
    path('access/employees/<int:employee_id>/folders/', DigiLockerAccessView.as_view(), name='digilocker-access-employee'),
    path('access/employee/<int:employee_id>/', DigiLockerAccessView.as_view(), name='digilocker-access-employee-alt'),
    path('access/request-otp/', DigiLockerRequestOTPView.as_view(), name='digilocker-request-otp'),
    path('access/documents/<int:document_id>/request-otp/', DigiLockerRequestOTPView.as_view(), name='digilocker-request-otp-alt'),
    path('access/verify-otp/', DigiLockerVerifyOTPView.as_view(), name='digilocker-verify-otp'),
    path('access/documents/<int:document_id>/preview/', DigiLockerPreviewDocumentView.as_view(), name='digilocker-preview'),
    path('access/documents/<int:document_id>/download/', DigiLockerDownloadDocumentView.as_view(), name='digilocker-download'),

    # Dedicated Reports endpoints (must be listed before router to avoid conflicts)
    path('reports/files-view/', DigiLockerFilesViewReportView.as_view(), name='digilocker-reports-files-view'),
    path('reports/file-download/', DigiLockerFileDownloadReportView.as_view(), name='digilocker-reports-file-download'),

    # ViewSet routers
    path('', include(router.urls)),
]
