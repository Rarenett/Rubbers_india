import re

file_path = r"c:\Archana\glenda_vite\frontend\src\jsx\components\crm_new\TeleCallingDashboard.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

old_view_modal = r"\{\/\* View Project\/Team Modal \*\/.*?<\/Modal>"

new_view_modal = """{/* View Project/Team Modal */}
            <Modal
                show={showViewModal}
                onHide={() => setShowViewModal(false)}
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
                            <i className="fa fa-eye text-white" style={{ fontSize: '20px' }}></i>
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

                <div className="modal-body-custom" style={{ overflowY: 'auto', overflowX: 'hidden', maxHeight: '55vh' }}>
                    {viewProject && (
                        <div>
                            <div className="mb-4">
                                <h5 style={{ fontSize: '15px', color: '#334155', fontWeight: '600' }}>Name: <span style={{ fontWeight: '400' }}>{viewProject.name}</span></h5>
                                <h5 style={{ fontSize: '15px', color: '#334155', fontWeight: '600' }}>Status: <span className={`badge ${viewProject.status === 'Completed' ? 'badge-success' : viewProject.status === 'In Progress' ? 'badge-warning' : 'badge-light text-muted border'} light`} style={{ fontSize: '11px', padding: '3px 8px', marginLeft: '5px' }}>{viewProject.status}</span></h5>
                            </div>
                            
                            <h6 className="mb-3" style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Assigned Leads ({viewProject.leads?.length || 0})</h6>
                            
                            <div className="table-responsive bg-white border rounded" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                <table className="table table-sm mb-0">
                                    <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                                        <tr>
                                            <th style={{ padding: '8px 15px', fontSize: '12px', color: '#64748b' }}><strong>LEAD ID</strong></th>
                                            <th style={{ padding: '8px 15px', fontSize: '12px', color: '#64748b', textAlign: 'right' }}><strong>COMPANY</strong></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewProject.leads && viewProject.leads.length > 0 ? (
                                            viewProject.leads.map((l, index) => {
                                                const leadId = l.lead_id || l.id;
                                                const companyName = l.lead_details?.company || l.company || 'Unknown';
                                                
                                                return (
                                                    <tr key={index}>
                                                        <td style={{ padding: '10px 15px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', fontWeight: '500', color: '#334155' }}>
                                                            {leadId}
                                                        </td>
                                                        <td style={{ padding: '10px 15px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', textAlign: 'right' }}>
                                                            <span className="badge bg-light text-secondary border">{companyName}</span>
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
                
                <div className="modal-footer-custom">
                    <button type="button" className="btn-close-custom" onClick={() => setShowViewModal(false)}>
                        Close
                    </button>
                </div>
            </Modal>"""

content = re.sub(old_view_modal, new_view_modal, content, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
