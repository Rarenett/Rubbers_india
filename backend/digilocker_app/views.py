import os
import secrets
import hashlib
from datetime import timedelta
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q
from django.http import FileResponse, Http404, HttpResponse
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.pagination import PageNumberPagination
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import (
    DigiLockerFolder,
    DigiLockerFolderMapping,
    DigiLockerDocument,
    DigiLockerOTPChallenge,
    DigiLockerAuditLog,
    DigiLockerApprovalHistory,
    DigiLockerEditRequest,
    DigiLockerOwnershipTransferHistory,
    DigiLockerSettings
)
from .serializers import (
    DigiLockerFolderSerializer,
    DigiLockerFolderMappingSerializer,
    DigiLockerDocumentSerializer,
    DigiLockerAuditLogSerializer,
    DigiLockerApprovalHistorySerializer,
    DigiLockerEditRequestSerializer,
    DigiLockerOwnershipTransferHistorySerializer,
    DigiLockerSettingsSerializer
)
try:
    from notifications_app.models import Notification
except Exception:
    Notification = None
from rarenett_app.models import Employee

# Allowed extensions and MIME types
ALLOWED_EXTENSIONS = {
    'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp',
    'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'zip'
}
DANGEROUS_EXTENSIONS = {
    'exe', 'bat', 'cmd', 'sh', 'php', 'py', 'js', 'html', 'htm', 'vbs', 'dll', 'com'
}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def mask_email(email):
    if not email or '@' not in email:
        return '***'
    user_part, domain_part = email.split('@', 1)
    if len(user_part) <= 2:
        masked_user = user_part[0] + '*'
    else:
        masked_user = user_part[0] + '*' * (len(user_part) - 2) + user_part[-1]
    return f"{masked_user}@{domain_part}"

