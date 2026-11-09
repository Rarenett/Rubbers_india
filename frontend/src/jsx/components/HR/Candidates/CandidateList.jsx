import React, { useState, useEffect, Fragment, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Table, Badge, Dropdown, Form, Button } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { getCandidates, deleteCandidate, selectCandidate } from '../../../../services/HRManagementService';
import { usePermission } from '../../../../hooks/usePermission';
import CreateButton from '../../../../components/permissions/CreateButton';
import EditButton from '../../../../components/permissions/EditButton';
import DeleteButton from '../../../../components/permissions/DeleteButton';
import CandidateFormModal from './CandidateFormModal';
import CandidateDetailModal from './CandidateDetailModal';

const CandidateList = () => {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewId, setViewId] = useState(null);
    const [filterStatus, setFilterStatus] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const { can } = usePermission();
    const navigate = useNavigate();

    // Fetch candidates
    const fetchCandidatesList = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getCandidates(filterStatus || null);
            setCandidates(data);
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch candidates',
            });
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => {
        fetchCandidatesList();
    }, [fetchCandidatesList]);

    // Handle candidate selection
    const handleSelectCandidate = async (id, name) => {
        const result = await Swal.fire({
            title: 'Select Candidate?',
            text: `Are you sure you want to mark "${name}" as Selected?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, select candidate'
        });

        if (result.isConfirmed) {
            try {
                await selectCandidate(id);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Candidate marked as selected successfully',
                    timer: 2000
                });
                fetchCandidatesList();
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.response?.data?.message || 'Failed to select candidate',
                });
            }
        }
    };

    // Handle delete
    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Candidate?',
            text: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteCandidate(id);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted',
                    text: 'Candidate deleted successfully',
                    timer: 2000
                });
                fetchCandidatesList();
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to delete candidate',
                });
            }
        }
    };

    // Get status badge
    const getStatusBadge = (status) => {
        const badgeMap = {
            'Pending': 'warning',
            'Selected': 'success',
            'Rejected': 'danger',
            'Waitlisted': 'info',
            'Resigned': 'secondary'
        };
        return <Badge bg={badgeMap[status] || 'secondary'}>{status}</Badge>;
    };

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Filter candidates by search term
    const filteredCandidates = candidates.filter(candidate =>
        candidate.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.position_applied_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Reset to page 1 on filter/search change
    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus]);

    // Paginated slice
    const totalPages = Math.ceil(filteredCandidates.length / ITEMS_PER_PAGE);
    const indexOfLast = currentPage * ITEMS_PER_PAGE;
    const indexOfFirst = indexOfLast - ITEMS_PER_PAGE;
    const currentCandidates = filteredCandidates.slice(indexOfFirst, indexOfLast);

    return (
        <div className="container-fluid">

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title className="mb-0">Candidate List</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search candidate..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <Form.Select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    style={{ width: '140px', height: '38px', borderRadius: '6px', fontSize: '13px' }}
                                >
                                    <option value="">All Status</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Selected">Selected</option>
                                    <option value="Rejected">Rejected</option>
                                    <option value="Waitlisted">Waitlisted</option>
                                    <option value="Resigned">Resigned</option>
                                </Form.Select>
                                <CreateButton
                                    module="candidates"
                                    onClick={() => { setEditId(null); setShowModal(true); }}
                                    className="d-flex align-items-center justify-content-center"
                                    style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px' }}
                                >
                                    Candidate
                                </CreateButton>
                                <Button
                                    variant="primary"
                                    onClick={() => navigate('/hr/schedule-interview')}
                                    className="d-flex align-items-center justify-content-center"
                                    style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px', fontSize: '13px' }}
                                >
                                    <i className="fa fa-calendar me-2"></i> Schedule Interviews
                                </Button>
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
                                    <Table hover responsive className="mb-0">
                                        <thead>
                                            <tr>
                                                <th>SL No</th>
                                                <th>Name</th>
                                                <th>Email</th>
                                                <th>Department Applied</th>
                                                <th>Position Applied</th>
                                                <th>Status</th>
                                                <th>Interview Date</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentCandidates.length === 0 ? (
                                                <tr>
                                                    <td colSpan="8" className="text-center py-4">
                                                        No candidates found
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentCandidates.map((candidate, index) => (
                                                    <tr key={candidate.id}>
                                                        <td>{indexOfFirst + index + 1}</td>
                                                        <td>
                                                            <strong>{candidate.full_name}</strong>
                                                            <br />
                                                            <small className="text-muted">
                                                                {candidate.experience_years} yrs exp
                                                            </small>
                                                        </td>
                                                        <td>{candidate.email}</td>
                                                        <td>{candidate.department_applied_name || candidate.department_applied || '-'}</td>
                                                        <td>{candidate.position_applied_name || '-'}</td>
                                                        <td>{getStatusBadge(candidate.status)}</td>
                                                        <td>
                                                            {candidate.interview_date
                                                                ? new Date(candidate.interview_date).toLocaleDateString()
                                                                : '-'}
                                                        </td>
                                                        <td>
                                                            {can('candidates', 'view') || can('candidates', 'edit') || (candidate.status === 'Pending' && can('candidates', 'approve')) || can('candidates', 'delete') ? (
                                                                <div className="d-flex justify-content-end gap-1">
                                                                    {can('candidates', 'view') && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => { setViewId(candidate.id); setShowViewModal(true); }}
                                                                            className="btn btn-sm btn-outline-info shadow"
                                                                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                            title="View Details"
                                                                        >
                                                                            <i className="fa fa-eye"></i>
                                                                        </button>
                                                                    )}
                                                                    {can('candidates', 'edit') && (
                                                                        <EditButton
                                                                            module="candidates"
                                                                            onClick={() => { setEditId(candidate.id); setShowModal(true); }}
                                                                            title="Edit"
                                                                        />
                                                                    )}
                                                                    {can('candidates', 'delete') && (
                                                                        <DeleteButton
                                                                            module="candidates"
                                                                            onClick={() => handleDelete(candidate.id, candidate.full_name)}
                                                                            title="Delete"
                                                                        />
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="badge badge-danger light">No Access</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </Table>
                                </div>
                            )}

                            {/* Pagination — matches StockItemList / EmployeeList pattern */}
                            {!loading && filteredCandidates.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirst + 1} to {Math.min(indexOfLast, filteredCandidates.length)} of {filteredCandidates.length} entries
                                    </div>
                                    {totalPages > 1 && (
                                        <nav>
                                            <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                        <i className="la la-angle-left" />
                                                    </button>
                                                </li>
                                                {Array.from({ length: totalPages }, (_, i) => {
                                                    const page = i + 1;
                                                    if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                                                        return (
                                                            <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                                                                <button type="button" className="page-link" onClick={() => setCurrentPage(page)} style={{ border: 'none' }}>{page}</button>
                                                            </li>
                                                        );
                                                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                                                        return (
                                                            <li key={page} className="page-item disabled">
                                                                <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                            </li>
                                                        );
                                                    }
                                                    return null;
                                                })}
                                                <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
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

            <CandidateFormModal
                show={showModal}
                onHide={() => {
                    setShowModal(false);
                    setEditId(null);
                }}
                onSave={() => {
                    setShowModal(false);
                    setEditId(null);
                    fetchCandidatesList();
                }}
                editId={editId}
            />

            <CandidateDetailModal
                show={showViewModal}
                onHide={() => {
                    setShowViewModal(false);
                    setViewId(null);
                }}
                viewId={viewId}
            />
        </div>
    );
};

export default CandidateList;
