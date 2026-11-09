const fs = require('fs');

let s = fs.readFileSync('backend/digilocker_app/models.py', 'utf8');

const folderTarget = "    folder_type = models.CharField(max_length=20, choices=FOLDER_TYPE_CHOICES, default='shared')";
const folderReplacement = `    folder_type = models.CharField(max_length=20, choices=FOLDER_TYPE_CHOICES, default='shared')
    default_otp_email = models.EmailField(
        max_length=254,
        blank=True,
        null=True,
        help_text="Centrally configured default OTP email recorded at folder creation"
    )`;

s = s.replace(folderTarget, folderReplacement);

const newModel = `
class DigiLockerSettings(models.Model):
    default_otp_email = models.EmailField(
        max_length=254,
        help_text="Centralized default email address for all DigiLocker OTP security verification emails."
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='digilocker_settings_updated'
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'digilocker_settings'
        verbose_name = 'DigiLocker Settings'
        verbose_name_plural = 'DigiLocker Settings'

    def __str__(self):
        return f"DigiLocker Default OTP Email: {self.default_otp_email}"
`;

s = s.trimEnd() + '\n' + newModel;

fs.writeFileSync('backend/digilocker_app/models.py', s, 'utf8');
console.log('Successfully updated backend/digilocker_app/models.py');

