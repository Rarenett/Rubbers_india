import re

file_path = 'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state variables for the team modal
state_hooks = """
    const [teamName, setTeamName] = useState('');
    const [teamMembers, setTeamMembers] = useState([]);
"""
content = re.sub(r'(const \[showTeamModal, setShowTeamModal\] = useState\(false\);)', r'\1' + state_hooks, content)


# 2. Modify fetchData to fetch from telecalling-teams
fetch_data_old = """const [projRes, catRes, userRes, teamRes] = await Promise.allSettled([
                    axiosInstance.get('/api/crm_new/telecalling/'),
                    axiosInstance.get('/api/crm/categories/'),
                    axiosInstance.get('/api/hr/users/?department=Telecalling'),
                    axiosInstance.get('/api/teams/teams/')
                ]);"""
fetch_data_new = """const [projRes, catRes, userRes, teamRes, teleTeamRes] = await Promise.allSettled([
                    axiosInstance.get('/api/crm_new/telecalling/'),
                    axiosInstance.get('/api/crm/categories/'),
                    axiosInstance.get('/api/hr/users/?department=Telecalling'),
                    axiosInstance.get('/api/teams/teams/'),
                    axiosInstance.get('/api/crm_new/telecalling-teams/')
                ]);"""
content = content.replace(fetch_data_old, fetch_data_new)


# 3. Combine telecalling-teams into projects
combine_projects_old = """const allProjects = projRes.value.data;"""
combine_projects_new = """
                    let allProjects = projRes.value.data || [];
                    if (teleTeamRes.status === 'fulfilled' && teleTeamRes.value.status === 200) {
                        const generatedTeams = teleTeamRes.value.data.map(team => ({
                            id: 'team_' + team.id,
                            name: team.name,
                            target_date: team.created_at, // Use created_at as target_date placeholder
                            leads: team.lead_assignments || [],
                            status: 'In Progress',
                            progress_percentage: 0,
                            team_leader: null, // Teams created here don't have a specific leader yet
                            team_leader_detail: null
                        }));
                        allProjects = [...allProjects, ...generatedTeams];
                    }
"""
content = content.replace(combine_projects_old, combine_projects_new)


# 4. Modify the Make Team form inputs
form_name_old = """<Form.Control type="text" placeholder="Enter team name" />"""
form_name_new = """<Form.Control type="text" placeholder="Enter team name" value={teamName} onChange={e => setTeamName(e.target.value)} />"""
content = content.replace(form_name_old, form_name_new)

form_select_old = """<Select
                                        isMulti
                                        options={users.map(u => ({ value: u.id, label: u.first_name + ' ' + u.last_name }))}
                                        placeholder="Select team members..."
                                    />"""
form_select_new = """<Select
                                        isMulti
                                        options={users.map(u => ({ value: u.id, label: u.first_name + ' ' + u.last_name }))}
                                        value={teamMembers}
                                        onChange={setTeamMembers}
                                        placeholder="Select team members..."
                                    />"""
content = content.replace(form_select_old, form_select_new)

# 5. Modify the Create Team button onClick handler
btn_click_old = """<Button variant="success" onClick={() => {
                                console.error("Team creation could not be completed because the TelecallingTeam and TelecallingLeadAssignment Django models do not currently exist in the database.");
                                Swal.fire({
                                    icon: 'error',
                                    title: 'Backend Unavailable',
                                    text: 'Team creation failed. Backend migrations are required.',
                                    confirmButtonColor: '#d33',
                                    confirmButtonText: 'OK'
                                }).then((result) => {
                                    if (result.isConfirmed) {
                                        // TODO: Uncomment when backend is ready to clear selection on success
                                        // setSelectedLeads([]);
                                        // setShowTeamModal(false);
                                    }
                                });
                            }}>Create Team</Button>"""

btn_click_new = """<Button variant="success" onClick={async () => {
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
                                        members: teamMembers.map(m => m.value),
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
                                        setTeamMembers([]);
                                        
                                        // Call fetchData using window.location.reload as a fallback if fetchData is not in scope, 
                                        // but since it's an inline onClick, it should have access if fetchData is accessible. 
                                        // Wait, fetchData is inside a useEffect!
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
                            }}>Create Team</Button>"""
content = content.replace(btn_click_old, btn_click_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("TeleCallingDashboard.jsx updated successfully!")
