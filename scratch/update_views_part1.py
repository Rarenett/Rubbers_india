with open('backend/digilocker_app/views.py', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update imports
old_imports = """from .models import (
    DigiLockerFolder,
    DigiLockerFolderMapping,
    DigiLockerDocument,
    DigiLockerOTPChallenge,
    DigiLockerAuditLog
)
from .serializers import (
    DigiLockerFolderSerializer,
    DigiLockerFolderMappingSerializer,
    DigiLockerDocumentSerializer,
    DigiLockerAuditLogSerializer
)"""

new_imports = """from .models import (
    DigiLockerFolder,
    DigiLockerFolderMapping,
    DigiLockerDocument,
    DigiLockerOTPChallenge,
    DigiLockerAuditLog,
    DigiLockerApprovalHistory,
    DigiLockerEditRequest
)
from .serializers import (
    DigiLockerFolderSerializer,
    DigiLockerFolderMappingSerializer,
    DigiLockerDocumentSerializer,
    DigiLockerAuditLogSerializer,
    DigiLockerApprovalHistorySerializer,
    DigiLockerEditRequestSerializer
)
try:
    from notifications_app.models import Notification
except Exception:
    Notification = None"""

assert old_imports in text, "old_imports not found in views.py"
text = text.replace(old_imports, new_imports, 1)

# Helper function to send notification safely
notification_helper = """
def create_approval_notification(recipient, message, sender=None, badge_text="File Approval", badge_color="primary"):
    if not recipient or not Notification:
        return
    try:
        Notification.objects.create(
            recipient=recipient,
            sender=sender,
            message=message,
            notification_type='alert',
            badge_text=badge_text,
            badge_color=badge_color,
            is_read=False
        )
    except Exception as e:
        print(f"Notification error: {e}")
"""

# Place helper right after is_user_admin function
is_admin_anchor = """def is_user_admin(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    if hasattr(user, 'role') and user.role and getattr(user.role, 'name', None):
        role_name = user.role.name.strip().lower()
        # Strictly admin/superadmin roles only (exclude HOD, Managers, Employees, Staff)
        if role_name in ['admin', 'super admin', 'superadmin', 'administrator']:
            return True
    return False"""

assert is_admin_anchor in text, "is_admin_anchor not found"
text = text.replace(is_admin_anchor, is_admin_anchor + "\n" + notification_helper, 1)

# 2. Update DigiLockerDocumentViewSet
old_doc_viewset = """class DigiLockerDocumentViewSet(viewsets.ModelViewSet):
    queryset = DigiLockerDocument.objects.filter(is_active=True, folder__is_active=True)
    serializer_class = DigiLockerDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        # Strict Employee-wise listing: Each user/employee strictly only sees documents uploaded by themselves
        qs = DigiLockerDocument.objects.filter(
            uploaded_by=user,
            is_active=True,
            folder__is_active=True
        )

        folder_id = self.request.query_params.get('folder') or self.request.query_params.get('folder_id')
        if folder_id:
            qs = qs.filter(folder_id=folder_id)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(original_filename__icontains=search) |
                Q(description__icontains=search) |
                Q(folder__name__icontains=search)
            )

        return qs

    def create(self, request, *args, **kwargs):
        user = request.user
        folder_id = request.data.get('folder')
        description = request.data.get('description', '')

        if not folder_id:
            return Response({"error": "Destination folder is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            folder = DigiLockerFolder.objects.get(id=folder_id, is_active=True)
        except DigiLockerFolder.DoesNotExist:
            return Response({"error": "Selected folder does not exist or is inactive."}, status=status.HTTP_400_BAD_REQUEST)

        # Upload permission check
        if not is_user_admin(user):
            emp = get_employee_for_user(user)
            has_perm = False
            if folder.owner == user:
                has_perm = True
            elif emp:
                allowed_upload_ids = get_allowed_folder_ids_for_employee(emp, need_upload=True)
                has_perm = folder.id in allowed_upload_ids

            if not has_perm:
                return Response(
                    {"error": "You do not have permission to upload files into this folder."},
                    status=status.HTTP_403_FORBIDDEN
                )

        files = request.FILES.getlist('files') or request.FILES.getlist('file')
        if not files:
            return Response({"error": "No file uploaded. Please select at least one file."}, status=status.HTTP_400_BAD_REQUEST)

        uploaded_docs = []
        errors = []

        for file_obj in files:
            orig_name = file_obj.name
            ext = orig_name.split('.')[-1].lower() if '.' in orig_name else ''

            if ext in DANGEROUS_EXTENSIONS or ext not in ALLOWED_EXTENSIONS:
                errors.append(f"'{orig_name}': File type '.{ext}' is not permitted.")
                continue

            if file_obj.size > MAX_FILE_SIZE:
                errors.append(f"'{orig_name}': Exceeds 25 MB size limit ({file_obj.size // (1024*1024)} MB).")
                continue

            # Compute sha256 checksum
            hasher = hashlib.sha256()
            for chunk in file_obj.chunks():
                hasher.update(chunk)
            checksum = hasher.hexdigest()

            # The folder creator/owner is always set as the document owner
            folder_owner_user = folder.owner or folder.created_by or user
            doc = DigiLockerDocument.objects.create(
                folder=folder,
                owner=folder_owner_user,
                uploaded_by=user,
                original_filename=orig_name,
                stored_file=file_obj,
                file_extension=ext,
                mime_type=file_obj.content_type or 'application/octet-stream',
                file_size=file_obj.size,
                description=description,
                checksum=checksum,
                is_active=True
            )

            DigiLockerAuditLog.objects.create(
                actor=user,
                folder=folder,
                document=doc,
                action='document_uploaded',
                status='SUCCESS',
                details=f"Uploaded '{orig_name}' ({doc.file_size_display}) into folder '{folder.name}'.",
                ip_address=get_client_ip(request),
                safe_metadata={'file_size': doc.file_size, 'extension': ext}
            )

            uploaded_docs.append(DigiLockerDocumentSerializer(doc).data)

        if not uploaded_docs and errors:
            return Response({"error": "Upload failed.", "details": errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "message": f"Successfully uploaded {len(uploaded_docs)} file(s).",
            "documents": uploaded_docs,
            "warnings": errors if errors else None
        }, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        user = self.request.user
        doc = self.get_object()

        # Strict ownership check
        if doc.uploaded_by != user and not is_user_admin(user):
            raise permissions.PermissionDenied("You do not have permission to edit this document.")

        old_filename = doc.original_filename
        
        # When folder is updated in edit modal, re-assign owner to new folder's owner
        new_folder = serializer.validated_data.get('folder', doc.folder)
        folder_owner_user = new_folder.owner or new_folder.created_by or user
        updated_doc = serializer.save(owner=folder_owner_user)

        DigiLockerAuditLog.objects.create(
            actor=user,
            folder=updated_doc.folder,
            document=updated_doc,
            action='document_uploaded',  # Or general update
            status='SUCCESS',
            details=f"Document details updated for '{old_filename}' by {user}.",
            ip_address=get_client_ip(self.request)
        )

    def destroy(self, request, *args, **kwargs):
        user = request.user
        doc = self.get_object()

        # Strict ownership check: only own uploaded document can be deleted
        if doc.uploaded_by != user and not is_user_admin(user):
            return Response({"error": "You do not have permission to delete this document."}, status=status.HTTP_403_FORBIDDEN)

        doc.is_active = False
        doc.save()

        DigiLockerAuditLog.objects.create(
            actor=user,
            folder=doc.folder,
            document=doc,
            action='document_deleted',
            status='SUCCESS',
            details=f"Document '{doc.original_filename}' deleted by {user}.",
            ip_address=get_client_ip(request)
        )

        return Response({"message": f"Document '{doc.original_filename}' deleted successfully."}, status=status.HTTP_200_OK)"""

new_doc_viewset = """class DigiLockerDocumentViewSet(viewsets.ModelViewSet):
    queryset = DigiLockerDocument.objects.filter(is_active=True, folder__is_active=True)
    serializer_class = DigiLockerDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        # Strict Employee-wise listing: Each user/employee strictly only sees documents uploaded by themselves
        qs = DigiLockerDocument.objects.filter(
            uploaded_by=user,
            is_active=True,
            folder__is_active=True
        ).select_related('folder', 'uploaded_by', 'reviewed_by').prefetch_related('edit_requests')

        folder_id = self.request.query_params.get('folder') or self.request.query_params.get('folder_id')
        if folder_id:
            qs = qs.filter(folder_id=folder_id)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(original_filename__icontains=search) |
                Q(description__icontains=search) |
                Q(folder__name__icontains=search)
            )

        return qs

    def create(self, request, *args, **kwargs):
        user = request.user
        folder_id = request.data.get('folder')
        description = request.data.get('description', '')

        if not folder_id:
            return Response({"error": "Destination folder is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            folder = DigiLockerFolder.objects.get(id=folder_id, is_active=True)
        except DigiLockerFolder.DoesNotExist:
            return Response({"error": "Selected folder does not exist or is inactive."}, status=status.HTTP_400_BAD_REQUEST)

        # Upload permission check
        if not is_user_admin(user):
            emp = get_employee_for_user(user)
            has_perm = False
            if folder.owner == user:
                has_perm = True
            elif emp:
                allowed_upload_ids = get_allowed_folder_ids_for_employee(emp, need_upload=True)
                has_perm = folder.id in allowed_upload_ids

            if not has_perm:
                return Response(
                    {"error": "You do not have permission to upload files into this folder."},
                    status=status.HTTP_403_FORBIDDEN
                )

        files = request.FILES.getlist('files') or request.FILES.getlist('file')
        if not files:
            return Response({"error": "No file uploaded. Please select at least one file."}, status=status.HTTP_400_BAD_REQUEST)

        uploaded_docs = []
        errors = []

        for file_obj in files:
            orig_name = file_obj.name
            ext = orig_name.split('.')[-1].lower() if '.' in orig_name else ''

            if ext in DANGEROUS_EXTENSIONS or ext not in ALLOWED_EXTENSIONS:
                errors.append(f"'{orig_name}': File type '.{ext}' is not permitted.")
                continue

            if file_obj.size > MAX_FILE_SIZE:
                errors.append(f"'{orig_name}': Exceeds 25 MB size limit ({file_obj.size // (1024*1024)} MB).")
                continue

            # Compute sha256 checksum
            hasher = hashlib.sha256()
            for chunk in file_obj.chunks():
                hasher.update(chunk)
            checksum = hasher.hexdigest()

            # The folder creator/owner is always set as the document owner
            folder_owner_user = folder.owner or folder.created_by or user
            with transaction.atomic():
                doc = DigiLockerDocument.objects.create(
                    folder=folder,
                    owner=folder_owner_user,
                    uploaded_by=user,
                    original_filename=orig_name,
                    stored_file=file_obj,
                    file_extension=ext,
                    mime_type=file_obj.content_type or 'application/octet-stream',
                    file_size=file_obj.size,
                    description=description,
                    checksum=checksum,
                    approval_status='pending',
                    is_active=True
                )

                # Record Approval History
                DigiLockerApprovalHistory.objects.create(
                    document=doc,
                    action_type='initial_upload',
                    previous_status=None,
                    new_status='pending',
                    performed_by=user,
                    remarks=f"Initial document upload into folder '{folder.name}'."
                )

                DigiLockerAuditLog.objects.create(
                    actor=user,
                    folder=folder,
                    document=doc,
                    action='document_uploaded',
                    status='SUCCESS',
                    details=f"Uploaded '{orig_name}' ({doc.file_size_display}) into folder '{folder.name}' (Status: Pending Approval).",
                    ip_address=get_client_ip(request),
                    safe_metadata={'file_size': doc.file_size, 'extension': ext}
                )

            # Notify administrators about new file upload
            from django.contrib.auth import get_user_model
            User = get_user_model()
            admin_users = User.objects.filter(Q(is_superuser=True) | Q(role__name__icontains='admin'))[:10]
            uploader_display = user.get_full_name() or user.username
            for admin_u in admin_users:
                create_approval_notification(
                    recipient=admin_u,
                    sender=user,
                    message=f"New file '{orig_name}' uploaded by {uploader_display} requires approval.",
                    badge_text="File Approval",
                    badge_color="warning"
                )

            uploaded_docs.append(DigiLockerDocumentSerializer(doc, context={'request': request}).data)

        if not uploaded_docs and errors:
            return Response({"error": "Upload failed.", "details": errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "message": f"Successfully uploaded {len(uploaded_docs)} file(s). Approval status: Pending.",
            "documents": uploaded_docs,
            "warnings": errors if errors else None
        }, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        user = self.request.user
        doc = self.get_object()

        # Strict ownership check
        if doc.uploaded_by != user and not is_user_admin(user):
            raise permissions.PermissionDenied("You do not have permission to edit this document.")

        # Check approval restrictions
        if not is_user_admin(user):
            if doc.approval_status == 'approved':
                # Employee can only edit if there is an approved edit request
                approved_edit_req = doc.edit_requests.filter(
                    requested_by=user,
                    status='approved'
                ).first()
                if not approved_edit_req:
                    raise permissions.PermissionDenied(
                        "This document is approved and locked. You must request edit approval from an administrator first."
                    )
                # Mark the edit request as used
                approved_edit_req.status = 'used'
                approved_edit_req.save()

        old_filename = doc.original_filename
        prev_status = doc.approval_status
        new_folder = serializer.validated_data.get('folder', doc.folder)
        folder_owner_user = new_folder.owner or new_folder.created_by or user

        # Modification resets approval status to 'pending'
        with transaction.atomic():
            updated_doc = serializer.save(
                owner=folder_owner_user,
                approval_status='pending',
                reviewed_by=None,
                reviewed_at=None,
                rejection_reason=None
            )

            # Record in approval history
            DigiLockerApprovalHistory.objects.create(
                document=updated_doc,
                action_type='document_modified',
                previous_status=prev_status,
                new_status='pending',
                performed_by=user,
                remarks=f"Document details or file modified by {user.get_full_name() or user.username}. Approval reset to Pending."
            )

            DigiLockerAuditLog.objects.create(
                actor=user,
                folder=updated_doc.folder,
                document=updated_doc,
                action='document_uploaded',
                status='SUCCESS',
                details=f"Document modified for '{old_filename}' by {user}. Approval reset to Pending.",
                ip_address=get_client_ip(self.request)
            )

        # Notify administrators about modified document
        from django.contrib.auth import get_user_model
        User = get_user_model()
        admin_users = User.objects.filter(Q(is_superuser=True) | Q(role__name__icontains='admin'))[:10]
        editor_display = user.get_full_name() or user.username
        for admin_u in admin_users:
            create_approval_notification(
                recipient=admin_u,
                sender=user,
                message=f"Modified file '{updated_doc.original_filename}' by {editor_display} requires re-approval.",
                badge_text="File Approval",
                badge_color="warning"
            )

    def destroy(self, request, *args, **kwargs):
        user = request.user
        doc = self.get_object()

        # Strict ownership check: only own uploaded document can be deleted
        if doc.uploaded_by != user and not is_user_admin(user):
            return Response({"error": "You do not have permission to delete this document."}, status=status.HTTP_403_FORBIDDEN)

        # If document is approved, restrict deletion for regular employees
        if not is_user_admin(user) and doc.approval_status == 'approved':
            return Response(
                {"error": "Approved documents cannot be deleted directly. Please contact an administrator."},
                status=status.HTTP_400_BAD_REQUEST
            )

        doc.is_active = False
        doc.save()

        DigiLockerAuditLog.objects.create(
            actor=user,
            folder=doc.folder,
            document=doc,
            action='document_deleted',
            status='SUCCESS',
            details=f"Document '{doc.original_filename}' deleted by {user}.",
            ip_address=get_client_ip(request)
        )

        return Response({"message": f"Document '{doc.original_filename}' deleted successfully."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='request-edit')
    def request_edit(self, request, pk=None):
        \"\"\"
        Employee requests edit permission for an already-approved document.
        \"\"\"
        user = request.user
        doc = self.get_object()

        # Only the document uploader can request edit
        if doc.uploaded_by != user and not is_user_admin(user):
            return Response({"error": "Only the document owner can request edit approval."}, status=status.HTTP_403_FORBIDDEN)

        if doc.approval_status != 'approved':
            return Response(
                {"error": f"Edit requests are only required for Approved documents. Current status is '{doc.approval_status}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if there is already a pending edit request
        existing_pending = doc.edit_requests.filter(status='pending', requested_by=user).first()
        if existing_pending:
            return Response(
                {"error": "You already have a pending edit approval request for this document."},
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = request.data.get('reason', '').strip()

        with transaction.atomic():
            edit_req = DigiLockerEditRequest.objects.create(
                document=doc,
                requested_by=user,
                request_reason=reason,
                status='pending'
            )

            DigiLockerApprovalHistory.objects.create(
                document=doc,
                action_type='edit_requested',
                previous_status=doc.approval_status,
                new_status=doc.approval_status,
                performed_by=user,
                remarks=f"Edit approval requested. Reason: {reason or 'None'}"
            )

            DigiLockerAuditLog.objects.create(
                actor=user,
                folder=doc.folder,
                document=doc,
                action='document_uploaded',
                status='SUCCESS',
                details=f"Edit approval requested for '{doc.original_filename}' by {user}. Reason: {reason}",
                ip_address=get_client_ip(request)
            )

        # Notify administrators about edit request
        from django.contrib.auth import get_user_model
        User = get_user_model()
        admin_users = User.objects.filter(Q(is_superuser=True) | Q(role__name__icontains='admin'))[:10]
        emp_display = user.get_full_name() or user.username
        for admin_u in admin_users:
            create_approval_notification(
                recipient=admin_u,
                sender=user,
                message=f"Edit request submitted by {emp_display} for '{doc.original_filename}'.",
                badge_text="Edit Request",
                badge_color="info"
            )

        return Response({
            "message": "Edit approval request submitted successfully. Waiting for administrator review.",
            "edit_request": DigiLockerEditRequestSerializer(edit_req).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='approval-history')
    def approval_history(self, request, pk=None):
        \"\"\"
        Returns audit history of all approval actions for this document.
        \"\"\"
        doc = self.get_object()
        user = request.user
        if doc.uploaded_by != user and not is_user_admin(user):
            return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        history = doc.approval_history.all().order_by('-created_at')
        return Response(DigiLockerApprovalHistorySerializer(history, many=True).data)"""

assert old_doc_viewset in text, "old_doc_viewset not found in views.py"
text = text.replace(old_doc_viewset, new_doc_viewset, 1)

with open('backend/digilocker_app/views.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("views.py part 1 updated successfully.")

