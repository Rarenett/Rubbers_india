import re

file_path = r"c:\Archana\glenda_vite\frontend\src\jsx\components\crm_new\TeleCallingDashboard.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add Pagination import if not exists
if "import Pagination from" not in content:
    content = content.replace("import PageTitle from '../../layouts/PageTitle';", "import PageTitle from '../../layouts/PageTitle';\nimport Pagination from '../Common/Pagination';")

# 2. Add pagination states for the team modal
if "const [teamModalCurrentPage, setTeamModalCurrentPage] = useState(1);" not in content:
    state_injection = """    const [showTeamModal, setShowTeamModal] = useState(false);
    const [teamName, setTeamName] = useState('');
    const [teamModalCurrentPage, setTeamModalCurrentPage] = useState(1);
    const teamModalItemsPerPage = 5;"""
    content = re.sub(r"    const \[showTeamModal, setShowTeamModal\] = useState\(false\);\s*const \[teamName, setTeamName\] = useState\(''\);", state_injection, content)

# 3. Replace the Team Modal markup
old_modal_start = r"            {/\* Make Team Modal \*/}\s*<Modal show={showTeamModal}.*?<\/Modal>"
old_modal_regex = re.compile(old_modal_start, re.DOTALL)

new_modal = """            {/* Make Team Modal */}
            <Modal 
                show={showTeamModal} 
                onHide={() => { setShowTeamModal(false); setTeamName(''); setTeamModalCurrentPage(1); }} 
                dialogClassName="telecalling-team-modal"
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
                                Create Telecalling Team
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Assign selected leads to a new team
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => { setShowTeamModal(false); setTeamName(''); setTeamModalCurrentPage(1); }}>
                        &times;
                    </button>
                </div>
                
                <Form>
                    <div className="modal-body-custom" style={{ overflowY: 'auto', overflowX: 'hidden', maxHeight: 'calc(100vh - 220px)' }}>
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
                            <Form.Label className="form-label-custom mb-2">Selected Leads ({selectedLeads.length})</Form.Label>
                            
                            <div className="table-responsive park-area-table-wrapper" style={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                <table className="table table-responsive-md mb-0">
                                    <thead style={{ background: '#f8fafc' }}>
                                        <tr>
                                            <th style={{ padding: '10px 15px', borderBottom: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b' }}><strong>LEAD</strong></th>
                                            <th style={{ padding: '10px 15px', borderBottom: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b', textAlign: 'right' }}><strong>REPOSITORY</strong></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedLeads.length > 0 ? (() => {
                                            const indexOfLast = teamModalCurrentPage * teamModalItemsPerPage;
                                            const indexOfFirst = indexOfLast - teamModalItemsPerPage;
                                            const currentLeads = selectedLeads.slice(indexOfFirst, indexOfLast);
                                            
                                            return currentLeads.map((lead, idx) => (
                                                <tr key={lead.id}>
                                                    <td style={{ padding: '10px 15px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <div style={{ fontSize: '14px', color: '#334155', fontWeight: '500' }}>
                                                            {lead.company ? `${lead.company} - ` : ''}{lead.first_name} {lead.last_name}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '10px 15px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                                                        <span className="badge bg-light text-secondary border">{lead.category_detail?.name || 'Unknown'}</span>
                                                    </td>
                                                </tr>
                                            ));
                                        })() : (
                                            <tr>
                                                <td colSpan="2" className="text-center py-3 text-muted" style={{ fontSize: '13px' }}>
                                                    No leads selected.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {selectedLeads.length > 0 && (
                                <div className="mt-3">
                                    <Pagination
                                        currentPage={teamModalCurrentPage}
                                        setCurrentPage={setTeamModalCurrentPage}
                                        totalPages={Math.ceil(selectedLeads.length / teamModalItemsPerPage)}
                                        indexOfFirst={(teamModalCurrentPage - 1) * teamModalItemsPerPage}
                                        indexOfLast={Math.min(teamModalCurrentPage * teamModalItemsPerPage, selectedLeads.length)}
                                        totalRecords={selectedLeads.length}
                                        loading={false}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={() => { setShowTeamModal(false); setTeamName(''); setTeamModalCurrentPage(1); }}>
                            Cancel
                        </button>
                        <button type="button" className="btn-save-custom" onClick={async () => {
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
                                    setTeamModalCurrentPage(1);
                                    
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
                        </button>
                    </div>
                </Form>
            </Modal>"""

content = old_modal_regex.sub(new_modal, content)

# 4. Inject styles if not present
if "telecalling-team-modal" not in content and "<style>" not in content:
    style_block = """
            <style>{`
                .telecalling-team-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .telecalling-team-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .telecalling-team-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
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
                }
                .telecalling-team-modal .modal-close-x:hover {
                    color: #555;
                }
                .telecalling-team-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: 55vh;
                    overflow-y: auto;
                }
                .telecalling-team-modal .modal-body-custom::-webkit-scrollbar {
                    width: 6px;
                }
                .telecalling-team-modal .modal-body-custom::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 4px;
                }
                .telecalling-team-modal .modal-body-custom::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .telecalling-team-modal .modal-body-custom::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
                .telecalling-team-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 16px 28px 24px;
                    gap: 12px;
                    background-color: #fff;
                    border-top: 1px solid #f1f5f9;
                }
                .telecalling-team-modal .btn-close-custom {
                    background: #f1f5f9;
                    color: #475569;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-weight: 500;
                    font-size: 14px;
                    transition: all 0.2s;
                }
                .telecalling-team-modal .btn-close-custom:hover {
                    background: #e2e8f0;
                    color: #1e293b;
                }
                .telecalling-team-modal .btn-save-custom {
                    background: #2ece8a;
                    color: white;
                    border: none;
                    padding: 10px 24px;
                    border-radius: 8px;
                    font-weight: 500;
                    font-size: 14px;
                    transition: all 0.2s;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                    display: inline-flex;
                    align-items: center;
                }
                .telecalling-team-modal .btn-save-custom:hover {
                    background: #25b879;
                    box-shadow: 0 6px 14px rgba(46, 206, 138, 0.3);
                    transform: translateY(-1px);
                }
                .telecalling-team-modal .btn-save-custom:disabled {
                    background: #94a3b8;
                    box-shadow: none;
                    transform: none;
                    cursor: not-allowed;
                }
                .telecalling-team-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 600;
                    color: #475569;
                    margin-bottom: 8px;
                }
                .telecalling-team-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    padding: 10px 14px;
                    font-size: 14px;
                    color: #334155;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .telecalling-team-modal .form-control-custom:focus {
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.1);
                    outline: none;
                }
            `}</style>
"""
    # Insert style block right before the final closing tag or at the end of return
    # Let's just append it before `        </>    )` or similar ending
    content = content.replace("        </>\n    );\n};", style_block + "        </>\n    );\n};")
    content = content.replace("        </>\r\n    );\r\n};", style_block + "        </>\r\n    );\r\n};")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
