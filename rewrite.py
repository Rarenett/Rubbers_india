import re

with open(r'C:\Users\ADMIN\.gemini\antigravity-ide\brain\d7c36431-7fbb-4db7-9a7f-8b99df80f7a7\scratch\TeleCallingDashboard.jsx', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'<style>\{`.*?`\}</style>', '', content, flags=re.DOTALL)

if 'PageTitle' not in content:
    content = content.replace("import Select from 'react-select';", "import Select from 'react-select';\nimport PageTitle from '../../layouts/PageTitle';\nimport { Card, Row, Col, Table, Form, Modal, Button } from 'react-bootstrap';")

idx = content.find('return (')

new_return = """return (
        <>
            <PageTitle activeMenu="Telecalling" motherMenu="CRM" />
            <div className="container-fluid">
                <Row>
                    <Col lg={12}>
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center">
                                <Card.Title className="mb-0">Telecalling Management</Card.Title>
                                <div className="d-flex align-items-center gap-2">
                                    <div style={{ width: '300px', position: 'relative' }}>
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search..."
                                            style={{ height: '34px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>
                                    <button 
                                        className={`btn btn-sm ${activeView === 'leads' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setActiveView('leads')}
                                    >
                                        <i className="fa fa-users me-1"></i> Leads
                                    </button>
                                    <button 
                                        className={`btn btn-sm ${activeView === 'projects' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setActiveView('projects')}
                                    >
                                        <i className="fa fa-tasks me-1"></i> Projects
                                    </button>
                                </div>
                            </Card.Header>
                            <Card.Body>
                                {activeView === 'leads' ? (
                                    <>
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <div style={{ width: '400px' }}>
                                                <Select
                                                    options={categories.map(cat => ({
                                                        value: cat.id,
                                                        label: `${cat.name} — ${cat.lead_count || 0} Leads`
                                                    }))}
                                                    value={categories.filter(c => c.id === activeCategory).map(cat => ({
                                                        value: cat.id,
                                                        label: `${cat.name} — ${cat.lead_count || 0} Leads`
                                                    }))[0] || null}
                                                    onChange={(selectedOption) => {
                                                        setActiveCategory(selectedOption ? selectedOption.value : null);
                                                        setSelectedLeads([]);
                                                    }}
                                                    placeholder="Select Lead Repository"
                                                    isSearchable={true}
                                                />
                                            </div>
                                            {users.length > 0 && (
                                                <Button variant="primary" onClick={() => setShowModal(true)}>
                                                    <i className="fa fa-plus-circle me-1"></i> Create Project {selectedLeads.length > 0 && `(${selectedLeads.length})`}
                                                </Button>
                                            )}
                                        </div>
                                        <div className="table-responsive">
                                            <table className="table table-responsive-md">
                                                <thead>
                                                    <tr>
                                                        <th style={{width: '40px'}}>
                                                            <Form.Check 
                                                                type="checkbox"
                                                                onChange={(e) => {
                                                                    if(e.target.checked) setSelectedLeads(leads.map(l => l.id));
                                                                    else setSelectedLeads([]);
                                                                }}
                                                                checked={leads.length > 0 && selectedLeads.length === leads.length}
                                                            />
                                                        </th>
                                                        <th><strong>COMPANY</strong></th>
                                                        <th><strong>CONTACT</strong></th>
                                                        <th><strong>LOCATION</strong></th>
                                                        <th><strong>ADDED BY</strong></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {leads.length > 0 ? leads.map(lead => (
                                                        <tr key={lead.id} style={{ verticalAlign: 'middle' }}>
                                                            <td>
                                                                <Form.Check 
                                                                    type="checkbox"
                                                                    checked={selectedLeads.includes(lead.id)}
                                                                    onChange={() => {
                                                                        if (selectedLeads.includes(lead.id)) {
                                                                            setSelectedLeads(selectedLeads.filter(id => id !== lead.id));
                                                                        } else {
                                                                            setSelectedLeads([...selectedLeads, lead.id]);
                                                                        }
                                                                    }}
                                                                />
                                                            </td>
                                                            <td>
                                                                <strong>{lead.company_name}</strong><br/>
                                                                <small className="text-muted">{lead.industry_detail?.name || 'Unknown'}</small>
                                                            </td>
                                                            <td>
                                                                <div><i className="fa fa-user me-1 text-muted"></i> {lead.first_name} {lead.last_name}</div>
                                                                <div><i className="fa fa-phone me-1 text-muted"></i> {lead.phone}</div>
                                                            </td>
                                                            <td>{lead.city}, {lead.country}</td>
                                                            <td>{lead.created_by_detail?.full_name || 'System'}</td>
                                                        </tr>
                                                    )) : (
                                                        <tr>
                                                            <td colSpan="5" className="text-center py-4 text-muted">No leads available</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-responsive-md">
                                            <thead>
                                                <tr>
                                                    <th><strong>SI NO</strong></th>
                                                    <th><strong>PROJECT NAME</strong></th>
                                                    <th><strong>TARGET DATE</strong></th>
                                                    <th><strong>LEADS</strong></th>
                                                    <th><strong>STATUS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {projects.length > 0 ? projects.map((proj, idx) => (
                                                    <tr key={proj.id} style={{ verticalAlign: 'middle' }}>
                                                        <td><strong>{idx + 1}</strong></td>
                                                        <td><strong>{proj.name}</strong></td>
                                                        <td>{new Date(proj.target_date).toLocaleDateString()}</td>
                                                        <td><span className="badge badge-info light">{proj.leads?.length || 0} Leads</span></td>
                                                        <td>
                                                            <span className={`badge ${proj.status === 'Completed' ? 'badge-success' : proj.status === 'In Progress' ? 'badge-warning' : 'badge-light text-muted border'} light`}>
                                                                {proj.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan="5" className="text-center py-4 text-muted">No projects available</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </div>

            {/* Initialization Modal */}
            <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title>Initialize Project</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleProjectSave}>
                        <Form.Group className="mb-3">
                            <Form.Label>Project Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control 
                                type="text" 
                                required
                                value={projectForm.name}
                                onChange={e => setProjectForm({...projectForm, name: e.target.value})}
                                placeholder="e.g. Q1 Vendor Outreach"
                            />
                        </Form.Group>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Allocation Type <span className="text-danger">*</span></Form.Label>
                                    <Form.Select
                                        required
                                        value={allocationType}
                                        onChange={e => {
                                            setAllocationType(e.target.value);
                                            setIndividualAssignee('');
                                        }}
                                    >
                                        <option value="individual">Individual</option>
                                        {teams.filter(t => t.department_detail?.name === 'Tele Calling').map(t => (
                                            <option key={t.id} value={`team_${t.id}`}>{t.name}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Assignee <span className="text-danger">*</span></Form.Label>
                                    <Form.Select
                                        required
                                        value={individualAssignee}
                                        onChange={e => setIndividualAssignee(e.target.value)}
                                        disabled={allocationType !== 'individual'}
                                    >
                                        <option value="">Select Assignee...</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>{u.full_name}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>
                        <Form.Group className="mb-3">
                            <Form.Label>Target Date <span className="text-danger">*</span></Form.Label>
                            <Form.Control 
                                type="date" 
                                required
                                value={projectForm.target_date}
                                onChange={e => setProjectForm({...projectForm, target_date: e.target.value})}
                            />
                        </Form.Group>
                        <Form.Group className="mb-4">
                            <Form.Label>Instructions</Form.Label>
                            <Form.Control 
                                as="textarea"
                                rows={3}
                                value={projectForm.instructions}
                                onChange={e => setProjectForm({...projectForm, instructions: e.target.value})}
                            />
                        </Form.Group>
                        <div className="text-end">
                            <Button variant="secondary" className="me-2" onClick={() => setShowModal(false)}>Cancel</Button>
                            <Button variant="primary" type="submit">Create Project</Button>
                        </div>
                    </Form>
                </Modal.Body>
            </Modal>
        </>
    );
};

export default TeleCallingDashboard;
"""

new_content = content[:idx] + new_return

with open(r'C:\Users\ADMIN\.gemini\antigravity-ide\brain\d7c36431-7fbb-4db7-9a7f-8b99df80f7a7\scratch\TeleCallingDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
