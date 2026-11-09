const fs = require('fs');

let s = fs.readFileSync('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', 'utf8');

// 1. Add state for defaultOtpEmail and loadingSettings
const oldStateAnchor = '  const [formErrors, setFormErrors] = useState({});';
const newStateAdditions = `  const [defaultOtpEmail, setDefaultOtpEmail] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [formErrors, setFormErrors] = useState({});`;

s = s.replace(oldStateAnchor, newStateAdditions);

// 2. Fetch central settings on component mount
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

// 3. Add default_otp_email to formData initialized in handleOpenModal
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
        default_otp_email: folder.default_otp_email || defaultOtpEmail,
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
        default_otp_email: defaultOtpEmail,
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
        default_otp_email: defaultOtpEmail,
      });`;

s = s.replace(rootFolderFormData, newRootFolderFormData);

// 4. Update validateForm to verify default OTP email is present
const oldValidateForm = `    if (!trimmedName) {
      errors.name = "Folder name is required.";
    } else {`;

const newValidateForm = `    const activeOtpEmail = (formData.default_otp_email || defaultOtpEmail || "").trim();
    if (!activeOtpEmail) {
      errors.default_otp_email = "Centralized Default OTP Email is not configured. Please configure it in DigiLocker settings before creating folders.";
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
      default_otp_email: (formData.default_otp_email || defaultOtpEmail || "").trim(),
    };`;

s = s.replace(oldPayload, newPayload);

// 6. Add Default OTP Email field to Modal.Body between Folder Type and Active Status
const oldModalField = `            <Form.Group className="mb-3">
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

const newModalField = `            <Form.Group className="mb-3">
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
                value={formData.default_otp_email || defaultOtpEmail || ""}
                readOnly
                disabled
                className="bg-light"
                placeholder={loadingSettings ? "Loading default OTP email..." : "e.g. digilocker@rarenett.com"}
                isInvalid={!!formErrors.default_otp_email}
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.default_otp_email}
              </Form.Control.Feedback>
              <Form.Text className="text-muted" style={{ fontSize: "11px" }}>
                All DigiLocker OTP verification emails for documents in this folder are automatically delivered to this centralized email.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Active Status"`;

s = s.replace(oldModalField, newModalField);

fs.writeFileSync('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', s, 'utf8');
console.log('Successfully updated FolderCreation.jsx with Default OTP Email field!');

