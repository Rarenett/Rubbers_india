import React, { useState, useEffect, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Form, Button, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getLeaveRequests,
    getReceivedLeaveRequests,
    deleteLeaveRequest
} from '../../../services/AttendanceService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import LeaveRequestFormModal from './LeaveRequestFormModal';
import LeaveRequestDetailModal from './LeaveRequestDetailModal';
import LeaveRequestReviewModal from './LeaveRequestReviewModal';
import LeaveRequestForwardModal from './LeaveRequestForwardModal';
import EmployeeLeaveHistoryModal from './EmployeeLeaveHistoryModal';

const STATUS_BADGE_MAP = {
    PENDING: 'warning',
    FORWARDED: 'info',
    APPROVED: 'success',
    PARTIALLY_APPROVED: 'primary',
    REJECTED: 'danger',
    CANCELLED: 'secondary',
    ACCEPTED: 'primary',
    DECLINED: 'dark',
};

const formatDays = (days) => {
    const num = parseFloat(days || 0);
    return `${num} day${num === 1 ? '' : 's'}`;
};

const formatDateDMY = (dateStr) => {
    if (!dateStr) return '';
    try {
        const clean = String(dateStr).split('T')[0];
        const parts = clean.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            const [y, m, d] = parts;
            return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
        }
        return dateStr;
    } catch {
        return dateStr;
    }
};

