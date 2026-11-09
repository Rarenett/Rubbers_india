with open('backend/digilocker_app/views.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Locate DigiLockerFileApprovalViewSet reject action and append set_pending action
target_marker = '''        return Response({
            "message": f"Document '{doc.original_filename}' has been rejected.",
            "document": DigiLockerDocumentSerializer(doc, context={'request': request}).data
        }, status=status.HTTP_200_OK)'''

new_set_pending_action = '''        return Response({
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
        }, status=status.HTTP_200_OK)'''

assert target_marker in content, "target_marker not found in views.py"
content = content.replace(target_marker, new_set_pending_action, 1)

with open('backend/digilocker_app/views.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully added set_pending action to DigiLockerFileApprovalViewSet in views.py!")

