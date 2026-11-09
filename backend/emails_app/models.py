from django.db import models
from django.conf import settings

class Email(models.Model):
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_emails')
    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Sender's copy status
    sender_deleted = models.BooleanField(default=False)
    sender_archived = models.BooleanField(default=False)
    sender_starred = models.BooleanField(default=False)
    
    recipients = models.ManyToManyField(settings.AUTH_USER_MODEL, through='EmailRecipient', related_name='received_emails')

    def __str__(self):
        return f"From {self.sender} - {self.subject}"

class EmailRecipient(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    email = models.ForeignKey(Email, on_delete=models.CASCADE)
    
    # Status for this recipient
    is_read = models.BooleanField(default=False)
    is_starred = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False) # In Trash
    is_archived = models.BooleanField(default=False) # In Archive
    
    recipient_type = models.CharField(max_length=10, choices=[('to', 'To'), ('cc', 'Cc'), ('bcc', 'Bcc')], default='to')

    class Meta:
        unique_together = ('user', 'email')

class Attachment(models.Model):
    email = models.ForeignKey(Email, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='email_attachments/')
    uploaded_at = models.DateTimeField(auto_now_add=True)



