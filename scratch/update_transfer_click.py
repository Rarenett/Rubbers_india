with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update the Transfer button onClick to open handleOpenEditEmailModal(folder)
old_btn = """                                      <Button
                                        variant="outline-primary"
                                        size="sm"
                                        onClick={() => handleOpenTransferModal(folder)}
                                        title="Transfer Folder Ownership"
                                        style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "6px" }}
                                      >
                                        <i className="fa fa-exchange me-1"></i> Transfer
                                      </Button>"""

new_btn = """                                      <Button
                                        variant="outline-primary"
                                        size="sm"
                                        onClick={() => handleOpenEditEmailModal(folder)}
                                        title="Transfer / Update Folder OTP Email"
                                        style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "6px" }}
                                      >
                                        <i className="fa fa-exchange me-1"></i> Transfer
                                      </Button>"""

if '\r\n' in text:
    old_btn = old_btn.replace('\n', '\r\n')
    new_btn = new_btn.replace('\n', '\r\n')

assert old_btn in text, "old_btn not found"
text = text.replace(old_btn, new_btn, 1)

with open('frontend/src/jsx/components/DigiLocker/DigiLockerMapping.jsx', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Updated Transfer button in DigiLockerMapping.jsx successfully.")

