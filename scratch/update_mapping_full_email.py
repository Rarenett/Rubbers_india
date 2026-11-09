with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add centralDefaultOtpEmail and useDefaultEmailOption state
old_state = """  // Edit Folder OTP Email Modal State
  const [showEditEmailModal, setShowEditEmailModal] = useState(false);
  const [folderToEditEmail, setFolderToEditEmail] = useState(null);
  const [newOtpEmail, setNewOtpEmail] = useState('');
  const [savingOtpEmail, setSavingOtpEmail] = useState(false);
  const [emailModalError, setEmailModalError] = useState('');"""

new_state = """  // Central Default OTP Email
  const [centralDefaultEmail, setCentralDefaultEmail] = useState('digilocker@rarenett.com');

  // Edit Folder OTP Email Modal State
  const [showEditEmailModal, setShowEditEmailModal] = useState(false);
  const [folderToEditEmail, setFolderToEditEmail] = useState(null);
  const [newOtpEmail, setNewOtpEmail] = useState('');
  const [useDefaultEmailOption, setUseDefaultEmailOption] = useState(false);
  const [savingOtpEmail, setSavingOtpEmail] = useState(false);
  const [emailModalError, setEmailModalError] = useState('');"""

if '\r\n' in text:
    old_state = old_state.replace('\n', '\r\n')
    new_state = new_state.replace('\n', '\r\n')

assert old_state in text, "old_state not found"
text = text.replace(old_state, new_state, 1)

# 2. Fetch centralDefaultEmail in useEffect
old_use_effect = """  useEffect(() => {
    fetchMappings();
    fetchFolders();
    fetchDepartments();
    fetchEmployees();
  }, []);"""

new_use_effect = """  useEffect(() => {
    fetchMappings();
    fetchFolders();
    fetchDepartments();
    fetchEmployees();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await DigiLockerService.getSettings();
      if (res.data?.default_otp_email) {
        setCentralDefaultEmail(res.data.default_otp_email.trim());
      }
    } catch (err) {
      console.error("Error fetching DigiLocker settings:", err);
    }
  };"""

if '\r\n' in text:
    old_use_effect = old_use_effect.replace('\n', '\r\n')
    new_use_effect = new_use_effect.replace('\n', '\r\n')

assert old_use_effect in text, "old_use_effect not found"
text = text.replace(old_use_effect, new_use_effect, 1)

# 3. Update handleOpenEditEmailModal & handleSaveOtpEmail
old_modal_handlers = """  // Open Edit Folder OTP Email Modal
  const handleOpenEditEmailModal = (folder) => {
    setFolderToEditEmail(folder);
    const currentEmail = folder.default_otp_email || folder.current_owner_email || folder.owner_email || '';
    setNewOtpEmail(currentEmail);
    setEmailModalError('');
    setShowEditEmailModal(true);
  };

  const handleCloseEditEmailModal = () => {
    setShowEditEmailModal(false);
    setFolderToEditEmail(null);
    setNewOtpEmail('');
    setEmailModalError('');
    setSavingOtpEmail(false);
  };

  // Submit Edit Folder OTP Email
  const handleSaveOtpEmail = async (e) => {
    e.preventDefault();
    if (!folderToEditEmail) return;

    const emailTrimmed = newOtpEmail.trim();
    if (!emailTrimmed) {
      setEmailModalError('Please provide a valid email address.');
      return;
    }

    const emailRegex = /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      setEmailModalError('Please enter a valid email format (e.g. name@company.com).');
      return;
    }

    const confirmRes = await Swal.fire({
      title: 'Confirm OTP Email Update',
      html: '<p class="text-start mb-2">Are you sure you want to update the OTP recipient email for folder <strong>"' + (folderToEditEmail.name || '') + '"</strong>?</p>' +
            '<div class="alert alert-info text-start py-2 small mb-0">' +
              '<div><strong>Folder:</strong> ' + (folderToEditEmail.name || '') + '</div>' +
              '<div><strong>Current OTP Email:</strong> ' + (folderToEditEmail.current_owner_email || folderToEditEmail.owner_email || folderToEditEmail.default_otp_email || '-') + '</div>' +
              '<div><strong>New OTP Email:</strong> ' + emailTrimmed + '</div>' +
              '<div class="mt-1 text-muted">All future OTP verification requests for documents inside this folder will be delivered to this updated email. Folder ownership and permissions will not be affected.</div>' +
            '</div>',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3d3577',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, Update Email',
      cancelButtonText: 'Cancel'
    });

    if (!confirmRes.isConfirmed) return;

    setSavingOtpEmail(true);
    setEmailModalError('');
    try {
      await DigiLockerService.updateFolderOtpEmail(folderToEditEmail.id, {
        default_otp_email: emailTrimmed
      });

      Swal.fire('Success', 'OTP recipient email for folder "' + folderToEditEmail.name + '" updated successfully to ' + emailTrimmed + '.', 'success');
      handleCloseEditEmailModal();
      fetchFolders();
    } catch (err) {
      console.error('Error updating folder OTP email:', err);
      const msg = err.response?.data?.error || 'Failed to update folder OTP email.';
      setEmailModalError(msg);
      Swal.fire('Error', msg, 'error');
    } finally {
      setSavingOtpEmail(false);
    }
  };"""

