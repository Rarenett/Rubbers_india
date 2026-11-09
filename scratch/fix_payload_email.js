const fs = require('fs');

let s = fs.readFileSync('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', 'utf8');

// Normalize to LF
let sNorm = s.replace(/\r\n/g, '\n');

// 1. In handleOpenModal, ensure formData initializes with default_otp_email and phone_number
const oldEditInit = `      setFormData({
        name: folder.name || "",
        description: folder.description || "",
        folder_type: folder.folder_type || "shared",
        parent_folder: folder.parent_folder ? String(folder.parent_folder) : "",
        is_active: folder.is_active !== undefined ? folder.is_active : true,
      });`;

const newEditInit = `      setFormData({
        name: folder.name || "",
        description: folder.description || "",
        folder_type: folder.folder_type || "shared",
        parent_folder: folder.parent_folder ? String(folder.parent_folder) : "",
        is_active: folder.is_active !== undefined ? folder.is_active : true,
        default_otp_email: folder.default_otp_email || defaultOtpEmail || "digilocker@rarenett.com",
        phone_number: folder.phone_number || "",
      });`;

sNorm = sNorm.replace(oldEditInit, newEditInit);

const oldSubfolderInit = `      setFormData({
        name: "",
        description: "",
        folder_type: "shared",
        parent_folder: String(folder.id),
        is_active: true,
      });`;

const newSubfolderInit = `      setFormData({
        name: "",
        description: "",
        folder_type: "shared",
        parent_folder: String(folder.id),
        is_active: true,
        default_otp_email: defaultOtpEmail || "digilocker@rarenett.com",
        phone_number: defaultPhoneNumber || "",
      });`;

sNorm = sNorm.replace(oldSubfolderInit, newSubfolderInit);

const oldRootInit = `      setFormData({
        name: "",
        description: "",
        folder_type: "shared",
        parent_folder: "",
        is_active: true,
      });`;

const newRootInit = `      setFormData({
        name: "",
        description: "",
        folder_type: "shared",
        parent_folder: "",
        is_active: true,
        default_otp_email: defaultOtpEmail || "digilocker@rarenett.com",
        phone_number: defaultPhoneNumber || "",
      });`;

sNorm = sNorm.replace(oldRootInit, newRootInit);

// 2. In handleSubmit, explicitly pass default_otp_email and phone_number in the payload
const oldPayload = `    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      folder_type: formData.folder_type,
      parent_folder: formData.parent_folder ? Number(formData.parent_folder) : null,
      is_active: formData.is_active,
    };`;

const newPayload = `    const chosenEmail = (formData.default_otp_email !== undefined && formData.default_otp_email !== null && formData.default_otp_email.trim() !== '')
      ? formData.default_otp_email.trim()
      : (defaultOtpEmail || 'digilocker@rarenett.com').trim();

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      folder_type: formData.folder_type,
      parent_folder: formData.parent_folder ? Number(formData.parent_folder) : null,
      is_active: formData.is_active,
      default_otp_email: chosenEmail,
      phone_number: (formData.phone_number || '').trim(),
    };`;

if (!sNorm.includes(oldPayload)) {
  console.error("oldPayload not found in FolderCreation.jsx!");
  process.exit(1);
}

sNorm = sNorm.replace(oldPayload, newPayload);

// 3. Make sure the input value is bound to formData.default_otp_email
sNorm = sNorm.replace(
  'value={formData.default_otp_email !== undefined ? formData.default_otp_email : (defaultOtpEmail || "")}',
  'value={formData.default_otp_email || ""}'
);

// Convert back to CRLF
const sFinal = sNorm.replace(/\n/g, '\r\n');
fs.writeFileSync('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', sFinal, 'utf8');
console.log('Successfully updated FolderCreation.jsx handleSubmit payload!');

