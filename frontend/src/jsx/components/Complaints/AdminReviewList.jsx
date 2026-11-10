import React, { useState, useEffect, Fragment } from 'react';
import { Table, Badge, Form, Button, Card, Breadcrumb, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import ComplaintService from '../../../services/ComplaintService';
import { toast } from 'react-toastify';
import { usePageTitle } from '../../../context/TitleContext';

const AdminReviewList = () => {
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const navigate = useNavigate();
    usePageTitle("Complaint History");
    const fetchComplaints = async () => {
        try {
            setLoading(true);
            const response = await ComplaintService.getComplaints({ is_review: 'true' });
            setComplaints(response.data);
        } catch (error) {
            toast.error("Failed to load review list");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchComplaints();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const handleAdminDecision = async (id, decision) => {
        try {
            await ComplaintService.setAdminDecision(id, decision);
            toast.success(`Ticket #${id} marked as ${decision}`);
            fetchComplaints(); // Refresh list
        } catch (error) {
            toast.error("Update failed");
        }
    };

    const handleViewDetails = (complaint) => {
        setSelectedComplaint(complaint);
        setShowModal(true);
    };

    const filteredComplaints = complaints.filter(c => 
        c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.toString().includes(searchTerm)
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredComplaints.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredComplaints.length / itemsPerPage);

    return (
        <Fragment>
            <style>
                {`
                    @media (max-width: 991px) {
                        .history-header-container {
                            flex-direction: column !important;
                            align-items: flex-start !important;
                            gap: 15px !important;
                        }
                        .history-controls-wrapper {
                            flex-direction: column !important;
                            width: 100% !important;
                            gap: 10px !important;
                        }
                        .history-search-bar {
                            width: 100% !important;
                        }
                    }
                    .history-table {
                        min-width: 900px !important;
                    }
                    .history-table th, .history-table td {
                        white-space: nowrap !important;
                    }
                `}
            </style>
            <div className="container-fluid">
            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center history-header-container">
                            <Card.Title className="mb-0">Complaint History</Card.Title>
                            <div className="d-flex align-items-center gap-2 history-controls-wrapper">
                                <div className="history-search-bar" style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Feedback..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '37px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <div className="d-flex gap-2 ms-auto">
                                    {/* <Button 
                                        variant="outline-primary" 
                                        onClick={fetchComplaints} 
                                        disabled={loading}
                                        style={{ height: '34px', display: 'flex', alignItems: 'center', fontSize: '13px' }}
                                    >
                                        {loading ? (
                                            <><i className="fa fa-spinner fa-spin me-2"></i>Refreshing...</>
                                        ) : (
                                            <><i className="fa fa-refresh me-2"></i>Refresh</>
                                        )}
                                    </Button> */}
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <div className="table-responsive">
                                <table className="table table-responsive-md history-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '60px' }}><strong>SL NO.</strong></th>
                                            <th><strong>COMPLAINT</strong></th>
                                            <th><strong>POSTED BY</strong></th>
                                            <th><strong>VOTES (Y/N/NEUTRAL)</strong></th>
                                            {/* <th><strong>RESPONDER DECISION</strong></th> */}
                                            <th><strong>FINAL DECISION</strong></th>
                                            <th><strong>AUTHORIZED BY</strong></th>
                                            <th className="text-end"><strong>ACTIONS</strong></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                            {loading ? (
                                <tr><td colSpan="7" className="text-center py-5">Loading reviews...</td></tr>
                            ) : currentItems.length > 0 ? (
                                currentItems.map((c, idx) => {
                                    const actions = c.actions || [];
                                    const yesVotes = actions.filter(a => a.decision === 'YES').length;
                                    const noVotes = actions.filter(a => a.decision === 'NO').length;
                                    const neutralVotes = actions.filter(a => a.decision === 'NEUTRAL').length;
                                    const responderName = actions.length > 0 
                                        ? `${actions[0].created_by_details.first_name || ''} ${actions[0].created_by_details.last_name || ''}`.trim() || actions[0].created_by_details.email
                                        : 'N/A';
                                    const responderDecision = actions.length > 0 ? actions[0].decision : 'Pending';

                                    const adminUpdate = (c.updates || []).slice().reverse().find(u => u.remark && u.remark.includes('Admin Final Decision:'));
                                    const finalDecisionMaker = adminUpdate && adminUpdate.user_details 
                                        ? `${adminUpdate.user_details.first_name || ''} ${adminUpdate.user_details.last_name || ''}`.trim() || adminUpdate.user_details.email
                                        : 'Pending';

                                    return (
                                        <tr key={c.id}>
                                            <td><strong>{indexOfFirstItem + idx + 1}</strong></td>
                                            <td>
                                                <div className="d-flex flex-column">
                                                    <strong>{c.title}</strong>
                                                    <small className="text-muted">CMP-{c.id} | {c.category_name}</small>
                                                </div>
                                            </td>
                                            <td>
                                                <span>{responderName}</span>
                                            </td>
                                            <td>
                                                <strong className="d-flex gap-2 fw-semibold" style={{fontSize: '0.9rem'}}>
                                                    <span>Y: {yesVotes}</span>
                                                    <span>N: {noVotes}</span>
                                                    <span>Neu: {neutralVotes}</span>
                                                </strong>
                                            </td>
                                            {/* <td>
                                                <span className={`badge light badge-${
                                                    responderDecision === 'YES' ? 'success' : 
                                                    responderDecision === 'NO' ? 'danger' : 'info'
                                                }`}>
                                                    {responderDecision}
                                                </span>
                                            </td> */}
                                            <td>
                                                <span className={`badge light badge-${
                                                    c.status === 'Closed' || c.status === 'Resolved' ? 'success' : 
                                                    c.status === 'Rejected' ? 'danger' : 'warning'
                                                }`}>
                                                    {c.status ? c.status.toUpperCase() : 'PENDING'}
                                                </span>
                                            </td>
                                            <td>
                                               {finalDecisionMaker}
                                            </td>
                                            <td className="text-end">
                                                <div className="d-flex justify-content-end">
                                                    <button 
                                                        className="btn shadow btn-xs sharp" 
                                                        style={{ backgroundColor: '#0a500f', borderColor: '#0a500f', color: 'white' }}
                                                        onClick={() => handleViewDetails(c)}
                                                    >
                                                        <i className="fa fa-eye"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr><td colSpan="7" className="text-center py-5 text-muted">No reports found for review.</td></tr>
                            )}
                                </tbody>
                                </table>

                                {/* Pagination */}
                              
                                {!loading && filteredComplaints.length > 0 && (
                                    <div className="d-flex align-items-center justify-content-between mt-3 mb-4">
                                        <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredComplaints.length)} of {filteredComplaints.length} entries
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

            {/* Detailed Action Modal */}
            <Modal show={showModal} onHide={() => setShowModal(false)} size="xl" centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        Resolution Breakdown: <span className="text-primary">{selectedComplaint?.title}</span>
                        <small className="text-muted ms-2 fs-6">CMP-{selectedComplaint?.id}</small>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="table-responsive">
                        <table className="table table-responsive-md history-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '60px' }}><strong>SL NO.</strong></th>
                                    <th><strong>POSITIVE POINTS</strong></th>
                                    <th><strong>NEGATIVE POINTS</strong></th>
                                    <th><strong>TARGET DEPARTMENT</strong></th>
                                    <th><strong>VOTE</strong></th>
                                    <th><strong>DESCRIPTION</strong></th>
                                    <th><strong>DOCUMENT</strong></th>
                                    <th><strong>CREATED BY</strong></th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedComplaint?.actions && selectedComplaint.actions.length > 0 ? (
                                    selectedComplaint.actions.map((action, index) => (
                                        <tr key={action.id}>
                                            <td><strong>{index + 1}</strong></td>
                                            <td className="text-success">{action.positive_feedback || '-'}</td>
                                            <td className="text-danger">{action.negative_feedback || '-'}</td>
                                            <td>{selectedComplaint.category_name}</td>
                                            <td>
                                                <span className={`badge light badge-${
                                                    action.decision === 'YES' ? 'success' : 
                                                    action.decision === 'NO' ? 'danger' : 'info'
                                                }`}>
                                                    {action.decision || 'NEUTRAL'}
                                                </span>
                                            </td>
                                            <td>{action.notes || '-'}</td>
                                            <td>
                                                {action.supporting_document ? (
                                                    <a href={action.supporting_document} target="_blank" rel="noopener noreferrer" className="text-primary text-decoration-none fw-bold">
                                                        <i className="fa fa-file-pdf-o me-1"></i> View
                                                    </a>
                                                ) : '-'}
                                            </td>
                                            <td>
                                                <strong>
                                                    {action.created_by_details 
                                                        ? `${action.created_by_details.first_name} ${action.created_by_details.last_name || ''}` 
                                                        : 'System'}
                                                </strong>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="text-center py-4 text-muted">No individual actions logged for this complaint yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button 
                        style={{ backgroundColor: '#0a500f', borderColor: '#0a500f', color: 'white', borderRadius: '8px', padding: '10px 24px', fontWeight: 500 }} 
                        onClick={() => setShowModal(false)}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#073d0b'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0a500f'}
                    >
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
            </div>
        </Fragment>
    );
};

export default AdminReviewList;
