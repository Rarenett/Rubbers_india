import re

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', encoding='utf-8') as f:
    content = f.read()

old_alert = """Swal.fire({
                                    icon: 'error',
                                    title: 'Backend Unavailable',
                                    text: 'Team creation failed. Backend migrations are required.',
                                    confirmButtonColor: '#d33',
                                    confirmButtonText: 'OK',
                                    width: '300px',
                                    padding: '1rem',
                                    customClass: {
                                        title: 'fs-5'
                                    }
                                })"""

new_alert = """Swal.fire({
                                    icon: 'error',
                                    title: '<span style="font-size: 1.25rem;">Backend Unavailable</span>',
                                    html: '<span style="font-size: 0.85rem; line-height: 1.2;">Team creation failed.<br/>Backend migrations are required.</span>',
                                    confirmButtonColor: '#d33',
                                    confirmButtonText: 'OK',
                                    customClass: {
                                        confirmButton: 'btn btn-sm px-4',
                                        icon: 'mt-3 mb-2'
                                    }
                                })"""

content = content.replace(old_alert, new_alert)

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated sweetalert to original width but compact content")
