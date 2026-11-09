import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    forwardLeaveRequest,
    getForwardRecipients,
    formatFriendlyError
} from '../../../services/AttendanceService';

const LeaveRequestForwardModal = ({ show, onHide, request, onSuccess }) => {
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [targetUserId, setTargetUserId] = useState('');
    const [remarks, setRemarks] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
    const loggedInUser = userDetails?.user || userDetails;

    useEffect(() => {
        if (show && request?.id) {
            setTargetUserId('');
            setRemarks('');
            loadRecipients();
        }
    }, [show, request]);

    const loadRecipients = async () => {
        try {
            setLoadingUsers(true);
            const data = await getForwardRecipients(request.id);
            const list = Array.isArray(data) ? data : (data.results || []);
            // Filter out logged-in user to prevent forwarding to self
            const filtered = list.filter(u => String(u.id) !== String(loggedInUser?.id));
            setUsers(filtered);
            if (filtered.length > 0) {
                setTargetUserId(String(filtered[0].id));
            }
        } catch (error) {
            console.error('Error loading forward recipients:', error);
            setUsers([]);
        } finally {
            setLoadingUsers(false);
        }
    };

    if (!request) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!targetUserId) {
            Swal.fire({
                icon: 'warning',
                title: 'Select Approver',
                text: 'Please select a user to forward this leave request to.'
            });
            return;
        }

        const selectedUser = users.find(u => String(u.id) === String(targetUserId));
        const targetName = selectedUser
            ? (selectedUser.name || `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || selectedUser.username)
            : 'selected user';

        const result = await Swal.fire({
            title: 'Forward Leave Request?',
            text: `Forward this leave request from ${request.employee_name || 'applicant'} to ${targetName}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#7A70BA',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, Forward Request'
        });

        if (!result.isConfirmed) return;

        try {
            setSubmitting(true);
            await forwardLeaveRequest(request.id, {
                forwarded_to: parseInt(targetUserId, 10),
                remarks: remarks.trim()
            });

            Swal.fire({
                icon: 'success',
                title: 'Forwarded',
                text: `Leave request has been forwarded to ${targetName}.`,
                timer: 2000,
                showConfirmButton: false
            });

            if (onSuccess) onSuccess();
            onHide();
        } catch (error) {
            const errorMsg = formatFriendlyError(error, 'Failed to forward leave request');
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal show={show} onHide={onHide} dialogClassName="leave-custom-modal" centered>
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
                .leave-custom-modal .modal-icon-circle-purple {
                    width: 48px;
                    height: 48px;
                    background-color: #7A70BA;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(122, 112, 186, 0.25);
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
                    background-color: #7A70BA !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .leave-custom-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .leave-custom-modal .btn-save-custom {
                    background-color: #2ece8a !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .leave-custom-modal .btn-save-custom:hover { background-color: #26b277 !important; }
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
                    border-color: #7A70BA;
                    box-shadow: 0 0 0 3px rgba(122, 112, 186, 0.15);
                }
            `}</style>

            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle-purple">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M14 5l7 7m0 0l-7 7m7-7H3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            Forward Leave Request
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Request ID No. {request.id} • Delegate approval to another authority
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide}>&times;</button>
            </div>

            <Form onSubmit={handleSubmit}>
                <div className="modal-body-custom">
                    {/* Request Summary */}
                    <div
                        className="p-3 mb-3 rounded-3"
                        style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', fontSize: '13px' }}
                    >
                        <div className="d-flex justify-content-between mb-1">
                            <span className="text-muted">Applicant:</span>
                            <strong className="text-dark">{request.employee_name || 'Employee'}</strong>
                        </div>
                        <div className="d-flex justify-content-between mb-1">
                            <span className="text-muted">Leave Type:</span>
                            <span className="text-dark fw-semibold">{request.leave_type_name}</span>
                        </div>
                        <div className="d-flex justify-content-between mb-1">
                            <span className="text-muted">Duration:</span>
                            <span className="text-dark fw-semibold">
                                {request.total_days} {parseFloat(request.total_days) === 1 ? 'day' : 'days'}
                            </span>
                        </div>
                        {request.reason && (
                            <div className="mt-2 pt-2 border-top text-muted">
                                <span className="fst-italic">"{request.reason}"</span>
                            </div>
                        )}
                    </div>

                    {/* Target User Select */}
                    <Form.Group className="mb-3">
                        <Form.Label className="form-label-custom">
                            Forward To Approver / User <span className="text-danger">*</span>
                        </Form.Label>
                        {loadingUsers ? (
                            <div className="py-2 text-muted fs-13">
                                <span className="spinner-border spinner-border-sm me-2"></span>
                                Loading reporting managers and HR employees...
                            </div>
                        ) : users.length === 0 ? (
                            <div className="alert alert-warning py-2 px-3 fs-13 mb-0">
                                <i className="fa fa-exclamation-triangle me-1"></i> No reporting managers or HR employees found.
                            </div>
                        ) : (
                            <Form.Select
                                className="form-control-custom"
                                value={targetUserId}
                                onChange={(e) => setTargetUserId(e.target.value)}
                                required
                            >
                                <option value="">-- Select Recipient --</option>
                                {users.filter(u => u.is_reporting_manager).length > 0 && (
                                    <optgroup label="Reporting Manager">
                                        {users.filter(u => u.is_reporting_manager).map((u) => {
                                            const name = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
                                            return (
                                                <option key={u.id} value={u.id}>
                                                    {name} — [Reporting Manager]
                                                </option>
                                            );
                                        })}
                                    </optgroup>
                                )}
                                {users.filter(u => u.is_hr).length > 0 && (
                                    <optgroup label="HR Employees">
                                        {users.filter(u => u.is_hr).map((u) => {
                                            const name = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
                                            const roleTag = u.role || 'HR';
                                            return (
                                                <option key={u.id} value={u.id}>
                                                    {name} - {roleTag}
                                                </option>
                                            );
                                        })}
                                    </optgroup>
                                )}
                                {users.filter(u => !u.is_reporting_manager && !u.is_hr).length > 0 && (
                                    <optgroup label="Other Approvers">
                                        {users.filter(u => !u.is_reporting_manager && !u.is_hr).map((u) => {
                                            const name = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
                                            return (
                                                <option key={u.id} value={u.id}>
                                                    {name}
                                                </option>
                                            );
                                        })}
                                    </optgroup>
                                )}
                            </Form.Select>
                        )}
                    </Form.Group>

                    {/* Forwarding Remarks */}
                    <Form.Group className="mb-2">
                        <Form.Label className="form-label-custom">
                            Forwarding Remarks / Instructions
                        </Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            className="form-control-custom"
                            placeholder="Add notes or reasons for forwarding this request..."
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                        />
                    </Form.Group>
                </div>

                <div className="modal-footer-custom">
                    <button
                        type="button"
                        className="btn-close-custom"
                        onClick={onHide}
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn-save-custom"
                        disabled={submitting || loadingUsers}
                    >
                        {submitting ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                                Forwarding...
                            </>
                        ) : (
                            <>
                                <i className="fa fa-share me-1"></i> Forward Request
                            </>
                        )}
                    </button>
                </div>
            </Form>
        </Modal>
    );
};

export default LeaveRequestForwardModal;
