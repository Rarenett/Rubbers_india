import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../services/AxiosInstance';
import LiveCaller from './LiveCaller';

const TeleCallingInteraction = () => {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [activeCall, setActiveCall] = useState(null);
    const [updateForm, setUpdateForm] = useState({
        status: '',
        remarks: '',
        target_time: ''
    });
    const [historyLogs, setHistoryLogs] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [activeHistoryAsgn, setActiveHistoryAsgn] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 9;

    useEffect(() => {
        fetchAssignments();
    }, []);

    const fetchAssignments = async () => {
        try {
            const res = await axiosInstance.get('/api/crm/assignments/?mine=true');
            if (res.status === 200) {
                setAssignments(res.data);
            }
        } catch (error) {
            console.error("Error fetching assignments", error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Flow Action 1: Initiate Call
     */
    const handleStartWorkflow = (asgn) => {
        setSelectedAssignment(asgn);
        setActiveCall(asgn);
    };

    /**
     * Flow Action 2: End Call and trigger Logging
     */
    const handleCallEnd = (duration) => {
        const asgn = activeCall;
        setActiveCall(null);
        
        // Auto-open update modal with call results pre-filled
        setUpdateForm({
            status: 'Contacted',
            remarks: `Call duration: ${Math.floor(duration/60)}m ${duration%60}s. `,
            target_time: ''
        });
        setShowUpdateModal(true);
    };

    /**
     * Flow Action 3: Manual Status Update (Alternative to calling)
     */
    const handleManualLog = (asgn) => {
        setSelectedAssignment(asgn);
        setUpdateForm({
            status: asgn.status,
            remarks: asgn.remarks || '',
            target_time: asgn.target_time ? asgn.target_time.slice(0, 16) : ''
        });
        setShowUpdateModal(true);
    };

    const fetchHistory = async (asgnId) => {
        setLoadingHistory(true);
        try {
            const res = await axiosInstance.get(`/api/crm/interaction-logs/?assignment=${asgnId}`);
            if (res.status === 200) {
                setHistoryLogs(res.data);
            }
        } catch (error) {
            console.error("Error fetching history", error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleHistoryClick = (e, asgn) => {
        e.stopPropagation();
        setActiveHistoryAsgn(asgn);
        fetchHistory(asgn.id);
    };

    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        const submitData = { ...updateForm };
        if (!submitData.target_time) submitData.target_time = null;

        try {
            const res = await axiosInstance.patch(`/api/crm/assignments/${selectedAssignment.id}/`, submitData);
            if (res.status === 200) {
                setShowUpdateModal(false);
                fetchAssignments(); // Refresh queue
            }
        } catch (error) {
            console.error("Error updating assignment", error);
        }
    };

    const statusOptions = [
        { value: 'Not Contacted', label: 'Not Contacted', color: '#6c757d', icon: 'fa-circle-o' },
        { value: 'Attempted', label: 'Attempted to Contact', color: '#ffc107', icon: 'fa-phone' },
        { value: 'Contacted', label: 'Contacted / In Discussion', color: '#0dcaf0', icon: 'fa-comments' },
        { value: 'Hold', label: 'Hold (Call Later)', color: '#fd7e14', icon: 'fa-clock-o' },
        { value: 'Opportunity', label: 'Lead Interested / Opportunity', color: '#198754', icon: 'fa-star' },
        { value: 'Disqualified', label: 'Disqualified', color: '#dc3545', icon: 'fa-ban' },
        { value: 'Junk', label: 'Junk Lead', color: '#000', icon: 'fa-trash' },
    ];

    return (
        <div className="tele-interaction-view">
            <style>{`
                .interaction-flow-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
                    gap: 1.5rem;
                }

                @media (max-width: 768px) {
                    .interaction-flow-container {
                        grid-template-columns: 1fr;
                        gap: 1rem;
                    }
                    .crm-modal-content {
                        width: calc(100vw - 24px) !important;
                        max-width: 100% !important;
                        padding: 1.75rem !important;
                        border-radius: 24px !important;
                    }
                }

                @media (max-width: 576px) {
                    .flow-card-footer {
                        flex-wrap: wrap;
                    }
                    .primary-flow-btn {
                        min-width: 100%;
                    }
                    .secondary-flow-btn {
                        flex: 1;
                    }
                }

                .flow-card {
                    background: var(--crm-card-bg);
                    border: 1px solid var(--crm-border);
                    border-radius: 30px;
                    padding: 0;
                    overflow: hidden;
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.05);
                }

                .flow-card:hover {
                    transform: translateY(-10px);
                    box-shadow: 0 20px 50px rgba(0,0,0,0.1);
                    border-color: var(--crm-accent);
                }

                /* Header Area */
                .flow-card-header {
                    padding: 1.5rem 1.5rem 1rem;
                    position: relative;
                }

                .flow-status-tag {
                    position: absolute;
                    top: 1.5rem;
                    right: 1.5rem;
                    padding: 0.4rem 0.8rem;
                    border-radius: 50px;
                    font-size: 0.7rem;
                    font-weight: 900;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    background: rgba(0,0,0,0.03);
                }

                .entity-icon {
                    width: 50px;
                    height: 50px;
                    border-radius: 15px;
                    background: linear-gradient(135deg, var(--crm-accent), #0076ff);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    font-weight: 900;
                    margin-bottom: 1rem;
                    box-shadow: 0 8px 15px rgba(0, 209, 255, 0.2);
                }

                /* Body / Info Area */
                .flow-card-body {
                    padding: 0 1.5rem 1.5rem;
                }

                .info-strip {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    background: rgba(0,0,0,0.02);
                    border-radius: 20px;
                    margin-bottom: 1rem;
                    border: 1px solid transparent;
                    transition: all 0.3s;
                }

                .info-strip:hover {
                    background: white;
                    border-color: var(--crm-border);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.02);
                }

                .info-strip i {
                    width: 35px;
                    height: 35px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: white;
                    color: var(--crm-accent);
                    font-size: 0.9rem;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                }

                /* Footer / Action Area */
                .flow-card-footer {
                    padding: 1rem 1.5rem 1.5rem;
                    background: rgba(0,0,0,0.01);
                    border-top: 1px dashed var(--crm-border);
                    display: flex;
                    gap: 0.75rem;
                }

                .primary-flow-btn {
                    flex: 1;
                    padding: 0.8rem;
                    border-radius: 15px;
                    border: none;
                    font-weight: 900;
                    font-size: 0.8rem;
                    letter-spacing: 0.5px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    transition: all 0.3s;
                    box-shadow: 0 10px 20px rgba(25, 135, 84, 0.2);
                }

                .btn-ready { background: #198754; color: white; }
                .btn-ready:hover { background: #157347; transform: translateY(-2px); }

                .secondary-flow-btn {
                    width: 45px;
                    height: 45px;
                    border-radius: 15px;
                    border: 1px solid var(--crm-border);
                    background: white;
                    color: var(--crm-text-secondary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s;
                }

                .secondary-flow-btn:hover {
                    border-color: var(--crm-accent);
                    color: var(--crm-accent);
                    background: var(--crm-accent-soft);
                }
            `}</style>

            <div className="d-flex justify-content-between align-items-center mb-5">
                <div>
                    <h2 className="fw-900 text-primary m-0">Interaction Workflow</h2>
                    <p className="text-secondary fw-700 m-0">Consolidated pipeline for lead nurturing and response tracking.</p>
                </div>
                <div className="text-end">
                    <span className="badge badge-primary px-4 py-3 fw-900" style={{ borderRadius: '15px' }}>
                        {assignments.length} PENDING INTERACTIONS
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-5 opacity-50 fw-800">Visualizing workflow hierarchy...</div>
            ) : assignments.length === 0 ? (
                <div className="text-center py-5">
                    <div className="entity-icon mx-auto bg-success">
                        <i className="fa fa-check"></i>
                    </div>
                    <h4 className="fw-900 mt-4">Pipeline Cleared</h4>
                    <p className="text-secondary fw-700">All current assignments have been processed successfully.</p>
                </div>
            ) : (() => {
                const totalPages = Math.ceil(assignments.length / pageSize);
                const safePage = Math.max(1, Math.min(currentPage, totalPages || 1));
                const indexOfLast = safePage * pageSize;
                const indexOfFirst = indexOfLast - pageSize;
                const currentAssignments = assignments.slice(indexOfFirst, indexOfLast);

                return (
                    <>
                        <div className="interaction-flow-container">
                            {currentAssignments.map(asgn => {
                                const currentStatus = statusOptions.find(o => o.value === asgn.status);
                                return (
                                    <div key={asgn.id} className="flow-card">
                                        <div className="flow-card-header">
                                            <span className="flow-status-tag" style={{ color: currentStatus?.color }}>
                                                <i className={`fa ${currentStatus?.icon} mr-2`}></i> {asgn.status}
                                            </span>
                                            <div className="entity-icon">
                                                {asgn.lead_detail?.first_name?.charAt(0)}
                                            </div>
                                            <h4 className="fw-900 m-0">{asgn.lead_detail?.first_name} {asgn.lead_detail?.last_name}</h4>
                                            <small className="text-secondary fw-800">{asgn.lead_detail?.company || 'Direct Client'}</small>
                                        </div>

                                        <div className="flow-card-body">
                                            <div className="info-strip">
                                                <i className="fa fa-phone"></i>
                                                <div>
                                                    <small className="d-block text-secondary fw-800 xsmall">PRIMARY NUMBER</small>
                                                    <span className="fw-800">{asgn.lead_detail?.phone}</span>
                                                </div>
                                            </div>
                                            <div className="info-strip">
                                                <i className="fa fa-envelope"></i>
                                                <div>
                                                    <small className="d-block text-secondary fw-800 xsmall">ELECTRONIC MAIL</small>
                                                    <span className="fw-700 small">{asgn.lead_detail?.email}</span>
                                                </div>
                                            </div>
                                            <div className="info-strip" style={{ background: 'var(--crm-accent-soft)', borderColor: 'rgba(0, 209, 255, 0.1)' }}>
                                                <i className="fa fa-briefcase" style={{ background: 'var(--crm-accent)', color: 'white' }}></i>
                                                <div>
                                                    <small className="d-block text-secondary fw-800 xsmall">PROJECT CAMPAIGN</small>
                                                    <span className="fw-800 text-primary small">{asgn.project_detail?.name}</span>
                                                </div>
                                            </div>

                                            {asgn.lead_detail?.contact_preferences && (
                                                <div className="mt-3 d-flex flex-wrap gap-2">
                                                    {asgn.lead_detail.contact_preferences.split(',').map(pref => (
                                                        <span key={pref} className="badge badge-light text-primary fw-900 px-3 py-2" style={{ fontSize: '0.6rem', borderRadius: '10px', border: '1px solid var(--crm-border)' }}>
                                                            <i className={`fa ${pref === 'Phone' ? 'fa-phone' : pref === 'WhatsApp' ? 'fa-whatsapp' : 'fa-envelope'} me-1`}></i>
                                                            {pref.toUpperCase()}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flow-card-footer">
                                            <button 
                                                className="primary-flow-btn btn-ready"
                                                onClick={() => handleStartWorkflow(asgn)}
                                            >
                                                <i className="fa fa-phone"></i> START CONVERSATION
                                            </button>
                                            
                                            <button 
                                                className="secondary-flow-btn" 
                                                title="Log Manual Outcome"
                                                onClick={() => handleManualLog(asgn)}
                                            >
                                                <i className="fa fa-pencil-square-o"></i>
                                            </button>

                                            <button 
                                                className="secondary-flow-btn" 
                                                title="Interaction History"
                                                onClick={(e) => handleHistoryClick(e, asgn)}
                                            >
                                                <i className="fa fa-history"></i>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {assignments.length > 0 && (
                            <div className="d-flex justify-content-between align-items-center mt-4 mb-4 flex-wrap gap-2">
                                <div className="text-muted" style={{ fontSize: '13px' }}>
                                    Showing {indexOfFirst + 1} to {Math.min(indexOfLast, assignments.length)} of {assignments.length} entries
                                </div>
                                {totalPages > 1 && (
                                    <nav>
                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                            <li className={`page-item page-indicator ${safePage === 1 ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={safePage === 1} style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-left" />
                                                </button>
                                            </li>
                                            {Array.from({ length: totalPages }, (_, index) => {
                                                const pageNumber = index + 1;
                                                if (
                                                    pageNumber === 1 ||
                                                    pageNumber === totalPages ||
                                                    (pageNumber >= safePage - 1 && pageNumber <= safePage + 1)
                                                ) {
                                                    return (
                                                        <li key={pageNumber} className={`page-item ${safePage === pageNumber ? 'active' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setCurrentPage(pageNumber)} style={{ border: 'none' }}>
                                                                {pageNumber}
                                                            </button>
                                                        </li>
                                                    );
                                                } else if (
                                                    pageNumber === safePage - 2 ||
                                                    pageNumber === safePage + 2
                                                ) {
                                                    return (
                                                        <li key={pageNumber} className="page-item disabled">
                                                            <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                        </li>
                                                    );
                                                }
                                                return null;
                                            })}
                                            <li className={`page-item page-indicator ${safePage === totalPages ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={safePage === totalPages} style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-right" />
                                                </button>
                                            </li>
                                        </ul>
                                    </nav>
                                )}
                            </div>
                        )}
                    </>
                );
            })()}

            {activeCall && (
                <LiveCaller 
                    assignment={selectedAssignment} 
                    onEndCall={handleCallEnd} 
                />
            )}

            {/* Consolidated Interaction History Modal */}
            {activeHistoryAsgn && (
                <div className="crm-modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(15px)',
                    zIndex: 1105, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="crm-modal-content" style={{
                        background: 'white', width: '700px', maxHeight: '85vh', borderRadius: '40px',
                        padding: '3.5rem', border: '1px solid var(--crm-border)', boxShadow: '0 30px 60px rgba(0,0,0,0.1)',
                        overflowY: 'auto', position: 'relative'
                    }}>
                        <div className="d-flex justify-content-between align-items-center mb-5">
                            <div>
                                <h3 className="fw-900 text-primary m-0">Communication Audit</h3>
                                <small className="text-secondary fw-700">Historical trajectory for {activeHistoryAsgn.lead_detail?.first_name}</small>
                            </div>
                            <button className="secondary-flow-btn" onClick={() => setActiveHistoryAsgn(null)}>
                                <i className="fa fa-times"></i>
                            </button>
                        </div>

                        {loadingHistory ? (
                            <div className="text-center py-5 fw-900 opacity-25">Tracing communication signals...</div>
                        ) : historyLogs.length === 0 ? (
                            <div className="text-center py-5">
                                <i className="fa fa-terminal fa-3x text-secondary opacity-10 mb-4"></i>
                                <p className="text-secondary fw-700">No previous interactions recorded in the database.</p>
                            </div>
                        ) : (
                            <div className="px-3">
                                {historyLogs.map((log, idx) => (
                                    <div key={log.id} style={{
                                        position: 'relative', paddingLeft: '3rem', paddingBottom: '2.5rem',
                                        borderLeft: idx === historyLogs.length - 1 ? 'none' : '2px solid var(--crm-border)'
                                    }}>
                                        <div style={{
                                            position: 'absolute', left: '-11px', top: '0',
                                            width: '20px', height: '20px', borderRadius: '8px',
                                            background: 'white', border: '4px solid var(--crm-accent)',
                                            boxShadow: '0 0 15px var(--crm-accent-soft)'
                                        }}></div>
                                        <div className="p-4 rounded-30" style={{ background: 'rgba(0,0,0,0.02)', borderRadius: '25px', border: '1px solid var(--crm-border)' }}>
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <span className="badge badge-primary px-3 py-2 fw-900" style={{ fontSize: '0.65rem' }}>{log.status.toUpperCase()}</span>
                                                <small className="text-secondary fw-800">{new Date(log.created_at).toLocaleString()}</small>
                                            </div>
                                            <p className="m-0 fw-700 text-dark" style={{ fontSize: '1rem', lineHeight: '1.6' }}>"{log.remarks}"</p>
                                            <div className="mt-3 pt-3 border-top d-flex justify-content-between align-items-center">
                                                <small className="text-secondary fw-600">Captured by {log.user_detail?.full_name}</small>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Unified Outcome Capture Modal */}
            {showUpdateModal && (
                <div className="crm-modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(20px)',
                    zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="crm-modal-content" style={{
                        background: 'white', width: '550px', borderRadius: '40px',
                        padding: '3.5rem', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 40px 100px rgba(0,0,0,0.2)'
                    }}>
                        <div className="text-center mb-5">
                            <div className="entity-icon mx-auto" style={{ background: 'var(--crm-accent-soft)', color: 'var(--crm-accent)' }}>
                                <i className="fa fa-pencil-square-o"></i>
                            </div>
                            <h3 className="fw-900 text-primary mt-3">Finalize Outcome</h3>
                            <p className="text-secondary fw-700">Capture the intelligence from your conversation.</p>
                        </div>

                        <form onSubmit={handleUpdateSubmit}>
                            <div className="mb-4">
                                <label className="fw-900 text-secondary xsmall mb-3 d-block">CHANNELS STATUS</label>
                                <select 
                                    className="form-control"
                                    value={updateForm.status}
                                    onChange={(e) => setUpdateForm({...updateForm, status: e.target.value})}
                                    required
                                    style={{ borderRadius: '20px', padding: '1.2rem', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--crm-border)', fontWeight: 800, height: 'auto' }}
                                >
                                    {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="fw-900 text-secondary xsmall mb-3 d-block">CONVERSATION SUMMARY</label>
                                <textarea 
                                    className="form-control"
                                    placeholder="What were the key takeaways..."
                                    value={updateForm.remarks}
                                    onChange={(e) => setUpdateForm({...updateForm, remarks: e.target.value})}
                                    style={{ borderRadius: '20px', padding: '1.2rem', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--crm-border)', minHeight: '140px', fontWeight: 600, height: 'auto' }}
                                />
                            </div>
                            <div className="mb-5">
                                <label className="fw-900 text-secondary xsmall mb-3 d-block">NEXT PIPELINE TARGET (OPTIONAL)</label>
                                <input 
                                    type="datetime-local" 
                                    className="form-control"
                                    value={updateForm.target_time}
                                    onChange={(e) => setUpdateForm({...updateForm, target_time: e.target.value})}
                                    style={{ borderRadius: '20px', padding: '1.2rem', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--crm-border)', fontWeight: 800, height: 'auto' }}
                                />
                            </div>
                            <div className="d-flex gap-3">
                                <button type="submit" className="primary-flow-btn btn-ready w-100 py-4">SYNC TO PIPELINE</button>
                                <button type="button" className="btn btn-light px-4" style={{ borderRadius: '20px' }} onClick={() => setShowUpdateModal(false)}>CANCEL</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeleCallingInteraction;
