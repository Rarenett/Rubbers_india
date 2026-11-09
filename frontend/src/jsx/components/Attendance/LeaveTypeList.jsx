import React, { useState, useEffect, Fragment } from 'react';
import { Card, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getLeaveTypes,
    deleteLeaveType
} from '../../../services/AttendanceService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import LeaveTypeFormModal from './LeaveTypeFormModal';

const LeaveTypeList = () => {
    const [leaveTypes, setLeaveTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const { can } = usePermission();

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentLeave, setCurrentLeave] = useState({
        id: null,
        name: '',
        code: '',
        is_paid: true,
        annual_limit: 0,
        is_cumulative: false,
        max_limit: 0,
        can_surrender: false,
        apply_before_days: 0,
        is_active: true
    });

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getLeaveTypes();
            const list = Array.isArray(data) ? data : (data.results || []);
            setLeaveTypes(list);
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch data'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (item = null) => {
        if (item) {
            setCurrentLeave({
                ...item,
                name: item.name || '',
                code: item.code || '',
                need_approval: item.need_approval ?? true,
            });
            setEditMode(true);
        } else {
            setCurrentLeave({
                id: null,
                name: '',
                code: '',
                is_paid: true,
                annual_limit: 0,
                is_cumulative: false,
                max_limit: 0,
                can_surrender: false,
                apply_before_days: 0,
                need_approval: true,
                is_active: true
            });
            setEditMode(false);
        }
        setShowModal(true);
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Leave Type?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteLeaveType(id);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted',
                    text: 'Leave type deleted successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
                fetchData();
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to delete leave type'
                });
            }
        }
    };

    const filteredLeaveTypes = leaveTypes
        .filter(item =>
            (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.code || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentLeaveTypes = filteredLeaveTypes.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredLeaveTypes.length / itemsPerPage);

    return (
        <div className="container-fluid">
            <style>{`
                .search-input-custom {
                    height: 38px !important;
                    border-radius: 6px !important;
                    padding-left: 35px !important;
                    font-size: 13px !important;
                }
            `}</style>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title className="mb-0">Leave Types Management</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Leave Type..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="search-input-custom"
                                    />
                                </div>
                                <CreateButton
                                    module="leavetype"
                                    onClick={() => handleShowModal()}
                                >
                                    Leave Type
                                </CreateButton>
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
                                <div>
                                    {filteredLeaveTypes.length === 0 ? (
                                        <div className="text-center py-4 text-muted">No entries</div>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table table-responsive-md">
                                                <thead>
                                                    <tr>
                                                        <th><strong>SL NO</strong></th>
                                                        <th><strong>CODE</strong></th>
                                                        <th><strong>NAME</strong></th>
                                                        <th><strong>PAY TYPE</strong></th>
                                                        <th><strong>ANNUAL LIMIT</strong></th>
                                                        <th><strong>CUMULATIVE</strong></th>
                                                        <th><strong>SURRENDER</strong></th>
                                                        <th><strong>APPLY BEFORE</strong></th>
                                                        <th><strong>NEED APPROVAL</strong></th>
                                                        <th><strong>STATUS</strong></th>
                                                        <th className="text-end"><strong>ACTIONS</strong></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {currentLeaveTypes.map((item, index) => (
                                                        <tr key={item.id}>
                                                            <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                            <td>
                                                                <span className="badge light badge-primary">
                                                                    {item.code}
                                                                </span>
                                                            </td>
                                                            <td><strong>{item.name}</strong></td>
                                                            <td>
                                                                <span className={`badge light badge-${item.is_paid ? 'success' : 'warning'}`}>
                                                                    {item.is_paid ? 'Paid' : 'Unpaid (LOP)'}
                                                                </span>
                                                            </td>
                                                            <td>{parseFloat(item.annual_limit || 0).toFixed(2)} days</td>
                                                            <td>
                                                                {item.is_cumulative ? (
                                                                    <span>Yes {item.max_limit > 0 ? `(Max: ${item.max_limit})` : ''}</span>
                                                                ) : (
                                                                    <span className="text-muted">No</span>
                                                                )}
                                                            </td>
                                                            <td>{item.can_surrender ? 'Yes' : 'No'}</td>
                                                            <td>{item.apply_before_days > 0 ? `${item.apply_before_days} days` : 'Immediate'}</td>
                                                            <td>
                                                                <span className={`badge light badge-${item.need_approval !== false ? 'info' : 'secondary'}`}>
                                                                    {item.need_approval !== false ? 'Yes' : 'No'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className={`badge light badge-${item.is_active ? 'success' : 'danger'}`}>
                                                                    {item.is_active ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end gap-1">
                                                                    <EditButton
                                                                        module="leavetype"
                                                                        onClick={() => handleShowModal(item)}
                                                                    />
                                                                    <DeleteButton
                                                                        module="leavetype"
                                                                        onClick={() => handleDelete(item.id, item.name)}
                                                                    />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {filteredLeaveTypes.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredLeaveTypes.length)} of {filteredLeaveTypes.length} entries
                                            </div>
                                            {totalPages > 1 && (
                                                <nav>
                                                    <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                        <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                            <button
                                                                type="button"
                                                                className="page-link"
                                                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                                disabled={currentPage === 1}
                                                                style={{ border: 'none', background: 'none' }}
                                                            >
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
                                                                        <button
                                                                            type="button"
                                                                            className="page-link"
                                                                            onClick={() => setCurrentPage(pageNumber)}
                                                                            style={{ border: 'none' }}
                                                                        >
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
                                                            <button
                                                                type="button"
                                                                className="page-link"
                                                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                                                disabled={currentPage === totalPages}
                                                                style={{ border: 'none', background: 'none' }}
                                                            >
                                                                <i className="la la-angle-right" />
                                                            </button>
                                                        </li>
                                                    </ul>
                                                </nav>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Leave Type Modal */}
            <LeaveTypeFormModal
                show={showModal}
                onHide={() => setShowModal(false)}
                onSuccess={fetchData}
                editMode={editMode}
                leaveType={currentLeave}
            />
        </div>
    );
};

export default LeaveTypeList;
