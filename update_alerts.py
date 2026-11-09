import re

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', encoding='utf-8') as f:
    content = f.read()

# 1. Add import Swal from 'sweetalert2'
import_swal = "import Swal from 'sweetalert2';\n"
if "import Swal from 'sweetalert2';" not in content:
    content = content.replace("import React, { useState, useEffect } from 'react';", "import React, { useState, useEffect } from 'react';\n" + import_swal)

# 2. Replace empty selection alert
old_alert = """                                            if (selectedLeads.length === 0) {
                                                alert("Please select at least one lead to create a team.");
                                            } else {"""
new_alert = """                                            if (selectedLeads.length === 0) {
                                                Swal.fire({
                                                    icon: 'warning',
                                                    title: 'No Leads Selected',
                                                    text: 'Please select at least one lead to create a team.',
                                                    confirmButtonColor: '#3085d6',
                                                });
                                            } else {"""
content = content.replace(old_alert, new_alert)

# 3. Replace backend saving alert
old_save_alert = """<Button variant="success" onClick={() => alert("Backend saving not yet implemented!")}>Create Team</Button>"""
new_save_alert = """<Button variant="success" onClick={() => {
                                Swal.fire({
                                    icon: 'error',
                                    title: 'Backend Unavailable',
                                    text: 'Team creation could not be completed because the TelecallingTeam and TelecallingLeadAssignment Django models do not currently exist in the database. Please request a backend migration first.',
                                    confirmButtonColor: '#d33',
                                });
                            }}>Create Team</Button>"""
content = content.replace(old_save_alert, new_save_alert)

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated alerts to SweetAlert2")
