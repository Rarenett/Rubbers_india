with open('backend/digilocker_app/views.py', 'r', encoding='utf-8') as f:
    text = f.read()

# 4. Update DigiLockerPreviewDocumentView
old_preview = """            # Direct preview without OTP is strictly reserved for authorized administrators
            can_view_direct = is_admin

            if not can_view_direct:
                return HttpResponse("Access Denied: OTP verification is required to view this document.", status=403)"""

new_preview = """            # Direct preview without OTP is permitted for authorized administrators or when view_otp_required is False
            can_view_direct = is_admin or not perms.get('view_otp_required', True)

            if not can_view_direct:
                return HttpResponse("Access Denied: OTP verification is required to view this document.", status=403)"""

# 5. Update DigiLockerDownloadDocumentView
old_download = """            # Direct download without OTP is strictly reserved for authorized administrators
            can_dl_direct = is_admin

            if not can_dl_direct:
                return HttpResponse("Access Denied: OTP verification is required to download this document.", status=403)"""

new_download = """            # Direct download without OTP is permitted for authorized administrators or when download_otp_required is False
            can_dl_direct = is_admin or not perms.get('download_otp_required', True)

            if not can_dl_direct:
                return HttpResponse("Access Denied: OTP verification is required to download this document.", status=403)"""

if '\r\n' in text:
    old_preview = old_preview.replace('\n', '\r\n')
    new_preview = new_preview.replace('\n', '\r\n')
    old_download = old_download.replace('\n', '\r\n')
    new_download = new_download.replace('\n', '\r\n')

assert old_preview in text, "old_preview not found"
text = text.replace(old_preview, new_preview, 1)

assert old_download in text, "old_download not found"
text = text.replace(old_download, new_download, 1)

with open('backend/digilocker_app/views.py', 'w', encoding='utf-8', newline='') as f:
    f.write(text)

print("Step 4 & 5 (Preview and Download direct checks) updated successfully.")

