const fs = require('fs');

let s = fs.readFileSync('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', 'utf8');

// 1. In formData state, add phone_number
s = s.replace(
  `  const [formData, setFormData] = useState({
    name: "",
    description: "",
    folder_type: "shared",
    parent_folder: "",
    is_active: true,
  });`,
  `  const [formData, setFormData] = useState({
    name: "",
    description: "",
    folder_type: "shared",
    parent_folder: "",
    is_active: true,
    default_otp_email: "",
    phone_number: "",
  });`
);

// 2. In Central settings states, add defaultPhoneNumber and editingDefaultPhone
s = s.replace(
  `  const [defaultOtpEmail, setDefaultOtpEmail] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(false);`,
  `  const [defaultOtpEmail, setDefaultOtpEmail] = useState("");
  const [defaultPhoneNumber, setDefaultPhoneNumber] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(false);`
);

s = s.replace(
  `  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingDefaultEmail, setEditingDefaultEmail] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');`,
  `  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingDefaultEmail, setEditingDefaultEmail] = useState('');
  const [editingDefaultPhone, setEditingDefaultPhone] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');`
);

// 3. In fetchDigiLockerSettings, populate defaultPhoneNumber
s = s.replace(
  `      if (res.data && res.data.default_otp_email) {
        setDefaultOtpEmail(res.data.default_otp_email);
      }`,
  `      if (res.data) {
        if (res.data.default_otp_email) setDefaultOtpEmail(res.data.default_otp_email);
        if (res.data.default_phone_number) setDefaultPhoneNumber(res.data.default_phone_number);
      }`
);

// 4. In handleOpenSettingsModal, prefill editingDefaultPhone
s = s.replace(
  `  const handleOpenSettingsModal = () => {
    setEditingDefaultEmail(defaultOtpEmail || 'digilocker@rarenett.com');
    setSettingsError('');
    setShowSettingsModal(true);
  };`,
  `  const handleOpenSettingsModal = () => {
    setEditingDefaultEmail(defaultOtpEmail || 'digilocker@rarenett.com');
    setEditingDefaultPhone(defaultPhoneNumber || '');
    setSettingsError('');
    setShowSettingsModal(true);
  };`
);

// 5. In handleSaveSettings, include default_phone_number in payload
s = s.replace(
  `      const res = await DigiLockerService.updateSettings({ default_otp_email: emailToSave });
      const updated = res.data?.settings?.default_otp_email || emailToSave;
      setDefaultOtpEmail(updated);`,
  `      const res = await DigiLockerService.updateSettings({
        default_otp_email: emailToSave,
        default_phone_number: editingDefaultPhone.trim()
      });
      const updated = res.data?.settings?.default_otp_email || emailToSave;
      setDefaultOtpEmail(updated);
      if (res.data?.settings?.default_phone_number !== undefined) {
        setDefaultPhoneNumber(res.data.settings.default_phone_number);
      }`
);

// 6. In handleOpenModal, initialize default_otp_email and phone_number
s = s.replace(
  `      setFormData({
        name: folder.name || "",
        description: folder.description || "",
        folder_type: folder.folder_type || "shared",
        parent_folder: folder.parent_folder ? String(folder.parent_folder) : "",
        is_active: folder.is_active !== undefined ? folder.is_active : true,
      });`,
  `      setFormData({
        name: folder.name || "",
        description: folder.description || "",
        folder_type: folder.folder_type || "shared",
        parent_folder: folder.parent_folder ? String(folder.parent_folder) : "",
        is_active: folder.is_active !== undefined ? folder.is_active : true,
        default_otp_email: folder.default_otp_email || defaultOtpEmail || "",
        phone_number: folder.phone_number || "",
      });`
);

s = s.replace(
  `      setFormData({
        name: "",
        description: "",
        folder_type: "shared",
        parent_folder: String(folder.id),
        is_active: true,
      });`,
  `      setFormData({
        name: "",
        description: "",
        folder_type: "shared",
        parent_folder: String(folder.id),
        is_active: true,
        default_otp_email: defaultOtpEmail || "",
        phone_number: defaultPhoneNumber || "",
      });`
);

