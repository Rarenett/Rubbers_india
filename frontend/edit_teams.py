import re

file_path = r"c:\Archana\glenda_vite\frontend\src\jsx\components\crm_new\TeleCallingDashboard.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add imports for EditButton and DeleteButton
if "import EditButton" not in content:
    content = content.replace("import { Row, Col, Card, Form, Button, Modal, Dropdown } from 'react-bootstrap';", 
                              "import { Row, Col, Card, Form, Button, Modal, Dropdown } from 'react-bootstrap';\nimport EditButton from '../../../components/permissions/EditButton';\nimport DeleteButton from '../../../components/permissions/DeleteButton';")

# 2. Add editingTeamId state
if "const [editingTeamId, setEditingTeamId] = useState(null);" not in content:
    content = re.sub(r"const \[teamName, setTeamName\] = useState\(''\);", 
                     "const [teamName, setTeamName] = useState('');\n    const [editingTeamId, setEditingTeamId] = useState(null);", content)

# 3. Add handleEditTeam function
handle_edit_team = """
    const handleEditTeam = (proj) => {
        setTeamName(proj.name);
        const mappedLeads = (proj.leads || []).map(assignment => assignment.lead_details).filter(Boolean);
        setSelectedLeads(mappedLeads);
        setEditingTeamId(proj.id.split('_')[1]);
        setShowTeamModal(true);
    };
"""
if "const handleEditTeam" not in content:
    content = content.replace("const handleEditSubmit = async () => {", handle_edit_team + "\n    const handleEditSubmit = async () => {")

# 4. Replace Action Buttons
old_actions_regex = r"<div className=\"d-flex\">\s*<Button\s*variant=\"primary\".*?<i className=\"fa fa-eye\"></i>\s*</Button>\s*<Button\s*variant=\"secondary\".*?<i className=\"fa fa-pencil-alt\"></i>\s*</Button>\s*<Button\s*variant=\"danger\".*?<i className=\"fa fa-trash\"></i>\s*</Button>\s*</div>"
new_actions = """<div className="d-flex justify-content-end align-items-center gap-2">
                                                                <button 
                                                                    className="btn btn-outline-info shadow" 
                                                                    onClick={() => {
                                                                        setViewProject(proj);
                                                                        setShowViewModal(true);
                                                                    }}
                                                                    title="View"
                                                                    style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                >
                                                                    <i className="fa fa-eye"></i>
                                                                </button>
                                                                <EditButton 
                                                                    module="telecalling" 
                                                                    onClick={() => {
                                                                        if (String(proj.id).startsWith('team_')) {
                                                                            handleEditTeam(proj);
                                                                        } else {
                                                                            setEditProject({...proj});
                                                                            setShowEditModal(true);
                                                                        }
                                                                    }}
                                                                />
                                                                <DeleteButton 
                                                                    module="telecalling"
                                                                    onClick={() => handleDeleteProject(proj.id)}
                                                                />
                                                            </div>"""
content = re.sub(old_actions_regex, new_actions, content, flags=re.DOTALL)

# 5. Update Team Modal onHide
content = content.replace("setShowTeamModal(false); setTeamName(''); }", "setShowTeamModal(false); setTeamName(''); setEditingTeamId(null); }")

# 6. Update Team Modal Title
content = content.replace("Create Telecalling Team\n                            </h4>", "{editingTeamId ? 'Edit Telecalling Team' : 'Create Telecalling Team'}\n                            </h4>")
content = content.replace("Assign selected leads to a new team", "{editingTeamId ? 'Manage your team and assigned leads' : 'Assign selected leads to a new team'}")

# 7. Update Team Modal Save Button Logic
old_save_button = """<button type="button" className="btn-save-custom" onClick={async () => {
                            if (!teamName.trim()) {
                                Swal.fire({icon: 'warning', title: 'Validation Error', text: 'Please enter a team name.', confirmButtonColor: '#3085d6'});
                                return;
                            }
                            if (selectedLeads.length === 0) {
                                Swal.fire({icon: 'warning', title: 'Validation Error', text: 'Please select at least one lead.', confirmButtonColor: '#3085d6'});
                                return;
                            }
                            
                            try {
                                const payload = {
                                    name: teamName,
                                    members: [],
                                    leads: selectedLeads.map(lead => ({
                                        id: lead.id,
                                        source: lead.category_detail?.name || 'Unknown'
                                    }))
                                };
                                const res = await axiosInstance.post('/api/crm_new/telecalling-teams/', payload);
                                if (res.status === 201) {
                                    Swal.fire({icon: 'success', title: 'Team Created', text: 'The team has been successfully created.', timer: 1500});
                                    setSelectedLeads([]);
                                    setShowTeamModal(false);
                                    setTeamName('');
                                    
                                    window.location.reload(); 
                                }
                            } catch (error) {
                                console.error("Error creating team:", error);
                                Swal.fire({
                                    icon: 'error',
                                    title: 'Creation Failed',
                                    text: 'Failed to create the team.',
                                    confirmButtonColor: '#d33'
                                });
                            }
                        }}>
                            Create Team
                        </button>"""

new_save_button = """<button type="button" className="btn-save-custom" onClick={async () => {
                            if (!teamName.trim()) {
                                Swal.fire({icon: 'warning', title: 'Validation Error', text: 'Please enter a team name.', confirmButtonColor: '#3085d6'});
                                return;
                            }
                            if (selectedLeads.length === 0) {
                                Swal.fire({icon: 'warning', title: 'Validation Error', text: 'Please select at least one lead.', confirmButtonColor: '#3085d6'});
                                return;
                            }
                            
                            try {
                                const payload = {
                                    name: teamName,
                                    members: [],
                                    leads: selectedLeads.map(lead => ({
                                        id: lead.id,
                                        source: lead.category_detail?.name || 'Unknown'
                                    }))
                                };
                                
                                if (editingTeamId) {
                                    const res = await axiosInstance.patch(`/api/crm_new/telecalling-teams/${editingTeamId}/`, payload);
                                    if (res.status === 200 || res.status === 204) {
                                        Swal.fire({icon: 'success', title: 'Team Updated', text: 'The team has been successfully updated.', timer: 1500});
                                        setSelectedLeads([]);
                                        setShowTeamModal(false);
                                        setTeamName('');
                                        setEditingTeamId(null);
                                        window.location.reload(); 
                                    }
                                } else {
                                    const res = await axiosInstance.post('/api/crm_new/telecalling-teams/', payload);
                                    if (res.status === 201) {
                                        Swal.fire({icon: 'success', title: 'Team Created', text: 'The team has been successfully created.', timer: 1500});
                                        setSelectedLeads([]);
                                        setShowTeamModal(false);
                                        setTeamName('');
                                        setEditingTeamId(null);
                                        window.location.reload(); 
                                    }
                                }
                            } catch (error) {
                                console.error("Error saving team:", error);
                                Swal.fire({
                                    icon: 'error',
                                    title: 'Save Failed',
                                    text: 'Failed to save the team.',
                                    confirmButtonColor: '#d33'
                                });
                            }
                        }}>
                            {editingTeamId ? 'Update Team' : 'Create Team'}
                        </button>"""
content = content.replace(old_save_button, new_save_button)

# 8. Fix Modal close x on click
content = content.replace("onClick={() => { setShowTeamModal(false); setTeamName(''); }}>", "onClick={() => { setShowTeamModal(false); setTeamName(''); setEditingTeamId(null); }}>")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
