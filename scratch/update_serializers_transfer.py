with open('backend/digilocker_app/serializers.py', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update imports
old_import = """from .models import (
    DigiLockerFolder,
    DigiLockerFolderMapping,
    DigiLockerDocument,
    DigiLockerOTPChallenge,
    DigiLockerAuditLog,
    DigiLockerApprovalHistory,
    DigiLockerEditRequest
)"""

new_import = """from .models import (
    DigiLockerFolder,
    DigiLockerFolderMapping,
    DigiLockerDocument,
    DigiLockerOTPChallenge,
    DigiLockerAuditLog,
    DigiLockerApprovalHistory,
    DigiLockerEditRequest,
    DigiLockerOwnershipTransferHistory
)"""

assert old_import in text, "old_import not found"
text = text.replace(old_import, new_import, 1)

# 2. Update DigiLockerFolderSerializer to include owner_email, current_owner_name, current_owner_email, latest_transfer
old_folder_fields = """        fields = [
            'id', 'name', 'description', 'folder_type',
            'parent_folder', 'parent_folder_name', 'subfolders_count', 'folder_path',
            'owner', 'owner_name', 'created_by', 'created_by_name',
            'is_active', 'created_at', 'updated_at',
            'documents_count', 'mappings_count'
        ]"""

new_folder_fields = """        fields = [
            'id', 'name', 'description', 'folder_type',
            'parent_folder', 'parent_folder_name', 'subfolders_count', 'folder_path',
            'owner', 'owner_name', 'owner_email', 'current_owner_name', 'current_owner_email',
            'created_by', 'created_by_name',
            'is_active', 'created_at', 'updated_at',
            'documents_count', 'mappings_count', 'latest_transfer'
        ]"""

assert old_folder_fields in text, "old_folder_fields not found"
text = text.replace(old_folder_fields, new_folder_fields, 1)

# Add owner_email and latest_transfer fields to DigiLockerFolderSerializer
old_owner_method = """    def get_owner_name(self, obj):
        if obj.owner:
            return obj.owner.get_full_name() or obj.owner.username
        return '-'"""

new_owner_method = """    owner_email = serializers.SerializerMethodField()
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
        }"""

assert old_owner_method in text, "old_owner_method not found"
text = text.replace(old_owner_method, new_owner_method, 1)

# 3. Add DigiLockerOwnershipTransferHistorySerializer at the end
history_serializer = """

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
"""

text = text + history_serializer

with open('backend/digilocker_app/serializers.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("serializers.py updated with ownership transfer fields and serializer.")

