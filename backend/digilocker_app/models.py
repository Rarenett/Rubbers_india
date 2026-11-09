from django.db import models
from django.conf import settings
from django.utils import timezone
import os

class DigiLockerFolder(models.Model):
    FOLDER_TYPE_CHOICES = (
        ('shared', 'Shared / Managed'),
        ('personal', 'Personal'),
    )

    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)
    folder_type = models.CharField(max_length=20, choices=FOLDER_TYPE_CHOICES, default='shared')
    default_otp_email = models.EmailField(
        max_length=254,
        blank=True,
        null=True,
        help_text="Centrally configured default OTP email recorded at folder creation"
    )
    uses_default_otp_email = models.BooleanField(
        default=True,
        help_text="True if this folder inherits the centralized Default OTP Email dynamically"
    )
    phone_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Contact phone number associated with folder"
    )
    parent_folder = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='subfolders',
        help_text="Parent folder if this is a nested subfolder"
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='digilocker_owned_folders',
        help_text="Owner user if this is a personal folder"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='digilocker_created_folders'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'digilocker_folders'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.get_folder_type_display()})"


class DigiLockerFolderMapping(models.Model):
    folder = models.ForeignKey(
        DigiLockerFolder,
        on_delete=models.CASCADE,
        related_name='mappings'
    )
    employee = models.ForeignKey(
        'rarenett_app.Employee',
        on_delete=models.CASCADE,
        related_name='digilocker_mappings'
    )
    can_upload = models.BooleanField(default=False)
    can_view = models.BooleanField(default=True)
    view_otp_required = models.BooleanField(default=True, help_text="Require OTP verification when viewing documents")
    can_download = models.BooleanField(default=False)
    download_otp_required = models.BooleanField(default=True, help_text="Require OTP verification when downloading documents")
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='digilocker_assigned_mappings'
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'digilocker_folder_mappings'
        unique_together = ('folder', 'employee')
        ordering = ['-assigned_at']

    def __str__(self):
        return f"Folder '{self.folder.name}' -> Employee '{self.employee}'"


class DigiLockerDocument(models.Model):
    folder = models.ForeignKey(
        DigiLockerFolder,
        on_delete=models.CASCADE,
        related_name='documents'
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='digilocker_owned_documents',
        help_text="Actual employee / user owner of this document"
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='digilocker_uploaded_docs'
    )
    original_filename = models.CharField(max_length=255)
    stored_file = models.FileField(upload_to='digilocker_secure/%Y/%m/')
    file_extension = models.CharField(max_length=20)
    mime_type = models.CharField(max_length=100)
    file_size = models.BigIntegerField(help_text="File size in bytes")
    description = models.TextField(blank=True, null=True)
    checksum = models.CharField(max_length=64, blank=True, null=True)
    APPROVAL_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )
    approval_status = models.CharField(max_length=20, choices=APPROVAL_STATUS_CHOICES, default='pending')
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='digilocker_reviewed_documents'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'digilocker_documents'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.original_filename} in {self.folder.name}"

    @property
    def file_size_display(self):
        bytes_size = self.file_size
        if not bytes_size:
            return "0 B"
        for unit in ['B', 'KB', 'MB', 'GB']:
            if bytes_size < 1024.0:
                return f"{bytes_size:.1f} {unit}"
            bytes_size /= 1024.0
        return f"{bytes_size:.1f} TB"


