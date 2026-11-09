const fs = require('fs');

let s = fs.readFileSync('backend/digilocker_app/views.py', 'utf8');

// 1. Update imports in views.py
s = s.replace(
  'DigiLockerOwnershipTransferHistory\n)',
  'DigiLockerOwnershipTransferHistory,\n    DigiLockerSettings\n)'
);
if (!s.includes('DigiLockerSettings')) {
  s = s.replace(
    'DigiLockerOwnershipTransferHistory\r\n)',
    'DigiLockerOwnershipTransferHistory,\r\n    DigiLockerSettings\r\n)'
  );
}

s = s.replace(
  'DigiLockerOwnershipTransferHistorySerializer\n)',
  'DigiLockerOwnershipTransferHistorySerializer,\n    DigiLockerSettingsSerializer\n)'
);
if (!s.includes('DigiLockerSettingsSerializer')) {
  s = s.replace(
    'DigiLockerOwnershipTransferHistorySerializer\r\n)',
    'DigiLockerOwnershipTransferHistorySerializer,\r\n    DigiLockerSettingsSerializer\r\n)'
  );
}

// 2. Add helper get_central_default_otp_email
const helperDefinition = `
def get_central_default_otp_email():
    """
    Retrieves the centralized default OTP email address configured for DigiLocker.
    """
    settings_obj = DigiLockerSettings.objects.first()
    if settings_obj and settings_obj.default_otp_email:
        return settings_obj.default_otp_email.strip()
    return 'digilocker@rarenett.com'
`;

const insertAfterResolveDoc = `def resolve_document_owner_info(doc):
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
    return owner_user, emp, name, email`;

s = s.replace(insertAfterResolveDoc, insertAfterResolveDoc + '\n' + helperDefinition);

// 3. Update perform_create in DigiLockerFolderViewSet to enforce central default_otp_email
const oldPerformCreate = `    def perform_create(self, serializer):
        user = self.request.user
        validated_data = serializer.validated_data
        folder_type = validated_data.get('folder_type', self.request.data.get('folder_type', 'shared'))
        if folder_type not in ['shared', 'personal']:
            folder_type = 'shared'

        folder = serializer.save(
            created_by=user,
            owner=user if folder_type == 'personal' else None,
            folder_type=folder_type
        )`;

const newPerformCreate = `    def perform_create(self, serializer):
        user = self.request.user
        validated_data = serializer.validated_data
        folder_type = validated_data.get('folder_type', self.request.data.get('folder_type', 'shared'))
        if folder_type not in ['shared', 'personal']:
            folder_type = 'shared'

        central_email = get_central_default_otp_email()
        if not central_email:
            raise serializers.ValidationError({"default_otp_email": "No centralized Default OTP Email has been configured. Please configure one in DigiLocker settings before creating folders."})

        folder = serializer.save(
            created_by=user,
            owner=user if folder_type == 'personal' else None,
            folder_type=folder_type,
            default_otp_email=central_email
        )`;

s = s.replace(oldPerformCreate, newPerformCreate);

// 4. Update DigiLockerRequestOTPView recipient resolution
const oldOtpRecipientSection = `        # Determine the actual folder creator / owner (OTP must go to folder owner)
        owner_user, owner_emp, owner_name, owner_email = resolve_folder_owner_info(document.folder)

        if not owner_user:
            return Response({"error": "Document owner could not be identified."}, status=status.HTTP_400_BAD_REQUEST)

        # Direct access if requester is the owner
        if owner_user == user:
            return Response({"message": "You are the owner of this document. No OTP required.", "is_owner": True}, status=status.HTTP_200_OK)

        target_employee = owner_emp
        recipient_email = owner_email

        if not recipient_email:
            return Response({
                "error": f"The folder owner ({owner_name}) does not have a registered email address. Cannot send OTP verification code."
            }, status=status.HTTP_400_BAD_REQUEST)`;

const newOtpRecipientSection = `        # Determine the actual folder creator / owner for ownership verification
        owner_user, owner_emp, owner_name, owner_email = resolve_folder_owner_info(document.folder)

        if not owner_user:
            return Response({"error": "Document owner could not be identified."}, status=status.HTTP_400_BAD_REQUEST)

        # Direct access if requester is the owner
        if owner_user == user:
            return Response({"message": "You are the owner of this document. No OTP required.", "is_owner": True}, status=status.HTTP_200_OK)

        # Enforce Centralized Default OTP Email recipient
        central_default_email = get_central_default_otp_email()
        folder_configured_email = getattr(document.folder, 'default_otp_email', None)
        recipient_email = central_default_email or folder_configured_email

        if not recipient_email:
            return Response({
                "error": "Centralized Default OTP Email is not configured. Cannot dispatch OTP verification code."
            }, status=status.HTTP_400_BAD_REQUEST)

        target_employee = owner_emp`;

s = s.replace(oldOtpRecipientSection, newOtpRecipientSection);

// 5. Add DigiLockerSettingsView to allow getting and updating central default OTP email
const settingsView = `
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
`;

s = s.trimEnd() + '\n' + settingsView;

fs.writeFileSync('backend/digilocker_app/views.py', s, 'utf8');
console.log('Successfully updated backend/digilocker_app/views.py');