new_modal_handlers = """  // Open Edit Folder OTP Email Modal
  const handleOpenEditEmailModal = (folder) => {
    setFolderToEditEmail(folder);
    const isUsingDefault = folder.uses_default_otp_email !== false;
    setUseDefaultEmailOption(isUsingDefault);
    const currentEmail = isUsingDefault
      ? centralDefaultEmail
      : (folder.default_otp_email || folder.current_owner_email || centralDefaultEmail);
    setNewOtpEmail(currentEmail);
    setEmailModalError('');
    setShowEditEmailModal(true);
  };

  const handleCloseEditEmailModal = () => {
    setShowEditEmailModal(false);
    setFolderToEditEmail(null);
    setNewOtpEmail('');
    setUseDefaultEmailOption(false);
    setEmailModalError('');
    setSavingOtpEmail(false);
  };

  // Submit Edit Folder OTP Email
  const handleSaveOtpEmail = async (e) => {
    e.preventDefault();
    if (!folderToEditEmail) return;

    const emailTrimmed = useDefaultEmailOption ? centralDefaultEmail : newOtpEmail.trim();
    if (!emailTrimmed) {
      setEmailModalError('Please provide a valid email address.');
      return;
    }

    const emailRegex = /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      setEmailModalError('Please enter a valid email format (e.g. name@company.com).');
      return;
    }

    const confirmRes = await Swal.fire({
      title: 'Confirm OTP Email Update',
      html: '<p class="text-start mb-2">Are you sure you want to update the OTP recipient email for folder <strong>"' + (folderToEditEmail.name || '') + '"</strong>?</p>' +
            '<div class="alert alert-info text-start py-2 small mb-0">' +
              '<div><strong>Folder:</strong> ' + (folderToEditEmail.name || '') + '</div>' +
              '<div><strong>Current OTP Email:</strong> ' + (folderToEditEmail.current_owner_email || folderToEditEmail.owner_email || folderToEditEmail.default_otp_email || '-') + '</div>' +
              '<div><strong>New OTP Email:</strong> ' + emailTrimmed + (useDefaultEmailOption ? ' <em>(Central Default)</em>' : ' <em>(Custom)</em>') + '</div>' +
              '<div class="mt-1 text-muted">All future OTP verification requests for documents inside this folder will be delivered to this updated email. Folder ownership and permissions will not be affected.</div>' +
            '</div>',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3d3577',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, Update Email',
      cancelButtonText: 'Cancel'
    });

    if (!confirmRes.isConfirmed) return;

    setSavingOtpEmail(true);
    setEmailModalError('');
    try {
      await DigiLockerService.updateFolderOtpEmail(folderToEditEmail.id, {
        default_otp_email: emailTrimmed,
        use_default_otp_email: useDefaultEmailOption
      });

      Swal.fire('Success', 'OTP recipient email for folder "' + folderToEditEmail.name + '" updated successfully.', 'success');
      handleCloseEditEmailModal();
      fetchFolders();
    } catch (err) {
      console.error('Error updating folder OTP email:', err);
      const msg = err.response?.data?.error || 'Failed to update folder OTP email.';
      setEmailModalError(msg);
      Swal.fire('Error', msg, 'error');
    } finally {
      setSavingOtpEmail(false);
    }
  };"""

if '\r\n' in text:
    old_modal_handlers = old_modal_handlers.replace('\n', '\r\n')
    new_modal_handlers = new_modal_handlers.replace('\n', '\r\n')

assert old_modal_handlers in text, "old_modal_handlers not found"
text = text.replace(old_modal_handlers, new_modal_handlers, 1)

