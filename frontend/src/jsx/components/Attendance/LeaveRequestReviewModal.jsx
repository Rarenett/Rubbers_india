import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, Badge, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    approveLeaveRequest,
    rejectLeaveRequest,
    formatFriendlyError
} from '../../../services/AttendanceService';
import EmployeeLeaveHistoryModal from './EmployeeLeaveHistoryModal';

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

const getDayOfWeek = (dateStr) => {
    if (!dateStr) return '';
    try {
        const dateObj = new Date(dateStr);
        return dateObj.toLocaleDateString(undefined, { weekday: 'short' });
    } catch {
        return '';
    }
};

const LeaveRequestReviewModal = ({ show, onHide, request, onSuccess }) => {
    const [submitting, setSubmitting] = useState(false);
    const [remarks, setRemarks] = useState('');
    // decisions map: { [dateId]: 'APPROVED' | 'REJECTED' }
    const [decisions, setDecisions] = useState({});
    const [showLastLeavesModal, setShowLastLeavesModal] = useState(false);

    useEffect(() => {
        if (show && request) {
            setRemarks('');
            setShowLastLeavesModal(false);
            const rawDates = request.leave_dates || [];
            const initialMap = {};
            rawDates.forEach((d) => {
                // Default to APPROVED, or preserve existing status if already decided
                initialMap[d.id] = d.status === 'REJECTED' ? 'REJECTED' : 'APPROVED';
            });
            setDecisions(initialMap);
        }
    }, [show, request]);

    if (!request) return null;

    const rawDates = request.leave_dates || [];
    const isMultiDate = rawDates.length > 1;

    const handleSetAll = (status) => {
        const next = {};
        rawDates.forEach((d) => {
            next[d.id] = status;
        });
        setDecisions(next);
    };

    const handleToggleDate = (dateId, status) => {
        setDecisions((prev) => ({
            ...prev,
            [dateId]: status
        }));
    };

    const approvedCount = Object.values(decisions).filter((s) => s === 'APPROVED').length;
    const rejectedCount = Object.values(decisions).filter((s) => s === 'REJECTED').length;

    const handleSubmit = async () => {
        const dateDecisions = rawDates.map((d) => ({
            id: d.id,
            status: decisions[d.id] || 'APPROVED'
        }));

        let confirmationTitle = 'Submit Leave Decision?';
        let confirmationText = `You are approving ${approvedCount} date(s) and rejecting ${rejectedCount} date(s).`;
        if (approvedCount === 0) {
            confirmationTitle = 'Reject All Dates?';
            confirmationText = 'All requested dates will be rejected for this leave request.';
        } else if (rejectedCount === 0) {
            confirmationTitle = 'Approve All Dates?';
            confirmationText = `All ${approvedCount} requested date(s) will be approved.`;
        }

        const confirmResult = await Swal.fire({
            title: confirmationTitle,
            text: confirmationText,
            icon: approvedCount > 0 ? 'question' : 'warning',
            showCancelButton: true,
            confirmButtonColor: approvedCount > 0 ? '#0a500f' : '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, Submit Decision'
        });

        if (!confirmResult.isConfirmed) return;

        try {
            setSubmitting(true);
            const payload = {
                date_decisions: dateDecisions,
                remarks: remarks.trim()
            };

            await approveLeaveRequest(request.id, payload);

            Swal.fire({
                icon: 'success',
                title: 'Decision Submitted',
                text: 'Leave request decision has been recorded successfully.',
                timer: 2000,
                showConfirmButton: false
            });

            if (onSuccess) onSuccess();
            onHide();
        } catch (error) {
            const errorMsg = formatFriendlyError(error, 'Failed to submit leave decision');
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal show={show} onHide={onHide} dialogClassName="leave-custom-modal modal-lg" centered>
            <style>{`
                .leave-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .leave-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .leave-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .leave-custom-modal .modal-close-x {
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
                .leave-custom-modal .modal-close-x:hover { color: #555; }
                .leave-custom-modal .modal-body-custom { padding: 24px 28px; }
                .leave-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .leave-custom-modal .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .leave-custom-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .leave-custom-modal .btn-accept-custom,
                .leave-custom-modal .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .leave-custom-modal .btn-accept-custom:hover,
                .leave-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                .leave-custom-modal .btn-danger-custom {
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
                .leave-custom-modal .btn-danger-custom:hover { background-color: #bb2d3b !important; }
                .detail-section-title {
                    font-size: 13px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #64748b;
                    letter-spacing: 0.5px;
                    margin-bottom: 8px;
                }
                .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .review-card {
                    background-color: #f8fafc;
                    border: 1px solid #f1f5f9;
                    border-radius: 12px;
                    padding: 16px 20px;
                    margin-bottom: 20px;
                }
                .date-decision-table th {
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    background-color: #f8fafc;
                    color: #64748b;
                    border-top: none;
                    padding: 8px 12px;
                }
                .date-decision-table td {
                    vertical-align: middle;
                    font-size: 13px;
                    padding: 6px 12px;
                }
                .leave-custom-modal .decision-toggle-group {
                    display: inline-flex !important;
                    align-items: center !important;
                    background-color: #f1f5f9;
                    border-radius: 30px;
                    padding: 2px;
                    border: 1px solid #e2e8f0;
                    gap: 2px;
                }
                .leave-custom-modal .decision-toggle-btn {
                    display: inline-flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 5px !important;
                    padding: 4px 10px !important;
                    height: 26px !important;
                    font-size: 11px !important;
                    font-weight: 600 !important;
                    border-radius: 20px !important;
                    border: none !important;
                    background: transparent !important;
                    color: #64748b !important;
                    cursor: pointer !important;
                    transition: all 0.15s ease-in-out !important;
                    line-height: 1 !important;
                    white-space: nowrap !important;
                    text-transform: none !important;
                    box-shadow: none !important;
                    outline: none !important;
                }
                .leave-custom-modal .decision-toggle-btn i {
                    font-size: 10px !important;
                    display: inline-block !important;
                    margin: 0 !important;
                    line-height: 1 !important;
                }
                .leave-custom-modal .decision-toggle-btn.is-active-approved {
                    background-color: #0a500f !important;
                    color: #ffffff !important;
                    box-shadow: 0 2px 6px rgba(10, 80, 15, 0.35) !important;
                }
                .leave-custom-modal .decision-toggle-btn.is-active-rejected {
                    background-color: #dc3545 !important;
                    color: #ffffff !important;
                    box-shadow: 0 2px 6px rgba(220, 53, 69, 0.35) !important;
                }
                .leave-custom-modal .decision-toggle-btn:not(.is-active-approved):not(.is-active-rejected):hover {
                    color: #1e293b !important;
                    background-color: #e2e8f0 !important;
                }
                .leave-custom-modal .batch-toggle-btn {
                    display: inline-flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    gap: 5px !important;
                    height: 26px !important;
                    padding: 3px 12px !important;
                    font-size: 11px !important;
                    font-weight: 600 !important;
                    border-radius: 20px !important;
                    cursor: pointer !important;
                    line-height: 1 !important;
                    white-space: nowrap !important;
                    transition: all 0.15s ease-in-out !important;
                }
                .leave-custom-modal .batch-btn-approve {
                    border: 1px solid #0a500f !important;
                    background: rgba(10, 80, 15, 0.08) !important;
                    color: #16a34a !important;
                }
                .leave-custom-modal .batch-btn-approve:hover {
                    background: #0a500f !important;
                    color: #ffffff !important;
                }
                .leave-custom-modal .batch-btn-reject {
                    border: 1px solid #dc3545 !important;
                    background: rgba(220, 53, 69, 0.08) !important;
                    color: #dc3545 !important;
                }
                .leave-custom-modal .batch-btn-reject:hover {
                    background: #dc3545 !important;
                    color: #ffffff !important;
                }
            `}</style>

            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" fill="white"/>
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            Review Leave Request
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Request ID No. {request.id} • Specify approval or rejection for each requested date
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide}>&times;</button>
            </div>

            <div className="modal-body-custom">
                {/* Summary Overview */}
                <div className="review-card">
                    <div className="row g-3">
                        <div className="col-md-4">
                            <div className="text-muted fs-12 text-uppercase fw-semibold">Employee / Applicant</div>
                            <div className="fw-bold text-dark fs-14 mt-1 d-flex align-items-center gap-2">
                                <span>{request.employee_name || 'Employee'}</span>
                                
                            </div>
                            {request.employee_department && (
                                <small className="text-muted d-block">{request.employee_department}</small>
                            )}
                        </div>
                        <div className="col-md-4">
                            <div className="text-muted fs-12 text-uppercase fw-semibold">Leave Type</div>
                            <div className="mt-1 d-flex align-items-center gap-1">
                                <span className="fw-bold text-dark fs-14">{request.leave_type_name}</span>
                            </div>
                            <small className="text-muted d-block">
                                {request.leave_type_is_paid ? 'Paid Leave' : 'Unpaid Leave'}
                            </small>
                        </div>
                        <div className="col-md-4">
                            <div className="text-muted fs-12 text-uppercase fw-semibold">Total Requested</div>
                            <div className="fw-bold text-dark fs-14 mt-1">
                                {rawDates.length} {rawDates.length === 1 ? 'day' : 'days'}
                            </div>
                            <small className="text-muted d-block">
                                Submitted on {new Date(request.created_at).toLocaleDateString()}
                            </small>
                        </div>
                        {request.reason && (
                            <div className="col-12 pt-2 border-top">
                                <div className="text-muted fs-12 text-uppercase fw-semibold">Reason Provided</div>
                                <div className="text-dark fs-13 mt-1 fst-italic">"{request.reason}"</div>
                            </div>
                        )}
                        {request.documents && request.documents.length > 0 && (
                            <div className="col-12 pt-2 border-top">
                                <div className="text-muted fs-12 text-uppercase fw-semibold mb-1">
                                    <i className="fa fa-paperclip me-1"></i> Attached Documents ({request.documents.length})
                                </div>
                                <div className="d-flex flex-wrap gap-2">
                                    {request.documents.map((doc) => (
                                        <a
                                            key={doc.id}
                                            href={doc.file_url || doc.file}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="d-flex align-items-center p-2 px-3 rounded-2 border bg-white text-decoration-none shadow-sm"
                                            style={{ fontSize: '13px', color: '#1e293b', minWidth: '200px', maxWidth: '320px' }}
                                            title={doc.file_name || doc.original_name}
                                        >
                                            <i className="fa fa-file-alt text-primary fs-16 me-2"></i>
                                            <div className="overflow-hidden me-auto">
                                                <span className="fw-semibold text-truncate d-block text-dark">
                                                    {doc.file_name || doc.original_name || 'Document'}
                                                </span>
                                            </div>
                                            <i className="fa fa-external-link-alt text-muted fs-11 ms-2"></i>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Banner / Button to view last leaves taken modal */}
                <div
                    className="d-flex align-items-center justify-content-between p-2 px-3 mb-3 rounded"
                    style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                    }}
                >
                    <div className="d-flex align-items-center gap-2">
                        <div
                            style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                backgroundColor: '#e0e7ff',
                                color: '#4338ca',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                            }}
                        >
                            <i className="fa fa-history"></i>
                        </div>
                        <div>
                            
                            <small className="text-muted d-block fs-11">
                                Review previous leaves taken by {request.employee_name || 'this employee'} and remaining quotas before making a decision
                            </small>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="outline-primary"
                        size="sm"
                        className="d-inline-flex align-items-center gap-1 py-1 px-3 fs-12 fw-semibold"
                        style={{ borderRadius: '6px' }}
                        onClick={() => setShowLastLeavesModal(true)}
                    >
                        <i className="fa fa-history"></i>
                        View Previous Leaves
                    </Button>
                </div>

                {/* Dedicated Leave History Modal */}
                <EmployeeLeaveHistoryModal
                    show={showLastLeavesModal}
                    onHide={() => setShowLastLeavesModal(false)}
                    leaveRequestId={request.id}
                    employeeId={request.employee?.id || request.employee}
                    employeeName={request.employee_name}
                    appliedLeaveTypeId={request.leave_type?.id || request.leave_type}
                />

                {/* Date-by-date Decision Section */}
                <div className="mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <div>
                            <div className="detail-section-title mb-0">
                                {isMultiDate ? 'Requested Dates Decision' : 'Requested Date Decision'}
                            </div>
                            <small className="text-muted">
                                {isMultiDate
                                    ? 'Select Approve or Reject for each individual date below:'
                                    : 'Select your decision for this requested leave date:'}
                            </small>
                        </div>

                        {isMultiDate && (
                            <div className="d-flex gap-2">
                                <button
                                    type="button"
                                    className="batch-toggle-btn batch-btn-approve"
                                    onClick={() => handleSetAll('APPROVED')}
                                >
                                    <i className="fa fa-check-double"></i> Approve All
                                </button>
                                <button
                                    type="button"
                                    className="batch-toggle-btn batch-btn-reject"
                                    onClick={() => handleSetAll('REJECTED')}
                                >
                                    <i className="fa fa-times"></i> Reject All
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="table-responsive rounded border" style={{ borderColor: '#f1f5f9' }}>
                        <Table className="date-decision-table mb-0">
                            <thead>
                                <tr>
                                    <th style={{ width: '50px' }}>#</th>
                                    <th>Date</th>
                                    <th>Day</th>
                                    <th className="text-end" style={{ width: '160px' }}>Decision</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rawDates.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="text-center py-3 text-muted">
                                            No specific dates recorded
                                        </td>
                                    </tr>
                                ) : (
                                    rawDates.map((item, index) => {
                                        const currentDecision = decisions[item.id] || 'APPROVED';
                                        const isApproved = currentDecision === 'APPROVED';

                                        return (
                                            <tr
                                                key={item.id}
                                                style={{
                                                    backgroundColor: isApproved
                                                        ? 'rgba(10, 80, 15, 0.04)'
                                                        : 'rgba(235, 87, 87, 0.04)'
                                                }}
                                            >
                                                <td className="fw-semibold text-muted">{index + 1}</td>
                                                <td className="fw-bold text-dark">
                                                    {formatDateDMY(item.date)}
                                                </td>
                                                <td className="text-muted">
                                                    {getDayOfWeek(item.date)}
                                                </td>
                                                <td className="text-end">
                                                    <div className="decision-toggle-group">
                                                        <button
                                                            type="button"
                                                            className={`decision-toggle-btn ${
                                                                isApproved ? 'is-active-approved' : ''
                                                            }`}
                                                            onClick={() => handleToggleDate(item.id, 'APPROVED')}
                                                        >
                                                            <i className="fa fa-check"></i>
                                                            <span>Approve</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`decision-toggle-btn ${
                                                                !isApproved ? 'is-active-rejected' : ''
                                                            }`}
                                                            onClick={() => handleToggleDate(item.id, 'REJECTED')}
                                                        >
                                                            <i className="fa fa-times"></i>
                                                            <span>Reject</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </Table>
                    </div>

                    {/* Decision Counter Bar */}
                    <div className="d-flex justify-content-between align-items-center mt-2 px-1">
                        <span className="text-muted fs-12">
                            Total: {rawDates.length} date{rawDates.length === 1 ? '' : 's'}
                        </span>
                        
                    </div>
                </div>

                {/* Reviewer Remarks */}
                <div>
                    <Form.Label className="form-label-custom">
                        Reviewer Remarks / Notes <small className="text-muted fw-normal">(Optional)</small>
                    </Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={3}
                        className="form-control-custom"
                        placeholder="Add remarks or notes explaining the decision to the employee..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                    />
                </div>
            </div>

            <div className="modal-footer-custom">
                <div className="d-flex align-items-center gap-2">
                    <span className="text-muted fs-13 fw-semibold">Decision:</span>
                    <span className={`badge light badge-${approvedCount > 0 && rejectedCount > 0 ? 'primary' : approvedCount > 0 ? 'success' : 'danger'} fs-12 fw-bold`}>
                        {approvedCount > 0 && rejectedCount > 0
                            ? `Partial Approval (${approvedCount} Approved, ${rejectedCount} Rejected)`
                            : approvedCount > 0
                            ? `Full Approval (${approvedCount} Approved)`
                            : `Full Rejection (${rejectedCount} Rejected)`}
                    </span>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <Button
                        type="button"
                        variant="outline-primary"
                        size="sm"
                        className="d-inline-flex align-items-center gap-1 py-2 px-3 fs-13 fw-semibold"
                        style={{ borderRadius: '8px' }}
                        onClick={() => setShowLastLeavesModal(true)}
                        title="View employee's previous leave history and quotas"
                    >
                        <i className="fa fa-history"></i>
                        Leave History
                    </Button>
                    <Button
                        type="button"
                        className="btn-close-custom"
                        onClick={onHide}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        className={approvedCount > 0 ? 'btn-save-custom' : 'btn-danger-custom'}
                        onClick={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                                Submitting...
                            </>
                        ) : (
                            <>
                                <i className={`fa ${approvedCount > 0 ? 'fa-check' : 'fa-times'} me-1`}></i> Confirm Decision
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default LeaveRequestReviewModal;
