import React, { useState, useEffect } from 'react';
import { Badge, Table, Spinner } from 'react-bootstrap';
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

const EmployeeLeaveHistorySection = ({
    leaveRequestId = null,
    employeeId = null,
    employeeName = '',
    defaultOpen = true,
}) => {
    const [loading, setLoading] = useState(false);
    const [historyData, setHistoryData] = useState(null);
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [activeTab, setActiveTab] = useState('taken'); // 'taken' | 'all'
    const [expandedDatesId, setExpandedDatesId] = useState(null);

    useEffect(() => {
        if (leaveRequestId || employeeId) {
            fetchHistory();
        }
    }, [leaveRequestId, employeeId]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const params = {};
            if (leaveRequestId) params.leave_request = leaveRequestId;
            if (employeeId) params.employee = employeeId;
            // Include exclude_current=true by default so the current request is not shown as a past taken leave
            params.exclude_current = true;

            const data = await getEmployeeLeaveHistory(params);
            setHistoryData(data);
        } catch (err) {
            console.error('Error fetching employee leave history:', err);
            setHistoryData(null);
        } finally {
            setLoading(false);
        }
    };

    const leavesTaken = historyData?.leaves_taken || [];
    const balances = historyData?.balances || {};
    const balanceList = Object.values(balances);

    const applicantDisplayName =
        historyData?.employee?.name || employeeName || 'Employee';

    return (
        <div
            className="mb-3 rounded-3 border"
            style={{
                backgroundColor: '#ffffff',
                borderColor: '#e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden',
            }}
        >
            {/* Header Toolbar */}
            <div
                className="d-flex align-items-center justify-content-between p-3"
                style={{
                    backgroundColor: '#f8fafc',
                    borderBottom: isOpen ? '1px solid #e2e8f0' : 'none',
                    cursor: 'pointer',
                    userSelect: 'none',
                }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="d-flex align-items-center gap-2">
                    <div
                        style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            backgroundColor: '#e8faf2',
                            color: '#2ece8a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '13px',
                        }}
                    >
                        <i className="fa fa-history"></i>
                    </div>
                    <div>
                        <span className="fw-bold text-dark fs-13">
                            {title}
                        </span>
                        <span className="text-muted fs-12 ms-2">
                            • {applicantDisplayName}
                        </span>
                    </div>
                    {leavesTaken.length > 0 && (
                        <span
                            className="badge ms-1"
                            style={{
                                backgroundColor: '#e0f2fe',
                                color: '#0369a1',
                                fontSize: '11px',
                                fontWeight: 600,
                            }}
                        >
                            {leavesTaken.length} previous leave{leavesTaken.length !== 1 ? 's' : ''} taken
                        </span>
                    )}
                </div>

                
            </div>

            {/* Collapsible Content */}
            {isOpen && (
                <div className="p-3">
                    {loading && !historyData ? (
                        <div className="text-center py-4 text-muted">
                            <Spinner animation="border" size="sm" className="me-2 text-primary" />
                            <span className="fs-12">Loading leave history & balances...</span>
                        </div>
                    ) : (
                        <>
                            {/* Leave Quota & Remaining Balance Strip */}
                            {balanceList.length > 0 && (
                                <div className="mb-3">
                                    <div
                                        className="text-muted fs-11 text-uppercase fw-bold mb-2"
                                        style={{ letterSpacing: '0.5px' }}
                                    >
                                        Current Leave Balances & Quotas
                                    </div>
                                    <div className="d-flex flex-wrap gap-2">
                                        {balanceList.map((bal) => {
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
                                                    className="p-2 px-3 rounded-2 border d-flex flex-column"
                                                    style={{
                                                        backgroundColor: isZero
                                                            ? '#fff1f2'
                                                            : isLow
                                                            ? '#fffbeb'
                                                            : '#f8fafc',
                                                        borderColor: isZero
                                                            ? '#fecdd3'
                                                            : isLow
                                                            ? '#fde68a'
                                                            : '#e2e8f0',
                                                        minWidth: '130px',
                                                        flex: '1 1 auto',
                                                    }}
                                                >
                                                    <div className="d-flex align-items-center justify-content-between gap-1 mb-1">
                                                        <span className="fw-semibold text-dark fs-12 text-truncate">
                                                            {bal.leave_type_name || `Leave #${bal.leave_type_id}`}
                                                        </span>
                                                        {bal.leave_type_code && (
                                                            <span className="badge bg-light text-dark border fs-10 py-0">
                                                                {bal.leave_type_code}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="d-flex align-items-baseline gap-1">
                                                        <span
                                                            className="fs-16 fw-bold"
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
                                                    <div className="fs-10 text-muted mt-1">
                                                        Quota: {totalInDisplay} • Used: {totalOutDisplay}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Title bar for Leaves Taken */}
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <div className="d-flex align-items-center gap-2">
                                    <span className="text-muted fs-11 text-uppercase fw-bold" style={{ letterSpacing: '0.5px' }}>
                                        Leaves Taken ({leavesTaken.length})
                                    </span>
                                </div>

                                {leavesTaken.length > 0 && (
                                    <small className="text-muted fs-11">
                                        Total past leaves taken: <strong>{historyData?.total_days_taken || 0} days</strong>
                                    </small>
                                )}
                            </div>

                            {/* Detailed List / Table */}
                            {leavesTaken.length === 0 ? (
                                <div
                                    className="p-3 text-center rounded-2 border bg-light text-muted fs-12"
                                    style={{ borderStyle: 'dashed' }}
                                >
                                    <i className="fa fa-info-circle me-1 text-info"></i>
                                    No previous approved leaves taken by {applicantDisplayName}.
                                </div>
                            ) : (
                                <div className="table-responsive border rounded-2" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                                    <Table hover className="mb-0 fs-12 align-middle">
                                        <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                                            <tr className="text-muted text-uppercase fs-11">
                                                <th style={{ width: '150px' }}>Leave Type</th>
                                                <th style={{ width: '180px' }}>Dates & Duration</th>
                                                <th>Reason</th>
                                                <th style={{ width: '120px' }}>Status</th>
                                                <th style={{ width: '160px' }}>Approved By</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {leavesTaken.map((item) => {
                                                const daysCount = parseFloat(item.total_days || 0);
                                                const daysDisplay = daysCount === 1 ? '1 day' : `${daysCount} days`;
                                                const approvedDates = item.approved_dates || [];
                                                const allDates = item.dates || [];
                                                const isExpanded = expandedDatesId === item.id;

                                                // Date summary string
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
                                                        <tr>
                                                            <td>
                                                                <div className="fw-semibold text-dark">
                                                                    {item.leave_type_name || 'Leave'}
                                                                </div>
                                                                <div className="d-flex align-items-center gap-1">
                                                                    {item.leave_type_code && (
                                                                        <span className="badge light badge-primary fs-10 py-0">
                                                                            {item.leave_type_code}
                                                                        </span>
                                                                    )}
                                                                    <small className="text-muted fs-10">
                                                                        {item.leave_type_is_paid ? 'Paid' : 'Unpaid'}
                                                                    </small>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div className="d-flex align-items-center gap-1">
                                                                    <i className="fa fa-calendar-alt text-primary fs-11"></i>
                                                                    <span className="fw-semibold text-dark">
                                                                        {dateSummary || '—'}
                                                                    </span>
                                                                </div>
                                                                <div className="d-flex align-items-center gap-1 mt-1">
                                                                    <span className="badge bg-light text-dark border fs-10">
                                                                        {daysDisplay}
                                                                    </span>
                                                                    {allDates.length > 1 && (
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-link p-0 text-primary fs-10 text-decoration-none"
                                                                            onClick={() =>
                                                                                setExpandedDatesId(isExpanded ? null : item.id)
                                                                            }
                                                                        >
                                                                            {isExpanded ? 'Hide dates' : `View ${allDates.length} dates`}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div
                                                                    className="text-dark fst-italic text-truncate"
                                                                    style={{ maxWidth: '200px' }}
                                                                    title={item.reason || 'No reason provided'}
                                                                >
                                                                    {item.reason ? `"${item.reason}"` : <span className="text-muted">—</span>}
                                                                </div>
                                                                {item.decision_remarks && (
                                                                    <small className="text-muted d-block text-truncate" style={{ maxWidth: '200px' }} title={item.decision_remarks}>
                                                                        Note: {item.decision_remarks}
                                                                    </small>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <div>
                                                                    <span
                                                                        className={`badge light badge-${
                                                                            item.status === 'APPROVED'
                                                                                ? 'success'
                                                                                : item.status === 'PARTIALLY_APPROVED'
                                                                                ? 'primary'
                                                                                : item.status === 'REJECTED'
                                                                                ? 'danger'
                                                                                : item.status === 'CANCELLED'
                                                                                ? 'secondary'
                                                                                : 'warning'
                                                                        } fs-10`}
                                                                    >
                                                                        {item.status}
                                                                    </span>
                                                                </div>
                                                                {item.employee_decision && (
                                                                    <small
                                                                        className={`d-block fs-10 fw-semibold ${
                                                                            item.employee_decision === 'ACCEPTED'
                                                                                ? 'text-success'
                                                                                : item.employee_decision === 'DECLINED'
                                                                                ? 'text-danger'
                                                                                : 'text-warning'
                                                                        }`}
                                                                    >
                                                                        Emp: {item.employee_decision}
                                                                    </small>
                                                                )}
                                                            </td>
                                                            <td>
                                                                {item.approved_by_name ? (
                                                                    <div>
                                                                        <div className="text-dark fw-semibold text-truncate" style={{ maxWidth: '140px' }}>
                                                                            {item.approved_by_name}
                                                                        </div>
                                                                        {item.approved_at && (
                                                                            <small className="text-muted d-block fs-10">
                                                                                {formatDateDMY(item.approved_at)}
                                                                            </small>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-muted fs-11">—</span>
                                                                )}
                                                            </td>
                                                        </tr>

                                                        {/* Expanded Dates Row */}
                                                        {isExpanded && (
                                                            <tr style={{ backgroundColor: '#f8fafc' }}>
                                                                <td colSpan="5" className="p-2 px-3">
                                                                    <div className="d-flex align-items-center gap-1 flex-wrap">
                                                                        <span className="text-muted fs-11 me-1">Dates:</span>
                                                                        {allDates.map((d, idx) => (
                                                                            <span
                                                                                key={idx}
                                                                                className="badge bg-white text-dark border me-1 fs-11"
                                                                            >
                                                                                {formatDateDMY(d.date)}{' '}
                                                                                <span
                                                                                    className={`text-${
                                                                                        d.status === 'APPROVED'
                                                                                            ? 'success'
                                                                                            : d.status === 'REJECTED'
                                                                                            ? 'danger'
                                                                                            : 'warning'
                                                                                    }`}
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
            )}
        </div>
    );
};

export default EmployeeLeaveHistorySection;
