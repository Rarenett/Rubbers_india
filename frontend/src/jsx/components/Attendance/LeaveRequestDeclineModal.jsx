import React, { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { declineLeaveRequest, formatFriendlyError } from '../../../services/AttendanceService';

const PRESET_REASONS = [
    'Work schedule / project priorities changed',
    'Personal plans cancelled',
    'Will re-apply for different dates',
    'Emergency situation resolved',
];

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

const LeaveRequestDeclineModal = ({ show, onHide, request, onSuccess }) => {
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!request) return null;

    const handleSelectPreset = (preset) => {
        if (!reason.trim()) {
            setReason(preset);
        } else if (!reason.includes(preset)) {
            setReason(`${reason.trim()}. ${preset}`);
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        try {
            setSubmitting(true);
            await declineLeaveRequest(request.id, { reason: reason.trim() });
            Swal.fire({
                icon: 'success',
                title: 'Leave Declined',
                text: 'You have successfully declined this leave request.',
                timer: 2000,
                showConfirmButton: false,
            });
            setReason('');
            if (onSuccess) onSuccess();
            onHide();
        } catch (error) {
            const errorMsg = formatFriendlyError(error, 'Failed to decline leave request');
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorMsg,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const datesList = request.leave_dates || [];
    const firstDate = datesList.length > 0 ? formatDateDMY(datesList[0].date) : '';
    const lastDate = datesList.length > 1 ? formatDateDMY(datesList[datesList.length - 1].date) : '';

    return (
        <Modal show={show} onHide={onHide} dialogClassName="leave-custom-modal modal-md" centered>
            <style>{`
                .leave-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.14) !important;
                    overflow: hidden;
                }
                .leave-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 22px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .leave-custom-modal .modal-icon-circle-danger {
                    width: 46px;
                    height: 46px;
                    background-color: #ef4444;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 14px rgba(239, 68, 68, 0.28);
                    flex-shrink: 0;
                }
                .leave-custom-modal .modal-close-x {
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    color: #94a3b8;
                    cursor: pointer;
                    transition: color 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                }
                .leave-custom-modal .modal-close-x:hover { color: #334155; }
                .leave-custom-modal .modal-body-custom { padding: 22px 28px; }
                .leave-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 18px 28px 22px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .leave-custom-modal .btn-cancel-custom {
                    background-color: #7A70BA !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 9px 22px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .leave-custom-modal .btn-cancel-custom:hover { background-color: #6357a7 !important; }
                .leave-custom-modal .btn-confirm-decline {
                    background-color: #ef4444 !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 9px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.25);
                    transition: all 0.2s;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .leave-custom-modal .btn-confirm-decline:hover {
                    background-color: #dc2626 !important;
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35);
                }
                .leave-custom-modal .preset-reason-pill {
                    background-color: #f1f5f9;
                    color: #475569;
                    border: 1px solid #e2e8f0;
                    border-radius: 20px;
                    padding: 4px 12px;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    user-select: none;
                }
                .leave-custom-modal .preset-reason-pill:hover {
                    background-color: #fee2e2;
                    color: #b91c1c;
                    border-color: #fca5a5;
                }
            `}</style>

            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle-danger">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            Decline Approved Leave
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Request ID No. {request.id} • {request.employee_name || 'Your Request'}
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide} disabled={submitting}>
                    &times;
                </button>
            </div>

            <Form onSubmit={handleSubmit}>
                <div className="modal-body-custom">
                    {/* Summary Info Card */}
                    <div
                        className="p-3 mb-3 rounded-3"
                        style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
                    >
                        <div className="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <span className="fw-bold text-dark fs-14 d-block">
                                    {request.leave_type_name || 'Leave Request'}
                                    {request.leave_type_code && (
                                        <span className="badge light badge-primary ms-2" style={{ fontSize: '11px' }}>
                                            {request.leave_type_code}
                                        </span>
                                    )}
                                </span>
                                <small className="text-muted">
                                    Duration: <strong className="text-dark">{formatDays(request.total_days)}</strong>
                                    {firstDate && (
                                        <span>
                                            {' '}&bull; {firstDate}
                                            {lastDate && ` to ${lastDate}`}
                                        </span>
                                    )}
                                </small>
                            </div>
                            <span className={`badge light badge-${request.status === 'PARTIALLY_APPROVED' ? 'primary' : 'success'} fs-12 fw-bold`}>
                                {request.status === 'PARTIALLY_APPROVED' ? 'Partially Approved' : 'Approved'}
                            </span>
                        </div>
                    </div>

                    {/* Notice alert */}
                    <div
                        className="py-2 px-3 mb-3 d-flex align-items-center rounded-3 border"
                        style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', fontSize: '12.5px' }}
                    >
                        <i className="fa fa-info-circle me-2 fs-14 text-muted"></i>
                        <span className="text-dark">
                            You are declining this leave. Your reporting manager and HR will be notified of your decision.
                        </span>
                    </div>

                    {/* Quick Reasons */}
                    <div className="mb-2">
                        <small className="text-muted fw-bold d-block mb-1" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Quick Reasons (Click to add)
                        </small>
                        <div className="d-flex flex-wrap gap-1 mb-2">
                            {PRESET_REASONS.map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    className="preset-reason-pill"
                                    onClick={() => handleSelectPreset(preset)}
                                >
                                    + {preset}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Reason Textarea */}
                    <Form.Group className="mb-1">
                        <Form.Label className="fs-13 fw-semibold text-dark mb-1">
                            Reason for Declining <span className="text-muted font-weight-normal">(Optional)</span>
                        </Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            placeholder="Enter the reason why you are declining this approved leave..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            style={{
                                borderRadius: '8px',
                                fontSize: '13px',
                                borderColor: '#cbd5e1',
                                resize: 'vertical',
                            }}
                        />
                    </Form.Group>
                </div>

                <div className="modal-footer-custom">
                    <Button
                        type="button"
                        className="btn-cancel-custom"
                        onClick={onHide}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        className="btn-confirm-decline"
                        disabled={submitting}
                    >
                        {submitting ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                Declining...
                            </>
                        ) : (
                            <>
                                <i className="fa fa-times"></i>
                                Decline Leave
                            </>
                        )}
                    </Button>
                </div>
            </Form>
        </Modal>
    );
};

export default LeaveRequestDeclineModal;
