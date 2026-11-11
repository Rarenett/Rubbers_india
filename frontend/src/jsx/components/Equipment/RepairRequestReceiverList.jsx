import React, { useState, useEffect, Fragment } from 'react';
import { Card, Table, Button, Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { useSelector } from 'react-redux';
import {
    getReceivedRepairRequests,
    submitRepairRequestDecision
} from '../../../services/MachineManagementService';

import { usePageTitle } from '../../../context/TitleContext';

const isRequestInactive = (item) => {
    if (!item) return false;
    if (item.status === 'Accepted' || item.status === 'Rejected' || item.status === 'Hold') return true;
    if (!item.duedate) return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(item.duedate);
    return due < today;
};

const RepairRequestReceiverList = () => {
    const [repairRequests, setRepairRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [activeTab, setActiveTab] = useState('pending');
    const itemsPerPage = 10;

    // Logged in user details
    const currentUser = useSelector(state => state.auth?.auth?.user);
    const userName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.username : 'Receiver';

    // Image Lightbox Gallery Modal State
    const [showGallery, setShowGallery] = useState(false);
    const [galleryImages, setGalleryImages] = useState([]);
    const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);

    const [submitting, setSubmitting] = useState(false);

    // Detailed View & Decision/Feedback Modal state
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewingRequest, setViewingRequest] = useState(null);
    const [posFeedback, setPosFeedback] = useState('');
    const [negFeedback, setNegFeedback] = useState('');
    const [decision, setDecision] = useState('YES');
    const [decisionNotes, setDecisionNotes] = useState('');
    const [supportingDoc, setSupportingDoc] = useState(null);

    usePageTitle("Repair Request Receivered");

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getReceivedRepairRequests();
            setRepairRequests(data);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch received repair requests' });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenGallery = (images) => {
        setGalleryImages(images);
        setActiveGalleryIndex(0);
        setShowGallery(true);
    };

    const handleOpenViewModal = (request) => {
        setViewingRequest(request);
        
        let userFeedback = null;
        if (request.feedbacks && currentUser) {
            userFeedback = request.feedbacks.find(f => f.user === currentUser.id);
        }

        if (userFeedback) {
            setPosFeedback(userFeedback.positive_feedback || '');
            setNegFeedback(userFeedback.negative_feedback || '');
            setDecision(userFeedback.decision || '');
            setDecisionNotes(userFeedback.decision_notes || '');
        } else {
            setPosFeedback('');
            setNegFeedback('');
            setDecision('');
            setDecisionNotes('');
        }
        
        setSupportingDoc(null);
        setShowViewModal(true);
    };

    const handleDecisionSubmit = async (e) => {
        e.preventDefault();
        if (!viewingRequest) return;

        try {
            setSubmitting(true);
            
            // Map decision directly to target status
            let targetStatus = 'Pending';
            if (decision === 'YES') {
                targetStatus = 'Accepted';
            } else if (decision === 'NO') {
                targetStatus = 'Rejected';
            } else if (decision === 'NEUTRAL') {
                targetStatus = 'Hold';
            }

            const formData = new FormData();
            formData.append('status', targetStatus);
            formData.append('decision', decision);
            formData.append('positive_feedback', posFeedback);
            formData.append('negative_feedback', negFeedback);
            formData.append('decision_notes', decisionNotes);
            if (supportingDoc) {
                formData.append('supporting_document', supportingDoc);
            }

            await submitRepairRequestDecision(viewingRequest.id, formData);
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Decision and feedback submitted successfully',
                timer: 2000,
                showConfirmButton: false
            });
            setShowViewModal(false);
            fetchData();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to submit decision' });
        } finally {
            setSubmitting(false);
        }
    };

    const getPriorityWeight = (priority) => {
        if (!priority) return 1;
        const p = priority.toLowerCase();
        if (p === 'high') return 3;
        if (p === 'medium') return 2;
        return 1; // 'low' or default
    };

    // Filter and Sort
    const sortedRequests = [...repairRequests].sort((a, b) => {
        const weightA = getPriorityWeight(a.priority);
        const weightB = getPriorityWeight(b.priority);
        if (weightB !== weightA) {
            return weightB - weightA;
        }
        const dateA = a.duedate ? new Date(a.duedate) : new Date('9999-12-31');
        const dateB = b.duedate ? new Date(b.duedate) : new Date('9999-12-31');
        return dateA - dateB;
    });

    const filteredItems = sortedRequests.filter(req => {
        const pDetails = (req.part_details || '').toLowerCase();
        const createdByName = (req.created_by_name || '').toLowerCase();
        const notes = (req.notes || '').toLowerCase();
        return pDetails.includes(searchTerm.toLowerCase()) || 
               createdByName.includes(searchTerm.toLowerCase()) ||
               notes.includes(searchTerm.toLowerCase());
    });

    const hasUserVoted = (req) => {
        if (!req || !req.feedbacks || !currentUser) return false;
        return req.feedbacks.some(f => f.user === currentUser.id);
    };

    const isRequestResolved = (req) => {
        return ['Accepted', 'Rejected', 'Hold'].includes(req?.status);
    };

    // Split into four categories based on user's action and global status
    const pendingItems = filteredItems.filter(req => !isRequestInactive(req) && !hasUserVoted(req));
    const votedItems = filteredItems.filter(req => hasUserVoted(req) && !isRequestResolved(req));
    const notVotedItems = filteredItems.filter(req => isRequestInactive(req) && !hasUserVoted(req));
    const completedItems = filteredItems.filter(req => hasUserVoted(req) && isRequestResolved(req));
    
    let tabItems = pendingItems;
    if (activeTab === 'voted') tabItems = votedItems;
    if (activeTab === 'not_voted') tabItems = notVotedItems;
    if (activeTab === 'completed') tabItems = completedItems;

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = tabItems.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(tabItems.length / itemsPerPage);

    const isFieldsDisabled = viewingRequest && (isRequestInactive(viewingRequest) || hasUserVoted(viewingRequest));

    return (
        <Fragment>
            {/* <div className="page-titles">
                <button 
                    onClick={() => window.history.back()} 
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div> */}
            <style>{`
                .sgfm-modal .modal-content {
                    border: none;
                    border-radius: 16px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                    overflow: hidden;
                }
                .sgfm-modal .modal-header-custom {
                    background-color: #fff;
                    padding: 24px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .sgfm-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                }
                .sgfm-modal .modal-close-x {
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    color: #aaa;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                }
                .sgfm-modal .modal-close-x:hover { color: #555; }
                .sgfm-modal .modal-body-custom { padding: 24px 28px; }
                .sgfm-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .btn-action-custom {
                    border: none;
                    border-radius: 10px;
                    padding: 12px 24px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-close-custom {
                    background-color: #f1f5f9;
                    color: #475569;
                }
                .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .btn-save-custom {
                    color: #fff;
                }
                .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    transition: all 0.2s;
                    width: 100%;
                }
                .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .form-label-custom {
                    font-size: 14px;
                    font-weight: 600;
                    color: #475569;
                    margin-bottom: 8px;
                }
                .feedback-panel-header {
                    font-size: 15px;
                    font-weight: 700;
                    color: #1e293b;
                    border-bottom: 1.5px dashed #e2e8f0;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                }
                .detail-item-title {
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #64748b;
                    margin-bottom: 2px;
                    font-weight: 600;
                }
                .detail-item-value {
                    font-size: 14px;
                    color: #1e293b;
                    font-weight: 500;
                    margin-bottom: 16px;
                }
            `}</style>

            <div className="container-fluid">
                <div className="row">
                    <div className="col-lg-12">
                    <Card style={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 18px rgba(0,0,0,0.03)' }}>
                        <Card.Header className="d-flex justify-content-between align-items-center bg-white border-0 py-4 px-4">
                            <div>
                                <h4 className="card-title font-w600 mb-0" style={{ color: '#1e293b', fontSize: '20px' }}>
                                    Repair Request Receiver
                                </h4>
                                <p className="text-muted mb-0" style={{ fontSize: '13px', marginTop: '4px' }}>
                                    Approve, reject, or place incoming repair requests on hold
                                </p>
                            </div>
                            <div className="d-flex align-items-center gap-3">
                                <div style={{ width: '280px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control 
                                        type="text" 
                                        placeholder="Search received requests..." 
                                        value={searchTerm} 
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '42px', borderRadius: '10px', paddingLeft: '40px', fontSize: '13px', border: '1px solid #e2e8f0' }}
                                    />
                                </div>
                                
                            </div>
                        </Card.Header>

                        <Card.Body className="p-0">
                            {/* Tab Navigation */}
                            <div style={{ borderBottom: '2px solid #f1f5f9', padding: '0 20px', display: 'flex', gap: '4px' }}>
                                {[
                                    { key: 'pending', label: 'Pending', count: pendingItems.length, icon: 'fa-clock' },
                                    { key: 'voted', label: 'Voted', count: votedItems.length, icon: 'fa-thumbs-up' },
                                    { key: 'not_voted', label: 'Not Voted', count: notVotedItems.length, icon: 'fa-times-circle' },
                                    { key: 'completed', label: 'Completed', count: completedItems.length, icon: 'fa-check-circle' }
                                ].map(tab => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            borderBottom: activeTab === tab.key ? '2px solid #0a500f' : '2px solid transparent',
                                            marginBottom: '-2px',
                                            padding: '14px 18px 12px',
                                            fontSize: '14px',
                                            fontWeight: activeTab === tab.key ? 600 : 400,
                                            color: activeTab === tab.key ? '#0a500f' : '#64748b',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'color 0.2s',
                                        }}
                                    >
                                        <i className={`fa ${tab.icon}`} style={{ fontSize: '13px' }}></i>
                                        {tab.label}
                                        <span style={{
                                            background: activeTab === tab.key ? '#d1fae5' : '#f1f5f9',
                                            color: activeTab === tab.key ? '#16a34a' : '#94a3b8',
                                            borderRadius: '12px',
                                            padding: '1px 8px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                        }}>
                                            {tab.count}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <Table responsive hover className="mb-0 align-middle">
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                                <th className="py-3 px-4 text-muted font-w500" style={{ fontSize: '12px', letterSpacing: '0.5px' }}><strong>ID</strong></th>
                                                <th className="py-3 text-muted font-w500" style={{ fontSize: '12px', letterSpacing: '0.5px' }}><strong>PART / MACHINE</strong></th>
                                                {activeTab !== 'pending' && <th className="py-3 text-muted font-w500" style={{ fontSize: '12px', letterSpacing: '0.5px' }}><strong>ENTRY DATE</strong></th>}
                                                {activeTab !== 'voted' && <th className="py-3 text-muted font-w500" style={{ fontSize: '12px', letterSpacing: '0.5px' }}><strong>DUE DATE</strong></th>}
                                                {activeTab === 'pending' && <th className="py-3 text-muted font-w500" style={{ fontSize: '12px', letterSpacing: '0.5px' }}><strong>PRIORITY</strong></th>}
                                                {(activeTab !== 'voted' && activeTab !== 'not_voted') && <th className="py-3 text-muted font-w500" style={{ fontSize: '12px', letterSpacing: '0.5px' }}><strong>SENDER</strong></th>}
                                                <th className="py-3 text-muted font-w500" style={{ fontSize: '12px', letterSpacing: '0.5px', minWidth: '200px', maxWidth: '300px' }}><strong>NOTES</strong></th>
                                                <th className="py-3 text-muted font-w500" style={{ fontSize: '12px', letterSpacing: '0.5px', minWidth: '150px', maxWidth: '250px' }}><strong>REMARKS</strong></th>
                                                {/* <th className="py-3 text-muted font-w500" style={{ fontSize: '12px', letterSpacing: '0.5px' }}><strong>IMAGES</strong></th> */}
                                                <th className="py-3 px-4 text-end text-muted font-w500" style={{ fontSize: '12px', letterSpacing: '0.5px' }}><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentItems.length > 0 ? (
                                                currentItems.map((item, idx) => (
                                                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td className="py-3 px-4">{indexOfFirstItem + idx + 1}</td>
                                                        <td className="py-3"><strong>{item.part_details || item.part}</strong></td>
                                                        {activeTab !== 'pending' && <td className="py-3">{item.entry_date ? item.entry_date.split('-').reverse().join('/') : '-'}</td>}
                                                        {activeTab !== 'voted' && <td className="py-3">{item.duedate ? item.duedate.split('-').reverse().join('/') : '-'}</td>}
                                                        {activeTab === 'pending' && (
                                                            <td className="py-3">
                                                                <span className={`badge light ${
                                                                    item.priority === 'High' ? 'badge-danger' :
                                                                    item.priority === 'Medium' ? 'badge-warning' :
                                                                    'badge-info'
                                                                }`}>
                                                                    {item.priority || 'Medium'}
                                                                </span>
                                                            </td>
                                                        )}
                                                        {(activeTab !== 'voted' && activeTab !== 'not_voted') && <td className="py-3">{item.created_by_name || 'System'}</td>}
                                                        <td className="py-3" style={{ maxWidth: '300px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                                            {item.notes}
                                                        </td>
                                                        <td className="py-3" style={{ maxWidth: '250px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                                            {item.remarks || <span className="text-muted">-</span>}
                                                        </td>
                                                        {/* <td className="py-3">
                                                            {item.images && item.images.length > 0 ? (
                                                                <div className="d-flex align-items-center position-relative" style={{ cursor: 'pointer' }} onClick={() => handleOpenGallery(item.images)}>
                                                                    <img 
                                                                        src={item.images[0].image} 
                                                                        alt="thumbnail" 
                                                                        style={{ width: '45px', height: '45px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} 
                                                                    />
                                                                    {item.images.length > 1 && (
                                                                        <span className="badge bg-primary position-absolute text-white" style={{ fontSize: '9px', right: '-12px', bottom: '0px', padding: '3px 6px', borderRadius: '50%' }}>
                                                                            +{item.images.length - 1}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="text-center text-muted border rounded d-flex align-items-center justify-content-center" style={{ width: '45px', height: '45px', background: '#f8fafc', fontSize: '10px' }}>
                                                                    No Img
                                                                </div>
                                                            )}
                                                        </td> */}
                                                        <td className="py-3 px-4 text-end">
                                                            <div className="d-flex justify-content-end">
                                                                <button
                                                                    className="btn btn-outline-secondary btn-sm shadow"
                                                                    onClick={() => handleOpenViewModal(item)}
                                                                    title="View Details"
                                                                    style={{
                                                                        width: '28px',
                                                                        height: '28px',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        padding: '0',
                                                                        fontSize: '12px',
                                                                        borderRadius: '6px',
                                                                    }}
                                                                >
                                                                    <i className="fa fa-eye"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={activeTab === 'pending' ? "7" : activeTab === 'voted' ? "6" : activeTab === 'not_voted' ? "7" : activeTab === 'completed' ? "7" : "9"} className="text-center py-4 text-muted">No routed repair requests found</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </Table>
                                </div>
                            )}

                            {!loading && tabItems.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, tabItems.length)} of {tabItems.length} entries
                                    </div>
                                    {totalPages > 1 && (
                                    <nav>
                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                            <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-left" />
                                                </button>
                                            </li>
                                            {Array.from({ length: totalPages }, (_, index) => {
                                                const pageNumber = index + 1;
                                                if (
                                                    pageNumber === 1 ||
                                                    pageNumber === totalPages ||
                                                    (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                                ) {
                                                    return (
                                                        <li key={pageNumber} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setCurrentPage(pageNumber)} style={{ border: 'none' }}>
                                                                {pageNumber}
                                                            </button>
                                                        </li>
                                                    );
                                                } else if (
                                                    pageNumber === currentPage - 2 ||
                                                    pageNumber === currentPage + 2
                                                ) {
                                                    return (
                                                        <li key={pageNumber} className="page-item disabled">
                                                            <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                        </li>
                                                    );
                                                }
                                                return null;
                                            })}
                                            <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-right" />
                                                </button>
                                            </li>
                                        </ul>
                                    </nav>
                                    )}
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                    </div>
                </div>
            </div>

            {/* Detailed View & Action/Feedback Modal */}
            <Modal 
                show={showViewModal} 
                onHide={() => setShowViewModal(false)} 
                dialogClassName="sgfm-modal modal-xl"
                centered
            >
                <div className="modal-header-custom d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-eye fa-lg"></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Repair Request Details & Feedback
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                View full request details and submit actions/decisions
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowViewModal(false)}>&times;</button>
                </div>

                {viewingRequest && (
                    <Form onSubmit={handleDecisionSubmit}>
                        <div className="modal-body-custom" style={{ background: '#fafbfc' }}>
                            <div className="row">
                                {/* Left Column: Request Details */}
                                <div className="col-lg-5 mb-4 mb-lg-0">
                                    <div className="bg-white p-4 rounded border" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                                        <div className="feedback-panel-header" style={{ borderColor: '#688cff' }}>
                                            <i className="fa fa-info-circle text-primary me-2"></i> Request Details
                                        </div>
                                        
                                        <div className="detail-item-title">Part / Machine</div>
                                        <div className="detail-item-value">{viewingRequest.part_details || viewingRequest.part}</div>

                                        <div className="detail-item-title">Entry Date</div>
                                        <div className="detail-item-value">{viewingRequest.entry_date ? viewingRequest.entry_date.split('-').reverse().join('/') : '-'}</div>

                                        <div className="detail-item-title">Due Date</div>
                                        <div className="detail-item-value">{viewingRequest.duedate ? viewingRequest.duedate.split('-').reverse().join('/') : '-'}</div>

                                        <div className="detail-item-title">Sender</div>
                                        <div className="detail-item-value">{viewingRequest.created_by_name || 'System'}</div>

                                        <div className="detail-item-title">Priority</div>
                                        <div className="detail-item-value">
                                            <span className={`badge light ${
                                                viewingRequest.priority === 'High' ? 'badge-danger' :
                                                viewingRequest.priority === 'Medium' ? 'badge-warning' :
                                                'badge-info'
                                            }`}>
                                                {viewingRequest.priority || 'Medium'}
                                            </span>
                                        </div>

                                        <div className="detail-item-title">Current Status</div>
                                        <div className="detail-item-value">
                                            <span className={`badge light ${
                                                viewingRequest.status === 'Accepted' ? 'badge-success' :
                                                viewingRequest.status === 'Hold' ? 'badge-info' :
                                                viewingRequest.status === 'Rejected' ? 'badge-danger' :
                                                'badge-warning'
                                            }`}>
                                                {viewingRequest.status || 'Pending'}
                                            </span>
                                        </div>

                                        <div className="detail-item-title">Notes / Issue Description</div>
                                        <div className="detail-item-value" style={{ whiteSpace: 'pre-line', background: '#f8fafc', padding: '10px', borderRadius: '8px', fontSize: '13px' }}>
                                            {viewingRequest.notes || '-'}
                                        </div>

                                        <div className="detail-item-title">Remarks</div>
                                        <div className="detail-item-value">{viewingRequest.remarks || '-'}</div>

                                        <div className="detail-item-title">Document Images</div>
                                        <div className="detail-item-value mb-0">
                                            {viewingRequest.images && viewingRequest.images.length > 0 ? (
                                                <div className="d-flex flex-wrap gap-2 mt-2">
                                                    {viewingRequest.images.map((img) => (
                                                        <div 
                                                            key={img.id} 
                                                            className="border rounded p-1 position-relative" 
                                                            style={{ width: '80px', height: '80px', cursor: 'pointer', overflow: 'hidden', background: '#fff' }}
                                                            onClick={() => handleOpenGallery(viewingRequest.images)}
                                                        >
                                                            <img src={img.image} alt="document" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-muted" style={{ fontSize: '13px' }}>No attachments uploaded</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Comment Action Feedback Form */}
                                <div className="col-lg-7">
                                    <div className="bg-white p-4 rounded border" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                                        <div className="feedback-panel-header" style={{ borderColor: '#0a500f' }}>
                                            <i className="fa fa-comment-dots text-success me-2"></i> Comment Action
                                        </div>

                                        <div className="row">
                                            <div className="col-md-12 mb-3">
                                                <Form.Label className="form-label-custom">Comment name:</Form.Label>
                                                <Form.Control 
                                                    type="text" 
                                                    className="form-control-custom" 
                                                    disabled 
                                                    value={userName} 
                                                    style={{ background: '#f1f5f9', fontWeight: '500' }}
                                                />
                                            </div>
                                        </div>

                                        <div className="row">
                                            <div className="col-md-6 mb-3">
                                                <Form.Label className="form-label-custom">Positive feedback:</Form.Label>
                                                <Form.Control 
                                                    as="textarea"
                                                    rows={3}
                                                    className="form-control-custom" 
                                                    placeholder="Enter positive feedback"
                                                    value={posFeedback}
                                                    onChange={(e) => setPosFeedback(e.target.value)}
                                                    disabled={isFieldsDisabled}
                                                />
                                            </div>
                                            <div className="col-md-6 mb-3">
                                                <Form.Label className="form-label-custom">Negative feedback:</Form.Label>
                                                <Form.Control 
                                                    as="textarea"
                                                    rows={3}
                                                    className="form-control-custom" 
                                                    placeholder="Enter negative feedback"
                                                    value={negFeedback}
                                                    onChange={(e) => setNegFeedback(e.target.value)}
                                                    disabled={isFieldsDisabled}
                                                />
                                            </div>
                                        </div>

                                        <div className="row">
                                            <div className="col-md-6 mb-3">
                                                <Form.Label className="form-label-custom d-block">Decision:</Form.Label>
                                                <div className="d-flex gap-4 mt-2">
                                                    <Form.Check 
                                                        type="radio"
                                                        label="YES"
                                                        name="decision"
                                                        id="decision-yes"
                                                        checked={decision === 'YES'}
                                                        onChange={() => setDecision('YES')}
                                                        style={{ fontWeight: '500', color: '#10b981' }}
                                                        disabled={isFieldsDisabled}
                                                    />
                                                    <Form.Check 
                                                        type="radio"
                                                        label="NO"
                                                        name="decision"
                                                        id="decision-no"
                                                        checked={decision === 'NO'}
                                                        onChange={() => setDecision('NO')}
                                                        style={{ fontWeight: '500', color: '#ef4444' }}
                                                        disabled={isFieldsDisabled}
                                                    />
                                                    <Form.Check 
                                                        type="radio"
                                                        label="NEUTRAL"
                                                        name="decision"
                                                        id="decision-neutral"
                                                        checked={decision === 'NEUTRAL'}
                                                        onChange={() => setDecision('NEUTRAL')}
                                                        style={{ fontWeight: '500', color: '#6b7a90' }}
                                                        disabled={isFieldsDisabled}
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-md-6 mb-3">
                                                <Form.Label className="form-label-custom">Supporting document:</Form.Label>
                                                <Form.Control 
                                                    type="file"
                                                    className="form-control-custom" 
                                                    onChange={(e) => setSupportingDoc(e.target.files[0])}
                                                    disabled={isFieldsDisabled}
                                                />
                                                {viewingRequest.supporting_document && (
                                                    <div className="mt-2">
                                                        <a href={viewingRequest.supporting_document} target="_blank" rel="noopener noreferrer" className="btn btn-xxs btn-outline-info">
                                                            <i className="fa fa-file-download me-1"></i> Current Document
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="row">
                                            <div className="col-md-12 mb-3">
                                                <Form.Label className="form-label-custom">Notes:</Form.Label>
                                                <Form.Control 
                                                    as="textarea"
                                                    rows={2}
                                                    className="form-control-custom" 
                                                    placeholder="Enter reason for decision"
                                                    value={decisionNotes}
                                                    onChange={(e) => setDecisionNotes(e.target.value)}
                                                    disabled={isFieldsDisabled}
                                                />
                                            </div>
                                        </div>

                                        {viewingRequest && isRequestResolved(viewingRequest) && viewingRequest.decision_notes && (
                                            <div className="row mt-3">
                                                <div className="col-md-12">
                                                    <div className="p-3 rounded" style={{ background: '#fff3cd', border: '1px solid #ffe69c' }}>
                                                        <div className="fw-bold mb-1" style={{ fontSize: '13px', color: '#856404' }}>
                                                            <i className="fa fa-info-circle me-1"></i> Remark from Decision Maker
                                                        </div>
                                                        <div style={{ fontSize: '13px', color: '#856404', whiteSpace: 'pre-line' }}>
                                                            {viewingRequest.decision_notes}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer-custom">
                            <button type="button" className="btn-action-custom btn-close-custom" onClick={() => setShowViewModal(false)}>
                                Close
                            </button>
                            {!isFieldsDisabled && (
                                <button 
                                    type="submit" 
                                    className="btn-action-custom btn-save-custom bg-success"
                                    disabled={submitting}
                                >
                                    {submitting ? 'Submitting...' : 'Submit Action'}
                                </button>
                            )}
                        </div>
                    </Form>
                )}
            </Modal>

            {/* Image Lightbox Gallery Modal */}
            <Modal show={showGallery} onHide={() => setShowGallery(false)} centered size="md" className="gallery-modal">
                <style>{`
                    .gallery-modal .modal-content { background-color: transparent; border: none; box-shadow: none; }
                    .gallery-modal .modal-header { border-bottom: none; }
                    .gallery-modal .btn-close { filter: invert(1) grayscale(100%) brightness(200%); }
                    .gallery-image-main { width: 100%; height: 400px; object-fit: contain; background: rgba(0,0,0,0.8); border-radius: 12px; }
                `}</style>
                <Modal.Header closeButton></Modal.Header>
                <Modal.Body className="p-0 text-center">
                    {galleryImages.length > 0 && (
                        <div>
                            <img src={galleryImages[activeGalleryIndex].image} alt="Gallery view" className="gallery-image-main mb-3" />
                            {galleryImages.length > 1 && (
                                <div className="d-flex justify-content-center gap-2 mt-3 overflow-auto p-2">
                                    {galleryImages.map((img, idx) => (
                                        <div 
                                            key={img.id} 
                                            onClick={() => setActiveGalleryIndex(idx)}
                                            style={{ 
                                                width: '60px', height: '60px', cursor: 'pointer',
                                                border: activeGalleryIndex === idx ? '2px solid #6d4aff' : '2px solid transparent',
                                                borderRadius: '6px', overflow: 'hidden', opacity: activeGalleryIndex === idx ? 1 : 0.6
                                            }}
                                        >
                                            <img src={img.image} alt="thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </Modal.Body>
            </Modal>
        </Fragment>
    );
};

export default RepairRequestReceiverList;