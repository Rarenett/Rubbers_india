with open('frontend/src/jsx/components/DigiLocker/DigiLockerAccess.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update handleInitiateAccess:
# Only bypass OTP if docItem.requires_otp === false (which only backend sets for admin users).
old_initiate = '''  // Request OTP for View or Download
  const handleInitiateAccess = async (docItem, operation) => {
    // If the logged-in user is the owner of the document, direct access with no OTP
    if (docItem.is_owner === true || docItem.requires_otp === false) {'''

new_initiate = '''  // Request OTP for View or Download
  const handleInitiateAccess = async (docItem, operation) => {
    // Direct access with no OTP is granted strictly when requires_otp is false (e.g. administrator bypass)
    // All regular employees must complete OTP verification regardless of folder creation or ownership
    if (docItem.requires_otp === false) {'''

assert old_initiate in content, "old_initiate not found in DigiLockerAccess.jsx"
content = content.replace(old_initiate, new_initiate)

# 2. Update renderDocumentRow:
old_render_row = '''                          <td>
                            {isOther ? (
                              <span className="badge light badge-secondary" style={{ fontSize: "11px" }}>
                                <i className="fa fa-user me-1"></i>
                                {doc.owner_name}
                              </span>
                            ) : (
                              <span className="badge light badge-success" style={{ fontSize: "11px" }}>
                                <i className="fa fa-user-check me-1"></i>
                                You (Owner)
                              </span>
                            )}
                          </td>
                          <td>{doc.file_size_display}</td>
                          <td>
                            {doc.uploaded_at
                              ? new Date(doc.uploaded_at).toLocaleDateString()
                              : "-"}
                          </td>
                          <td>
                            {!isOther ? (
                              <span
                                className="badge light badge-success"
                                style={{ fontSize: "11px" }}
                              >
                                <i className="fa fa-unlock me-1"></i>
                                Direct Access (No OTP)
                              </span>
                            ) : (
                              <span
                                className="badge light badge-warning"
                                style={{ fontSize: "11px" }}
                              >
                                <i className="fa fa-lock me-1"></i>
                                Protected (Owner OTP Required)
                              </span>
                            )}
                          </td>'''

new_render_row = '''                          <td>
                            <span className="badge light badge-secondary" style={{ fontSize: "11px" }}>
                              <i className="fa fa-user me-1"></i>
                              {doc.owner_name}
                            </span>
                          </td>
                          <td>{doc.file_size_display}</td>
                          <td>
                            {doc.uploaded_at
                              ? new Date(doc.uploaded_at).toLocaleDateString()
                              : "-"}
                          </td>
                          <td>
                            {!doc.requires_otp ? (
                              <span
                                className="badge light badge-success"
                                style={{ fontSize: "11px" }}
                              >
                                <i className="fa fa-unlock me-1"></i>
                                Direct Admin Access
                              </span>
                            ) : (
                              <span
                                className="badge light badge-warning"
                                style={{ fontSize: "11px" }}
                              >
                                <i className="fa fa-lock me-1"></i>
                                Protected (OTP Required)
                              </span>
                            )}
                          </td>'''

assert old_render_row in content, "old_render_row not found in DigiLockerAccess.jsx"
content = content.replace(old_render_row, new_render_row)

# 3. Update title tags on buttons:
old_btns = '''                                  title={isOther ? `Request OTP from ${doc.owner_name} to view` : "View Document"}
                                >
                                  <i className="fa fa-eye"></i>
                                  <span>View</span>
                                </button>
                              )}
                              {doc.can_download && (
                                <button
                                  type="button"
                                  className="btn btn-outline-primary shadow btn-sm d-inline-flex align-items-center gap-1"
                                  onClick={() => handleInitiateAccess(doc, "download")}
                                  disabled={otpRequestLoading}
                                  style={{
                                    height: "32px",
                                    padding: "0 12px",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                  }}
                                  title={isOther ? `Request OTP from ${doc.owner_name} to download` : "Download Document"}'''

new_btns = '''                                  title={doc.requires_otp ? "Verify OTP to view document" : "View Document"}
                                >
                                  <i className="fa fa-eye"></i>
                                  <span>View</span>
                                </button>
                              )}
                              {doc.can_download && (
                                <button
                                  type="button"
                                  className="btn btn-outline-primary shadow btn-sm d-inline-flex align-items-center gap-1"
                                  onClick={() => handleInitiateAccess(doc, "download")}
                                  disabled={otpRequestLoading}
                                  style={{
                                    height: "32px",
                                    padding: "0 12px",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                  }}
                                  title={doc.requires_otp ? "Verify OTP to download document" : "Download Document"}'''

assert old_btns in content, "old_btns not found in DigiLockerAccess.jsx"
content = content.replace(old_btns, new_btns)

# 4. Update the My Documents header badge:
old_header_badge = '''                                      <span className="badge light badge-success" style={{ fontSize: "11px" }}>
                                        Direct Access
                                      </span>'''

new_header_badge = '''                                      <span className="badge light badge-info" style={{ fontSize: "11px" }}>
                                        <i className="fa fa-id-card me-1"></i> Mapped Documents
                                      </span>'''

assert old_header_badge in content, "old_header_badge not found in DigiLockerAccess.jsx"
content = content.replace(old_header_badge, new_header_badge)

with open('frontend/src/jsx/components/DigiLocker/DigiLockerAccess.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated frontend/src/jsx/components/DigiLocker/DigiLockerAccess.jsx!")

