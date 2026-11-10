import React, { useState } from 'react';
import { Modal, Button, Badge, Row, Col } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    cancelLeaveRequest,
    acceptLeaveRequest,
    formatFriendlyError
} from '../../../services/AttendanceService';
import LeaveRequestDeclineModal from './LeaveRequestDeclineModal';

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

const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getFileIcon = (fileName = '') => {
    const ext = String(fileName).split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'fa-file-image text-primary';
    if (['pdf'].includes(ext)) return 'fa-file-pdf text-danger';
    if (['doc', 'docx'].includes(ext)) return 'fa-file-word text-info';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'fa-file-excel text-success';
    return 'fa-file-alt text-secondary';
};

const LeaveRequestDetailModal = ({ show, onHide, request, onSuccess, onReview, onForward }) => {
    const [actionLoading, setActionLoading] = useState(false);
    const [showDeclineModal, setShowDeclineModal] = useState(false);

    if (!request) return null;

    const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
    const loggedInUser = userDetails?.user || userDetails;
    const isSuperuser = Boolean(loggedInUser?.is_superuser);
    const isHandler = request.current_handler && String(request.current_handler) === String(loggedInUser?.id);
    const canReviewOrForward = ['PENDING', 'FORWARDED'].includes(request.status) && (isSuperuser || isHandler);
    const isApplicant = Boolean(
        (request.employee_user_id && String(request.employee_user_id) === String(loggedInUser?.id)) ||
        (request.employee_email && loggedInUser?.email && String(request.employee_email).toLowerCase() === String(loggedInUser?.email).toLowerCase())
    );
    const canCancel = isApplicant && ['PENDING', 'FORWARDED'].includes(request.status);
    const canAcceptOrDecline = ['APPROVED', 'PARTIALLY_APPROVED'].includes(request.status) && isApplicant && (!request.employee_decision || request.employee_decision === 'PENDING');

    const handleCancel = async () => {
        const result = await Swal.fire({
            title: 'Cancel Request?',
            text: 'Are you sure you want to cancel this leave request?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, Cancel'
        });

        if (result.isConfirmed) {
            try {
                setActionLoading(true);
                await cancelLeaveRequest(request.id);
                Swal.fire({ icon: 'success', title: 'Cancelled', text: 'Leave request has been cancelled.', timer: 2000, showConfirmButton: false });
                if (onSuccess) onSuccess();
                onHide();
            } catch (error) {
                const errorMsg = formatFriendlyError(error, 'Failed to cancel request');
                Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
            } finally {
                setActionLoading(false);
            }
        }
    };

    const handleAccept = async () => {
        const result = await Swal.fire({
            title: 'Accept Leave?',
            text: 'Are you sure you want to accept this leave request?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#0a500f',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, Accept Leave'
        });

        if (result.isConfirmed) {
            try {
                setActionLoading(true);
                await acceptLeaveRequest(request.id);
                Swal.fire({
                    icon: 'success',
                    title: 'Accepted',
                    text: 'Leave request accepted successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
                if (onSuccess) onSuccess();
                onHide();
            } catch (error) {
                const errorMsg = formatFriendlyError(error, 'Failed to accept leave request');
                Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
            } finally {
                setActionLoading(false);
            }
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
                    background-color: #0a500f;
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
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .leave-custom-modal .btn-close-custom {
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
                .leave-custom-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
                .leave-custom-modal .btn-cancel-request-custom {
                    background-color: #fff !important;
                    color: #dc3545 !important;
                    border: 1px solid #dc3545 !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .leave-custom-modal .btn-cancel-request-custom:hover {
                    background-color: #dc3545 !important;
                    color: white !important;
                }
                .leave-custom-modal .btn-accept-custom {
                    background-color: #0a500f !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .leave-custom-modal .btn-accept-custom:hover { background-color: #073d0b !important; }
                .leave-custom-modal .btn-decline-custom {
                    background-color: #fff !important;
                    color: #dc3545 !important;
                    border: 1px solid #dc3545 !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .leave-custom-modal .btn-decline-custom:hover {
                    background-color: #dc3545 !important;
                    color: white !important;
                }
                .detail-section-title {
                    font-size: 13px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #64748b;
                    letter-spacing: 0.5px;
                    margin-bottom: 10px;
                }
                .timeline-card {
                    border-left: 3px solid #0a500f;
                    padding: 10px 14px;
                    background-color: #f8fafc;
                    margin-bottom: 8px;
                    border-radius: 0 8px 8px 0;
                }
                .date-badge-item {
                    display: inline-block;
                    padding: 5px 10px;
                    background: #f8fafc;
                    border: 1px solid #f1f5f9;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    margin: 3px;
                }
            `}</style>

            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="white"/>
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            Leave Request Details
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Request ID No. {request.id} • Submitted on {new Date(request.created_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide}>&times;</button>
            </div>

            <div className="modal-body-custom">
                {/* HR View Notice if not the reporting manager */}
                {!canReviewOrForward && !isApplicant && ['PENDING', 'FORWARDED'].includes(request.status) && (
                    <div className="alert alert-info py-2 px-3 mb-3 d-flex align-items-center gap-2" style={{ fontSize: '13px', borderRadius: '8px' }}>
                        <i className="fa fa-info-circle"></i>
                        <span>Viewing as HR Management. Only the assigned reporting manager (<strong>{request.current_handler_name || 'Reporting Manager'}</strong>) can review and make a decision on this leave request.</span>
                    </div>
                )}

                {/* Status & Overview Bar */}
                <div
                    className="d-flex flex-wrap justify-content-between align-items-center p-3 mb-3 rounded-3"
                    style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', gap: '12px' }}
                >
                    <div>
                        <span className="text-muted fs-12 d-block">Current Status</span>
                        <span className={`badge light badge-${STATUS_BADGE_MAP[request.status] || 'secondary'} fs-14 fw-bold`}>
                            {request.status === 'PARTIALLY_APPROVED' ? 'PARTIALLY APPROVED' : request.status}
                        </span>
                    </div>
                    {(['APPROVED', 'PARTIALLY_APPROVED'].includes(request.status) || request.status === 'CANCELLED') && (
                        <div>
                            <span className="text-muted fs-12 d-block">Employee Status</span>
                            {request.status === 'CANCELLED' ? (
                                <span className="badge light badge-secondary fs-14 fw-bold">
                                    <i className="fa fa-ban me-1"></i>Cancelled
                                </span>
                            ) : request.employee_decision === 'ACCEPTED' ? (
                                <span className="badge light badge-success fs-14 fw-bold">
                                    <i className="fa fa-check me-1"></i>Accepted
                                </span>
                            ) : request.employee_decision === 'DECLINED' ? (
                                <span className="badge light badge-danger fs-14 fw-bold">
                                    <i className="fa fa-times me-1"></i>Declined
                                </span>
                            ) : (
                                <span className="badge light badge-warning fs-14 fw-bold">
                                    <i className="fa fa-clock me-1"></i>Awaiting Response
                                </span>
                            )}
                        </div>
                    )}
                    <div>
                        <span className="text-muted fs-12 d-block">Employee</span>
                        <span className="fw-bold text-dark fs-14">{request.employee_name}</span>
                        {request.employee_department && (
                            <small className="text-muted d-block">{request.employee_department}</small>
                        )}
                    </div>
                    <div>
                        <span className="text-muted fs-12 d-block">Leave Category</span>
                        <span className="fw-bold text-dark fs-14">
                            {request.leave_type_name} ({request.leave_type_code})
                        </span>
                        <span className={`badge light badge-${request.leave_type_is_paid ? 'success' : 'warning'} ms-1`}>
                            {request.leave_type_is_paid ? 'Paid' : 'Unpaid'}
                        </span>
                    </div>
                    <div>
                        <span className="text-muted fs-12 d-block">Total Days</span>
                        <span className="fw-bold text-primary fs-16">{formatDays(request.total_days)}</span>
                    </div>
                </div>

                {/* Reason Section */}
                <div className="mb-3">
                    <div className="detail-section-title">Reason for Leave</div>
                    <div className="p-3 border rounded-3 bg-white text-dark fs-13" style={{ minHeight: '60px' }}>
                        {request.reason || 'No reason provided.'}
                    </div>
                </div>

                {/* Attached Documents */}
                {request.documents && request.documents.length > 0 && (
                    <div className="mb-3">
                        <div className="detail-section-title">
                            <i className="fa fa-paperclip me-1 text-muted"></i>
                            Attached Documents ({request.documents.length})
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
                                    <i className={`fa ${getFileIcon(doc.file_name || doc.original_name)} fs-18 me-2`}></i>
                                    <div className="overflow-hidden me-auto">
                                        <span className="fw-semibold text-truncate d-block text-dark">
                                            {doc.file_name || doc.original_name || 'Document'}
                                        </span>
                                        {doc.file_size && (
                                            <small className="text-muted">{formatFileSize(doc.file_size)}</small>
                                        )}
                                    </div>
                                    <i className="fa fa-external-link-alt text-muted fs-11 ms-2"></i>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Dates Breakdown */}
                <div className="mb-3">
                    <div className="detail-section-title">
                        Requested Dates ({request.leave_dates?.length || 0})
                    </div>
                    <div className="d-flex flex-wrap">
                        {request.leave_dates && request.leave_dates.length > 0 ? (
                            request.leave_dates.map((d) => (
                                <span key={d.id || d.date} className="date-badge-item">
                                    <i className="fa fa-calendar-day text-primary me-1"></i>
                                    {formatDateDMY(d.date)}
                                    <span className={`badge light badge-${d.status === 'APPROVED' ? 'success' : d.status === 'REJECTED' ? 'danger' : 'warning'} ms-2`}>
                                        {d.status}
                                    </span>
                                </span>
                            ))
                        ) : (
                            <span className="text-muted fs-13">No dates recorded</span>
                        )}
                    </div>
                </div>

                {/* Current Approver Indicator */}
                {request.current_handler_name && ['PENDING', 'FORWARDED'].includes(request.status) && (
                    <div className="alert alert-light py-2 px-3 mb-3 border rounded-3 d-flex align-items-center">
                        <i className="fa fa-user-clock text-primary me-2 fs-15"></i>
                        <span className="fs-13">
                            Currently assigned to approver: <strong>{request.current_handler_name}</strong>
                        </span>
                    </div>
                )}

                {/* Employee Action Notice when Awaiting Decision */}
                {canAcceptOrDecline && (
                    <div className="alert alert-info py-2 px-3 mb-3 d-flex align-items-center">
                        <i className="fa fa-info-circle me-2 fs-15 text-info"></i>
                        <span className="fs-13">
                            This leave request has been <strong>{request.status === 'PARTIALLY_APPROVED' ? 'partially approved' : 'approved'}</strong>. Please <strong>Accept</strong> or <strong>Decline</strong> this leave using the buttons below.
                        </span>
                    </div>
                )}

                {/* Employee Decision Status Notices */}
                {['APPROVED', 'PARTIALLY_APPROVED'].includes(request.status) && request.employee_decision === 'ACCEPTED' && (
                    <div
                        className="py-2 px-3 mb-3 d-flex align-items-center rounded-3 border"
                        style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', fontSize: '13px' }}
                    >
                        <i className="fa fa-check-circle me-2 fs-15 text-success"></i>
                        <span className="text-dark">
                            Employee <strong className="text-success">accepted</strong> this leave{request.employee_accepted_at ? ` on ${new Date(request.employee_accepted_at).toLocaleString()}` : ''}.
                        </span>
                    </div>
                )}
                

                {/* Approval & Response Details */}
                {(request.approved_by_name || request.decision_remarks || request.employee_decline_reason || request.employee_accepted_at || request.employee_declined_at) && (
                    <div className="mb-3 p-3 rounded-3" style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                        <div className="detail-section-title">Decision & Response Log</div>
                        {request.approved_by_name && (
                            <div className="fs-13 mb-1">
                                <strong>Decision By:</strong> {request.approved_by_name}{' '}
                                {request.approved_at && (
                                    <span className="text-muted">
                                        on {new Date(request.approved_at).toLocaleString()}
                                    </span>
                                )}
                            </div>
                        )}
                        {request.decision_remarks && (
                            <div className="fs-13 text-muted mb-1">
                                <strong>Decision Remarks:</strong> <em>"{request.decision_remarks}"</em>
                            </div>
                        )}
                        {request.employee_accepted_at && (
                            <div className="fs-13 text-success">
                                <i className="fa fa-check-circle me-1"></i>
                                Employee accepted on {new Date(request.employee_accepted_at).toLocaleString()}
                            </div>
                        )}
                        {request.employee_declined_at && (
                            <div className="fs-13 text-danger">
                                <i className="fa fa-times-circle me-1"></i>
                                Employee declined on {new Date(request.employee_declined_at).toLocaleString()}:{' '}
                                <em>"{request.employee_decline_reason}"</em>
                            </div>
                        )}
                    </div>
                )}

                {/* Forwarding History Timeline */}
                {request.forwarding_history && request.forwarding_history.length > 0 && (
                    <div className="mb-3">
                        <div className="detail-section-title">Forwarding History</div>
                        {request.forwarding_history.map((f) => (
                            <div key={f.id} className="timeline-card">
                                <div className="d-flex justify-content-between align-items-center">
                                    <span className="fs-13 fw-bold text-dark">
                                        {f.forwarded_by_name || 'User'} &rarr; {f.forwarded_to_name || 'Approver'}
                                    </span>
                                    <small className="text-muted">
                                        {new Date(f.forwarded_at).toLocaleString()}
                                    </small>
                                </div>
                                {f.remarks && (
                                    <div className="fs-12 text-muted mt-1">
                                        <strong>Remarks:</strong> {f.remarks}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Actions Footer */}
            <div className="modal-footer-custom">
                {canReviewOrForward && (
                    <>
                        <Button
                            type="button"
                            className="btn btn-outline-primary shadow-sm"
                            style={{ borderRadius: '8px', fontSize: '13px', padding: '9px 18px' }}
                            onClick={() => {
                                onHide();
                                if (onForward) onForward(request);
                            }}
                        >
                            <i className="fa fa-share me-1"></i> Forward
                        </Button>
                        <Button
                            type="button"
                            className="btn btn-success text-white shadow-sm"
                            style={{ borderRadius: '8px', fontSize: '13px', padding: '9px 18px' }}
                            onClick={() => {
                                onHide();
                                if (onReview) onReview(request);
                            }}
                        >
                            <i className="fa fa-clipboard-check me-1"></i> Review & Decide
                        </Button>
                    </>
                )}

                {canCancel && (
                    <Button
                        type="button"
                        className="btn-cancel-request-custom"
                        onClick={handleCancel}
                        disabled={actionLoading}
                    >
                        Cancel Request
                    </Button>
                )}

                {canAcceptOrDecline && (
                    <>
                        <Button
                            type="button"
                            className="btn-decline-custom"
                            onClick={() => setShowDeclineModal(true)}
                            disabled={actionLoading}
                        >
                            <i className="fa fa-times me-1"></i> Decline
                        </Button>
                        <Button
                            type="button"
                            className="btn-accept-custom"
                            onClick={handleAccept}
                            disabled={actionLoading}
                        >
                            <i className="fa fa-check me-1"></i> Accept Leave
                        </Button>
                    </>
                )}

                <Button
                    type="button"
                    className="btn-close-custom"
                    onClick={onHide}
                >
                    Close
                </Button>
            </div>

            {/* Dedicated Decline Leave Modal */}
            <LeaveRequestDeclineModal
                show={showDeclineModal}
                onHide={() => setShowDeclineModal(false)}
                request={request}
                onSuccess={() => {
                    if (onSuccess) onSuccess();
                    onHide();
                }}
            />
        </Modal>
    );
};

export default LeaveRequestDetailModal;
