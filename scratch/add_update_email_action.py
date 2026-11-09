with open('backend/digilocker_app/views.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = """    @action(detail=False, methods=['get'], url_path='ownership-transfers')
    def all_ownership_transfers(self, request):
        \"\"\"
        Returns global history of all folder ownership transfers.
        \"\"\"
        history = DigiLockerOwnershipTransferHistory.objects.all().order_by('-transfer_date')
        return Response(DigiLockerOwnershipTransferHistorySerializer(history, many=True).data)"""

new_action = """    @action(detail=False, methods=['get'], url_path='ownership-transfers')
    def all_ownership_transfers(self, request):
        \"\"\"
        Returns global history of all folder ownership transfers.
        \"\"\"
        history = DigiLockerOwnershipTransferHistory.objects.all().order_by('-transfer_date')
        return Response(DigiLockerOwnershipTransferHistorySerializer(history, many=True).data)

    @action(detail=True, methods=['post', 'patch'], url_path='update-otp-email')
    def update_otp_email(self, request, pk=None):
        \"\"\"
        Update the configured OTP recipient email for a specific folder from Ownership Transfer.
        Restricted to authorized administrators.
        \"\"\"
        user = request.user
        if not (is_user_admin(user) or has_mapping_permission(user)):
            return Response({"error": "Only authorized administrators can edit the folder OTP email."}, status=status.HTTP_403_FORBIDDEN)

        folder = self.get_object()
        new_email = (request.data.get('default_otp_email') or request.data.get('email') or '').strip()

        if not new_email:
            return Response({"error": "Email address cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        import re
        email_pattern = r'^[^@\s]+@[^@\s]+\.[^@\s]+$'
        if not re.match(email_pattern, new_email):
            return Response({"error": "Please provide a valid email address format (e.g. name@company.com)."}, status=status.HTTP_400_BAD_REQUEST)

        old_email = folder.default_otp_email or 'None'
        folder.default_otp_email = new_email
        folder.save(update_fields=['default_otp_email'])

        DigiLockerAuditLog.objects.create(
            actor=user,
            folder=folder,
            action='folder_updated',
            status='SUCCESS',
            details=f"Updated OTP recipient email for folder '{folder.name}' from '{old_email}' to '{new_email}'.",
            ip_address=get_client_ip(request)
        )

        return Response({
            "message": f"OTP email for folder '{folder.name}' updated successfully to '{new_email}'.",
            "folder": DigiLockerFolderSerializer(folder, context={'request': request}).data
        }, status=status.HTTP_200_OK)"""

if '\r\n' in text:
    target = target.replace('\n', '\r\n')
    new_action = new_action.replace('\n', '\r\n')

assert target in text, "target not found"
text = text.replace(target, new_action, 1)

with open('backend/digilocker_app/views.py', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Added update_otp_email action to DigiLockerFolderViewSet successfully.")

