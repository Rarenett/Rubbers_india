with open('backend/digilocker_app/urls.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Update import in urls.py
old_import = """from .views import (
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
    DigiLockerFileDownloadReportView
    
)"""

new_import = """from .views import (
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
    DigiLockerEditRequestViewSet
)"""

assert old_import in text, "old_import not found in urls.py"
text = text.replace(old_import, new_import, 1)

old_router = """router = DefaultRouter()
router.register(r'folders', DigiLockerFolderViewSet, basename='digilocker-folder')
router.register(r'mappings', DigiLockerMappingViewSet, basename='digilocker-mapping')
router.register(r'documents', DigiLockerDocumentViewSet, basename='digilocker-document')
router.register(r'reports', DigiLockerReportViewSet, basename='digilocker-report')"""

new_router = """router = DefaultRouter()
router.register(r'folders', DigiLockerFolderViewSet, basename='digilocker-folder')
router.register(r'mappings', DigiLockerMappingViewSet, basename='digilocker-mapping')
router.register(r'documents', DigiLockerDocumentViewSet, basename='digilocker-document')
router.register(r'reports', DigiLockerReportViewSet, basename='digilocker-report')
router.register(r'approvals', DigiLockerFileApprovalViewSet, basename='digilocker-approval')
router.register(r'edit-requests', DigiLockerEditRequestViewSet, basename='digilocker-edit-request')"""

assert old_router in text, "old_router not found in urls.py"
text = text.replace(old_router, new_router, 1)

with open('backend/digilocker_app/urls.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("urls.py updated successfully.")

