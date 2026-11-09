const fs = require('fs');

let s = fs.readFileSync('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'utf8');

// The original section starts around line 760:
// <div className="row">
//   <div className="col-12">
//     <Card ...>
// ...
//     </Card>
//   </div>
// </div>

const startMarker = '      <div className="row">\r\n        <div className="col-12">\r\n          <Card\r\n            style={{\r\n              borderRadius: "12px",\r\n              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",\r\n            }}\r\n          >';

const endMarker = '            </Card.Body>\r\n          </Card>\r\n        </div>\r\n      </div>';

// Replace that block with Tab.Container structure:
// Tab navigation with Folder Mapping and Ownership Transfer
// Tab.Pane for 'mapping' holding the exact original Card
// Tab.Pane for 'ownership_transfer' holding the ownership transfer table

// Let's verify startMarker and endMarker exist
if (!s.includes(startMarker)) {
  console.error('startMarker not found! Check CRLF / LF');
  process.exit(1);
}

if (!s.includes(endMarker)) {
  console.error('endMarker not found! Check CRLF / LF');
  process.exit(1);
}

const originalCardStartIdx = s.indexOf(startMarker);
const originalCardEndIdx = s.indexOf(endMarker) + endMarker.length;
const originalCardContent = s.substring(originalCardStartIdx, originalCardEndIdx);

const replacement = `      <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
        <Nav variant="tabs" className="mb-3">
          <Nav.Item>
            <Nav.Link eventKey="mapping" className="fw-semibold" style={{ cursor: 'pointer' }}>
              <i className="fa fa-sitemap me-2"></i> Folder Mapping
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="ownership_transfer" className="fw-semibold" style={{ cursor: 'pointer' }}>
              <i className="fa fa-exchange me-2"></i> Ownership Transfer
            </Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
          {/* TAB 1: FOLDER MAPPING */}
          <Tab.Pane eventKey="mapping">
${originalCardContent}
          </Tab.Pane>

          {/* TAB 2: OWNERSHIP TRANSFER */}
          <Tab.Pane eventKey="ownership_transfer">
            <div className="row">
              <div className="col-12">
                <Card
                  style={{
                    borderRadius: "12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                >
                  <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                      <Card.Title
                        className="mb-0 text-nowrap"
                        style={{ fontSize: "1.25rem", fontWeight: "600" }}
                      >
                        Folder Ownership Transfer
                      </Card.Title>
                      <p className="mb-0 text-muted" style={{ fontSize: "13px" }}>
                        Transfer folder ownership when employees resign or reassign responsibility for document OTP access verification
                      </p>
                    </div>

                    <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1 justify-content-end header-actions-wrapper">
                      <div
                        className="search-bar-container m-0 search-bar-wrapper"
                        style={{
                          flex: "1 1 auto",
                          minWidth: "180px",
                          maxWidth: "280px",
                        }}
                      >
                        <span className="search-icon">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                          </svg>
                        </span>
                        <input
                          type="text"
                          className="search-input"
                          placeholder="Search folder, owner, email..."
                          value={transferSearchTerm}
                          onChange={(e) => {
                            setTransferSearchTerm(e.target.value);
                            setTransferCurrentPage(1);
                          }}
                          style={{
                            width: "100%",
                            padding: "6px 10px 6px 32px",
                            fontSize: "13px",
                            border: "1px solid #dee2e6",
                            borderRadius: "6px",
                          }}
                        />
                      </div>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={fetchFolders}
                        title="Refresh folders"
                        style={{ borderRadius: "6px" }}
                      >
                        <i className="fa fa-refresh me-1"></i> Refresh
                      </Button>
                    </div>
                  </Card.Header>

                  <Card.Body className="p-0">
                    <div className="table-responsive">
                      <table className="table table-hover mb-0">
                        <thead className="bg-light">
                          <tr>
                            <th style={{ width: "60px", padding: "12px 16px" }}>Sl. No.</th>
                            <th style={{ padding: "12px 16px" }}>Folder Name</th>
                            <th style={{ padding: "12px 16px" }}>Current Owner</th>
                            <th style={{ padding: "12px 16px" }}>Current Owner Email</th>
                            <th style={{ padding: "12px 16px" }}>New Owner</th>
                            <th style={{ padding: "12px 16px" }}>New Owner Email</th>
                            <th style={{ padding: "12px 16px" }}>Transfer Date</th>
                            <th style={{ width: "180px", textAlign: "right", padding: "12px 16px" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentTransferFolders.length === 0 ? (
                            <tr>
                              <td colSpan="8" className="text-center py-4 text-muted">
                                {transferSearchTerm ? "No folders found matching your search." : "No folders available."}
                              </td>
                            </tr>
                          ) : (
                            currentTransferFolders.map((folder, index) => {
                              const latestTransfer = folder.latest_transfer;
                              return (
                                <tr key={folder.id} style={{ verticalAlign: "middle" }}>
                                  <td style={{ padding: "12px 16px" }}>
                                    {transferIndexOfFirst + index + 1}
                                  </td>
                                  <td style={{ padding: "12px 16px" }}>
                                    <div className="d-flex align-items-center">
                                      <i className="fa fa-folder text-warning me-2" style={{ fontSize: "16px" }}></i>
                                      <div>
                                        <span className="fw-semibold text-dark">{folder.name}</span>
                                        {folder.folder_type === "personal" && (
                                          <Badge bg="info" className="ms-2" style={{ fontSize: "10px" }}>
                                            Personal
                                          </Badge>
                                        )}
                                        <div className="text-muted" style={{ fontSize: "11px" }}>
                                          {folder.documents_count || 0} document{(folder.documents_count || 0) === 1 ? '' : 's'}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: "12px 16px" }}>
                                    <span className="fw-semibold text-dark">
                                      {folder.owner_name || folder.current_owner_name || '-'}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 16px" }}>
                                    <span className="text-muted" style={{ fontSize: "13px" }}>
                                      {folder.owner_email || folder.current_owner_email || '-'}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 16px" }}>
                                    {latestTransfer ? (
                                      <span className="fw-semibold text-primary">
                                        {latestTransfer.new_owner_name}
                                      </span>
                                    ) : (
                                      <span className="text-muted">-</span>
                                    )}
                                  </td>
                                  <td style={{ padding: "12px 16px" }}>
                                    {latestTransfer ? (
                                      <span className="text-muted" style={{ fontSize: "13px" }}>
                                        {latestTransfer.new_owner_email}
                                      </span>
                                    ) : (
                                      <span className="text-muted">-</span>
                                    )}
                                  </td>
                                  <td style={{ padding: "12px 16px" }}>
                                    {latestTransfer?.transfer_date ? (
                                      <span style={{ fontSize: "12px" }}>
                                        {new Date(latestTransfer.transfer_date).toLocaleString([], {
                                          year: 'numeric',
                                          month: 'short',
                                          day: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </span>
                                    ) : (
                                      <span className="text-muted">-</span>
                                    )}
                                  </td>
                                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                    <div className="d-flex justify-content-end align-items-center gap-1">
                                      <Button
                                        variant="outline-primary"
                                        size="sm"
                                        onClick={() => handleOpenTransferModal(folder)}
                                        title="Transfer Folder Ownership"
                                        style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "6px" }}
                                      >
                                        <i className="fa fa-exchange me-1"></i> Transfer
                                      </Button>
                                      <Button
                                        variant="outline-secondary"
                                        size="sm"
                                        onClick={() => handleOpenHistoryModal(folder)}
                                        title="View Ownership Transfer History"
                                        style={{ fontSize: "12px", padding: "4px 8px", borderRadius: "6px" }}
                                      >
                                        <i className="fa fa-history"></i>
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {filteredTransferFolders.length > 0 && (
                      <Pagination
                        currentPage={transferCurrentPage}
                        setCurrentPage={setTransferCurrentPage}
                        totalPages={transferTotalPages}
                        indexOfFirst={transferIndexOfFirst}
                        indexOfLast={transferIndexOfLast}
                        totalRecords={filteredTransferFolders.length}
                        loading={false}
                      />
                    )}
                  </Card.Body>
                </Card>
              </div>
            </div>
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>`;

s = s.substring(0, originalCardStartIdx) + replacement + s.substring(originalCardEndIdx);

// Append the Transfer Modal and Transfer History Modal right before closing </div>;
const closingPoint = '      {/* Modal for Folder Mapping */}\r\n      <Modal show={showModal} onHide={handleCloseModal} size="lg" centered>';

const modalsToAdd = `      {/* Modal for Transfer Ownership */}
      <Modal show={showTransferModal} onHide={handleCloseTransferModal} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: "16px", fontWeight: "600" }}>
            <i className="fa fa-exchange text-primary me-2"></i> Transfer Folder Ownership
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitTransfer}>
          <Modal.Body>
            <div className="mb-3">
              <Form.Label className="fw-semibold small">Folder Name</Form.Label>
              <Form.Control
                type="text"
                value={selectedFolderToTransfer?.name || ''}
                readOnly
                disabled
                className="bg-light"
              />
            </div>

            <Row className="mb-3">
              <div className="col-md-6">
                <Form.Label className="fw-semibold small">Current Owner</Form.Label>
                <Form.Control
                  type="text"
                  value={selectedFolderToTransfer?.owner_name || selectedFolderToTransfer?.current_owner_name || '-'}
                  readOnly
                  disabled
                  className="bg-light"
                />
              </div>
              <div className="col-md-6">
                <Form.Label className="fw-semibold small">Current Owner Email</Form.Label>
                <Form.Control
                  type="text"
                  value={selectedFolderToTransfer?.owner_email || selectedFolderToTransfer?.current_owner_email || '-'}
                  readOnly
                  disabled
                  className="bg-light"
                />
              </div>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">
                New Owner <span className="text-danger">*</span>
              </Form.Label>
              <Form.Select
                value={newOwnerEmployeeId}
                onChange={handleNewOwnerChange}
                required
              >
                <option value="">-- Select Active Employee --</option>
                {activeEmployees
                  .filter((emp) => {
                    // Exclude current owner if matched by username or email
                    const currentEmail = selectedFolderToTransfer?.owner_email || selectedFolderToTransfer?.current_owner_email;
                    const empEmail = emp.email || emp.user_email || emp.work_email || emp.candidate?.email;
                    if (currentEmail && empEmail && currentEmail.toLowerCase() === empEmail.toLowerCase()) {
                      return false;
                    }
                    return true;
                  })
                  .map((emp) => {
                    const empName = emp.full_name || emp.employee_name || emp.candidate?.full_name || ('Employee #' + emp.id);
                    const empCode = emp.emp_code || ('EMP-' + emp.id);
                    return (
                      <option key={emp.id} value={emp.id}>
                        {empName} ({empCode})
                      </option>
                    );
                  })}
              </Form.Select>
              <Form.Text className="text-muted" style={{ fontSize: "11px" }}>
                Only active employees are eligible to become folder owners.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">New Owner Email</Form.Label>
              <Form.Control
                type="email"
                value={newOwnerEmail}
                readOnly
                placeholder="Automatically populated upon employee selection"
                className="bg-light"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">
                Transfer Reason <span className="text-muted">(Optional)</span>
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="e.g. Employee resignation, role change, handover..."
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
              />
            </Form.Group>

            <div className="alert alert-info py-2 px-3 mb-0" style={{ fontSize: "12px" }}>
              <i className="fa fa-info-circle me-1"></i>
              <strong>Notice:</strong> When ownership is transferred, all subsequent OTP requests for document access verification will be sent to the new owner. Existing document uploaders, mappings, and permissions will remain unchanged.
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="danger light" size="sm" onClick={handleCloseTransferModal} disabled={transferSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={transferSubmitting || !newOwnerEmployeeId}
              style={{
                backgroundColor: "rgb(61, 53, 119)",
                borderColor: "rgb(61, 53, 119)",
              }}
            >
              {transferSubmitting ? "Transferring..." : "Transfer Ownership"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal for Ownership History */}
      <Modal show={showHistoryModal} onHide={() => setShowHistoryModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: "16px", fontWeight: "600" }}>
            <i className="fa fa-history text-secondary me-2"></i> Ownership Transfer History: {selectedFolderForHistory?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          {loadingHistory ? (
            <div className="text-center py-4 text-muted">
              <div className="spinner-border spinner-border-sm me-2 text-primary" role="status"></div>
              Loading transfer history...
            </div>
          ) : folderHistoryList.length === 0 ? (
            <div className="text-center py-4 text-muted">
              No ownership transfers recorded for this folder.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0">
                <thead className="bg-light">
                  <tr>
                    <th style={{ padding: "10px 14px" }}>#</th>
                    <th style={{ padding: "10px 14px" }}>Previous Owner</th>
                    <th style={{ padding: "10px 14px" }}>New Owner</th>
                    <th style={{ padding: "10px 14px" }}>Transferred By</th>
                    <th style={{ padding: "10px 14px" }}>Reason</th>
                    <th style={{ padding: "10px 14px" }}>Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {folderHistoryList.map((hist, idx) => (
                    <tr key={hist.id}>
                      <td style={{ padding: "10px 14px" }}>{idx + 1}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <div className="fw-semibold text-dark">{hist.previous_owner_name}</div>
                        <div className="text-muted small">{hist.previous_owner_email || '-'}</div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div className="fw-semibold text-primary">{hist.new_owner_name}</div>
                        <div className="text-muted small">{hist.new_owner_email || '-'}</div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>{hist.transferred_by_name}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span className="text-muted">{hist.transfer_reason || '-'}</span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {hist.transfer_date ? new Date(hist.transfer_date).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowHistoryModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

`;

if (!s.includes(closingPoint)) {
  console.error('closingPoint not found! Check CRLF');
  process.exit(1);
}

s = s.replace(closingPoint, modalsToAdd + closingPoint);

fs.writeFileSync('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', s, 'utf8');
console.log('Successfully updated DigiLockerMapping.jsx with two tabs and modals!');

