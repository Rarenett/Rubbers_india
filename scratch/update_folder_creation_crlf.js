const fs = require('fs');

let s = fs.readFileSync('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', 'utf8');

// 1. Add state for defaultOtpEmail and loadingSettings
const oldStateAnchor = '  const [formErrors, setFormErrors] = useState({});';
const newStateAdditions = `  const [defaultOtpEmail, setDefaultOtpEmail] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [formErrors, setFormErrors] = useState({});`;

s = s.replace(oldStateAnchor, newStateAdditions);

// 2. Add fetchDigiLockerSettings to useEffect
const oldUseEffect = `  useEffect(() => {
    fetchFolders();
  }, []);`;

const newUseEffect = `  useEffect(() => {
    fetchFolders();
    fetchDigiLockerSettings();
  }, []);

  const fetchDigiLockerSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await DigiLockerService.getSettings();
      if (res.data && res.data.default_otp_email) {
        setDefaultOtpEmail(res.data.default_otp_email);
      }
    } catch (err) {
      console.error("Error loading central DigiLocker default OTP email setting:", err);
    } finally {
      setLoadingSettings(false);
    }
  };`;

s = s.replace(oldUseEffect, newUseEffect);

// 3. Update handleOpenModal form data
const editModeFormData = `      setFormData({
        name: folder.name || "",
        description: folder.description || "",
        folder_type: folder.folder_type || "shared",
        parent_folder: folder.parent_folder ? String(folder.parent_folder) : "",
        is_active: folder.is_active !== undefined ? folder.is_active : true,
      });`;

const newEditModeFormData = `      setFormData({
        name: folder.name || "",
        description: folder.description || "",
        folder_type: folder.folder_type || "shared",
        parent_folder: folder.parent_folder ? String(folder.parent_folder) : "",
        is_active: folder.is_active !== undefined ? folder.is_active : true,
        default_otp_email: folder.default_otp_email || defaultOtpEmail || "digilocker@rarenett.com",
      });`;

s = s.replace(editModeFormData, newEditModeFormData);

const subfolderFormData = `      setFormData({
        name: "",
        description: "",
        folder_type: "shared",
        parent_folder: String(folder.id),
        is_active: true,
      });`;

const newSubfolderFormData = `      setFormData({
        name: "",
        description: "",
        folder_type: "shared",
        parent_folder: String(folder.id),
        is_active: true,
        default_otp_email: defaultOtpEmail || "digilocker@rarenett.com",
      });`;

s = s.replace(subfolderFormData, newSubfolderFormData);

const rootFolderFormData = `      setFormData({
        name: "",
        description: "",
        folder_type: "shared",
        parent_folder: "",
        is_active: true,
      });`;

const newRootFolderFormData = `      setFormData({
        name: "",
        description: "",
        folder_type: "shared",
        parent_folder: "",
        is_active: true,
        default_otp_email: defaultOtpEmail || "digilocker@rarenett.com",
      });`;

s = s.replace(rootFolderFormData, newRootFolderFormData);

// 4. Update validateForm
const oldValidateForm = `    if (!trimmedName) {
      errors.name = "Folder name is required.";
    } else {`;

const newValidateForm = `    const activeOtpEmail = (formData.default_otp_email || defaultOtpEmail || "").trim();
    if (!activeOtpEmail) {
      errors.default_otp_email = "Default OTP email is required.";
    }

    if (!trimmedName) {
      errors.name = "Folder name is required.";
    } else {`;

s = s.replace(oldValidateForm, newValidateForm);

// 5. Update payload in handleSubmit
const oldPayload = `    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      folder_type: formData.folder_type,
      parent_folder: formData.parent_folder ? Number(formData.parent_folder) : null,
      is_active: formData.is_active,
    };`;

const newPayload = `    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      folder_type: formData.folder_type,
      parent_folder: formData.parent_folder ? Number(formData.parent_folder) : null,
      is_active: formData.is_active,
      default_otp_email: (formData.default_otp_email || defaultOtpEmail || "digilocker@rarenett.com").trim(),
    };`;

s = s.replace(oldPayload, newPayload);

// 6. Insert Default OTP Email field between Folder Type and Active Status
const oldModalBlock = `            <Form.Group className="mb-3">
              <Form.Label>Folder Type</Form.Label>
              <Form.Select
                value={formData.folder_type}
                onChange={(e) =>
                  setFormData({ ...formData, folder_type: e.target.value })
                }
              >
                <option value="shared">Shared / Managed (Assignable to Employees)</option>
                <option value="personal">Personal (Employee Own Documents)</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Active Status"`;

const newModalBlock = `            <Form.Group className="mb-3">
              <Form.Label>Folder Type</Form.Label>
              <Form.Select
                value={formData.folder_type}
                onChange={(e) =>
                  setFormData({ ...formData, folder_type: e.target.value })
                }
              >
                <option value="shared">Shared / Managed (Assignable to Employees)</option>
                <option value="personal">Personal (Employee Own Documents)</option>
              </Form.Select>
            </Form.Group>

            {/* Default OTP Email (NEW) */}
            <Form.Group className="mb-3">
              <Form.Label>
                Default OTP Email <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="email"
                placeholder="e.g. digilocker@rarenett.com"
                value={formData.default_otp_email !== undefined ? formData.default_otp_email : (defaultOtpEmail || "digilocker@rarenett.com")}
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

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Active Status"`;

// Replace CRLF / LF consistently
const normalize = (str) => str.replace(/\r\n/g, '\n');
const sNorm = normalize(s);
const oldModalBlockNorm = normalize(oldModalBlock);

if (!sNorm.includes(oldModalBlockNorm)) {
  console.error("oldModalBlockNorm not found in normalized file!");
  process.exit(1);
}

s = sNorm.replace(oldModalBlockNorm, normalize(newModalBlock));
// restore CRLF
s = s.replace(/\n/g, '\r\n');

fs.writeFileSync('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', s, 'utf8');
console.log('Successfully updated FolderCreation.jsx with editable Default OTP Email input!');

