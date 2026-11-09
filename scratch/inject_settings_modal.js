const fs = require('fs');

let s = fs.readFileSync('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', 'utf8');

// Normalize CRLF to LF for reliable replacements
let sNorm = s.replace(/\r\n/g, '\n');

// 1. Add settings modal state
const stateMarker = '  const [submitting, setSubmitting] = useState(false);';
const newStates = `  const [submitting, setSubmitting] = useState(false);

  // Central Default OTP Email Settings Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingDefaultEmail, setEditingDefaultEmail] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');`;

sNorm = sNorm.replace(stateMarker, newStates);

// 2. Add fetchDigiLockerSettings to initial mount and add handleSaveSettings
const oldFetchMethod = `  const fetchFolders = async () => {`;
const newSettingsMethods = `  useEffect(() => {
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
      console.error('Error loading central DigiLocker default OTP email setting:', err);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleOpenSettingsModal = () => {
    setEditingDefaultEmail(defaultOtpEmail || 'digilocker@rarenett.com');
    setSettingsError('');
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const emailToSave = editingDefaultEmail.trim();
    if (!emailToSave) {
      setSettingsError('Please provide a valid default OTP email address.');
      return;
    }
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!emailRegex.test(emailToSave)) {
      setSettingsError('Please provide a valid email format (e.g. digilocker@rarenett.com).');
      return;
    }

    setSavingSettings(true);
    setSettingsError('');
    try {
      const res = await DigiLockerService.updateSettings({ default_otp_email: emailToSave });
      const updated = res.data?.settings?.default_otp_email || emailToSave;
      setDefaultOtpEmail(updated);
      swal('Success', 'Centralized Default OTP Email updated to ' + updated + '. It will now automatically reflect when creating folders for all employees.', 'success');
      setShowSettingsModal(false);
      fetchFolders();
    } catch (err) {
      console.error('Error updating central settings:', err);
      const msg = err.response?.data?.error || 'Failed to update centralized Default OTP Email.';
      setSettingsError(msg);
    } finally {
      setSavingSettings(false);
    }
  };
`;

sNorm = sNorm.replace(
  `  useEffect(() => {\n    fetchFolders();\n  }, []);`,
  ''
);
sNorm = sNorm.replace(oldFetchMethod, newSettingsMethods + '\n' + oldFetchMethod);

// 3. Add Settings button in Header actions
const createButtonTarget = `<CreateButton
                  onClick={() => handleOpenModal()}`;

const newHeaderButtons = `<Button
                  variant="outline-primary"
                  size="sm"
                  onClick={handleOpenSettingsModal}
                  title="Configure Centralized Default OTP Email"
                  style={{
                    height: '36px',
                    borderRadius: '8px',
                    padding: '0 14px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <i className="fa fa-envelope-o"></i> Set Default OTP Email
                </Button>
                <CreateButton
                  onClick={() => handleOpenModal()}`;

sNorm = sNorm.replace(createButtonTarget, newHeaderButtons);

// 4. Update the input in Create/Edit Folder Modal to auto-fill with defaultOtpEmail
sNorm = sNorm.replace(
  'value={formData.default_otp_email !== undefined ? formData.default_otp_email : (defaultOtpEmail || "digilocker@rarenett.com")}',
  'value={formData.default_otp_email !== undefined ? formData.default_otp_email : (defaultOtpEmail || "")}'
);

// 5. Add the Central Settings Modal
const settingsModalJSX = `      {/* Central Default OTP Email Configuration Modal */}
      <Modal show={showSettingsModal} onHide={() => setShowSettingsModal(false)} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: '16px', fontWeight: '600' }}>
            <i className="fa fa-envelope text-primary me-2"></i> Configure Default OTP Email
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSaveSettings}>
          <Modal.Body>
            <p className="text-muted small mb-3">
              Set the centralized Default OTP Email for the DigiLocker module. Once set, this email address will automatically reflect whenever anyone creates a folder.
            </p>

            <Form.Group className="mb-3">
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

            <div className="alert alert-info py-2 px-3 small mb-0">
              <i className="fa fa-info-circle me-1"></i>
              <strong>Centralized Setting:</strong> Updating this email automatically synchronizes it across all existing folders and pre-populates it for every employee when creating new folders.
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" size="sm" onClick={() => setShowSettingsModal(false)} disabled={savingSettings}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={savingSettings || !editingDefaultEmail.trim()}
              style={{
                backgroundColor: 'rgb(61, 53, 119)',
                borderColor: 'rgb(61, 53, 119)',
              }}
            >
              {savingSettings ? 'Saving...' : 'Save Default Email'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
`;

const closingTag = '    </div>\n  );\n};\n\nexport default FolderCreation;';
sNorm = sNorm.replace(closingTag, settingsModalJSX + '\n' + closingTag);

// Re-convert to CRLF
const sFinal = sNorm.replace(/\n/g, '\r\n');
fs.writeFileSync('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', sFinal, 'utf8');
console.log('Successfully updated FolderCreation.jsx with Set Default OTP Email modal and button!');