s = s.replace(
  `      setFormData({
        name: "",
        description: "",
        folder_type: "shared",
        parent_folder: "",
        is_active: true,
      });`,
  `      setFormData({
        name: "",
        description: "",
        folder_type: "shared",
        parent_folder: "",
        is_active: true,
        default_otp_email: defaultOtpEmail || "",
        phone_number: defaultPhoneNumber || "",
      });`
);

// 7. In handleSubmit payload, include default_otp_email and phone_number
s = s.replace(
  `    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      folder_type: formData.folder_type,
      parent_folder: formData.parent_folder ? Number(formData.parent_folder) : null,
      is_active: formData.is_active,
    };`,
  `    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      folder_type: formData.folder_type,
      parent_folder: formData.parent_folder ? Number(formData.parent_folder) : null,
      is_active: formData.is_active,
      default_otp_email: (formData.default_otp_email || defaultOtpEmail || "").trim(),
      phone_number: (formData.phone_number || "").trim(),
    };`
);

// 8. In Create / Edit Folder Modal, add Phone Number field right below Default OTP Email
const oldFolderFormGroup = `            {/* Default OTP Email (NEW) */}
            <Form.Group className="mb-3">
              <Form.Label>
                Default OTP Email <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="email"
                placeholder="e.g. digilocker@rarenett.com"
                value={formData.default_otp_email !== undefined ? formData.default_otp_email : (defaultOtpEmail || "")}
                onChange={(e) =>
                  setFormData({ ...formData, default_otp_email: e.target.value })
                }
                isInvalid={!!formErrors.default_otp_email}
                required
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.default_otp_email}
              </Form.Control.Feedback>
              <Form.Text className="text-muted" style={{ fontSize: "11px" }}>
                All DigiLocker OTP verification emails for documents in this folder will be delivered to this email.
              </Form.Text>
            </Form.Group>`;

const newFolderFormGroup = `            {/* Default OTP Email */}
            <Form.Group className="mb-3">
              <Form.Label>
                Default OTP Email <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="email"
                placeholder="e.g. digilocker@rarenett.com"
                value={formData.default_otp_email !== undefined ? formData.default_otp_email : (defaultOtpEmail || "")}
                onChange={(e) =>
                  setFormData({ ...formData, default_otp_email: e.target.value })
                }
                isInvalid={!!formErrors.default_otp_email}
                required
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.default_otp_email}
              </Form.Control.Feedback>
              <Form.Text className="text-muted" style={{ fontSize: "11px" }}>
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

s = s.replace(oldFolderFormGroup, newFolderFormGroup);

// 9. In Central Default Email Settings Modal, also add default phone number input
const oldSettingsGroup = `            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">
                Default OTP Email Address <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="email"
                required
                placeholder="e.g. digilocker@rarenett.com"
                value={editingDefaultEmail}
                onChange={(e) => {
                  setEditingDefaultEmail(e.target.value);
                  setSettingsError('');
                }}
                isInvalid={!!settingsError}
              />
              <Form.Control.Feedback type="invalid">
                {settingsError}
              </Form.Control.Feedback>
              <Form.Text className="text-muted" style={{ fontSize: '11px' }}>
                All document access verification OTP emails will be sent to this address by default.
              </Form.Text>
            </Form.Group>`;

const newSettingsGroup = `            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">
                Default OTP Email Address <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="email"
                required
                placeholder="e.g. digilocker@rarenett.com"
                value={editingDefaultEmail}
                onChange={(e) => {
                  setEditingDefaultEmail(e.target.value);
                  setSettingsError('');
                }}
                isInvalid={!!settingsError}
              />
              <Form.Control.Feedback type="invalid">
                {settingsError}
              </Form.Control.Feedback>
              <Form.Text className="text-muted" style={{ fontSize: '11px' }}>
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

s = s.replace(oldSettingsGroup, newSettingsGroup);

fs.writeFileSync('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', s, 'utf8');
console.log('Successfully updated FolderCreation.jsx with Phone Number fields in both modals!');

