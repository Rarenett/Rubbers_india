import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

import axiosInstance from '../../../services/AxiosInstance';
import Select, { components } from 'react-select';
import { Card, Form, Button, Row, Col, Modal, Table, Nav, Tab } from 'react-bootstrap';
import PageTitle from '../../layouts/PageTitle';



import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: '38px',
        borderColor: state.isFocused ? '#2ece8a' : '#cbd5e1',
        boxShadow: state.isFocused ? '0 0 0 3px rgba(46, 206, 138, 0.15)' : 'none',
        '&:hover': { borderColor: '#2ece8a' },
        borderRadius: '10px',
        fontSize: '13px',
        backgroundColor: '#fff',
    }),
    menu: base => ({
        ...base,
        zIndex: 9999,
        fontSize: '13px',
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
    }),
    menuPortal: base => ({ ...base, zIndex: 99999 }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected ? '#2ece8a' : state.isFocused ? 'rgba(46, 206, 138, 0.1)' : 'white',
        color: state.isSelected ? 'white' : '#334155',
        cursor: 'pointer',
        fontSize: '13px',
        padding: '8px 12px',
    }),
    multiValue: base => ({
        ...base,
        backgroundColor: '#f1f5f9',
        borderRadius: '6px',
        border: '1px solid #e2e8f0'
    }),
    multiValueLabel: base => ({
        ...base,
        color: '#1e293b',
        fontSize: '12px',
        fontWeight: '500'
    }),
    multiValueRemove: base => ({
        ...base,
        color: '#64748b',
        ':hover': {
            backgroundColor: '#fee2e2',
            color: '#ef4444'
        }
    })
};

