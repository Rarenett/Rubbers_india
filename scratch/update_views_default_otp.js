const fs = require('fs');

let s = fs.readFileSync('backend/digilocker_app/views.py', 'utf8');

// Normalize to LF
let sNorm = s.replace(/\r\n/g, '\n');

// 1. Add get_central_default_otp_email helper
const helper = `
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
`;

const targetAfterResolve = `    email = owner_user.email or (emp.email if emp else "")
    return owner_user, emp, name, email


class DigiLockerFolderViewSet`;

if (!sNorm.includes('def get_central_default_otp_email():')) {
  sNorm = sNorm.replace(
    targetAfterResolve,
    `    email = owner_user.email or (emp.email if emp else "")\n    return owner_user, emp, name, email\n` + helper + `\nclass DigiLockerFolderViewSet`
  );
}

// 2. In DigiLockerRequestOTPView, change recipient_email resolution to ALWAYS use Default OTP Email
const oldRecipientResolution = `        # Determine the actual folder creator / owner (OTP must go to folder owner)
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

const newRecipientResolution = `        # Determine the actual folder creator / owner for permissions & notification
        owner_user, owner_emp, owner_name, owner_email = resolve_folder_owner_info(document.folder)

        if not owner_user:
            return Response({"error": "Document owner could not be identified."}, status=status.HTTP_400_BAD_REQUEST)

        # Direct access if requester is the owner
        if owner_user == user:
            return Response({"message": "You are the owner of this document. No OTP required.", "is_owner": True}, status=status.HTTP_200_OK)

        # ALWAYS send OTP to the configured Default OTP Email, NEVER to employee personal email
        folder_default_email = getattr(document.folder, 'default_otp_email', None)
        central_default_email = get_central_default_otp_email()
        recipient_email = (folder_default_email or central_default_email or 'digilocker@rarenett.com').strip()

        target_employee = owner_emp

        if not recipient_email:
            return Response({
                "error": "No default OTP email address has been configured. Cannot send OTP verification code."
            }, status=status.HTTP_400_BAD_REQUEST)`;

if (!sNorm.includes(oldRecipientResolution)) {
  console.error("oldRecipientResolution not found in normalized text!");
  process.exit(1);
}

sNorm = sNorm.replace(oldRecipientResolution, newRecipientResolution);

// Convert back to CRLF
const sFinal = sNorm.replace(/\n/g, '\r\n');
fs.writeFileSync('backend/digilocker_app/views.py', sFinal, 'utf8');
console.log('Successfully updated backend/digilocker_app/views.py so OTP goes to default email!');

