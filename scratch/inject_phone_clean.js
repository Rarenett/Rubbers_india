const fs = require('fs');

let s = fs.readFileSync('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', 'utf8');

// Normalize CRLF to LF
let sNorm = s.replace(/\r\n/g, '\n');

// 1. Ensure phone_number is present in formData default state
if (!sNorm.includes('phone_number: "",')) {
  sNorm = sNorm.replace(
    'is_active: true,\n  });',
    'is_active: true,\n    default_otp_email: "",\n    phone_number: "",\n  });'
  );
}

// 2. Ensure defaultPhoneNumber state exists
if (!sNorm.includes('const [defaultPhoneNumber, setDefaultPhoneNumber]')) {
  sNorm = sNorm.replace(
    'const [defaultOtpEmail, setDefaultOtpEmail] = useState("");',
    'const [defaultOtpEmail, setDefaultOtpEmail] = useState("");\n  const [defaultPhoneNumber, setDefaultPhoneNumber] = useState("");'
  );
}

// 3. Ensure editingDefaultPhone state exists
if (!sNorm.includes('const [editingDefaultPhone, setEditingDefaultPhone]')) {
  sNorm = sNorm.replace(
    'const [editingDefaultEmail, setEditingDefaultEmail] = useState(\'\');',
    'const [editingDefaultEmail, setEditingDefaultEmail] = useState(\'\');\n  const [editingDefaultPhone, setEditingDefaultPhone] = useState(\'\');'
  );
}

// 4. Update fetchDigiLockerSettings to load default_phone_number
if (!sNorm.includes('setDefaultPhoneNumber(res.data.default_phone_number)')) {
  sNorm = sNorm.replace(
    'if (res.data && res.data.default_otp_email) {\n        setDefaultOtpEmail(res.data.default_otp_email);\n      }',
    'if (res.data) {\n        if (res.data.default_otp_email) setDefaultOtpEmail(res.data.default_otp_email);\n        if (res.data.default_phone_number) setDefaultPhoneNumber(res.data.default_phone_number);\n      }'
  );
}

// 5. Update handleOpenSettingsModal
if (!sNorm.includes('setEditingDefaultPhone(defaultPhoneNumber')) {
  sNorm = sNorm.replace(
    'setEditingDefaultEmail(defaultOtpEmail || \'digilocker@rarenett.com\');',
    'setEditingDefaultEmail(defaultOtpEmail || \'digilocker@rarenett.com\');\n    setEditingDefaultPhone(defaultPhoneNumber || \'\');'
  );
}

// 6. Update handleSaveSettings payload
if (!sNorm.includes('default_phone_number: editingDefaultPhone')) {
  sNorm = sNorm.replace(
    'await DigiLockerService.updateSettings({ default_otp_email: emailToSave });',
    'await DigiLockerService.updateSettings({ default_otp_email: emailToSave, default_phone_number: editingDefaultPhone.trim() });'
  );
}

// 7. In handleSubmit payload, add phone_number
if (!sNorm.includes('phone_number: (formData.phone_number || "").trim()')) {
  sNorm = sNorm.replace(
    'default_otp_email: (formData.default_otp_email || defaultOtpEmail || "digilocker@rarenett.com").trim(),\n    };',
    'default_otp_email: (formData.default_otp_email || defaultOtpEmail || "digilocker@rarenett.com").trim(),\n      phone_number: (formData.phone_number || "").trim(),\n    };'
  );
}

// 8. Insert the Phone Number Form.Group in Create/Edit Folder Modal right below Default OTP Email
const oldOtpEmailGroup = `              <Form.Text className="text-muted" style={{ fontSize: "11px" }}>
                All DigiLocker OTP verification emails for documents in this folder will be delivered to this email.
              </Form.Text>
            </Form.Group>`;

const newOtpEmailAndPhoneGroup = `              <Form.Text className="text-muted" style={{ fontSize: "11px" }}>
                All DigiLocker OTP verification emails for documents in this folder will be delivered to this email.
              </Form.Text>
            </Form.Group>

            {/* Phone Number Field (NEW) */}
            <Form.Group className="mb-3">
              <Form.Label>
                Phone Number <span className="text-muted">(Optional)</span>
              </Form.Label>
              <Form.Control
                type="tel"
                placeholder="e.g. +91 9876543210"
                value={formData.phone_number || ""}
                onChange={(e) =>
                  setFormData({ ...formData, phone_number: e.target.value })
                }
              />
              <Form.Text className="text-muted" style={{ fontSize: "11px" }}>
                Contact or notification phone number associated with this folder.
              </Form.Text>
            </Form.Group>`;

if (!sNorm.includes(oldOtpEmailGroup)) {
  console.error('oldOtpEmailGroup not found in normalized text!');
  process.exit(1);
}

sNorm = sNorm.replace(oldOtpEmailGroup, newOtpEmailAndPhoneGroup);

// 9. In Central Default Settings Modal, add Phone Number field as well
const oldSettingsField = `              <Form.Text className="text-muted" style={{ fontSize: '11px' }}>
                All document access verification OTP emails will be sent to this address by default.
              </Form.Text>
            </Form.Group>`;

const newSettingsField = `              <Form.Text className="text-muted" style={{ fontSize: '11px' }}>
                All document access verification OTP emails will be sent to this address by default.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">
                Default Phone Number <span className="text-muted">(Optional)</span>
              </Form.Label>
              <Form.Control
                type="tel"
                placeholder="e.g. +91 9876543210"
                value={editingDefaultPhone}
                onChange={(e) => setEditingDefaultPhone(e.target.value)}
              />
              <Form.Text className="text-muted" style={{ fontSize: '11px' }}>
                Default contact phone number auto-populated when creating new folders.
              </Form.Text>
            </Form.Group>`;

if (sNorm.includes(oldSettingsField)) {
  sNorm = sNorm.replace(oldSettingsField, newSettingsField);
}

// Convert back to CRLF
const sFinal = sNorm.replace(/\n/g, '\r\n');
fs.writeFileSync('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', sFinal, 'utf8');
console.log('Successfully injected Phone Number field into FolderCreation.jsx!');

