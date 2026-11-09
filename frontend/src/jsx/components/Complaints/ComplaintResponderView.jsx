import React, { Fragment, useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Row, Col, Form, Button, Badge } from 'react-bootstrap';
import { ThemeContext } from "../../../context/ThemeContext";
import ComplaintService from '../../../services/ComplaintService';
import Swal from 'sweetalert2';
import '../Inventory/WarehouseTransferForm.css';

const ComplaintResponderView = () => {
    const { id } = useParams(); 
    const navigate = useNavigate();
    const { background } = useContext(ThemeContext);
    const isDark = background.value === "dark";
    
    const [complaint, setComplaint] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Decision Form State
    const [decisionData, setDecisionData] = useState({
        positive_feedback: '',
        negative_feedback: '',
        decision_type: 'Neutral',
        responder_remarks: ''
    });
    const [responderFile, setResponderFile] = useState(null);
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

    const prefillDecision = (user, complaintData) => {
        if (user && complaintData.actions) {
            const userAction = complaintData.actions.find(a => a.created_by === user.id);
            if (userAction) {
                setDecisionData({
                    positive_feedback: userAction.positive_feedback || '',
                    negative_feedback: userAction.negative_feedback || '',
                    decision_type: userAction.decision === 'YES' ? 'Yes' : userAction.decision === 'NO' ? 'No' : 'Neutral',
                    responder_remarks: userAction.notes || ''
                });
            } else {
                setDecisionData({
                    positive_feedback: '',
                    negative_feedback: '',
                    decision_type: 'Neutral',
                    responder_remarks: ''
                });
            }
        }
    };

    const fetchComplaint = async (user = currentUser) => {
        try {
            const res = await ComplaintService.getComplaint(id);
            const complaintData = res.data;
            setComplaint(complaintData);
            prefillDecision(user, complaintData);
        } catch (err) {
            console.error("Error fetching complaint", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitDecision = async (e) => {
        e.preventDefault();
        const data = new FormData();
        data.append('positive_feedback', decisionData.positive_feedback);
        data.append('negative_feedback', decisionData.negative_feedback);
        data.append('decision_type', decisionData.decision_type);
        data.append('responder_remarks', decisionData.responder_remarks);
        if (responderFile) data.append('responder_attachment', responderFile);

        try {
            await ComplaintService.submitDecision(id, data);
            Swal.fire({
                title: 'Success!',
                text: 'Decision submitted successfully!',
                icon: 'success',
                confirmButtonColor: '#6366f1'
            }).then(() => {
                navigate('/complaints/list');
            });
        } catch (err) {
            Swal.fire('Error', 'Error submitting decision', 'error');
        }
    };
    const formatDateDDMMYY = (dateStr) => {
        const d = new Date(dateStr);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        return `${dd}/${mm}/${yy}`;
    };
    if (loading) return <div className="p-5 text-center" style={{color: '#64748b'}}>Loading...</div>;
    if (!complaint) return <div className="p-5 text-center text-danger">Complaint not found</div>;

    const isPastCutoff = complaint.cutoff_date ? new Date(new Date().setHours(0,0,0,0)) > new Date(new Date(complaint.cutoff_date).setHours(0,0,0,0)) : false;
    const isFinalized = complaint.status === 'Closed' || (complaint.admin_decision && complaint.admin_decision !== 'Pending');
    const isBlocked = isPastCutoff || isFinalized;

    return (
        <Fragment>
            <div className="container-fluid pt-0">
                <div className="mb-4 d-flex justify-content-between align-items-center">
                    {/* <Button variant="link" onClick={() => navigate(-1)} className="p-0 text-decoration-none fw-bold d-flex align-items-center" style={{color: '#64748b', fontSize: '0.9rem'}}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-chevron-left me-1" viewBox="0 0 16 16"><path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/></svg>
                        Back to Directory
                    </Button>
                    <div className="d-flex gap-2">
                        <Button variant="light" size="sm" onClick={() => fetchComplaint()} className="rounded px-3 border shadow-sm fw-bold" style={{color: '#475569', fontSize: '0.85rem'}}>
                            Refresh Status
                        </Button>
                    </div> */}
                </div>

                <div className="sof-wrap">


                <Row>
                    <Col lg={8} className="mb-4">
                        <div className="sof-section border-0 h-100" style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)' }}>
                            <div className="d-flex justify-content-between align-items-center mb-3 pb-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <div className="d-flex align-items-center">
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
                                           complaint.status.toLowerCase() === 'closed' ? '#4f46e5' : 
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
                                                         complaint.status.toLowerCase() === 'closed' ? '#6366f1' : 
                                                         '#f59e0b',
                                        boxShadow: `0 0 8px ${complaint.status.toLowerCase() === 'in progress' ? 'rgba(139, 90, 43, 0.6)' : 
                                                            complaint.status.toLowerCase() === 'closed' ? 'rgba(99, 102, 241, 0.6)' : 
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
                                        <div style={{color: '#334155', fontWeight: '600'}}>{`${complaint.user_details?.first_name || ''} ${complaint.user_details?.last_name || ''}`}</div>
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
                                        <div style={{fontWeight: '700', color: complaint.priority === 'CRITICAL' ? '#ef4444' : complaint.priority === 'HIGH' ? '#f59e0b' : '#334155'}}>{complaint.priority}</div>
                                    </div>
                                    <div style={{minWidth: '150px'}}>
                                        <div style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px'}}>Routing Pattern</div>
                                        <div style={{color: '#334155', fontWeight: '600'}}>{complaint.pattern_name || 'Standard Routing'}</div>
                                    </div>
                                    <div style={{minWidth: '150px'}}>
                                        <div style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px'}}>Date Filed</div>
                                        <div style={{color: '#334155', fontWeight: '600'}}>{formatDateDDMMYY(complaint.created_at)}</div>
                                    </div>
                                    {complaint.evaluator_name && complaint.evaluator_name !== '—' && (
                                        <div style={{minWidth: '150px'}}>
                                            <div style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px'}}>Final Evaluator</div>
                                            <div style={{color: '#334155', fontWeight: '600'}}>{complaint.evaluator_name}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="mb-3">
                                <div style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px'}}>Problem Description</div>
                                <div className="p-3 rounded" style={{backgroundColor: '#f1f5f9', borderLeft: '4px solid #94a3b8', color: '#334155', fontSize: '0.95rem', lineHeight: '1.6'}}>
                                    {complaint.description}
                                </div>
                            </div>

                            {complaint.attachment && (
                                <div className="mt-3">
                                    <a href={complaint.attachment} target="_blank" rel="noopener noreferrer" className="sof-add-row-btn text-decoration-none d-inline-flex">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="bi bi-paperclip me-1" viewBox="0 0 16 16"><path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0z"/></svg>
                                        View Attached Evidence
                                    </a>
                                </div>
                            )}
                        </div>
                    </Col>

                    <Col lg={4} className="mb-4">
                        {complaint.can_respond && (
                            <div className="sof-section border-0 h-100" style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)' }}>
                                <div className="d-flex justify-content-between align-items-center mb-3 pb-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <div className="d-flex align-items-center">
                                        <div style={{width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #f5ebd9, #e6d5c3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5a2b', marginRight: '10px'}}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width: '16px', height: '16px'}}>
                                                <path d="M12 20h9"></path>
                                                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                            </svg>
                                        </div>
                                        <h5 className="m-0 fw-bold" style={{color: '#1e293b', fontSize: '1rem', letterSpacing: '-0.3px'}}>Resolution Report</h5>
                                    </div>
                                    <Button variant="light" size="sm" onClick={() => navigate('/complaints/list')} className="d-flex align-items-center justify-content-center p-0 rounded-circle" style={{ width: '28px', height: '28px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="bi bi-arrow-left" viewBox="0 0 16 16"><path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/></svg>
                                    </Button>
                                </div>
                                
                                <Form onSubmit={handleSubmitDecision}>
                                    <div className="sof-field-group mb-3">
                                        <label className="sof-label mb-1" style={{fontSize: '0.7rem'}}>Positive Analysis</label>
                                        <textarea className="sof-input w-100" rows={3} value={decisionData.positive_feedback} onChange={e => setDecisionData({...decisionData, positive_feedback: e.target.value})} disabled={isBlocked} placeholder="Detail the positive findings..." style={{borderRadius: '8px', padding: '8px 12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', color: '#334155'}}></textarea>
                                    </div>
                                    
                                    <div className="sof-field-group mb-3">
                                        <label className="sof-label mb-1" style={{fontSize: '0.7rem'}}>Negative Analysis</label>
                                        <textarea className="sof-input w-100" rows={3} value={decisionData.negative_feedback} onChange={e => setDecisionData({...decisionData, negative_feedback: e.target.value})} disabled={isBlocked} placeholder="Detail the negative findings..." style={{borderRadius: '8px', padding: '8px 12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', color: '#334155'}}></textarea>
                                    </div>

                                    <div className="sof-field-group mb-3">
                                        <label className="sof-label mb-1" style={{fontSize: '0.7rem'}}>Decision</label>
                                        <div className="d-flex gap-1 p-1" style={{background: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                                            {['Yes', 'No', 'Neutral'].map(d => (
                                                <div 
                                                    key={d}
                                                    onClick={() => !isBlocked && setDecisionData({...decisionData, decision_type: d})}
                                                    style={{
                                                        flex: 1,
                                                        textAlign: 'center',
                                                        padding: '6px 0',
                                                        borderRadius: '6px',
                                                        cursor: isBlocked ? 'not-allowed' : 'pointer',
                                                        fontSize: '0.85rem',
                                                        fontWeight: decisionData.decision_type === d ? '700' : '600',
                                                        color: decisionData.decision_type === d ? (d==='Yes'?'#16a34a':d==='No'?'#dc2626':'#8b5a2b') : '#64748b',
                                                        background: decisionData.decision_type === d ? '#ffffff' : 'transparent',
                                                        boxShadow: decisionData.decision_type === d ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                                                        transition: 'all 0.2s ease',
                                                        border: decisionData.decision_type === d ? '1px solid #e2e8f0' : '1px solid transparent'
                                                    }}
                                                >
                                                    {d}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="sof-field-group mb-3">
                                        <label className="sof-label mb-1" style={{fontSize: '0.7rem'}}>Report / Attachment</label>
                                        <div className="position-relative d-flex align-items-center" style={{
                                            border: '1.5px dashed #cbd5e1', 
                                            borderRadius: '8px', 
                                            padding: '10px 16px', 
                                            background: '#f8fafc', 
                                            transition: 'all 0.2s',
                                            cursor: isBlocked ? 'not-allowed' : 'pointer'
                                        }} onMouseOver={e => e.currentTarget.style.borderColor = '#94a3b8'} onMouseOut={e => e.currentTarget.style.borderColor = '#cbd5e1'}>
                                            <input type="file" onChange={e => setResponderFile(e.target.files[0])} disabled={isBlocked} style={{
                                                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: isBlocked ? 'not-allowed' : 'pointer'
                                            }} />
                                            <div className="d-flex align-items-center pointer-events-none w-100" style={{ overflow: 'hidden' }}>
                                                <div style={{width: '28px', height: '28px', borderRadius: '6px', background: responderFile ? '#dcfce3' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px', flexShrink: 0}}>
                                                    {responderFile ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                                    )}
                                                </div>
                                                <span style={{fontSize: '0.85rem', color: responderFile ? '#16a34a' : '#475569', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                                    {responderFile ? responderFile.name : 'Click to upload file'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="sof-field-group mb-3">
                                        <label className="sof-label mb-1" style={{fontSize: '0.7rem'}}>Remarks</label>
                                        <textarea className="sof-input w-100" rows={1} value={decisionData.responder_remarks} onChange={e => setDecisionData({...decisionData, responder_remarks: e.target.value})} disabled={isBlocked} placeholder="Any additional remarks..." style={{borderRadius: '8px', padding: '8px 12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.85rem', color: '#334155'}}></textarea>
                                    </div>

                                    <Button type="submit" className="w-100 fw-bold py-2 mt-1" style={{ 
                                        background: isBlocked ? '#e2e8f0' : 'linear-gradient(135deg, #1a0344ff 0%, #3a2977ff 100%)', 
                                        color: isBlocked ? '#94a3b8' : '#ffffff', 
                                        border: 'none', 
                                        borderRadius: '8px', 
                                        boxShadow: isBlocked ? 'none' : '0 4px 12px -4px rgba(58,41,119,0.6)', 
                                        transition: 'all 0.3s ease',
                                        letterSpacing: '0.5px',
                                        fontSize: '0.9rem'
                                    }} disabled={isBlocked}>
                                        {isBlocked ? 'SUBMISSION BLOCKED' : 'SUBMIT RESOLUTION'}
                                    </Button>
                                </Form>
                            </div>
                        )}

                        <div className="mt-4 text-center" style={{fontSize: '0.7rem', fontWeight: 'bold', color: '#94a3b8'}}>
                            Form Generated by Rarenett ERP © 2026
                        </div>
                    </Col>
                </Row>
                </div>
            </div>
        </Fragment>
    );
};

export default ComplaintResponderView;

