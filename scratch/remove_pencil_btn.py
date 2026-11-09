with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = """                                  <td style={{ padding: "12px 16px" }}>
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

replacement = """                                  <td style={{ padding: "12px 16px" }}>
                                    <span className="text-dark fw-semibold" style={{ fontSize: "13px" }}>
                                      {folder.current_owner_email || folder.default_otp_email || folder.owner_email || '-'}
                                    </span>
                                  </td>"""

if '\r\n' in text:
    target = target.replace('\n', '\r\n')
    replacement = replacement.replace('\n', '\r\n')

assert target in text, "target not found"
text = text.replace(target, replacement, 1)

with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Removed pencil button beside email successfully.")

