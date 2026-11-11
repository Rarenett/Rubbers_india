import React, { useState, useEffect, Fragment, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Card, Nav, Spinner, Modal, Form } from 'react-bootstrap';
import {
    getMyPendingApprovals,
    approveGateEntry,
    rejectGateEntry,
    getMyPendingReallocations,
    respondReallocation
} from '../../../services/GateManagementService';
import AppointmentService from '../../../services/AppointmentService';
import { ThemeContext } from "../../../context/ThemeContext";
import Swal from 'sweetalert2';

const getTodayDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const MyVisitorApprovals = () => {
    const { background } = useContext(ThemeContext);
    const isDark = background.value === "dark";
    const [loading, setLoading] = useState(true);
    const [gateApprovals, setGateApprovals] = useState([]);
    const [pendingAppointments, setPendingAppointments] = useState([]);
    const [approvedAppointments, setApprovedAppointments] = useState([]);
    const [rejectedAppointments, setRejectedAppointments] = useState([]);
    const [pendingReallocations, setPendingReallocations] = useState([]);
    const [activeTab, setActiveTab] = useState('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('today'); // 'today' | 'all' | 'YYYY-MM-DD'
    const [customDate, setCustomDate] = useState(getTodayDateStr());

    // Reallocation Accept / Decline Modal States (Default System Popup Style)
    const [showDeclineModal, setShowDeclineModal] = useState(false);
    const [declineItem, setDeclineItem] = useState(null);
    const [declineReason, setDeclineReason] = useState('');
    const [isDeclining, setIsDeclining] = useState(false);

    const [showAcceptModal, setShowAcceptModal] = useState(false);
    const [acceptItem, setAcceptItem] = useState(null);
    const [isAccepting, setIsAccepting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-');
        if (year && month && day) {
            return `${day}-${month}-${year}`;
        }
        return dateString;
    };

    const fetchAllApprovals = async (filterVal = dateFilter) => {
        try {
            setLoading(true);
            const params = { date: filterVal };
            const [gateData, pendingData, approvedData, rejectedData, reallocData] = await Promise.all([
                getMyPendingApprovals(params).catch(() => []),
                AppointmentService.getMyPendingApprovals(params).catch(() => []),
                AppointmentService.getMyApprovedRequests(params).catch(() => []),
                AppointmentService.getMyRejectedRequests(params).catch(() => []),
                getMyPendingReallocations(params).catch(() => [])
            ]);
            setGateApprovals(gateData || []);
            setPendingAppointments(pendingData || []);
            setApprovedAppointments(approvedData || []);
            setRejectedAppointments(rejectedData || []);
            setPendingReallocations(reallocData || []);
        } catch (error) {
            console.error("Error fetching approvals", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllApprovals(dateFilter);
    }, [dateFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeTab, dateFilter]);

    const handleGateAction = async (id, name, action) => {
        const isApprove = action === 'approve';
        const result = await Swal.fire({
            title: isApprove ? 'Approve Gate Entry?' : 'Reject Gate Entry?',
            text: `Are you sure you want to ${action} the gate entry for "${name}"?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: isApprove ? '#0a500f' : '#d33',
            confirmButtonText: `Yes, ${action} it`
        });

        if (result.isConfirmed) {
            try {
                if (isApprove) {
                    await approveGateEntry(id);
                } else {
                    await rejectGateEntry(id);
                }
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: `Gate entry has been ${action}d.`,
                    timer: 1800,
                    showConfirmButton: false
                });
                fetchAllApprovals(dateFilter);
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: `Failed to ${action} visit.` });
            }
        }
    };

    const handleAppointmentAction = async (id, visitorName, action) => {
        const isApprove = action === 'approve';
        const result = await Swal.fire({
            title: isApprove ? 'Approve Appointment?' : 'Reject Appointment?',
            text: `Confirm ${action} for appointment with "${visitorName}"? Once approved, the visitor will be authorized at the security gate.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: isApprove ? '#0a500f' : '#d33',
            confirmButtonText: `Yes, ${action} it`
        });

        if (result.isConfirmed) {
            try {
                if (isApprove) {
                    await AppointmentService.approveAppointment(id);
                } else {
                    await AppointmentService.rejectAppointment(id);
                }
                Swal.fire({
                    icon: 'success',
                    title: 'Appointment Updated',
                    text: `Appointment has been ${action}d successfully.`,
                    timer: 1800,
                    showConfirmButton: false
                });
                fetchAllApprovals(dateFilter);
            } catch (error) {
                console.error("Error processing appointment action", error);
                Swal.fire({ icon: 'error', title: 'Error', text: `Failed to ${action} appointment.` });
            }
        }
    };

    // Handle Open Decline Modal
    const handleOpenDeclineModal = (item) => {
        setDeclineItem(item);
        setDeclineReason('');
        setShowDeclineModal(true);
    };

    // Handle Confirm Decline Reallocation
    const handleConfirmDecline = async (e) => {
        if (e) e.preventDefault();
        if (!declineItem) return;

        try {
            setIsDeclining(true);
            await respondReallocation(declineItem.id, 'reject', declineReason.trim());
            setShowDeclineModal(false);
            setDeclineItem(null);
            setDeclineReason('');
            Swal.fire({
                icon: 'success',
                title: 'Reallocation Declined',
                text: 'The visitor remains the responsibility of the current host employee.',
                timer: 2200,
                showConfirmButton: false
            });
            fetchAllApprovals(dateFilter);
        } catch (error) {
            console.error("Failed to decline reallocation", error);
            const msg = error.response?.data?.detail || 'Failed to decline reallocation.';
            Swal.fire({ icon: 'error', title: 'Error', text: msg });
        } finally {
            setIsDeclining(false);
        }
    };

    // Handle Open Accept Modal
    const handleOpenAcceptModal = (item) => {
        setAcceptItem(item);
        setShowAcceptModal(true);
    };

    // Handle Confirm Accept Reallocation
    const handleConfirmAccept = async (e) => {
        if (e) e.preventDefault();
        if (!acceptItem) return;

        try {
            setIsAccepting(true);
            await respondReallocation(acceptItem.id, 'approve');
            setShowAcceptModal(false);
            setAcceptItem(null);
            Swal.fire({
                icon: 'success',
                title: 'Reallocation Accepted',
                text: `You are now the responsible host for ${acceptItem.visitor_name}.`,
                timer: 2200,
                showConfirmButton: false
            });
            fetchAllApprovals(dateFilter);
        } catch (error) {
            console.error("Failed to accept reallocation", error);
            const msg = error.response?.data?.detail || 'Failed to accept reallocation.';
            Swal.fire({ icon: 'error', title: 'Error', text: msg });
        } finally {
            setIsAccepting(false);
        }
    };

    // Filter appointments
    const filterList = (list) => {
        const search = searchTerm.toLowerCase();
        return list.filter(app => (
            (app.visitor_name && app.visitor_name.toLowerCase().includes(search)) ||
            (app.vehicle_number && app.vehicle_number.toLowerCase().includes(search)) ||
            (app.visitor_phone && app.visitor_phone.includes(search)) ||
            (app.contact_number && app.contact_number.includes(search)) ||
            (app.concerned_staff_name && app.concerned_staff_name.toLowerCase().includes(search)) ||
            (app.created_by_name && app.created_by_name.toLowerCase().includes(search)) ||
            (app.purpose_of_visit && app.purpose_of_visit.toLowerCase().includes(search))
        ));
    };

    const filterReallocationList = (list) => {
        const search = searchTerm.toLowerCase();
        return list.filter(item => (
            (item.visitor_name && item.visitor_name.toLowerCase().includes(search)) ||
            (item.visitor_mobile && item.visitor_mobile.includes(search)) ||
            (item.company_name && item.company_name.toLowerCase().includes(search)) ||
            (item.from_employee_name && item.from_employee_name.toLowerCase().includes(search)) ||
            (item.reason && item.reason.toLowerCase().includes(search)) ||
            (item.tag_number && item.tag_number.toLowerCase().includes(search))
        ));
    };

    const filteredPending = filterList(pendingAppointments);
    const filteredApproved = filterList(approvedAppointments);
    const filteredRejected = filterList(rejectedAppointments);
    const filteredReallocations = filterReallocationList(pendingReallocations);
    const filteredGate = gateApprovals.filter(entry => {
        const search = searchTerm.toLowerCase();
        return (
            (entry.visitor_name && entry.visitor_name.toLowerCase().includes(search)) ||
            (entry.visitor_mobile && entry.visitor_mobile.includes(search)) ||
            (entry.purpose_of_visit && entry.purpose_of_visit.toLowerCase().includes(search))
        );
    });

    const activeList = activeTab === 'pending'
        ? filteredPending
        : activeTab === 'approved'
            ? filteredApproved
            : activeTab === 'rejected'
                ? filteredRejected
                : activeTab === 'reallocations'
                    ? filteredReallocations
                    : filteredGate;
    const totalPages = Math.ceil(activeList.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = activeList.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <Fragment>
            <div className={`container-fluid p-0 ${isDark ? 'theme-dark' : 'theme-light'}`}>
                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                                <div className="d-flex align-items-center gap-3">
                                    <Card.Title className="mb-0 text-nowrap">My Approvals</Card.Title>
                                </div>
                                <div className="d-flex flex-wrap align-items-center gap-2.5 justify-content-lg-end">
                                    {/* Date Filter Controls (Reallocation Tabs Style) */}
                                    <div className="d-flex align-items-center gap-2">
                                        <div
                                            className="d-flex align-items-center p-1 rounded-3"
                                            style={{
                                                background: isDark ? '#1e293b' : '#f1f5f9',
                                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                                            }}
                                        >
                                            <button
                                                type="button"
                                                className="btn btn-sm"
                                                onClick={() => {
                                                    setDateFilter('today');
                                                    setCustomDate(getTodayDateStr());
                                                }}
                                                style={{
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    padding: '4px 14px',
                                                    fontSize: '12px',
                                                    fontWeight: dateFilter === 'today' ? '600' : '500',
                                                    background: dateFilter === 'today' ? '#0a500f' : 'transparent',
                                                    color: dateFilter === 'today' ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                                                    transition: 'all 0.2s ease',
                                                    boxShadow: dateFilter === 'today' ? '0 1px 3px rgba(10, 80, 15, 0.3)' : 'none'
                                                }}
                                            >
                                                Today
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm"
                                                onClick={() => setDateFilter('all')}
                                                style={{
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    padding: '4px 14px',
                                                    fontSize: '12px',
                                                    fontWeight: dateFilter === 'all' ? '600' : '500',
                                                    background: dateFilter === 'all' ? '#0a500f' : 'transparent',
                                                    color: dateFilter === 'all' ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                                                    transition: 'all 0.2s ease',
                                                    boxShadow: dateFilter === 'all' ? '0 1px 3px rgba(10, 80, 15, 0.3)' : 'none'
                                                }}
                                            >
                                                All
                                            </button>
                                        </div>

                                        <input
                                            type="date"
                                            className="form-control form-control-sm"
                                            style={{
                                                height: '31px',
                                                fontSize: '12px',
                                                maxWidth: '135px',
                                                borderRadius: '6px',
                                                border: `1px solid ${(dateFilter !== 'today' && dateFilter !== 'all') ? '#0a500f' : (isDark ? '#334155' : '#e2e8f0')}`,
                                                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                                color: isDark ? '#f8fafc' : '#1e293b',
                                                boxShadow: (dateFilter !== 'today' && dateFilter !== 'all') ? '0 0 0 2px rgba(10, 80, 15, 0.15)' : 'none',
                                                fontWeight: (dateFilter !== 'today' && dateFilter !== 'all') ? '600' : 'normal'
                                            }}
                                            value={customDate}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setCustomDate(val);
                                                if (val) {
                                                    if (val === getTodayDateStr()) {
                                                        setDateFilter('today');
                                                    } else {
                                                        setDateFilter(val);
                                                    }
                                                }
                                            }}
                                            title="Filter by specific date"
                                        />
                                    </div>

                                    {/* Search Bar */}
                                    <div className="search-bar-container" style={{ margin: 0, minWidth: '200px', maxWidth: '250px' }}>
                                        <span className="search-icon">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="11" cy="11" r="8"></circle>
                                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                            </svg>
                                        </span>
                                        <input
                                            type="text"
                                            className="search-input"
                                            placeholder="Search visitor, phone, staff..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </Card.Header>

                            <div className="custom-tab-1">
                                <Nav as="ul" className="nav nav-tabs">
                                    <Nav.Item as="li">
                                        <Nav.Link
                                            className={activeTab === 'pending' ? 'active' : ''}
                                            onClick={() => setActiveTab('pending')}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <i className="la la-clock me-2" />
                                            Pending Requests
                                            {pendingAppointments.length > 0 && (
                                                <span className="badge badge-warning light badge-sm ms-2">{pendingAppointments.length}</span>
                                            )}
                                        </Nav.Link>
                                    </Nav.Item>
                                    <Nav.Item as="li">
                                        <Nav.Link
                                            className={activeTab === 'approved' ? 'active' : ''}
                                            onClick={() => setActiveTab('approved')}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <i className="la la-check-circle me-2" />
                                            Approved Requests
                                            {approvedAppointments.length > 0 && (
                                                <span className="badge badge-success light badge-sm ms-2">{approvedAppointments.length}</span>
                                            )}
                                        </Nav.Link>
                                    </Nav.Item>
                                    <Nav.Item as="li">
                                        <Nav.Link
                                            className={activeTab === 'rejected' ? 'active' : ''}
                                            onClick={() => setActiveTab('rejected')}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <i className="la la-times-circle me-2" />
                                            Rejected Requests
                                            {rejectedAppointments.length > 0 && (
                                                <span className="badge badge-danger light badge-sm ms-2">{rejectedAppointments.length}</span>
                                            )}
                                        </Nav.Link>
                                    </Nav.Item>
                                    <Nav.Item as="li">
                                        <Nav.Link
                                            className={activeTab === 'reallocations' ? 'active' : ''}
                                            onClick={() => setActiveTab('reallocations')}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <i className="la la-exchange-alt me-2" />
                                            Reallocation Requests
                                            {pendingReallocations.length > 0 && (
                                                <span className="badge badge-info light badge-sm ms-2">{pendingReallocations.length}</span>
                                            )}
                                        </Nav.Link>
                                    </Nav.Item>
                                    {gateApprovals.length > 0 && (
                                        <Nav.Item as="li">
                                            <Nav.Link
                                                className={activeTab === 'gate' ? 'active' : ''}
                                                onClick={() => setActiveTab('gate')}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <i className="la la-door-open me-2" />
                                                Gate Clearance
                                                <span className="badge badge-danger light badge-sm ms-2">{gateApprovals.length}</span>
                                            </Nav.Link>
                                        </Nav.Item>
                                    )}
                                </Nav>
                            </div>

                            <Card.Body>
                                {loading ? (
                                    <div className="text-center py-5">
                                        <Spinner animation="border" variant="primary" />
                                        <p className="text-muted mt-2 small">Loading approvals...</p>
                                    </div>
                                ) : activeTab === 'pending' || activeTab === 'approved' || activeTab === 'rejected' ? (
                                    <div className="table-responsive">
                                        <table className="table table-responsive-md">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '80px' }}><strong>SL NO.</strong></th>
                                                    <th><strong>VISITOR / VEHICLE</strong></th>
                                                    <th><strong>PHONE</strong></th>
                                                    <th><strong>REQUESTED BY</strong></th>
                                                    <th><strong>DATE & TIME</strong></th>
                                                    <th><strong>PURPOSE</strong></th>
                                                    <th><strong>STATUS</strong></th>
                                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentItems.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="8" className="text-center py-5 text-muted">
                                                            <div className="py-3">
                                                                <i className={`fa ${dateFilter === 'today' ? 'fa-calendar-check text-success' : 'fa-inbox'} fa-2x mb-2 opacity-50`}></i>
                                                                <p className="mb-1 fw-semibold fs-14">
                                                                    {dateFilter === 'today'
                                                                        ? `No ${activeTab} appointment requests for today (${formatDate(getTodayDateStr())}).`
                                                                        : dateFilter === 'all'
                                                                            ? `No ${activeTab} appointment requests found.`
                                                                            : `No ${activeTab} appointment requests on ${formatDate(dateFilter)}.`}
                                                                </p>
                                                                {dateFilter !== 'all' && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-link btn-sm text-decoration-none p-0 mt-1"
                                                                        onClick={() => setDateFilter('all')}
                                                                    >
                                                                        View all {activeTab} requests &rarr;
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentItems.map((appt, idx) => (
                                                        <tr key={appt.id || idx}>
                                                            <td>{indexOfFirstItem + idx + 1}</td>
                                                            <td>
                                                                {appt.vehicle_number ? (
                                                                    <>
                                                                        <span className="text-primary fw-bold">
                                                                            <i className="fa fa-truck me-1"></i>{appt.vehicle_number}
                                                                        </span>
                                                                        {appt.company && <><br /><small className="text-muted">{appt.company}</small></>}
                                                                    </>
                                                                ) : (
                                                                    <span className="text-primary fw-bold">
                                                                        <i className="fa fa-user me-1"></i>{appt.visitor_name}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="fw-semibold">
                                                                {appt.visitor_phone || appt.contact_number || (appt.vehicle_number ? (appt.vehicle_type_name || '-') : '-')}
                                                            </td>
                                                            <td>
                                                                {appt.created_by_name || 'Staff'}
                                                            </td>
                                                            <td>
                                                                {formatDate(appt.appointment_date)} {appt.appointment_time}
                                                            </td>
                                                            <td>
                                                                <span className="text-truncate d-inline-block" style={{ maxWidth: '200px' }} title={appt.purpose_of_visit}>
                                                                    {appt.purpose_of_visit || '-'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {activeTab === 'approved' ? (
                                                                    appt.is_inside ? (
                                                                        <span className="badge badge-success light">
                                                                            <i className="fa fa-circle text-success me-1" style={{ fontSize: '8px' }}></i>Inside Campus
                                                                        </span>
                                                                    ) : appt.gate_entry_exited ? (
                                                                        <span className="badge badge-secondary light">
                                                                            <i className="fa fa-sign-out me-1"></i>Completed (Exited)
                                                                        </span>
                                                                    ) : appt.status === 'completed' ? (
                                                                        <span className="badge badge-info light">
                                                                            <i className="fa fa-check-circle me-1"></i>Completed
                                                                        </span>
                                                                    ) : (
                                                                        <span className="badge badge-success light">
                                                                            <i className="fa fa-check me-1"></i>Approved
                                                                        </span>
                                                                    )
                                                                ) : activeTab === 'rejected' ? (
                                                                    <span className="badge badge-danger light">
                                                                        <i className="fa fa-times me-1"></i>Rejected
                                                                    </span>
                                                                ) : (
                                                                    <span className="badge badge-warning light">Pending</span>
                                                                )}
                                                            </td>
                                                            <td className="text-end">
                                                                {activeTab === 'pending' ? (
                                                                    <div className="d-flex justify-content-end align-items-center gap-1">
                                                                        <button
                                                                            onClick={() => handleAppointmentAction(appt.id, appt.visitor_name || appt.vehicle_number, 'approve')}
                                                                            className="btn btn-outline-success btn-sm shadow"
                                                                            title="Approve Appointment"
                                                                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                        >
                                                                            <i className="fa fa-check"></i>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleAppointmentAction(appt.id, appt.visitor_name || appt.vehicle_number, 'reject')}
                                                                            className="btn btn-outline-danger btn-sm shadow"
                                                                            title="Reject Appointment"
                                                                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                        >
                                                                            <i className="fa fa-times"></i>
                                                                        </button>
                                                                    </div>
                                                                ) : activeTab === 'approved' ? (
                                                                    <div className="d-flex justify-content-end align-items-center gap-2">
                                                                        <span className="badge badge-success light">
                                                                            <i className="fa fa-check-circle me-1"></i>Approved
                                                                        </span>
                                                                        {(appt.gate_entry_id || appt.vehicle_entry_id) && (
                                                                            <Link
                                                                                to={`/access-point/gate-entry/${appt.gate_entry_id || appt.vehicle_entry_id}?type=${appt.vehicle_number ? 'vehicle' : 'visitor'}`}
                                                                                className="btn btn-outline-primary btn-sm shadow"
                                                                                title="View Gate Entry Details"
                                                                                style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                            >
                                                                                <i className="fa fa-eye"></i>
                                                                            </Link>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="d-flex justify-content-end align-items-center gap-2">
                                                                        <span className="badge badge-danger light">
                                                                            <i className="fa fa-times-circle me-1"></i>Rejected
                                                                        </span>
                                                                        <button
                                                                            onClick={() => handleAppointmentAction(appt.id, appt.visitor_name || appt.vehicle_number, 'approve')}
                                                                            className="btn btn-outline-success btn-sm shadow"
                                                                            title="Re-approve Appointment"
                                                                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                        >
                                                                            <i className="fa fa-check"></i>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : activeTab === 'reallocations' ? (
                                    <div className="table-responsive">
                                        <table className="table table-responsive-md">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '80px' }}><strong>SL NO.</strong></th>
                                                    <th><strong>VISITOR / VEHICLE</strong></th>
                                                    <th><strong>PHONE</strong></th>
                                                    <th><strong>TRANSFERRED FROM</strong></th>
                                                    <th><strong>DATE & TIME</strong></th>
                                                    <th><strong>REASON</strong></th>
                                                    <th><strong>STATUS</strong></th>
                                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentItems.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="8" className="text-center py-5 text-muted">
                                                            <div className="py-3">
                                                                <i className="fa fa-exchange-alt fa-2x mb-2 opacity-50"></i>
                                                                <p className="mb-1 fw-semibold fs-14">
                                                                    {dateFilter === 'today'
                                                                        ? `No incoming visitor reallocations awaiting approval for today (${formatDate(getTodayDateStr())}).`
                                                                        : 'No incoming visitor reallocations awaiting your approval.'}
                                                                </p>
                                                                {dateFilter !== 'all' && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-link btn-sm text-decoration-none p-0 mt-1"
                                                                        onClick={() => setDateFilter('all')}
                                                                    >
                                                                        View all reallocations &rarr;
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentItems.map((item, idx) => (
                                                        <tr key={item.id || idx}>
                                                            <td>{indexOfFirstItem + idx + 1}</td>
                                                            <td>
                                                                <div className="d-flex align-items-center gap-2">
                                                                    {item.visitor_photo && (
                                                                        <img
                                                                            src={item.visitor_photo}
                                                                            alt=""
                                                                            className="rounded-circle"
                                                                            style={{ width: '32px', height: '32px', objectFit: 'cover' }}
                                                                        />
                                                                    )}
                                                                    <div>
                                                                        <span className="text-primary fw-bold">
                                                                            <i className={`fa ${item.entry_type === 'vehicle' ? 'fa-truck' : 'fa-user'} me-1`}></i>
                                                                            {item.visitor_name}
                                                                        </span>
                                                                        {item.company_name && (
                                                                            <div><small className="text-muted">{item.company_name}</small></div>
                                                                        )}
                                                                        {item.tag_number && (
                                                                            <span className="badge bg-light text-dark border px-1.5 py-0.5 mt-1" style={{ fontSize: '10px' }}>
                                                                                Tag #{item.tag_number}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="fw-semibold">{item.visitor_mobile || '—'}</td>
                                                            <td>
                                                                <span className="fw-bold">{item.from_employee_name}</span>
                                                                {item.from_department_name && (
                                                                    <small className="text-muted d-block">{item.from_department_name}</small>
                                                                )}
                                                            </td>
                                                            <td>
                                                                {item.created_at ? (
                                                                    <>
                                                                        {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                                        <span className="ms-2 text-muted small">
                                                                            {new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                    </>
                                                                ) : '—'}
                                                            </td>
                                                            <td>
                                                                <span className="text-truncate d-inline-block" style={{ maxWidth: '180px' }} title={item.reason}>
                                                                    {item.reason || 'No reason specified'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className="badge badge-warning light">
                                                                    <i className="fa fa-clock me-1"></i>Pending Approval
                                                                </span>
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end align-items-center gap-1.5">
                                                                    <button
                                                                        onClick={() => handleOpenAcceptModal(item)}
                                                                        className="btn btn-outline-success btn-sm shadow"
                                                                        title="Accept Reallocation (Take Over)"
                                                                        style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                    >
                                                                        <i className="fa fa-check"></i>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleOpenDeclineModal(item)}
                                                                        className="btn btn-outline-danger btn-sm shadow"
                                                                        title="Decline Reallocation (Return to Host)"
                                                                        style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                    >
                                                                        <i className="fa fa-times"></i>
                                                                    </button>
                                                                    {(item.gate_entry || item.vehicle_entry) && (
                                                                        <Link
                                                                            to={`/access-point/gate-entry/${item.gate_entry || item.vehicle_entry}?type=${item.entry_type || 'visitor'}`}
                                                                            className="btn btn-outline-primary btn-sm shadow"
                                                                            title="View Dossier"
                                                                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                        >
                                                                            <i className="fa fa-eye"></i>
                                                                        </Link>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-responsive-md">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '80px' }}><strong>SL NO.</strong></th>
                                                    <th><strong>VISITOR NAME</strong></th>
                                                    <th><strong>MOBILE</strong></th>
                                                    <th><strong>PURPOSE</strong></th>
                                                    <th><strong>ARRIVAL TIME</strong></th>
                                                    <th><strong>STATUS</strong></th>
                                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentItems.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="7" className="text-center py-5 text-muted">
                                                            <div className="py-3">
                                                                <i className="fa fa-door-open fa-2x mb-2 opacity-50"></i>
                                                                <p className="mb-1 fw-semibold fs-14">
                                                                    {dateFilter === 'today'
                                                                        ? `No pending gate ingress clearances for today (${formatDate(getTodayDateStr())}).`
                                                                        : 'No pending gate ingress clearances.'}
                                                                </p>
                                                                {dateFilter !== 'all' && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-link btn-sm text-decoration-none p-0 mt-1"
                                                                        onClick={() => setDateFilter('all')}
                                                                    >
                                                                        View all gate clearances &rarr;
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentItems.map((entry, idx) => (
                                                        <tr key={entry.id || idx}>
                                                            <td>{indexOfFirstItem + idx + 1}</td>
                                                            <td>
                                                                <span className="text-primary fw-bold">
                                                                    <i className="fa fa-user me-1"></i>{entry.visitor_name}
                                                                </span>
                                                            </td>
                                                            <td className="fw-semibold">{entry.visitor_mobile}</td>
                                                            <td>{entry.purpose_of_visit}</td>
                                                            <td>
                                                                {new Date(entry.entry_time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                                <span className="ms-2 text-muted small">
                                                                    {new Date(entry.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className="badge badge-warning light">Pending</span>
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end align-items-center gap-1">
                                                                    <button
                                                                        onClick={() => handleGateAction(entry.id, entry.visitor_name, 'approve')}
                                                                        className="btn btn-outline-success btn-sm shadow"
                                                                        title="Approve Gate Entry"
                                                                        style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                    >
                                                                        <i className="fa fa-check"></i>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleGateAction(entry.id, entry.visitor_name, 'reject')}
                                                                        className="btn btn-outline-danger btn-sm shadow"
                                                                        title="Reject Gate Entry"
                                                                        style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                    >
                                                                        <i className="fa fa-times"></i>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {activeList.length > 0 && (
                                    <div className="d-flex justify-content-between align-items-center mt-3 p-3">
                                        <div className="text-muted" style={{ fontSize: '13px' }}>
                                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, activeList.length)} of {activeList.length} entries
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

                                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => {
                                                        if (number === 1 || number === totalPages || (number >= currentPage - 1 && number <= currentPage + 1)) {
                                                            return (
                                                                <li key={number} className={`page-item ${currentPage === number ? 'active' : ''}`}>
                                                                    <button
                                                                        type="button"
                                                                        className="page-link"
                                                                        onClick={() => setCurrentPage(number)}
                                                                        style={{ border: 'none' }}
                                                                    >
                                                                        {number}
                                                                    </button>
                                                                </li>
                                                            );
                                                        }
                                                        if (number === currentPage - 2 || number === currentPage + 2) {
                                                            return (
                                                                <li key={number} className="page-item disabled">
                                                                    <span className="page-link" style={{ border: 'none' }}>...</span>
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
                            </Card.Body>
                        </Card>
                    </div>
                </div>
            </div>

            {/* DECLINE REALLOCATION MODAL (System Default Style) */}
            <Modal
                show={showDeclineModal}
                onHide={() => !isDeclining && setShowDeclineModal(false)}
                dialogClassName={`item-custom-modal ${isDark ? 'dark-mode-modal' : ''}`}
                backdrop="static"
                keyboard={false}
                size="md"
                centered
            >
                {declineItem && (
                    <Form onSubmit={handleConfirmDecline}>
                        <div className="modal-header-custom">
                            <div className="d-flex align-items-center" style={{ gap: '18px' }}>
                                <div
                                    className="modal-icon-circle"
                                    style={{
                                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                        boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)',
                                        width: '52px',
                                        height: '52px'
                                    }}
                                >
                                    <i className="fa fa-times-circle text-white fs-4"></i>
                                </div>
                                <div>
                                    <h4 className="modal-title font-w700 mb-1" style={{ fontSize: '20px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                        Decline Reallocation
                                    </h4>
                                    <p className="modal-subtitle-custom mb-0 text-muted" style={{ fontSize: '13.5px' }}>
                                        Return visitor responsibility to the current host
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="modal-close-x"
                                onClick={() => !isDeclining && setShowDeclineModal(false)}
                                title="Close"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="modal-body-custom">
                            {/* Visitor Context Card */}
                            <div
                                className="p-3 mb-3 rounded-4"
                                style={{
                                    background: isDark ? 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)'
                                }}
                            >
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <span className="small text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>Visitor</span>
                                        <div className="fw-bold fs-6 mt-0.5" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                                            {declineItem.visitor_name}
                                        </div>
                                        <div className="small text-muted mt-1">
                                            {declineItem.visitor_mobile && <span><i className="fa fa-phone-alt me-1 text-success"></i>{declineItem.visitor_mobile} &bull; </span>}
                                            {declineItem.company_name || 'Visitor'}
                                        </div>
                                    </div>
                                    {declineItem.tag_number && (
                                        <span className="badge badge-info light">
                                            <i className="fa fa-tag me-1"></i> Tag #{declineItem.tag_number}
                                        </span>
                                    )}
                                </div>
                                <div className="small text-muted pt-2 border-top" style={{ borderColor: isDark ? '#334155' : '#f1f5f9' }}>
                                    Transferred From: <strong>{declineItem.from_employee_name}</strong> &bull; {declineItem.from_department_name}
                                </div>
                                {declineItem.reason && (
                                    <div className="small text-info mt-1 pt-1 border-top fst-italic" style={{ borderColor: isDark ? '#334155' : '#f1f5f9' }}>
                                        Transfer Reason: "{declineItem.reason}"
                                    </div>
                                )}
                            </div>

                            <div className="alert alert-warning py-2.5 px-3 small rounded-3 d-flex align-items-center gap-2.5 mb-3" style={{ fontSize: '12.5px' }}>
                                <i className="fa fa-info-circle fs-5 flex-shrink-0 text-warning"></i>
                                <div>
                                    If declined, this visitor will strictly remain under current host <strong>{declineItem.from_employee_name}</strong>'s responsibility.
                                </div>
                            </div>

                            <Form.Group className="mb-1">
                                <Form.Label className="form-label-custom small fw-semibold">
                                    Reason for Declining (Optional)
                                </Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={3}
                                    className="form-control-custom"
                                    placeholder="e.g. In an urgent meeting / Out of office / Transferred by mistake..."
                                    value={declineReason}
                                    onChange={(e) => setDeclineReason(e.target.value)}
                                    autoFocus
                                />
                            </Form.Group>
                        </div>

                        <div className="modal-footer-custom">
                            <button
                                type="button"
                                className="btn btn-close-custom"
                                disabled={isDeclining}
                                onClick={() => setShowDeclineModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-danger-custom"
                                disabled={isDeclining}
                            >
                                {isDeclining ? (
                                    <>
                                        <Spinner size="sm" animation="border" className="me-2" />
                                        Declining...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa fa-times me-2"></i> Decline Transfer
                                    </>
                                )}
                            </button>
                        </div>
                    </Form>
                )}
            </Modal>

            {/* ACCEPT REALLOCATION MODAL (System Default Style) */}
            <Modal
                show={showAcceptModal}
                onHide={() => !isAccepting && setShowAcceptModal(false)}
                dialogClassName={`item-custom-modal ${isDark ? 'dark-mode-modal' : ''}`}
                backdrop="static"
                keyboard={false}
                size="md"
                centered
            >
                {acceptItem && (
                    <div>
                        <div className="modal-header-custom">
                            <div className="d-flex align-items-center" style={{ gap: '18px' }}>
                                <div
                                    className="modal-icon-circle"
                                    style={{
                                        background: 'linear-gradient(135deg, #0a500f 0%, #20b876 100%)',
                                        boxShadow: '0 4px 14px rgba(10, 80, 15, 0.3)',
                                        width: '52px',
                                        height: '52px'
                                    }}
                                >
                                    <i className="fa fa-user-check text-white fs-4"></i>
                                </div>
                                <div>
                                    <h4 className="modal-title font-w700 mb-1" style={{ fontSize: '20px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                        Accept Visitor Reallocation
                                    </h4>
                                    <p className="modal-subtitle-custom mb-0 text-muted" style={{ fontSize: '13.5px' }}>
                                        Take over hosting and campus movement responsibility
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="modal-close-x"
                                onClick={() => !isAccepting && setShowAcceptModal(false)}
                                title="Close"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="modal-body-custom">
                            {/* Visitor Context Card */}
                            <div
                                className="p-3 mb-3 rounded-4"
                                style={{
                                    background: isDark ? 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)'
                                }}
                            >
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <span className="small text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>Visitor</span>
                                        <div className="fw-bold fs-6 mt-0.5" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                                            {acceptItem.visitor_name}
                                        </div>
                                        <div className="small text-muted mt-1">
                                            {acceptItem.visitor_mobile && <span><i className="fa fa-phone-alt me-1 text-success"></i>{acceptItem.visitor_mobile} &bull; </span>}
                                            {acceptItem.company_name || 'Visitor'}
                                        </div>
                                    </div>
                                    {acceptItem.tag_number && (
                                        <span className="badge badge-info light">
                                            <i className="fa fa-tag me-1"></i> Tag #{acceptItem.tag_number}
                                        </span>
                                    )}
                                </div>
                                <div className="small text-muted pt-2 border-top" style={{ borderColor: isDark ? '#334155' : '#f1f5f9' }}>
                                    Transferred From: <strong>{acceptItem.from_employee_name}</strong> &bull; {acceptItem.from_department_name}
                                </div>
                                {acceptItem.reason && (
                                    <div className="small text-info mt-1 pt-1 border-top fst-italic" style={{ borderColor: isDark ? '#334155' : '#f1f5f9' }}>
                                        Transfer Reason: "{acceptItem.reason}"
                                    </div>
                                )}
                            </div>

                            <div className="alert alert-success py-2.5 px-3 small rounded-3 d-flex align-items-center gap-2.5 mb-1" style={{ fontSize: '12.5px' }}>
                                <i className="fa fa-check-circle fs-5 flex-shrink-0 text-success"></i>
                                <div>
                                    By accepting, you become the primary host official responsible for this visitor. Only you will be authorized to sign off and complete their campus movement.
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer-custom">
                            <button
                                type="button"
                                className="btn btn-close-custom"
                                disabled={isAccepting}
                                onClick={() => setShowAcceptModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-all-exit-custom"
                                disabled={isAccepting}
                                onClick={handleConfirmAccept}
                            >
                                {isAccepting ? (
                                    <>
                                        <Spinner size="sm" animation="border" className="me-2" />
                                        Accepting...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa fa-check me-2"></i> Accept & Take Over
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            <style dangerouslySetInnerHTML={{
                __html: `
                /* ── Theme Modal Styles (item-custom-modal) matching CheckoutModal ── */
                .item-custom-modal .modal-content {
                    border-radius: 20px !important;
                    border: none !important;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.16) !important;
                    overflow: hidden !important;
                }
                .item-custom-modal .modal-header-custom {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    padding: 24px 32px 18px 32px !important;
                    border-bottom: 1px solid #f1f5f9 !important;
                    background-color: #ffffff !important;
                    width: 100% !important;
                }
                .item-custom-modal .modal-icon-circle {
                    width: 52px !important;
                    height: 52px !important;
                    border-radius: 50% !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    flex-shrink: 0 !important;
                }
                .item-custom-modal .modal-close-x {
                    border: none !important;
                    background: #f1f5f9 !important;
                    width: 36px !important;
                    height: 36px !important;
                    border-radius: 10px !important;
                    font-size: 24px !important;
                    color: #64748b !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    line-height: 1 !important;
                    padding: 0 !important;
                }
                .item-custom-modal .modal-close-x:hover {
                    background: #fee2e2 !important;
                    color: #ef4444 !important;
                }
                .item-custom-modal .modal-body-custom {
                    padding: 26px 32px !important;
                    background-color: #ffffff !important;
                }
                .item-custom-modal .form-label-custom {
                    font-size: 13.5px !important;
                    font-weight: 500 !important;
                    color: #4a5568 !important;
                    margin-bottom: 8px !important;
                }
                .item-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1 !important;
                    border-radius: 10px !important;
                    padding: 10px 16px !important;
                    font-size: 14px !important;
                    color: #334155 !important;
                    background-color: #fff !important;
                    transition: border-color 0.2s, box-shadow 0.2s !important;
                    width: 100% !important;
                }
                .item-custom-modal textarea.form-control-custom {
                    height: auto !important;
                }
                .item-custom-modal .form-control-custom:focus {
                    outline: none !important;
                    border-color: #0a500f !important;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15) !important;
                }
                .item-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8 !important;
                }
                .item-custom-modal .modal-footer-custom {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: flex-end !important;
                    padding: 20px 32px 24px 32px !important;
                    border-top: 1px solid #f1f5f9 !important;
                    background-color: #fafbfc !important;
                    gap: 14px !important;
                }

                .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    border: none !important;
                    color: #ffffff !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    min-height: 44px !important;
                    border-radius: 10px !important;
                    transition: all 0.2s ease !important;
                    cursor: pointer !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }

                .btn-all-exit-custom {
                    background: linear-gradient(135deg, #0a500f 0%, #20b876 100%) !important;
                    border: none !important;
                    color: #ffffff !important;
                    font-weight: 600 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    min-height: 44px !important;
                    border-radius: 10px !important;
                    transition: all 0.2s ease !important;
                    cursor: pointer !important;
                    box-shadow: 0 4px 12px rgba(10, 80, 15, 0.3) !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                .btn-all-exit-custom:hover:not(:disabled) {
                    background: linear-gradient(135deg, #20b876 0%, #179b61 100%) !important;
                    color: #ffffff !important;
                    box-shadow: 0 6px 16px rgba(10, 80, 15, 0.4) !important;
                    transform: translateY(-1px) !important;
                }

                .btn-danger-custom {
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
                    border: none !important;
                    color: #ffffff !important;
                    font-weight: 600 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    min-height: 44px !important;
                    border-radius: 10px !important;
                    transition: all 0.2s ease !important;
                    cursor: pointer !important;
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25) !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                .btn-danger-custom:hover:not(:disabled) {
                    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%) !important;
                    color: #ffffff !important;
                    box-shadow: 0 6px 16px rgba(239, 68, 68, 0.35) !important;
                    transform: translateY(-1px) !important;
                }

                /* Dark mode support */
                .dark-mode-modal .modal-content {
                    background-color: #1e293b !important;
                    color: #f8fafc !important;
                }
                .dark-mode-modal .modal-header-custom {
                    background-color: #1e293b !important;
                    border-bottom-color: #334155 !important;
                }
                .dark-mode-modal .modal-body-custom {
                    background-color: #1e293b !important;
                    color: #f8fafc !important;
                }
                .dark-mode-modal .modal-footer-custom {
                    background-color: #0f172a !important;
                    border-top-color: #334155 !important;
                }
                .dark-mode-modal .form-control-custom {
                    background-color: #0f172a !important;
                    border-color: #334155 !important;
                    color: #f8fafc !important;
                }
                .dark-mode-modal .modal-close-x {
                    background-color: #334155 !important;
                    color: #cbd5e1 !important;
                }
                .dark-mode-modal .modal-close-x:hover {
                    background-color: #ef4444 !important;
                    color: #ffffff !important;
                }
                `
            }} />
        </Fragment>
    );
};

export default MyVisitorApprovals;
