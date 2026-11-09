with open('backend/digilocker_app/models.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = """    default_otp_email = models.EmailField(
        max_length=254,
        blank=True,
        null=True,
        help_text="Centrally configured default OTP email recorded at folder creation"
    )"""

replacement = """    default_otp_email = models.EmailField(
        max_length=254,
        blank=True,
        null=True,
        help_text="Centrally configured default OTP email recorded at folder creation"
    )
    uses_default_otp_email = models.BooleanField(
        default=True,
        help_text="True if this folder inherits the centralized Default OTP Email dynamically"
    )"""

if '\r\n' in text:
    target = target.replace('\n', '\r\n')
    replacement = replacement.replace('\n', '\r\n')

assert target in text, "target not found"
text = text.replace(target, replacement, 1)

with open('backend/digilocker_app/models.py', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Updated DigiLockerFolder in models.py with uses_default_otp_email.")

