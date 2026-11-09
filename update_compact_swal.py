import re

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', encoding='utf-8') as f:
    content = f.read()

old_alert = """Swal.fire({
                                    icon: 'error',
                                    title: 'Backend Unavailable',
                                    text: 'Team creation could not be completed because the TelecallingTeam and TelecallingLeadAssignment Django models do not currently exist in the database. Please request a backend migration first.',
                                    confirmButtonColor: '#d33',
                                })"""

new_alert = """console.error("Team creation could not be completed because the TelecallingTeam and TelecallingLeadAssignment Django models do not currently exist in the database.");
                                Swal.fire({
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
content = content.replace(old_alert, new_alert)

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated sweetalert to be compact")
