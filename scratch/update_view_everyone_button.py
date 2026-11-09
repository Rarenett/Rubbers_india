with open('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the button render to remove `{isAdmin && (` check so everyone can view and click the button
old_button_block = '''                {isAdmin && (
                  <Button
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
                )}'''

new_button_block = '''                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={handleOpenSettingsModal}
                  title="View / Configure Centralized Default OTP Email"
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
                </Button>'''

assert old_button_block in content, "old_button_block not found in FolderCreation.jsx"
content = content.replace(old_button_block, new_button_block)

# 2. Update the modal title and contents so it displays clearly for everyone, and if an ordinary employee opens it, it explains whether they have edit rights or can save if permitted
old_modal_title = '''          <Modal.Title style={{ fontSize: '16px', fontWeight: '600' }}>
            <i className="fa fa-envelope text-primary me-2"></i> Configure Default OTP Email
          </Modal.Title>'''

new_modal_title = '''          <Modal.Title style={{ fontSize: '16px', fontWeight: '600' }}>
            <i className="fa fa-envelope text-primary me-2"></i> Central Default OTP Email Configuration
          </Modal.Title>'''

assert old_modal_title in content, "old_modal_title not found in FolderCreation.jsx"
content = content.replace(old_modal_title, new_modal_title)

# Update modal body inputs to be read-only for non-admins if they don't have permission, or let admins save
old_modal_body = '''            <Form.Group className="mb-3">
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
            </Form.Group>'''

new_modal_body = '''            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">
                Default OTP Email Address <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="email"
                required
                readOnly={!isAdmin}
                disabled={!isAdmin}
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
                readOnly={!isAdmin}
                disabled={!isAdmin}
                placeholder="e.g. +91 9876543210"
                value={editingDefaultPhone}
                onChange={(e) => setEditingDefaultPhone(e.target.value)}
              />
              <Form.Text className="text-muted" style={{ fontSize: '11px' }}>
                Default contact phone number auto-populated when creating new folders.
              </Form.Text>
            </Form.Group>'''

assert old_modal_body in content, "old_modal_body not found in FolderCreation.jsx"
content = content.replace(old_modal_body, new_modal_body)

# Update footer so if non-admin, they see "Close" instead of disabled save
old_modal_footer = '''          <Modal.Footer>
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
          </Modal.Footer>'''

new_modal_footer = '''          <Modal.Footer>
            <Button variant="secondary" size="sm" onClick={() => setShowSettingsModal(false)} disabled={savingSettings}>
              {isAdmin ? "Cancel" : "Close"}
            </Button>
            {isAdmin && (
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
            )}
          </Modal.Footer>'''

assert old_modal_footer in content, "old_modal_footer not found in FolderCreation.jsx"
content = content.replace(old_modal_footer, new_modal_footer)

with open('frontend/src/jsx/components/DigiLocker/FolderCreation.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated FolderCreation.jsx to make 'Set Default OTP Email' button viewable by everyone!")

