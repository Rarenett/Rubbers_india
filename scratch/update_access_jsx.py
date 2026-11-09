with open('frontend/src/jsx/components/DigiLocker/DigiLockerAccess.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the bypass condition in handleInitiateAccess
old_bypass = """  const handleInitiateAccess = async (docItem, operation) => {
    // Direct access with no OTP is granted strictly when requires_otp is false (e.g. administrator bypass)
    // All regular employees must complete OTP verification regardless of folder creation or ownership
    if (docItem.requires_otp === false) {"""

new_bypass = """  const handleInitiateAccess = async (docItem, operation) => {
    // Check whether OTP is required for this specific operation
    const requiresOtpForOperation = operation === "view"
      ? (docItem.view_otp_required !== undefined ? docItem.view_otp_required : docItem.requires_otp !== false)
      : (docItem.download_otp_required !== undefined ? docItem.download_otp_required : docItem.requires_otp !== false);

    if (!requiresOtpForOperation) {"""

if old_bypass not in text and old_bypass.replace('\n', '\r\n') in text:
    old_bypass = old_bypass.replace('\n', '\r\n')
    new_bypass = new_bypass.replace('\n', '\r\n')

assert old_bypass in text, "old_bypass not found"
text = text.replace(old_bypass, new_bypass, 1)

with open('frontend/src/jsx/components/DigiLocker/DigiLockerAccess.jsx', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("DigiLockerAccess.jsx updated successfully.")

