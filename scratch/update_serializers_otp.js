const fs = require('fs');

let s = fs.readFileSync('backend/digilocker_app/serializers.py', 'utf8');

// 1. Add DigiLockerSettings to imports from .models
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

// 2. Add default_otp_email to DigiLockerFolderSerializer fields
const oldFields = `'documents_count', 'mappings_count', 'latest_transfer'`;
const newFields = `'documents_count', 'mappings_count', 'latest_transfer', 'default_otp_email'`;

s = s.replace(oldFields, newFields);

// 3. Add DigiLockerSettingsSerializer at the end
const newSerializer = `
class DigiLockerSettingsSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DigiLockerSettings
        fields = ['id', 'default_otp_email', 'updated_by', 'updated_by_name', 'updated_at']
        read_only_fields = ['id', 'updated_by', 'updated_at']

    def get_updated_by_name(self, obj):
        if obj.updated_by:
            return obj.updated_by.get_full_name() or obj.updated_by.username
        return '-'
`;

s = s.trimEnd() + '\n' + newSerializer;

fs.writeFileSync('backend/digilocker_app/serializers.py', s, 'utf8');
console.log('Updated backend/digilocker_app/serializers.py successfully');

