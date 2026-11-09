import re

with open('frontend/src/jsx/components/TeamManagement/TeamManagementDashboard.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'    return \(\n        <div className="container-fluid pt-4 pb-5">.*?\n    \);\n};\n\nexport default TeamManagementDashboard;', re.DOTALL)

replacement = """    return (
        <Fragment>
            <PageTitle activeMenu="Team Dashboard" motherMenu="Team Management" />
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap align-items-center justify-content-between" style={{ padding: '1rem 1.5rem' }}>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <Button
                                    variant={activeTab === 'directory' ? 'primary' : 'outline-primary'}
                                    size="sm"
                                    onClick={() => setActiveTab('directory')}
                                    style={{ borderRadius: '6px', fontSize: '13px', height: '32px', display: 'flex', alignItems: 'center', padding: '0 12px' }}
                                >
                                    <i className="fa fa-list me-1"></i> Team Directory
                                </Button>
                                <Button
                                    variant={activeTab === 'create' ? 'primary' : 'outline-primary'}
                                    size="sm"
                                    onClick={() => {
                                        setActiveTab('create');
                                        setEditingTeamId(null);
                                        setTeamName('');
                                        setSelectedMembers([]);
                                        setTeamLead(null);
                                    }}
                                    style={{ borderRadius: '6px', fontSize: '13px', height: '32px', display: 'flex', alignItems: 'center', padding: '0 12px' }}
                                >
                                    <i className="fa fa-plus me-1"></i> Create New Team
                                </Button>
                            </div>
                        </Card.Header>

                        <Card.Body>
                            {/* Directory Tab */}
                            {activeTab === 'directory' && (
                                <div className="animation-fade-in">
                                    {/* Filters */}
                                    <div className="d-flex flex-wrap align-items-center gap-2 mb-4">
                                        <Form.Select 
                                            value={selectedFilterDept} 
                                            onChange={(e) => setSelectedFilterDept(e.target.value)}
                                            style={{ width: '100%', maxWidth: '250px', height: '34px', fontSize: '13px', borderRadius: '6px' }}
                                        >
                                            <option value="all">All Departments</option>
                                            {departments.map(dept => (
                                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                                            ))}
                                        </Form.Select>
                                    </div>

                                    {/* Team List Table (using Shift Plan UI reference, but here we keep the team cards but styled like Shift Plan's tables/cards if any, but wait, Shift Plan uses Table) */}
                                    {/* The prompt says "Keep all existing Team Dashboard functionality: Team cards... ONLY change their visual presentation to match Shift Planning." */}
                                    
                                    {filteredTeams.length === 0 ? (
                                        <div className="text-center py-5">
                                            <div className="text-muted mb-2"><i className="fa fa-folder-open-o fa-3x"></i></div>
                                            <h5 className="fw-600 text-dark">No Teams Found</h5>
                                        </div>
                                    ) : (
                                        <div className="row">
                                            {filteredTeams.map(team => (
                                                <div className="col-xl-4 col-md-6 mb-4" key={team.id}>
                                                    <Card className="h-100 shadow-sm border" style={{ borderRadius: '12px', transition: 'all 0.2s' }}>
                                                        <Card.Header className="border-bottom-0 pb-0 pt-4 px-4 d-flex justify-content-between align-items-start">
                                                            <div>
                                                                <h5 className="fw-600 text-dark mb-1">{team.name}</h5>
                                                                <Badge bg="primary" className="bg-opacity-10 text-primary rounded-pill border border-primary border-opacity-25">
                                                                    {team.department_name || 'Department'}
                                                                </Badge>
                                                            </div>
                                                            <div className="d-flex gap-1">
                                                                <Button 
                                                                    variant="outline-primary" 
                                                                    size="sm" 
                                                                    className="rounded-circle d-flex align-items-center justify-content-center p-0" 
                                                                    style={{ width: '32px', height: '32px' }}
                                                                    onClick={(e) => { e.stopPropagation(); handleEditClick(team, e); }}
                                                                    title="Edit Team"
                                                                >
                                                                    <i className="fa fa-edit"></i>
                                                                </Button>
                                                                <Button 
                                                                    variant="outline-danger" 
                                                                    size="sm" 
                                                                    className="rounded-circle d-flex align-items-center justify-content-center p-0" 
                                                                    style={{ width: '32px', height: '32px' }}
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(team); }}
                                                                    title="Delete Team"
                                                                >
                                                                    <i className="fa fa-trash"></i>
                                                                </Button>
                                                            </div>
                                                        </Card.Header>
                                                        <Card.Body className="p-4">
                                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                                <div className="text-muted" style={{ fontSize: '13px' }}>
                                                                    <i className="fa fa-users me-1"></i> {team.members_detail ? team.members_detail.length : 0} Members
                                                                </div>
                                                                <Button 
                                                                    variant="link" 
                                                                    className="p-0 text-decoration-none" 
                                                                    style={{ fontSize: '13px' }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setExpandedTeamId(expandedTeamId === team.id ? null : team.id);
                                                                    }}
                                                                >
                                                                    {expandedTeamId === team.id ? 'Hide Details' : 'View Details'} <i className={`fa fa-chevron-${expandedTeamId === team.id ? 'up' : 'down'} ms-1`}></i>
                                                                </Button>
                                                            </div>
                                                            
                                                            {expandedTeamId === team.id && (
                                                                <div className="mt-3 pt-3 border-top">
                                                                    {team.lead_detail && (
                                                                        <div className="mb-3">
                                                                            <h6 className="text-muted mb-2" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Team Lead</h6>
                                                                            <div className="d-flex align-items-center">
                                                                                <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                                                                                    {team.lead_detail.full_name ? team.lead_detail.full_name.charAt(0).toUpperCase() : 'L'}
                                                                                </div>
                                                                                <div>
                                                                                    <div className="fw-600 text-dark" style={{ fontSize: '13px' }}>{team.lead_detail.full_name}</div>
                                                                                    <div className="text-muted" style={{ fontSize: '11px' }}>{team.lead_detail.designation || 'Lead'}</div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    
                                                                    <div>
                                                                        <h6 className="text-muted mb-2" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Members</h6>
                                                                        <div className="d-flex flex-column gap-2">
                                                                            {team.members_detail && team.members_detail.map(member => {
                                                                                if (team.lead_detail && member.id === team.lead_detail.id) return null;
                                                                                return (
                                                                                    <div className="d-flex align-items-center" key={`member-${member.id}`}>
                                                                                        <div className="bg-secondary text-white rounded-circle d-flex align-items-center justify-content-center me-2" style={{ width: '28px', height: '28px', fontSize: '11px' }}>
                                                                                            {member.full_name ? member.full_name.charAt(0).toUpperCase() : 'M'}
                                                                                        </div>
                                                                                        <div>
                                                                                            <div className="fw-500 text-dark" style={{ fontSize: '13px' }}>{member.full_name}</div>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </Card.Body>
                                                    </Card>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Create Tab */}
                            {activeTab === 'create' && (
                                <div className="animation-fade-in">
                                    {renderFormContent(false)}
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Edit Team Modal */}
            {editingTeamId && activeTab === 'directory' && (
                <Modal show={true} onHide={() => setEditingTeamId(null)} centered dialogClassName="modal-dialog-centered">
                    <Modal.Header closeButton style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '1rem 1.5rem' }}>
                        <Modal.Title style={{ fontSize: '1rem', fontWeight: '600' }}>
                            <i className="fa fa-edit text-primary me-2"></i> Edit Team Configuration
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body style={{ padding: '1.5rem', maxHeight: '75vh', overflowY: 'auto' }}>
                        {renderFormContent(true)}
                    </Modal.Body>
                </Modal>
            )}
            
            <style>{`
                .selection-card {
                    display: flex;
                    align-items: center;
                    padding: 0.8rem 1rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    margin-bottom: 0.5rem;
                    background: #fff;
                    transition: all 0.2s ease;
                    cursor: pointer;
                }
                .selection-card:hover {
                    border-color: rgba(var(--primary-rgb), 0.4);
                    background: #f8fafc;
                }
                .selection-card.active {
                    border-color: var(--primary);
                    background: rgba(var(--primary-rgb), 0.04);
                }
                .lead-btn {
                    padding: 0.2rem 0.5rem;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 600;
                    border: 1px solid #e2e8f0;
                    background: #f1f5f9;
                    color: #64748b;
                    transition: all 0.2s;
                }
                .lead-btn.is-lead {
                    background: var(--primary);
                    color: #fff;
                    border-color: var(--primary);
                }
            `}</style>
        </Fragment>
    );
};

export default TeamManagementDashboard;"""

new_content = pattern.sub(replacement, content)
with open('frontend/src/jsx/components/TeamManagement/TeamManagementDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
