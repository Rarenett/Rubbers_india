import React, { useState, useEffect, Fragment } from 'react';
import { Card, Table, Button, Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getRepairRequests,
    adminUpdateRepairRequestStatus
} from '../../../services/MachineManagementService';
import { usePageTitle } from '../../../context/TitleContext';


const RepairRequestReviewList = () => {
    const [repairRequests, setRepairRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Detailed View Modal state
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewingRequest, setViewingRequest] = useState(null);

    // Image Lightbox Gallery Modal State
    const [showGallery, setShowGallery] = useState(false);
    const [galleryImages, setGalleryImages] = useState([]);
    const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);

    // Remark Modal State
    const [showRemarkModal, setShowRemarkModal] = useState(false);
    const [remarkRequest, setRemarkRequest] = useState(null);
    const [remarkDecision, setRemarkDecision] = useState('');
    const [adminRemark, setAdminRemark] = useState('');

    usePageTitle("Repair Request Reviews");

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getRepairRequests();
            setRepairRequests(data);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch repair requests' });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenGallery = (images) => {
        setGalleryImages(images);
        setActiveGalleryIndex(0);
        setShowGallery(true);
    };

    const handleStatusDropdownChange = (id, newStatus) => {
        const req = repairRequests.find(r => r.id === id);
        if (req) {
            setRemarkRequest(req);
            setRemarkDecision(newStatus);
            setAdminRemark(req.decision_notes || '');
            setShowRemarkModal(true);
        }
    };

    const submitDecisionWithRemark = async () => {
        if (!adminRemark.trim()) {
            Swal.fire({ icon: 'warning', title: 'Required', text: 'Please enter a remark before saving the decision.' });
            return;
        }
        setShowRemarkModal(false);
        try {
            await adminUpdateRepairRequestStatus(remarkRequest.id, remarkDecision, adminRemark);
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Decision and remark saved successfully!',
                timer: 1500,
                showConfirmButton: false
            });
            fetchData();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to update request status' });
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

    const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}')?.user;
    const loggedInUserId = userDetails?.id;
    const isAdmin = userDetails?.is_superuser;

    const filteredItems = sortedRequests.filter(req => {
        if (!req.is_defined) return false;

        // Admin can view all requests. Non-admin can only view assigned requests.
        if (!isAdmin && req.decision_maker_id !== loggedInUserId) {
            return false;
        }

        const idStr = `#${req.id}`.toLowerCase();
        const machine = (req.part_details || '').toLowerCase();
        const notes = (req.notes || '').toLowerCase();
        const poster = (req.created_by_name || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        return idStr.includes(search) || machine.includes(search) || notes.includes(search) || poster.includes(search);
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

    // Function to calculate responder decision string/color based on votes majority
    const getResponderDecisionText = (votes) => {
        if (!votes) return 'NONE';
        const { yes, no, neutral } = votes;
        if (yes === 0 && no === 0 && neutral === 0) return 'NONE';
        if (yes >= no && yes >= neutral) return 'YES';
        if (no > yes && no >= neutral) return 'NO';
        return 'NEUTRAL';
    };

    const getResponderDecisionBadgeColor = (decision) => {
    if (decision === 'YES') return { bg: 'rgba(34, 197, 94, 0.12)', color: '#16a34a' };   // green
    if (decision === 'NO') return { bg: 'rgba(239, 68, 68, 0.12)', color: '#dc2626' };    // red
    if (decision === 'NEUTRAL') return { bg: 'rgba(245, 158, 11, 0.12)', color: '#d97706' }; // orange
    return { bg: 'rgba(107, 114, 128, 0.12)', color: '#4b5563' };
};

    const getPriorityBadgeStyle = (priority) => {
        if (priority === 'High') return { bg: 'rgba(239, 68, 68, 0.12)', color: '#dc2626' };
        if (priority === 'Medium') return { bg: 'rgba(245, 158, 11, 0.12)', color: '#d97706' };
        return { bg: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' }; // Low / default
    };

    const getStatusBadgeStyle = (status) => {
        if (status === 'Accepted') return { bg: 'rgba(34, 197, 94, 0.12)', color: '#16a34a' };
        if (status === 'Rejected') return { bg: 'rgba(239, 68, 68, 0.12)', color: '#dc2626' };
        if (status === 'Hold') return { bg: 'rgba(245, 158, 11, 0.12)', color: '#d97706' };
        return { bg: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' };
    };


    return (
        <div className="container-fluid">
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
                .btn-close-custom:hover { background-color: #e2e8f0; }
                .btn-save-custom {
                    color: #fff;
                }
                .feedback-panel-header {
                    font-weight: 600;
                    font-size: 14px;
                    color: #334155;
                    margin-bottom: 16px;
                    padding-bottom: 8px;
                    border-bottom: 2px solid #e2e8f0;
                    display: flex;
                    align-items: center;
                }
                .detail-item-title {
                    font-size: 11px;
                    font-weight: 600;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 2px;
                }
                .detail-item-value {
                    font-size: 14px;
                    color: #0f172a;
                    margin-bottom: 16px;
                    font-weight: 500;
                }
            `}</style>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">All Repair Requests</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search feedback..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <Table responsive className="table-responsive-md">
                                        <thead>
                                            <tr>
                                                <th><strong>SL.NO</strong></th>
                                                <th><strong>COMPLAINT</strong></th>
                                                <th><strong>PRIORITY</strong></th>
                                                <th><strong>POSTED BY</strong></th>

                                                <th><strong>ADMIN DECISION</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentItems.length > 0 ? (
                                                currentItems.map((req, idx) => {
                                                    const responderDecision = getResponderDecisionText(req.votes);
                                                    return (
                                                        <tr key={req.id}>
                                                            <td>{indexOfFirstItem + idx + 1}</td>
                                                            <td>
                                                                <div className="d-flex flex-column">
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <strong>{req.part_details || 'No notes provided'}</strong>
                                                                        {/* <span className={`badge light ${
                                                                            req.priority === 'High' ? 'badge-danger' :
                                                                            req.priority === 'Medium' ? 'badge-warning' :
                                                                            'badge-info'
                                                                        }`} style={{ fontSize: '10px', padding: '3px 6px' }}>
                                                                            {req.priority || 'Medium'}
                                                                        </span> */}
                                                                    </div>
                                                                    {/* <span className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                                                        #{req.id} | {req.notes} | Entry: {req.entry_date ? req.entry_date.split('-').reverse().join('/') : '-'} | Due: {req.duedate ? req.duedate.split('-').reverse().join('/') : '-'}
                                                                    </span> */}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <span className={`badge light ${
                                                                    req.priority === 'High' ? 'badge-danger' :
                                                                    req.priority === 'Medium' ? 'badge-warning' :
                                                                    'badge-info'
                                                                }`}>
                                                                    {req.priority || 'Medium'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div className="d-flex align-items-center gap-2">
                                                                    {/* <div className="rounded-circle d-flex align-items-center justify-content-center text-white font-weight-bold" style={{ width: '30px', height: '30px', backgroundColor: '#8888dd', fontSize: '12px' }}>
                                                                        {(req.created_by_name || 'U')[0].toUpperCase()}
                                                                    </div> */}
                                                                    <span>{req.created_by_name || 'Unknown User'}</span>
                                                                </div>
                                                            </td>

                                                            <td>
                                                                <Form.Select
                                                                    value={req.status}
                                                                    onChange={(e) => handleStatusDropdownChange(req.id, e.target.value)}
                                                                    style={{ height: '35px', borderRadius: '6px', fontSize: '12px', width: '130px', padding: '2px 8px' }}
                                                                    disabled={req.decision_maker_id && req.decision_maker_id !== loggedInUserId && !isAdmin}
                                                                >
                                                                    {req.status === 'Pending' && <option value="Pending" disabled hidden>Select Decision</option>}
                                                                    {responderDecision !== 'NO' && <option value="Accepted">Approved</option>}
                                                                    {responderDecision !== 'YES' && <option value="Rejected">Rejected</option>}
                                                                    <option value="Hold">Hold</option>
                                                                </Form.Select>
                                                                {req.decision_maker_id && req.decision_maker_id !== loggedInUserId && !isAdmin && (
                                                                    <div className="text-danger mt-1" style={{ fontSize: '10px' }}>
                                                                        <i className="fa fa-lock me-1"></i> Assigned User Only
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="text-end">
                                                                <button
                                                                    className="btn btn-outline-secondary btn-sm shadow"
                                                                    onClick={() => {
                                                                        setViewingRequest(req);
                                                                        setShowViewModal(true);
                                                                    }}
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
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="text-center py-4 text-muted">No repair requests found</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </Table>
                                </div>
                            )}

                            <div className="d-flex justify-content-between align-items-center mt-3 py-4 bg-white px-4 border-top">
                                <div className="text-muted" style={{ fontSize: '13px' }}>
                                    Showing {filteredItems.length === 0 ? 0 : indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredItems.length)} of {filteredItems.length} entries
                                </div>
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
                            </div>
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* DETAILED VIEW MODAL WITH RESPONDER FEEDBACK TABLE */}
            {viewingRequest && (
                <Modal 
                    show={showViewModal} 
                    onHide={() => setShowViewModal(false)} 
                    dialogClassName="sgfm-modal modal-xl"
                    centered
                >
                    <div className="modal-header-custom d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-3">
                            <div className="modal-icon-circle bg-primary" style={{ backgroundColor: '#20c997' }}>
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

                    <div className="modal-body-custom" style={{ background: '#fafbfc' }}>
                        <div className="row">
                            {/* LEFT SIDE: Request details */}
                            <div className="col-lg-5 mb-4 mb-lg-0">
                                <div className="bg-white p-4 rounded border" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                                    <div className="feedback-panel-header" style={{ borderColor: '#20c997' }}>
                                        <i className="fa fa-info-circle text-success me-2"></i> Request Details
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
                                            {viewingRequest.status}
                                        </span>
                                    </div>

                                    {viewingRequest.decision_notes && (
                                        <>
                                            <div className="detail-item-title mt-4 text-warning">Admin Remark</div>
                                            <div className="p-3 bg-light rounded border border-warning detail-item-value" style={{ whiteSpace: 'pre-wrap' }}>
                                                {viewingRequest.decision_notes}
                                            </div>
                                        </>
                                    )}

                                    <div className="detail-item-title mt-4">Notes / Issue Description</div>
                                    <div className="p-3 bg-light rounded border detail-item-value" style={{ whiteSpace: 'pre-wrap' }}>
                                        {viewingRequest.notes || 'No notes provided'}
                                    </div>

                                    <div className="detail-item-title mt-4">Remarks</div>
                                    <div className="detail-item-value">
                                        {viewingRequest.remarks || <span className="text-muted">-</span>}
                                    </div>

                                    <div className="detail-item-title mt-4 mb-2">Document Images</div>
                                    {viewingRequest.images && viewingRequest.images.length > 0 ? (
                                        <div className="d-flex flex-wrap gap-2">
                                            {viewingRequest.images.map((img, idx) => (
                                                <div 
                                                    key={img.id} 
                                                    className="border rounded overflow-hidden position-relative" 
                                                    style={{ width: '70px', height: '70px', cursor: 'pointer' }}
                                                    onClick={() => handleOpenGallery(viewingRequest.images)}
                                                >
                                                    <img 
                                                        src={img.image} 
                                                        alt={`attached ${idx}`} 
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-muted" style={{ fontSize: '13px' }}>No attachments uploaded</div>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT SIDE: Feedback from multiple users */}
                            <div className="col-lg-7">
                                <div className="bg-white p-4 rounded border" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                                    <div className="feedback-panel-header" style={{ borderColor: '#688cff' }}>
                                        <i className="fa fa-comments text-primary me-2"></i> Responder Feedbacks
                                    </div>
                                    {viewingRequest.feedbacks && viewingRequest.feedbacks.length > 0 ? (
                                        <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                            <Table bordered hover size="sm" style={{ fontSize: '12px' }}>
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Responder</th>
                                                        <th>Vote</th>
                                                        <th>Positive Feedback</th>
                                                        <th>Negative Feedback</th>
                                                        <th>Notes</th>
                                                        <th>Document</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {viewingRequest.feedbacks.map((fb) => (
                                                        <tr key={fb.id}>
                                                            <td><strong>{fb.responder_name || 'N/A'}</strong></td>
                                                            <td>
                                                                <span
                                                                    className="badge"
                                                                    style={{
                                                                        fontSize: '10px',
                                                                        backgroundColor: getResponderDecisionBadgeColor(fb.decision).bg,
                                                                        color: getResponderDecisionBadgeColor(fb.decision).color,
                                                                    }}
                                                                >
                                                                    {fb.decision}
                                                                </span>
                                                            </td>
                                                            <td>{fb.positive_feedback || '-'}</td>
                                                            <td>{fb.negative_feedback || '-'}</td>
                                                            <td>{fb.decision_notes || '-'}</td>
                                                            <td>
                                                                {fb.supporting_document ? (
                                                                    <a 
                                                                        href={fb.supporting_document} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer"
                                                                        className="btn btn-outline-info btn-xs py-0 px-1"
                                                                        style={{ fontSize: '10px' }}
                                                                    >
                                                                        View Doc
                                                                    </a>
                                                                ) : '-'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-5 text-muted border rounded" style={{ fontSize: '13px' }}>
                                            No receiver has submitted feedback for this request yet.
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
                    </div>
                </Modal>
            )}

            {/* LIGHTBOX GALLERY MODAL */}
            <Modal 
                show={showGallery} 
                onHide={() => setShowGallery(false)} 
                centered 
                size="lg"
                contentClassName="bg-dark text-light border-0"
            >
                <Modal.Header closeButton closeVariant="white" className="border-0 pb-0">
                    <Modal.Title style={{ fontSize: '15px' }}>Attached Files Viewer</Modal.Title>
                </Modal.Header>
                <Modal.Body className="d-flex align-items-center justify-content-center position-relative p-4" style={{ minHeight: '350px' }}>
                    {galleryImages.length > 0 && (
                        <>
                            {galleryImages.length > 1 && (
                                <button 
                                    className="btn btn-link text-white position-absolute" 
                                    style={{ left: '15px', top: '50%', transform: 'translateY(-50%)', zIndex: 10, fontSize: '24px' }}
                                    onClick={() => setActiveGalleryIndex(prev => (prev === 0 ? galleryImages.length - 1 : prev - 1))}
                                >
                                    <i className="fa fa-chevron-left"></i>
                                </button>
                            )}
                            
                            <div className="text-center" style={{ maxWidth: '80%', maxHeight: '60vh' }}>
                                <img 
                                    src={galleryImages[activeGalleryIndex].image} 
                                    alt="attachment preview" 
                                    style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '4px' }}
                                />
                                <div className="text-muted mt-2 small">
                                    File {activeGalleryIndex + 1} of {galleryImages.length}
                                </div>
                            </div>

                            {galleryImages.length > 1 && (
                                <button 
                                    className="btn btn-link text-white position-absolute" 
                                    style={{ right: '15px', top: '50%', transform: 'translateY(-50%)', zIndex: 10, fontSize: '24px' }}
                                    onClick={() => setActiveGalleryIndex(prev => (prev === galleryImages.length - 1 ? 0 : prev + 1))}
                                >
                                    <i className="fa fa-chevron-right"></i>
                                </button>
                            )}
                        </>
                    )}
                </Modal.Body>
            </Modal>

            {/* Custom Styled Popup Modal for Admin Remark */}
            <Modal 
                show={showRemarkModal} 
                onHide={() => setShowRemarkModal(false)}
                dialogClassName="item-custom-modal"
                size="md"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-comment-dots text-white" style={{ fontSize: '20px' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Admin Remark
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Required for {remarkDecision}
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowRemarkModal(false)}>
                        &times;
                    </button>
                </div>
                <div className="modal-body-custom p-4">
                    <div className="mb-3">
                        <label className="form-label-custom">Enter Remark for {remarkDecision} Decision <span className="text-danger">*</span></label>
                        <textarea
                            className="form-control-custom"
                            rows="4"
                            placeholder="Type your final remark here..."
                            value={adminRemark}
                            onChange={(e) => setAdminRemark(e.target.value)}
                        ></textarea>
                    </div>
                </div>
                <div className="modal-footer-custom">
                    <button type="button" className="btn-close-custom" onClick={() => setShowRemarkModal(false)}>
                        Cancel
                    </button>
                    <button type="button" className="btn-save-custom" onClick={submitDecisionWithRemark}>
                        Save Decision
                    </button>
                </div>
            </Modal>

            {/* Inline Styles for Custom Popup */}
            <style>{`
                .item-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .item-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .item-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
                .item-custom-modal .modal-close-x {
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
                .item-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .item-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: 75vh;
                    overflow-y: auto;
                    background-color: #f8fafc;
                }
                .item-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .item-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .item-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .item-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .item-custom-modal .btn-close-custom {
                    background-color: #7A70BA !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .item-custom-modal .btn-close-custom:hover {
                    background-color: #6357a7 !important;
                }
                .item-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .item-custom-modal .btn-save-custom {
                    background-color: #2ece8a !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .item-custom-modal .btn-save-custom:hover {
                    background-color: #26b277 !important;
                }
            `}</style>
        </div>
    );
};

export default RepairRequestReviewList;