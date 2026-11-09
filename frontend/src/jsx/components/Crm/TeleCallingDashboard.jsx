import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../services/AxiosInstance';

const TeleCallingDashboard = () => {
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
    const [activeView, setActiveView] = useState('projects'); // 'leads' or 'projects'
    const [projectView, setProjectView] = useState('card'); // 'card', 'list', or 'table'
    const [selectedLeads, setSelectedLeads] = useState([]);
    const [showModal, setShowModal] = useState(false);
    
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

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Fetch data individually to handle permission errors (e.g. 403 on /api/hr/users/ for non-admins)
                const [projRes, leadRes, catRes, userRes, teamRes] = await Promise.allSettled([
                    axiosInstance.get('/api/crm/projects/'),
                    axiosInstance.get('/api/crm/leads/'),
                    axiosInstance.get('/api/crm/categories/'),
                    axiosInstance.get('/api/hr/users/'),
                    axiosInstance.get('/api/teams/teams/')
                ]);

                // Identify current user
                const userTokenData = localStorage.getItem('userDetails');
                if (userTokenData) {
                    try {
                        const parsedData = JSON.parse(userTokenData);
                        // AuthService saves it as { user: { id, ... }, ... }
                        setCurrentUser(parsedData.user || parsedData); 
                    } catch (e) { console.error("Error parsing user details", e); }
                }

                if (projRes.status === 'fulfilled' && projRes.value.status === 200) {
                    const allProjects = projRes.value.data;
                    
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
                
                if (leadRes.status === 'fulfilled' && leadRes.value.status === 200) {
                    setLeads(leadRes.value.data);
                }
                
                if (catRes.status === 'fulfilled' && catRes.value.status === 200) {
                    setCategories(catRes.value.data);
                    if (catRes.value.data.length > 0) setActiveCategory(catRes.value.data[0].id);
                }
                
                if (userRes.status === 'fulfilled' && userRes.value.status === 200) {
                    const filteredUsers = userRes.value.data.filter(u => u.department?.name === 'IT Support');
                    setUsers(filteredUsers);
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

            const res = await axiosInstance.post('/api/crm/projects/', {
                ...projectForm,
                team_leader: teamLeader,
                members: membersList,
                category: activeCategory
            });

            if (res.status === 201) {
                const projectId = res.data.id;
                // For Teams, leads are unassigned initially. For individuals, assign directly.
                const assignments = selectedLeads.map((leadId) => {
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

    return (
        <div className="tele-dashboard">
            <style>{`
                .tele-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2.5rem;
                }

                .tele-stat-card {
                    background: var(--crm-card-bg);
                    border-radius: var(--crm-card-radius);
                    padding: 1.5rem 2rem;
                    border: 1px solid var(--crm-border);
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    box-shadow: var(--crm-shadow);
                }

                .tele-stat-icon {
                    width: 50px;
                    height: 50px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                }

                .tele-stat-info h4 {
                    font-size: 1.5rem;
                    font-weight: 800;
                    margin: 0;
                    color: var(--crm-text-primary);
                }

                .tele-stat-info p {
                    margin: 0;
                    font-size: 0.85rem;
                    color: var(--crm-text-secondary);
                    font-weight: 600;
                }

                .tele-project-card {
                    background: var(--crm-card-bg);
                    border-radius: var(--crm-card-radius);
                    border: 1px solid var(--crm-border);
                    box-shadow: var(--crm-shadow);
                    overflow: hidden;
                    transition: all 0.3s ease;
                    cursor: pointer;
                }

                .tele-project-card:hover {
                    transform: translateY(-5px);
                    border-color: var(--crm-accent);
                }

                .tele-project-header {
                    padding: 0.5rem 1rem;
                    border-bottom: 1px solid var(--crm-border);
                }

                .tele-project-id {
                    font-size: 0.7rem;
                    color: var(--crm-accent);
                    font-weight: 800;
                    margin-bottom: 0.1rem;
                    display: block;
                }

                .tele-project-title {
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: var(--crm-text-primary);
                    margin: 0;
                }

                .tele-project-body {
                    padding: 0.5rem 1rem;
                }

                .tele-leader {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.5rem;
                }

                .tele-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: var(--crm-accent-soft);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: var(--crm-accent);
                    border: 2px solid var(--crm-card-bg);
                }

                .tele-leader-info h5 {
                    font-size: 0.9rem;
                    font-weight: 700;
                    margin: 0;
                    color: var(--crm-text-primary);
                }

                .tele-leader-info small {
                    font-size: 0.75rem;
                    color: var(--crm-text-secondary);
                }

                .tele-team {
                    margin-bottom: 0.5rem;
                }

                .tele-team-label {
                    font-size: 0.65rem;
                    font-weight: 800;
                    color: var(--crm-text-secondary);
                    text-transform: uppercase;
                    margin-bottom: 0.4rem;
                    display: block;
                }

                .tele-avatar-group {
                    display: flex;
                    align-items: center;
                    margin-left: 10px;
                }

                .tele-member-avatar {
                    margin-left: -10px;
                    transition: all 0.2s;
                }

                .tele-member-avatar:hover {
                    margin-right: 5px;
                    z-index: 10;
                    transform: scale(1.1);
                }

                .tele-progress-container {
                    margin-bottom: 0.5rem;
                }

                .tele-progress-bar {
                    height: 6px;
                    background: var(--crm-bg);
                    border-radius: 10px;
                    overflow: hidden;
                }

                .tele-progress-fill {
                    height: 100%;
                    background: var(--crm-accent);
                    border-radius: 10px;
                }

                .tele-project-footer {
                    padding: 0.5rem 1rem;
                    background: var(--crm-bg);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-top: 1px solid var(--crm-border);
                }

                .tele-due {
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: var(--crm-text-secondary);
                }

                .tele-due span {
                    color: var(--crm-text-primary);
                    margin-left: 4px;
                }

                .tele-status-tag {
                    padding: 0.3rem 0.75rem;
                    border-radius: 6px;
                    font-size: 0.7rem;
                    font-weight: 800;
                    text-transform: uppercase;
                }

                .status-in-progress { background: #f0f7ff; color: #0080ff; }
                .status-complete { background: #ecfdf5; color: #10b981; }
                .status-pending { background: #fffef0; color: #d97706; }

                /* Category Filters */
                .cat-pill-container {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 2rem;
                    overflow-x: auto;
                    padding-bottom: 0.5rem;
                }

                .cat-pill {
                    padding: 0.6rem 1.25rem;
                    background: var(--crm-card-bg);
                    border: 1px solid var(--crm-border);
                    border-radius: 50px;
                    color: var(--crm-text-secondary);
                    font-weight: 700;
                    font-size: 0.85rem;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.3s;
                }

                .cat-pill.active {
                    background: var(--crm-accent);
                    color: #fff;
                    border-color: var(--crm-accent);
                    box-shadow: 0 5px 15px rgba(0, 209, 255, 0.3);
                }

                .repo-lead-card {
                    background: var(--crm-card-bg);
                    border: 1px solid var(--crm-border);
                    border-radius: 16px;
                    padding: 1.25rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                    transition: all 0.2s;
                    cursor: pointer;
                }

                .repo-lead-card:hover {
                    border-color: var(--crm-accent);
                    background: var(--crm-accent-soft);
                }

                .repo-lead-info h5 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 800;
                    color: var(--crm-text-primary);
                    line-height: 1.2;
                }

                .repo-lead-info p {
                    margin: 0;
                    font-size: 0.75rem;
                    color: var(--crm-text-secondary);
                    font-weight: 600;
                }

                .repo-lead-contact {
                    min-width: 180px;
                }

                .lead-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: var(--crm-accent);
                    box-shadow: 0 0 10px var(--crm-accent);
                }

                .repo-lead-card.selected {
                    border-color: var(--crm-accent);
                    background: var(--crm-accent-soft);
                    box-shadow: 0 5px 15px rgba(0, 209, 255, 0.1);
                }
                .repo-lead-actions {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                }

                .scrollable-list {
                    max-height: calc(100vh - 350px);
                    overflow-y: auto;
                    padding-right: 10px;
                }

                .project-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 1.25rem;
                    overflow: visible;
                    max-height: none !important;
                    height: auto !important;
                }

                .tele-project-list-vertical.project-grid {
                    max-height: none;
                    height: auto;
                    overflow: visible;
                }

                .view-toggles {
                    display: flex;
                    gap: 0.5rem;
                    background: #f8f9fa;
                    padding: 0.4rem;
                    border-radius: 14px;
                    width: fit-content;
                    margin-bottom: 2rem;
                    border: 1px solid #eee;
                }

                .view-toggle-btn {
                    padding: 0.6rem 1.5rem;
                    border-radius: 10px;
                    border: none;
                    background: transparent;
                    font-weight: 700;
                    font-size: 0.85rem;
                    color: #666;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                }

                .view-toggle-btn.active {
                    background: #fff;
                    color: var(--crm-accent);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }

                .scrollable-list::-webkit-scrollbar {
                    width: 5px;
                }
                .scrollable-list::-webkit-scrollbar-track {
                    background: transparent;
                }
                .scrollable-list::-webkit-scrollbar-thumb {
                    background: rgba(0,0,0,0.1);
                    border-radius: 10px;
                }
                .scrollable-list:hover::-webkit-scrollbar-thumb {
                    background: rgba(0,0,0,0.2);
                }

                /* List View Styles */
                .proj-list-container {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .proj-list-row {
                    background: #fff;
                    border-radius: 18px;
                    border: 1px solid #e5e7eb;
                    padding: 1.25rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    transition: all 0.3s ease;
                    cursor: pointer;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.02);
                }

                .proj-list-row:hover {
                    border-color: var(--crm-accent);
                    transform: translateX(5px);
                    box-shadow: 0 10px 25px rgba(0,0,0,0.05);
                }

                /* Table View Styles */
                .proj-table-container {
                    background: #fff;
                    border-radius: 20px;
                    border: 1px solid #e5e7eb;
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.05);
                }

                .proj-table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                }

                .proj-table th {
                    background: #f8fbfc;
                    padding: 1.2rem 1rem;
                    font-size: 0.72rem;
                    font-weight: 800;
                    color: #6b7280;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    border-bottom: 1px solid #eee;
                }

                .proj-table td {
                    padding: 1.2rem 1rem;
                    border-bottom: 1px solid #f3f4f6;
                    vertical-align: middle;
                }

                .proj-table tr:last-child td {
                    border-bottom: none;
                }

                .proj-table tr:hover {
                    background: #fcfdfe;
                }

                .sticky-header {
                    position: sticky;
                    top: 0;
                    background: #fff; 
                    z-index: 10;
                    padding-bottom: 1rem;
                }

                /* ============================
                   PROJECT CARD V2 (Interaction Workflow Style)
                   ============================ */
                .proj-card-v2 {
                    background: var(--crm-card-bg, #fff);
                    border-radius: 28px;
                    border: 1px solid var(--crm-border, #e5e7eb);
                    padding: 0;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.05);
                }
                .proj-card-v2:hover {
                    transform: translateY(-8px);
                    box-shadow: 0 20px 50px rgba(0,0,0,0.1);
                    border-color: var(--crm-accent, #00d1ff);
                }

                /* Top section (header) */
                .proj-card-v2-top {
                    padding: 1.5rem 1.5rem 0.75rem;
                    position: relative;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 0;
                }

                /* Large avatar icon - teal to blue gradient (matches entity-icon) */
                .proj-card-v2-avatar {
                    width: 52px;
                    height: 52px;
                    border-radius: 15px;
                    background: linear-gradient(135deg, var(--crm-accent, #00c9a7), #0076ff);
                    color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.4rem;
                    font-weight: 900;
                    box-shadow: 0 8px 15px rgba(0, 209, 255, 0.2);
                    flex-shrink: 0;
                }

                /* Status badge - nearly transparent bg, colored text only (matches flow-status-tag) */
                .proj-card-v2-badge {
                    display: flex;
                    align-items: center;
                }
                .pv2-status-tag {
                    font-size: 0.68rem;
                    font-weight: 900;
                    padding: 0.35rem 0.8rem;
                    border-radius: 50px;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    background: rgba(0,0,0,0.03);
                }
                .pv2-status-tag.status-complete { color: #198754; }
                .pv2-status-tag.status-in-progress { color: #0dcaf0; }
                .pv2-status-tag.status-pending { color: #6c757d; }

                /* Project name - dark near-black (matches h4 fw-900 m-0 in header) */
                .proj-card-v2-name {
                    font-size: 1.05rem;
                    font-weight: 900;
                    color: var(--crm-text-primary, #111827);
                    margin: 0.8rem 1.5rem 0.1rem;
                    line-height: 1.3;
                }

                /* Project ID - secondary gray (matches text-secondary company name) */
                .proj-card-v2-id {
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: var(--crm-text-secondary, #6b7280);
                    margin: 0 1.5rem 1rem;
                    letter-spacing: 0.3px;
                }

                /* Info section wrapper */
                .proj-card-v2-info {
                    display: flex;
                    flex-direction: column;
                    padding: 0 1.5rem 1.5rem;
                    gap: 0;
                }

                /* Info strip - neutral barely-visible bg (matches .info-strip) */
                .pv2-info-row {
                    display: flex;
                    align-items: flex-start;
                    gap: 1rem;
                    padding: 0.9rem 1rem;
                    background: rgba(0,0,0,0.02);
                    border-radius: 18px;
                    margin-bottom: 0.6rem;
                    border: 1px solid transparent;
                    transition: all 0.3s;
                }
                .pv2-info-row:hover {
                    background: #fff;
                    border-color: var(--crm-border, #e5e7eb);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.03);
                }

                /* Icon box - WHITE bg with teal icon (matches .info-strip i exactly) */
                .pv2-info-icon {
                    width: 35px;
                    height: 35px;
                    background: #fff;
                    color: var(--crm-accent, #00c9a7);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.85rem;
                    flex-shrink: 0;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                }

                .pv2-info-content {
                    display: flex;
                    flex-direction: column;
                    gap: 0.15rem;
                    flex: 1;
                }
                /* Label - small teal uppercase (matches the label above value) */
                .pv2-info-label {
                    font-size: 0.58rem;
                    font-weight: 900;
                    color: var(--crm-accent, #00b4a0);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                /* Value - dark text (strong contrast) */
                .pv2-info-value {
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: var(--crm-text-primary, #111827);
                }

                /* Team avatars */
                .pv2-team-avatars {
                    display: flex;
                    gap: 0.25rem;
                    flex-wrap: wrap;
                    margin-top: 0.2rem;
                }
                .pv2-team-avatar {
                    width: 26px;
                    height: 26px;
                    background: linear-gradient(135deg, var(--crm-accent, #00c9a7), #0076ff);
                    color: #fff;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.6rem;
                    font-weight: 900;
                    border: 2px solid #fff;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .pv2-team-more {
                    background: rgba(0,0,0,0.05);
                    color: var(--crm-text-secondary, #6b7280);
                }

                /* Progress */
                .pv2-progress-wrap {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    margin-top: 0.3rem;
                }
                .pv2-progress-bar {
                    flex: 1;
                    height: 5px;
                    background: rgba(0,0,0,0.06);
                    border-radius: 10px;
                    overflow: hidden;
                }
                .pv2-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #198754, #20c997);
                    border-radius: 10px;
                    transition: width 0.6s ease;
                }
                .pv2-progress-pct {
                    font-size: 0.7rem;
                    font-weight: 900;
                }
                .bg-warning-light {
                    background: #fffbeb;
                    border: 1px solid #fde68a;
                    color: #92400e;
                }
                .bg-success-light {
                    background: #f0fdf4;
                    border: 1px solid #bbf7d0;
                    color: #166534;
                }
                .badge-workload {
                    font-size: 0.75rem !important;
                    padding: 0.4rem 0.8rem !important;
                    display: block;
                    width: fit-content;
                    margin-left: auto;
                    font-weight: 800 !important;
                    letter-spacing: 0.5px;
                }
                .member-workload-card .fw-800 {
                    font-size: 1rem !important;
                }
                .member-workload-card .text-secondary {
                    font-size: 0.8rem !important;
                }
                .pv2-progress-pct {
                    color: #198754;
                    white-space: nowrap;
                }

                /* CTA button - dark green (matches .btn-ready #198754) */
                .pv2-cta-btn {
                    margin: 0;
                    width: 100%;
                    padding: 1rem;
                    border: none;
                    border-top: 1px dashed var(--crm-border, #e5e7eb);
                    background: #198754;
                    color: #fff;
                    font-size: 0.8rem;
                    font-weight: 900;
                    letter-spacing: 0.5px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    transition: all 0.3s ease;
                    box-shadow: none;
                }
                .pv2-cta-btn:hover {
                    background: #157347;
                }
                .pv2-cta-secondary {
                    background: rgba(0,0,0,0.03);
                    color: var(--crm-text-secondary, #6b7280);
                    border-top: 1px dashed var(--crm-border, #e5e7eb);
                }
                .pv2-cta-secondary:hover {
                    background: var(--crm-accent-soft);
                    color: var(--crm-accent);
                }
            `}</style>

            <div className="tele-stats-grid">
                <div className="tele-stat-card">
                    <div className="tele-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                        <i className="fa fa-check-circle"></i>
                    </div>
                    <div className="tele-stat-info">
                        <h4>{stats.completed}</h4>
                        <p>Total Completed</p>
                    </div>
                </div>
                <div className="tele-stat-card">
                    <div className="tele-stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                        <i className="fa fa-pie-chart"></i>
                    </div>
                    <div className="tele-stat-info">
                        <h4>{stats.inProgress}</h4>
                        <p>Total In Progress</p>
                    </div>
                </div>
                <div className="tele-stat-card">
                    <div className="tele-stat-icon" style={{ background: 'rgba(100, 116, 139, 0.1)', color: '#64748b' }}>
                        <i className="fa fa-shield"></i>
                    </div>
                    <div className="tele-stat-info">
                        <h4>{stats.notStarted}</h4>
                        <p>Total Not Started</p>
                    </div>
                </div>
                <div className="tele-stat-card">
                    <div className="tele-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                        <i className="fa fa-users"></i>
                    </div>
                    <div className="tele-stat-info">
                        <h4>{stats.total}</h4>
                        <p>Active Projects</p>
                    </div>
                </div>
            </div>

            <div className="view-toggles mt-4">
                <button 
                    className={`view-toggle-btn ${activeView === 'leads' ? 'active' : ''}`}
                    onClick={() => setActiveView('leads')}
                >
                    <i className="fa fa-users"></i> Lead Repository
                </button>
                <button 
                    className={`view-toggle-btn ${activeView === 'projects' ? 'active' : ''}`}
                    onClick={() => setActiveView('projects')}
                >
                    <i className="fa fa-tasks"></i> Execution Centers
                </button>
            </div>

            <div className="tele-content-area mt-4">
                {activeView === 'leads' ? (
                    <div className="lead-repository-view">
                        <div className="sticky-header">
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h4 className="fw-800 text-primary mb-0">Lead Repository</h4>
                                {users.length > 0 && (
                                    <button 
                                        className="btn btn-primary d-flex align-items-center gap-2" 
                                        style={{ borderRadius: '12px', background: 'var(--crm-accent)', border: 'none', fontWeight: '700' }}
                                        onClick={() => setShowModal(true)}
                                    >
                                        <i className="fa fa-plus-circle"></i> Create Project {selectedLeads.length > 0 && `(${selectedLeads.length})`}
                                    </button>
                                )}
                            </div>

                            <div className="cat-pill-container">
                                {categories.map(cat => (
                                    <div 
                                        key={cat.id} 
                                        className={`cat-pill ${activeCategory === cat.id ? 'active' : ''}`}
                                        onClick={() => {setActiveCategory(cat.id); setSelectedLeads([]);}}
                                    >
                                        {cat.name}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="lead-repo-list scrollable-list">
                            {loading ? (
                                <div className="text-center py-5 opacity-50">Syncing lead repository...</div>
                            ) : leads.filter(l => l.category === activeCategory).length === 0 ? (
                                <div className="text-center py-5 opacity-50">Empty category</div>
                            ) : leads.filter(l => l.category === activeCategory).map(lead => (
                                <div 
                                    key={lead.id} 
                                    className={`repo-lead-card ${selectedLeads.includes(lead.id) ? 'selected' : ''} ${lead.is_allocated ? 'opacity-50' : ''}`} 
                                    onClick={() => !lead.is_allocated && handleLeadSelect(lead.id)}
                                    style={{ cursor: lead.is_allocated ? 'not-allowed' : 'pointer' }}
                                >
                                    <div className="d-flex align-items-center gap-3 w-100">
                                        <div className="lead-dot" style={{ background: lead.is_allocated ? '#ccc' : 'var(--crm-accent)', boxShadow: lead.is_allocated ? 'none' : '0 0 10px var(--crm-accent)' }}></div>
                                        <div className="repo-lead-info flex-grow-1">
                                            <h5 className="mb-0">{lead.first_name || 'No'} {lead.last_name || 'Name'}</h5>
                                            {lead.company && <div className="text-primary fw-700 opacity-75" style={{ fontSize: '0.7rem' }}>{lead.company}</div>}
                                            <p className="mt-1">{lead.source} • {lead.status} {lead.is_allocated && <span className="badge bg-light ms-2 text-secondary fw-800">ALREADY IN PROJECT</span>}</p>
                                        </div>
                                        <div className="repo-lead-contact text-end me-4 d-none d-md-block">
                                            <div className="fw-800 text-dark mb-1" style={{ fontSize: '0.85rem' }}>
                                                <i className="fa fa-phone-alt me-2 text-muted" style={{ fontSize: '0.75rem' }}></i>
                                                {lead.phone || 'No Phone'}
                                            </div>
                                            <div className="text-secondary fw-600" style={{ fontSize: '0.72rem' }}>
                                                <i className="fa fa-envelope me-2 text-muted" style={{ fontSize: '0.75rem' }}></i>
                                                {lead.email}
                                            </div>
                                        </div>
                                        {!lead.is_allocated && (
                                            <div className="repo-lead-select">
                                                <input 
                                                    type="checkbox"
                                                    className="form-check-input"
                                                    style={{ width: '20px', height: '20px' }}
                                                    checked={selectedLeads.includes(lead.id)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        handleLeadSelect(lead.id);
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="execution-centers-view">
                        <div className="sticky-header d-flex justify-content-between align-items-center mb-4">
                            <h4 className="fw-800 mb-0 text-primary">Execution Centers</h4>
                            <div className="view-toggles mb-0">
                                <button 
                                    className={`view-toggle-btn ${projectView === 'card' ? 'active' : ''}`}
                                    onClick={() => setProjectView('card')}
                                >
                                    <i className="fa fa-th-large"></i> Card
                                </button>
                                <button 
                                    className={`view-toggle-btn ${projectView === 'list' ? 'active' : ''}`}
                                    onClick={() => setProjectView('list')}
                                >
                                    <i className="fa fa-list"></i> List
                                </button>
                                <button 
                                    className={`view-toggle-btn ${projectView === 'table' ? 'active' : ''}`}
                                    onClick={() => setProjectView('table')}
                                >
                                    <i className="fa fa-table"></i> Table
                                </button>
                            </div>
                        </div>
                        <div className={`tele-project-list-vertical scrollable-list ${projectView === 'card' ? 'project-grid' : ''}`}>
                            {loading ? (
                                <div className="text-center py-5 opacity-50">Syncing active projects...</div>
                            ) : projects.length === 0 ? (
                                <div className="text-center py-5 opacity-50">No projects active</div>
                            ) : projectView === 'card' ? (
                                projects.map(proj => (
                                    <div 
                                        key={proj.id} 
                                        className="proj-card-v2" 
                                        onClick={() => handleOpenDetail(proj)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="proj-card-v2-top">
                                            <div className="proj-card-v2-avatar">
                                                {proj.name?.charAt(0)?.toUpperCase() || 'P'}
                                            </div>
                                            <div className="proj-card-v2-badge" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                {proj.progress_percentage === 100 ? (
                                                    <span className="pv2-status-tag status-complete">✦ COMPLETED</span>
                                                ) : proj.progress_percentage > 0 ? (
                                                    <span className="pv2-status-tag status-in-progress">⚡ IN PROGRESS</span>
                                                ) : proj.allocated_count > 0 ? (
                                                    <span className="pv2-status-tag status-in-progress" style={{ color: '#0076ff', background: 'rgba(0,118,255,0.05)' }}>✓ ALLOCATED</span>
                                                ) : (
                                                    <span className="pv2-status-tag status-pending">○ READY FOR ALLOCATION</span>
                                                )}
                                                {proj.last_allocated_at && (
                                                    <span style={{ fontSize: '0.62rem', fontWeight: '800', opacity: '0.7', letterSpacing: '0.5px' }}>
                                                        {new Date(proj.last_allocated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="proj-card-v2-name">{proj.name}</div>
                                        <div className="proj-card-v2-id">{proj.project_id || `PROJ-${String(proj.id).padStart(3, '0')}`}</div>
                                        <div className="proj-card-v2-info">
                                            <div className="pv2-info-row">
                                                <div className="pv2-info-icon"><i className="fa fa-user-tie"></i></div>
                                                <div className="pv2-info-content">
                                                    <span className="pv2-info-label">DEPLOYMENT LEADER</span>
                                                    <span className="pv2-info-value">{proj.team_leader_detail?.full_name || 'System Admin'}</span>
                                                </div>
                                            </div>
                                            <div className="pv2-info-row">
                                                <div className="pv2-info-icon"><i className="fa fa-users"></i></div>
                                                <div className="pv2-info-content">
                                                    <span className="pv2-info-label">DEPLOYMENT TEAM</span>
                                                    <div className="pv2-team-avatars">
                                                        {proj.members_detail?.slice(0, 5).map(m => (
                                                            <div key={m.id} className="pv2-team-avatar" title={m.full_name || m.first_name}>
                                                                {m.first_name?.charAt(0)}
                                                            </div>
                                                        ))}
                                                        {proj.members_detail?.length > 5 && (
                                                            <div className="pv2-team-avatar pv2-team-more">+{proj.members_detail.length - 5}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pv2-info-row">
                                                <div className="pv2-info-icon"><i className="fa fa-calendar-alt"></i></div>
                                                <div className="pv2-info-content">
                                                    <span className="pv2-info-label">CAMPAIGN DUE DATE</span>
                                                    <span className="pv2-info-value">{proj.target_date || 'N/A'}</span>
                                                </div>
                                            </div>
                                            <div className="pv2-info-row">
                                                <div className="pv2-info-icon"><i className="fa fa-chart-line"></i></div>
                                                <div className="pv2-info-content">
                                                    <span className="pv2-info-label">CAMPAIGN PROGRESS</span>
                                                    <div className="pv2-progress-wrap">
                                                        <div className="pv2-progress-bar">
                                                            <div className="pv2-progress-fill" style={{ width: `${proj.progress_percentage}%` }}></div>
                                                        </div>
                                                        <span className="pv2-progress-pct">{proj.progress_percentage}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {currentUser && (Number(proj.team_leader) === Number(currentUser.id) || Number(proj.team_leader_detail?.id) === Number(currentUser.id) || currentUser.is_superuser) ? (
                                            <>
                                                {proj.allocated_count > 0 ? (
                                                    <button onClick={(e) => { e.stopPropagation(); handleOpenAllocate(proj); }} style={{ width: '100%', padding: '0.85rem 1.25rem', background: 'linear-gradient(135deg, #0052cc 0%, #0076ff 50%, #00b4ff 100%)', color: '#fff', border: 'none', borderRadius: '0', fontWeight: '900', fontSize: '0.78rem', letterSpacing: '1.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', boxShadow: '0 -4px 20px rgba(0,82,204,0.2)', transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden' }}>
                                                        <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '3px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <i className="fa fa-chart-pie"></i> {proj.allocated_count}
                                                        </span>
                                                        <i className="fa fa-eye"></i> ALLOCATION DETAILS
                                                    </button>
                                                ) : (
                                                    <button onClick={(e) => { e.stopPropagation(); handleOpenAllocate(proj); }} style={{ width: '100%', padding: '0.85rem 1.25rem', background: 'linear-gradient(135deg, #1a7a4a 0%, #21a85c 50%, #00d48b 100%)', color: '#fff', border: 'none', borderRadius: '0', fontWeight: '900', fontSize: '0.78rem', letterSpacing: '1.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', boxShadow: '0 -4px 20px rgba(26,122,74,0.2)', transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden' }}>
                                                        <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '3px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <i className="fa fa-users"></i> {proj.members_detail?.length || 0}
                                                        </span>
                                                        <i className="fa fa-tasks"></i> ALLOCATE LEADS
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <button className="pv2-cta-btn pv2-cta-secondary" onClick={e => e.stopPropagation()}>
                                                <i className="fa fa-eye me-2"></i> VIEW DETAILS
                                            </button>
                                        )}
                                    </div>
                                ))
                            ) : projectView === 'list' ? (
                                <div className="proj-list-container">
                                    {projects.map(proj => (
                                        <div key={proj.id} className="proj-list-row" onClick={() => handleOpenDetail(proj)}>
                                            <div className="d-flex align-items-center gap-4 flex-grow-1">
                                                <div className="proj-card-v2-avatar" style={{ width: '48px', height: '48px', fontSize: '1.2rem', borderRadius: '12px' }}>
                                                    {proj.name?.charAt(0)?.toUpperCase() || 'P'}
                                                </div>
                                                <div style={{ minWidth: '200px' }}>
                                                    <h5 className="fw-900 mb-0 text-dark">{proj.name}</h5>
                                                    <span className="text-primary fw-800" style={{ fontSize: '0.7rem' }}>{proj.project_id || `PROJ-${String(proj.id).padStart(3, '0')}`}</span>
                                                </div>
                                                <div style={{ minWidth: '150px' }}>
                                                    <span className="pv2-info-label d-block mb-1">Leader</span>
                                                    <div className="fw-700 text-dark" style={{ fontSize: '0.85rem' }}>{proj.team_leader_detail?.full_name || 'Admin'}</div>
                                                </div>
                                                <div style={{ minWidth: '120px' }}>
                                                    <span className="pv2-info-label d-block mb-1">Due Date</span>
                                                    <div className="fw-700 text-secondary" style={{ fontSize: '0.85rem' }}>{proj.target_date || 'N/A'}</div>
                                                </div>
                                                <div style={{ minWidth: '150px' }}>
                                                    <span className="pv2-info-label d-block mb-1">Progress</span>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="pv2-progress-bar" style={{ width: '100px' }}>
                                                            <div className="pv2-progress-fill" style={{ width: `${proj.progress_percentage}%` }}></div>
                                                        </div>
                                                        <span className="fw-900 text-primary" style={{ fontSize: '0.75rem' }}>{proj.progress_percentage}%</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    {proj.progress_percentage === 100 ? (
                                                        <span className="badge bg-success-light text-success fw-800 rounded-pill px-3">COMPLETED</span>
                                                    ) : (
                                                        <span className="badge bg-light text-secondary fw-800 rounded-pill px-3">{proj.allocated_count} LEADS</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="ms-4">
                                                {currentUser && (Number(proj.team_leader) === Number(currentUser.id) || currentUser.is_superuser) ? (
                                                    <button 
                                                        className="btn btn-primary btn-sm rounded-pill px-4 fw-800"
                                                        onClick={(e) => { e.stopPropagation(); handleOpenAllocate(proj); }}
                                                    >
                                                        {proj.allocated_count > 0 ? 'Review' : 'Allocate'}
                                                    </button>
                                                ) : (
                                                    <button className="btn btn-light btn-sm rounded-pill px-4 fw-800 border">View</button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="proj-table-container">
                                    <table className="proj-table">
                                        <thead>
                                            <tr>
                                                <th className="ps-4">Project Identity</th>
                                                <th>Deployment Leader</th>
                                                <th>Team Members</th>
                                                <th>Target Date</th>
                                                <th>Progress Status</th>
                                                <th className="pe-4 text-end">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {projects.map(proj => (
                                                <tr key={proj.id} onClick={() => handleOpenDetail(proj)} style={{ cursor: 'pointer' }}>
                                                    <td className="ps-4">
                                                        <div className="fw-900 text-dark mb-0">{proj.name}</div>
                                                        <small className="text-primary fw-800">{proj.project_id || `PROJ-${String(proj.id).padStart(3, '0')}`}</small>
                                                    </td>
                                                    <td>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <div className="pv2-team-avatar" style={{ background: '#f0f4ff', color: '#0052cc' }}>{proj.team_leader_detail?.full_name?.charAt(0) || 'A'}</div>
                                                            <span className="fw-700 text-dark">{proj.team_leader_detail?.full_name || 'Admin'}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="pv2-team-avatars">
                                                            {proj.members_detail?.slice(0, 3).map(m => (
                                                                <div key={m.id} className="pv2-team-avatar" title={m.full_name}>{m.first_name?.charAt(0)}</div>
                                                            ))}
                                                            {proj.members_detail?.length > 3 && (
                                                                <div className="pv2-team-avatar pv2-team-more">+{proj.members_detail.length - 3}</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="fw-700 text-secondary">{proj.target_date || 'N/A'}</span>
                                                    </td>
                                                    <td>
                                                        <div className="d-flex align-items-center gap-3" style={{ width: '180px' }}>
                                                            <div className="pv2-progress-bar" style={{ flex: 1 }}>
                                                                <div className="pv2-progress-fill" style={{ width: `${proj.progress_percentage}%` }}></div>
                                                            </div>
                                                            <span className="fw-900 text-primary" style={{ fontSize: '0.75rem' }}>{proj.progress_percentage}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="pe-4 text-end">
                                                        <button 
                                                            className="btn btn-link text-primary fw-800 p-0 text-decoration-none"
                                                            onClick={(e) => { e.stopPropagation(); handleOpenAllocate(proj); }}
                                                        >
                                                            {proj.allocated_count > 0 ? 'REVIEW' : 'ALLOCATE'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Project Detail Modal */}
            {showDetailModal && selectedDetailProject && (
                <div className="crm-modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)',
                    zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="crm-modal-content animate-fade-in" style={{
                        background: 'var(--crm-card-bg)', width: '850px', borderRadius: '28px',
                        padding: '2.5rem', border: '1px solid var(--crm-border)', boxShadow: 'var(--crm-shadow)',
                        maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <div className="d-flex justify-content-between align-items-start mb-4">
                            <div>
                                <div className="d-flex align-items-center gap-2 mb-1">
                                    <span className="badge bg-primary-light text-primary fw-800 rounded-pill px-3" style={{ fontSize: '0.7rem' }}>
                                        {selectedDetailProject.project_id || `PROJ-${String(selectedDetailProject.id).padStart(3, '0')}`}
                                    </span>
                                    {selectedDetailProject.progress_percentage === 100 && <span className="badge bg-success-light text-success fw-800 rounded-pill px-3" style={{ fontSize: '0.7rem' }}>COMPLETED</span>}
                                </div>
                                <h2 className="fw-900 text-dark mb-1">{selectedDetailProject.name}</h2>
                                <p className="text-secondary fw-600 mb-0">Managed by {selectedDetailProject.team_leader_detail?.full_name || 'System Admin'}</p>
                            </div>
                            <button className="btn btn-light rounded-circle shadow-sm" onClick={() => setShowDetailModal(false)}>
                                <i className="fa fa-times"></i>
                            </button>
                        </div>

                        <div className="row g-4 mb-5">
                            <div className="col-md-3">
                                <div className="p-3 bg-light rounded-4 border">
                                    <small className="text-uppercase fw-800 text-muted d-block mb-1" style={{ fontSize: '0.6rem', letterSpacing: '1px' }}>Category</small>
                                    <span className="fw-700 text-dark">{selectedDetailProject.category_detail?.name || 'General Outreach'}</span>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="p-3 bg-light rounded-4 border">
                                    <small className="text-uppercase fw-800 text-muted d-block mb-1" style={{ fontSize: '0.6rem', letterSpacing: '1px' }}>Due Date</small>
                                    <span className="fw-700 text-dark">{selectedDetailProject.target_date || 'N/A'}</span>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="p-3 bg-light rounded-4 border">
                                    <small className="text-uppercase fw-800 text-muted d-block mb-1" style={{ fontSize: '0.6rem', letterSpacing: '1px' }}>Total Leads</small>
                                    <span className="fw-700 text-dark">{detailAssignments.length}</span>
                                </div>
                            </div>
                            <div className="col-md-3">
                                <div className="p-3 bg-light rounded-4 border">
                                    <small className="text-uppercase fw-800 text-muted d-block mb-1" style={{ fontSize: '0.6rem', letterSpacing: '1px' }}>Percentage</small>
                                    <span className="fw-700 text-primary">{selectedDetailProject.progress_percentage}%</span>
                                </div>
                            </div>
                        </div>

                        {selectedDetailProject.members_detail?.length > 1 ? (
                            <div className="team-distribution-section">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h4 className="fw-800 text-dark mb-0">Team Allocation Mapping</h4>
                                    <div className="badge rounded-pill bg-light text-secondary border px-3 py-2 fw-700" style={{ fontSize: '0.75rem' }}>
                                        {detailAssignments.filter(a => a.assignee).length} / {detailAssignments.length} Allocated
                                    </div>
                                </div>
                                <div className="table-responsive rounded-4 border overflow-hidden">
                                    <table className="table table-hover align-middle mb-0">
                                        <thead className="bg-light">
                                            <tr>
                                                <th className="ps-4 fw-800 text-secondary" style={{ fontSize: '0.7rem' }}>LEAD IDENTITY</th>
                                                <th className="fw-800 text-secondary" style={{ fontSize: '0.7rem' }}>COMPANY & DETAILS</th>
                                                <th className="fw-800 text-secondary" style={{ fontSize: '0.7rem' }}>CURRENT ASSIGNEE</th>
                                                <th className="pe-4 text-end fw-800 text-secondary" style={{ fontSize: '0.7rem' }}>STATUS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailAssignments.map(asgn => (
                                                <tr key={asgn.id}>
                                                    <td className="ps-4 py-3">
                                                        <div className="fw-700 text-dark">{asgn.lead_detail?.first_name} {asgn.lead_detail?.last_name}</div>
                                                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>{asgn.lead_detail?.phone}</small>
                                                    </td>
                                                    <td>
                                                        <div className="fw-600 text-secondary" style={{ fontSize: '0.75rem' }}>{asgn.lead_detail?.company || 'N/A'}</div>
                                                        <div className="badge bg-light text-muted fw-700 px-2 mt-1" style={{ fontSize: '0.6rem' }}>{asgn.lead_detail?.lead_source}</div>
                                                    </td>
                                                    <td>
                                                        {asgn.assignee_detail ? (
                                                            <div className="d-flex align-items-center gap-2">
                                                                <div className="rounded-circle bg-primary-light d-flex align-items-center justify-content-center fw-800 text-primary" style={{ width: '24px', height: '24px', fontSize: '0.6rem' }}>
                                                                    {asgn.assignee_detail.full_name.charAt(0)}
                                                                </div>
                                                                <span className="fw-700 text-dark" style={{ fontSize: '0.8rem' }}>{asgn.assignee_detail.full_name}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-danger fw-700 italic" style={{ fontSize: '0.75rem' }}>Unallocated</span>
                                                        )}
                                                    </td>
                                                    <td className="pe-4 text-end">
                                                        <span className={`badge rounded-pill px-3 py-1 ${asgn.status === 'Opportunity' ? 'bg-success text-white' : 'bg-light text-dark border fw-700'}`} style={{ fontSize: '0.65rem' }}>
                                                            {asgn.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="individual-assignment-section py-5 text-center bg-light rounded-4 border">
                                <i className="fa fa-user-circle fa-3x text-muted mb-3 opacity-25"></i>
                                <h5 className="fw-800 text-dark mb-1">Individual Project Assignment</h5>
                                <p className="text-secondary fw-600 mb-0 px-5">This project is exclusively assigned to {selectedDetailProject.team_leader_detail?.full_name}. All associated leads are directly managed by the deployment leader.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Project Modal */}
            {showModal && (
                <div className="crm-modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                    zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="crm-modal-content" style={{
                        background: 'var(--crm-card-bg)', width: '600px', borderRadius: '24px',
                        padding: '2.5rem', border: '1px solid var(--crm-border)', boxShadow: 'var(--crm-shadow)',
                        animation: 'crmSlideUp 0.3s ease-out'
                    }}>
                        <style>{`
                            @keyframes crmSlideUp {
                                from { opacity: 0; transform: translateY(30px) scale(0.95); }
                                to { opacity: 1; transform: translateY(0) scale(1); }
                            }
                        `}</style>
                        <h3 className="fw-800 text-primary mb-4">Initialize Execution Project</h3>
                        <form onSubmit={handleProjectSave}>
                            <div className="crm-input-group mb-4">
                                <label className="crm-label">Project Domain Name</label>
                                <input 
                                    type="text" className="crm-input" placeholder="e.g. Q1 Vendor Outreach"
                                    value={projectForm.name}
                                    onChange={(e) => setProjectForm({...projectForm, name: e.target.value})}
                                    required
                                    style={{
                                        width: '100%', padding: '0.9rem 1.25rem', background: 'var(--crm-bg)',
                                        border: '1px solid var(--crm-border)', borderRadius: '12px', color: 'var(--crm-text-primary)'
                                    }}
                                />
                            </div>
                            <div className="row">
                                <div className="col-md-6">
                                    <div className="crm-input-group mb-4">
                                        <label className="crm-label">Allocation Type / Team Lead</label>
                                        <select 
                                            className="crm-input crm-select"
                                            value={allocationType}
                                            onChange={(e) => {
                                                setAllocationType(e.target.value);
                                                setIndividualAssignee('');
                                            }}
                                            required
                                            style={{
                                                width: '100%', padding: '0.9rem 1.25rem', background: 'var(--crm-bg)',
                                                border: '1px solid var(--crm-border)', borderRadius: '12px', color: 'var(--crm-text-primary)'
                                            }}
                                        >
                                            <option value="individual">Individual Lead Allocation</option>
                                            <optgroup label="Tele Calling Teams">
                                                {teams.filter(t => t.department_detail?.name === 'Tele Calling').map(t => (
                                                    <option key={t.id} value={`team_${t.id}`}>
                                                        {t.name} (Lead: {t.lead_detail?.full_name || 'None'})
                                                    </option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Other Teams">
                                                {teams.filter(t => t.department_detail?.name !== 'Tele Calling').map(t => (
                                                    <option key={t.id} value={`team_${t.id}`}>
                                                        {t.name} (Lead: {t.lead_detail?.full_name || 'None'})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="crm-input-group mb-4">
                                        <label className="crm-label">Target Completion Date</label>
                                        <input 
                                            type="date" className="crm-input"
                                            value={projectForm.target_date}
                                            onChange={(e) => setProjectForm({...projectForm, target_date: e.target.value})}
                                            required
                                            style={{
                                                width: '100%', padding: '0.9rem 1.25rem', background: 'var(--crm-bg)',
                                                border: '1px solid var(--crm-border)', borderRadius: '12px', color: 'var(--crm-text-primary)'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="crm-input-group mb-4">
                                <label className="crm-label">
                                    {allocationType === 'individual' ? 'Target Assignee (Select ONE)' : 'Team Members (Read-only)'}
                                </label>
                                <div className="d-flex flex-wrap gap-2" style={{ maxHeight: '150px', overflowY: 'auto', padding: '15px', background: 'var(--crm-bg)', borderRadius: '16px', border: '1px solid var(--crm-border)' }}>
                                    {allocationType === 'individual' ? (
                                        users.map(u => (
                                            <label key={u.id} className="d-flex align-items-center gap-2 p-2 px-3 border rounded-pill bg-white mb-0" style={{ cursor: 'pointer', transition: 'all 0.2s', borderColor: individualAssignee === u.id ? 'var(--crm-accent)' : '#eee' }}>
                                                <input 
                                                    type="radio"
                                                    name="individualAssignee"
                                                    className="form-check-input mt-0"
                                                    value={u.id}
                                                    checked={individualAssignee === u.id}
                                                    onChange={(e) => setIndividualAssignee(parseInt(e.target.value))}
                                                />
                                                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--crm-text-primary)' }}>
                                                    {u.first_name || u.username} {u.last_name || ''} {u.designation?.title ? `(${u.designation.title})` : ''}
                                                </span>
                                            </label>
                                        ))
                                    ) : (
                                        (() => {
                                            const tId = parseInt(allocationType.split('_')[1]);
                                            const selectedTeam = teams.find(t => t.id === tId);
                                            if (!selectedTeam || !selectedTeam.members_detail) return <small className="opacity-50">No members found.</small>;
                                            
                                            // Make sure team lead is also displayed distinctively
                                            return (
                                                <>
                                                    {selectedTeam.lead_detail && (
                                                        <div className="d-flex align-items-center gap-2 p-2 px-3 rounded-pill bg-light mb-0 border" style={{ borderColor: 'var(--crm-accent)'}}>
                                                            <i className="fa fa-star text-warning"></i>
                                                            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--crm-text-primary)' }}>
                                                                {selectedTeam.lead_detail.full_name}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {selectedTeam.members_detail.map(m => {
                                                        if (selectedTeam.lead_detail && m.id === selectedTeam.lead_detail.id) return null;
                                                        return (
                                                            <div key={m.id} className="d-flex align-items-center gap-2 p-2 px-3 rounded-pill bg-light mb-0 border">
                                                                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--crm-text-primary)' }}>
                                                                    {m.full_name}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </>
                                            );
                                        })()
                                    )}
                                </div>
                            </div>
                            <div className="d-flex gap-3 mt-4 pt-3">
                                <button type="submit" className="crm-submit-btn w-100" style={{
                                    background: 'var(--crm-accent)', color: '#fff', border: 'none', padding: '1rem',
                                    borderRadius: '14px', fontWeight: '800', boxShadow: '0 10px 20px rgba(0, 209, 255, 0.2)'
                                }}>DEPLOY PROJECT</button>
                                <button type="button" className="btn btn-link text-secondary fw-700" onClick={() => setShowModal(false)} style={{ textDecoration: 'none' }}>CANCEL</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Allocate Leads Modal (Team Lead View) */}
            {showAllocateModal && selectedProject && (
                <div className="crm-modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
                    zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="crm-modal-content" style={{
                        background: 'var(--crm-card-bg)', width: '900px', borderRadius: '24px',
                        padding: '2.5rem', border: '1px solid var(--crm-border)', boxShadow: 'var(--crm-shadow)',
                        maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <div className="d-flex justify-content-between align-items-center mb-0">
                            <div>
                                <h3 className="fw-800 text-primary mb-1">Project Allocation Control</h3>
                                <p className="text-secondary fw-600 mb-0">Project: {selectedProject.name}</p>
                            </div>
                            <button className="btn btn-light rounded-circle" onClick={() => setShowAllocateModal(false)}>
                                <i className="fa fa-times"></i>
                            </button>
                        </div>

                        {/* View Toggles */}
                        <div className="d-flex gap-2 my-4 p-1 bg-light rounded-pill" style={{ width: 'fit-content' }}>
                            <button 
                                className={`btn btn-sm rounded-pill px-4 fw-800 ${allocationView === 'pending' ? 'btn-primary shadow-sm' : 'btn-light'}`}
                                onClick={() => setAllocationView('pending')}
                            >
                                Pending Allocation ({unallocatedLeads.length})
                            </button>
                            <button 
                                className={`btn btn-sm rounded-pill px-4 fw-800 ${allocationView === 'overview' ? 'btn-primary shadow-sm' : 'btn-light'}`}
                                onClick={() => setAllocationView('overview')}
                            >
                                Team Overview ({allocatedLeads.length})
                            </button>
                        </div>

                        {allocationView === 'pending' ? (
                            <div className="row animate-fade-in">
                                <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
                                <div className="col-md-6 border-end">
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h5 className="fw-700 mb-0 ml-2">Available Leads</h5>
                                        {unallocatedLeads.length > 0 && (
                                            <button 
                                                className="btn btn-xs btn-link text-primary fw-700 p-0"
                                                onClick={() => {
                                                    if (allocationLeads.length === unallocatedLeads.length) {
                                                        setAllocationLeads([]);
                                                    } else {
                                                        setAllocationLeads(unallocatedLeads.map(a => a.id));
                                                    }
                                                }}
                                            >
                                                {allocationLeads.length === unallocatedLeads.length ? 'Deselect All' : 'Select All'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="unallocated-list" style={{ paddingRight: '10px' }}>
                                        {unallocatedLeads.length === 0 ? (
                                            <div className="text-center py-5 opacity-50">All leads in this project have been allocated.</div>
                                        ) : (
                                            unallocatedLeads.map(asgn => (
                                                <div 
                                                    key={asgn.id} 
                                                    className={`repo-lead-card p-2 mb-2 ${allocationLeads.includes(asgn.id) ? 'border-primary' : ''}`}
                                                    onClick={() => toggleAllocationLead(asgn.id)}
                                                    style={{ cursor: 'pointer', borderRadius: '12px', border: '1px solid #eee' }}
                                                >
                                                    <div className="d-flex align-items-center gap-3">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={allocationLeads.includes(asgn.id)}
                                                            onChange={() => {}} // Row click handles it
                                                            className="form-check-input mt-0"
                                                        />
                                                        <div className="repo-lead-info">
                                                            <h6 className="mb-0 fw-700" style={{ fontSize: '0.9rem' }}>{asgn.lead_detail?.first_name} {asgn.lead_detail?.last_name}</h6>
                                                            <small className="text-secondary">{asgn.lead_detail?.company || 'Lead'}</small>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                                <div className="col-md-6 ps-4">
                                    <h5 className="fw-700 mb-3 text-dark">Distribute To</h5>
                                    <div className="crm-input-group mb-4">
                                        <label className="crm-label">Select Team Member (View Workload)</label>
                                        <div className="allocation-member-list mt-3" style={{ paddingRight: '10px', overflowX: 'hidden' }}>
                                            {selectedProject.members_detail?.filter(m => Number(m.id) !== Number(currentUser?.id)).map(m => {
                                                const perf = memberPerformance.find(p => p.id === m.id) || { total_leads: 0, processed_leads: 0, conversions: 0 };
                                                const outstanding = perf.total_leads - perf.processed_leads;
                                                const isSelected = Number(allocationMember) === Number(m.id);
                                                
                                                return (
                                                    <div 
                                                        key={m.id} 
                                                        className={`member-workload-card p-3 mb-2 border rounded-4 d-flex align-items-center justify-content-between ${isSelected ? 'border-primary bg-light' : ''}`}
                                                        onClick={() => setAllocationMember(m.id)}
                                                        style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                                                    >
                                                        <div className="d-flex align-items-center gap-3">
                                                            <div className="rounded-circle bg-primary-light text-primary d-flex align-items-center justify-content-center fw-900" style={{ width: '40px', height: '40px', fontSize: '0.9rem' }}>
                                                                {m.full_name?.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div className="fw-800 text-dark" style={{ fontSize: '0.85rem' }}>{m.full_name}</div>
                                                                <div className="text-secondary fw-600" style={{ fontSize: '0.7rem' }}>Team Member</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-end" style={{ minWidth: '120px' }}>
                                                            <div className="d-flex flex-column gap-2">
                                                                <span className="badge rounded-pill bg-warning-light badge-workload">
                                                                    {outstanding} OUTSTANDING
                                                                </span>
                                                                <span className="badge rounded-pill bg-success-light badge-workload">
                                                                    {perf.conversions} CONVERTED
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="mt-5 pt-4">
                                        <button 
                                            className="btn btn-primary w-100 py-3 fw-800 shadow-sm"
                                            style={{ borderRadius: '14px', background: 'var(--crm-accent)', border: 'none' }}
                                            onClick={handleBatchAllocate}
                                            disabled={!allocationMember || allocationLeads.length === 0}
                                        >
                                            ALLOCATE {allocationLeads.length > 0 && `(${allocationLeads.length})`}
                                        </button>
                                        <p className="text-center mt-3 text-secondary" style={{ fontSize: '0.75rem' }}>
                                            Selected leads will be assigned to the chosen member for follow-up.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="animate-fade-in">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h5 className="fw-700 mb-0">Current Assignments</h5>
                                    <div className="text-muted fw-600" style={{ fontSize: '0.8rem' }}>
                                        Track distribution per member
                                    </div>
                                </div>
                                <div className="assignment-overview-list" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                                    <div className="table-responsive">
                                        <table className="table table-borderless align-middle">
                                            <thead>
                                                <tr style={{ background: '#f8fbfc' }}>
                                                    <th className="rounded-start ps-3" style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--crm-text-secondary)' }}>LEAD NAME</th>
                                                    <th style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--crm-text-secondary)' }}>COMPANY / SOURCE</th>
                                                    <th className="rounded-end text-end pe-3" style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--crm-text-secondary)' }}>ASSIGNED TO</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {allocatedLeads.map(asgn => (
                                                    <tr key={asgn.id} className="border-bottom">
                                                        <td className="ps-3">
                                                            <div className="fw-700 text-dark" style={{ fontSize: '0.85rem' }}>
                                                                {asgn.lead_detail?.first_name} {asgn.lead_detail?.last_name}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="text-muted fw-600" style={{ fontSize: '0.75rem' }}>
                                                                {asgn.lead_detail?.company || 'N/A'} • {asgn.lead_detail?.lead_source || 'Direct'}
                                                            </div>
                                                        </td>
                                                        <td className="text-end pe-3">
                                                            <span className="badge rounded-pill px-3 py-2" style={{ background: 'var(--crm-bg)', color: 'var(--crm-accent)', fontWeight: '800', fontSize: '0.7rem', border: '1px solid var(--crm-border)' }}>
                                                                <i className="fa fa-user-circle me-1 opacity-50"></i>
                                                                {asgn.assignee_detail?.full_name || 'Member'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {allocatedLeads.length === 0 && (
                                                    <tr>
                                                        <td colSpan="3" className="text-center py-5 opacity-50">No leads have been allocated yet.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeleCallingDashboard;
