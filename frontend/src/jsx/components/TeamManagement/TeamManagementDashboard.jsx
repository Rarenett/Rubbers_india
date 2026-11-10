import React, { useState, useEffect, Fragment } from 'react';
import { Card, Button, Badge, Form, Row, Col, Table, Collapse, OverlayTrigger, Tooltip, Modal } from 'react-bootstrap';
import Swal from 'sweetalert2';
import axiosInstance from '../../../services/AxiosInstance';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';
const getLeadAndMemberSummary = (team) => {
    const totalMembers = team.members_detail ? team.members_detail.length : 0;
    if (totalMembers === 0) return 'No members';

    if (team.lead_detail) {
        const leadName = team.lead_detail.full_name || team.lead_detail.username || 'Unknown';
        const first = leadName.trim().split(/\s+/)[0];
        const remaining = totalMembers - 1;
        if (remaining > 0) {
            return `${first} • +${remaining} more`;
        }
        return first;
    } else {
        if (totalMembers === 1) {
            return `No Lead • 1 member`;
        }
        return `No Lead • +${totalMembers} members`;
    }
};

const TeamManagementDashboard = () => {

    
    // UI State
    const [activeTab, setActiveTab] = useState('directory'); // 'directory' or 'create'
    const [loading, setLoading] = useState(true);

    // Data State
    const [departments, setDepartments] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [teams, setTeams] = useState([]);
    
    // Directory State
    const [selectedFilterDept, setSelectedFilterDept] = useState('all');

    // Create Form State
    const [teamName, setTeamName] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const [selectedMembers, setSelectedMembers] = useState([]); // Array of IDs
    const [teamLead, setTeamLead] = useState(null); // Single ID
    
    // Search State
    const [teamSearch, setTeamSearch] = useState('');
    const [deptSearch, setDeptSearch] = useState('');
    const [empSearch, setEmpSearch] = useState('');

    const [expandedTeamId, setExpandedTeamId] = useState(null);
    const [teamDetailsTab, setTeamDetailsTab] = useState('overview');

    const [submitting, setSubmitting] = useState(false);



    const [editingTeamId, setEditingTeamId] = useState(null);


    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [deptRes, teamRes] = await Promise.all([
                axiosInstance.get('/api/hr/departments/'),
                axiosInstance.get('/api/teams/teams/')
            ]);
            setDepartments(deptRes.data);
            setTeams(teamRes.data);
        } catch (error) {
            console.error("Error fetching initial data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (departments.length > 0) {
            const teleCallingDept = departments.find(d => d.name === 'Tele Calling');
            if (teleCallingDept) {
                setSelectedDepartment(teleCallingDept.id);
            }
        }
    }, [departments]);

    useEffect(() => {
        const fetchEmployees = async () => {
            if (!selectedDepartment) {
                setEmployees([]);
                return;
            }
            try {
                const empRes = await axiosInstance.get(`/api/teams/department-employees/${selectedDepartment}/`);
                let fetchedEmployees = empRes.data;
                
                // Exclude employees already assigned to a team
                const assignedEmployeeIds = new Set();
                teams.forEach(t => {
                    // When editing, do not exclude members of the current team
                    if (editingTeamId && t.id === editingTeamId) return;
                    
                    const memberIds = t.members_detail ? t.members_detail.map(m => m.id) : (t.members || []);
                    memberIds.forEach(id => assignedEmployeeIds.add(id));
                });
                
                fetchedEmployees = fetchedEmployees.filter(emp => !assignedEmployeeIds.has(emp.id));

                setEmployees(fetchedEmployees);
            } catch (error) {
                console.error("Error fetching employees", error);
            }
        };
        if (activeTab === 'create' || editingTeamId) {
            fetchEmployees();
        }
    }, [selectedDepartment, activeTab, editingTeamId, teams]);

    const handleMemberToggle = (empId) => {
        setSelectedMembers(prev => {
            const isSelected = prev.includes(empId);
            if (isSelected) {
                if (teamLead === empId) setTeamLead(null);
                return prev.filter(id => id !== empId);
            } else {
                return [...prev, empId];
            }
        });
    };

    const handleLeadSelect = (empId) => {
        if (!selectedMembers.includes(empId)) {
            Swal.fire({
                icon: 'info',
                title: 'Action Required',
                text: 'Please select the employee as a team member first before assigning them as Team Lead.',
                confirmButtonText: 'OK'
            });
            return;
        }
        setTeamLead(empId);
    };

    const handleEditClick = (team, e) => {
        e.stopPropagation();
        setEditingTeamId(team.id);
        setTeamName(team.name);
        setSelectedMembers(team.members_detail ? team.members_detail.map(m => m.id) : (team.members || []));
        setTeamLead(team.lead ? team.lead : null);
    };

    const handleDeleteClick = (team) => {
        Swal.fire({
            icon: 'warning',
            title: 'Delete Team?',
            text: `Are you sure you want to delete "${team.name}"?`,
            showCancelButton: true,
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel',
            reverseButtons: true
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await axiosInstance.delete(`/api/teams/teams/${team.id}/`);
                    Swal.fire({
                        icon: 'success',
                        title: 'Deleted!',
                        text: 'Team successfully deleted.',
                        confirmButtonText: 'OK'
                    });
                    await fetchInitialData();
                } catch (error) {
                    console.error("Error deleting team", error);
                    let errorMsg = "Unable to delete the team.";
                    if (error.response && error.response.data) {
                        if (error.response.data.message) {
                            errorMsg = error.response.data.message;
                        } else if (error.response.data.error) {
                            errorMsg = error.response.data.error;
                        }
                    }
                    Swal.fire({
                        icon: 'error',
                        title: 'Delete Failed',
                        text: errorMsg
                    });
                }
            }
        });
    };

    const performSubmit = async () => {
        setSubmitting(true);
        try {
            const payload = {
                name: teamName,
                department: selectedDepartment,
                lead: teamLead,
                members: selectedMembers,
                is_active: true
            };
            if (editingTeamId) {
                await axiosInstance.put(`/api/teams/teams/${editingTeamId}/`, payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Team successfully updated!',
                    confirmButtonText: 'OK'
                });
            } else {
                await axiosInstance.post('/api/teams/teams/', payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Team successfully created!',
                    confirmButtonText: 'OK'
                });
            }
            
            // Refresh teams and switch to list
            await fetchInitialData();
            setActiveTab('directory');
            
            // Reset form
            setEditingTeamId(null);
            setTeamName('');
            setSelectedDepartment(null);
            setSelectedMembers([]);
            setTeamLead(null);
        } catch (error) {
            console.error("Error creating team", error);
            let errorMsg = "Failed to create team.";
            if (error.response && error.response.data) {
                const data = error.response.data;
                if (typeof data === 'object' && !Array.isArray(data)) {
                    if (data.message) {
                        errorMsg = data.message;
                    } else if (data.error) {
                        errorMsg = data.error;
                    } else {
                        const messages = [];
                        for (const key in data) {
                            const val = Array.isArray(data[key]) ? data[key].join(', ') : data[key];
                            messages.push(`${key}: ${val}`);
                        }
                        if (messages.length > 0) {
                            errorMsg = messages.join('\n');
                        }
                    }
                } else if (typeof data === 'string') {
                    errorMsg = data;
                }
            }
            Swal.fire({
                icon: 'error',
                title: 'Unable to Save',
                text: errorMsg
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!teamName || !selectedDepartment || selectedMembers.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Missing Information',
                text: 'Please fill in all required fields: Team Name, Department, and Members.',
                confirmButtonText: 'OK'
            });
            return;
        }

        performSubmit();
    };

    const filteredDepartments = departments.filter(d => 
        d.name.toLowerCase().includes(deptSearch.toLowerCase())
    );

    const filteredEmployees = employees.filter(e => 
        e.full_name.toLowerCase().includes(empSearch.toLowerCase()) || 
        e.designation.toLowerCase().includes(empSearch.toLowerCase())
    );

    const filteredTeams = (selectedFilterDept === 'all' 
        ? teams 
        : teams.filter(t => t.department === selectedFilterDept))
        .filter(t => t.name && t.name.toLowerCase().includes(teamSearch.toLowerCase()));

    const getInitials = (name) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    const toggleTeamExpand = (teamId) => {
        if (expandedTeamId === teamId) {
            setExpandedTeamId(null);
        } else {
            setExpandedTeamId(teamId);
        }
    };

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '70vh' }}>
            <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="sr-only">Loading...</span>
            </div>
        </div>
    );

    const renderFormContent = (isModal) => {
        if (isModal) {
            return (
                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label className="fw-800 text-dark mb-1" style={{fontSize: '0.9rem'}}>Team Name *</label>
                        <input 
                            type="text" 
                            className="form-control" 
                            style={{ borderRadius: '8px' }}
                            placeholder="e.g. IT Alpha Support Squad" 
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            required
                        />
                    </div>
                    
                    <div className="mb-3">
                        <label className="fw-800 text-dark mb-1" style={{fontSize: '0.9rem'}}>Department</label>
                        <div className="d-flex align-items-center p-2 border rounded bg-light" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                            <i className="fa fa-building text-primary mx-2"></i>
                            <span className="fw-700 text-dark" style={{fontSize: '0.9rem'}}>Tele Calling</span>
                            <i className="fa fa-check-circle text-primary ms-auto me-2"></i>
                        </div>
                    </div>

                    <div className="mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <label className="fw-800 text-dark mb-0" style={{fontSize: '0.9rem'}}>Allocate Personnel</label>
                            <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill">
                                {selectedMembers.length} Selected
                            </span>
                        </div>
                        <div className="search-wrapper mb-2">
                            <i className="fa fa-search text-muted"></i>
                            <input 
                                type="text" 
                                className="form-control search-input" 
                                style={{ height: '36px', fontSize: '0.85rem' }}
                                placeholder="Search employees..." 
                                value={empSearch}
                                onChange={(e) => setEmpSearch(e.target.value)}
                            />
                        </div>
                        
                        <div className="scrollable-list border rounded p-2" style={{ maxHeight: '30vh' }}>
                            {employees.length === 0 ? (
                                <div className="text-center py-3 text-muted" style={{fontSize: '0.85rem'}}>No employees found.</div>
                            ) : (
                                filteredEmployees.map(emp => {
                                    const isSelected = selectedMembers.includes(emp.id);
                                    const isLead = teamLead === emp.id;
                                    return (
                                        <div key={emp.id} className={`selection-card p-2 mb-2 ${isSelected ? 'active' : ''} d-flex justify-content-between align-items-center`} style={{ cursor: 'pointer', borderRadius: '8px' }} onClick={() => handleMemberToggle(emp.id)}>
                                            <div className="d-flex align-items-center gap-2">
                                                <input 
                                                    type="checkbox" 
                                                    className="form-check-input m-0"
                                                    checked={isSelected}
                                                    onChange={() => {}}
                                                />
                                                <div>
                                                    <div className="fw-700 text-dark" style={{ fontSize: '0.85rem' }}>{emp.full_name || emp.username}</div>
                                                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>{emp.designation || 'Member'}</div>
                                                </div>
                                            </div>
                                            <button 
                                                type="button"
                                                className={`btn btn-sm lead-btn ${isLead ? 'is-lead' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleLeadSelect(emp.id);
                                                }}
                                                disabled={!isSelected}
                                                style={!isSelected ? { opacity: 0.5, padding: '0.2rem 0.5rem', fontSize: '0.75rem' } : { padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                            >
                                                {isLead ? <span><i className="fa fa-star text-warning me-1"></i> Team Lead</span> : "Make Lead"}
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                            {filteredEmployees.length === 0 && empSearch && (
                                <div className="text-center py-2 text-muted" style={{fontSize: '0.85rem'}}>No matching employees found.</div>
                            )}
                        </div>
                    </div>

                    <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                        <Button 
                            className="btn-cancel-custom" 
                            style={{ backgroundColor: '#dc3545', borderColor: '#dc3545', color: '#ffffff' }}
                            onClick={() => setEditingTeamId(null)} 
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" className="btn-generate-custom" disabled={submitting || !teamName || selectedMembers.length === 0}>
                            {submitting ? "Processing..." : "Save Changes"}
                        </Button>
                    </div>
                </form>
            );
        }

        return (
        <form onSubmit={handleSubmit} className="p-2">
            <Row className="gy-3 align-items-end mb-4">
                <Col xs={12} sm={6} md={4}>
                    <Form.Group className="mb-0">
                        <Form.Label className="text-nowrap" style={{ fontSize: '14px', fontWeight: '500' }}>Team Name <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                            type="text"
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            placeholder="e.g. Alpha Support Squad"
                            required
                        />
                    </Form.Group>
                </Col>
                <Col xs={12} sm={6} md={4}>
                    <Form.Group className="mb-0">
                        <Form.Label className="text-nowrap" style={{ fontSize: '14px', fontWeight: '500' }}>Department</Form.Label>
                        <Form.Control
                            type="text"
                            value="Tele Calling"
                            readOnly
                            disabled
                        />
                    </Form.Group>
                </Col>
            </Row>

            <hr className="my-4" style={{ borderColor: '#e2e8f0' }} />

            <Row>
                <Col xs={12} md={4} className="border-bottom border-md-bottom-0 border-md-end pb-3 pb-md-0 mb-3 mb-md-0">
                    <h6 className="mb-3 mt-1 font-w600 text-muted d-flex justify-content-between align-items-center" style={{ fontSize: '13px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        ALLOCATE PERSONNEL
                        <Badge bg="light" className="text-primary border" style={{ fontSize: '11px', padding: '3px 8px' }}>
                            {selectedMembers.length} Selected
                        </Badge>
                    </h6>
                    <div className="position-relative mb-3">
                        <Form.Control
                            type="text"
                            placeholder="Search employees..."
                            value={empSearch}
                            onChange={(e) => setEmpSearch(e.target.value)}
                            size="sm"
                            style={{ fontSize: '12px' }}
                        />
                        <i className="fa fa-search position-absolute text-muted" style={{ right: '10px', top: '9px', fontSize: '12px' }}></i>
                    </div>
                </Col>
                <Col xs={12} md={8}>
                    {employees.length === 0 ? (
                        <div className="text-center py-4 text-muted spm-empty-state rounded-3" style={{ border: '1px dashed #cbd5e1' }}>
                            <p className="mb-0 font-w500">No employees available in this department.</p>
                        </div>
                    ) : filteredEmployees.length === 0 ? (
                        <div className="text-center py-4 text-muted spm-empty-state rounded-3" style={{ border: '1px dashed #cbd5e1' }}>
                            <p className="mb-0 font-w500">No matching employees found.</p>
                        </div>
                    ) : (
                        <div className="d-flex flex-column gap-2" style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                            {filteredEmployees.map(emp => {
                                const isSelected = selectedMembers.includes(emp.id);
                                const isLead = teamLead === emp.id;
                                
                                return (
                                    <div 
                                        key={emp.id} 
                                        className="d-flex align-items-center justify-content-between p-2 rounded-2 border"
                                        style={{ 
                                            cursor: 'pointer', 
                                            backgroundColor: isSelected ? 'rgba(10, 80, 15, 0.05)' : '#fff',
                                            borderColor: isSelected ? '#0a500f' : '#e2e8f0'
                                        }}
                                        onClick={() => handleMemberToggle(emp.id)}
                                    >
                                        <div className="d-flex align-items-center gap-3">
                                            <Form.Check 
                                                type="checkbox"
                                                id={`emp-${emp.id}`}
                                                checked={isSelected}
                                                onChange={() => {}}
                                                className="mb-0"
                                            />
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="bg-light text-dark rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px', fontSize: '12px', fontWeight: '600' }}>
                                                    {getInitials(emp.full_name || emp.username)}
                                                </div>
                                                <div>
                                                    <div className="font-w600 text-dark" style={{ fontSize: '13px' }}>{emp.full_name || emp.username}</div>
                                                    <div className="text-muted" style={{ fontSize: '11px' }}>{emp.designation || 'Member'}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <Button 
                                            variant={isLead ? "primary" : "outline-primary"}
                                            size="sm"
                                            className="d-flex align-items-center gap-1"
                                            style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}
                                            disabled={!isSelected}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleLeadSelect(emp.id);
                                            }}
                                        >
                                            {isLead ? (
                                                <><i className="fa fa-star text-warning"></i> Team Lead</>
                                            ) : (
                                                <><i className="fa fa-user"></i> Make Lead</>
                                            )}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Col>
            </Row>

            <div className="mt-4 pt-3 border-top d-flex justify-content-end gap-2">
                <Button 
                    className="btn-cancel-custom" 
                    style={{ backgroundColor: '#dc3545', borderColor: '#dc3545', color: '#ffffff' }}
                    onClick={() => {
                        setActiveTab('directory');
                        setEditingTeamId(null);
                        setTeamName('');
                        setSelectedMembers([]);
                        setTeamLead(null);
                    }} 
                    disabled={submitting}
                >
                    Cancel
                </Button>
                <Button 
                    type="submit" 
                    className="btn-generate-custom d-flex align-items-center gap-2"
                    disabled={submitting || !teamName || selectedMembers.length === 0}
                >
                    {submitting ? (
                        <><i className="fa fa-circle-o-notch fa-spin"></i> Provisioning...</>
                    ) : (
                        <><i className="fa fa-users"></i> Finalize & Create Team</>
                    )}
                </Button>
            </div>
        </form>
        );
    };

    return (
        <div className="container-fluid">
            <style>{`
                .team-erp-card {
                    transition: all 0.2s ease-in-out;
                }
                .team-erp-card:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
                    transform: translateY(-2px);
                }
                .team-management-header-actions {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    gap: 14px !important;
                }
                .team-management-header-actions > button {
                    margin-left: 0 !important;
                    margin-right: 0 !important;
                    position: static !important;
                }
                @media (max-width: 767px) {
                    .team-management-header-container {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 12px !important;
                        height: auto !important;
                        width: 100% !important;
                    }
                    .team-management-header-container .card-title {
                        margin-bottom: 0 !important;
                    }
                    .team-management-header-wrapper {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 12px !important;
                        width: 100% !important;
                        flex: none !important;
                    }
                    .team-management-search-wrapper {
                        width: 100% !important;
                        max-width: 100% !important;
                        margin-bottom: 0px !important;
                    }
                    .team-management-header-actions {
                        display: flex !important;
                        flex-direction: column !important;
                        width: 100% !important;
                        gap: 8px !important;
                    }
                    .team-management-header-actions > button {
                        width: 100% !important;
                        height: 40px !important;
                        justify-content: center !important;
                        margin-bottom: 0px !important;
                        white-space: nowrap !important;
                        display: flex !important;
                        align-items: center !important;
                    }
                    .pkg-custom-modal .modal-dialog {
                        width: calc(100% - 24px) !important;
                        max-width: 100% !important;
                        margin: 12px auto !important;
                    }
                }
            `}</style>
            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="team-management-header-container d-flex justify-content-between align-items-center gap-2">
                            <Card.Title className="mb-0">Team Management</Card.Title>
                            <div className="d-flex align-items-center gap-3 team-management-header-wrapper" style={{ flex: 1, justifyContent: 'flex-end' }}>
                                {activeTab === 'directory' && (
                                    <div className="position-relative team-management-search-wrapper" style={{ width: '100%', maxWidth: '280px', flex: '1 1 auto' }}>
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <input 
                                            type="text" 
                                            className="form-control" 
                                            placeholder="Search Team Name..." 
                                            style={{ height: '38px', paddingLeft: '32px', paddingRight: teamSearch ? '32px' : '12px', borderRadius: '6px', fontSize: '13px', border: '1px solid #d7d7d7', boxShadow: 'none' }}
                                            value={teamSearch}
                                            onChange={(e) => setTeamSearch(e.target.value)}
                                        />
                                        {teamSearch && (
                                            <i className="fa fa-times position-absolute text-muted" style={{ right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: '13px' }} onClick={() => setTeamSearch('')} title="Clear Search"></i>
                                        )}
                                    </div>
                                )}
                                <div className="team-management-header-actions">
                                    <Button
                                    onClick={() => setActiveTab('directory')}
                                    style={{ 
                                        backgroundColor: activeTab === 'directory' ? '#0a500f' : 'white',
                                        borderColor: '#0a500f',
                                        color: activeTab === 'directory' ? 'white' : '#0a500f',
                                        height: '34px', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        fontSize: '13px',
                                        borderRadius: '4px',
                                        padding: '0 15px'
                                    }}
                                    className="shadow-none"
                                >
                                    <i className="fa fa-list me-2"></i> Team Directory
                                </Button>
                                <CreateButton
                                    module="team_management"
                                    onClick={() => {
                                        setActiveTab('create');
                                        setEditingTeamId(null);
                                        setTeamName('');
                                        setSelectedMembers([]);
                                        setTeamLead(null);
                                    }}
                                    style={{ 
                                        backgroundColor: activeTab === 'create' ? '#0a500f' : 'white',
                                        borderColor: '#0a500f',
                                        color: activeTab === 'create' ? 'white' : '#0a500f',
                                        borderRadius: '4px',
                                        padding: '0 15px'
                                    }}
                                    className="shadow-none"
                                >
                                    Create New Team
                                </CreateButton>
                            </div>
                            </div>
                        </Card.Header>

                        <Card.Body>
                            {/* Directory Tab */}
                            {activeTab === 'directory' && (
                                <div className="animation-fade-in" style={{ marginTop: '16px' }}>
                                    {/* Team List Table (using Shift Plan UI reference, but here we keep the team cards but styled like Shift Plan's tables/cards if any, but wait, Shift Plan uses Table) */}
                                    {/* The prompt says "Keep all existing Team Dashboard functionality: Team cards... ONLY change their visual presentation to match Shift Planning." */}
                                    
                                    {filteredTeams.length === 0 ? (
                                        <div className="text-center py-5">
                                            <div className="text-muted mb-2"><i className="fa fa-folder-open-o fa-3x"></i></div>
                                            <h5 className="fw-600 text-dark">No Teams Found</h5>
                                        </div>
                                    ) : (
                                        <Row className="gy-3 mb-3">
                                            {filteredTeams.map(team => (
                                                <Col xl={3} lg={4} md={6} sm={12} xs={12} key={team.id}>
                                                    <div className="p-3 d-flex flex-column h-100 bg-white team-erp-card" 
                                                         style={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,.04)', minHeight: '170px' }}>
                                                        
                                                        {/* Top Row */}
                                                        <div className="d-flex justify-content-between align-items-center">
                                                            <span className="font-w600 text-dark text-truncate pe-2" style={{ fontSize: '15px', maxWidth: '70%', lineHeight: '1.4' }} title={team.name}>
                                                                {team.name}
                                                            </span>
                                                            <div className="d-flex align-items-center gap-1">
                                                                <EditButton 
                                                                    module="team_management" 
                                                                    onClick={(e) => { e.stopPropagation(); handleEditClick(team, e); }}
                                                                    variant="outline-success"
                                                                />
                                                                <DeleteButton 
                                                                    module="team_management" 
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(team); }}
                                                                    variant="outline-danger"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Middle Row */}
                                                        <div className="mt-3 mb-1">
                                                            <div className="text-muted" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '2px' }}>Members</div>
                                                            <div className="text-dark text-truncate" style={{ fontSize: '14px', fontWeight: '500' }}>
                                                                {getLeadAndMemberSummary(team)}
                                                            </div>
                                                        </div>

                                                        {/* Bottom Row */}
                                                        <div className="d-flex justify-content-between align-items-center mt-auto">
                                                            <span className="text-muted d-flex align-items-center" style={{ fontSize: '13px', fontWeight: '500' }}>
                                                                <i className="fa fa-users me-2 text-success" style={{ fontSize: '15px' }}></i>
                                                                {team.members_detail ? team.members_detail.length : 0} Member{(team.members_detail?.length !== 1) ? 's' : ''}
                                                            </span>
                                                            <button 
                                                                className="btn btn-outline-info shadow" 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setExpandedTeamId(expandedTeamId === team.id ? null : team.id);
                                                                }}
                                                                title="View Details"
                                                                style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                            >
                                                                <i className="fa fa-eye"></i>
                                                            </button>
                                                        </div>
                                                        </div>
                                                </Col>
                                            ))}
                                        </Row>
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

            {/* Team Details Modal */}
            {expandedTeamId && (() => {
                const team = filteredTeams.find(t => t.id === expandedTeamId) || teams.find(t => t.id === expandedTeamId);
                if (!team) return null;
                const deptName = departments.find(d => d.id === team.department)?.name || 'Tele Calling';
                
                return (
                    <Modal 
                        show={true} 
                        onHide={() => setExpandedTeamId(null)} 
                        centered 
                        dialogClassName="pkg-custom-modal" 
                        backdrop="static"
                    >
                        <style>{`
                            .pkg-custom-modal .modal-content { border-radius: 16px !important; border: none !important; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important; overflow: hidden; }
                            .pkg-custom-modal .modal-header-custom { display: flex; align-items: center; justify-content: space-between; padding: 24px 28px 16px 28px; border-bottom: 1px solid #f1f5f9; background-color: #fff; }
                            .pkg-custom-modal .modal-icon-circle { width: 48px; height: 48px; background-color: #0a500f; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2); }
                            .pkg-custom-modal .modal-close-x { border: none; background: transparent; font-size: 24px; color: #aaa; cursor: pointer; transition: color 0.2s; display: flex; align-items: center; justify-content: center; padding: 4px; line-height: 1; }
                            .pkg-custom-modal .modal-close-x:hover { color: #555; }
                            .pkg-custom-modal .modal-body-custom { padding: 24px 28px; overflow-y: auto; max-height: 400px; background-color: #fff; }
                            .pkg-custom-modal .modal-body-custom::-webkit-scrollbar { width: 6px; }
                            .pkg-custom-modal .modal-body-custom::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 6px; }
                            .pkg-custom-modal .modal-footer-custom { display: flex; align-items: center; justify-content: flex-end; padding: 20px 28px 24px 28px; border-top: 1px solid #f1f5f9; background-color: #fafbfc; gap: 12px; }
                            .pkg-custom-modal .form-label-custom { font-size: 13px; font-weight: 500; color: #4a5568; margin-bottom: 6px; display: block; }
                            .pkg-custom-modal .trip-value { font-size: 14px; color: #334155; margin-bottom: 0; font-weight: 600; }
                            .pkg-custom-modal .btn-close-custom { background-color: #dc3545 !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; transition: background-color 0.2s, transform 0.1s; }
                            .pkg-custom-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
                        `}</style>
                        
                        <div className="modal-header-custom">
                            <div className="d-flex align-items-center gap-3">
                                <div className="modal-icon-circle">
                                    <i className="fa fa-users text-white" style={{ fontSize: '20px' }}></i>
                                </div>
                                <div>
                                    <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                        Team Details
                                    </h4>
                                    <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                        View complete team information
                                    </p>
                                </div>
                            </div>
                            <button type="button" className="modal-close-x" onClick={() => setExpandedTeamId(null)}>
                                &times;
                            </button>
                        </div>
                        
                        <div className="modal-body-custom">
                            <div className="row">
                                <div className="col-12 mb-3">
                                    <label className="form-label-custom">Team Name</label>
                                    <p className="trip-value">{team.name}</p>
                                </div>
                                
                                <div className="col-12 mb-3">
                                    <label className="form-label-custom">Department</label>
                                    <p className="trip-value" style={{ fontWeight: '500' }}>{deptName}</p>
                                </div>

                                <div className="col-12 mb-3">
                                    <label className="form-label-custom">Team Lead</label>
                                    {team.lead_detail ? (
                                        <div style={{
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '10px',
                                            padding: '10px 14px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            backgroundColor: '#fff'
                                        }}>
                                            <div className="d-flex align-items-center gap-2">
                                                <div style={{
                                                    width: '36px', height: '36px', borderRadius: '50%',
                                                    background: 'var(--primary)', color: 'white',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '14px', fontWeight: '600'
                                                }}>
                                                    {team.lead_detail.full_name ? team.lead_detail.full_name.charAt(0).toUpperCase() : 'L'}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155', lineHeight: '1.2' }}>{team.lead_detail.full_name}</div>
                                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{team.lead_detail.designation || 'Customer Support'}</div>
                                                </div>
                                            </div>
                                            <i className="fa fa-star text-warning" style={{ fontSize: '16px' }}></i>
                                        </div>
                                    ) : (
                                        <p className="text-muted fst-italic" style={{ fontSize: '13px' }}>No Lead Assigned</p>
                                    )}
                                </div>

                                <div className="col-12 mb-1">
                                    <label className="form-label-custom">Members ({team.members_detail ? team.members_detail.length : 0})</label>
                                    <div className="d-flex flex-column gap-2">
                                        {team.members_detail && team.members_detail.map(member => (
                                            <div key={member.id} style={{
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '10px',
                                                padding: '10px 14px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                backgroundColor: '#fff'
                                            }}>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div style={{
                                                        width: '36px', height: '36px', borderRadius: '50%',
                                                        background: '#64748b', color: 'white',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '14px', fontWeight: '600'
                                                    }}>
                                                        {member.full_name ? member.full_name.charAt(0).toUpperCase() : 'M'}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155', lineHeight: '1.2' }}>{member.full_name}</div>
                                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{member.designation || 'Customer Support'}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {(!team.members_detail || team.members_detail.length === 0) && (
                                            <p className="text-muted fst-italic text-center py-2" style={{ fontSize: '13px' }}>No members allocated.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="modal-footer-custom">
                            <button type="button" className="btn-close-custom" onClick={() => setExpandedTeamId(null)}>
                                Close
                            </button>
                        </div>
                    </Modal>
                );
            })()}
            

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
                .line-schedule-card {
                    background-color: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    transition: all 0.25s ease;
                }
                .line-schedule-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05) !important;
                    border-color: #cbd5e1 !important;
                }
                [data-theme-version="dark"] .line-schedule-card {
                    background-color: #2F363E;
                    border-color: #3d464e;
                }
                [data-theme-version="dark"] .line-schedule-card:hover {
                    border-color: #4a5568 !important;
                    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.25) !important;
                }
                .btn-cancel-custom,
                .btn.btn-cancel-custom,
                [data-primary] .btn.btn-cancel-custom {
                    background-color: #dc3545 !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .btn-cancel-custom:hover,
                .btn.btn-cancel-custom:hover,
                [data-primary] .btn.btn-cancel-custom:hover {
                    background-color: #bb2d3b !important;
                    border-color: #bb2d3b !important;
                }
                .btn-generate-custom {
                    background-color: #0a500f !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .btn-generate-custom:hover {
                    background-color: #073d0b !important;
                }
                .team-department-select:focus {
                    border-color: #d7d7d7 !important;
                    box-shadow: none !important;
                }
                .btn-cancel-custom:disabled, .btn-generate-custom:disabled {
                    opacity: 0.65;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
};

export default TeamManagementDashboard;