# 4. Update the Edit Folder OTP Email Modal markup with Use Default OTP Email Checkbox
old_edit_modal = """      {/* Modal for Editing Folder OTP Email */}
      <Modal show={showEditEmailModal} onHide={handleCloseEditEmailModal} centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: '16px', fontWeight: 'bold' }}>
            <i className="fa fa-envelope text-primary me-2"></i>
            Edit Folder OTP Recipient Email
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSaveOtpEmail}>
          <Modal.Body>
            {emailModalError && (
              <div className="alert alert-danger py-2 small mb-3">
                {emailModalError}
              </div>
            )}
            <div className="mb-3">
              <Form.Label className="fw-semibold small">Folder Name</Form.Label>
              <Form.Control
                type="text"
                value={folderToEditEmail?.name || ''}
                disabled
                className="bg-light"
              />
            </div>

            <div className="mb-3">
              <Form.Label className="fw-semibold small">Current Owner</Form.Label>
              <Form.Control
                type="text"
                value={folderToEditEmail?.owner_name || folderToEditEmail?.current_owner_name || '-'}
                disabled
                className="bg-light"
              />
            </div>

            <div className="mb-3">
              <Form.Label className="fw-semibold small">
                OTP Recipient Email <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="email"
                placeholder="e.g. digilocker@rarenett.com"
                value={newOtpEmail}
                onChange={(e) => setNewOtpEmail(e.target.value)}
                autoFocus
                required
              />
              <Form.Text className="text-muted small">
                All DigiLocker OTP verification codes for viewing or downloading documents inside this folder will be delivered to this address.
              </Form.Text>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="danger light" onClick={handleCloseEditEmailModal} disabled={savingOtpEmail}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={savingOtpEmail}
              style={{ backgroundColor: "rgb(61, 53, 119)", borderColor: "rgb(61, 53, 119)" }}
            >
              {savingOtpEmail ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                  Saving...
                </>
              ) : (
                'Save OTP Email'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>"""

new_edit_modal = """      {/* Modal for Editing Folder OTP Email */}
      <Modal show={showEditEmailModal} onHide={handleCloseEditEmailModal} centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: '16px', fontWeight: 'bold' }}>
            <i className="fa fa-envelope text-primary me-2"></i>
            Edit Folder OTP Recipient Email
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSaveOtpEmail}>
          <Modal.Body>
            {emailModalError && (
              <div className="alert alert-danger py-2 small mb-3">
                {emailModalError}
              </div>
            )}
            <div className="mb-3">
              <Form.Label className="fw-semibold small">Folder Name</Form.Label>
              <Form.Control
                type="text"
                value={folderToEditEmail?.name || ''}
                disabled
                className="bg-light"
              />
            </div>

            <div className="mb-3">
              <Form.Label className="fw-semibold small">Current Owner</Form.Label>
              <Form.Control
                type="text"
                value={folderToEditEmail?.owner_name || folderToEditEmail?.current_owner_name || '-'}
                disabled
                className="bg-light"
              />
            </div>

            <div className="mb-3">
              <Form.Label className="fw-semibold small">Existing OTP Email</Form.Label>
              <Form.Control
                type="text"
                value={folderToEditEmail?.current_owner_email || folderToEditEmail?.default_otp_email || '-'}
                disabled
                className="bg-light"
              />
            </div>

            <div className="mb-3 p-2 rounded bg-light border">
              <Form.Check
                type="checkbox"
                id="use-default-otp-checkbox"
                label={
                  <div>
                    <strong>Use Centralized Default OTP Email</strong>
                    <div className="text-muted small">
                      Automatically syncs with central default: <code>{centralDefaultEmail}</code>
                    </div>
                  </div>
                }
                checked={useDefaultEmailOption}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setUseDefaultEmailOption(checked);
                  if (checked) {
                    setNewOtpEmail(centralDefaultEmail);
                  }
                }}
              />
            </div>

            <div className="mb-3">
              <Form.Label className="fw-semibold small">
                {useDefaultEmailOption ? 'OTP Recipient Email (Inherited from Central Default)' : 'New OTP Recipient Email (Custom)'}{' '}
                <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="email"
                placeholder="e.g. digilocker@rarenett.com"
                value={useDefaultEmailOption ? centralDefaultEmail : newOtpEmail}
                onChange={(e) => setNewOtpEmail(e.target.value)}
                disabled={useDefaultEmailOption}
                autoFocus={!useDefaultEmailOption}
                required
              />
              <Form.Text className="text-muted small">
                All DigiLocker OTP verification codes for documents inside this folder will be delivered to this address.
              </Form.Text>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="danger light" onClick={handleCloseEditEmailModal} disabled={savingOtpEmail}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={savingOtpEmail}
              style={{ backgroundColor: "rgb(61, 53, 119)", borderColor: "rgb(61, 53, 119)" }}
            >
              {savingOtpEmail ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                  Saving...
                </>
              ) : (
                'Save OTP Email'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>"""

if '\r\n' in text:
    old_edit_modal = old_edit_modal.replace('\n', '\r\n')
    new_edit_modal = new_edit_modal.replace('\n', '\r\n')

assert old_edit_modal in text, "old_edit_modal not found"
text = text.replace(old_edit_modal, new_edit_modal, 1)

with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Updated DigiLockerMapping.jsx successfully with central default sync & toggle.")

