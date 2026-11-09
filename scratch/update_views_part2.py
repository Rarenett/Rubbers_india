with open('backend/digilocker_app/views.py', 'r', encoding='utf-8') as f:
    text = f.read()

admin_approval_views = '''

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
        if not is_user_admin(user):
            # Only administrators can access file approval
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
        if not is_user_admin(user):
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
        if not is_user_admin(user):
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
        if is_user_admin(user):
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
        if not is_user_admin(user):
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
        if not is_user_admin(user):
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
'''

text = text + admin_approval_views

with open('backend/digilocker_app/views.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("views.py part 2 updated successfully.")