class DigiLockerOTPChallenge(models.Model):
    OPERATION_CHOICES = (
        ('view', 'View Document'),
        ('download', 'Download Document'),
    )

    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='digilocker_otp_requests'
    )
    target_employee = models.ForeignKey(
        'rarenett_app.Employee',
        on_delete=models.CASCADE,
        related_name='digilocker_otp_challenges'
    )
    document = models.ForeignKey(
        DigiLockerDocument,
        on_delete=models.CASCADE,
        related_name='otp_challenges'
    )
    operation = models.CharField(max_length=20, choices=OPERATION_CHOICES)
    otp_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempt_count = models.PositiveIntegerField(default=0)
    max_attempts = models.PositiveIntegerField(default=5)
    is_verified = models.BooleanField(default=False)
    consumed_at = models.DateTimeField(null=True, blank=True)
    access_token = models.CharField(max_length=64, unique=True, null=True, blank=True, db_index=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'digilocker_otp_challenges'
        ordering = ['-created_at']

    def is_expired(self):
        return timezone.now() > self.expires_at

    def has_attempts_left(self):
        return self.attempt_count < self.max_attempts

    def is_valid_challenge(self):
        return not self.is_expired() and self.has_attempts_left() and self.consumed_at is None


class DigiLockerAuditLog(models.Model):
    ACTION_CHOICES = (
        ('folder_created', 'Folder Created'),
        ('folder_updated', 'Folder Updated'),
        ('folder_deleted', 'Folder Deleted'),
        ('document_uploaded', 'Document Uploaded'),
        ('document_deleted', 'Document Deleted'),
        ('mapping_created', 'Mapping Created'),
        ('mapping_updated', 'Mapping Updated'),
        ('mapping_deleted', 'Mapping Deleted'),
        ('otp_requested', 'OTP Challenge Created'),
        ('otp_verified', 'OTP Verification Success'),
        ('otp_failed', 'OTP Verification Failed'),
        ('document_viewed', 'Document Viewed'),
        ('document_downloaded', 'Document Downloaded'),
    )

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='digilocker_audit_actions'
    )
    target_employee = models.ForeignKey(
        'rarenett_app.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='digilocker_audit_targets'
    )
    folder = models.ForeignKey(
        DigiLockerFolder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    document = models.ForeignKey(
        DigiLockerDocument,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    action = models.CharField(max_length=60, choices=ACTION_CHOICES)
    status = models.CharField(max_length=20, choices=[('SUCCESS', 'Success'), ('FAILURE', 'Failure')])
    details = models.TextField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    safe_metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'digilocker_audit_logs'
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.timestamp}] {self.action} ({self.status}) by {self.actor}"


class DigiLockerApprovalHistory(models.Model):
    ACTION_TYPE_CHOICES = (
        ('initial_upload', 'Initial File Upload'),
        ('approved', 'Initial Approval'),
        ('rejected', 'Initial Rejection'),
        ('edit_requested', 'Edit Approval Request'),
        ('edit_approved', 'Edit Request Approved'),
        ('edit_rejected', 'Edit Request Rejected'),
        ('document_modified', 'Document Modified'),
        ('reapproved', 'Reapproval After Modification'),
    )

    document = models.ForeignKey(
        DigiLockerDocument,
        on_delete=models.CASCADE,
        related_name='approval_history'
    )
    action_type = models.CharField(max_length=40, choices=ACTION_TYPE_CHOICES)
    previous_status = models.CharField(max_length=30, blank=True, null=True)
    new_status = models.CharField(max_length=30, blank=True, null=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='digilocker_approval_actions'
    )
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'digilocker_approval_history'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action_type} on Doc #{self.document_id} by {self.performed_by}"


class DigiLockerEditRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('used', 'Used / Completed'),
    )

    document = models.ForeignKey(
        DigiLockerDocument,
        on_delete=models.CASCADE,
        related_name='edit_requests'
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='digilocker_edit_requests'
    )
    request_reason = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='digilocker_reviewed_edit_requests'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'digilocker_edit_requests'
        ordering = ['-created_at']

    def __str__(self):
        return f"Edit Request for Doc #{self.document_id} ({self.status}) by {self.requested_by}"


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

class DigiLockerSettings(models.Model):
    default_otp_email = models.EmailField(
        max_length=254,
        help_text="Centralized default email address for all DigiLocker OTP security verification emails."
    )
    default_phone_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Centralized default phone number for DigiLocker notifications."
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