const LeaveRequestList = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get('tab');
    const initialTab = (tabParam === 'received_requests' || tabParam === 'received') ? 'received_requests' : 'my_requests';

    const [requests, setRequests] = useState([]);
    const [receivedRequests, setReceivedRequests] = useState([]);
    const [activeTab, setActiveTab] = useState(initialTab); // 'my_requests' | 'received_requests'
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState(initialTab === 'received_requests' ? 'PENDING' : 'ALL');
    const [decisionFilter, setDecisionFilter] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const { can } = usePermission();

    const handleTabChange = (newTab) => {
        if (activeTab === newTab) return;
        setActiveTab(newTab);
        setStatusFilter(newTab === 'received_requests' ? 'PENDING' : 'ALL');
        setDecisionFilter('ALL');
        setSearchTerm('');
        if (newTab === 'received_requests') {
            setSearchParams({ tab: 'received_requests' });
        } else {
            setSearchParams({});
        }
    };

    const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
    const loggedInUser = userDetails?.user || userDetails;
    const isSuperuser = Boolean(loggedInUser?.is_superuser);

    // Modal states
    const [showFormModal, setShowFormModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentRequest, setCurrentRequest] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewingRequest, setReviewingRequest] = useState(null);
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [forwardingRequest, setForwardingRequest] = useState(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyRequest, setHistoryRequest] = useState(null);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, decisionFilter, activeTab]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [myReqsData, recData] = await Promise.all([
                getLeaveRequests(),
                getReceivedLeaveRequests().catch(() => [])
            ]);
            const myList = Array.isArray(myReqsData) ? myReqsData : (myReqsData.results || []);
            const recList = Array.isArray(recData) ? recData : (recData.results || []);
            setRequests(myList);
            setReceivedRequests(recList);

            if (recList.length === 0 && activeTab === 'received_requests') {
                setActiveTab('my_requests');
                setStatusFilter('ALL');
                setSearchParams({});
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch leave requests'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleShowCreate = () => {
        setCurrentRequest(null);
        setEditMode(false);
        setShowFormModal(true);
    };

    const handleShowEdit = (item) => {
        setCurrentRequest(item);
        setEditMode(true);
        setShowFormModal(true);
    };

    const handleViewDetail = (item) => {
        setSelectedRequest(item);
        setShowDetailModal(true);
    };

    const handleOpenReview = (item) => {
        setReviewingRequest(item);
        setShowReviewModal(true);
    };

    const handleOpenForward = (item) => {
        setForwardingRequest(item);
        setShowForwardModal(true);
    };

    const handleOpenHistory = (item) => {
        setHistoryRequest(item);
        setShowHistoryModal(true);
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Delete Leave Request?',
            text: 'Are you sure you want to delete this leave request?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteLeaveRequest(id);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted',
                    text: 'Leave request deleted successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
                fetchData();
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to delete leave request'
                });
            }
        }
    };

    const hasReceivedTab = receivedRequests.length > 0;
    const pendingReceivedCount = receivedRequests.filter((r) =>
        ['PENDING', 'FORWARDED'].includes(r.status)
    ).length;
    const currentList = activeTab === 'received_requests' ? receivedRequests : requests;

    const filteredRequests = currentList.filter((item) => {
        const matchesSearch =
            (item.employee_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.leave_type_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.reason || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;

        let matchesDecision = true;
        if (decisionFilter === 'ACCEPTED') {
            matchesDecision = item.employee_decision === 'ACCEPTED';
        } else if (decisionFilter === 'DECLINED') {
            matchesDecision = item.employee_decision === 'DECLINED';
        } else if (decisionFilter === 'AWAITING') {
            matchesDecision = ['APPROVED', 'PARTIALLY_APPROVED'].includes(item.status) &&
                (!item.employee_decision || item.employee_decision === 'PENDING');
        } else if (decisionFilter === 'CANCELLED') {
            matchesDecision = item.status === 'CANCELLED' || item.employee_decision === 'CANCELLED';
        }

        return matchesSearch && matchesStatus && matchesDecision;
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentRequests = filteredRequests.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);

    return (
        <div className="container-fluid">
            <style>{`
                .search-input-custom {
                    height: 38px !important;
                    border-radius: 6px !important;
                    padding-left: 35px !important;
                    font-size: 13px !important;
                }
                .filter-select-custom {
                    height: 38px !important;
                    border-radius: 6px !important;
                    font-size: 13px !important;
                }
                .tab-nav-btn {
                    background: transparent;
                    border: none;
                    font-size: 14px;
                    font-weight: 600;
                    padding: 10px 18px;
                    color: #64748b;
                    border-bottom: 2px solid transparent;
                    transition: all 0.2s ease;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                }
                .tab-nav-btn:hover {
                    color: #7A70BA;
                }
                .tab-nav-btn.active {
                    color: #7A70BA;
                    border-bottom: 2px solid #7A70BA;
                }
                .leave-requests-card {
                    height: auto !important;
                }
            `}</style>

            <div className="row">
                <div className="col-lg-12">
                    {/* Conditionally Display Received Requests Tab if there is at least one received request */}
                    {hasReceivedTab && (
                        <div className="d-flex align-items-center mb-3 bg-white p-2 px-3 rounded shadow-sm gap-2">
                            <button
                                type="button"
                                className={`tab-nav-btn ${activeTab === 'my_requests' ? 'active' : ''}`}
                                onClick={() => handleTabChange('my_requests')}
                            >
                                <i className="fa fa-user me-2"></i>
                                {isSuperuser ? 'All Leave Requests' : 'My Leave Requests'}
                                <Badge bg="secondary" className="ms-2 light">{requests.length}</Badge>
                            </button>

                            <button
                                type="button"
                                className={`tab-nav-btn ${activeTab === 'received_requests' ? 'active' : ''}`}
                                onClick={() => handleTabChange('received_requests')}
                            >
                                <i className="fa fa-inbox me-2"></i>
                                Received Requests
                                <Badge bg={pendingReceivedCount > 0 ? "danger" : "secondary"} className="ms-2">
                                    {pendingReceivedCount}
                                </Badge>
                            </button>
                        </div>
                    )}

                    <Card className="leave-requests-card" style={{ height: 'auto' }}>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <div>
                                <div className="d-flex align-items-center gap-2">
                                    <Card.Title className="mb-0">
                                        {activeTab === 'received_requests'
                                            ? 'Received Leave Requests'
                                            : isSuperuser
                                            ? 'Leave Requests Management'
                                            : 'My Leave Requests'}
                                    </Card.Title>
                                    
                                </div>
                                <small className="text-muted">
                                    {activeTab === 'received_requests'
                                        ? 'Leave requests submitted to you as reporting manager or forwarded for your decision'
                                        : isSuperuser
                                        ? 'Showing leave requests submitted by all employees'
                                        : 'Showing only your submitted leave requests'}
                                </small>
                            </div>

                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <Form.Select
                                    className="filter-select-custom"
                                    style={{ width: '160px' }}
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <option value="ALL">All Statuses</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="FORWARDED">Forwarded</option>
                                    <option value="APPROVED">Approved</option>
                                    <option value="PARTIALLY_APPROVED">Partially Approved</option>
                                    <option value="REJECTED">Rejected</option>
                                    <option value="CANCELLED">Cancelled</option>
                                </Form.Select>

                                <Form.Select
                                    className="filter-select-custom"
                                    style={{ width: '170px' }}
                                    value={decisionFilter}
                                    onChange={(e) => setDecisionFilter(e.target.value)}
                                >
                                    <option value="ALL">All Decisions</option>
                                    <option value="ACCEPTED">Accepted</option>
                                    <option value="DECLINED">Declined</option>
                                    <option value="AWAITING">Awaiting Decision</option>
                                    <option value="CANCELLED">Cancelled</option>
                                </Form.Select>

                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder={activeTab === 'received_requests' || isSuperuser ? "Search by employee, leave type, reason..." : "Search by leave type, reason..."}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="search-input-custom"
                                    />
                                </div>

                                {activeTab === 'my_requests' && (
                                    isSuperuser ? (
                                        <CreateButton
                                            module="reqs"
                                            onClick={handleShowCreate}
                                        >
                                            Leave Request
                                        </CreateButton>
                                    ) : (
                                        <Button
                                            variant="primary"
                                            onClick={handleShowCreate}
                                            style={{
                                                backgroundColor: 'rgb(61, 53, 119)',
                                                borderColor: 'rgb(61, 53, 119)',
                                                color: 'white',
                                                height: '34px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                fontSize: '13px'
                                            }}
                                        >
                                            <i className="fa fa-plus me-1"></i> Apply Leave
                                        </Button>
                                    )
                                )}
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
                                    {filteredRequests.length === 0 ? (
                                        <div className="text-center py-4 text-muted">
                                            {activeTab === 'received_requests'
                                                ? 'No received requests pending your action'
                                                : isSuperuser
                                                ? 'No leave requests found'
                                                : 'You have not submitted any leave requests yet'}
                                        </div>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table table-responsive-md">
                                                <thead>
                                                    <tr>
                                                        <th><strong>SL NO</strong></th>
                                                        <th><strong>{activeTab === 'received_requests' ? 'APPLICANT' : 'EMPLOYEE'}</strong></th>
                                                        <th><strong>LEAVE TYPE</strong></th>
                                                        <th><strong>DATES & DURATION</strong></th>
                                                        <th><strong>REASON</strong></th>
                                                        <th><strong>STATUS</strong></th>
                                                        <th><strong>EMPLOYEE STATUS</strong></th>
                                                        <th><strong>{activeTab === 'received_requests' ? 'RECEIVED AT' : 'APPLIED AT'}</strong></th>
                                                        <th className="text-end"><strong>ACTIONS</strong></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {currentRequests.map((item, index) => (
                                                        <tr key={item.id}>
                                                            <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                            <td>
                                                                <div className="fw-bold text-dark">{item.employee_name}</div>
                                                                {item.employee_department && (
                                                                    <small className="text-muted">{item.employee_department}</small>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <strong>{item.leave_type_name}</strong>
                                                            </td>
                                                            <td>
                                                                <span className="fw-bold text-dark">
                                                                    {formatDays(item.total_days)}
                                                                </span>
                                                                {item.leave_dates && item.leave_dates.length > 0 && (
                                                                    <div className="text-muted fs-12 mt-1">
                                                                        {formatDateDMY(item.leave_dates[0].date)}
                                                                        {item.leave_dates.length > 1 && ` to ${formatDateDMY(item.leave_dates[item.leave_dates.length - 1].date)}`}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <div
                                                                    style={{
                                                                        maxWidth: '220px',
                                                                        whiteSpace: 'nowrap',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis'
                                                                    }}
                                                                    title={item.reason}
                                                                >
                                                                    {item.reason}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <span className={`badge light badge-${STATUS_BADGE_MAP[item.status] || 'secondary'}`}>
                                                                    {item.status === 'PARTIALLY_APPROVED' ? 'PARTIALLY APPROVED' : item.status}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {item.status === 'CANCELLED' || item.employee_decision === 'CANCELLED' ? (
                                                                    <span className="badge light badge-secondary" style={{ fontSize: '11px', padding: '2px 8px' }}>
                                                                        <i className="fa fa-ban me-1"></i>Cancelled
                                                                    </span>
                                                                ) : ['APPROVED', 'PARTIALLY_APPROVED'].includes(item.status) ? (
                                                                    item.employee_decision === 'ACCEPTED' ? (
                                                                        <span className="badge light badge-success" style={{ fontSize: '11px', padding: '2px 8px' }}>
                                                                            <i className="fa fa-check me-1"></i>Accepted
                                                                        </span>
                                                                    ) : item.employee_decision === 'DECLINED' ? (
                                                                        <span className="badge light badge-danger" style={{ fontSize: '11px', padding: '2px 8px' }}>
                                                                            <i className="fa fa-times me-1"></i>Declined
                                                                        </span>
                                                                    ) : (
                                                                        <span className="badge light badge-warning" style={{ fontSize: '11px', padding: '2px 8px' }}>
                                                                            <i className="fa fa-clock me-1"></i>Awaiting Decision
                                                                        </span>
                                                                    )
                                                                ) : (
                                                                    <span className="text-muted">—</span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <span className="text-muted fs-13">
                                                                    {new Date(item.created_at).toLocaleDateString()}
                                                                </span>
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end gap-1">
                                                                    {/* View Detail button */}
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-info shadow"
                                                                        style={{
                                                                            width: '28px',
                                                                            height: '28px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            padding: '0',
                                                                            fontSize: '12px',
                                                                            borderRadius: '6px'
                                                                        }}
                                                                        onClick={() => handleViewDetail(item)}
                                                                        title="View Request Details"
                                                                    >
                                                                        <i className="fa fa-eye"></i>
                                                                    </button>

                                                                    {activeTab === 'received_requests' && (
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-sm btn-outline-info shadow"
                                                                            style={{
                                                                                width: '28px',
                                                                                height: '28px',
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                padding: '0',
                                                                                fontSize: '12px',
                                                                                borderRadius: '6px'
                                                                            }}
                                                                            onClick={() => handleOpenHistory(item)}
                                                                            title="View Employee Leave History & Remaining Quotas"
                                                                        >
                                                                            <i className="fa fa-history"></i>
                                                                        </button>
                                                                    )}

                                                                    {/* Actions when in Received Requests tab */}
                                                                    {activeTab === 'received_requests' ? (
                                                                        (() => {
                                                                            const isHandler = item.current_handler && String(item.current_handler) === String(loggedInUser?.id);
                                                                            const canReviewItem = ['PENDING', 'FORWARDED'].includes(item.status) && (isSuperuser || isHandler);
                                                                            return canReviewItem ? (
                                                                                <>
                                                                                    <button
                                                                                        type="button"
                                                                                        className="btn btn-sm btn-outline-primary shadow"
                                                                                        style={{
                                                                                            width: '28px',
                                                                                            height: '28px',
                                                                                            display: 'inline-flex',
                                                                                            alignItems: 'center',
                                                                                            justifyContent: 'center',
                                                                                            padding: '0',
                                                                                            fontSize: '12px',
                                                                                            borderRadius: '6px'
                                                                                        }}
                                                                                        onClick={() => handleOpenForward(item)}
                                                                                        title="Forward Request to Someone Else"
                                                                                    >
                                                                                        <i className="fa fa-share"></i>
                                                                                    </button>

                                                                                    <button
                                                                                        type="button"
                                                                                        className="btn btn-sm btn-success text-white shadow"
                                                                                        style={{
                                                                                            height: '28px',
                                                                                            display: 'inline-flex',
                                                                                            alignItems: 'center',
                                                                                            gap: '4px',
                                                                                            padding: '0 8px',
                                                                                            fontSize: '12px',
                                                                                            borderRadius: '6px'
                                                                                        }}
                                                                                        onClick={() => handleOpenReview(item)}
                                                                                        title="Review, Approve or Reject Dates"
                                                                                    >
                                                                                        <i className="fa fa-clipboard-check"></i>
                                                                                        <span>Review</span>
                                                                                    </button>
                                                                                </>
                                                                            ) : null;
                                                                        })()
                                                                    ) : (
                                                                        /* Actions when in My Requests tab */
                                                                        <>
                                                                            {['PENDING', 'FORWARDED'].includes(item.status) && (
                                                                                <EditButton
                                                                                    module="reqs"
                                                                                    onClick={() => handleShowEdit(item)}
                                                                                />
                                                                            )}

                                                                            {['PENDING', 'CANCELLED'].includes(item.status) && (
                                                                                <DeleteButton
                                                                                    module="reqs"
                                                                                    onClick={() => handleDelete(item.id)}
                                                                                />
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {filteredRequests.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 mb-0">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredRequests.length)} of {filteredRequests.length} entries
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

            {/* Leave Request Form Modal */}
            <LeaveRequestFormModal
                show={showFormModal}
                onHide={() => setShowFormModal(false)}
                onSuccess={fetchData}
                editMode={editMode}
                leaveRequest={currentRequest}
            />

            {/* Leave Request Review Modal (for Approving/Rejecting specific dates) */}
            <LeaveRequestReviewModal
                show={showReviewModal}
                onHide={() => setShowReviewModal(false)}
                request={reviewingRequest}
                onSuccess={fetchData}
            />

            {/* Leave Request Forward Modal */}
            <LeaveRequestForwardModal
                show={showForwardModal}
                onHide={() => setShowForwardModal(false)}
                request={forwardingRequest}
                onSuccess={fetchData}
            />

            {/* Leave Request Detail Modal */}
            <LeaveRequestDetailModal
                show={showDetailModal}
                onHide={() => setShowDetailModal(false)}
                request={selectedRequest}
                onSuccess={fetchData}
                onReview={handleOpenReview}
                onForward={handleOpenForward}
            />

            {/* Employee Leave History Modal */}
            <EmployeeLeaveHistoryModal
                show={showHistoryModal}
                onHide={() => {
                    setShowHistoryModal(false);
                    setHistoryRequest(null);
                }}
                leaveRequestId={historyRequest?.id}
                employeeId={historyRequest?.employee?.id || historyRequest?.employee}
                employeeName={historyRequest?.employee_name}
                appliedLeaveTypeId={historyRequest?.leave_type?.id || historyRequest?.leave_type}
            />
        </div>
    );
};

export default LeaveRequestList;

