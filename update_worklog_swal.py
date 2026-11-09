import datetime
log_entry = '''
### 🎨 Improvement: Replaced Native Alerts with SweetAlert2
**Files:** `frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx`

- Imported `sweetalert2` as `Swal` at the top of the file to replace native browser popups with consistent styled modals.
- Replaced the native `alert` blocking empty team creation ("Please select at least one lead...") with a properly styled `Swal.fire` warning.
- Replaced the placeholder backend saving `alert` ("Backend saving not yet implemented!") with a highly descriptive `Swal.fire` error explaining that the database models (`TelecallingTeam`, `TelecallingLeadAssignment`) must be created first before saving is possible.
- Adhered strictly to the requirement of not faking success states when the backend is incomplete, showing genuine blockers gracefully instead.
'''
try:
    with open('WORKLOG.md', 'r', encoding='utf-8') as f:
        content = f.read()
    if '*Last updated*' in content:
        content = content[:content.rfind('*Last updated*')]
    with open('WORKLOG.md', 'w', encoding='utf-8') as f:
        f.write(content.strip() + '\n' + log_entry + '\n*Last updated: ' + datetime.datetime.now().strftime('%Y-%m-%d %H:%M') + ' IST*\n')
except FileNotFoundError:
    pass
