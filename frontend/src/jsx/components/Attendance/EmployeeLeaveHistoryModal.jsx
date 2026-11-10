import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, Spinner } from 'react-bootstrap';
import { getEmployeeLeaveHistory } from '../../../services/AttendanceService';

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

const EmployeeLeaveHistoryModal = ({
    show,
    onHide,
    leaveRequestId = null,
    employeeId = 'me',
    employeeName = '',
    appliedLeaveTypeId = null,
}) => {
    const [loading, setLoading] = useState(false);
    const [historyData, setHistoryData] = useState(null);
    const [expandedDatesId, setExpandedDatesId] = useState(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showOtherQuotas, setShowOtherQuotas] = useState(false);
    const [filterByAppliedType, setFilterByAppliedType] = useState(true);

    useEffect(() => {
        if (show && (leaveRequestId || employeeId)) {
            fetchHistory(dateFrom, dateTo);
        }
    }, [show, leaveRequestId, employeeId, dateFrom, dateTo]);

    useEffect(() => {
        if (show) {
            setShowOtherQuotas(false);
            setFilterByAppliedType(true);
        }
    }, [show, appliedLeaveTypeId]);

    // Ensure parent modal scrolling stays intact after this submodal closes
    const handleModalExited = () => {
        const hasOpenModal = document.querySelectorAll('.modal.show').length > 0;
        if (hasOpenModal) {
            document.body.classList.add('modal-open');
        }
    };

    const handleClearDates = () => {
        setDateFrom('');
        setDateTo('');
    };

    const fetchHistory = async (df = dateFrom, dt = dateTo) => {
        try {
            setLoading(true);
            const params = {};
            if (leaveRequestId) params.leave_request = leaveRequestId;
            if (employeeId) params.employee = employeeId;
            const validDf = typeof df === 'string' ? df : (typeof dateFrom === 'string' ? dateFrom : '');
            const validDt = typeof dt === 'string' ? dt : (typeof dateTo === 'string' ? dateTo : '');
            if (validDf) params.date_from = validDf;
            if (validDt) params.date_to = validDt;
            params.exclude_current = true;

            const data = await getEmployeeLeaveHistory(params);
            setHistoryData(data);
        } catch (err) {
            console.error('Error fetching employee leave history:', err);
            // Retain previous history data on transient error
        } finally {
            setLoading(false);
        }
    };

    const activeAppliedTypeId =
        appliedLeaveTypeId || historyData?.current_leave_type_id || null;

    const leavesTaken = historyData?.leaves_taken || [];
    const balances = historyData?.balances || {};
    const balanceList = Object.values(balances);

    const appliedBalance = activeAppliedTypeId
        ? balanceList.find((b) => String(b.leave_type_id) === String(activeAppliedTypeId))
        : null;

    const otherBalances = activeAppliedTypeId
        ? balanceList.filter((b) => String(b.leave_type_id) !== String(activeAppliedTypeId))
        : balanceList;

    const appliedLeaves = activeAppliedTypeId
        ? leavesTaken.filter(
              (item) => String(item.leave_type_id) === String(activeAppliedTypeId)
          )
        : leavesTaken;

    const displayedLeaves =
        appliedBalance && filterByAppliedType ? appliedLeaves : leavesTaken;

    const applicantDisplayName =
        historyData?.employee?.name || employeeName || 'Employee';

    const renderBalanceCard = (bal) => {
        const rem = Number(bal.remaining || 0);
        const remDisplay = Number.isInteger(rem) ? rem : rem.toFixed(1);
        const totalIn = Number(bal.total_in || 0);
        const totalInDisplay = Number.isInteger(totalIn) ? totalIn : totalIn.toFixed(1);
        const totalOut = Number(bal.total_out || 0);
        const totalOutDisplay = Number.isInteger(totalOut) ? totalOut : totalOut.toFixed(1);
        const isLow = rem <= 2 && rem > 0;
        const isZero = rem <= 0;

        return (
            <div
                key={bal.leave_type_id}
                className="p-2 px-3 rounded-3 border d-flex flex-column"
                style={{
                    backgroundColor: isZero
                        ? '#fff1f2'
                        : isLow
                        ? '#fffbeb'
                        : '#ffffff',
                    borderColor: isZero
                        ? '#fecdd3'
                        : isLow
                        ? '#fde68a'
                        : '#e2e8f0',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                    minWidth: 0,
                }}
            >
                <div className="d-flex align-items-center justify-content-between gap-1 mb-1">
                    <span className="fw-semibold text-dark fs-12 text-truncate" title={bal.leave_type_name}>
                        {bal.leave_type_name || `Leave #${bal.leave_type_id}`}
                    </span>
                    {bal.leave_type_code && (
                        <span className="badge bg-light text-secondary border fs-10 py-0 px-1">
                            {bal.leave_type_code}
                        </span>
                    )}
                </div>
                <div className="d-flex align-items-baseline gap-1 my-1">
                    <span
                        className="fs-18 fw-bold"
                        style={{
                            color: isZero
                                ? '#e11d48'
                                : isLow
                                ? '#b45309'
                                : '#16a34a',
                        }}
                    >
                        {remDisplay}
                    </span>
                    <span className="fs-11 text-muted">remaining</span>
                </div>
                <div className="fs-10 text-muted d-flex justify-content-between pt-1 border-top border-light-subtle">
                    <span>Quota: <strong>{totalInDisplay}</strong></span>
                    <span>Used: <strong>{totalOutDisplay}</strong></span>
                </div>
            </div>
        );
    };

    return (
        <Modal
            show={show}
            onHide={onHide}
            onExited={handleModalExited}
            size="lg"
            centered
            enforceFocus={false}
            dialogClassName="leave-history-custom-modal"
            style={{ zIndex: 1070 }}
        >
            <style>{`
                .modal-backdrop.leave-history-backdrop {
                    z-index: 1065 !important;
                }
                .leave-history-custom-modal {
                    z-index: 1070 !important;
                }
                .leave-history-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2) !important;
                    overflow: hidden;
                }
                .leave-history-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 22px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                    background-color: #ffffff;
                }
                .leave-history-custom-modal .modal-icon-circle {
                    width: 44px;
                    height: 44px;
                    background-color: #0a500f;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.25);
                }
                .leave-history-custom-modal .modal-close-x {
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
                .leave-history-custom-modal .modal-close-x:hover { color: #555; }
                .leave-history-custom-modal .modal-body-custom {
                    padding: 22px 28px;
                    max-height: 72vh;
                    overflow-y: auto;
                }
                .leave-history-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 28px 20px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                }
                .leave-history-custom-modal .btn-close-custom {
                    background-color: #dc3545 !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .leave-history-custom-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
            `}</style>

            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <i className="fa fa-history text-white fs-18"></i>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            Last Leaves Taken
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Record of approved leaves taken and current leave quotas for <strong>{applicantDisplayName}</strong>
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide}>&times;</button>
            </div>

            <div className="modal-body-custom">
                {loading && !historyData ? (
                    <div className="text-center py-5 text-muted">
                        <Spinner animation="border" size="sm" className="me-2 text-primary" />
                        <span className="fs-13">Loading leaves taken and quota details...</span>
                    </div>
                ) : (
                    <>
                        {/* Leave Quota & Remaining Balance Strip */}
                        {balanceList.length > 0 && (
                            <div className="mb-4">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <div className="d-flex align-items-center gap-2">
                                        <span
                                            className="text-uppercase fw-bold text-muted fs-11"
                                            style={{ letterSpacing: '0.6px' }}
                                        >
                                            Current Leave Balances & Quotas
                                        </span>
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                        {otherBalances.length > 0 && appliedBalance && (
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-outline-primary d-inline-flex align-items-center gap-1 fs-11 py-1 px-3"
                                                style={{ borderRadius: '20px' }}
                                                onClick={() => setShowOtherQuotas(!showOtherQuotas)}
                                            >
                                                <i className={`fa fa-chevron-${showOtherQuotas ? 'up' : 'down'} me-1`}></i>
                                                <span>
                                                    {showOtherQuotas
                                                        ? 'Hide other quotas'
                                                        : `Other leave quotas (${otherBalances.length})`}
                                                </span>
                                            </button>
                                        )}
                                        
                                    </div>
                                </div>

                                {/* Prioritised Applied Leave Type View */}
                                {appliedBalance ? (
                                    <div>
                                        {/* Highlighted Applied Leave Type Card */}
                                        <div
                                            className="p-3 rounded-3 border d-flex flex-wrap align-items-center justify-content-between gap-3"
                                            style={{
                                                backgroundColor: '#ffffff',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '12px',
                                                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
                                            }}
                                        >
                                            {/* Left: Leave Type Info */}
                                            <div className="d-flex align-items-center gap-3">
                                                <div
                                                    style={{
                                                        width: '44px',
                                                        height: '44px',
                                                        borderRadius: '12px',
                                                        backgroundColor: '#f0fdf4',
                                                        border: '1px solid #bbf7d0',
                                                        color: '#16a34a',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '18px',
                                                    }}
                                                >
                                                    <i className="fa fa-calendar-check"></i>
                                                </div>
                                                <div>
                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                        <span
                                                            className="badge rounded-pill fs-10 px-2 py-0 fw-semibold"
                                                            style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}
                                                        >
                                                            Applied Leave Type
                                                        </span>
                                                        {appliedBalance.leave_type_code && (
                                                            <span className="badge bg-light text-secondary border fs-10 py-0">
                                                                {appliedBalance.leave_type_code}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h5 className="mb-0 fw-bold text-dark fs-15">
                                                        {appliedBalance.leave_type_name}
                                                    </h5>
                                                </div>
                                            </div>

                                            {/* Right: Modern Stat Tiles */}
                                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                                {/* Remaining (Hero Metric) */}
                                                <div
                                                    className="text-center py-2 px-3 rounded-3"
                                                    style={{
                                                        backgroundColor:
                                                            Number(appliedBalance.remaining || 0) <= 0
                                                                ? '#fff1f2'
                                                                : Number(appliedBalance.remaining || 0) <= 2
                                                                ? '#fffbeb'
                                                                : '#f0fdf4',
                                                        border: `1px solid ${
                                                            Number(appliedBalance.remaining || 0) <= 0
                                                                ? '#fecdd3'
                                                                : Number(appliedBalance.remaining || 0) <= 2
                                                                ? '#fde68a'
                                                                : '#bbf7d0'
                                                        }`,
                                                        minWidth: '105px',
                                                    }}
                                                >
                                                    <small
                                                        className="d-block fs-10 fw-bold text-uppercase"
                                                        style={{
                                                            letterSpacing: '0.4px',
                                                            color:
                                                                Number(appliedBalance.remaining || 0) <= 0
                                                                    ? '#e11d48'
                                                                    : Number(appliedBalance.remaining || 0) <= 2
                                                                    ? '#b45309'
                                                                    : '#15803d',
                                                        }}
                                                    >
                                                        Remaining
                                                    </small>
                                                    <div className="d-flex align-items-baseline justify-content-center gap-1 mt-1">
                                                        <span
                                                            className="fs-20"
                                                            style={{
                                                                fontWeight: 800,
                                                                color:
                                                                    Number(appliedBalance.remaining || 0) <= 0
                                                                        ? '#e11d48'
                                                                        : Number(appliedBalance.remaining || 0) <= 2
                                                                        ? '#b45309'
                                                                        : '#16a34a',
                                                            }}
                                                        >
                                                            {Number.isInteger(Number(appliedBalance.remaining || 0))
                                                                ? Number(appliedBalance.remaining || 0)
                                                                : Number(appliedBalance.remaining || 0).toFixed(1)}
                                                        </span>
                                                        <span className="fs-10 text-muted">days</span>
                                                    </div>
                                                </div>

                                                {/* Total Quota */}
                                                <div
                                                    className="text-center py-2 px-3 rounded-3 border"
                                                    style={{
                                                        backgroundColor: '#f8fafc',
                                                        borderColor: '#e2e8f0',
                                                        minWidth: '95px',
                                                    }}
                                                >
                                                    <small
                                                        className="text-muted d-block fs-10 fw-semibold text-uppercase"
                                                        style={{ letterSpacing: '0.4px' }}
                                                    >
                                                        Total Quota
                                                    </small>
                                                    <div className="d-flex align-items-baseline justify-content-center gap-1 mt-1">
                                                        <span className="fs-18 fw-bold text-dark">
                                                            {Number.isInteger(Number(appliedBalance.total_in || 0))
                                                                ? Number(appliedBalance.total_in || 0)
                                                                : Number(appliedBalance.total_in || 0).toFixed(1)}
                                                        </span>
                                                        <span className="fs-10 text-muted">allocated</span>
                                                    </div>
                                                </div>

                                                {/* Leaves Taken */}
                                                <div
                                                    className="text-center py-2 px-3 rounded-3 border"
                                                    style={{
                                                        backgroundColor: '#f8fafc',
                                                        borderColor: '#e2e8f0',
                                                        minWidth: '95px',
                                                    }}
                                                >
                                                    <small
                                                        className="text-muted d-block fs-10 fw-semibold text-uppercase"
                                                        style={{ letterSpacing: '0.4px' }}
                                                    >
                                                        Leaves Taken
                                                    </small>
                                                    <div className="d-flex align-items-baseline justify-content-center gap-1 mt-1">
                                                        <span className="fs-18 fw-bold text-dark">
                                                            {Number.isInteger(Number(appliedBalance.total_out || 0))
                                                                ? Number(appliedBalance.total_out || 0)
                                                                : Number(appliedBalance.total_out || 0).toFixed(1)}
                                                        </span>
                                                        <span className="fs-10 text-muted">approved</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Optional Toggle for Other Leave Types */}
                                        {otherBalances.length > 0 && showOtherQuotas && (
                                            <div
                                                className="p-3 mt-2 rounded-3 border"
                                                style={{ backgroundColor: '#f8fafc' }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                                                        gap: '8px',
                                                        maxHeight: '168px',
                                                        overflowY: 'auto',
                                                        paddingRight: '2px',
                                                    }}
                                                >
                                                    {otherBalances.map((bal) => renderBalanceCard(bal))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* If no specific leave type is applied, display all cards */
                                    <div className="d-flex flex-wrap gap-2">
                                        {balanceList.map((bal) => renderBalanceCard(bal))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Title Bar, Scope Toggle & Date Filter Controls */}
                        <div
                            className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 p-2.5 px-3 rounded-3"
                            style={{
                                backgroundColor: '#ffffff',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                            }}
                        >
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                {appliedBalance ? (
                                    <div
                                        className="d-inline-flex p-1 rounded-pill mb-2 mt-2"
                                        style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0' }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setFilterByAppliedType(true)}
                                            style={{
                                                border: 'none',
                                                outline: 'none',
                                                backgroundColor: filterByAppliedType ? '#ffffff' : 'transparent',
                                                color: filterByAppliedType ? '#0f172a' : '#64748b',
                                                fontWeight: 600,
                                                fontSize: '11.5px',
                                                padding: '4px 12px',
                                                borderRadius: '20px',
                                                boxShadow: filterByAppliedType ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                                transition: 'all 0.15s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                cursor: 'pointer',
                                            }}
                                            title={`Only show approved ${appliedBalance.leave_type_name} leaves`}
                                        >
                                            <i className="fa fa-filter" style={{ fontSize: '10px', opacity: 0.8 }}></i>
                                            <span>{appliedBalance.leave_type_code || appliedBalance.leave_type_name} Leaves</span>
                                            <span
                                                style={{
                                                    backgroundColor: filterByAppliedType ? '#0f172a' : '#cbd5e1',
                                                    color: filterByAppliedType ? '#ffffff' : '#475569',
                                                    borderRadius: '10px',
                                                    padding: '1px 6px',
                                                    fontSize: '10px',
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {appliedLeaves.length}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFilterByAppliedType(false)}
                                            style={{
                                                border: 'none',
                                                outline: 'none',
                                                backgroundColor: !filterByAppliedType ? '#ffffff' : 'transparent',
                                                color: !filterByAppliedType ? '#0f172a' : '#64748b',
                                                fontWeight: 600,
                                                fontSize: '11.5px',
                                                padding: '4px 12px',
                                                borderRadius: '20px',
                                                boxShadow: !filterByAppliedType ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                                transition: 'all 0.15s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                cursor: 'pointer',
                                            }}
                                            title="Show all approved leaves across all types"
                                        >
                                            <span>All Leave Types</span>
                                            <span
                                                style={{
                                                    backgroundColor: !filterByAppliedType ? '#0f172a' : '#cbd5e1',
                                                    color: !filterByAppliedType ? '#ffffff' : '#475569',
                                                    borderRadius: '10px',
                                                    padding: '1px 6px',
                                                    fontSize: '10px',
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {leavesTaken.length}
                                            </span>
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-dark fs-12 fw-bold text-uppercase" style={{ letterSpacing: '0.5px' }}>
                                        Leaves Taken ({leavesTaken.length})
                                    </span>
                                )}
                            </div>

                            {/* Date Filter Inputs */}
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                <div
                                    className="d-flex align-items-center gap-1.5 px-2 py-1 rounded-2"
                                    style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1' }}
                                >
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>From:</span>
                                    <input
                                        type="date"
                                        style={{
                                            border: 'none',
                                            outline: 'none',
                                            backgroundColor: 'transparent',
                                            fontSize: '11.5px',
                                            color: '#1e293b',
                                            padding: 0,
                                            cursor: 'pointer',
                                        }}
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                    />
                                </div>
                                <div
                                    className="d-flex align-items-center gap-1.5 px-2 py-1 rounded-2"
                                    style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1' }}
                                >
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>To:</span>
                                    <input
                                        type="date"
                                        style={{
                                            border: 'none',
                                            outline: 'none',
                                            backgroundColor: 'transparent',
                                            fontSize: '11.5px',
                                            color: '#1e293b',
                                            padding: 0,
                                            cursor: 'pointer',
                                        }}
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                    />
                                </div>
                                {(dateFrom || dateTo) && (
                                    <button
                                        type="button"
                                        className="btn btn-sm p-0 text-danger fs-11 ms-1 d-flex align-items-center gap-1 text-decoration-none"
                                        onClick={handleClearDates}
                                        title="Clear date filters"
                                        style={{ fontWeight: 600, border: 'none', background: 'none' }}
                                    >
                                        <i className="fa fa-times-circle"></i> Reset
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Detailed Table */}
                        {displayedLeaves.length === 0 ? (
                            <div
                                className="p-4 text-center rounded-3 my-2"
                                style={{
                                    backgroundColor: '#fafbfc',
                                    border: '1px dashed #cbd5e1',
                                }}
                            >
                                <div
                                    style={{
                                        width: '42px',
                                        height: '42px',
                                        borderRadius: '50%',
                                        backgroundColor: '#eff6ff',
                                        color: '#3b82f6',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '18px',
                                        marginBottom: '10px',
                                    }}
                                >
                                    <i className="fa fa-calendar-check"></i>
                                </div>
                                <div style={{ color: '#334155', fontSize: '13px' }}>
                                    {dateFrom || dateTo ? (
                                        <>
                                            No approved {filterByAppliedType && appliedBalance ? <strong style={{ color: '#0f172a' }}>"{appliedBalance.leave_type_name}"</strong> : ''} leaves taken by <strong style={{ color: '#0f172a' }}>{applicantDisplayName}</strong> found between{' '}
                                            <strong style={{ color: '#0f172a' }}>{dateFrom ? formatDateDMY(dateFrom) : 'the beginning'}</strong> and{' '}
                                            <strong style={{ color: '#0f172a' }}>{dateTo ? formatDateDMY(dateTo) : 'now'}</strong>.
                                            <div className="mt-3 d-flex justify-content-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleClearDates}
                                                    style={{
                                                        backgroundColor: '#ffffff',
                                                        border: '1px solid #cbd5e1',
                                                        color: '#475569',
                                                        borderRadius: '8px',
                                                        padding: '6px 14px',
                                                        fontSize: '11.5px',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    Clear Date Filter
                                                </button>
                                                {filterByAppliedType && appliedBalance && leavesTaken.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFilterByAppliedType(false)}
                                                        style={{
                                                            backgroundColor: '#0f172a',
                                                            border: 'none',
                                                            color: '#ffffff',
                                                            borderRadius: '8px',
                                                            padding: '6px 14px',
                                                            fontSize: '11.5px',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                                        }}
                                                    >
                                                        View All Leave Types ({leavesTaken.length})
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    ) : filterByAppliedType && appliedBalance ? (
                                        <>
                                            <div>
                                                No previous approved <strong style={{ color: '#0f172a' }}>{appliedBalance.leave_type_name}</strong> leaves taken by <strong style={{ color: '#0f172a' }}>{applicantDisplayName}</strong>.
                                            </div>
                                            <div className="mt-3">
                                                {leavesTaken.length > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFilterByAppliedType(false)}
                                                        style={{
                                                            backgroundColor: '#ffffff',
                                                            border: '1px solid #cbd5e1',
                                                            color: '#0f172a',
                                                            borderRadius: '8px',
                                                            padding: '6px 14px',
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                        }}
                                                    >
                                                        <i className="fa fa-history text-muted" style={{ fontSize: '11px' }}></i>
                                                        View Other Leave History ({leavesTaken.length} total across all types)
                                                    </button>
                                                ) : (
                                                    <small style={{ color: '#94a3b8' }}>
                                                        No approved leaves recorded yet across any leave type.
                                                    </small>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div>
                                                No previous approved leaves taken by <strong style={{ color: '#0f172a' }}>{applicantDisplayName}</strong>.
                                            </div>
                                            <small className="d-block mt-1" style={{ color: '#94a3b8' }}>
                                                Current leave quotas and remaining balances are displayed in the cards above.
                                            </small>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="table-responsive border rounded-3" style={{ maxHeight: '340px', overflowY: 'auto', backgroundColor: '#ffffff' }}>
                                <Table hover className="mb-0 fs-12 align-middle">
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                            <th style={{ width: '170px', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.4px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Leave Type</th>
                                            <th style={{ width: '190px', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.4px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Dates & Duration</th>
                                            <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.4px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Reason</th>
                                            <th style={{ width: '130px', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.4px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                                            <th style={{ width: '160px', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.4px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Approved By</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedLeaves.map((item) => {
                                            const daysCount = parseFloat(item.total_days || 0);
                                            const daysDisplay = daysCount === 1 ? '1 day' : `${daysCount} days`;
                                            const approvedDates = item.approved_dates || [];
                                            const allDates = item.dates || [];
                                            const isExpanded = expandedDatesId === item.id;
                                            const isItemApplied =
                                                appliedBalance &&
                                                String(item.leave_type_id) === String(appliedBalance.leave_type_id);

                                            let dateSummary = '';
                                            if (approvedDates.length > 0) {
                                                dateSummary = approvedDates.length === 1
                                                    ? formatDateDMY(approvedDates[0])
                                                    : `${formatDateDMY(approvedDates[0])} to ${formatDateDMY(approvedDates[approvedDates.length - 1])}`;
                                            } else if (allDates.length > 0) {
                                                dateSummary = allDates.length === 1
                                                    ? formatDateDMY(allDates[0].date)
                                                    : `${formatDateDMY(allDates[0].date)} to ${formatDateDMY(allDates[allDates.length - 1].date)}`;
                                            }

                                            return (
                                                <React.Fragment key={item.id}>
                                                    <tr style={isItemApplied && !filterByAppliedType ? { backgroundColor: '#fcfbfe' } : {}}>
                                                        <td style={{ padding: '10px 14px' }}>
                                                            <div className="d-flex align-items-center gap-1.5">
                                                                <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '12.5px' }}>
                                                                    {item.leave_type_name || 'Leave'}
                                                                </span>
                                                                {isItemApplied && !filterByAppliedType && (
                                                                    <span
                                                                        style={{
                                                                            backgroundColor: '#ede9fe',
                                                                            color: '#6d28d9',
                                                                            borderRadius: '4px',
                                                                            padding: '1px 6px',
                                                                            fontSize: '9.5px',
                                                                            fontWeight: 700,
                                                                            textTransform: 'uppercase',
                                                                        }}
                                                                    >
                                                                        Applied
                                                                    </span>
                                                                )}
                                                            </div>
                                                            
                                                        </td>
                                                        <td style={{ padding: '10px 14px' }}>
                                                            <div className="d-flex align-items-center flex-wrap gap-2">
                                                                <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '12px' }}>
                                                                    {dateSummary || '—'}
                                                                </span>
                                                                <span
                                                                    style={{
                                                                        backgroundColor: '#f1f5f9',
                                                                        color: '#334155',
                                                                        border: '1px solid #e2e8f0',
                                                                        borderRadius: '4px',
                                                                        padding: '1px 6px',
                                                                        fontSize: '10.5px',
                                                                        fontWeight: 600,
                                                                        whiteSpace: 'nowrap',
                                                                    }}
                                                                >
                                                                    {daysDisplay}
                                                                </span>
                                                                {allDates.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setExpandedDatesId(isExpanded ? null : item.id)
                                                                        }
                                                                        style={{
                                                                            background: 'none',
                                                                            border: 'none',
                                                                            padding: 0,
                                                                            color: '#4f46e5',
                                                                            fontSize: '11px',
                                                                            fontWeight: 600,
                                                                            cursor: 'pointer',
                                                                            textDecoration: 'none',
                                                                            whiteSpace: 'nowrap',
                                                                        }}
                                                                    >
                                                                        {isExpanded ? 'Hide dates' : `View ${allDates.length} dates`}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '10px 14px' }}>
                                                            <div
                                                                className="text-truncate"
                                                                style={{ maxWidth: '240px', color: '#334155', fontStyle: 'italic', fontSize: '12px' }}
                                                                title={item.reason || 'No reason provided'}
                                                            >
                                                                {item.reason ? `"${item.reason}"` : <span style={{ color: '#94a3b8' }}>—</span>}
                                                            </div>
                                                            {item.decision_remarks && (
                                                                <small className="d-block text-truncate mt-0.5" style={{ maxWidth: '240px', color: '#64748b', fontSize: '10.5px' }} title={item.decision_remarks}>
                                                                    Note: {item.decision_remarks}
                                                                </small>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '10px 14px' }}>
                                                            <div>
                                                                <span
                                                                    style={{
                                                                        display: 'inline-block',
                                                                        padding: '2px 8px',
                                                                        borderRadius: '12px',
                                                                        fontSize: '10.5px',
                                                                        fontWeight: 600,
                                                                        letterSpacing: '0.2px',
                                                                        ...(item.status === 'APPROVED'
                                                                            ? { backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }
                                                                            : item.status === 'PARTIALLY_APPROVED'
                                                                            ? { backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }
                                                                            : item.status === 'REJECTED'
                                                                            ? { backgroundColor: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3' }
                                                                            : { backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }),
                                                                    }}
                                                                >
                                                                    {item.status}
                                                                </span>
                                                            </div>
                                                            
                                                        </td>
                                                        <td style={{ padding: '10px 14px' }}>
                                                            {item.approved_by_name ? (
                                                                <div>
                                                                    <div className="fw-semibold text-truncate" style={{ maxWidth: '150px', color: '#0f172a', fontSize: '12px' }}>
                                                                        {item.approved_by_name}
                                                                    </div>
                                                                    {item.approved_at && (
                                                                        <small className="d-block" style={{ color: '#94a3b8', fontSize: '10.5px' }}>
                                                                            {formatDateDMY(item.approved_at)}
                                                                        </small>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span style={{ color: '#94a3b8', fontSize: '11px' }}>—</span>
                                                            )}
                                                        </td>
                                                    </tr>

                                                    {/* Expanded Dates Row */}
                                                    {isExpanded && (
                                                        <tr style={{ backgroundColor: '#f8fafc' }}>
                                                            <td colSpan="5" className="p-2.5 px-3">
                                                                <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                                                    <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, marginRight: '4px' }}>Dates:</span>
                                                                    {allDates.map((d, idx) => (
                                                                        <span
                                                                            key={idx}
                                                                            style={{
                                                                                backgroundColor: '#ffffff',
                                                                                color: '#1e293b',
                                                                                border: '1px solid #e2e8f0',
                                                                                borderRadius: '6px',
                                                                                padding: '2px 8px',
                                                                                fontSize: '11px',
                                                                                fontWeight: 500,
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '4px',
                                                                            }}
                                                                        >
                                                                            {formatDateDMY(d.date)}{' '}
                                                                            <span
                                                                                style={{
                                                                                    fontSize: '10px',
                                                                                    fontWeight: 700,
                                                                                    color:
                                                                                        d.status === 'APPROVED'
                                                                                            ? '#15803d'
                                                                                            : d.status === 'REJECTED'
                                                                                            ? '#dc2626'
                                                                                            : '#b45309',
                                                                                }}
                                                                            >
                                                                                ({d.status})
                                                                            </span>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </Table>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="modal-footer-custom">
                <span className="text-muted fs-12">
                    {displayedLeaves.length > 0
                        ? `Showing ${displayedLeaves.length} approved leave${displayedLeaves.length !== 1 ? 's' : ''}${
                              filterByAppliedType && appliedBalance ? ` for ${appliedBalance.leave_type_name}` : ''
                          }`
                        : 'No approved leaves recorded'}
                </span>
                <Button
                    type="button"
                    className="btn-close-custom"
                    onClick={onHide}
                >
                    Close
                </Button>
            </div>
        </Modal>
    );
};

export default EmployeeLeaveHistoryModal;
