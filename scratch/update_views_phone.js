const fs = require('fs');

let s = fs.readFileSync('backend/digilocker_app/views.py', 'utf8');

// In perform_create:
const searchCreate = `default_otp_email=validated_data.get("default_otp_email") or self.request.data.get("default_otp_email") or central_email`;
const replaceCreate = `default_otp_email=validated_data.get("default_otp_email") or self.request.data.get("default_otp_email") or central_email,
            phone_number=(validated_data.get("phone_number") or self.request.data.get("phone_number") or "").strip()`;

s = s.replace(searchCreate, replaceCreate);

// In perform_update:
const searchUpdate = `validated_email = serializer.validated_data.get('default_otp_email') or self.request.data.get('default_otp_email')
        if validated_email:
            serializer.validated_data['default_otp_email'] = validated_email.strip()`;

const replaceUpdate = `validated_email = serializer.validated_data.get('default_otp_email') or self.request.data.get('default_otp_email')
        if validated_email:
            serializer.validated_data['default_otp_email'] = validated_email.strip()
        phone = serializer.validated_data.get('phone_number') or self.request.data.get('phone_number')
        if phone is not None:
            serializer.validated_data['phone_number'] = str(phone).strip()`;

s = s.replace(searchUpdate, replaceUpdate);

// In DigiLockerSettingsView.put:
const searchSettings = `        settings_obj, _ = DigiLockerSettings.objects.get_or_create(id=1)
        settings_obj.default_otp_email = new_email
        settings_obj.updated_by = request.user
        settings_obj.save()`;

const replaceSettings = `        settings_obj, _ = DigiLockerSettings.objects.get_or_create(id=1)
        settings_obj.default_otp_email = new_email
        if 'default_phone_number' in request.data:
            settings_obj.default_phone_number = request.data.get('default_phone_number', '').strip()
        settings_obj.updated_by = request.user
        settings_obj.save()`;

s = s.replace(searchSettings, replaceSettings);

fs.writeFileSync('backend/digilocker_app/views.py', s, 'utf8');
console.log('Updated backend/digilocker_app/views.py with phone number logic!');

