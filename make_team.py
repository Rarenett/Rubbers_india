import re

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', encoding='utf-8') as f:
    content = f.read()

# 1. Add Make Team state
hooks = """    const [activeView, setActiveView] = useState('projects'); // 'leads', 'projects'"""
new_hooks = """    const [activeView, setActiveView] = useState('projects'); // 'leads', 'projects', 'teams'
    const [showTeamModal, setShowTeamModal] = useState(false);"""
content = content.replace(hooks, new_hooks)

# 2. Add Make Team button
projects_btn = """                                    <button 
                                        className={`btn btn-sm ${activeView === 'projects' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setActiveView('projects')}
                                    >
                                        <i className="fa fa-tasks me-1"></i> Projects
                                    </button>"""
make_team_btn = """                                    <button 
                                        className={`btn btn-sm ${activeView === 'projects' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setActiveView('projects')}
                                    >
                                        <i className="fa fa-tasks me-1"></i> Projects
                                    </button>
                                    <button 
                                        className="btn btn-sm btn-success"
                                        onClick={() => setShowTeamModal(true)}
                                    >
                                        <i className="fa fa-users-cog me-1"></i> Make Team
                                    </button>"""
content = content.replace(projects_btn, make_team_btn)


# 3. Add Make Team Modal
team_modal = """
            {/* Make Team Modal */}
            <Modal show={showTeamModal} onHide={() => setShowTeamModal(false)} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title>Create Telecalling Team</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Row className="mb-3">
                            <Col md={12}>
                                <Form.Group>
                                    <Form.Label>Team Name</Form.Label>
                                    <Form.Control type="text" placeholder="Enter team name" />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row className="mb-3">
                            <Col md={12}>
                                <Form.Group>
                                    <Form.Label>Team Members (Telecalling Dept Only)</Form.Label>
                                    <Select
                                        isMulti
                                        options={users.map(u => ({ value: u.id, label: u.first_name + ' ' + u.last_name }))}
                                        placeholder="Select team members..."
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                        <div className="d-flex justify-content-end gap-2 mt-4">
                            <Button variant="outline-danger" onClick={() => setShowTeamModal(false)}>Cancel</Button>
                            <Button variant="success" onClick={() => alert("Backend saving not yet implemented!")}>Create Team</Button>
                        </div>
                    </Form>
                </Modal.Body>
            </Modal>
"""

# Insert modal before the final </Card> or <>
content = content.replace("            <Modal show={showModal} onHide={() => setShowModal(false)} size=\"lg\" centered>", team_modal + "\n            <Modal show={showModal} onHide={() => setShowModal(false)} size=\"lg\" centered>")


with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Added Make Team Modal UI")
