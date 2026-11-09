const fs = require('fs');

let s = fs.readFileSync('backend/digilocker_app/models.py', 'utf8');

// In DigiLockerFolder:
const folderTarget = `    default_otp_email = models.EmailField(
        max_length=254,
        blank=True,
        null=True,
        help_text="Centrally configured default OTP email recorded at folder creation"
    )`;

const folderReplacement = `    default_otp_email = models.EmailField(
        max_length=254,
        blank=True,
        null=True,
        help_text="Centrally configured default OTP email recorded at folder creation"
    )
    phone_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Contact phone number associated with folder"
    )`;

s = s.replace(folderTarget, folderReplacement);

// In DigiLockerSettings:
const settingsTarget = `    default_otp_email = models.EmailField(
        max_length=254,
        help_text="Centralized default email address for all DigiLocker OTP security verification emails."
    )`;

const settingsReplacement = `    default_otp_email = models.EmailField(
        max_length=254,
        help_text="Centralized default email address for all DigiLocker OTP security verification emails."
    )
    default_phone_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Centralized default phone number for DigiLocker notifications."
    )`;

s = s.replace(settingsTarget, settingsReplacement);

fs.writeFileSync('backend/digilocker_app/models.py', s, 'utf8');
console.log('Updated backend/digilocker_app/models.py with phone number fields!');