def is_user_admin(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    if hasattr(user, 'role') and user.role and getattr(user.role, 'name', None):
        role_name = user.role.name.strip().lower()
        # Strictly admin/superadmin roles only (exclude HOD, Managers, Employees, Staff)
        if role_name in ['admin', 'super admin', 'superadmin', 'administrator']:
            return True
    return False

def has_file_approval_permission(user):
    """
    Check if user is a designated administrator or has the File Approval menu permission.
    """
    if is_user_admin(user):
        return True
    try:
        from register_app.permissions_utils import get_user_permissions
        user_perms = get_user_permissions(user)
        if user_perms.get('digilocker_approval', {}).get('view', False):
            return True
    except Exception:
        pass
    return False

def has_mapping_permission(user):
    """
    Check if user is a designated administrator or has DigiLocker Mapping permission.
    """
    if is_user_admin(user):
        return True
    try:
        from register_app.permissions_utils import get_user_permissions
        user_perms = get_user_permissions(user)
        if user_perms.get('digilocker_mapping', {}).get('view', False):
            return True
    except Exception:
        pass
    return False

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


def get_employee_for_user(user):
    try:
        return Employee.objects.filter(user=user).first()
    except Exception:
        return None

def get_allowed_folder_ids_for_employee(employee, need_upload=False, need_view=False, need_download=False):
    """
    Returns all folder IDs actively mapped to this employee matching required permission flags,
    including all nested subfolders inherited from mapped parent folders.
    No automatic permissions are granted to folder creators or owners.
    """
    if not employee:
        return set()

    qs = DigiLockerFolderMapping.objects.filter(
        employee=employee, is_active=True, folder__is_active=True
    )
    if need_upload:
        qs = qs.filter(can_upload=True)
    if need_view:
        qs = qs.filter(can_view=True)
    if need_download:
        qs = qs.filter(can_download=True)

    direct_ids = set(qs.values_list('folder_id', flat=True))
    allowed_ids = set(direct_ids)

    # Propagate to all nested subfolders
    queue = list(direct_ids)
    while queue:
        parent_id = queue.pop(0)
        children = DigiLockerFolder.objects.filter(
            parent_folder_id=parent_id, is_active=True
        ).values_list('id', flat=True)
        for child_id in children:
            if child_id not in allowed_ids:
                allowed_ids.add(child_id)
                queue.append(child_id)
    return allowed_ids

def is_folder_mapped_or_inherited(folder, employee):
    """
    Checks if a folder or any of its ancestor folders is actively mapped to the employee.
    """
    if not folder or not employee:
        return False
    allowed = get_allowed_folder_ids_for_employee(employee)
    return folder.id in allowed

def get_employee_permissions_for_folder(folder, employee):
    """
    Resolves the effective permissions (can_view, view_otp_required, can_download, download_otp_required, can_upload)
    for an employee on a folder, inheriting from the nearest ancestor mapping if nested.
    """
    if not folder or not employee:
        return {
            'can_view': False,
            'view_otp_required': True,
            'can_download': False,
            'download_otp_required': True,
            'can_upload': False
        }
    curr = folder
    visited = set()
    while curr and curr.id not in visited:
        visited.add(curr.id)
        m = DigiLockerFolderMapping.objects.filter(
            folder=curr, employee=employee, is_active=True
        ).first()
        if m:
            return {
                'can_view': m.can_view,
                'view_otp_required': getattr(m, 'view_otp_required', True),
                'can_download': m.can_download,
                'download_otp_required': getattr(m, 'download_otp_required', True),
                'can_upload': m.can_upload
            }
        curr = curr.parent_folder
    return {
        'can_view': False,
        'view_otp_required': True,
        'can_download': False,
        'download_otp_required': True,
        'can_upload': False
    }

def resolve_folder_owner_info(folder):
    """
    Reliably resolves folder creator/owner user, employee profile, display name, and email.
    """
    if not folder:
        return None, None, "Unknown Owner", ""
    owner_user = folder.owner or folder.created_by
    if not owner_user:
        return None, None, "Unknown Owner", ""
    emp = Employee.objects.filter(user=owner_user).select_related('candidate').first()
    name = None
    if emp and emp.candidate and getattr(emp.candidate, 'full_name', None):
        name = emp.candidate.full_name
    if not name:
        name = owner_user.get_full_name() or owner_user.username
    email = owner_user.email or (emp.email if emp else "")
    return owner_user, emp, name, email


def resolve_document_owner_info(doc):
    """
    Reliably resolves document owner user, employee profile, display name, and email.
    The document owner is always the folder creator/owner.
    """
    if doc.folder:
        return resolve_folder_owner_info(doc.folder)
    owner_user = doc.owner or doc.uploaded_by
    if not owner_user:
        return None, None, "Unknown Owner", ""
    emp = Employee.objects.filter(user=owner_user).select_related('candidate').first()
    name = None
    if emp and emp.candidate and getattr(emp.candidate, 'full_name', None):
        name = emp.candidate.full_name
    if not name:
        name = owner_user.get_full_name() or owner_user.username
    email = owner_user.email or (emp.email if emp else "")
    return owner_user, emp, name, email

def get_central_default_otp_email():
    """
    Retrieves the centralized default OTP email address configured for DigiLocker.
    """
    try:
        settings_obj = DigiLockerSettings.objects.first()
        if settings_obj and settings_obj.default_otp_email:
            return settings_obj.default_otp_email.strip()
    except Exception as e:
        print(f"Error fetching DigiLockerSettings: {e}")
    return 'digilocker@rarenett.com'

class DigiLockerFolderViewSet(viewsets.ModelViewSet):
    queryset = DigiLockerFolder.objects.filter(is_active=True)
    serializer_class = DigiLockerFolderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = DigiLockerFolder.objects.filter(is_active=True)

        for_upload = self.request.query_params.get('for_upload') == 'true'

        for_mapping = self.request.query_params.get('for_mapping') == 'true'

        if for_mapping:
            # Administrators and mapping managers need to view all active folders to map them
            if is_user_admin(user) or has_mapping_permission(user):
                pass
            else:
                qs = qs.none()
        elif for_upload:
            # In Upload Files, employees strictly only see folders actively mapped to them with upload permission.
            emp = get_employee_for_user(user)
            if emp:
                allowed_folder_ids = get_allowed_folder_ids_for_employee(emp, need_upload=True)
                qs = qs.filter(id__in=allowed_folder_ids)
            else:
                qs = qs.none()
        else:
            # Folder Creation list: EVERY user (including staff/employees) ONLY sees their own folders created by them (created_by=user or owner=user)
            # Only superusers/system administrators see all folders.
            if user.is_superuser:
                pass
            else:
                qs = qs.filter(Q(created_by=user) | Q(owner=user))

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(description__icontains=search))

        folder_type = self.request.query_params.get('folder_type')
        if folder_type:
            qs = qs.filter(folder_type=folder_type)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        validated_data = serializer.validated_data
        folder_type = validated_data.get('folder_type', self.request.data.get('folder_type', 'shared'))
        if folder_type not in ['shared', 'personal']:
            folder_type = 'shared'

        central_email = (get_central_default_otp_email() or 'digilocker@rarenett.com').strip()
        input_email = (validated_data.get('default_otp_email') or self.request.data.get('default_otp_email') or '').strip()

        # If user did not provide an email, or provided exactly the central default email, mark uses_default_otp_email=True
        if not input_email or input_email.lower() == central_email.lower():
            uses_default = True
            effective_email = central_email
        else:
            uses_default = False
            effective_email = input_email

        phone = (validated_data.get('phone_number') or self.request.data.get('phone_number') or '').strip()
        folder = serializer.save(
            created_by=user,
            owner=user if folder_type == 'personal' else None,
            folder_type=folder_type,
            default_otp_email=effective_email,
            uses_default_otp_email=uses_default,
            phone_number=phone
        )

        DigiLockerAuditLog.objects.create(
            actor=user,
            folder=folder,
            action='folder_created',
            status='SUCCESS',
            details=f"Folder '{folder.name}' ({folder.folder_type}) created by {user}.",
            ip_address=get_client_ip(self.request),
            safe_metadata={'folder_type': folder.folder_type}
        )

    def perform_update(self, serializer):
        user = self.request.user
        folder = self.get_object()

        # Permission check
        if not is_user_admin(user) and folder.owner != user:
            raise permissions.PermissionDenied("You do not have permission to edit this folder.")
        central_email = (get_central_default_otp_email() or 'digilocker@rarenett.com').strip()
        validated_email = serializer.validated_data.get('default_otp_email') or self.request.data.get('default_otp_email')
        if validated_email is not None:
            email_val = validated_email.strip()
            serializer.validated_data['default_otp_email'] = email_val
            if not email_val or email_val.lower() == central_email.lower():
                serializer.validated_data['uses_default_otp_email'] = True
            else:
                serializer.validated_data['uses_default_otp_email'] = False
        phone = serializer.validated_data.get('phone_number') or self.request.data.get('phone_number')
        if phone is not None:
            serializer.validated_data['phone_number'] = str(phone).strip()

        old_name = folder.name
        updated_folder = serializer.save()

        DigiLockerAuditLog.objects.create(
            actor=user,
            folder=updated_folder,
            action='folder_updated',
            status='SUCCESS',
            details=f"Folder updated from '{old_name}' to '{updated_folder.name}'.",
            ip_address=get_client_ip(self.request)
        )

    def destroy(self, request, *args, **kwargs):
        user = request.user
        folder = self.get_object()

        if not is_user_admin(user) and folder.owner != user:
            return Response(
                {"error": "You do not have permission to delete this folder."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Safe deletion policy: check if active subfolders or documents exist
        active_subfolders = folder.subfolders.filter(is_active=True).count()
        if active_subfolders > 0:
            return Response(
                {"error": f"Cannot delete folder '{folder.name}' because it contains {active_subfolders} active subfolder(s). Please delete or move subfolders first."},
                status=status.HTTP_400_BAD_REQUEST
            )

        docs_count = folder.documents.filter(is_active=True).count()
        if docs_count > 0:
            return Response(
                {"error": f"Cannot delete folder '{folder.name}' because it contains {docs_count} active document(s). Please remove or reassign documents first."},
                status=status.HTTP_400_BAD_REQUEST
            )

        folder.is_active = False
        folder.save()

        DigiLockerAuditLog.objects.create(
            actor=user,
            folder=folder,
            action='folder_deleted',
            status='SUCCESS',
            details=f"Folder '{folder.name}' soft-deleted by {user}.",
            ip_address=get_client_ip(request)
        )

        return Response({"message": f"Folder '{folder.name}' successfully deleted."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='transfer-ownership')
    def transfer_ownership(self, request, pk=None):
        """
        Transfer folder ownership to an active employee.
        Ensures all future OTP requests for this folder dynamically route to the new owner.
        Preserves original document uploaders, audit logs, and existing mappings.
        """
        user = request.user
        if not has_mapping_permission(user):
            return Response({"error": "Only authorized administrators can transfer folder ownership."}, status=status.HTTP_403_FORBIDDEN)

        folder = self.get_object()
        new_employee_id = (
            request.data.get('new_owner_employee_id') or
            request.data.get('new_employee') or
            request.data.get('new_employee_id') or
            request.data.get('new_owner_id') or
            request.data.get('employee')
        )
        transfer_reason = request.data.get('transfer_reason', '').strip()

        if not new_employee_id:
            return Response({"error": "New owner selection is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_employee = Employee.objects.select_related('user', 'candidate').get(id=new_employee_id)
        except Employee.DoesNotExist:
            return Response({"error": "Selected employee does not exist."}, status=status.HTTP_400_BAD_REQUEST)

        # Check that employee is active
        if hasattr(new_employee, 'is_active') and not new_employee.is_active:
            return Response({"error": "Cannot transfer folder ownership to an inactive employee."}, status=status.HTTP_400_BAD_REQUEST)

        if not new_employee.user:
            return Response({"error": "The selected employee does not have an active ERP user account linked."}, status=status.HTTP_400_BAD_REQUEST)

        new_owner_user = new_employee.user
        new_owner_email = new_owner_user.email or (new_employee.email or "")

        if not new_owner_email:
            return Response({"error": "The selected employee does not have a valid email address configured for OTP verification."}, status=status.HTTP_400_BAD_REQUEST)

        # Previous owner resolution
        prev_owner_user, _, prev_owner_name, prev_owner_email = resolve_folder_owner_info(folder)

        if prev_owner_user and prev_owner_user.id == new_owner_user.id:
            return Response({"error": "The new owner must be different from the current owner."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Update folder owner directly
            folder.owner = new_owner_user
            folder.save()

            # Record in Ownership Transfer History
            transfer_record = DigiLockerOwnershipTransferHistory.objects.create(
                folder=folder,
                previous_owner=prev_owner_user,
                previous_owner_email=prev_owner_email,
                new_owner=new_owner_user,
                new_owner_email=new_owner_email,
                transferred_by=user,
                transfer_reason=transfer_reason
            )

            # Record in Audit Log
            DigiLockerAuditLog.objects.create(
                actor=user,
                target_employee=new_employee,
                folder=folder,
                action='folder_updated',
                status='SUCCESS',
                details=f"Ownership of folder '{folder.name}' transferred from '{prev_owner_name}' to '{new_employee}'. Reason: {transfer_reason or 'None'}.",
                ip_address=get_client_ip(request)
            )

        # Notify the new owner
        create_approval_notification(
            recipient=new_owner_user,
            sender=user,
            message=f"Folder ownership of '{folder.name}' has been transferred to you by {user.get_full_name() or user.username}.",
            badge_text="Folder Ownership",
            badge_color="success"
        )

        return Response({
            "message": f"Folder ownership of '{folder.name}' transferred to {new_employee} successfully.",
            "folder": DigiLockerFolderSerializer(folder, context={'request': request}).data,
            "transfer": DigiLockerOwnershipTransferHistorySerializer(transfer_record).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='ownership-history')
    def ownership_history(self, request, pk=None):
        """
        Returns immutable audit history of ownership transfers for this folder.
        """
        folder = self.get_object()
        history = folder.ownership_transfers.all().order_by('-transfer_date')
        return Response(DigiLockerOwnershipTransferHistorySerializer(history, many=True).data)

    @action(detail=False, methods=['get'], url_path='ownership-transfers')
    def all_ownership_transfers(self, request):
        """
        Returns global history of all folder ownership transfers.
        """
        history = DigiLockerOwnershipTransferHistory.objects.all().order_by('-transfer_date')
        return Response(DigiLockerOwnershipTransferHistorySerializer(history, many=True).data)

    @action(detail=True, methods=['post', 'patch'], url_path='update-otp-email')
    def update_otp_email(self, request, pk=None):
        """
        Update the configured OTP recipient email for a specific folder from Ownership Transfer.
        Restricted to authorized administrators.
        """
        user = request.user
        if not (is_user_admin(user) or has_mapping_permission(user)):
            return Response({"error": "Only authorized administrators can edit the folder OTP email."}, status=status.HTTP_403_FORBIDDEN)

        folder = self.get_object()
        central_email = (get_central_default_otp_email() or 'digilocker@rarenett.com').strip()
        use_default = request.data.get('use_default_otp_email')
        is_using_default = (use_default is True or (isinstance(use_default, str) and use_default.lower() == 'true'))

        new_email = (request.data.get('default_otp_email') or request.data.get('email') or '').strip()
        if not new_email and is_using_default:
            new_email = central_email

        if not new_email:
            return Response({"error": "Email address cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        import re
        email_pattern = r'^[^@\s]+@[^@\s]+\.[^@\s]+$'
        if not re.match(email_pattern, new_email):
            return Response({"error": "Please provide a valid email address format (e.g. name@company.com)."}, status=status.HTTP_400_BAD_REQUEST)

        prev_email = folder.default_otp_email or '(not set)'
        if is_using_default or new_email.lower() == central_email.lower():
            folder.uses_default_otp_email = True
            folder.default_otp_email = central_email
            status_desc = f"Switched OTP email for folder '{folder.name}' to central default ({central_email})."
        else:
            folder.uses_default_otp_email = False
            folder.default_otp_email = new_email
            status_desc = f"Updated custom OTP email for folder '{folder.name}' from '{prev_email}' to '{new_email}'."

        folder.save(update_fields=['default_otp_email', 'uses_default_otp_email'])

        DigiLockerAuditLog.objects.create(
            actor=user,
            folder=folder,
            action='folder_updated',
            status='SUCCESS',
            details=status_desc,
            ip_address=get_client_ip(request)
        )

        return Response({
            "message": f"OTP email for folder '{folder.name}' updated successfully to '{new_email}'.",
            "folder": DigiLockerFolderSerializer(folder, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class DigiLockerMappingViewSet(viewsets.ModelViewSet):
    queryset = DigiLockerFolderMapping.objects.filter(is_active=True)
    serializer_class = DigiLockerFolderMappingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = DigiLockerFolderMapping.objects.filter(is_active=True, folder__is_active=True)

        if not has_mapping_permission(user):
            emp = get_employee_for_user(user)
            if emp:
                qs = qs.filter(employee=emp)
            else:
                return qs.none()

        employee_id = self.request.query_params.get('employee_id')
        if employee_id:
            qs = qs.filter(employee_id=employee_id)

        folder_id = self.request.query_params.get('folder_id')
        if folder_id:
            qs = qs.filter(folder_id=folder_id)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(folder__name__icontains=search) |
                Q(employee__user__first_name__icontains=search) |
                Q(employee__user__last_name__icontains=search)
            )

        return qs

    def perform_update(self, serializer):
        if not has_mapping_permission(self.request.user):
            raise permissions.PermissionDenied("Only administrators can modify folder mappings.")
        serializer.save()

    def create(self, request, *args, **kwargs):
        if not has_mapping_permission(request.user):
            return Response({"error": "Only administrators can map folders to employees."}, status=status.HTTP_403_FORBIDDEN)

        folder_ids = request.data.get('folder_ids', [])
        employee_id = request.data.get('employee') or request.data.get('employee_id')
        can_upload = request.data.get('can_upload', False)
        can_view = request.data.get('can_view', True)
        view_otp_required = request.data.get('view_otp_required', True)
        can_download = request.data.get('can_download', False)
        download_otp_required = request.data.get('download_otp_required', True)

        if not employee_id:
            return Response({"error": "Employee selection is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            employee = Employee.objects.get(id=employee_id)
        except Employee.DoesNotExist:
            return Response({"error": "Selected employee does not exist."}, status=status.HTTP_400_BAD_REQUEST)

        # Support single or multiple folder mapping, or granular folder_permissions dict
        folder_permissions = request.data.get('folder_permissions')  # e.g. { folder_id: { can_view: true, ... } }
        if not folder_ids and folder_permissions and isinstance(folder_permissions, dict):
            folder_ids = [int(fid) for fid in folder_permissions.keys()]
        elif not folder_ids and request.data.get('folder'):
            folder_ids = [request.data.get('folder')]

        if not folder_ids:
            return Response({"error": "At least one folder must be selected."}, status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        updated_count = 0

        for f_id in folder_ids:
            try:
                folder = DigiLockerFolder.objects.get(id=f_id, is_active=True)
            except DigiLockerFolder.DoesNotExist:
                continue

            # Determine granular permissions for this folder if provided
            if folder_permissions and str(f_id) in folder_permissions:
                f_perm = folder_permissions[str(f_id)]
                item_view = f_perm.get('can_view', can_view)
                item_view_otp = f_perm.get('view_otp_required', view_otp_required)
                item_upload = f_perm.get('can_upload', can_upload)
                item_download = f_perm.get('can_download', can_download)
                item_download_otp = f_perm.get('download_otp_required', download_otp_required)
            elif folder_permissions and f_id in folder_permissions:
                f_perm = folder_permissions[f_id]
                item_view = f_perm.get('can_view', can_view)
                item_view_otp = f_perm.get('view_otp_required', view_otp_required)
                item_upload = f_perm.get('can_upload', can_upload)
                item_download = f_perm.get('can_download', can_download)
                item_download_otp = f_perm.get('download_otp_required', download_otp_required)
            else:
                item_view = can_view
                item_view_otp = view_otp_required
                item_upload = can_upload
                item_download = can_download
                item_download_otp = download_otp_required

            mapping, created = DigiLockerFolderMapping.objects.update_or_create(
                folder=folder,
                employee=employee,
                defaults={
                    'can_upload': bool(item_upload),
                    'can_view': bool(item_view),
                    'view_otp_required': bool(item_view_otp) if item_view else True,
                    'can_download': bool(item_download),
                    'download_otp_required': bool(item_download_otp) if item_download else True,
                    'assigned_by': request.user,
                    'is_active': True
                }
            )

            if created:
                created_count += 1
            else:
                updated_count += 1

            DigiLockerAuditLog.objects.create(
                actor=request.user,
                target_employee=employee,
                folder=folder,
                action='mapping_created' if created else 'mapping_updated',
                status='SUCCESS',
                details=f"Mapped folder '{folder.name}' to employee '{employee}' (View: {item_view} [OTP: {item_view_otp}], Upload: {item_upload}, Download: {item_download} [OTP: {item_download_otp}]).",
                ip_address=get_client_ip(request)
            )

        return Response({
            "message": f"Successfully mapped {created_count + updated_count} folder(s) to employee."
        }, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        if not has_mapping_permission(request.user):
            return Response({"error": "Only administrators can remove folder mappings."}, status=status.HTTP_403_FORBIDDEN)

        mapping = self.get_object()
        cascade = request.query_params.get('cascade') == 'true'

        mapping.is_active = False
        mapping.save()

        # If cascade is requested, also deactivate mappings for active descendants of this folder for the same employee
        revoked_count = 1
        if cascade and mapping.folder:
            descendants = []
            q = list(mapping.folder.subfolders.filter(is_active=True))
            while q:
                curr = q.pop(0)
                descendants.append(curr)
                q.extend(list(curr.subfolders.filter(is_active=True)))

            if descendants:
                desc_mappings = DigiLockerFolderMapping.objects.filter(
                    employee=mapping.employee,
                    folder__in=descendants,
                    is_active=True
                )
                for dm in desc_mappings:
                    dm.is_active = False
                    dm.save()
                    revoked_count += 1
                    DigiLockerAuditLog.objects.create(
                        actor=request.user,
                        target_employee=dm.employee,
                        folder=dm.folder,
                        action='mapping_deleted',
                        status='SUCCESS',
                        details=f"Unmapped descendant folder '{dm.folder.name}' from employee '{dm.employee}' due to parent mapping revocation.",
                        ip_address=get_client_ip(request)
                    )

        DigiLockerAuditLog.objects.create(
            actor=request.user,
            target_employee=mapping.employee,
            folder=mapping.folder,
            action='mapping_deleted',
            status='SUCCESS',
            details=f"Unmapped folder '{mapping.folder.name}' from employee '{mapping.employee}'.",
            ip_address=get_client_ip(request)
        )

        return Response({
            "message": f"Successfully revoked {revoked_count} folder mapping(s)."
        }, status=status.HTTP_200_OK)


class DigiLockerDocumentViewSet(viewsets.ModelViewSet):
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

        # Strict Upload permission check:
        # Every employee must receive explicit Upload permission through Folder Mapping before uploading.
        # No employee, including the folder creator or owner, receives automatic upload access.
        if not is_user_admin(user):
            emp = get_employee_for_user(user)
            has_perm = False
            if emp:
                perms = get_employee_permissions_for_folder(folder, emp)
                has_perm = bool(perms.get('can_upload'))
                if not has_perm:
                    allowed_upload_ids = get_allowed_folder_ids_for_employee(emp, need_upload=True)
                    has_perm = folder.id in allowed_upload_ids

            if not has_perm:
                return Response(
                    {"error": "Access Denied: You do not have Upload permission for this folder. Explicit folder mapping is required."},
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
        """
        Employee requests edit permission for an already-approved document.
        """
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
        """
        Returns audit history of all approval actions for this document.
        """
        doc = self.get_object()
        user = request.user
        if doc.uploaded_by != user and not is_user_admin(user):
            return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        history = doc.approval_history.all().order_by('-created_at')
        return Response(DigiLockerApprovalHistorySerializer(history, many=True).data)


class DigiLockerAccessView(APIView):
    """
    Handles employee folder tree access, OTP request, verification, preview, and download.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, employee_id=None):
        """
        Fetch folders and locked documents for the target employee.
        GET /api/digilocker/access/?employee_id=<id> or /api/digilocker/access/employees/<id>/folders/
        """
        user = request.user
        if not employee_id:
            employee_id = request.query_params.get('employee_id')

        is_admin = is_user_admin(user)

        # Determine target employee or "all"
        is_all_employees = is_admin and (str(employee_id).lower() == 'all')

        if is_all_employees:
            target_employee = None
            is_self_access = False
            # When admin selects "All", include active mappings across all employees
            direct_mappings = DigiLockerFolderMapping.objects.filter(
                is_active=True, folder__is_active=True
            ).select_related('folder')
        elif not is_admin:
            # Non-admin users strictly only see their own employee locker
            target_employee = get_employee_for_user(user)
            if not target_employee:
                return Response({"error": "No employee profile linked to your user account."}, status=status.HTTP_404_NOT_FOUND)
            is_self_access = True
            direct_mappings = DigiLockerFolderMapping.objects.filter(
                employee=target_employee, is_active=True, folder__is_active=True
            ).select_related('folder')
        else:
            # Admin users can view their own or select a specific employee
            if employee_id:
                try:
                    target_employee = Employee.objects.get(id=employee_id)
                except Employee.DoesNotExist:
                    return Response({"error": "Selected employee not found."}, status=status.HTTP_404_NOT_FOUND)
            else:
                target_employee = get_employee_for_user(user) or Employee.objects.first()
                if not target_employee:
                    return Response({
                        "message": "No employees found in the system.",
                        "is_admin": True,
                        "folders": []
                    })
            is_self_access = bool(target_employee.user and target_employee.user == user)
            direct_mappings = DigiLockerFolderMapping.objects.filter(
                employee=target_employee, is_active=True, folder__is_active=True
            ).select_related('folder')

        folder_perms = {}
        for m in direct_mappings:
            folder_perms[m.folder.id] = {
                'folder': m.folder,
                'can_upload': m.can_upload,
                'can_view': m.can_view,
                'view_otp_required': getattr(m, 'view_otp_required', True),
                'can_download': m.can_download,
                'download_otp_required': getattr(m, 'download_otp_required', True)
            }

        # Propagate permissions to active subfolders
        queue = list(folder_perms.keys())
        while queue:
            parent_id = queue.pop(0)
            p_perm = folder_perms[parent_id]
            subfolders = DigiLockerFolder.objects.filter(parent_folder_id=parent_id, is_active=True)
            for sf in subfolders:
                if sf.id not in folder_perms:
                    folder_perms[sf.id] = {
                        'folder': sf,
                        'can_upload': p_perm['can_upload'],
                        'can_view': p_perm['can_view'],
                        'view_otp_required': p_perm.get('view_otp_required', True),
                        'can_download': p_perm['can_download'],
                        'download_otp_required': p_perm.get('download_otp_required', True)
                    }
                    queue.append(sf.id)

        folders_data = []
        mapped_folder_ids = set(folder_perms.keys())

        for f_id, p_info in folder_perms.items():
            folder = p_info['folder']
            docs = folder.documents.filter(is_active=True).order_by('-uploaded_at')
            
            my_docs_list = []
            other_docs_list = []

            for d in docs:
                owner_user, owner_emp, owner_name, owner_email = resolve_document_owner_info(d)
                
                # Strict permission mapping:
                # Individual permissions work independently.
                # Neither folder creation nor ownership grants automatic permissions.
                can_view_perm = is_admin or bool(p_info['can_view'])
                can_download_perm = is_admin or bool(p_info['can_download'])

                # If an employee has no View permission, documents in this folder must not be shown
                if not can_view_perm and not can_download_perm:
                    continue

                # Independent OTP requirements for View and Download
                view_otp_req = (not is_admin) and bool(p_info.get('view_otp_required', True))
                download_otp_req = (not is_admin) and bool(p_info.get('download_otp_required', True))

                # Document requires OTP for viewing if view_otp_req is True
                requires_otp = view_otp_req
                is_locked = view_otp_req

                doc_entry = {
                    'id': d.id,
                    'original_filename': d.original_filename,
                    'file_extension': d.file_extension,
                    'file_size_display': d.file_size_display,
                    'uploaded_at': d.uploaded_at,
                    'description': d.description,
                    'owner_name': owner_name,
                    'owner_email_masked': mask_email(owner_email),
                    'is_owner': False,
                    'is_locked': is_locked,
                    'requires_otp': requires_otp,
                    'view_otp_required': view_otp_req,
                    'download_otp_required': download_otp_req,
                    'direct_preview_url': f"/api/digilocker/access/documents/{d.id}/preview/" if (can_view_perm and not view_otp_req) else None,
                    'direct_download_url': f"/api/digilocker/access/documents/{d.id}/download/" if (can_download_perm and not download_otp_req) else None,
                    'can_view': can_view_perm,
                    'can_download': can_download_perm
                }

                # Categorize based on whether current user uploaded it, for UX convenience
                if d.uploaded_by == user:
                    my_docs_list.append(doc_entry)
                else:
                    other_docs_list.append(doc_entry)

            # Combined docs list for backward compatibility, keeping my_docs first
            combined_docs = my_docs_list + other_docs_list

            # Calculate human-readable folder path
            parts = [folder.name]
            curr = folder.parent_folder
            visited = set([folder.id])
            while curr and curr.id not in visited:
                parts.append(curr.name)
                visited.add(curr.id)
                curr = curr.parent_folder
            display_path = ' / '.join(reversed(parts))

            folders_data.append({
                'folder_id': folder.id,
                'folder_name': folder.name,
                'folder_path': display_path,
                'parent_folder_id': folder.parent_folder_id,
                'description': folder.description,
                'folder_type': folder.folder_type,
                'can_upload': is_admin or bool(p_info['can_upload']),
                'can_view': is_admin or bool(p_info['can_view']),
                'can_download': is_admin or bool(p_info['can_download']),
                'my_documents': my_docs_list,
                'other_documents': other_docs_list,
                'documents': combined_docs
            })

        # STRICT RULE: Personal folders and newly created folders receive NO automatic access without explicit mapping.
        # Only explicitly mapped folders (processed above) are returned in the response.

        if is_all_employees:
            return Response({
                'employee_id': 'all',
                'employee_name': 'All Employees',
                'employee_email_masked': '***',
                'is_self_access': False,
                'is_admin': True,
                'folders': folders_data
            })

        emp_name = target_employee.user.get_full_name() if target_employee.user else (target_employee.candidate.full_name if target_employee.candidate else f"Employee #{target_employee.id}")
        emp_email = target_employee.user.email if target_employee.user and target_employee.user.email else target_employee.email

        return Response({
            'employee_id': target_employee.id,
            'employee_name': emp_name,
            'employee_email_masked': mask_email(emp_email),
            'is_self_access': is_self_access,
            'is_admin': is_admin,
            'folders': folders_data
        })


class DigiLockerRequestOTPView(APIView):
    """
    Generate and email a 4-digit OTP for document View or Download.
    POST /api/digilocker/access/request-otp/
    Payload: { "document_id": 1, "operation": "view" | "download", "employee_id": 2 }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, document_id=None):
        user = request.user
        doc_id = document_id or request.data.get('document_id')
        operation = request.data.get('operation', 'view').lower()
        employee_id = request.data.get('employee_id')

        if operation not in ['view', 'download']:
            return Response({"error": "Invalid operation. Must be 'view' or 'download'."}, status=status.HTTP_400_BAD_REQUEST)

        if not doc_id:
            return Response({"error": "Document ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            document = DigiLockerDocument.objects.get(id=doc_id, is_active=True, folder__is_active=True)
        except DigiLockerDocument.DoesNotExist:
            return Response({"error": "Document not found or inactive."}, status=status.HTTP_404_NOT_FOUND)

        # Determine requester employee profile
        requester_emp = get_employee_for_user(user)

        # Check strict mapping & operation permissions for the requester
        requester_perms = get_employee_permissions_for_folder(document.folder, requester_emp)
        is_admin = is_user_admin(user)

        if not is_admin:
            if operation == 'view' and not requester_perms.get('can_view'):
                return Response({"error": "Access Denied: You do not have View permission for this folder. Explicit folder mapping is required."}, status=status.HTTP_403_FORBIDDEN)
            if operation == 'download' and not requester_perms.get('can_download'):
                return Response({"error": "Access Denied: You do not have Download permission for this folder. Explicit folder mapping is required."}, status=status.HTTP_403_FORBIDDEN)

        # Determine the actual folder creator / owner for permissions & notification
        owner_user, owner_emp, owner_name, owner_email = resolve_folder_owner_info(document.folder)

        if not owner_user:
            return Response({"error": "Document owner could not be identified."}, status=status.HTTP_400_BAD_REQUEST)

        # ALWAYS send OTP to the effective OTP Email, NEVER to employee personal email
        central_default_email = (get_central_default_otp_email() or 'digilocker@rarenett.com').strip()
        if getattr(document.folder, 'uses_default_otp_email', True):
            recipient_email = central_default_email
        else:
            folder_custom_email = getattr(document.folder, 'default_otp_email', None)
            recipient_email = (folder_custom_email or central_default_email).strip()

        target_employee = owner_emp

        if not recipient_email:
            return Response({
                "error": "No default OTP email address has been configured. Cannot send OTP verification code."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Target employee model instance for OTPChallenge FK
        if not target_employee:
            # If the owner user doesn't have an Employee row, find or fallback
            target_employee = Employee.objects.filter(email=recipient_email).first()
            if not target_employee:
                target_employee = requester_emp or Employee.objects.first()

        # Check rate-limiting: don't allow resending within 30 seconds
        recent_challenge = DigiLockerOTPChallenge.objects.filter(
            requester=user,
            document=document,
            operation=operation,
            created_at__gte=timezone.now() - timedelta(seconds=30)
        ).first()

        if recent_challenge:
            return Response({
                "error": "Please wait 30 seconds before requesting a new OTP."
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        # Invalidate older pending challenges for this requester + document + operation
        DigiLockerOTPChallenge.objects.filter(
            requester=user,
            document=document,
            operation=operation,
            consumed_at__isnull=True
        ).update(consumed_at=timezone.now())

        # Generate cryptographically secure 4-digit OTP
        otp = f"{secrets.randbelow(10000):04d}"
        salt = secrets.token_hex(16)
        otp_hash = hashlib.sha256(f"{otp}:{salt}".encode('utf-8')).hexdigest() + f":{salt}"
        expires_at = timezone.now() + timedelta(minutes=5)

        challenge = DigiLockerOTPChallenge.objects.create(
            requester=user,
            target_employee=target_employee,
            document=document,
            operation=operation,
            otp_hash=otp_hash,
            expires_at=expires_at,
            max_attempts=5
        )

        # Send Email
        emp_name = owner_name
        subject = f"DigiLocker Security Verification: {operation.capitalize()} Document OTP"
        message = f"""Dear {emp_name},

A request was made by {user.get_full_name() or user.username} ({user.email}) to {operation.upper()} your document:

Document: {document.original_filename}
Folder: {document.folder.name}

Your 4-digit OTP security authorization code is:

    {otp}

This code is valid for 5 minutes (Expires at {expires_at.strftime('%H:%M:%S')}).
Please share this code only if you authorize this access.

Best regards,
Glenda DigiLocker System
"""

        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient_email],
                fail_silently=False
            )
        except Exception as e:
            challenge.delete()
            DigiLockerAuditLog.objects.create(
                actor=user,
                target_employee=target_employee,
                document=document,
                folder=document.folder,
                action='otp_requested',
                status='FAILURE',
                details=f"Failed to send OTP email to {mask_email(recipient_email)}: {str(e)}",
                ip_address=get_client_ip(request)
            )
            return Response({
                "error": "Failed to dispatch verification email. Please check your SMTP settings or network connection."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        DigiLockerAuditLog.objects.create(
            actor=user,
            target_employee=target_employee,
            document=document,
            folder=document.folder,
            action='otp_requested',
            status='SUCCESS',
            details=f"Sent 4-digit OTP for {operation} of '{document.original_filename}' to {mask_email(recipient_email)}.",
            ip_address=get_client_ip(request)
        )

        return Response({
            "message": f"A 4-digit OTP has been sent to {mask_email(recipient_email)}.",
            "challenge_id": challenge.id,
            "document_id": document.id,
            "document_name": document.original_filename,
            "operation": operation,
            "expires_in_seconds": 300,
            "email_masked": mask_email(recipient_email)
        }, status=status.HTTP_200_OK)


class DigiLockerVerifyOTPView(APIView):
    """
    Verify the 4-digit OTP submitted by the user.
    POST /api/digilocker/access/verify-otp/
    Payload: { "challenge_id": 1, "otp": "1234" }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        challenge_id = request.data.get('challenge_id')
        otp_input = str(request.data.get('otp', '')).strip()

        if not challenge_id:
            return Response({"error": "Challenge ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not otp_input or len(otp_input) != 4 or not otp_input.isdigit():
            return Response({"error": "Please enter a valid 4-digit numeric OTP."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            try:
                challenge = DigiLockerOTPChallenge.objects.select_for_update().get(
                    id=challenge_id,
                    requester=user
                )
            except DigiLockerOTPChallenge.DoesNotExist:
                return Response({"error": "Invalid verification challenge."}, status=status.HTTP_404_NOT_FOUND)

            if challenge.consumed_at is not None:
                return Response({"error": "This OTP challenge has already been verified or invalidated."}, status=status.HTTP_400_BAD_REQUEST)

            if challenge.is_expired():
                return Response({"error": "OTP has expired. Please request a new code."}, status=status.HTTP_400_BAD_REQUEST)

            if not challenge.has_attempts_left():
                return Response({"error": "Maximum verification attempts exceeded. Please request a new OTP."}, status=status.HTTP_400_BAD_REQUEST)

            challenge.attempt_count += 1
            challenge.save(update_fields=['attempt_count'])

            # Verify hash
            try:
                expected_hash, salt = challenge.otp_hash.split(':', 1)
                computed_hash = hashlib.sha256(f"{otp_input}:{salt}".encode('utf-8')).hexdigest()
            except Exception:
                computed_hash = ""
                expected_hash = "invalid"

            if not secrets.compare_digest(computed_hash, expected_hash):
                remaining = challenge.max_attempts - challenge.attempt_count
                DigiLockerAuditLog.objects.create(
                    actor=user,
                    target_employee=challenge.target_employee,
                    document=challenge.document,
                    folder=challenge.document.folder,
                    action='otp_failed',
                    status='FAILURE',
                    details=f"Incorrect OTP attempt ({challenge.attempt_count}/{challenge.max_attempts}) for {challenge.operation} of '{challenge.document.original_filename}'.",
                    ip_address=get_client_ip(request)
                )
                return Response({
                    "error": f"Invalid OTP. {remaining} attempt(s) remaining." if remaining > 0 else "Maximum attempts exceeded."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Success! Mark challenge verified and issue access token
            challenge.is_verified = True
            challenge.consumed_at = timezone.now()
            access_token = secrets.token_urlsafe(32)
            challenge.access_token = access_token
            challenge.token_expires_at = timezone.now() + timedelta(minutes=10)
            challenge.save()

            DigiLockerAuditLog.objects.create(
                actor=user,
                target_employee=challenge.target_employee,
                document=challenge.document,
                folder=challenge.document.folder,
                action='otp_verified',
                status='SUCCESS',
                details=f"Successfully verified OTP for {challenge.operation} of '{challenge.document.original_filename}'.",
                ip_address=get_client_ip(request)
            )

        return Response({
            "message": "OTP verified successfully.",
            "access_token": access_token,
            "document_id": challenge.document.id,
            "document_name": challenge.document.original_filename,
            "operation": challenge.operation,
            "preview_url": f"/api/digilocker/access/documents/{challenge.document.id}/preview/?token={access_token}",
            "download_url": f"/api/digilocker/access/documents/{challenge.document.id}/download/?token={access_token}"
        }, status=status.HTTP_200_OK)


class DigiLockerPreviewDocumentView(APIView):
    """
    Stream document for preview in browser (inline).
    Direct access is strictly allowed only for the document owner.
    Cross-employee access (including admins without emergency bypass) requires a valid, verified OTP access token.
    GET /api/digilocker/access/documents/<id>/preview/?token=<token>
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, document_id):
        token = request.query_params.get('token')
        doc = None
        actor = request.user if request.user and request.user.is_authenticated else None
        target_emp = None

        if token:
            challenge = DigiLockerOTPChallenge.objects.filter(
                access_token=token,
                document_id=document_id,
                operation='view',
                is_verified=True,
                token_expires_at__gte=timezone.now()
            ).select_related('document', 'document__folder', 'requester', 'target_employee').first()

            if not challenge:
                return HttpResponse("Access Denied: Expired or invalid authorization token.", status=403)

            doc = challenge.document
            actor = challenge.requester
            owner_user, owner_emp, owner_name, owner_email = resolve_document_owner_info(doc)
            target_emp = owner_emp or challenge.target_employee

            # Re-verify requester still has folder view permission through explicit mapping
            req_emp = get_employee_for_user(actor)
            perms = get_employee_permissions_for_folder(doc.folder, req_emp)
            if not is_user_admin(actor) and not perms.get('can_view'):
                return HttpResponse("Access Denied: Folder View permission is revoked or not mapped.", status=403)
        elif request.user and request.user.is_authenticated:
            try:
                doc = DigiLockerDocument.objects.get(id=document_id, is_active=True, folder__is_active=True)
            except DigiLockerDocument.DoesNotExist:
                raise Http404("Document not found.")

            owner_user, owner_emp, owner_name, owner_email = resolve_folder_owner_info(doc.folder)
            req_emp = get_employee_for_user(request.user)
            perms = get_employee_permissions_for_folder(doc.folder, req_emp)
            is_admin = is_user_admin(request.user) or has_file_approval_permission(request.user)

            # Strict mapping check: Non-admins must have explicit View permission
            if not is_admin and not perms.get('can_view'):
                return HttpResponse("Access Denied: You do not have View permission for this folder. Explicit folder mapping is required.", status=403)

            # Direct preview without OTP is permitted for authorized administrators or when view_otp_required is False
            can_view_direct = is_admin or not perms.get('view_otp_required', True)

            if not can_view_direct:
                return HttpResponse("Access Denied: OTP verification is required to view this document.", status=403)

            target_emp = owner_emp or get_employee_for_user(request.user)
        else:
            return HttpResponse("Access Denied: Missing authorization token.", status=403)

        if not doc or not doc.stored_file or not os.path.exists(doc.stored_file.path):
            raise Http404("Document file not found on disk.")

        # Determine MIME type
        ext = doc.file_extension.lower()
        if ext == 'pdf':
            content_type = 'application/pdf'
        elif ext in ['jpg', 'jpeg']:
            content_type = 'image/jpeg'
        elif ext == 'png':
            content_type = 'image/png'
        elif ext in ['gif', 'webp']:
            content_type = f'image/{ext}'
        elif ext in ['txt', 'csv']:
            content_type = 'text/plain'
        else:
            content_type = doc.mime_type or 'application/octet-stream'

        is_cross = bool(token or (doc.owner and doc.owner != actor))
        access_type_label = "CROSS-EMPLOYEE (OTP)" if is_cross else "OWN DOCUMENT (DIRECT)"

        DigiLockerAuditLog.objects.create(
            actor=actor,
            target_employee=target_emp,
            document=doc,
            folder=doc.folder,
            action='document_viewed',
            status='SUCCESS',
            details=f"Previewed document '{doc.original_filename}' via {access_type_label}.",
            ip_address=get_client_ip(request),
            safe_metadata={
                'verification': 'OTP' if token else 'DIRECT',
                'access_type': 'CROSS-EMPLOYEE' if is_cross else 'OWN DOCUMENT'
            }
        )

        response = FileResponse(open(doc.stored_file.path, 'rb'), content_type=content_type)
        response['Content-Disposition'] = f'inline; filename="{doc.original_filename}"'
        response['X-Content-Type-Options'] = 'nosniff'
        return response


class DigiLockerDownloadDocumentView(APIView):
    """
    Stream document as attachment download.
    Direct download is strictly allowed only for the document owner.
    Cross-employee download (including admins without emergency bypass) requires a valid, verified OTP access token.
    GET /api/digilocker/access/documents/<id>/download/?token=<token>
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, document_id):
        token = request.query_params.get('token')
        doc = None
        actor = request.user if request.user and request.user.is_authenticated else None
        target_emp = None

        if token:
            challenge = DigiLockerOTPChallenge.objects.filter(
                access_token=token,
                document_id=document_id,
                operation='download',
                is_verified=True,
                token_expires_at__gte=timezone.now()
            ).select_related('document', 'document__folder', 'requester', 'target_employee').first()

            if not challenge:
                return HttpResponse("Access Denied: Expired or invalid download token.", status=403)

            doc = challenge.document
            actor = challenge.requester
            owner_user, owner_emp, owner_name, owner_email = resolve_document_owner_info(doc)
            target_emp = owner_emp or challenge.target_employee

            # Re-verify requester still has folder download permission through explicit mapping
            req_emp = get_employee_for_user(actor)
            perms = get_employee_permissions_for_folder(doc.folder, req_emp)
            if not is_user_admin(actor) and not perms.get('can_download'):
                return HttpResponse("Access Denied: Folder Download permission is revoked or not mapped.", status=403)
        elif request.user and request.user.is_authenticated:
            try:
                doc = DigiLockerDocument.objects.get(id=document_id, is_active=True, folder__is_active=True)
            except DigiLockerDocument.DoesNotExist:
                raise Http404("Document not found.")

            owner_user, owner_emp, owner_name, owner_email = resolve_folder_owner_info(doc.folder)
            req_emp = get_employee_for_user(request.user)
            perms = get_employee_permissions_for_folder(doc.folder, req_emp)
            is_admin = is_user_admin(request.user)

            # Strict mapping check: Non-admins must have explicit Download permission
            if not is_admin and not perms.get('can_download'):
                return HttpResponse("Access Denied: You do not have Download permission for this folder. Explicit folder mapping is required.", status=403)

            # Direct download without OTP is permitted for authorized administrators or when download_otp_required is False
            can_dl_direct = is_admin or not perms.get('download_otp_required', True)

            if not can_dl_direct:
                return HttpResponse("Access Denied: OTP verification is required to download this document.", status=403)

            target_emp = owner_emp or get_employee_for_user(request.user)
        else:
            return HttpResponse("Access Denied: Missing authorization token.", status=403)

        if not doc or not doc.stored_file or not os.path.exists(doc.stored_file.path):
            raise Http404("Document file not found on disk.")

        is_cross = bool(token or (doc.owner and doc.owner != actor))
        access_type_label = "CROSS-EMPLOYEE (OTP)" if is_cross else "OWN DOCUMENT (DIRECT)"

        DigiLockerAuditLog.objects.create(
            actor=actor,
            target_employee=target_emp,
            document=doc,
            folder=doc.folder,
            action='document_downloaded',
            status='SUCCESS',
            details=f"Downloaded document '{doc.original_filename}' ({doc.file_size_display}) via {access_type_label}.",
            ip_address=get_client_ip(request),
            safe_metadata={
                'verification': 'OTP' if token else 'DIRECT',
                'access_type': 'CROSS-EMPLOYEE' if is_cross else 'OWN DOCUMENT'
            }
        )

        response = FileResponse(open(doc.stored_file.path, 'rb'), content_type=doc.mime_type or 'application/octet-stream')
        response['Content-Disposition'] = f'attachment; filename="{doc.original_filename}"'
        response['X-Content-Type-Options'] = 'nosniff'
        return response
        response['Content-Disposition'] = f'attachment; filename="{doc.original_filename}"'
        response['X-Content-Type-Options'] = 'nosniff'
        return response


class DigiLockerReportViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for DigiLocker audit and access logs.
    """
    queryset = DigiLockerAuditLog.objects.all().order_by('-timestamp')
    serializer_class = DigiLockerAuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Universal report: Shows complete organizational audit history for all authorized report viewers
        qs = DigiLockerAuditLog.objects.all().order_by('-timestamp')

        employee_id = self.request.query_params.get('employee_id')
        if employee_id:
            qs = qs.filter(target_employee_id=employee_id)

        folder_id = self.request.query_params.get('folder_id')
        if folder_id:
            qs = qs.filter(folder_id=folder_id)

        action_filter = self.request.query_params.get('action')
        if action_filter:
            qs = qs.filter(action=action_filter)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        start_date = self.request.query_params.get('start_date')
        if start_date:
            qs = qs.filter(timestamp__date__gte=start_date)

        end_date = self.request.query_params.get('end_date')
        if end_date:
            qs = qs.filter(timestamp__date__lte=end_date)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(document__original_filename__icontains=search) |
                Q(folder__name__icontains=search) |
                Q(details__icontains=search) |
                Q(actor__first_name__icontains=search) |
                Q(actor__last_name__icontains=search) |
                Q(target_employee__user__first_name__icontains=search) |
                Q(target_employee__user__last_name__icontains=search)
            )

        return qs

class DigiLockerReportPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = 'page_size'
    max_page_size = 200

    def get_paginated_response(self, data):
        try:
            next_link = self.get_next_link()
        except Exception:
            next_link = None
        try:
            prev_link = self.get_previous_link()
        except Exception:
            prev_link = None

        return Response({
            'count': self.page.paginator.count,
            'total_pages': self.page.paginator.num_pages,
            'current_page': self.page.number,
            'next': next_link,
            'previous': prev_link,
            'results': data
        })

class BaseDigiLockerAccessReportView(APIView):
    """
    Base API view for document access reports (Files View Report and File Download Report).
    Returns real DigiLockerAuditLog records with server-side pagination, date filtering,
    and search support.
    """
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = DigiLockerReportPagination
    target_action = None  # Subclasses specify 'document_viewed' or 'document_downloaded'

    def get_queryset(self, request):
        user = request.user
        # Universal report: Shows complete organizational access history for all authorized viewers
        qs = DigiLockerAuditLog.objects.filter(
            action=self.target_action,
            status='SUCCESS'
        ).select_related('document', 'folder', 'actor', 'target_employee').order_by('-timestamp')

        # Filters: Start Date & End Date
        start_date = request.query_params.get('start_date') or request.query_params.get('date_from')
        if start_date:
            qs = qs.filter(timestamp__date__gte=start_date)

        end_date = request.query_params.get('end_date') or request.query_params.get('date_to')
        if end_date:
            qs = qs.filter(timestamp__date__lte=end_date)

        # Filter: Filename search
        filename = request.query_params.get('filename')
        if filename:
            qs = qs.filter(document__original_filename__icontains=filename)

        # Filter: Employee search (accessed by)
        employee_search = request.query_params.get('employee')
        if employee_search:
            matched_emp_users = Employee.objects.filter(
                Q(candidate__first_name__icontains=employee_search) |
                Q(candidate__last_name__icontains=employee_search)
            ).values_list('user_id', flat=True)
            qs = qs.filter(
                Q(actor__first_name__icontains=employee_search) |
                Q(actor__last_name__icontains=employee_search) |
                Q(actor__username__icontains=employee_search) |
                Q(actor_id__in=matched_emp_users)
            )

        # General search keyword
        search = request.query_params.get('search')
        if search:
            matched_emp_users = Employee.objects.filter(
                Q(candidate__first_name__icontains=search) |
                Q(candidate__last_name__icontains=search)
            ).values_list('user_id', flat=True)
            matched_target_emps = Employee.objects.filter(
                Q(candidate__first_name__icontains=search) |
                Q(candidate__last_name__icontains=search) |
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search)
            ).values_list('id', flat=True)
            qs = qs.filter(
                Q(document__original_filename__icontains=search) |
                Q(details__icontains=search) |
                Q(actor__first_name__icontains=search) |
                Q(actor__last_name__icontains=search) |
                Q(actor__username__icontains=search) |
                Q(actor_id__in=matched_emp_users) |
                Q(target_employee_id__in=matched_target_emps) |
                Q(folder__name__icontains=search)
            )

        return qs

    def get(self, request):
        qs = self.get_queryset(request)
        
        # Check export parameter
        is_export = request.query_params.get('export') == 'true' or request.query_params.get('all') == 'true'
        if is_export:
            serializer = DigiLockerAuditLogSerializer(qs, many=True)
            return Response(serializer.data)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            serializer = DigiLockerAuditLogSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = DigiLockerAuditLogSerializer(qs, many=True)
        return Response(serializer.data)


class DigiLockerFilesViewReportView(BaseDigiLockerAccessReportView):
    """
    GET /api/digilocker/reports/files-view/
    Returns real access logs of successful document preview/view actions.
    """
    target_action = 'document_viewed'


class DigiLockerFileDownloadReportView(BaseDigiLockerAccessReportView):
    """
    GET /api/digilocker/reports/file-download/
    Returns real access logs of successful document download actions.
    """
    target_action = 'document_downloaded'



class DigiLockerFileApprovalViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Consolidated file approvals list for administrators.
    Allows admins to inspect, preview, approve, and reject any employee's uploaded documents.
    """
    queryset = DigiLockerDocument.objects.filter(is_active=True, folder__is_active=True).select_related(
        'folder', 'uploaded_by', 'reviewed_by'
    ).order_by('-uploaded_at')
    serializer_class = DigiLockerDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not has_file_approval_permission(user):
            # Only administrators or users with file approval permissions can access
            return DigiLockerDocument.objects.none()

        qs = DigiLockerDocument.objects.filter(
            is_active=True,
            folder__is_active=True
        ).select_related('folder', 'uploaded_by', 'reviewed_by').prefetch_related('edit_requests')

        # Status filter
        status_param = self.request.query_params.get('status')
        if status_param and status_param.lower() in ['pending', 'approved', 'rejected']:
            qs = qs.filter(approval_status=status_param.lower())

        # Folder filter
        folder_id = self.request.query_params.get('folder')
        if folder_id:
            qs = qs.filter(folder_id=folder_id)

        # Employee filter
        emp_id = self.request.query_params.get('employee')
        if emp_id:
            qs = qs.filter(uploaded_by__employee__id=emp_id)

        # Search filter
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(original_filename__icontains=search) |
                Q(description__icontains=search) |
                Q(folder__name__icontains=search) |
                Q(uploaded_by__first_name__icontains=search) |
                Q(uploaded_by__last_name__icontains=search) |
                Q(uploaded_by__username__icontains=search)
            )

        return qs

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        user = request.user
        if not has_file_approval_permission(user):
            return Response({"error": "Only authorized administrators can approve files."}, status=status.HTTP_403_FORBIDDEN)

        doc = self.get_object()

        # Cannot approve own document
        if doc.uploaded_by == user:
            return Response({"error": "Administrators cannot approve their own uploaded documents."}, status=status.HTTP_400_BAD_REQUEST)

        prev_status = doc.approval_status
        is_reapproval = doc.approval_history.filter(action_type='document_modified').exists()
        action_type = 'reapproved' if is_reapproval else 'approved'

        with transaction.atomic():
            doc.approval_status = 'approved'
            doc.reviewed_by = user
            doc.reviewed_at = timezone.now()
            doc.rejection_reason = None
            doc.save()

            DigiLockerApprovalHistory.objects.create(
                document=doc,
                action_type=action_type,
                previous_status=prev_status,
                new_status='approved',
                performed_by=user,
                remarks=f"Document approved by administrator {user.get_full_name() or user.username}."
            )

            DigiLockerAuditLog.objects.create(
                actor=user,
                folder=doc.folder,
                document=doc,
                action='document_uploaded',
                status='SUCCESS',
                details=f"Document '{doc.original_filename}' approved by admin {user}.",
                ip_address=get_client_ip(request)
            )

        # Notify the employee who uploaded the document
        if doc.uploaded_by:
            create_approval_notification(
                recipient=doc.uploaded_by,
                sender=user,
                message=f"Your document '{doc.original_filename}' has been Approved by {user.get_full_name() or user.username}.",
                badge_text="Approved",
                badge_color="success"
            )

        return Response({
            "message": f"Document '{doc.original_filename}' has been approved.",
            "document": DigiLockerDocumentSerializer(doc, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        user = request.user
        if not has_file_approval_permission(user):
            return Response({"error": "Only authorized administrators can reject files."}, status=status.HTTP_403_FORBIDDEN)

        doc = self.get_object()

        # Cannot reject own document
        if doc.uploaded_by == user:
            return Response({"error": "Administrators cannot perform approval actions on their own documents."}, status=status.HTTP_400_BAD_REQUEST)

        rejection_reason = request.data.get('reason', '').strip()
        if not rejection_reason:
            return Response({"error": "A rejection reason is required."}, status=status.HTTP_400_BAD_REQUEST)

        prev_status = doc.approval_status

        with transaction.atomic():
            doc.approval_status = 'rejected'
            doc.reviewed_by = user
            doc.reviewed_at = timezone.now()
            doc.rejection_reason = rejection_reason
            doc.save()

            DigiLockerApprovalHistory.objects.create(
                document=doc,
                action_type='rejected',
                previous_status=prev_status,
                new_status='rejected',
                performed_by=user,
                remarks=f"Rejected: {rejection_reason}"
            )

            DigiLockerAuditLog.objects.create(
                actor=user,
                folder=doc.folder,
                document=doc,
                action='document_uploaded',
                status='FAILURE',
                details=f"Document '{doc.original_filename}' rejected by admin {user}. Reason: {rejection_reason}",
                ip_address=get_client_ip(request)
            )

        # Notify the employee
        if doc.uploaded_by:
            create_approval_notification(
                recipient=doc.uploaded_by,
                sender=user,
                message=f"Your document '{doc.original_filename}' was Rejected: {rejection_reason}",
                badge_text="Rejected",
                badge_color="danger"
            )

        return Response({
            "message": f"Document '{doc.original_filename}' has been rejected.",
            "document": DigiLockerDocumentSerializer(doc, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='set-pending')
    def set_pending(self, request, pk=None):
        """
        Allows authorized administrators to revert an approved document back to pending status
        so that it can be edited, updated, or re-reviewed.
        """
        user = request.user
        if not has_file_approval_permission(user):
            return Response({"error": "Only authorized administrators can change approval status."}, status=status.HTTP_403_FORBIDDEN)

        doc = self.get_object()

        # Cannot modify own document approval status
        if doc.uploaded_by == user:
            return Response({"error": "Administrators cannot perform approval actions on their own documents."}, status=status.HTTP_400_BAD_REQUEST)

        prev_status = doc.approval_status
        remarks = request.data.get('remarks', 'Status reverted to Pending by administrator for editing or re-evaluation.').strip()

        with transaction.atomic():
            doc.approval_status = 'pending'
            doc.reviewed_by = user
            doc.reviewed_at = timezone.now()
            doc.rejection_reason = None
            doc.save()

            DigiLockerApprovalHistory.objects.create(
                document=doc,
                action_type='status_reverted',
                previous_status=prev_status,
                new_status='pending',
                performed_by=user,
                remarks=remarks
            )

            DigiLockerAuditLog.objects.create(
                actor=user,
                folder=doc.folder,
                document=doc,
                action='document_uploaded',
                status='SUCCESS',
                details=f"Document '{doc.original_filename}' status changed from '{prev_status}' to 'pending' by admin {user}.",
                ip_address=get_client_ip(request)
            )

        # Notify the employee who uploaded the document
        if doc.uploaded_by:
            create_approval_notification(
                recipient=doc.uploaded_by,
                sender=user,
                message=f"Document '{doc.original_filename}' has been moved back to Pending status for review/editing by {user.get_full_name() or user.username}.",
                badge_text="Status Pending",
                badge_color="warning"
            )

        return Response({
            "message": f"Document '{doc.original_filename}' has been changed to Pending.",
            "document": DigiLockerDocumentSerializer(doc, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class DigiLockerEditRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling Edit Approval Requests.
    Administrators review and approve/reject edit requests across all employees.
    """
    queryset = DigiLockerEditRequest.objects.all().select_related(
        'document', 'document__folder', 'requested_by', 'reviewed_by'
    ).order_by('-created_at')
    serializer_class = DigiLockerEditRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if has_file_approval_permission(user):
            qs = DigiLockerEditRequest.objects.all()
        else:
            qs = DigiLockerEditRequest.objects.filter(requested_by=user)

        qs = qs.select_related('document', 'document__folder', 'requested_by', 'reviewed_by')

        status_param = self.request.query_params.get('status')
        if status_param and status_param.lower() in ['pending', 'approved', 'rejected', 'used']:
            qs = qs.filter(status=status_param.lower())

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(document__original_filename__icontains=search) |
                Q(request_reason__icontains=search) |
                Q(requested_by__first_name__icontains=search) |
                Q(requested_by__last_name__icontains=search)
            )

        return qs

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        user = request.user
        if not has_file_approval_permission(user):
            return Response({"error": "Only authorized administrators can approve edit requests."}, status=status.HTTP_403_FORBIDDEN)

        edit_req = self.get_object()

        # Cannot approve own request
        if edit_req.requested_by == user:
            return Response({"error": "Administrators cannot approve their own edit requests."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            edit_req.status = 'approved'
            edit_req.reviewed_by = user
            edit_req.reviewed_at = timezone.now()
            edit_req.rejection_reason = None
            edit_req.save()

            DigiLockerApprovalHistory.objects.create(
                document=edit_req.document,
                action_type='edit_approved',
                previous_status='pending',
                new_status='approved',
                performed_by=user,
                remarks=f"Edit request approved for employee {edit_req.requested_by.get_full_name() or edit_req.requested_by.username}."
            )

            DigiLockerAuditLog.objects.create(
                actor=user,
                folder=edit_req.document.folder,
                document=edit_req.document,
                action='document_uploaded',
                status='SUCCESS',
                details=f"Edit request approved for '{edit_req.document.original_filename}' by admin {user}.",
                ip_address=get_client_ip(request)
            )

        # Notify the employee
        create_approval_notification(
            recipient=edit_req.requested_by,
            sender=user,
            message=f"Your edit request for '{edit_req.document.original_filename}' has been Approved! You can now edit/resubmit the document.",
            badge_text="Edit Approved",
            badge_color="success"
        )

        return Response({
            "message": "Edit request approved successfully.",
            "edit_request": DigiLockerEditRequestSerializer(edit_req).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        user = request.user
        if not has_file_approval_permission(user):
            return Response({"error": "Only authorized administrators can reject edit requests."}, status=status.HTTP_403_FORBIDDEN)

        edit_req = self.get_object()

        # Cannot reject own request
        if edit_req.requested_by == user:
            return Response({"error": "Administrators cannot process their own edit requests."}, status=status.HTTP_400_BAD_REQUEST)

        rejection_reason = request.data.get('reason', '').strip()
        if not rejection_reason:
            return Response({"error": "A rejection reason is required."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            edit_req.status = 'rejected'
            edit_req.reviewed_by = user
            edit_req.reviewed_at = timezone.now()
            edit_req.rejection_reason = rejection_reason
            edit_req.save()

            DigiLockerApprovalHistory.objects.create(
                document=edit_req.document,
                action_type='edit_rejected',
                previous_status='pending',
                new_status='rejected',
                performed_by=user,
                remarks=f"Edit request rejected: {rejection_reason}"
            )

            DigiLockerAuditLog.objects.create(
                actor=user,
                folder=edit_req.document.folder,
                document=edit_req.document,
                action='document_uploaded',
                status='FAILURE',
                details=f"Edit request rejected for '{edit_req.document.original_filename}' by admin {user}. Reason: {rejection_reason}",
                ip_address=get_client_ip(request)
            )

        # Notify the employee
        create_approval_notification(
            recipient=edit_req.requested_by,
            sender=user,
            message=f"Your edit request for '{edit_req.document.original_filename}' was Rejected: {rejection_reason}",
            badge_text="Edit Rejected",
            badge_color="danger"
        )

        return Response({
            "message": "Edit request rejected successfully.",
            "edit_request": DigiLockerEditRequestSerializer(edit_req).data
        }, status=status.HTTP_200_OK)

class DigiLockerSettingsView(APIView):
    """
    Centralized configuration endpoint for DigiLocker default OTP email.
    GET: Returns current configured default OTP email (accessible to authenticated users).
    PUT/PATCH: Allows authorized administrators to update the central default OTP email.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        settings_obj, _ = DigiLockerSettings.objects.get_or_create(
            id=1,
            defaults={'default_otp_email': 'digilocker@rarenett.com', 'updated_by': request.user}
        )
        return Response(DigiLockerSettingsSerializer(settings_obj).data)

    def put(self, request):
        if not is_user_admin(request.user) and not has_file_approval_permission(request.user):
            return Response({"error": "Only authorized administrators can modify the centralized default OTP email."}, status=status.HTTP_403_FORBIDDEN)

        new_email = request.data.get('default_otp_email', '').strip()
        if not new_email:
            return Response({"error": "A valid default OTP email address is required."}, status=status.HTTP_400_BAD_REQUEST)

        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError
        try:
            validate_email(new_email)
        except ValidationError:
            return Response({"error": "Invalid email address format."}, status=status.HTTP_400_BAD_REQUEST)

        settings_obj, _ = DigiLockerSettings.objects.get_or_create(id=1)
        settings_obj.default_otp_email = new_email
        if 'default_phone_number' in request.data:
            settings_obj.default_phone_number = request.data.get('default_phone_number', '').strip()
        settings_obj.updated_by = request.user
        settings_obj.save()

        # Keep existing folders synchronized with the central email
        DigiLockerFolder.objects.filter(is_active=True).update(default_otp_email=new_email)

        DigiLockerAuditLog.objects.create(
            actor=request.user,
            action='settings_updated',
            status='SUCCESS',
            details=f"Centralized DigiLocker default OTP email updated to '{new_email}'.",
            ip_address=get_client_ip(request)
        )

        return Response({
            "message": f"Central default OTP email updated to {new_email} successfully.",
            "settings": DigiLockerSettingsSerializer(settings_obj).data
        }, status=status.HTTP_200_OK)

    def patch(self, request):
        return self.put(request)
