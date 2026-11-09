with open('frontend/src/jsx/components/DigiLocker/UploadFiles.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. State for Edit Approval Request modal
old_state_anchor = "  const [actionLoadingId, setActionLoadingId] = useState(null);"
new_state_anchor = """  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Request Edit Approval Modal State
  const [showRequestEditModal, setShowRequestEditModal] = useState(false);
  const [requestEditDoc, setRequestEditDoc] = useState(null);
  const [requestEditReason, setRequestEditReason] = useState("");
  const [requestEditLoading, setRequestEditLoading] = useState(false);"""

assert old_state_anchor in text, "old_state_anchor not found"
text = text.replace(old_state_anchor, new_state_anchor, 1)

# 2. Handlers for requesting edit
handler_code = """
  const handleOpenRequestEditModal = (doc) => {
    setRequestEditDoc(doc);
    setRequestEditReason("");
    setShowRequestEditModal(true);
  };

  const handleSubmitRequestEdit = async (e) => {
    e.preventDefault();
    if (!requestEditDoc) return;
    setRequestEditLoading(true);
    try {
      await DigiLockerService.requestEditApproval(requestEditDoc.id, {
        reason: requestEditReason.trim(),
      });
      swal("Request Submitted", "Your edit approval request has been submitted to the administrator.", "success");
      setShowRequestEditModal(false);
      fetchDocuments();
    } catch (err) {
      console.error("Error requesting edit approval:", err);
      const errMsg = err.response?.data?.error || "Failed to submit edit request.";
      swal("Error", errMsg, "error");
    } finally {
      setRequestEditLoading(false);
    }
  };

  const getApprovalBadge = (status, rejectionReason) => {
    const s = (status || "").toLowerCase();
    if (s === "approved") {
      return (
        <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
          <i className="fa fa-check-circle me-1"></i>Approved
        </span>
      );
    }
    if (s === "rejected") {
      return (
        <div>
          <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">
            <i className="fa fa-times-circle me-1"></i>Rejected
          </span>
          {rejectionReason && (
            <div className="text-danger small mt-1" style={{ fontSize: "11px", maxWidth: "180px" }}>
              <i className="fa fa-info-circle me-1"></i>
              {rejectionReason}
            </div>
          )}
        </div>
      );
    }
    return (
      <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1">
        <i className="fa fa-clock-o me-1"></i>Pending
      </span>
    );
  };
"""

# Place after fetchDocuments
fetch_docs_anchor = """  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await DigiLockerService.getDocuments();
      const data = res.data;
      setDocuments(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error("Error fetching documents:", err);
      swal("Error", "Failed to fetch uploaded documents.", "error");
    } finally {
      setLoading(false);
    }
  };"""

assert fetch_docs_anchor in text, "fetch_docs_anchor not found"
text = text.replace(fetch_docs_anchor, fetch_docs_anchor + "\n" + handler_code, 1)

# 3. Table Header: Add APPROVAL STATUS column
old_thead = """                        <th>
                          <strong>UPLOADED DATE</strong>
                        </th>
                        <th className="text-end">
                          <strong>ACTIONS</strong>
                        </th>"""

new_thead = """                        <th>
                          <strong>UPLOADED DATE</strong>
                        </th>
                        <th>
                          <strong>APPROVAL STATUS</strong>
                        </th>
                        <th className="text-end">
                          <strong>ACTIONS</strong>
                        </th>"""

assert old_thead in text, "old_thead not found"
text = text.replace(old_thead, new_thead, 1)

# 4. Table Row: Add APPROVAL STATUS and update ACTIONS
old_row_action = """                            <td>
                              {doc.uploaded_at
                                ? new Date(doc.uploaded_at).toLocaleString()
                                : "-"}
                            </td>
                            <td className="text-end">
                              <div className="d-flex justify-content-end align-items-center gap-1">
                                <EditButton
                                  onClick={() => handleOpenEditModal(doc)}
                                  title="Edit Document"
                                />
                                <DeleteButton
                                  onClick={() => handleDeleteDocument(doc)}
                                  title="Delete Document"
                                />
                              </div>
                            </td>"""

new_row_action = """                            <td>
                              {doc.uploaded_at
                                ? new Date(doc.uploaded_at).toLocaleString()
                                : "-"}
                            </td>
                            <td>
                              {getApprovalBadge(doc.approval_status, doc.rejection_reason)}
                            </td>
                            <td className="text-end">
                              <div className="d-flex justify-content-end align-items-center gap-1">
                                {doc.approval_status === "approved" && !doc.can_edit ? (
                                  doc.latest_edit_request?.status === "pending" ? (
                                    <span
                                      className="badge bg-warning-subtle text-dark border border-warning"
                                      style={{ fontSize: "11px" }}
                                      title="Waiting for administrator to approve your edit request"
                                    >
                                      <i className="fa fa-clock-o me-1"></i>Pending Edit
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-warning shadow-sm d-flex align-items-center gap-1"
                                      style={{ fontSize: "11px", padding: "4px 8px" }}
                                      onClick={() => handleOpenRequestEditModal(doc)}
                                      title="Request permission from admin to edit/replace this approved document"
                                    >
                                      <i className="fa fa-key"></i> Request Edit
                                    </button>
                                  )
                                ) : (
                                  <EditButton
                                    onClick={() => handleOpenEditModal(doc)}
                                    title={doc.approval_status === 'approved' && doc.can_edit ? "Edit Approved Document" : "Edit Document"}
                                  />
                                )}
                                <DeleteButton
                                  onClick={() => handleDeleteDocument(doc)}
                                  title="Delete Document"
                                  disabled={doc.approval_status === "approved"}
                                />
                              </div>
                            </td>"""

assert old_row_action in text, "old_row_action not found"
text = text.replace(old_row_action, new_row_action, 1)

# Update colSpan for empty table from 8 to 9
old_colspan = '<td\n                            colSpan="8"\n                            className="text-center py-4 text-muted"\n                          >'
new_colspan = '<td\n                            colSpan="9"\n                            className="text-center py-4 text-muted"\n                          >'
text = text.replace(old_colspan, new_colspan, 1)

# 5. Add Request Edit Modal right before the end of the return statement
request_edit_modal_jsx = """
      {/* Request Edit Approval Modal */}
      <Modal
        show={showRequestEditModal}
        onHide={() => setShowRequestEditModal(false)}
        centered
      >
        <Form onSubmit={handleSubmitRequestEdit}>
          <Modal.Header closeButton>
            <Modal.Title className="h6 fw-bold">
              <i className="fa fa-key text-warning me-2"></i> Request Edit Approval
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="alert alert-info py-2 px-3 small mb-3">
              <i className="fa fa-info-circle me-1"></i>
              This document is <strong>Approved</strong> and locked. Please enter a reason explaining why you need to edit or replace this document. An administrator will review your request.
            </div>
            <div className="mb-2">
              <span className="text-muted small">Document:</span>{" "}
              <strong>{requestEditDoc?.original_filename}</strong>
            </div>
            <div className="mb-3">
              <span className="text-muted small">Folder:</span>{" "}
              <span className="badge bg-light text-dark border">{requestEditDoc?.folder_name}</span>
            </div>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">
                Reason for Edit Request (Optional):
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="e.g. Upload updated certificate, rectify typographical error in metadata..."
                value={requestEditReason}
                onChange={(e) => setRequestEditReason(e.target.value)}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="light"
              onClick={() => setShowRequestEditModal(false)}
              disabled={requestEditLoading}
            >
              Cancel
            </Button>
            <Button
              variant="warning"
              type="submit"
              disabled={requestEditLoading}
            >
              {requestEditLoading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
"""

modal_anchor = "      {/* Document Preview Modal */}"
assert modal_anchor in text, "modal_anchor not found"
text = text.replace(modal_anchor, request_edit_modal_jsx + "\n      {/* Document Preview Modal */}", 1)

with open('frontend/src/jsx/components/DigiLocker/UploadFiles.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("UploadFiles.jsx updated successfully.")