const TeleCallingDashboard = () => {
    const navigate = useNavigate();

    const [projects, setProjects] = useState([]);
    const [leads, setLeads] = useState([]);
    const [categories, setCategories] = useState([]);
    const [users, setUsers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [stats, setStats] = useState({
        total: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0
    });
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState(null);

    useEffect(() => {
        if (!activeCategory) {
            setLeads([]);
            return;
        }
        const fetchLeadsForCategory = async () => {
            try {
                let urls = [];
                if (activeCategory === 'ALL') {
                    urls = ['/api/crm_new/leads/'];
                } else {
                    urls = [
                        `/api/crm_new/leads/?category=${activeCategory}`
                    ];
                }

                let allLeads = [];
                for (const initialUrl of urls) {
                    let nextUrl = initialUrl;
                    while (nextUrl) {
                        try {
                            const res = await axiosInstance.get(nextUrl);
                            if (res.data && res.data.results) {
                                allLeads = [...allLeads, ...res.data.results];
                                nextUrl = res.data.next ? res.data.next.replace(/^.*\/\/[^\/]+/, '') : null;
                            } else if (Array.isArray(res.data)) {
                                allLeads = [...allLeads, ...res.data];
                                nextUrl = null;
                            } else {
                                if (Array.isArray(res.data?.data)) {
                                    allLeads = [...allLeads, ...res.data.data];
                                }
                                break;
                            }
                        } catch (err) {
                            console.warn("Failed fetching from " + nextUrl, err);
                            break;
                        }
                    }
                }
                
                // Ensure unique leads across repositories
                const uniqueLeads = Array.from(new Map(allLeads.map(item => [item.id, item])).values());
                setLeads(uniqueLeads);
                
            } catch (error) {
                console.error("Error fetching leads for category", error);
            }
        };
        fetchLeadsForCategory();
    }, [activeCategory]);
        const [showTeamModal, setShowTeamModal] = useState(false);
    const [teamName, setTeamName] = useState('');
    const [teamStatus, setTeamStatus] = useState('In Progress');
    const [teamClosingDate, setTeamClosingDate] = useState('');
    const [teamLeader, setTeamLeader] = useState('');
    const [teamMembers, setTeamMembers] = useState([]);
    const [allCrmLeads, setAllCrmLeads] = useState([]);
    const [isSavingTeam, setIsSavingTeam] = useState(false);
    const [editingTeamId, setEditingTeamId] = useState(null);
    const [showAddLeadSection, setShowAddLeadSection] = useState(false);
const teamModalItemsPerPage = 5;

    const [showViewModal, setShowViewModal] = useState(false);
    const [viewProject, setViewProject] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editProject, setEditProject] = useState(null);

    // Search and Pagination State
    const [searchTerm, setSearchTerm] = useState('');
    const [projectPage, setProjectPage] = useState(1);
    const [projectPageSize, setProjectPageSize] = useState(10);
    const [leadPage, setLeadPage] = useState(1);
    const [leadPageSize, setLeadPageSize] = useState(10);

    const [activeView, setActiveView] = useState('projects'); // 'leads' or 'projects'
    const [projectView, setProjectView] = useState('card'); // 'card', 'list', or 'table'
    const [selectedLeads, setSelectedLeads] = useState([]);
    const [showModal, setShowModal] = useState(false);
    
    // Assign Lead State
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignmentType, setAssignmentType] = useState('individual'); // 'individual' or 'team'
    const [assignTargetEmployee, setAssignTargetEmployee] = useState(null);
    const [assignTargetTeam, setAssignTargetTeam] = useState(null);
    const [assignClosingDate, setAssignClosingDate] = useState('');
    const [assignLeadsList, setAssignLeadsList] = useState([]);
    const [isAssigning, setIsAssigning] = useState(false);
    const [telecallingAssignments, setTelecallingAssignments] = useState([]);
    
    // Create Project UI State
    const [allocationType, setAllocationType] = useState('individual'); // 'individual' or 'team_ID'
    const [individualAssignee, setIndividualAssignee] = useState('');
    const [projectForm, setProjectForm] = useState({
        name: '',
        target_date: ''
    });

    // Lead Allocation State (for Team Leads)
    const [currentUser, setCurrentUser] = useState(null);
    const [showAllocateModal, setShowAllocateModal] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const [unallocatedLeads, setUnallocatedLeads] = useState([]);
    const [allocatedLeads, setAllocatedLeads] = useState([]);
    const [allocationMember, setAllocationMember] = useState('');
    const [allocationLeads, setAllocationLeads] = useState([]); // Array of assignment IDs to allocate
    const [allocationView, setAllocationView] = useState('pending'); // 'pending' or 'overview'
    const [memberPerformance, setMemberPerformance] = useState([]); // [{id, total_leads, conversions, processed_leads, ...}]
    
    // Project Detail Modal State
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedDetailProject, setSelectedDetailProject] = useState(null);
    const [detailAssignments, setDetailAssignments] = useState([]);

    const fetchProjects = async () => {
        try {
            const [projRes, teleTeamRes] = await Promise.allSettled([
                axiosInstance.get('/api/crm_new/telecalling/'),
                axiosInstance.get('/api/crm_new/telecalling-teams/')
            ]);

            if (projRes.status === 'fulfilled' && projRes.value.status === 200) {
                let allProjects = projRes.value.data || [];
                if (teleTeamRes.status === 'fulfilled' && teleTeamRes.value.status === 200) {
                    const generatedTeams = teleTeamRes.value.data.map(team => ({
                        id: 'team_' + team.id,
                        name: team.name,
                        target_date: team.created_at, // Use created_at as target_date placeholder
                        closing_date: team.closing_date || (team.lead_assignments?.find(a => a.closing_date)?.closing_date) || '',
                        leads: team.lead_assignments || [],
                        status: team.status || 'In Progress',
                        progress_percentage: 0,
                        team_leader: team.team_leader,
                        team_leader_detail: team.team_leader_detail,
                        members: team.members || [],
                        members_detail: team.members_detail || []
                    }));
                    allProjects = [...allProjects, ...generatedTeams];
                }

                // Identify current user for filtering
                const userTokenData = localStorage.getItem('userDetails');
                let currentUserId = null;
                let isSuper = false;
                if (userTokenData) {
                    try {
                        const parsedData = JSON.parse(userTokenData);
                        const userObj = parsedData.user || parsedData;
                        currentUserId = userObj.id;
                        isSuper = userObj.is_superuser;
                        setCurrentUser(userObj); 
                    } catch (e) { console.error("Error parsing user details", e); }
                }

                // Filter projects: Admin sees all, Team Lead sees their own
                const filteredProjects = (isSuper ? allProjects : allProjects.filter(p => 
                    Number(p.team_leader) === Number(currentUserId) || 
                    Number(p.team_leader_detail?.id) === Number(currentUserId)
                )).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                setProjects(filteredProjects);
                setStats({
                    total: filteredProjects.length,
                    completed: filteredProjects.filter(p => p.progress_percentage === 100).length,
                    inProgress: filteredProjects.filter(p => p.progress_percentage > 0 && p.progress_percentage < 100).length,
                    notStarted: filteredProjects.filter(p => p.progress_percentage === 0).length
                });
            }
        } catch (error) {
            console.error("Error fetching projects", error);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await axiosInstance.get('/api/crm_new/categories/');
            if (res.data) {
                const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
                setCategories(data);
                return data;
            }
        } catch (err) {
            console.error("Error fetching lead categories:", err);
        }
        return [];
    };

    const fetchAllCrmLeads = async () => {
        try {
            const urls = ['/api/crm_new/leads/'];
            let allResults = [];
            for (const initialUrl of urls) {
                let nextUrl = initialUrl;
                while (nextUrl) {
                    try {
                        const res = await axiosInstance.get(nextUrl);
                        if (res.data && res.data.results) {
                            allResults = [...allResults, ...res.data.results];
                            nextUrl = res.data.next ? res.data.next.replace(/^.*\/\/[^\/]+/, '') : null;
                        } else if (Array.isArray(res.data)) {
                            allResults = [...allResults, ...res.data];
                            nextUrl = null;
                        } else {
                            if (Array.isArray(res.data?.data)) {
                                allResults = [...allResults, ...res.data.data];
                            }
                            break;
                        }
                    } catch (err) {
                        break;
                    }
                }
            }
            const unique = Array.from(new Map(allResults.map(item => [item.id, item])).values());
            setAllCrmLeads(unique);
            return unique;
        } catch (err) {
            console.error("Error fetching all CRM leads:", err);
            return [];
        }
    };

    const fetchTelecallingAssignments = async () => {
        try {
            const res = await axiosInstance.get('/api/crm_new/telecalling-assignments/');
            if (res.data) {
                const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
                setTelecallingAssignments(data);
                return data;
            }
        } catch (err) {
            console.error("Error fetching telecalling assignments:", err);
        }
        return [];
    };

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                await fetchProjects();
                fetchAllCrmLeads();
                fetchCategories();
                fetchTelecallingAssignments();
                
                // Fetch data individually to handle permission errors (e.g. 403 on /api/hr/users/?department=Telecalling for non-admins)
                const [userRes, teamRes] = await Promise.allSettled([
                    axiosInstance.get('/api/hr/users/?department=Tele Calling'),
                    axiosInstance.get('/api/teams/teams/')
                ]);
                
                if (userRes.status === 'fulfilled' && userRes.value.status === 200) {
                    const telecallingUsers = (userRes.value.data || []).filter(u => {
                        const deptName = u.department?.name || '';
                        return deptName.toLowerCase().replace(/\s+/g, '') === 'telecalling';
                    });
                    setUsers(telecallingUsers);
                } else if (userRes.status === 'rejected') {
                    console.warn("User fetch restricted. Admin features may be disabled.");
                }
                
                if (teamRes.status === 'fulfilled' && teamRes.value.status === 200) {
                    setTeams(teamRes.value.data);
                }
            } catch (error) {
                console.error("Critical error fetching tele-calling data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const handleLeadSelect = (leadId) => {
        setSelectedLeads(prev => 
            prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
        );
    };

    const handleProjectSave = async (e) => {
        e.preventDefault();
        if (selectedLeads.length === 0) {
            alert("Please select at least one lead to initialize the execution center.");
            return;
        }

        try {
            const isTeam = allocationType.startsWith('team_');
            let teamLeader = null;
            let membersList = [];

            if (isTeam) {
                const tId = parseInt(allocationType.split('_')[1]);
                const selectedTeam = teams.find(t => t.id === tId);
                teamLeader = selectedTeam ? selectedTeam.lead : null;
                membersList = selectedTeam ? selectedTeam.members : [];
            } else {
                if (!individualAssignee) {
                    alert("Please select an individual member to allocate leads.");
                    return;
                }
                teamLeader = individualAssignee;
                membersList = [individualAssignee];
            }

            const res = await axiosInstance.post('/api/crm_new/telecalling/', {
                ...projectForm,
                team_leader: teamLeader,
                members: membersList,
                category: activeCategory
            });

            if (res.status === 201) {
                const projectId = res.data.id;
                // For Teams, leads are unassigned initially. For individuals, assign directly.
                const assignments = selectedLeads.map((leadObj) => {
                                const leadId = typeof leadObj === 'object' ? leadObj.id : leadObj;
                    return axiosInstance.post('/api/crm/assignments/', {
                        lead: leadId,
                        project: projectId,
                        assignee: isTeam ? null : individualAssignee,
                        status: 'Not Contacted'
                    });
                });

                await Promise.all(assignments);
                alert("Project Synchronization Complete. Assignments Dispatched.");
                window.location.reload();
            }
        } catch (error) {
            console.error("Error creating project", error);
            alert("Project creation failed. Verify team configuration.");
        }
    };

    const handleOpenAllocate = async (project) => {
        setSelectedProject(project);
        setLoading(true);
        setAllocationView(project.allocated_count > 0 ? 'overview' : 'pending');
        try {
            // Fetch ALL assignments for this project AND performance stats for workload visibility
            const [asgnRes, perfRes] = await Promise.all([
                axiosInstance.get(`/api/crm/assignments/?project=${project.id}`),
                axiosInstance.get('/api/crm/performance-stats/')
            ]);

            if (asgnRes.status === 200) {
                const unassigned = asgnRes.data.filter(a => !a.assignee);
                const assigned = asgnRes.data.filter(a => a.assignee);
                setUnallocatedLeads(unassigned);
                setAllocatedLeads(assigned);
            }
            if (perfRes.status === 200) {
                setMemberPerformance(perfRes.data);
            }
            setShowAllocateModal(true);
        } catch (error) {
            console.error("Error fetching project assignments/performance", error);
        } finally {
            setLoading(false);
        }
    };

    const handleBatchAllocate = async () => {
        if (!allocationMember || allocationLeads.length === 0) {
            alert("Select a member and at least one lead.");
            return;
        }

        try {
            const updates = allocationLeads.map(asgnId => 
                axiosInstance.patch(`/api/crm/assignments/${asgnId}/`, {
                    assignee: allocationMember
                })
            );
            await Promise.all(updates);
            alert("Leads successfully allocated to team member.");
            // Refresh
            handleOpenAllocate(selectedProject);
            setAllocationLeads([]);
        } catch (error) {
            console.error("Error allocating leads", error);
            alert("Allocation failed.");
        }
    };

    const handleOpenDetail = async (project) => {
        setSelectedDetailProject(project);
        setLoading(true);
        try {
            const res = await axiosInstance.get(`/api/crm/assignments/?project=${project.id}`);
            if (res.status === 200) {
                setDetailAssignments(res.data);
                setShowDetailModal(true);
            }
        } catch (error) {
            console.error("Error fetching project details", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleAllocationLead = (asgnId) => {
        setAllocationLeads(prev => 
            prev.includes(asgnId) ? prev.filter(id => id !== asgnId) : [...prev, asgnId]
        );
    };

    
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

    
    
    const handleRemoveLeadFromModal = (leadId) => {
        Swal.fire({
            title: 'Remove Lead?',
            text: "Are you sure you want to remove this lead from the team?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, remove it!'
        }).then((result) => {
            if (result.isConfirmed) {
                setSelectedLeads(selectedLeads.filter(l => l.id !== leadId));
            }
        });
    };

    const handleEditTeam = (proj) => {
        setTeamName(proj.name || '');
        setTeamStatus(proj.status || 'In Progress');
        const existingClosing = proj.closing_date || (proj.leads?.find(l => l.closing_date)?.closing_date) || '';
        const formattedClosingDate = existingClosing ? String(existingClosing).split('T')[0] : '';
        setTeamClosingDate(formattedClosingDate);
        setTeamLeader(proj.team_leader || (proj.team_leader_detail ? proj.team_leader_detail.id : ''));
        const memberIds = proj.members ? (Array.isArray(proj.members) ? proj.members.map(m => typeof m === 'object' ? m.id : m) : []) : [];
        setTeamMembers(memberIds);
        const mappedLeads = (proj.leads || []).map(assignment => {
            if (assignment.lead_details) return assignment.lead_details;
            return assignment;
        }).filter(Boolean);
        setSelectedLeads(mappedLeads);
        setEditingTeamId(String(proj.id).replace('team_', ''));
        setShowAddLeadSection(false);
        if (allCrmLeads.length === 0) {
            fetchAllCrmLeads();
        }
        setShowTeamModal(true);
    };

    const handleEditSubmit = async () => {
        if (!editProject || !editProject.name.trim()) {
            Swal.fire({icon: 'warning', title: 'Validation Error', text: 'Name is required.', confirmButtonColor: '#3085d6'});
            return;
        }
        
        const isTeam = typeof editProject.id === 'string' && editProject.id.startsWith('team_');
        const realId = isTeam ? editProject.id.split('_')[1] : editProject.id;
        const statusValue = editProject.status || 'In Progress';
        
        try {
            if (isTeam) {
                await axiosInstance.patch(`/api/crm_new/telecalling-teams/${realId}/`, { 
                    name: editProject.name,
                    status: statusValue 
                });
            } else {
                await axiosInstance.patch(`/api/crm_new/telecalling/${realId}/`, { 
                    name: editProject.name,
                    status: statusValue 
                });
            }
            await fetchProjects();
            if (viewProject && String(viewProject.id) === String(editProject.id)) {
                setViewProject(prev => ({ ...prev, name: editProject.name, status: statusValue }));
            }
            Swal.fire('Updated!', 'The project/team has been updated.', 'success');
            setShowEditModal(false);
            setEditProject(null);
        } catch (error) {
            console.error("Error updating project:", error);
            Swal.fire('Error!', 'There was an error updating the record.', 'error');
        }
    };

    const totalLeadCount = allCrmLeads.length || categories.reduce((sum, cat) => sum + (Number(cat.lead_count) || 0), 0);
    const selectAllLabel = `Select All (All Repositories) — ${totalLeadCount} Leads`;

    const handleOpenAssignLeadModal = () => {
        if (allCrmLeads.length === 0) {
            fetchAllCrmLeads();
        }
        setAssignLeadsList([...selectedLeads]);
        setAssignmentType('individual');
        setAssignTargetEmployee(null);
        setAssignTargetTeam(null);
        setAssignClosingDate('');
        setShowAssignModal(true);
    };

    const handleCloseAssignModal = () => {
        setShowAssignModal(false);
        setAssignmentType('individual');
        setAssignTargetEmployee(null);
        setAssignTargetTeam(null);
        setAssignClosingDate('');
        setAssignLeadsList([]);
    };

    const handleAssignLeadsSubmit = async () => {
        if (isAssigning) return;

        if (assignmentType === 'individual' && !assignTargetEmployee) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please select a Telecalling employee to assign leads to.',
                confirmButtonColor: '#3085d6'
            });
            return;
        }

        if (assignmentType === 'team' && !assignTargetTeam) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please select a Telecalling team to assign leads to.',
                confirmButtonColor: '#3085d6'
            });
            return;
        }

        if (!assignClosingDate) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please select a Closing Date deadline for the assigned leads.',
                confirmButtonColor: '#3085d6'
            });
            return;
        }

        if (assignLeadsList.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please select at least one lead to assign.',
                confirmButtonColor: '#3085d6'
            });
            return;
        }

        setIsAssigning(true);
        try {
            const payload = {
                leads: assignLeadsList.map(l => ({
                    id: l.id,
                    source: l.category_detail?.name || l.category_name || l.lead_source || 'Direct'
                })),
                closing_date: assignClosingDate
            };

            let res;
            let destinationName = '';

            if (assignmentType === 'individual') {
                payload.employee_id = assignTargetEmployee;
                res = await axiosInstance.post('/api/crm_new/telecalling-teams/assign-individual/', payload);
                const targetEmp = users.find(u => String(u.id) === String(assignTargetEmployee));
                destinationName = targetEmp ? (targetEmp.first_name || targetEmp.last_name ? `${targetEmp.first_name} ${targetEmp.last_name}`.trim() : (targetEmp.username || 'the employee')) : 'the employee';
            } else {
                res = await axiosInstance.post(`/api/crm_new/telecalling-teams/${assignTargetTeam}/assign-leads/`, payload);
                const targetTeamObj = projects.find(p => String(p.id).replace('team_', '') === String(assignTargetTeam));
                destinationName = targetTeamObj ? targetTeamObj.name : 'the team';
            }

            if (res.status === 200 || res.status === 201) {
                handleCloseAssignModal();
                setSelectedLeads([]);
                await fetchProjects();
                fetchCategories();
                fetchAllCrmLeads();
                fetchTelecallingAssignments();
                Swal.fire({
                    icon: 'success',
                    title: 'Leads Assigned Successfully!',
                    text: `${payload.leads.length} lead(s) assigned to ${destinationName} with deadline ${assignClosingDate}.`,
                    confirmButtonColor: '#2ece8a'
                });
            }
        } catch (error) {
            console.error("Error assigning leads:", error);
            Swal.fire({
                icon: 'error',
                title: 'Assignment Failed',
                text: error.response?.data?.error || 'Failed to assign leads. Please try again.',
                confirmButtonColor: '#d33'
            });
        } finally {
            setIsAssigning(false);
        }
    };

    return (
        <>
            <PageTitle activeMenu="Telecalling" motherMenu="CRM" />
            <div className="container-fluid tele-dashboard" style={{ overflowX: 'hidden' }}>                <Card className="mb-5 pb-4 tele-card-main">
                            <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-3 tele-card-header">
                                <Card.Title className="mb-0 tele-card-title">Telecalling Management</Card.Title>
                                <div className="d-flex flex-wrap align-items-center gap-2 tele-header-actions">
                                    <div className="tele-search-container" style={{ position: 'relative' }}>
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setProjectPage(1);
                                                setLeadPage(1);
                                            }}
                                            style={{ height: '34px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>
                                    <div className="d-flex align-items-center gap-2 tele-btn-group">
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

                                        <CreateButton 
                                            module="telecalling"
                                            variant="success"
                                            className="btn-sm"
                                            style={{ backgroundColor: '#2ece8a', borderColor: '#2ece8a' }}
                                            onClick={() => {
                                                setEditingTeamId(null);
                                                setTeamName('');
                                                setTeamStatus('In Progress');
                                                setTeamClosingDate('');
                                                setTeamLeader('');
                                                setTeamMembers([]);
                                                setSelectedLeads([]);
                                                setShowAddLeadSection(false);
                                                if (allCrmLeads.length === 0) {
                                                    fetchAllCrmLeads();
                                                }
                                                setShowTeamModal(true);
                                            }}
                                        >
                                            Create Team
                                        </CreateButton>
                                    </div>
                                </div>
                            </Card.Header>
                            <Card.Body>
                                {activeView === 'leads' ? (() => {
                                    const filteredLeads = leads.filter(l => {
                                        if (!searchTerm.trim()) return true;
                                        const term = searchTerm.toLowerCase();
                                        const company = (l.company || '').toLowerCase();
                                        const name = `${l.first_name || ''} ${l.last_name || ''}`.toLowerCase();
                                        const phone = (l.phone || '').toLowerCase();
                                        const city = (l.city || '').toLowerCase();
                                        const ind = (l.industry_name || '').toLowerCase();
                                        return company.includes(term) || name.includes(term) || phone.includes(term) || city.includes(term) || ind.includes(term);
                                    });
                                    const totalLeadPages = Math.ceil(filteredLeads.length / leadPageSize);
                                    const safeLeadPage = Math.max(1, Math.min(leadPage, totalLeadPages || 1));
                                    const leadIndexLast = safeLeadPage * leadPageSize;
                                    const leadIndexFirst = leadIndexLast - leadPageSize;
                                    const currentLeads = filteredLeads.slice(leadIndexFirst, leadIndexLast);

                                    return (
                                    <>
                                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3 tele-repo-bar">
                                            <div className="tele-repo-select" style={{ minWidth: '240px', flex: '1 1 320px', maxWidth: '100%' }}>
                                                <Select
                                                    options={[
                                                        { value: 'ALL', label: selectAllLabel },
                                                        ...categories.map(cat => ({
                                                            value: cat.id,
                                                            label: `${cat.name} — ${cat.lead_count || 0} Leads`
                                                        }))
                                                    ]}
                                                    value={activeCategory === 'ALL' 
                                                        ? { value: 'ALL', label: selectAllLabel }
                                                        : categories.filter(c => c.id === activeCategory).map(cat => ({
                                                            value: cat.id,
                                                            label: `${cat.name} — ${cat.lead_count || 0} Leads`
                                                        }))[0] || null
                                                    }
                                                    onChange={(selectedOption) => {
                                                        setActiveCategory(selectedOption ? selectedOption.value : null);
                                                        setLeadPage(1);
                                                    }}
                                                    placeholder="Select Lead Repository"
                                                    isSearchable={true}
                                                />
                                            </div>
                                            <button 
                                                type="button" 
                                                className="btn btn-sm btn-primary tele-assign-btn"
                                                onClick={handleOpenAssignLeadModal}
                                            >
                                                <i className="fa fa-user-plus me-1"></i> Assign Lead {selectedLeads.length > 0 ? `(${selectedLeads.length})` : ''}
                                            </button>
                                            <button 
                                                type="button" 
                                                className="btn btn-sm btn-outline-primary"
                                                onClick={() => navigate('/crm/caller-leads')}
                                                style={{ borderRadius: '8px', fontWeight: 600, padding: '0.45rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                                title="View leads assigned to me for calling"
                                            >
                                                <i className="fa fa-phone"></i> My Assigned Leads
                                            </button>
                                        </div>
                                        {activeCategory ? (
                                        <div className="table-responsive">
                                            <table className="table table-responsive-md" style={{ minWidth: '650px' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{width: '40px'}}>
                                                            <Form.Check 
                                                                type="checkbox"
                                                                onChange={(e) => {
                                                                    if(e.target.checked) {
                                                                        const newSelections = currentLeads.filter(l => !selectedLeads.some(sl => sl.id === l.id));
                                                                        setSelectedLeads([...selectedLeads, ...newSelections]);
                                                                    } else {
                                                                        setSelectedLeads(selectedLeads.filter(sl => !currentLeads.some(l => l.id === sl.id)));
                                                                    }
                                                                }}
                                                                checked={currentLeads.length > 0 && currentLeads.every(l => selectedLeads.some(sl => sl.id === l.id))}
                                                            />
                                                        </th>
                                                        <th><strong>COMPANY</strong></th>
                                                        <th><strong>CONTACT</strong></th>
                                                        <th><strong>LOCATION</strong></th>
                                                        <th><strong>ADDED BY</strong></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {currentLeads.length > 0 ? currentLeads.map(lead => (
                                                        <tr key={lead.id} style={{ verticalAlign: 'middle' }}>
                                                            <td>
                                                                <Form.Check 
                                                                    type="checkbox"
                                                                    checked={selectedLeads.some(sl => sl.id === lead.id)}
                                                                    onChange={() => {
                                                                        if (selectedLeads.some(sl => sl.id === lead.id)) {
                                                                            setSelectedLeads(selectedLeads.filter(sl => sl.id !== lead.id));
                                                                        } else {
                                                                            setSelectedLeads([...selectedLeads, lead]);
                                                                        }
                                                                    }}
                                                                />
                                                            </td>
                                                            <td>
                                                                <strong>{lead.company}</strong><br/>
                                                                <small className="text-muted">{lead.industry_name}</small>
                                                                {activeCategory === 'ALL' && lead.category_detail && (
                                                                    <div className="mt-1"><span className="badge bg-primary-light text-primary py-1 px-2">{lead.category_detail.name}</span></div>
                                                                )}
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
                                                            <td colSpan="6" className="text-center py-4 text-muted">No leads available</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>

                                            {filteredLeads.length > 0 && (
                                                <div className="d-flex justify-content-between align-items-center mt-3 mb-4 flex-wrap gap-2">
                                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                                        Showing {leadIndexFirst + 1} to {Math.min(leadIndexLast, filteredLeads.length)} of {filteredLeads.length} entries
                                                    </div>
                                                    {totalLeadPages > 1 && (
                                                        <nav>
                                                            <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                                <li className={`page-item page-indicator ${safeLeadPage === 1 ? 'disabled' : ''}`}>
                                                                    <button type="button" className="page-link" onClick={() => setLeadPage(prev => Math.max(prev - 1, 1))} disabled={safeLeadPage === 1} style={{ border: 'none', background: 'none' }}>
                                                                        <i className="la la-angle-left" />
                                                                    </button>
                                                                </li>
                                                                {Array.from({ length: totalLeadPages }, (_, index) => {
                                                                    const pageNumber = index + 1;
                                                                    if (
                                                                        pageNumber === 1 ||
                                                                        pageNumber === totalLeadPages ||
                                                                        (pageNumber >= safeLeadPage - 1 && pageNumber <= safeLeadPage + 1)
                                                                    ) {
                                                                        return (
                                                                            <li key={pageNumber} className={`page-item ${safeLeadPage === pageNumber ? 'active' : ''}`}>
                                                                                <button type="button" className="page-link" onClick={() => setLeadPage(pageNumber)} style={{ border: 'none' }}>
                                                                                    {pageNumber}
                                                                                </button>
                                                                            </li>
                                                                        );
                                                                    } else if (
                                                                        pageNumber === safeLeadPage - 2 ||
                                                                        pageNumber === safeLeadPage + 2
                                                                    ) {
                                                                        return (
                                                                            <li key={pageNumber} className="page-item disabled">
                                                                                <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                                            </li>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })}
                                                                <li className={`page-item page-indicator ${safeLeadPage === totalLeadPages ? 'disabled' : ''}`}>
                                                                    <button type="button" className="page-link" onClick={() => setLeadPage(prev => Math.min(prev + 1, totalLeadPages))} disabled={safeLeadPage === totalLeadPages} style={{ border: 'none', background: 'none' }}>
                                                                        <i className="la la-angle-right" />
                                                                    </button>
                                                                </li>
                                                            </ul>
                                                        </nav>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        ) : (
                                            <div className="text-center py-5 text-muted">
                                                <i className="fa fa-folder-open mb-3" style={{ fontSize: '3rem', opacity: 0.5 }}></i>
                                                <h5>Select Lead Repository</h5>
                                                <p>Please select a repository from the dropdown above to view its leads.</p>
                                            </div>
                                        )}
                                    </>
                                    );
                                })() : (() => {
                                    const filteredProjects = projects.filter(p => {
                                        if (!searchTerm.trim()) return true;
                                        const term = searchTerm.toLowerCase();
                                        const name = (p.name || '').toLowerCase();
                                        const status = (p.status || '').toLowerCase();
                                        const teamLead = (p.team_leader_detail?.first_name || p.team_leader_detail?.username || '').toLowerCase();
                                        return name.includes(term) || status.includes(term) || teamLead.includes(term);
                                    });
                                    const totalProjPages = Math.ceil(filteredProjects.length / projectPageSize);
                                    const safeProjPage = Math.max(1, Math.min(projectPage, totalProjPages || 1));
                                    const projIndexLast = safeProjPage * projectPageSize;
                                    const projIndexFirst = projIndexLast - projectPageSize;
                                    const currentProjects = filteredProjects.slice(projIndexFirst, projIndexLast);

                                    return (
                                    <div className="table-responsive">
                                        <table className="table table-responsive-md" style={{ minWidth: '600px' }}>
                                            <thead>
                                                <tr>
                                                    <th><strong>SI NO</strong></th>
                                                    <th><strong>PROJECT NAME</strong></th>
                                                    <th><strong>TARGET DATE</strong></th>
                                                    <th><strong>LEADS</strong></th>
                                                    <th><strong>STATUS</strong></th>
                                                    <th><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentProjects.length > 0 ? currentProjects.map((proj, idx) => (
                                                    <tr key={proj.id} style={{ verticalAlign: 'middle' }}>
                                                        <td><strong>{projIndexFirst + idx + 1}</strong></td>
                                                        <td><strong>{proj.name}</strong></td>
                                                        <td>{new Date(proj.target_date).toLocaleDateString()}</td>
                                                        <td><span className="badge badge-info light">{proj.leads?.length || 0} Leads</span></td>
                                                        <td>
                                                            <span className={`badge ${proj.status === 'Completed' ? 'badge-success' : proj.status === 'In Progress' ? 'badge-warning' : 'badge-light text-muted border'} light`}>
                                                                {proj.status}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="d-flex justify-content-end align-items-center gap-2">
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
                                                                            setEditProject({
                                                                                ...proj,
                                                                                status: proj.status || 'In Progress'
                                                                            });
                                                                            setShowEditModal(true);
                                                                        }
                                                                    }}
                                                                />
                                                                <DeleteButton 
                                                                    module="telecalling"
                                                                    onClick={() => handleDeleteProject(proj.id)}
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan="6" className="text-center py-4 text-muted">No projects available</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>

                                        {filteredProjects.length > 0 && (
                                            <div className="d-flex justify-content-between align-items-center mt-3 mb-4 flex-wrap gap-2">
                                                <div className="text-muted" style={{ fontSize: '13px' }}>
                                                    Showing {projIndexFirst + 1} to {Math.min(projIndexLast, filteredProjects.length)} of {filteredProjects.length} entries
                                                </div>
                                                {totalProjPages > 1 && (
                                                    <nav>
                                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                            <li className={`page-item page-indicator ${safeProjPage === 1 ? 'disabled' : ''}`}>
                                                                <button type="button" className="page-link" onClick={() => setProjectPage(prev => Math.max(prev - 1, 1))} disabled={safeProjPage === 1} style={{ border: 'none', background: 'none' }}>
                                                                    <i className="la la-angle-left" />
                                                                </button>
                                                            </li>
                                                            {Array.from({ length: totalProjPages }, (_, index) => {
                                                                const pageNumber = index + 1;
                                                                if (
                                                                    pageNumber === 1 ||
                                                                    pageNumber === totalProjPages ||
                                                                    (pageNumber >= safeProjPage - 1 && pageNumber <= safeProjPage + 1)
                                                                ) {
                                                                    return (
                                                                        <li key={pageNumber} className={`page-item ${safeProjPage === pageNumber ? 'active' : ''}`}>
                                                                            <button type="button" className="page-link" onClick={() => setProjectPage(pageNumber)} style={{ border: 'none' }}>
                                                                                {pageNumber}
                                                                            </button>
                                                                        </li>
                                                                    );
                                                                } else if (
                                                                    pageNumber === safeProjPage - 2 ||
                                                                    pageNumber === safeProjPage + 2
                                                                ) {
                                                                    return (
                                                                        <li key={pageNumber} className="page-item disabled">
                                                                            <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                                        </li>
                                                                    );
                                                                }
                                                                return null;
                                                            })}
                                                            <li className={`page-item page-indicator ${safeProjPage === totalProjPages ? 'disabled' : ''}`}>
                                                                <button type="button" className="page-link" onClick={() => setProjectPage(prev => Math.min(prev + 1, totalProjPages))} disabled={safeProjPage === totalProjPages} style={{ border: 'none', background: 'none' }}>
                                                                    <i className="la la-angle-right" />
                                                                </button>
                                                            </li>
                                                        </ul>
                                                    </nav>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    );
                                })()}
                            </Card.Body>
                        </Card>
            </div>

            {/* Initialization Modal */}

            {/* Assign Lead Modal */}
            <Modal
                show={showAssignModal}
                onHide={handleCloseAssignModal}
                dialogClassName="item-custom-modal"
                backdrop="static"
                keyboard={false}
                restoreFocus={false}
                size="md"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-user-plus" style={{ color: 'white', fontSize: '20px' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Assign Leads
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Assign selected leads to an individual employee or team with closing date
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        className="modal-close-x" 
                        onClick={handleCloseAssignModal}
                    >
                        &times;
                    </button>
                </div>

                <div className="modal-body-custom">
                    <Form onSubmit={(e) => e.preventDefault()}>
                        {/* 1. Assign To (Type) */}
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">
                                Assign To <span className="text-danger">*</span>
                            </Form.Label>
                            <div className="d-flex align-items-center gap-4 mt-1">
                                <Form.Check
                                    inline
                                    type="radio"
                                    id="assign-to-individual"
                                    name="assignmentType"
                                    label={<strong>Individual</strong>}
                                    checked={assignmentType === 'individual'}
                                    onChange={() => setAssignmentType('individual')}
                                    style={{ cursor: 'pointer' }}
                                />
                                <Form.Check
                                    inline
                                    type="radio"
                                    id="assign-to-team"
                                    name="assignmentType"
                                    label={<strong>Team</strong>}
                                    checked={assignmentType === 'team'}
                                    onChange={() => setAssignmentType('team')}
                                    style={{ cursor: 'pointer' }}
                                />
                            </div>
                        </div>

                        {/* 2. Destination Selector (Individual or Team) */}
                        {assignmentType === 'individual' ? (
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">
                                    Select Telecalling Employee <span className="text-danger">*</span>
                                </Form.Label>
                                {users.length === 0 ? (
                                    <div className="alert alert-warning py-2 px-3 mb-0" style={{ fontSize: '13px' }}>
                                        No Telecalling employees found.
                                    </div>
                                ) : (
                                    <>
                                        <Select
                                            options={users.map(u => ({
                                                value: u.id,
                                                label: (u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : (u.username || u.email)) + (u.designation?.title ? ` (${u.designation.title})` : ''),
                                                user: u
                                            }))}
                                            value={
                                                assignTargetEmployee
                                                    ? users
                                                        .filter(u => String(u.id) === String(assignTargetEmployee))
                                                        .map(u => ({
                                                            value: u.id,
                                                            label: (u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : (u.username || u.email)) + (u.designation?.title ? ` (${u.designation.title})` : ''),
                                                            user: u
                                                        }))[0] || null
                                                    : null
                                            }
                                            onChange={(opt) => setAssignTargetEmployee(opt ? opt.value : null)}
                                            placeholder="Select a Telecalling employee..."
                                            isSearchable={true}
                                            classNamePrefix="react-select"
                                            styles={selectStyles}
                                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                            menuPosition="fixed"
                                        />
                                        {assignTargetEmployee && (() => {
                                            const curEmp = users.find(u => String(u.id) === String(assignTargetEmployee));
                                            if (!curEmp) return null;
                                            const empAssignedCount = telecallingAssignments.filter(a => String(a.employee) === String(curEmp.id)).length;
                                            return (
                                                <div className="mt-2 p-2 bg-light border rounded" style={{ fontSize: '12px' }}>
                                                    <div className="row g-2">
                                                        <div className="col-6">
                                                            <span className="text-muted">Employee:</span> <strong>{(curEmp.first_name || curEmp.last_name ? `${curEmp.first_name} ${curEmp.last_name}`.trim() : (curEmp.username || curEmp.email))}</strong>
                                                        </div>
                                                        <div className="col-6">
                                                            <span className="text-muted">Designation:</span> <strong>{curEmp.designation?.title || 'Telecalling Agent'}</strong>
                                                        </div>
                                                        <div className="col-6">
                                                            <span className="text-muted">Email:</span> <span className="text-dark font-w500">{curEmp.email || curEmp.username}</span>
                                                        </div>
                                                        <div className="col-6">
                                                            <span className="text-muted">Assigned Leads:</span> <span className="badge badge-info light py-1 px-2">{empAssignedCount} Leads</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">
                                    Select Team <span className="text-danger">*</span>
                                </Form.Label>
                                {projects.filter(p => String(p.id).startsWith('team_')).length === 0 ? (
                                    <div className="alert alert-warning py-2 px-3 mb-0" style={{ fontSize: '13px' }}>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <span>No Telecalling teams found.</span>
                                            <button 
                                                type="button" 
                                                className="btn btn-xs btn-primary ms-2"
                                                onClick={() => {
                                                    handleCloseAssignModal();
                                                    setShowTeamModal(true);
                                                }}
                                            >
                                                <i className="fa fa-plus me-1"></i> Create Team
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <Select
                                            options={projects
                                                .filter(p => String(p.id).startsWith('team_'))
                                                .map(team => ({
                                                    value: String(team.id).replace('team_', ''),
                                                    label: `${team.name}${team.team_leader_detail?.full_name ? ` (Leader: ${team.team_leader_detail.full_name})` : ''}`,
                                                    team: team
                                                }))
                                            }
                                            value={
                                                assignTargetTeam
                                                    ? projects
                                                        .filter(p => String(p.id).startsWith('team_'))
                                                        .filter(team => String(team.id).replace('team_', '') === String(assignTargetTeam))
                                                        .map(team => ({
                                                            value: String(team.id).replace('team_', ''),
                                                            label: `${team.name}${team.team_leader_detail?.full_name ? ` (Leader: ${team.team_leader_detail.full_name})` : ''}`,
                                                            team: team
                                                        }))[0] || null
                                                    : null
                                            }
                                            onChange={(opt) => setAssignTargetTeam(opt ? opt.value : null)}
                                            placeholder="Select a Telecalling team..."
                                            isSearchable={true}
                                            classNamePrefix="react-select"
                                            styles={selectStyles}
                                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                            menuPosition="fixed"
                                        />
                                        {assignTargetTeam && (() => {
                                            const curTeam = projects.find(p => String(p.id).replace('team_', '') === String(assignTargetTeam));
                                            if (!curTeam) return null;
                                            return (
                                                <div className="mt-2 p-2 bg-light border rounded" style={{ fontSize: '12px' }}>
                                                    <div className="row g-2">
                                                        <div className="col-6">
                                                            <span className="text-muted">Team Leader:</span> <strong>{curTeam.team_leader_detail?.full_name || 'None'}</strong>
                                                        </div>
                                                        <div className="col-6">
                                                            <span className="text-muted">Members:</span> <strong>{curTeam.members_detail?.length || curTeam.members?.length || 0}</strong>
                                                        </div>
                                                        <div className="col-12">
                                                            <span className="text-muted">Already Assigned Leads:</span> <span className="badge badge-info light py-1 px-2">{curTeam.leads?.length || 0} Leads</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </>
                                )}
                            </div>
                        )}

                        {/* 3. Closing Date */}
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">
                                Closing Date <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                                type="date"
                                className="form-control-custom"
                                value={assignClosingDate}
                                onChange={(e) => setAssignClosingDate(e.target.value)}
                                required
                            />
                            <small className="text-muted d-block mt-1" style={{ fontSize: '11.5px' }}>
                                Deadline for completing the assigned lead follow-up.
                            </small>
                        </div>

                        {/* 4. Search & Add More Leads */}
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">
                                Search and Add Leads
                            </Form.Label>
                            <Select
                                options={allCrmLeads
                                    .filter(lead => !assignLeadsList.some(sl => sl.id === lead.id))
                                    .map(lead => ({
                                        value: lead.id,
                                        label: `${lead.company || 'Unnamed Company'} — ${lead.first_name || ''} ${lead.last_name || ''} (${lead.category_detail?.name || lead.category_name || lead.lead_source || 'Direct'})`.trim(),
                                        lead: lead
                                    }))
                                }
                                value={null}
                                onChange={(opt) => {
                                    if (opt && opt.lead) {
                                        setAssignLeadsList(prev => [...prev, opt.lead]);
                                    }
                                }}
                                placeholder="Search leads by company, name, or repository..."
                                isSearchable={true}
                                noOptionsMessage={() => "No more leads available"}
                                classNamePrefix="react-select"
                                styles={selectStyles}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                menuPosition="fixed"
                            />
                        </div>

                        {/* 5. Selected Leads List */}
                        <div className="mb-2">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <Form.Label className="form-label-custom mb-0">
                                    Selected Leads to Assign ({assignLeadsList.length})
                                </Form.Label>
                                {assignLeadsList.length > 0 && (
                                    <button
                                        type="button"
                                        className="btn btn-link text-danger p-0 text-decoration-none"
                                        style={{ fontSize: '11.5px' }}
                                        onClick={() => setAssignLeadsList([])}
                                    >
                                        Clear All
                                    </button>
                                )}
                            </div>

                            {assignLeadsList.length > 0 ? (
                                <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                                    <table className="table mb-0">
                                        <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                                            <tr>
                                                <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b' }}><strong>LEAD</strong></th>
                                                <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b' }}><strong>PHONE</strong></th>
                                                <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b', textAlign: 'right' }}><strong>REPOSITORY / ACTION</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {assignLeadsList.map((lead) => (
                                                <tr key={lead.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                                                        <div style={{ fontWeight: '500', color: '#1e293b', fontSize: '12.5px' }}>
                                                            {lead.company || `${lead.first_name || ''} ${lead.last_name || ''}` || `Lead #${lead.id}`}
                                                        </div>
                                                        {(lead.first_name || lead.last_name) && lead.company && (
                                                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                                {lead.first_name} {lead.last_name}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '8px 12px', verticalAlign: 'middle', fontSize: '12px', color: '#475569' }}>
                                                        {lead.phone || lead.mobile || '—'}
                                                    </td>
                                                    <td style={{ padding: '8px 12px', verticalAlign: 'middle', textAlign: 'right' }}>
                                                        <div className="d-flex align-items-center justify-content-end gap-2">
                                                            <span className="badge badge-light border text-primary" style={{ fontSize: '11px' }}>
                                                                {lead.category_detail?.name || lead.category_name || lead.lead_source || 'Direct'}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-danger shadow-sm"
                                                                style={{ width: '26px', height: '26px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '11px', borderRadius: '4px' }}
                                                                title="Remove lead"
                                                                onClick={() => {
                                                                    setAssignLeadsList(prev => prev.filter(item => item.id !== lead.id));
                                                                }}
                                                            >
                                                                <i className="fa fa-trash"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-3 text-muted border rounded" style={{ fontSize: '12px', backgroundColor: '#f8fafc' }}>
                                    No leads selected. Check leads in the table or search leads above to assign.
                                </div>
                            )}
                        </div>
                    </Form>
                </div>

                <div className="modal-footer-custom">
                    <button
                        type="button"
                        className="btn-close-custom"
                        disabled={isAssigning}
                        onClick={handleCloseAssignModal}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-save-custom"
                        disabled={
                            isAssigning ||
                            (assignmentType === 'individual' ? !assignTargetEmployee : !assignTargetTeam) ||
                            !assignClosingDate ||
                            assignLeadsList.length === 0
                        }
                        onClick={handleAssignLeadsSubmit}
                    >
                        {isAssigning ? (
                            <>
                                <i className="fa fa-spinner fa-spin me-1"></i> Assigning...
                            </>
                        ) : (
                            <>
                                <i className="fa fa-check me-1"></i> Assign Leads
                            </>
                        )}
                    </button>
                </div>
            </Modal>

            {/* Make Team Modal */}
            <Modal 
                show={showTeamModal} 
                onHide={() => { setShowTeamModal(false); setTeamName(''); setTeamStatus('In Progress'); setTeamClosingDate(''); setTeamLeader(''); setTeamMembers([]); setSelectedLeads([]); setEditingTeamId(null); setShowAddLeadSection(false); }} 
                dialogClassName="item-custom-modal"
                backdrop="static"
                keyboard={false}
                restoreFocus={false}
                size="md" 
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-users" style={{ color: 'white', fontSize: '20px' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editingTeamId ? 'Edit Telecalling Team' : 'Create Telecalling Team'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                {editingTeamId ? 'Manage your team and assigned leads' : 'Configure a team with Telecalling department employees'}
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => { setShowTeamModal(false); setTeamName(''); setTeamStatus('In Progress'); setTeamClosingDate(''); setTeamLeader(''); setTeamMembers([]); setSelectedLeads([]); setEditingTeamId(null); setShowAddLeadSection(false); }}>
                        &times;
                    </button>
                </div>
                
                <div className="modal-body-custom">
                    <Form onSubmit={(e) => e.preventDefault()}>
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Team Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control 
                                type="text" 
                                className="form-control-custom"
                                placeholder="Enter team name" 
                                value={teamName} 
                                onChange={e => setTeamName(e.target.value)} 
                            />
                        </div>

                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Department</Form.Label>
                            <Form.Control 
                                type="text" 
                                className="form-control-custom"
                                value="Telecalling" 
                                readOnly 
                                disabled 
                                style={{ backgroundColor: '#f8fafc', color: '#334155', cursor: 'not-allowed', fontWeight: '500' }}
                            />
                        </div>

                        {editingTeamId && (
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Status <span className="text-danger">*</span></Form.Label>
                                <Form.Select
                                    className="form-control-custom"
                                    value={teamStatus || 'In Progress'}
                                    onChange={e => setTeamStatus(e.target.value)}
                                >
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Not Started">Not Started</option>
                                    <option value="On Hold">On Hold</option>
                                </Form.Select>
                            </div>
                        )}

                        {editingTeamId && (
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Closing Date</Form.Label>
                                <Form.Control 
                                    type="date" 
                                    className="form-control-custom"
                                    value={teamClosingDate} 
                                    onChange={e => setTeamClosingDate(e.target.value)} 
                                />
                                <small className="text-muted d-block mt-1" style={{ fontSize: '11.5px' }}>
                                    Deadline for completing the assigned lead follow-up.
                                </small>
                            </div>
                        )}

                        {/* Team Members Selection */}
                        <div className="mb-3">
                            <Form.Label className="form-label-custom mb-1">Team Members <span className="text-danger">*</span></Form.Label>
                            {users.length > 0 ? (
                                <>
                                    <Select
                                        isMulti
                                        options={users.map(u => ({
                                            value: u.id,
                                            label: (u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : (u.username || u.email)) + (u.designation?.title ? ` (${u.designation.title})` : '')
                                        }))}
                                        value={users
                                            .filter(u => teamMembers.includes(u.id))
                                            .map(u => ({
                                                value: u.id,
                                                label: (u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : (u.username || u.email)) + (u.designation?.title ? ` (${u.designation.title})` : '')
                                            }))
                                        }
                                        onChange={(selectedOptions) => {
                                            const newMembers = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
                                            setTeamMembers(newMembers);
                                            if (teamLeader && !newMembers.some(id => String(id) === String(teamLeader))) {
                                                setTeamLeader('');
                                            }
                                        }}
                                        placeholder="Search and select Telecalling team members..."
                                        classNamePrefix="react-select"
                                        isSearchable={true}
                                        styles={selectStyles}
                                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                        menuPosition="fixed"
                                    />

                                    {/* Display Selected Employees as Rows */}
                                    {teamMembers.length > 0 && (
                                        <div className="mt-3 d-flex flex-column gap-2">
                                            {users.filter(u => teamMembers.includes(u.id)).map(u => {
                                                const isLeader = String(teamLeader) === String(u.id);
                                                const fullName = (u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : (u.username || u.email));
                                                const roleOrDesignation = u.designation?.title || (typeof u.designation === 'string' ? u.designation : '') || 'Telecalling Executive';
                                                
                                                // Extract initials (e.g. "John Doe" -> "JD")
                                                const nameWords = fullName.trim().split(/\s+/).filter(Boolean);
                                                const initials = nameWords.length > 1
                                                    ? `${nameWords[0][0]}${nameWords[nameWords.length - 1][0]}`.toUpperCase()
                                                    : (nameWords[0] ? nameWords[0].slice(0, 2).toUpperCase() : 'TC');

                                                return (
                                                    <div
                                                        key={u.id}
                                                        className="d-flex align-items-center justify-content-between p-2 rounded tele-employee-row"
                                                        style={{
                                                            backgroundColor: isLeader ? '#f0fdf4' : '#f8fafc',
                                                            border: isLeader ? '1px solid #86efac' : '1px solid #e2e8f0',
                                                            transition: 'all 0.2s ease',
                                                            gap: '8px'
                                                        }}
                                                    >
                                                        {/* Left side: Selection indicator, Circular Avatar, Name & Designation */}
                                                        <div className="d-flex align-items-center gap-2 gap-sm-3 tele-emp-info" style={{ minWidth: 0, flex: '1 1 auto' }}>
                                                            {/* Green selection indicator */}
                                                            <div
                                                                style={{
                                                                    width: '18px',
                                                                    height: '18px',
                                                                    borderRadius: '4px',
                                                                    backgroundColor: '#2ece8a',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    color: '#ffffff',
                                                                    fontSize: '11px',
                                                                    flexShrink: 0
                                                                }}
                                                                title="Selected Team Member"
                                                            >
                                                                <i className="fa fa-check"></i>
                                                            </div>

                                                            {/* Circular avatar with initials */}
                                                            <div
                                                                style={{
                                                                    width: '38px',
                                                                    height: '38px',
                                                                    borderRadius: '50%',
                                                                    backgroundColor: isLeader ? '#dcfce7' : '#e0e7ff',
                                                                    color: isLeader ? '#15803d' : '#4338ca',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontWeight: '600',
                                                                    fontSize: '13px',
                                                                    flexShrink: 0,
                                                                    border: isLeader ? '1.5px solid #86efac' : '1.5px solid #c7d2fe'
                                                                }}
                                                            >
                                                                {initials}
                                                            </div>

                                                            {/* Employee details */}
                                                            <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                                                <div 
                                                                    style={{ 
                                                                        fontSize: '13.5px', 
                                                                        fontWeight: isLeader ? '600' : '500', 
                                                                        color: '#1e293b',
                                                                        lineHeight: '1.2',
                                                                        whiteSpace: 'nowrap',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis'
                                                                    }}
                                                                >
                                                                    {fullName}
                                                                </div>
                                                                <div 
                                                                    style={{ 
                                                                        fontSize: '11.5px', 
                                                                        color: '#64748b', 
                                                                        marginTop: '2px',
                                                                        whiteSpace: 'nowrap',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis'
                                                                    }}
                                                                >
                                                                    {roleOrDesignation}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Right side: Team Leader designation action */}
                                                        <div className="d-flex align-items-center gap-1 gap-sm-2 flex-shrink-0 tele-emp-actions">
                                                            {isLeader && (
                                                                <span 
                                                                    className="badge"
                                                                    style={{ 
                                                                        fontSize: '11px', 
                                                                        fontWeight: '600', 
                                                                        backgroundColor: '#fef3c7', 
                                                                        color: '#92400e',
                                                                        border: '1px solid #fde68a',
                                                                        padding: '4px 8px',
                                                                        borderRadius: '4px'
                                                                    }}
                                                                >
                                                                    Team Leader
                                                                </span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                className="btn p-0"
                                                                onClick={() => setTeamLeader(prev => String(prev) === String(u.id) ? '' : String(u.id))}
                                                                title={isLeader ? "Team Leader (Click to remove designation)" : "Make Team Leader"}
                                                                aria-label="Make Team Leader"
                                                                style={{ 
                                                                    cursor: 'pointer',
                                                                    width: '34px',
                                                                    height: '34px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    borderRadius: '50%',
                                                                    backgroundColor: isLeader ? '#fef3c7' : '#f8fafc',
                                                                    border: isLeader ? '1.5px solid #f59e0b' : '1.5px solid #cbd5e1',
                                                                    boxShadow: isLeader ? '0 0 0 2px rgba(245, 158, 11, 0.25)' : 'none',
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    if (!isLeader) {
                                                                        e.currentTarget.style.backgroundColor = '#fef9c3';
                                                                        e.currentTarget.style.borderColor = '#f59e0b';
                                                                        const starSvg = e.currentTarget.querySelector('svg');
                                                                        if (starSvg) starSvg.setAttribute('stroke', '#d97706');
                                                                    }
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    if (!isLeader) {
                                                                        e.currentTarget.style.backgroundColor = '#f8fafc';
                                                                        e.currentTarget.style.borderColor = '#cbd5e1';
                                                                        const starSvg = e.currentTarget.querySelector('svg');
                                                                        if (starSvg) starSvg.setAttribute('stroke', '#94a3b8');
                                                                    }
                                                                }}
                                                            >
                                                                <svg 
                                                                    width="18" 
                                                                    height="18" 
                                                                    viewBox="0 0 24 24" 
                                                                    fill={isLeader ? "#f59e0b" : "none"} 
                                                                    stroke={isLeader ? "#d97706" : "#94a3b8"} 
                                                                    strokeWidth="2" 
                                                                    strokeLinecap="round" 
                                                                    strokeLinejoin="round"
                                                                    style={{ 
                                                                        transition: 'all 0.15s ease',
                                                                        display: 'block'
                                                                    }}
                                                                >
                                                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="alert alert-warning py-2 mb-0" style={{ fontSize: '13px' }}>
                                    No eligible Telecalling employees available.
                                </div>
                            )}
                        </div>
                        
                        {/* Assign Leads - Optional (Only when editing an existing team) */}
                        {editingTeamId && (
                            <div className="mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <Form.Label className="form-label-custom mb-0">Assign Leads</Form.Label>
                                    <Button 
                                        variant="outline-success" 
                                        size="sm" 
                                        style={{ fontSize: '11.5px', padding: '2px 8px' }}
                                        onClick={() => {
                                            if (!showAddLeadSection && !activeCategory && categories.length > 0) {
                                                setActiveCategory('ALL');
                                            }
                                            setShowAddLeadSection(!showAddLeadSection);
                                        }}
                                    >
                                        <i className={`fa ${showAddLeadSection ? 'fa-minus' : 'fa-plus'} me-1`}></i> {showAddLeadSection ? 'Hide Repositories' : 'Browse Repositories'}
                                    </Button>
                                </div>
                            <Select
                                isMulti
                                options={allCrmLeads.map(lead => {
                                    const nameParts = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
                                    const leadTitle = lead.company 
                                        ? `${lead.company}${nameParts ? ` (${nameParts})` : ''}` 
                                        : (nameParts || `Lead #${lead.id}`);
                                    const categoryName = lead.category_detail?.name || lead.category_name || (typeof lead.category === 'object' ? lead.category?.name : '') || lead.lead_source;
                                    const label = categoryName ? `${leadTitle} [${categoryName}]` : leadTitle;
                                    return {
                                        value: lead.id,
                                        label: label,
                                        leadObj: lead
                                    };
                                })}
                                value={selectedLeads.map(lead => {
                                    const nameParts = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
                                    const leadTitle = lead.company 
                                        ? `${lead.company}${nameParts ? ` (${nameParts})` : ''}` 
                                        : (nameParts || `Lead #${lead.id}`);
                                    const categoryName = lead.category_detail?.name || lead.category_name || (typeof lead.category === 'object' ? lead.category?.name : '') || lead.lead_source;
                                    const label = categoryName ? `${leadTitle} [${categoryName}]` : leadTitle;
                                    return {
                                        value: lead.id,
                                        label: label,
                                        leadObj: lead
                                    };
                                })}
                                onChange={(selectedOptions) => {
                                    if (!selectedOptions || selectedOptions.length === 0) {
                                        setSelectedLeads([]);
                                    } else {
                                        const updated = selectedOptions.map(opt => {
                                            const existing = selectedLeads.find(l => l.id === opt.value);
                                            if (existing) return existing;
                                            const fromAll = allCrmLeads.find(l => l.id === opt.value);
                                            return fromAll || opt.leadObj || { id: opt.value };
                                        });
                                        setSelectedLeads(updated);
                                    }
                                }}
                                placeholder="Search and select leads to assign..."
                                classNamePrefix="react-select"
                                isSearchable={true}
                                styles={selectStyles}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                menuPosition="fixed"
                            />
                            <small className="text-muted d-block mt-1" style={{ fontSize: '11.5px' }}>
                                Optional. You can search and select leads to assign to this team.
                            </small>
                        </div>
                        )}

                        {editingTeamId && showAddLeadSection && (
                            <div className="mb-3 p-3 bg-light rounded border">
                                <h6 className="mb-3" style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Browse Leads by Repository</h6>
                                <Select
                                    options={[
                                        { value: 'ALL', label: selectAllLabel },
                                        ...categories.map(cat => ({
                                            value: cat.id,
                                            label: `${cat.name} — ${cat.lead_count || 0} Leads`
                                        }))
                                    ]}
                                    value={activeCategory === 'ALL' 
                                        ? { value: 'ALL', label: selectAllLabel }
                                        : categories.filter(c => c.id === activeCategory).map(cat => ({
                                            value: cat.id,
                                            label: `${cat.name} — ${cat.lead_count || 0} Leads`
                                        }))[0] || null
                                    }
                                    onChange={(selectedOption) => {
                                        setActiveCategory(selectedOption ? selectedOption.value : null);
                                    }}
                                    placeholder="Select Lead Repository"
                                    isSearchable={true}
                                    classNamePrefix="react-select"
                                    styles={selectStyles}
                                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                    menuPosition="fixed"
                                />
                                {activeCategory && leads.length > 0 ? (
                                    <div className="table-responsive bg-white border rounded" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                        <table className="table table-sm mb-0">
                                            <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                                                <tr>
                                                    <th style={{ width: '40px', padding: '8px 12px' }}>
                                                        <Form.Check 
                                                            type="checkbox"
                                                            onChange={(e) => {
                                                                if(e.target.checked) {
                                                                    const newSelections = leads.filter(l => !selectedLeads.some(sl => sl.id === l.id));
                                                                    setSelectedLeads([...selectedLeads, ...newSelections]);
                                                                } else {
                                                                    setSelectedLeads(selectedLeads.filter(sl => !leads.some(l => l.id === sl.id)));
                                                                }
                                                            }}
                                                            checked={leads.length > 0 && leads.every(l => selectedLeads.some(sl => sl.id === l.id))}
                                                        />
                                                    </th>
                                                    <th style={{ padding: '8px 12px', fontSize: '11px', color: '#64748b' }}>LEAD INFO</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {leads.map(lead => (
                                                    <tr key={lead.id}>
                                                        <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                                                            <Form.Check 
                                                                type="checkbox"
                                                                checked={selectedLeads.some(sl => sl.id === lead.id)}
                                                                onChange={() => {
                                                                    if (selectedLeads.some(sl => sl.id === lead.id)) {
                                                                        setSelectedLeads(selectedLeads.filter(sl => sl.id !== lead.id));
                                                                    } else {
                                                                        setSelectedLeads([...selectedLeads, lead]);
                                                                    }
                                                                }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                                                            <div style={{ fontSize: '13px', fontWeight: '500' }}>
                                                                {lead.company ? `${lead.company} - ` : ''}{lead.first_name} {lead.last_name}
                                                            </div>
                                                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                                {lead.city}{lead.city && lead.country ? ', ' : ''}{lead.country} | {lead.phone}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-3 text-muted" style={{ fontSize: '13px' }}>
                                        {activeCategory ? 'No leads available in this repository.' : 'Select a repository to view leads.'}
                                    </div>
                                )}
                            </div>
                        )}
                        </Form>
                    </div>
                    
                    <div className="modal-footer-custom">
                        <button 
                            type="button" 
                            className="btn-close-custom" 
                            disabled={isSavingTeam}
                            onClick={() => { 
                                setShowTeamModal(false); 
                                setTeamName(''); 
                                setTeamStatus('In Progress'); 
                                setTeamClosingDate('');
                                setTeamLeader(''); 
                                setTeamMembers([]); 
                                setSelectedLeads([]); 
                                setEditingTeamId(null); 
                                setShowAddLeadSection(false); 
                            }}
                        >
                            Cancel
                        </button>
                        <button 
                            type="button" 
                            className="btn-save-custom" 
                            disabled={isSavingTeam}
                            onClick={async () => {
                                if (isSavingTeam) return;

                                if (!teamName.trim()) {
                                    Swal.fire({icon: 'warning', title: 'Validation Error', text: 'Please enter a team name.', confirmButtonColor: '#3085d6'});
                                    return;
                                }
                                if (teamMembers.length === 0) {
                                    Swal.fire({icon: 'warning', title: 'Validation Error', text: 'Please select at least one Telecalling team member.', confirmButtonColor: '#3085d6'});
                                    return;
                                }
                                
                                setIsSavingTeam(true);
                                try {
                                    const finalLeader = teamLeader && teamMembers.some(id => String(id) === String(teamLeader)) ? Number(teamLeader) : null;
                                    const payload = {
                                        name: teamName.trim(),
                                        team_leader: finalLeader,
                                        members: teamMembers,
                                        closing_date: teamClosingDate || null,
                                        leads: selectedLeads.map(lead => ({
                                            id: lead.id,
                                            source: lead.category_detail?.name || lead.category_name || lead.lead_source || 'Direct'
                                        }))
                                    };
                                    
                                    if (editingTeamId) {
                                        payload.status = teamStatus || 'In Progress';
                                        const res = await axiosInstance.patch(`/api/crm_new/telecalling-teams/${editingTeamId}/`, payload);
                                        if (res.status === 200 || res.status === 204) {
                                            const updatedStatus = payload.status;
                                            setSelectedLeads([]);
                                            setShowTeamModal(false);
                                            setTeamName('');
                                            setTeamLeader('');
                                            setTeamMembers([]);
                                            setTeamStatus('In Progress');
                                            setTeamClosingDate('');
                                            setEditingTeamId(null);
                                            setShowAddLeadSection(false);
                                            
                                            await fetchProjects();
                                            fetchCategories();
                                            fetchAllCrmLeads();
                                            if (viewProject && String(viewProject.id) === `team_${editingTeamId}`) {
                                                setViewProject(prev => ({ 
                                                    ...prev, 
                                                    name: payload.name, 
                                                    status: updatedStatus,
                                                    team_leader: payload.team_leader,
                                                    members: payload.members
                                                }));
                                            }
                                            
                                            Swal.fire({
                                                icon: 'success', 
                                                title: 'Team updated successfully!', 
                                                showConfirmButton: true,
                                                confirmButtonColor: '#2ece8a'
                                            });
                                        }
                                    } else {
                                        payload.status = 'In Progress';
                                        const res = await axiosInstance.post('/api/crm_new/telecalling-teams/', payload);
                                        if (res.status === 201) {
                                            setSelectedLeads([]);
                                            setShowTeamModal(false);
                                            setTeamName('');
                                            setTeamLeader('');
                                            setTeamMembers([]);
                                            setEditingTeamId(null);
                                            setShowAddLeadSection(false);
                                            
                                            await fetchProjects();
                                            fetchCategories();
                                            fetchAllCrmLeads();
                                            
                                            Swal.fire({
                                                icon: 'success', 
                                                title: 'Team created successfully!', 
                                                showConfirmButton: true,
                                                confirmButtonColor: '#2ece8a'
                                            });
                                        }
                                    }
                                } catch (error) {
                                    console.error("Error saving team:", error);
                                    const errorMsg = error.response?.data?.error || error.response?.data?.detail || 'Failed to save the team.';
                                    Swal.fire({
                                        icon: 'error',
                                        title: 'Save Failed',
                                        text: errorMsg,
                                        confirmButtonColor: '#d33'
                                    });
                                } finally {
                                    setIsSavingTeam(false);
                                }
                            }}
                        >
                            {isSavingTeam ? (
                                <span><i className="fa fa-spinner fa-spin me-1"></i> Saving...</span>
                            ) : (
                                editingTeamId ? 'Update Team' : 'Create Team'
                            )}
                        </button>
                    </div>
            </Modal>

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
        
            {/* View Project/Team Modal */}
            <Modal
                show={showViewModal}
                onHide={() => setShowViewModal(false)}
                dialogClassName="parkarea-custom-modal"
                contentClassName="parkarea-custom-modal-content"
                backdrop="static"
                keyboard={false}
                restoreFocus={false}
                size="md"
                centered
            >
                <div className="modal-header-custom" style={{ flexShrink: 0 }}>
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM10 19H5V5H10V19ZM19 19H12V5H19V19Z" fill="white" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                View Details
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Project and Assigned Leads
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowViewModal(false)}>
                        &times;
                    </button>
                </div>

                <div 
                    className="modal-body-custom"
                    style={{
                        flex: '1 1 auto',
                        minHeight: 0,
                        maxHeight: 'calc(90vh - 160px)',
                        overflowY: 'auto',
                        overflowX: 'hidden'
                    }}
                >
                    {viewProject && (
                        <div>
                            <div className="row g-3 mb-4">
                                <div className="col-sm-6">
                                    <label className="form-label-custom">Name</label>
                                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                                        {viewProject.name || '-'}
                                    </div>
                                </div>
                                <div className="col-sm-6">
                                    <label className="form-label-custom">Status</label>
                                    <div>
                                        <span className={`badge light badge-${viewProject.status === 'Completed' ? 'success' : viewProject.status === 'In Progress' ? 'warning' : 'secondary'}`} style={{ fontSize: '12px', padding: '4px 8px' }}>
                                            {viewProject.status || 'In Progress'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <label className="form-label-custom mb-0">Assigned Leads</label>
                                <span className="badge light badge-primary" style={{ fontSize: '11px', padding: '3px 8px' }}>
                                    {viewProject.leads?.length || 0} Total
                                </span>
                            </div>
                            
                            <div className="table-responsive bg-white border rounded">
                                <table className="table table-sm mb-0">
                                    <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                                        <tr>
                                            <th style={{ padding: '10px 16px', fontSize: '12px', fontWeight: '700', color: '#64748b', borderBottom: '1px solid #e2e8f0', letterSpacing: '0.03em' }}><strong>LEAD ID</strong></th>
                                            <th style={{ padding: '10px 16px', fontSize: '12px', fontWeight: '700', color: '#64748b', borderBottom: '1px solid #e2e8f0', textAlign: 'right', letterSpacing: '0.03em' }}><strong>COMPANY</strong></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewProject.leads && viewProject.leads.length > 0 ? (
                                            viewProject.leads.map((l, index) => {
                                                const leadId = l.lead_id || l.id;
                                                const companyName = l.lead_details?.company || l.company || 'Unknown';
                                                
                                                return (
                                                    <tr key={index}>
                                                        <td style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', fontWeight: '600', color: '#1e293b', fontSize: '13px' }}>
                                                            {leadId}
                                                        </td>
                                                        <td style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', textAlign: 'right' }}>
                                                            <span className="badge light badge-info" style={{ fontSize: '12px', padding: '4px 8px' }}>
                                                                {companyName}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan="2" className="text-center py-4 text-muted" style={{ fontSize: '13px' }}>
                                                    No leads assigned.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="modal-footer-custom" style={{ flexShrink: 0 }}>
                    <button type="button" className="btn-close-custom" onClick={() => setShowViewModal(false)}>
                        Close
                    </button>
                </div>
            </Modal>

            {/* Edit Project/Team Modal */}
            <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered dialogClassName="parkarea-custom-modal">
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-edit text-white" style={{ fontSize: '20px' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Update Project
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Edit project details and status
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowEditModal(false)}>
                        &times;
                    </button>
                </div>
                <div className="modal-body-custom">
                    {editProject && (
                        <Form>
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Project Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control 
                                    type="text" 
                                    className="form-control-custom"
                                    placeholder="Enter project name"
                                    value={editProject.name || ''}
                                    onChange={(e) => setEditProject({...editProject, name: e.target.value})}
                                />
                            </div>
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Status <span className="text-danger">*</span></Form.Label>
                                <Form.Select
                                    className="form-control-custom"
                                    value={editProject.status || 'In Progress'}
                                    onChange={(e) => setEditProject({...editProject, status: e.target.value})}
                                >
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Not Started">Not Started</option>
                                    <option value="On Hold">On Hold</option>
                                </Form.Select>
                            </div>
                        </Form>
                    )}
                </div>
                <div className="modal-footer-custom">
                    <button type="button" className="btn-close-custom" onClick={() => setShowEditModal(false)}>
                        Cancel
                    </button>
                    <button type="button" className="btn-save-custom" onClick={handleEditSubmit}>
                        Save Changes
                    </button>
                </div>
            </Modal>
            <style>{`
                .item-custom-modal.modal-dialog,
                .item-custom-modal .modal-dialog,
                .parkarea-custom-modal .modal-dialog,
                .telecalling-team-modal.modal-dialog,
                .telecalling-team-modal .modal-dialog {
                    max-width: 580px !important;
                    width: 100% !important;
                    max-height: 90vh !important;
                    margin: 1.75rem auto !important;
                    display: flex !important;
                    flex-direction: column !important;
                }
                .item-custom-modal .modal-content,
                .parkarea-custom-modal-content,
                .parkarea-custom-modal .modal-content,
                .telecalling-team-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden !important;
                    max-height: 90vh !important;
                    display: flex !important;
                    flex-direction: column !important;
                    background: #ffffff !important;
                }
                .item-custom-modal .modal-header-custom,
                .parkarea-custom-modal-content .modal-header-custom,
                .parkarea-custom-modal .modal-header-custom,
                .telecalling-team-modal .modal-header-custom {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    padding: 24px 28px 16px 28px !important;
                    border-bottom: 1px solid #f1f5f9 !important;
                    background-color: #ffffff !important;
                    flex-shrink: 0 !important;
                }
                .item-custom-modal .modal-icon-circle,
                .parkarea-custom-modal-content .modal-icon-circle,
                .parkarea-custom-modal .modal-icon-circle,
                .telecalling-team-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                    flex-shrink: 0;
                }
                .item-custom-modal .modal-close-x,
                .parkarea-custom-modal-content .modal-close-x,
                .parkarea-custom-modal .modal-close-x,
                .telecalling-team-modal .modal-close-x {
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    color: #aaa;
                    cursor: pointer;
                    transition: color 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                    flex-shrink: 0;
                }
                .item-custom-modal .modal-close-x:hover,
                .parkarea-custom-modal-content .modal-close-x:hover,
                .parkarea-custom-modal .modal-close-x:hover,
                .telecalling-team-modal .modal-close-x:hover {
                    color: #555;
                }
                .item-custom-modal .modal-body-custom,
                .parkarea-custom-modal-content .modal-body-custom,
                .parkarea-custom-modal .modal-body-custom,
                .telecalling-team-modal .modal-body-custom {
                    padding: 24px 28px !important;
                    flex: 1 1 auto !important;
                    min-height: 0 !important;
                    max-height: 70vh !important;
                    overflow-y: auto !important;
                    overflow-x: hidden !important;
                    scrollbar-width: thin !important;
                    scrollbar-color: #cbd5e1 #f1f5f9 !important;
                }
                .item-custom-modal .modal-body-custom::-webkit-scrollbar,
                .parkarea-custom-modal-content .modal-body-custom::-webkit-scrollbar,
                .parkarea-custom-modal .modal-body-custom::-webkit-scrollbar,
                .telecalling-team-modal .modal-body-custom::-webkit-scrollbar {
                    width: 6px !important;
                    display: block !important;
                }
                .item-custom-modal .modal-body-custom::-webkit-scrollbar-track,
                .parkarea-custom-modal-content .modal-body-custom::-webkit-scrollbar-track,
                .parkarea-custom-modal .modal-body-custom::-webkit-scrollbar-track,
                .telecalling-team-modal .modal-body-custom::-webkit-scrollbar-track {
                    background: #f1f5f9 !important;
                    border-radius: 4px !important;
                }
                .item-custom-modal .modal-body-custom::-webkit-scrollbar-thumb,
                .parkarea-custom-modal-content .modal-body-custom::-webkit-scrollbar-thumb,
                .parkarea-custom-modal .modal-body-custom::-webkit-scrollbar-thumb,
                .telecalling-team-modal .modal-body-custom::-webkit-scrollbar-thumb {
                    background: #cbd5e1 !important;
                    border-radius: 4px !important;
                }
                .item-custom-modal .modal-body-custom::-webkit-scrollbar-thumb:hover,
                .parkarea-custom-modal-content .modal-body-custom::-webkit-scrollbar-thumb:hover,
                .parkarea-custom-modal .modal-body-custom::-webkit-scrollbar-thumb:hover,
                .telecalling-team-modal .modal-body-custom::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8 !important;
                }
                .item-custom-modal .modal-footer-custom,
                .parkarea-custom-modal-content .modal-footer-custom,
                .parkarea-custom-modal .modal-footer-custom,
                .telecalling-team-modal .modal-footer-custom {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: flex-end !important;
                    padding: 20px 28px 24px 28px !important;
                    gap: 12px !important;
                    background-color: #fafbfc !important;
                    border-top: 1px solid #f1f5f9 !important;
                    flex-shrink: 0 !important;
                }
                .item-custom-modal .btn-close-custom,
                .parkarea-custom-modal .btn-close-custom,
                .telecalling-team-modal .btn-close-custom {
                    background-color: #7A70BA !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer !important;
                    transition: background-color 0.2s, transform 0.1s;
                    line-height: 1.5 !important;
                    white-space: nowrap !important;
                }
                .item-custom-modal .btn-close-custom:hover,
                .parkarea-custom-modal .btn-close-custom:hover,
                .telecalling-team-modal .btn-close-custom:hover {
                    background-color: #6357a7 !important;
                }
                .item-custom-modal .btn-save-custom,
                .parkarea-custom-modal .btn-save-custom,
                .telecalling-team-modal .btn-save-custom {
                    background-color: #2ece8a !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer !important;
                    transition: background-color 0.2s, transform 0.1s;
                    line-height: 1.5 !important;
                    white-space: nowrap !important;
                }
                .item-custom-modal .btn-save-custom:hover,
                .parkarea-custom-modal .btn-save-custom:hover,
                .telecalling-team-modal .btn-save-custom:hover {
                    background-color: #26b277 !important;
                }
                .item-custom-modal .btn-save-custom:disabled,
                .parkarea-custom-modal .btn-save-custom:disabled,
                .telecalling-team-modal .btn-save-custom:disabled,
                .item-custom-modal .btn-close-custom:disabled,
                .telecalling-team-modal .btn-close-custom:disabled {
                    background: #94a3b8 !important;
                    cursor: not-allowed !important;
                    opacity: 0.7 !important;
                }
                .item-custom-modal .form-label-custom,
                .parkarea-custom-modal .form-label-custom,
                .telecalling-team-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                    display: block;
                }
                .item-custom-modal .form-control-custom,
                .parkarea-custom-modal .form-control-custom,
                .telecalling-team-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .item-custom-modal .form-control-custom:focus,
                .parkarea-custom-modal .form-control-custom:focus,
                .telecalling-team-modal .form-control-custom:focus {
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                    outline: none;
                }
                /* Telecalling Responsive Layout Enhancements */
                .tele-search-container {
                    flex: 1 1 200px;
                    min-width: 200px;
                    max-width: 300px;
                }
                @media (max-width: 991px) {
                    .tele-card-header {
                        padding: 1rem 1.25rem !important;
                    }
                    .tele-header-actions {
                        width: 100%;
                        justify-content: space-between;
                    }
                    .tele-search-container {
                        flex: 1 1 200px;
                        max-width: none;
                    }
                }
                @media (max-width: 768px) {
                    .tele-card-header {
                        flex-direction: column;
                        align-items: flex-start !important;
                        gap: 0.75rem !important;
                    }
                    .tele-header-actions {
                        width: 100%;
                        flex-direction: column;
                        align-items: stretch !important;
                        gap: 0.75rem !important;
                    }
                    .tele-search-container {
                        width: 100% !important;
                        min-width: 100% !important;
                        max-width: 100% !important;
                    }
                    .tele-btn-group {
                        width: 100%;
                        justify-content: flex-start;
                        flex-wrap: wrap;
                    }
                    .tele-repo-bar {
                        flex-direction: column;
                        align-items: stretch !important;
                        gap: 0.75rem !important;
                    }
                    .tele-repo-select {
                        width: 100% !important;
                        min-width: 100% !important;
                    }
                    .tele-assign-btn {
                        width: 100% !important;
                    }
                }
                @media (max-width: 576px) {
                    .tele-btn-group button {
                        flex: 1 1 auto;
                        text-align: center;
                    }
                    .item-custom-modal.modal,
                    .parkarea-custom-modal.modal,
                    .telecalling-team-modal.modal {
                        padding: 0 10px !important;
                    }
                    .item-custom-modal.modal-dialog,
                    .item-custom-modal .modal-dialog,
                    .parkarea-custom-modal .modal-dialog,
                    .telecalling-team-modal .modal-dialog {
                        max-width: calc(100vw - 20px) !important;
                        margin: 10px auto !important;
                    }
                    .item-custom-modal .modal-content,
                    .parkarea-custom-modal .modal-content,
                    .telecalling-team-modal .modal-content {
                        max-height: 92vh !important;
                    }
                    .item-custom-modal .modal-body-custom,
                    .parkarea-custom-modal .modal-body-custom,
                    .telecalling-team-modal .modal-body-custom {
                        padding: 16px 20px !important;
                    }
                    .item-custom-modal .modal-header-custom,
                    .parkarea-custom-modal .modal-header-custom,
                    .telecalling-team-modal .modal-header-custom {
                        padding: 16px 20px !important;
                    }
                    .item-custom-modal .modal-footer-custom,
                    .parkarea-custom-modal .modal-footer-custom,
                    .telecalling-team-modal .modal-footer-custom {
                        flex-direction: row !important;
                        justify-content: flex-end !important;
                        padding: 14px 20px !important;
                        gap: 10px !important;
                    }
                    .item-custom-modal .btn-close-custom,
                    .parkarea-custom-modal .btn-close-custom,
                    .telecalling-team-modal .btn-close-custom,
                    .item-custom-modal .btn-save-custom,
                    .parkarea-custom-modal .btn-save-custom,
                    .telecalling-team-modal .btn-save-custom {
                        width: auto !important;
                        padding: 8px 18px !important;
                        font-size: 13px !important;
                    }
                }
            `}</style>

</>
    );
};

export default TeleCallingDashboard;
