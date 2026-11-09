with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add states for Edit OTP Email Modal
target_state = "  // Transfer History Modal State"
new_state = """  // Edit Folder OTP Email Modal State
  const [showEditEmailModal, setShowEditEmailModal] = useState(false);
  const [folderToEditEmail, setFolderToEditEmail] = useState(null);
  const [newOtpEmail, setNewOtpEmail] = useState('');
  const [savingOtpEmail, setSavingOtpEmail] = useState(false);
  const [emailModalError, setEmailModalError] = useState('');

  // Transfer History Modal State"""

if '\r\n' in text:
    target_state = target_state.replace('\n', '\r\n')
    new_state = new_state.replace('\n', '\r\n')

assert target_state in text, "target_state not found"
text = text.replace(target_state, new_state, 1)

# 2. Add handlers for Open/Close/Submit Edit OTP Email Modal
target_handlers = "  // Open Transfer History Modal"
new_handlers = """  // Open Edit Folder OTP Email Modal
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
  };

  // Open Transfer History Modal"""

if '\r\n' in text:
    target_handlers = target_handlers.replace('\n', '\r\n')
    new_handlers = new_handlers.replace('\n', '\r\n')

assert target_handlers in text, "target_handlers not found"
text = text.replace(target_handlers, new_handlers, 1)

# 3. Update Current Owner Email column with edit button
target_col = """                                  <td style={{ padding: "12px 16px" }}>
                                    <span className="text-muted" style={{ fontSize: "13px" }}>
                                      {folder.owner_email || folder.current_owner_email || '-'}
                                    </span>
                                  </td>"""

new_col = """                                  <td style={{ padding: "12px 16px" }}>
                                    <div className="d-flex align-items-center gap-2">
                                      <span className="text-dark fw-semibold" style={{ fontSize: "13px" }}>
                                        {folder.current_owner_email || folder.default_otp_email || folder.owner_email || '-'}
                                      </span>
                                      <Button
                                        variant="outline-secondary"
                                        size="xs"
                                        className="btn-xs p-1"
                                        onClick={() => handleOpenEditEmailModal(folder)}
                                        title="Edit Folder OTP Email"
                                        style={{ lineHeight: 1, borderRadius: "4px" }}
                                      >
                                        <i className="fa fa-pencil text-primary" style={{ fontSize: "11px" }}></i>
                                      </Button>
                                    </div>
                                  </td>"""

if '\r\n' in text:
    target_col = target_col.replace('\n', '\r\n')
    new_col = new_col.replace('\n', '\r\n')

assert target_col in text, "target_col not found"
text = text.replace(target_col, new_col, 1)

# 4. Insert Modal for Edit OTP Email right before Transfer Ownership Modal
target_modal = "      {/* Modal for Transfer Ownership */}"
new_modal = """      {/* Modal for Editing Folder OTP Email */}
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
      </Modal>

      {/* Modal for Transfer Ownership */}"""

if '\r\n' in text:
    target_modal = target_modal.replace('\n', '\r\n')
    new_modal = new_modal.replace('\n', '\r\n')

assert target_modal in text, "target_modal not found"
text = text.replace(target_modal, new_modal, 1)

with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("DigiLockerMapping.jsx updated with Edit OTP Email functionality successfully.")

