with open('backend/digilocker_app/views.py', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update imports
old_import = """from .models import (
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
)"""

new_import = """from .models import (
    DigiLockerFolder,
    DigiLockerFolderMapping,
    DigiLockerDocument,
    DigiLockerOTPChallenge,
    DigiLockerAuditLog,
    DigiLockerApprovalHistory,
    DigiLockerEditRequest,
    DigiLockerOwnershipTransferHistory
)
from .serializers import (
    DigiLockerFolderSerializer,
    DigiLockerFolderMappingSerializer,
    DigiLockerDocumentSerializer,
    DigiLockerAuditLogSerializer,
    DigiLockerApprovalHistorySerializer,
    DigiLockerEditRequestSerializer,
    DigiLockerOwnershipTransferHistorySerializer
)"""

assert old_import in text, "old_import not found"
text = text.replace(old_import, new_import, 1)

# 2. Add transfer_ownership and ownership_history actions to DigiLockerFolderViewSet
target_action_anchor = """        return Response({"message": f"Folder '{folder.name}' successfully deleted."}, status=status.HTTP_200_OK)"""

new_actions = """        return Response({"message": f"Folder '{folder.name}' successfully deleted."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='transfer-ownership')
    def transfer_ownership(self, request, pk=None):
        \"\"\"
        Transfer folder ownership to an active employee.
        Ensures all future OTP requests for this folder dynamically route to the new owner.
        Preserves original document uploaders, audit logs, and existing mappings.
        \"\"\"
        user = request.user
        if not has_mapping_permission(user):
            return Response({"error": "Only authorized administrators can transfer folder ownership."}, status=status.HTTP_403_FORBIDDEN)

        folder = self.get_object()
        new_employee_id = request.data.get('new_employee') or request.data.get('new_employee_id')
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
        \"\"\"
        Returns immutable audit history of ownership transfers for this folder.
        \"\"\"
        folder = self.get_object()
        history = folder.ownership_transfers.all().order_by('-transfer_date')
        return Response(DigiLockerOwnershipTransferHistorySerializer(history, many=True).data)

    @action(detail=False, methods=['get'], url_path='ownership-transfers')
    def all_ownership_transfers(self, request):
        \"\"\"
        Returns global history of all folder ownership transfers.
        \"\"\"
        history = DigiLockerOwnershipTransferHistory.objects.all().order_by('-transfer_date')
        return Response(DigiLockerOwnershipTransferHistorySerializer(history, many=True).data)"""

assert target_action_anchor in text, "target_action_anchor not found"
text = text.replace(target_action_anchor, new_actions, 1)

with open('backend/digilocker_app/views.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("views.py updated with folder transfer actions.")

