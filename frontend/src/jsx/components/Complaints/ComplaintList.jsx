import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Table, Modal, Card, Button } from 'react-bootstrap';
import ComplaintService from '../../../services/ComplaintService';
import { usePageTitle } from '../../../context/TitleContext';

const ComplaintList = ({ myOnly }) => {
    const navigate = useNavigate();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [listFilter, setListFilter] = useState('UNSOLVED');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    usePageTitle("Complaint Registry");

    useEffect(() => {
        setCurrentPage(1);
    }, [listFilter, complaints.length]);
    
    // Parse current user context
    const userDetailsStr = localStorage.getItem('userDetails');
    const currentUser = userDetailsStr ? JSON.parse(userDetailsStr).user : null;

    useEffect(() => {
        fetchComplaints();
    }, []);

    const fetchComplaints = async () => {
        setLoading(true);
        try {
            const res = await ComplaintService.getComplaints();
            setComplaints(res.data.results || res.data);
        } catch (err) {
            console.error("Error fetching complaints", err);
        } finally {
            setLoading(false);
        }
    };

    const handleRowClick = (item) => {
        if (myOnly) {
            setSelectedComplaint(item);
            setShowDetailModal(true);
        } else {
            navigate(`/complaints/detail/${item.id}`);
        }
    };

    const getPriorityBadgeClass = (priority) => {
        const classes = {
            'Critical': 'badge-danger light',
            'High': 'badge-warning light',
            'Medium': 'badge-info light',
            'Low': 'badge-success light',
        };
        return classes[priority] || 'badge-info light';
    };

    const getAdminStatusBadgeClass = (status) => {
        const classes = {
            'Pending': 'badge-secondary light',
            'Approved': 'badge-success light',
            'Rejected': 'badge-danger light',
            'On Hold': 'badge-warning light',
        };
        return classes[status] || 'badge-secondary light';
    };

    const getDecisionBadge = (decision) => {
        if (decision === 'YES') return { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' };
        if (decision === 'NO') return { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' };
        return { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' };
    };

    let displayedComplaints = currentUser
        ? (myOnly
            ? complaints.filter(c =>
                c.user_details?.email === currentUser.email ||
                c.user_details?.id === currentUser.id)
            : complaints.filter(c =>
                c.user_details?.email !== currentUser.email &&
                c.user_details?.id !== currentUser.id)
          )
        : complaints;

    if (listFilter === 'UNSOLVED') {
        displayedComplaints = displayedComplaints.filter(c => c.status !== 'Closed');
    } else if (listFilter === 'SOLVED') {
        displayedComplaints = displayedComplaints.filter(c => c.status === 'Closed');
    }

    const priorityWeight = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
    const sortedComplaints = [...displayedComplaints].sort((a, b) => {
        const weightA = priorityWeight[a.priority] || 0;
        const weightB = priorityWeight[b.priority] || 0;
        if (weightA !== weightB) {
            return weightB - weightA;
        }
        return b.id - a.id;
    });

    const totalPages = Math.ceil(sortedComplaints.length / itemsPerPage) || 1;
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentData = sortedComplaints.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <div className="container-fluid">
            <div className="page-titles">
                {/* <button 
                    onClick={() => navigate('/complaints')} 
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button> */}
            </div>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center list-header-container">
                            <Card.Title className="mb-0">
                                {myOnly ? 'My Complaints' : 'Complaint Registry'}
                            </Card.Title>
                            <div className="d-flex gap-2 list-controls-wrapper">
                                <Button 
                                    onClick={() => setListFilter('UNSOLVED')}
                                    className="list-filter-btn"
                                    style={{
                                        backgroundColor: listFilter === 'UNSOLVED' ? 'rgb(61, 53, 119)' : 'transparent',
                                        borderColor: 'rgb(61, 53, 119)',
                                        color: listFilter === 'UNSOLVED' ? 'white' : 'rgb(61, 53, 119)',
                                        height: '34px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontSize: '13px'
                                    }}
                                >
                                    {myOnly ? 'Complaints' : 'Take Decision'}
                                </Button>
                                <Button 
                                    onClick={() => setListFilter('SOLVED')}
                                    className="list-filter-btn"
                                    style={{
                                        backgroundColor: listFilter === 'SOLVED' ? 'rgb(61, 53, 119)' : 'transparent',
                                        borderColor: 'rgb(61, 53, 119)',
                                        color: listFilter === 'SOLVED' ? 'white' : 'rgb(61, 53, 119)',
                                        height: '34px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontSize: '13px'
                                    }}
                                >
                                    Final Decision Taken
                                </Button>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <div className="table-responsive">
                                <table className="table table-responsive-md list-table">
                                    <thead>
                                        <tr>
                                            <th><strong>SL.NO</strong></th>
                                            <th><strong>COMPLAINT ID</strong></th>
                                            <th><strong>COMPLAINT TITLE</strong></th>
                                            <th><strong>CATEGORY</strong></th>
                                            {/* <th><strong>ROUTING PATTERN</strong></th> */}
                                            <th><strong>ENTRY DATE</strong></th>
                                            <th><strong>EXPIRY DATE</strong></th>
                                            <th><strong>PRIORITY</strong></th>
                                            <th className="text-end"><strong>STATUS</strong></th>
                                            <th className="text-end"><strong>ACTIONS</strong></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan="9" className="text-center py-5">
                                                <div className="spinner-border text-primary" role="status"></div>
                                            </td></tr>
                                        ) : currentData.length === 0 ? (
                                            <tr><td colSpan="9" className="text-center py-5 text-muted">No complaints found in the directory.</td></tr>
                                        ) : (
                                            currentData.map((item, index) => {
                                                const pClass = getPriorityBadgeClass(item.priority);
                                                const adClass = getAdminStatusBadgeClass(item.admin_decision || 'Pending');
                                                
                                                return (
                                                    <tr 
                                                        key={item.id} 
                                                        style={{ background: selectedComplaint?.id === item.id && myOnly ? '#f0f9ff' : '' }}
                                                    >
                                                        <td>
                                                            <strong>{indexOfFirstItem + index + 1}</strong>
                                                        </td>
                                                        <td>
                                                            <strong>CMP-{item.id}</strong>
                                                        </td>
                                                        <td>
                                                            <div className="d-flex flex-column">
                                                                <strong>{item.title}</strong>
                                                                <small className="text-muted text-truncate" title={item.description} style={{ maxWidth: '250px' }}>
                                                                    {item.description.length > 45 ? `${item.description.substring(0, 45)}...` : item.description}
                                                                </small>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <Badge bg="light" text="dark">{item.category_name}</Badge>
                                                        </td>
                                                        {/* <td>
                                                            {item.pattern_name || '-'}
                                                        </td> */}
                                                        <td>
                                                            {item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB') : '-'}
                                                        </td>
                                                        <td>
                                                            {item.cutoff_date ? new Date(item.cutoff_date).toLocaleDateString('en-GB') : '-'}
                                                        </td>
                                                        <td>
                                                            <span className={`badge ${pClass}`}>
                                                                {item.priority}
                                                            </span>
                                                        </td>
                                                        <td className="text-end">
                                                            <span className={`badge ${adClass}`}>
                                                                {item.admin_decision || 'Pending'}
                                                            </span>
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end">
                                                                <button 
                                                                    className="btn btn-outline-secondary btn-sm shadow" 
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
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleRowClick(item);
                                                                    }}
                                                                >
                                                                    <i className="fa fa-eye"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>

                                {/* Pagination */}
                                {!loading && sortedComplaints.length > 0 && (
                                    <div className="d-flex align-items-center justify-content-between mt-3 mb-4">
                                        <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, sortedComplaints.length)} of {sortedComplaints.length} entries
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
                                                                    <span className="page-link" style={{ border: 'none' }}>...</span>
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
                            </div>
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Resolution Details Modal — visible only in My Complaints mode */}
            {myOnly && (
                <Modal 
                    show={showDetailModal} 
                    onHide={() => { setShowDetailModal(false); setSelectedComplaint(null); }} 
                    centered 
                    size="lg"
                >
                    <Modal.Header closeButton style={{ border: 'none', padding: '1.5rem 2rem 0.5rem' }}>
                        <Modal.Title style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
                            {selectedComplaint && (
                                <div className="d-flex align-items-center gap-2">
                                    <span style={{ background: '#f0f9ff', color: '#0284c7', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                                        CMP-{selectedComplaint.id}
                                    </span>
                                    {selectedComplaint.title}
                                </div>
                            )}
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body style={{ padding: '1rem 2rem 2rem' }}>
                        {selectedComplaint && (
                            <>
                                {/* Complaint Summary */}
                                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1rem 1.2rem', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
                                    <div className="d-flex flex-wrap gap-4" style={{ fontSize: '0.82rem' }}>
                                        <div>
                                            <span className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>Status</span>
                                            <div className="fw-bold mt-1">{selectedComplaint.status}</div>
                                        </div>
                                        <div>
                                            <span className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>Admin Decision</span>
                                            <div className="fw-bold mt-1">{selectedComplaint.admin_decision || 'Pending'}</div>
                                        </div>
                                        <div>
                                            <span className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>Priority</span>
                                            <div className="mt-1">
                                                <span className={`badge ${getPriorityBadgeClass(selectedComplaint.priority)}`}>
                                                    {selectedComplaint.priority}
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.04em' }}>Expiry Date</span>
                                            <div className="fw-bold mt-1">{selectedComplaint.cutoff_date ? new Date(selectedComplaint.cutoff_date).toLocaleDateString('en-GB') : '—'}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Default Resolution (from complaint itself) */}
                                {(selectedComplaint.positive_feedback || selectedComplaint.negative_feedback || selectedComplaint.responder_remarks) && (
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <h6 className="fw-bold mb-3 d-flex align-items-center" style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="#0284c7" className="me-2" viewBox="0 0 16 16"><path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4.414A2 2 0 0 0 3 11.586l-2 2V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12.793a.5.5 0 0 0 .854.353l2.853-2.853A1 1 0 0 1 4.414 12H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/></svg>
                                            Final Resolution
                                        </h6>
                                        <div className="d-flex gap-3 mb-3" style={{ flexWrap: 'wrap' }}>
                                            <div style={{ flex: 1, minWidth: '200px', background: '#f0fdf4', borderRadius: '10px', padding: '0.8rem 1rem', border: '1px solid #bbf7d0' }}>
                                                <label className="fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.65rem', color: '#15803d', letterSpacing: '0.04em' }}>Positive Factors</label>
                                                <p className="m-0" style={{ fontSize: '0.85rem', color: '#166534', lineHeight: '1.5' }}>
                                                    {selectedComplaint.positive_feedback || 'N/A'}
                                                </p>
                                            </div>
                                            <div style={{ flex: 1, minWidth: '200px', background: '#fef2f2', borderRadius: '10px', padding: '0.8rem 1rem', border: '1px solid #fecaca' }}>
                                                <label className="fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.65rem', color: '#991b1b', letterSpacing: '0.04em' }}>Critical Issues</label>
                                                <p className="m-0" style={{ fontSize: '0.85rem', color: '#991b1b', lineHeight: '1.5' }}>
                                                    {selectedComplaint.negative_feedback || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        {selectedComplaint.responder_remarks && (
                                            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.8rem 1rem', border: '1px solid #e2e8f0', borderLeft: '3px solid #0284c7' }}>
                                                <label className="fw-bold text-uppercase d-block mb-1" style={{ fontSize: '0.65rem', color: '#475569', letterSpacing: '0.04em' }}>Remarks</label>
                                                <p className="m-0" style={{ fontSize: '0.85rem', color: '#334155', lineHeight: '1.5' }}>
                                                    {selectedComplaint.responder_remarks}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!selectedComplaint.positive_feedback && !selectedComplaint.negative_feedback && !selectedComplaint.responder_remarks && (
                                    <div className="text-center py-4 text-muted" style={{ fontSize: '0.9rem' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#cbd5e1" className="mb-2" viewBox="0 0 16 16"><path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2.5a2 2 0 0 0-1.6.8L8 14.333 6.1 11.8a2 2 0 0 0-1.6-.8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5a1 1 0 0 1 .8.4l1.9 2.533a1 1 0 0 0 1.6 0l1.9-2.533a1 1 0 0 1 .8-.4H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/></svg>
                                        <div>No evaluator feedback available yet.</div>
                                    </div>
                                )}
                            </>
                        )}
                    </Modal.Body>
                </Modal>
            )}
            
            <style>{`
                @media (max-width: 991px) {
                    .list-header-container {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 15px !important;
                    }
                    .list-controls-wrapper {
                        flex-direction: column !important;
                        width: 100% !important;
                        gap: 10px !important;
                    }
                    .list-filter-btn {
                        width: 100% !important;
                    }
                }
                .list-table {
                    min-width: 1000px !important;
                }
                .list-table th, .list-table td {
                    white-space: nowrap !important;
                }
                .complaint-row:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 15px rgba(0,0,0,0.05) !important;
                    background-color: #f8fafc !important;
                }
                .complaint-row:hover td {
                    border-color: #e2e8f0 !important;
                }
            `}
            </style>
        </div>
    );
};

export default ComplaintList;
