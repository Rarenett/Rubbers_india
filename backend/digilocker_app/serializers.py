from rest_framework import serializers
from .models import (
    DigiLockerFolder,
    DigiLockerFolderMapping,
    DigiLockerDocument,
    DigiLockerOTPChallenge,
    DigiLockerAuditLog,
    DigiLockerApprovalHistory,
    DigiLockerEditRequest,
    DigiLockerOwnershipTransferHistory,
    DigiLockerSettings
)
from rarenett_app.models import Employee

class DigiLockerFolderSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()
    documents_count = serializers.SerializerMethodField()
    mappings_count = serializers.SerializerMethodField()
    parent_folder_name = serializers.CharField(source='parent_folder.name', read_only=True)
    subfolders_count = serializers.SerializerMethodField()
    folder_path = serializers.SerializerMethodField()

    class Meta:
        model = DigiLockerFolder
        fields = [
            'id', 'name', 'description', 'folder_type',
            'parent_folder', 'parent_folder_name', 'subfolders_count', 'folder_path',
            'owner', 'owner_name', 'owner_email', 'current_owner_name', 'current_owner_email',
            'created_by', 'created_by_name',
            'is_active', 'created_at', 'updated_at',
            'documents_count', 'mappings_count', 'latest_transfer', 'default_otp_email', 'uses_default_otp_email', 'phone_number'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_folder_path(self, obj):
        parts = [obj.name]
        curr = obj.parent_folder
        visited = set([obj.pk])
        while curr and curr.pk not in visited:
            parts.append(curr.name)
            visited.add(curr.pk)
            curr = curr.parent_folder
        return ' / '.join(reversed(parts))

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return '-'

    owner_email = serializers.SerializerMethodField()
    current_owner_name = serializers.SerializerMethodField()
    current_owner_email = serializers.SerializerMethodField()
    latest_transfer = serializers.SerializerMethodField()

    def get_owner_name(self, obj):
        from .views import resolve_folder_owner_info
        _, _, name, _ = resolve_folder_owner_info(obj)
        return name

    def get_owner_email(self, obj):
        from .views import resolve_folder_owner_info
        _, _, _, email = resolve_folder_owner_info(obj)
        return email

    def get_current_owner_name(self, obj):
        return self.get_owner_name(obj)

    def get_current_owner_email(self, obj):
        # If uses_default_otp_email is True, always resolve dynamically from central default
        from .views import get_central_default_otp_email
        central = get_central_default_otp_email()
        if getattr(obj, 'uses_default_otp_email', True):
            if central and central.strip():
                return central.strip()
            if obj.default_otp_email and obj.default_otp_email.strip():
                return obj.default_otp_email.strip()
            return 'digilocker@rarenett.com'

        # If custom (uses_default_otp_email is False), use the individually saved folder OTP email
        if obj.default_otp_email and obj.default_otp_email.strip():
            return obj.default_otp_email.strip()
        if central and central.strip():
            return central.strip()
        return self.get_owner_email(obj)

    def get_latest_transfer(self, obj):
        latest = obj.ownership_transfers.order_by('-transfer_date').first()
        if not latest:
            return None
        return {
            'id': latest.id,
            'previous_owner_name': (latest.previous_owner.get_full_name() or latest.previous_owner.username) if latest.previous_owner else '-',
            'previous_owner_email': latest.previous_owner_email,
            'new_owner_name': (latest.new_owner.get_full_name() or latest.new_owner.username) if latest.new_owner else '-',
            'new_owner_email': latest.new_owner_email,
            'transferred_by_name': (latest.transferred_by.get_full_name() or latest.transferred_by.username) if latest.transferred_by else 'Admin',
            'transfer_reason': latest.transfer_reason,
            'transfer_date': latest.transfer_date,
        }

    def get_documents_count(self, obj):
        return obj.documents.filter(is_active=True).count()

    def get_mappings_count(self, obj):
        return obj.mappings.filter(is_active=True).count()

    def get_subfolders_count(self, obj):
        return obj.subfolders.filter(is_active=True).count()

    def validate_name(self, value):
        trimmed = value.strip()
        if not trimmed:
            raise serializers.ValidationError("Folder name cannot be empty.")
        return trimmed

    def validate(self, attrs):
        name = attrs.get('name', getattr(self.instance, 'name', '')).strip()
        folder_type = attrs.get('folder_type', getattr(self.instance, 'folder_type', 'shared'))
        parent_folder = attrs.get('parent_folder', getattr(self.instance, 'parent_folder', None))
        owner = attrs.get('owner', getattr(self.instance, 'owner', None))
        request = self.context.get('request')
        user = request.user if request else None

        # Check circular dependency or self-parenting
        if self.instance and parent_folder:
            if parent_folder.pk == self.instance.pk:
                raise serializers.ValidationError({"parent_folder": "A folder cannot be its own parent."})
            # Prevent circular hierarchy (parent cannot be any descendant)
            curr = parent_folder
            visited = set()
            while curr:
                if curr.pk == self.instance.pk:
                    raise serializers.ValidationError({"parent_folder": "Circular folder relationship detected. A folder cannot be moved inside its own subfolder."})
                if curr.pk in visited:
                    break
                visited.add(curr.pk)
                curr = curr.parent_folder

        # Validate that only supported folder types are accepted
        if folder_type not in ['shared', 'personal']:
            raise serializers.ValidationError({'folder_type': "Invalid folder type. Must be 'shared' or 'personal'."})

        # When creating or validating a personal folder, associate the owner
        if folder_type == 'personal' and not owner:
            attrs['owner'] = user

        # Check for duplicate folder name
        # A folder cannot have the same name as an existing folder (regardless of parent level or casing)
        dup_qs = DigiLockerFolder.objects.filter(
            name__iexact=name,
            is_active=True
        )
        if self.instance:
            dup_qs = dup_qs.exclude(pk=self.instance.pk)

        if dup_qs.exists():
            existing_f = dup_qs.first()
            p_desc = f"under '{existing_f.parent_folder.name}'" if existing_f.parent_folder else "at root level"
            raise serializers.ValidationError({
                "name": f"A folder with the name '{name}' already exists ({p_desc}). Duplicate folder names are not allowed."
            })

        attrs['name'] = name
        return attrs


class DigiLockerFolderMappingSerializer(serializers.ModelSerializer):
    folder_name = serializers.CharField(source='folder.name', read_only=True)
    employee_name = serializers.SerializerMethodField()
    employee_code = serializers.SerializerMethodField()
    assigned_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DigiLockerFolderMapping
        fields = [
            'id', 'folder', 'folder_name', 'employee',
            'employee_name', 'employee_code',
            'can_upload', 'can_view', 'view_otp_required', 'can_download', 'download_otp_required',
            'assigned_by', 'assigned_by_name',
            'assigned_at', 'is_active'
        ]
        read_only_fields = ['id', 'assigned_by', 'assigned_at']

    def get_employee_name(self, obj):
        if not obj.employee:
            return '-'
        if obj.employee.user:
            return obj.employee.user.get_full_name() or obj.employee.user.username
        if obj.employee.candidate:
            return obj.employee.candidate.full_name
        return f"Employee #{obj.employee.id}"

    def get_employee_code(self, obj):
        if not obj.employee:
            return '-'
        return f"EMP-{obj.employee.id:04d}"

    def get_assigned_by_name(self, obj):
        if obj.assigned_by:
            return obj.assigned_by.get_full_name() or obj.assigned_by.username
        return '-'


class DigiLockerDocumentSerializer(serializers.ModelSerializer):
    folder_name = serializers.CharField(source='folder.name', read_only=True)
    uploaded_by_name = serializers.SerializerMethodField()
    employee_name = serializers.SerializerMethodField()
    employee_id = serializers.SerializerMethodField()
    file_size_display = serializers.CharField(read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()
    latest_edit_request = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = DigiLockerDocument
        fields = [
            'id', 'folder', 'folder_name', 'uploaded_by', 'uploaded_by_name',
            'employee_name', 'employee_id',
            'original_filename', 'file_extension', 'mime_type',
            'file_size', 'file_size_display', 'description',
            'approval_status', 'reviewed_by', 'reviewed_by_name',
            'reviewed_at', 'rejection_reason',
            'latest_edit_request', 'can_edit',
            'is_active', 'uploaded_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'uploaded_by', 'file_extension',
            'mime_type', 'file_size', 'approval_status',
            'reviewed_by', 'reviewed_at', 'rejection_reason',
            'uploaded_at', 'updated_at'
        ]

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return '-'

    def get_employee_name(self, obj):
        uploader = obj.uploaded_by or obj.owner
        if not uploader:
            return '-'
        try:
            emp = getattr(uploader, 'employee', None)
            if not emp:
                emp = Employee.objects.filter(user=uploader).select_related('candidate').first()
            if emp and emp.candidate and emp.candidate.full_name:
                return emp.candidate.full_name
        except Exception:
            pass
        return uploader.get_full_name() or uploader.username

    def get_employee_id(self, obj):
        uploader = obj.uploaded_by or obj.owner
        if not uploader:
            return '-'
        try:
            emp = getattr(uploader, 'employee', None)
            if not emp:
                emp = Employee.objects.filter(user=uploader).first()
            if emp:
                return f"EMP-{emp.id:04d}"
        except Exception:
            pass
        return f"USR-{uploader.id}"

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return '-'

    def get_latest_edit_request(self, obj):
        latest = obj.edit_requests.order_by('-created_at').first()
        if not latest:
            return None
        return {
            'id': latest.id,
            'status': latest.status,
            'request_reason': latest.request_reason,
            'rejection_reason': latest.rejection_reason,
            'created_at': latest.created_at,
            'reviewed_at': latest.reviewed_at,
        }

    def get_can_edit(self, obj):
        request = self.context.get('request')
        user = request.user if request and request.user.is_authenticated else None
        if not user:
            return False

        # Admin check
        from .views import is_user_admin
        if is_user_admin(user):
            return True

        # Only the document uploader can edit
        if obj.uploaded_by != user:
            return False

        # If document is not approved yet (e.g. pending or rejected), allow editing/resubmission
        if obj.approval_status in ['pending', 'rejected']:
            return True

        # If approved, only allow editing if there is an active 'approved' edit request
        has_approved_request = obj.edit_requests.filter(
            requested_by=user,
            status='approved'
        ).exists()
        return has_approved_request


class DigiLockerApprovalHistorySerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()
    document_name = serializers.CharField(source='document.original_filename', read_only=True)
    action_type_display = serializers.CharField(source='get_action_type_display', read_only=True)

    class Meta:
        model = DigiLockerApprovalHistory
        fields = [
            'id', 'document', 'document_name', 'action_type',
            'action_type_display', 'previous_status', 'new_status',
            'performed_by', 'performed_by_name', 'remarks', 'created_at'
        ]

    def get_performed_by_name(self, obj):
        if obj.performed_by:
            return obj.performed_by.get_full_name() or obj.performed_by.username
        return 'System'


class DigiLockerEditRequestSerializer(serializers.ModelSerializer):
    document_name = serializers.CharField(source='document.original_filename', read_only=True)
    document_id = serializers.IntegerField(source='document.id', read_only=True)
    folder_name = serializers.CharField(source='document.folder.name', read_only=True)
    file_extension = serializers.CharField(source='document.file_extension', read_only=True)
    file_size_display = serializers.CharField(source='document.file_size_display', read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    employee_name = serializers.SerializerMethodField()
    employee_id = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = DigiLockerEditRequest
        fields = [
            'id', 'document', 'document_id', 'document_name', 'folder_name',
            'file_extension', 'file_size_display',
            'requested_by', 'requested_by_name', 'employee_name', 'employee_id',
            'request_reason', 'status', 'status_display',
            'reviewed_by', 'reviewed_by_name', 'reviewed_at',
            'rejection_reason', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'document_id', 'requested_by', 'status',
            'reviewed_by', 'reviewed_at', 'created_at', 'updated_at'
        ]

    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return obj.requested_by.get_full_name() or obj.requested_by.username
        return '-'

    def get_employee_name(self, obj):
        user = obj.requested_by
        if not user:
            return '-'
        try:
            emp = getattr(user, 'employee', None)
            if not emp:
                emp = Employee.objects.filter(user=user).select_related('candidate').first()
            if emp and emp.candidate and emp.candidate.full_name:
                return emp.candidate.full_name
        except Exception:
            pass
        return user.get_full_name() or user.username

    def get_employee_id(self, obj):
        user = obj.requested_by
        if not user:
            return '-'
        try:
            emp = getattr(user, 'employee', None)
            if not emp:
                emp = Employee.objects.filter(user=user).first()
            if emp:
                return f"EMP-{emp.id:04d}"
        except Exception:
            pass
        return f"USR-{user.id}"

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return '-'


class DigiLockerAuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    actor_designation = serializers.SerializerMethodField()
    target_employee_name = serializers.SerializerMethodField()
    target_employee_code = serializers.SerializerMethodField()
    target_employee_designation = serializers.SerializerMethodField()
    folder_name = serializers.CharField(source='folder.name', read_only=True)
    document_name = serializers.CharField(source='document.original_filename', read_only=True)

    class Meta:
        model = DigiLockerAuditLog
        fields = [
            'id', 'actor', 'actor_name', 'actor_designation',
            'target_employee', 'target_employee_name', 'target_employee_code', 'target_employee_designation',
            'folder', 'folder_name', 'document', 'document_name',
            'action', 'status', 'details', 'ip_address',
            'timestamp', 'safe_metadata'
        ]

    def get_actor_name(self, obj):
        if not obj.actor:
            return 'System'
        try:
            emp = getattr(obj.actor, 'employee', None)
            if not emp:
                emp = Employee.objects.filter(user=obj.actor).select_related('candidate').first()
            if emp and emp.candidate and emp.candidate.full_name:
                return emp.candidate.full_name
        except Exception:
            pass
        return obj.actor.get_full_name() or obj.actor.username

    def get_actor_designation(self, obj):
        if not obj.actor:
            return ''
        try:
            emp = getattr(obj.actor, 'employee', None)
            if not emp:
                emp = Employee.objects.filter(user=obj.actor).select_related('dept_designation__designation', 'candidate').first()
            if emp:
                if emp.dept_designation and emp.dept_designation.designation:
                    return getattr(emp.dept_designation.designation, 'name', None) or str(emp.dept_designation.designation)
                if emp.candidate and getattr(emp.candidate, 'designation', None):
                    return str(emp.candidate.designation)
            if hasattr(obj.actor, 'role') and obj.actor.role and getattr(obj.actor.role, 'name', None):
                return obj.actor.role.name
            if getattr(obj.actor, 'is_superuser', False):
                return 'Administrator'
        except Exception:
            pass
        return ''

    def get_target_employee_name(self, obj):
        if obj.target_employee:
            if obj.target_employee.candidate and obj.target_employee.candidate.full_name:
                return obj.target_employee.candidate.full_name
            if obj.target_employee.user:
                return obj.target_employee.user.get_full_name() or obj.target_employee.user.username
            return f"Employee #{obj.target_employee.id}"

        # If target_employee is not directly on the log, check document owner or folder owner or folder mappings
        if obj.document and (obj.document.owner or obj.document.uploaded_by):
            doc_owner = obj.document.owner or obj.document.uploaded_by
            emp = Employee.objects.filter(user=doc_owner).select_related('candidate').first()
            if emp and emp.candidate and emp.candidate.full_name:
                return emp.candidate.full_name
            return doc_owner.get_full_name() or doc_owner.username

        if obj.folder and obj.folder.folder_type == 'personal' and obj.folder.owner:
            owner_user = obj.folder.owner
            emp = Employee.objects.filter(user=owner_user).select_related('candidate').first()
            if emp and emp.candidate and emp.candidate.full_name:
                return emp.candidate.full_name
            return owner_user.get_full_name() or owner_user.username

        if obj.folder:
            first_mapping = obj.folder.mappings.filter(is_active=True).select_related('employee__candidate').first()
            if first_mapping and first_mapping.employee:
                if first_mapping.employee.candidate and first_mapping.employee.candidate.full_name:
                    return first_mapping.employee.candidate.full_name
                return str(first_mapping.employee)

        return '-'

    def get_target_employee_designation(self, obj):
        try:
            emp = obj.target_employee
            if not emp and obj.document and (obj.document.owner or obj.document.uploaded_by):
                doc_owner = obj.document.owner or obj.document.uploaded_by
                emp = Employee.objects.filter(user=doc_owner).select_related('dept_designation__designation', 'candidate').first()
            if not emp and obj.folder and obj.folder.owner:
                emp = Employee.objects.filter(user=obj.folder.owner).select_related('dept_designation__designation', 'candidate').first()
            if emp:
                if emp.dept_designation and emp.dept_designation.designation:
                    return getattr(emp.dept_designation.designation, 'name', None) or str(emp.dept_designation.designation)
                if emp.candidate and getattr(emp.candidate, 'designation', None):
                    return str(emp.candidate.designation)
        except Exception:
            pass
        return ''

    def get_target_employee_code(self, obj):
        if not obj.target_employee:
            return '-'
        return f"EMP-{obj.target_employee.id:04d}"


class DigiLockerOwnershipTransferHistorySerializer(serializers.ModelSerializer):
    folder_name = serializers.CharField(source='folder.name', read_only=True)
    previous_owner_name = serializers.SerializerMethodField()
    new_owner_name = serializers.SerializerMethodField()
    transferred_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DigiLockerOwnershipTransferHistory
        fields = [
            'id', 'folder', 'folder_name',
            'previous_owner', 'previous_owner_name', 'previous_owner_email',
            'new_owner', 'new_owner_name', 'new_owner_email',
            'transferred_by', 'transferred_by_name',
            'transfer_reason', 'transfer_date'
        ]

    def get_previous_owner_name(self, obj):
        if obj.previous_owner:
            return obj.previous_owner.get_full_name() or obj.previous_owner.username
        return '-'

    def get_new_owner_name(self, obj):
        if obj.new_owner:
            return obj.new_owner.get_full_name() or obj.new_owner.username
        return '-'

    def get_transferred_by_name(self, obj):
        if obj.transferred_by:
            return obj.transferred_by.get_full_name() or obj.transferred_by.username
        return 'Admin'

class DigiLockerSettingsSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DigiLockerSettings
        fields = ['id', 'default_otp_email', 'default_phone_number', 'updated_by', 'updated_by_name', 'updated_at']
        read_only_fields = ['id', 'updated_by', 'updated_at']

    def get_updated_by_name(self, obj):
        if obj.updated_by:
            return obj.updated_by.get_full_name() or obj.updated_by.username
        return '-'
