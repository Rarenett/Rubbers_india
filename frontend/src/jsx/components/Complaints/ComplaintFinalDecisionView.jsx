import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Row, Col, Form, Button, Badge, Card } from 'react-bootstrap';
import { ThemeContext } from "../../../context/ThemeContext";
import ComplaintService from '../../../services/ComplaintService';
import Swal from 'sweetalert2';
import './Complaints.css';

const ComplaintFinalDecisionView = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { background } = useContext(ThemeContext);
    const isDark = background.value === "dark";
    
    const [complaint, setComplaint] = useState(null);
    const [loading, setLoading] = useState(true);
    
    const [adminDecision, setAdminDecision] = useState('Pending');
    const [adminRemarks, setAdminRemarks] = useState('');
    const [selectedAction, setSelectedAction] = useState(null);
    const [cutoffDate, setCutoffDate] = useState('');
    const [savingCutoff, setSavingCutoff] = useState(false);
    const [savingDecision, setSavingDecision] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const userDetails = localStorage.getItem('userDetails');
        let userObj = null;
        if (userDetails) {
            const parsed = JSON.parse(userDetails);
            userObj = parsed.user;
            setCurrentUser(userObj);
        }
        
        fetchComplaint(userObj);
    }, [id]);

    const fetchComplaint = async (user = currentUser) => {
        try {
            const res = await ComplaintService.getComplaint(id, { is_review: 'true' });
            const complaintData = res.data;
            setComplaint(complaintData);
            setAdminDecision(complaintData.admin_decision || 'Pending');
            setAdminRemarks(complaintData.admin_remarks || '');
            setCutoffDate(complaintData.cutoff_date || '');
        } catch (err) {
            console.error("Error fetching complaint", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdminDecision = async () => {
        setSavingDecision(true);
        try {
            await ComplaintService.setAdminDecision(id, adminDecision, adminRemarks, { is_review: 'true' });
            Swal.fire({
                title: 'Success!',
                text: `Ticket #${id} marked as ${adminDecision}`,
                icon: 'success',
                confirmButtonColor: '#2ea1ceff'
            }).then(() => {
                fetchComplaint();
            });
        } catch (err) {
            Swal.fire('Error', 'Admin update failed', 'error');
        } finally {
            setSavingDecision(false);
        }
    };

    const handleCutoffDateUpdate = async (newDate) => {
        setCutoffDate(newDate);
        setSavingCutoff(true);
        try {
            await ComplaintService.updateComplaint(id, { cutoff_date: newDate }, { is_review: 'true' });
            Swal.fire({
                title: 'Updated!',
                text: `Cutoff date for Ticket #${id} updated successfully.`,
                icon: 'success',
                confirmButtonColor: '#2ece8a',
                timer: 1500,
                showConfirmButton: false
            });
            fetchComplaint();
        } catch (err) {
            Swal.fire('Error', 'Failed to update cutoff date', 'error');
        } finally {
            setSavingCutoff(false);
        }
    };

    const formatDateDDMMYY = (dateStr) => {
        const d = new Date(dateStr);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        return `${dd}/${mm}/${yy}`;
    };

    if (loading) return <div className="p-5 text-center">Loading...</div>;
    if (!complaint) return <div className="p-5 text-center text-danger">Complaint not found</div>;

    // Check if the user is the creator. Creators shouldn't see the admin decision form.
    const isCreator = currentUser?.id === complaint.user;

    // Filter actions to only show the latest decision per responder
    let uniqueActions = [];
    if (complaint && complaint.actions) {
        const latestActionMap = new Map();
        complaint.actions.forEach(action => {
            const userId = action.created_by || (action.created_by_details && action.created_by_details.id) || (action.created_by_details && action.created_by_details.email);
            latestActionMap.set(userId, action);
        });
        uniqueActions = Array.from(latestActionMap.values());
    }

    return (
        <>
            <style>{`
                .sof-card {
                    border: 1px solid #cbd5e1 !important;
                    transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
                }
                .sof-card:hover {
                    border-color: #6d4aff !important;
                    box-shadow: 0 16px 36px -12px rgba(109, 74, 255, 0.25) !important;
                    transform: translateY(-3px);
                }
            `}</style>

            <Row>
                <Col lg={8} className="mb-4">
                    <div className="sof-section sof-card h-100" style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)' }}>
                        <div className="d-flex justify-content-between align-items-center mb-3 pb-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <div className="d-flex align-items-center">
                                <button onClick={() => navigate('/complaints/list')} className="btn btn-light d-flex align-items-center justify-content-center p-0 rounded-circle me-3" style={{ width: '28px', height: '28px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', minWidth: '28px' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="bi bi-arrow-left" viewBox="0 0 16 16"><path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/></svg>
                                </button>
                                <div style={{width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #f5ebd9, #e6d5c3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5a2b', marginRight: '10px'}}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '16px', height: '16px'}}>
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="8" x2="12" y2="12"></line>
                                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                    </svg>
                                </div>
                                <h5 className="m-0 fw-bold" style={{color: '#1e293b', fontSize: '1rem', letterSpacing: '-0.3px'}}>Complaint Overview</h5>
                            </div>
                            <div style={{
                                padding: '6px 16px',
                                borderRadius: '50px',
                                fontSize: '0.85rem',
                                fontWeight: '800',
                                letterSpacing: '0.5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: '#ffffff',
                                color: complaint.status.toLowerCase() === 'in progress' ? '#8b5a2b' : 
                                       complaint.status.toLowerCase() === 'closed' || complaint.status.toLowerCase() === 'resolved' ? '#4f46e5' : 
                                       '#d97706',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                cursor: 'default',
                                userSelect: 'none'
                            }}>
                                <span style={{
                                    display: 'block',
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: complaint.status.toLowerCase() === 'in progress' ? '#8b5a2b' : 
                                                     complaint.status.toLowerCase() === 'closed' || complaint.status.toLowerCase() === 'resolved' ? '#6366f1' : 
                                                     '#f59e0b',
                                    boxShadow: `0 0 8px ${complaint.status.toLowerCase() === 'in progress' ? 'rgba(139, 90, 43, 0.6)' : 
                                                        complaint.status.toLowerCase() === 'closed' || complaint.status.toLowerCase() === 'resolved' ? 'rgba(99, 102, 241, 0.6)' : 
                                                        'rgba(245, 158, 11, 0.6)'}`,
                                    animation: 'sof-pulse 2s infinite'
                                }}></span>
                                {complaint.status.toUpperCase()}
                            </div>
                        </div>

                        <div className="mb-4 mt-3">
                            <h4 className="fw-bold mb-3" style={{color: '#1e293b', fontSize: '1.25rem'}}>{complaint.title}</h4>
                            <div className="d-flex flex-wrap gap-4 p-3 rounded" style={{background: '#f8fafc', border: '1px solid #e2e8f0'}}>
                                <div style={{minWidth: '150px'}}>
                                    <div style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px'}}>Reported By</div>
                                    <div style={{color: '#334155', fontWeight: '600'}}>{`${complaint.user_details?.first_name || ''} ${complaint.user_details?.last_name || ''}`.trim() || 'N/A'}</div>
                                </div>
                                <div style={{minWidth: '150px'}}>
                                    <div style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px'}}>Complaint ID</div>
                                    <div style={{color: '#475569', fontWeight: '600'}}>CMP-{complaint.id}</div>
                                </div>
                                <div style={{minWidth: '150px'}}>
                                    <div style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px'}}>Category</div>
                                    <div style={{color: '#334155', fontWeight: '600'}}>{complaint.category_name}</div>
                                </div>
                                <div style={{minWidth: '150px'}}>
                                    <div style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px'}}>Priority Level</div>
                                    <div style={{fontWeight: '700', color: complaint.priority === 'Critical' ? '#ef4444' : complaint.priority === 'High' ? '#f59e0b' : '#334155'}}>{complaint.priority}</div>
                                </div>
                                <div style={{minWidth: '150px'}}>
                                    <div style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px'}}>Routing Pattern</div>
                                    <div style={{color: '#334155', fontWeight: '600'}}>{complaint.pattern_name || 'Standard Routing'}</div>
                                </div>
                                <div style={{minWidth: '150px'}}>
                                    <div style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px'}}>Date Filed</div>
                                    <div style={{color: '#334155', fontWeight: '600'}}>{formatDateDDMMYY(complaint.created_at)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="mb-4">
                            <div style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px'}}>Problem Description</div>
                            <div style={{background: '#f1f5f9', padding: '16px', borderRadius: '8px', fontSize: '0.9rem', color: '#334155', lineHeight: '1.6'}}>
                                {complaint.description}
                                {complaint.attachment && (
                                    <div className="mt-3">
                                        <a href={complaint.attachment} target="_blank" rel="noopener noreferrer" className="text-primary fw-bold text-decoration-none d-flex align-items-center" style={{fontSize: '0.85rem'}}>
                                            <i className="fa fa-paperclip me-1"></i> View Attached Evidence
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-4 border-top">

                        {!isCreator && uniqueActions && uniqueActions.length > 0 && (
                            <div className="mb-4">
                                <div className="d-flex flex-wrap align-items-center mb-3 gap-3">
                                    <h5 className="mb-0">Resolution History</h5>
                                    <div className="d-flex gap-3 ms-auto align-items-center">
                                        <div className="d-flex align-items-center gap-1">
                                            <span className="prio-badge" style={{background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.65rem', padding: '0.3rem 0.6rem'}}>YES</span>
                                            <span className="fw-bold" style={{fontSize: '0.75rem', color: '#10b981'}}>{Math.round((uniqueActions.filter(a => a.decision === 'YES').length / uniqueActions.length) * 100)}%</span>
                                        </div>
                                        <div className="d-flex align-items-center gap-1">
                                            <span className="prio-badge" style={{background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.65rem', padding: '0.3rem 0.6rem'}}>NO</span>
                                            <span className="fw-bold" style={{fontSize: '0.75rem', color: '#ef4444'}}>{Math.round((uniqueActions.filter(a => a.decision === 'NO').length / uniqueActions.length) * 100)}%</span>
                                        </div>
                                        <div className="d-flex align-items-center gap-1">
                                            <span className="prio-badge" style={{background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '0.65rem', padding: '0.3rem 0.6rem'}}>NEUTRAL</span>
                                            <span className="fw-bold" style={{fontSize: '0.75rem', color: '#3b82f6'}}>{Math.round((uniqueActions.filter(a => a.decision !== 'YES' && a.decision !== 'NO').length / uniqueActions.length) * 100)}%</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="table-responsive">
                                    <table className="table table-sm table-hover align-middle mb-0" style={{fontSize: '0.82rem'}}>
                                        <thead>
                                            <tr>
                                                <th className="py-2 border-0">Date</th>
                                                <th className="py-2 border-0">Responder</th>
                                                <th className="py-2 border-0">Decision</th>
                                                <th className="py-2 border-0">Remarks</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {uniqueActions.map(action => (
                                                <tr 
                                                    key={action.id} 
                                                    onClick={() => setSelectedAction(action)}
                                                    style={{ 
                                                        cursor: 'pointer', 
                                                        backgroundColor: selectedAction?.id === action.id ? '#e0f2fe' : 'transparent',
                                                        transition: 'background 0.2s ease'
                                                    }}
                                                    className={selectedAction?.id === action.id ? 'fw-bold' : ''}
                                                >
                                                    <td className="py-2 border-0">{new Date(action.created_at).toLocaleDateString()}</td>
                                                    <td className="py-2 border-0">{action.created_by_details.first_name || action.created_by_details.email}</td>
                                                    <td className="py-2 border-0">
                                                        {action.decision === 'YES' ? (
                                                            <span className="prio-badge" style={{background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.65rem', padding: '0.3rem 0.6rem'}}>{action.decision}</span>
                                                        ) : action.decision === 'NO' ? (
                                                            <span className="prio-badge" style={{background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.65rem', padding: '0.3rem 0.6rem'}}>{action.decision}</span>
                                                        ) : (
                                                            <span className="prio-badge" style={{background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '0.65rem', padding: '0.3rem 0.6rem'}}>{action.decision}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 border-0 text-truncate" style={{maxWidth: '180px'}}>{action.notes || '—'}</td>
                                                </tr>
                                            ))}
                                            <tr 
                                                onClick={() => setSelectedAction(null)}
                                                style={{ 
                                                    cursor: 'pointer', 
                                                    backgroundColor: !selectedAction ? '#f1f5f9' : 'transparent',
                                                    borderTop: '2px solid #e2e8f0'
                                                }}
                                            >
                                                <td colSpan="4" className="py-2 text-center text-muted small">
                                                    <em>View Complaint Default Resolution</em>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {!isCreator && (selectedAction || complaint.decision_type) && (
                            <div className="pt-4 border-top">
                                <h5 className="mb-3">
                                    {selectedAction ? `Selected Resolution Details: ${selectedAction.created_by_details.first_name}` : 'Final Resolution Analysis'}
                                </h5>
                                <div className="cm-doc-feedback-split mb-3">
                                    <div className="cm-doc-feedback-card positive p-3">
                                        <label className="text-success fw-bold x-small text-uppercase mb-1 d-block" style={{fontSize: '0.65rem'}}>Positive Factors</label>
                                        <p className="m-0 small" style={{ lineHeight: '1.5' }}>
                                            {selectedAction ? selectedAction.positive_feedback : complaint.positive_feedback || 'N/A'}
                                        </p>
                                    </div>
                                    <div className="cm-doc-feedback-card negative p-3">
                                        <label className="text-danger fw-bold x-small text-uppercase mb-1 d-block" style={{fontSize: '0.65rem'}}>Critical Issues</label>
                                        <p className="m-0 small" style={{ lineHeight: '1.5' }}>
                                            {selectedAction ? selectedAction.negative_feedback : complaint.negative_feedback || 'N/A'}
                                        </p>
                                    </div>
                                </div>
                                <Row className="mb-3">
                                    <Col md={6}>
                                        <label className="fw-bold">Result / Decision</label>
                                        <div className="value fw-bold" style={{
                                            color: (selectedAction ? selectedAction.decision : complaint.decision_type) === 'YES' || (selectedAction ? selectedAction.decision : complaint.decision_type) === 'Yes' ? '#10b981' : 
                                                   (selectedAction ? selectedAction.decision : complaint.decision_type) === 'NO' || (selectedAction ? selectedAction.decision : complaint.decision_type) === 'No' ? '#ef4444' : 'var(--cm-text-primary)'
                                        }}>
                                            {(selectedAction ? selectedAction.decision : complaint.decision_type)?.toUpperCase()}
                                        </div>
                                    </Col>
                                    {(selectedAction?.supporting_document || complaint.responder_attachment) && (
                                        <Col md={6}>
                                            <label className="fw-bold">Full Report</label>
                                            <div>
                                                <a href={selectedAction ? selectedAction.supporting_document : complaint.responder_attachment} target="_blank" rel="noopener noreferrer" className="small text-primary fw-bold">
                                                    Download PDF Ref #{selectedAction ? selectedAction.id : 'FINAL'}
                                                </a>
                                            </div>
                                        </Col>
                                    )}
                                </Row>
                                <div className="mb-3">
                                    <label className="fw-bold">Remarks / Notes</label>
                                    <p className="text-muted mb-0">
                                        {selectedAction ? selectedAction.notes : complaint.responder_remarks}
                                    </p>
                                </div>
                            </div>
                        )}
                        </div>
                    </div>
                </Col>

                <Col lg={4} className="mb-4">
                    <div className="d-flex flex-column h-100">
                        <div className="sof-section sof-card mb-4" style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)' }}>
                            <h6 className="text-muted small text-uppercase fw-bold mb-3 text-center" style={{letterSpacing: '0.5px'}}>Current Status</h6>
                            <div className="text-center">
                                <span className={`badge badge-${complaint.status === 'Completed' || complaint.status === 'Resolved' ? 'success' : complaint.status === 'Rejected' ? 'danger' : 'warning'} light`} style={{padding: '8px 16px', fontSize: '0.85rem', letterSpacing: '0.5px'}}>
                                    {complaint.status.toUpperCase()}
                                </span>
                            </div>
                        </div>

                        {/* Cutoff Date Section */}
                        {!isCreator && (
                            <div className="sof-section sof-card mb-4" style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)' }}>
                                <div className="d-flex align-items-center mb-3">
                                    <i className="fa fa-calendar me-2" style={{color: '#64748b', fontSize: '1.1rem'}}></i>
                                    <h6 className="fw-bold mb-0" style={{color: '#1e293b', fontSize: '1rem'}}>Cutoff / Expiry Date</h6>
                                </div>
                                <p className="small text-muted mb-3" style={{lineHeight: '1.4'}}>Extend or update the resolution deadline for this ticket.</p>
                                <input
                                    type="date"
                                    value={cutoffDate || ''}
                                    disabled={savingCutoff}
                                    min={new Date().toISOString().split('T')[0]}
                                    onChange={(e) => handleCutoffDateUpdate(e.target.value)}
                                    className="form-control"
                                    style={{ fontSize: '0.9rem', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}
                                />
                            </div>
                        )}

                        {/* Admin Decision Section */}
                        {!isCreator && (
                            <div className="sof-section sof-card mb-4 flex-grow-1" style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)' }}>
                                <div className="d-flex align-items-center mb-3">
                                    <div style={{width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(109, 74, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6d4aff', marginRight: '10px'}}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M5.338 1.59a61.44 61.44 0 0 0-2.837.856.481.481 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.725 10.725 0 0 0 2.287 2.233c.346.244.652.42.893.533.12.057.218.095.293.118a.55.55 0 0 0 .101.025.615.615 0 0 0 .1-.025c.076-.023.174-.061.294-.118.24-.113.547-.29.893-.533a10.726 10.726 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.775 11.775 0 0 1-2.517 2.453 7.159 7.159 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7.158 7.158 0 0 1-1.048-.625 11.777 11.777 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 62.456 62.456 0 0 1 5.072.56z"/>
                                            <path d="M10.854 5.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 7.793l2.646-2.647a.5.5 0 0 1 .708 0z"/>
                                        </svg>
                                    </div>
                                    <h6 className="fw-bold mb-0" style={{color: '#1e293b', fontSize: '1rem'}}>Administrative Decision</h6>
                                </div>
                                <p className="small text-muted mb-3" style={{lineHeight: '1.4'}}>Set the final status based on the resolution breakdown below.</p>
                                <select 
                                    value={adminDecision} 
                                    onChange={(e) => setAdminDecision(e.target.value)}
                                    className="form-control form-select mb-3"
                                    disabled={complaint.admin_decision === 'Approved' || complaint.admin_decision === 'Rejected'}
                                    style={{ fontSize: '0.9rem', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', appearance: 'auto' }}
                                >
                                    <option value="Pending">Pending</option>
                                    <option value="Approved">Approved</option>
                                    <option value="Rejected">Rejected</option>
                                    <option value="On Hold">On Hold</option>
                                </select>
                                <textarea
                                    rows={3}
                                    placeholder="Add administrative remarks or notes here..."
                                    value={adminRemarks}
                                    onChange={(e) => setAdminRemarks(e.target.value)}
                                    className="form-control mb-3"
                                    disabled={complaint.admin_decision === 'Approved' || complaint.admin_decision === 'Rejected'}
                                    style={{ fontSize: '0.9rem', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', resize: 'none' }}
                                ></textarea>
                                <button 
                                    className="btn w-100 fw-bold py-2 mt-1" 
                                    onClick={handleAdminDecision}
                                    disabled={savingDecision || complaint.admin_decision === 'Approved' || complaint.admin_decision === 'Rejected'}
                                    style={{ 
                                        background: (savingDecision || complaint.admin_decision === 'Approved' || complaint.admin_decision === 'Rejected') ? '#e2e8f0' : 'linear-gradient(135deg, #1a0344ff 0%, #3a2977ff 100%)', 
                                        color: (savingDecision || complaint.admin_decision === 'Approved' || complaint.admin_decision === 'Rejected') ? '#94a3b8' : '#ffffff', 
                                        border: (savingDecision || complaint.admin_decision === 'Approved' || complaint.admin_decision === 'Rejected') ? '1px solid #cbd5e1' : '1px solid #6d4aff', 
                                        borderRadius: '8px', 
                                        boxShadow: (savingDecision || complaint.admin_decision === 'Approved' || complaint.admin_decision === 'Rejected') ? 'none' : '0 4px 12px -4px rgba(58,41,119,0.6)', 
                                        transition: 'all 0.3s ease',
                                        letterSpacing: '0.5px',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    {(complaint.admin_decision === 'Approved' || complaint.admin_decision === 'Rejected') ? 'Decision Locked' : savingDecision ? 'Saving...' : 'Save Decision'}
                                </button>
                            </div>
                        )}  

                        <div className="mt-4 text-center text-muted" style={{fontSize: '0.7rem'}}>
                            Form Generated by Rarenett ERP © 2026
                        </div>
                    </div>
                </Col>
            </Row>
        </>
    );
};

export default ComplaintFinalDecisionView;