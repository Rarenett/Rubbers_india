import re

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', encoding='utf-8') as f:
    content = f.read()

# 1. Add Teams button
old_buttons = """                                    <button 
                                        className={`btn btn-sm ${activeView === 'projects' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setActiveView('projects')}
                                    >
                                        <i className="fa fa-tasks me-1"></i> Projects
                                    </button>
                                    <button """
new_buttons = """                                    <button 
                                        className={`btn btn-sm ${activeView === 'projects' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setActiveView('projects')}
                                    >
                                        <i className="fa fa-tasks me-1"></i> Projects
                                    </button>
                                    <button 
                                        className={`btn btn-sm ${activeView === 'teams' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setActiveView('teams')}
                                    >
                                        <i className="fa fa-users-cog me-1"></i> Teams
                                    </button>
                                    <button """
content = content.replace(old_buttons, new_buttons)

# 2. Add Teams view rendering
old_render = """                                {activeView === 'leads' && ("""
new_render = """                                {activeView === 'teams' && (
                                    <div className="table-responsive">
                                        <table className="table table-bordered table-striped table-hover mb-0">
                                            <thead className="table-primary">
                                                <tr>
                                                    <th>Sl. No.</th>
                                                    <th>Team Name</th>
                                                    <th>Team Members</th>
                                                    <th>Assigned Leads</th>
                                                    <th>Repositories</th>
                                                    <th>Created Date</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td colSpan="7" className="text-center text-muted py-4">No teams created yet.</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {activeView === 'leads' && ("""
content = content.replace(old_render, new_render)

# 3. Simulate clear on save
old_save_alert = """Swal.fire({
                                    icon: 'error',
                                    title: 'Backend Unavailable',
                                    text: 'Team creation could not be completed because the TelecallingTeam and TelecallingLeadAssignment Django models do not currently exist in the database. Please request a backend migration first.',
                                    confirmButtonColor: '#d33',
                                });"""
new_save_alert = """Swal.fire({
                                    icon: 'error',
                                    title: 'Backend Unavailable',
                                    text: 'Team creation could not be completed because the TelecallingTeam and TelecallingLeadAssignment Django models do not currently exist in the database. Please request a backend migration first.',
                                    confirmButtonColor: '#d33',
                                }).then((result) => {
                                    if (result.isConfirmed) {
                                        // TODO: Uncomment when backend is ready to clear selection on success
                                        // setSelectedLeads([]);
                                        // setShowTeamModal(false);
                                    }
                                });"""
content = content.replace(old_save_alert, new_save_alert)

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Added Teams button and view")
