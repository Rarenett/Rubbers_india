const fs = require('fs');

let s = fs.readFileSync('backend/digilocker_app/views.py', 'utf8');

// In perform_create:
const searchCreate = 'default_otp_email=central_email';
const replaceCreate = 'default_otp_email=validated_data.get("default_otp_email") or self.request.data.get("default_otp_email") or central_email';
s = s.replace(searchCreate, replaceCreate);

// In perform_update:
const searchUpdate = 'if not is_user_admin(user) and folder.owner != user:\n            raise permissions.PermissionDenied("You do not have permission to edit this folder.")';
const searchUpdateCRLF = 'if not is_user_admin(user) and folder.owner != user:\r\n            raise permissions.PermissionDenied("You do not have permission to edit this folder.")';

const addition = `
        validated_email = serializer.validated_data.get('default_otp_email') or self.request.data.get('default_otp_email')
        if validated_email:
            serializer.validated_data['default_otp_email'] = validated_email.strip()`;

if (s.includes(searchUpdateCRLF)) {
  s = s.replace(searchUpdateCRLF, searchUpdateCRLF + addition.replace(/\n/g, '\r\n'));
} else if (s.includes(searchUpdate)) {
  s = s.replace(searchUpdate, searchUpdate + addition);
}

fs.writeFileSync('backend/digilocker_app/views.py', s, 'utf8');
console.log('Updated backend/digilocker_app/views.py successfully');

