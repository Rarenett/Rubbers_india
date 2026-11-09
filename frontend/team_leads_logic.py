import re

file_path = r"c:\Archana\glenda_vite\frontend\src\jsx\components\crm_new\TeleCallingDashboard.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add showAddLeadSection state
if "const [showAddLeadSection, setShowAddLeadSection] = useState(false);" not in content:
    content = content.replace("const [editingTeamId, setEditingTeamId] = useState(null);", 
                              "const [editingTeamId, setEditingTeamId] = useState(null);\n    const [showAddLeadSection, setShowAddLeadSection] = useState(false);")

# 2. Add handleRemoveLeadFromModal function
remove_fn = """
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
"""
if "const handleRemoveLeadFromModal" not in content:
    content = content.replace("const handleEditTeam = (proj) => {", remove_fn + "\n    const handleEditTeam = (proj) => {")

# 3. Modify "Selected Leads" Header to include Add Lead button
old_header = r"<Form\.Label className=\"form-label-custom mb-2\">Selected Leads \(\{selectedLeads\.length\}\)</Form\.Label>"
new_header = """<div className="d-flex justify-content-between align-items-center mb-2">
                                <Form.Label className="form-label-custom mb-0">Selected Leads ({selectedLeads.length})</Form.Label>
                                <Button variant="outline-primary" size="sm" onClick={() => setShowAddLeadSection(!showAddLeadSection)}>
                                    <i className={`fa ${showAddLeadSection ? 'fa-minus' : 'fa-plus'} me-1`}></i> {showAddLeadSection ? 'Hide' : 'Add Lead'}
                                </Button>
                            </div>"""
content = re.sub(old_header, new_header, content)

# 4. Add Remove icon to the Selected Leads table
old_td = r"<td style=\{\{ padding: '10px 15px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' \}\}>\s*<span className=\"badge bg-light text-secondary border\">\{lead\.category_detail\?\.name \|\| 'Unknown'\}</span>\s*</td>"
new_td = """<td style={{ padding: '10px 15px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                                                    <div className="d-flex justify-content-end align-items-center gap-2">
                                                        <span className="badge bg-light text-secondary border">{lead.category_detail?.name || 'Unknown'}</span>
                                                        <button 
                                                            type="button"
                                                            className="btn btn-outline-danger shadow" 
                                                            onClick={() => handleRemoveLeadFromModal(lead.id)}
                                                            title="Remove"
                                                            style={{ width: '26px', height: '26px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '4px' }}
                                                        >
                                                            <i className="fa fa-trash"></i>
                                                        </button>
                                                    </div>
                                                </td>"""
content = re.sub(old_td, new_td, content)

# 5. Inject Add Lead Section below the Selected Leads Table
add_lead_section = """
                            {showAddLeadSection && (
                                <div className="mt-3 p-3 bg-light rounded border">
                                    <h6 className="mb-3" style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Add New Leads</h6>
                                    <Select
                                        options={[
                                            { value: 'ALL', label: 'Select All (All Repositories)' },
                                            ...categories.map(cat => ({
                                                value: cat.id,
                                                label: `${cat.name} — ${cat.lead_count || 0} Leads`
                                            }))
                                        ]}
                                        value={activeCategory === 'ALL' 
                                            ? { value: 'ALL', label: 'Select All (All Repositories)' }
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
                                        styles={{ container: base => ({ ...base, marginBottom: '15px' }) }}
                                    />
                                    {activeCategory && leads.length > 0 ? (
                                        <div className="table-responsive bg-white border rounded" style={{ maxHeight: '250px', overflowY: 'auto' }}>
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
"""
content = content.replace("</table>\n                            </div>", "</table>\n                            </div>" + add_lead_section)


# 6. Fix the missing PATCH logic in the save button (my previous script failed here due to string matching)
old_save_btn_regex = r"try \{\s*const payload = \{\s*name: teamName,\s*members: \[\],\s*leads: selectedLeads\.map\(lead => \(\{\s*id: lead\.id,\s*source: lead\.category_detail\?\.name \|\| 'Unknown'\s*\}\)\)\s*\};\s*const res = await axiosInstance\.post\('/api/crm_new/telecalling-teams/', payload\);\s*if \(res\.status === 201\) \{\s*Swal\.fire\(\{icon: 'success', title: 'Team Created', text: 'The team has been successfully created\.', timer: 1500\}\);\s*setSelectedLeads\(\[\]\);\s*setShowTeamModal\(false\);\s*setTeamName\(''\);\s*window\.location\.reload\(\); \s*\}\s*\} catch \(error\) \{\s*console\.error\(\"Error creating team:\", error\);\s*Swal\.fire\(\{\s*icon: 'error',\s*title: 'Creation Failed',\s*text: 'Failed to create the team\.',\s*confirmButtonColor: '#d33'\s*\}\);\s*\}"

new_save_btn = """try {
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
                            }"""
content = re.sub(old_save_btn_regex, new_save_btn, content)

# Update Button Text
content = content.replace("Create Team\n                        </button>\n                    </div>\n                </Form>\n            </Modal>", 
                          "{editingTeamId ? 'Update Team' : 'Create Team'}\n                        </button>\n                    </div>\n                </Form>\n            </Modal>")

# Hide Add Lead Section when closing modal
content = content.replace("setShowTeamModal(false); setTeamName(''); setEditingTeamId(null); }", "setShowTeamModal(false); setTeamName(''); setEditingTeamId(null); setShowAddLeadSection(false); }")


with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
