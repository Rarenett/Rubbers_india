const fs = require('fs');

let s = fs.readFileSync('backend/digilocker_app/serializers.py', 'utf8');

// In DigiLockerFolderSerializer fields:
s = s.replace(
  `'documents_count', 'mappings_count', 'latest_transfer', 'default_otp_email'`,
  `'documents_count', 'mappings_count', 'latest_transfer', 'default_otp_email', 'phone_number'`
);

// In DigiLockerSettingsSerializer fields:
s = s.replace(
  `fields = ['id', 'default_otp_email', 'updated_by', 'updated_by_name', 'updated_at']`,
  `fields = ['id', 'default_otp_email', 'default_phone_number', 'updated_by', 'updated_by_name', 'updated_at']`
);

fs.writeFileSync('backend/digilocker_app/serializers.py', s, 'utf8');
console.log('Updated backend/digilocker_app/serializers.py with phone number fields!');

