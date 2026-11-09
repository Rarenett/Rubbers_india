import re

file_path = 'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. State hooks
state_hooks = """    const [showTeamModal, setShowTeamModal] = useState(false);
    const [teamName, setTeamName] = useState('');

    const [showViewModal, setShowViewModal] = useState(false);
    const [viewProject, setViewProject] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editProject, setEditProject] = useState(null);
"""
content = re.sub(r'const \[showTeamModal, setShowTeamModal\] = useState\(false\);\n\s*const \[teamName, setTeamName\] = useState\(\'\'\);', state_hooks, content)

# 2. Add handlers before the render
handlers = """
    const handleDeleteProject = async (teamId) => {
        const isTeam = typeof teamId === 'string' && teamId.startsWith('team_');
        const realId = isTeam ? teamId.split('_')[1] : teamId;

        Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    if (isTeam) {
                        await axiosInstance.delete(`/api/crm_new/telecalling-teams/${realId}/`);
                    } else {
                        await axiosInstance.delete(`/api/crm_new/telecalling/${realId}/`);
                    }
                    Swal.fire('Deleted!', 'The project/team has been deleted.', 'success');
                    setProjects(projects.filter(p => p.id !== teamId));
                } catch (error) {
                    console.error("Error deleting project:", error);
                    Swal.fire('Error!', 'There was an error deleting the record.', 'error');
                }
            }
        });
    };

    const handleEditSubmit = async () => {
        if (!editProject || !editProject.name.trim()) {
            Swal.fire({icon: 'warning', title: 'Validation Error', text: 'Name is required.', confirmButtonColor: '#3085d6'});
            return;
        }
        
        const isTeam = typeof editProject.id === 'string' && editProject.id.startsWith('team_');
        const realId = isTeam ? editProject.id.split('_')[1] : editProject.id;
        
        try {
            if (isTeam) {
                await axiosInstance.patch(`/api/crm_new/telecalling-teams/${realId}/`, { name: editProject.name });
            } else {
                await axiosInstance.patch(`/api/crm_new/telecalling/${realId}/`, { name: editProject.name });
            }
            setProjects(projects.map(p => p.id === editProject.id ? { ...p, name: editProject.name } : p));
            Swal.fire('Updated!', 'The project/team has been updated.', 'success');
            setShowEditModal(false);
            setEditProject(null);
        } catch (error) {
            console.error("Error updating project:", error);
            Swal.fire('Error!', 'There was an error updating the record.', 'error');
        }
    };
"""
# Find a place to insert handlers, maybe before `return (`
idx = content.rfind('return (')
if idx != -1:
    content = content[:idx] + handlers + '\n    ' + content[idx:]

# 3. Headers
header_old = """<th><strong>STATUS</strong></th>
                                                </tr>"""
header_new = """<th><strong>STATUS</strong></th>
                                                    <th><strong>ACTIONS</strong></th>
                                                </tr>"""
content = content.replace(header_old, header_new)

# 4. Rows
row_old = """                                                                {proj.status}
                                                            </span>
                                                        </td>
                                                    </tr>"""
row_new = """                                                                {proj.status}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="d-flex">
                                                                <Button 
                                                                    variant="primary" 
                                                                    className="shadow btn-xs sharp me-1"
                                                                    onClick={() => {
                                                                        setViewProject(proj);
                                                                        setShowViewModal(true);
                                                                    }}
                                                                >
                                                                    <i className="fa fa-eye"></i>
                                                                </Button>
                                                                <Button 
                                                                    variant="secondary" 
                                                                    className="shadow btn-xs sharp me-1"
                                                                    onClick={() => {
                                                                        setEditProject({...proj});
                                                                        setShowEditModal(true);
                                                                    }}
                                                                >
                                                                    <i className="fa fa-pencil-alt"></i>
                                                                </Button>
                                                                <Button 
                                                                    variant="danger" 
                                                                    className="shadow btn-xs sharp"
                                                                    onClick={() => handleDeleteProject(proj.id)}
                                                                >
                                                                    <i className="fa fa-trash"></i>
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>"""
content = content.replace(row_old, row_new)

# Colspan fallback
content = content.replace('colSpan="5"', 'colSpan="6"')

# 5. Modals
modals = """
            {/* View Project/Team Modal */}
            <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title>View Details</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {viewProject && (
                        <div>
                            <h5><strong>Name:</strong> {viewProject.name}</h5>
                            <p><strong>Status:</strong> {viewProject.status}</p>
                            <p><strong>Assigned Leads ({viewProject.leads?.length || 0})</strong></p>
                            <div className="p-3 bg-light rounded" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {viewProject.leads && viewProject.leads.length > 0 ? (
                                    viewProject.leads.map((l, index) => (
                                        <div key={index} className="border-bottom py-2">
                                            <strong>Lead ID:</strong> {l.lead_id || l.id}
                                            {l.lead_source && <span> | <strong>Source:</strong> {l.lead_source}</span>}
                                        </div>
                                    ))
                                ) : (
                                    <span className="text-muted">No leads assigned.</span>
                                )}
                            </div>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-primary" onClick={() => setShowViewModal(false)}>Close</Button>
                </Modal.Footer>
            </Modal>

            {/* Edit Project/Team Modal */}
            <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Edit Project/Team</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {editProject && (
                        <Form>
                            <Form.Group className="mb-3">
                                <Form.Label>Name</Form.Label>
                                <Form.Control 
                                    type="text" 
                                    value={editProject.name}
                                    onChange={(e) => setEditProject({...editProject, name: e.target.value})}
                                />
                            </Form.Group>
                        </Form>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-danger" onClick={() => setShowEditModal(false)}>Cancel</Button>
                    <Button variant="success" onClick={handleEditSubmit}>Save Changes</Button>
                </Modal.Footer>
            </Modal>
"""
# insert modals before the final `</>`
idx2 = content.rfind('</>')
if idx2 != -1:
    content = content[:idx2] + modals + content[idx2:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("TeleCallingDashboard.jsx updated successfully!")
