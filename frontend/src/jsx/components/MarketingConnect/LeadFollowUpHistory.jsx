import React, { useState, useEffect, Fragment } from 'react';
import { Row, Col, Card, Modal, Button, Form } from 'react-bootstrap';
import axiosInstance from '../../../services/axiosInstance';
import swal from 'sweetalert';

const DEFAULT_PURPOSES = [
    'New Lead',
    'Contacted',
    'Qualified',
    'Meeting',
    'Proposal/Quotation',
    'Negotiation',
    'Won',
    'Lost'
];

const LeadFollowUpHistory = () => {
    const [followups, setFollowups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [purposeOptions, setPurposeOptions] = useState(DEFAULT_PURPOSES);

    const fetchPurposes = async () => {
        try {
            let res;
            try {
                res = await axiosInstance.get('/api/crm_new/purposes/');
            } catch {
                res = await axiosInstance.get('/api/crm/purposes/');
            }
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            const apiNames = data.map(p => p.name).filter(Boolean);
            const combined = Array.from(new Set([...DEFAULT_PURPOSES, ...apiNames]));
            setPurposeOptions(combined);
        } catch {
            setPurposeOptions(DEFAULT_PURPOSES);
        }
    };

    useEffect(() => {
        fetchPurposes();
    }, []);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const url = search ? `/api/crm_new/followups/history/?search=${search}` : '/api/crm_new/followups/history/';
            const response = await axiosInstance.get(url);
            if (response.data.results) {
                setFollowups(response.data.results);
            } else {
                setFollowups(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch follow-up history:", error);
            swal("Error", "Could not fetch history data", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [search]);

    const handleSearchChange = (e) => {
        setSearch(e.target.value);
        setCurrentPage(1);
    };

    const handleEditClick = (followup) => {
        setEditForm({
            id: followup.id,
            visit_date: followup.visit_date ? followup.visit_date.split('T')[0] : '',
            purpose: followup.purpose || '',
            status: followup.status || 'Active',
            next_visit_date: followup.next_visit_date ? followup.next_visit_date.split('T')[0] : '',
            remarks: followup.remarks || ''
        });
        setShowEditModal(true);
    };

    const handleEditChange = (e) => {
        setEditForm({ ...editForm, [e.target.name]: e.target.value });
    };

    const submitEdit = async () => {
        setIsSaving(true);
        try {
            const payload = {
                visit_date: editForm.visit_date || null,
                purpose: editForm.purpose,
                status: editForm.status,
                next_visit_date: editForm.next_visit_date || null,
                remarks: editForm.remarks
            };
            await axiosInstance.patch(`/api/crm_new/followups/${editForm.id}/`, payload);
            swal("Success", "Follow-up updated successfully", "success");
            setShowEditModal(false);
            fetchHistory(); // refresh the list
        } catch (error) {
            console.error("Failed to update follow-up:", error);
            swal("Error", "Could not update follow-up", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = followups.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(followups.length / itemsPerPage);

    return (
        <div className="container-fluid p-0">
            <div className="card-header border-0 pb-0 d-flex justify-content-between align-items-center flex-wrap" style={{ gap: '15px', paddingLeft: 0, paddingRight: 0 }}>
                <div className="d-flex align-items-center" style={{ gap: '15px' }}>
                    <div>
                        <h4 className="card-title mb-1" style={{ fontSize: '1.25rem', fontWeight: '600' }}>Follow-Up History</h4>
                        <p className="mb-0 text-muted" style={{ fontSize: '13px' }}>View all follow-up records</p>
                    </div>
                </div>
                
                <div className="d-flex align-items-center flex-wrap" style={{ gap: '12px' }}>
                    <div className="input-group search-area" style={{ width: '250px', border: '1px solid #e2e2e2', borderRadius: '6px', backgroundColor: '#f9f9fc', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                        <span className="input-group-text" style={{ background: 'transparent', border: 'none', padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="fa fa-search" style={{ color: '#5682b4', fontSize: '14px', fontWeight: 'bold' }}></i>
                        </span>
                        <input 
                            type="text" 
                            className="form-control" 
                            placeholder="Search by ID, Name or Purpose..." 
                            value={search}
                            onChange={handleSearchChange}
                            style={{ height: '38px', border: 'none', background: 'transparent', padding: '0', boxShadow: 'none', color: '#5682b4', fontSize: '14px' }}
                        />
                    </div>
                </div>
            </div>
            
            <div className="card-body px-0">
                <div className="table-responsive">
                    <table className="table w-100 align-middle">
                        <thead>
                            <tr>
                                <th style={{width: '50px'}}><strong>Sl No</strong></th>
                                <th><strong>Visit Date</strong></th>
                                <th><strong>Shop Name</strong></th>
                                <th><strong>Location</strong></th>
                                <th><strong>Purpose</strong></th>
                                <th><strong>Status</strong></th>
                                <th><strong>Next Visit Date</strong></th>
                                <th><strong>Remarks</strong></th>
                                <th className="text-center"><strong>Photo</strong></th>
                                <th className="text-center"><strong>Actions</strong></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="9" className="text-center py-4"><div className="spinner-border text-primary" role="status"></div></td></tr>
                            ) : followups.length === 0 ? (
                                <tr><td colSpan="9" className="text-center py-4 text-muted">No follow-ups found.</td></tr>
                            ) : (
                                currentItems.map((followup, index) => (
                                    <tr key={followup.id}>
                                        <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                        <td>{followup.visit_date ? new Date(followup.visit_date).toLocaleDateString('en-GB') : '-'}</td>
                                        <td>
                                            <span className="d-block fw-bold text-primary">{followup.shop_name || '-'}</span>
                                            {followup.lead_id && <small className="text-muted">#{followup.lead_id}</small>}
                                        </td>
                                        <td>
                                            {followup.location ? (
                                                <span className="text-dark">{followup.location}</span>
                                            ) : (
                                                <span className="text-muted"><small>-</small></span>
                                            )}
                                        </td>
                                        <td>{followup.purpose || '-'}</td>
                                        <td>
                                            <span className={`badge ${followup.status === 'Escalated' ? 'badge-danger light' : followup.status === 'Active' ? 'badge-success light' : 'badge-warning light'}`}>
                                                {followup.status || '-'}
                                            </span>
                                        </td>
                                        <td>{followup.next_visit_date ? new Date(followup.next_visit_date).toLocaleDateString('en-GB') : '-'}</td>
                                        <td>
                                            <span title={followup.remarks} style={{ cursor: 'pointer', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>
                                                {followup.remarks || '-'}
                                            </span>
                                        </td>
                                        <td className="text-center">
                                            {followup.photo ? (
                                                <a href={followup.photo} target="_blank" rel="noopener noreferrer">
                                                    <img src={followup.photo} alt="Shop" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                                                </a>
                                            ) : (
                                                <span className="text-muted">-</span>
                                            )}
                                        </td>
                                        <td className="text-center">
                                            <button 
                                                className="btn btn-outline-success shadow btn-xs sharp mx-auto"
                                                onClick={() => handleEditClick(followup)} 
                                                title="Edit Follow-Up"
                                            >
                                                <i className="fas fa-pencil-alt"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {followups.length > 0 && (
                    <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap">
                        <div className="text-muted" style={{ fontSize: '13px' }}>
                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, followups.length)} of {followups.length} entries
                        </div>
                        {totalPages > 1 && (
                            <nav>
                                <ul className="pagination pagination-gutter pagination-success no-bg mb-0">
                                    <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                        <button className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>
                                            <i className="la la-angle-left"></i>
                                        </button>
                                    </li>
                                    {Array.from({ length: totalPages }, (_, i) => {
                                        const pageNumber = i + 1;
                                        if (
                                            pageNumber === 1 ||
                                            pageNumber === totalPages ||
                                            (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                        ) {
                                            return (
                                                <li key={pageNumber} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}>
                                                    <button className="page-link" onClick={() => setCurrentPage(pageNumber)}>{pageNumber}</button>
                                                </li>
                                            );
                                        } else if (
                                            pageNumber === currentPage - 2 ||
                                            pageNumber === currentPage + 2
                                        ) {
                                            return <li key={pageNumber} className="page-item disabled"><span className="page-link">...</span></li>;
                                        }
                                        return null;
                                    })}
                                    <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                        <button className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}>
                                            <i className="la la-angle-right"></i>
                                        </button>
                                    </li>
                                </ul>
                            </nav>
                        )}
                    </div>
                )}
            </div>

            {/* Edit Follow-Up Modal */}
            <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Edit Follow-Up</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {editForm && (
                        <Form>
                            <Form.Group className="mb-3">
                                <Form.Label className="font-w600">Visit Date</Form.Label>
                                <Form.Control type="date" name="visit_date" value={editForm.visit_date} onChange={handleEditChange} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label className="font-w600">Purpose</Form.Label>
                                <Form.Select name="purpose" value={editForm.purpose} onChange={handleEditChange}>
                                    <option value="">-- Select Purpose --</option>
                                    {purposeOptions.map((opt, idx) => (
                                        <option key={idx} value={opt}>{opt}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label className="font-w600">Status</Form.Label>
                                <Form.Select name="status" value={editForm.status} onChange={handleEditChange}>
                                    <option value="Active">Active</option>
                                    <option value="Working On Lead">Working On Lead</option>
                                    <option value="Escalated">Escalated</option>
                                </Form.Select>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label className="font-w600">Next Visit Date</Form.Label>
                                <Form.Control type="date" name="next_visit_date" value={editForm.next_visit_date} onChange={handleEditChange} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label className="font-w600">Remarks</Form.Label>
                                <Form.Control as="textarea" rows={3} name="remarks" value={editForm.remarks} onChange={handleEditChange} />
                            </Form.Group>
                        </Form>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="danger light" onClick={() => setShowEditModal(false)}>Close</Button>
                    <Button variant="primary" onClick={submitEdit} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default LeadFollowUpHistory;
