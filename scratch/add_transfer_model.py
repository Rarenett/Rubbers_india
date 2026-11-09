with open('backend/digilocker_app/models.py', 'r', encoding='utf-8') as f:
    text = f.read()

ownership_model = """

class DigiLockerOwnershipTransferHistory(models.Model):
    folder = models.ForeignKey(
        DigiLockerFolder,
        on_delete=models.CASCADE,
        related_name='ownership_transfers'
    )
    previous_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='digilocker_previous_ownerships'
    )
    previous_owner_email = models.EmailField(blank=True, null=True)
    new_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='digilocker_acquired_ownerships'
    )
    new_owner_email = models.EmailField(blank=True, null=True)
    transferred_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='digilocker_executed_transfers'
    )
    transfer_reason = models.TextField(blank=True, null=True)
    transfer_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'digilocker_ownership_transfers'
        ordering = ['-transfer_date']

    def __str__(self):
        return f"Transfer of Folder #{self.folder_id} from {self.previous_owner} to {self.new_owner} on {self.transfer_date}"
"""

text = text + ownership_model

with open('backend/digilocker_app/models.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("DigiLockerOwnershipTransferHistory added to models.py")

