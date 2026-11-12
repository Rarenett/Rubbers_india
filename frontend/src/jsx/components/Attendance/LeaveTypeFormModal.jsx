import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Row, Col } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    createLeaveType,
    updateLeaveType,
    formatFriendlyError
} from '../../../services/AttendanceService';

const LeaveTypeFormModal = ({ show, onHide, onSuccess, editMode = false, leaveType = null }) => {
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
        need_approval: true,
        is_active: true
    });

    useEffect(() => {
        if (show) {
            if (leaveType) {
                setCurrentLeave({
                    id: leaveType.id,
                    name: leaveType.name || '',
                    code: leaveType.code || '',
                    is_paid: leaveType.is_paid ?? true,
                    annual_limit: leaveType.annual_limit ?? 0,
                    is_cumulative: leaveType.is_cumulative ?? false,
                    max_limit: leaveType.max_limit ?? 0,
                    can_surrender: leaveType.can_surrender ?? false,
                    apply_before_days: leaveType.apply_before_days ?? 0,
                    need_approval: leaveType.need_approval ?? true,
                    is_active: leaveType.is_active ?? true
                });
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
            }
        }
    }, [show, leaveType]);

    // Autofocus effect
    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                const inputs = Array.from(
                    document.querySelectorAll('.leave-custom-modal input:not([disabled]):not([readonly])')
                ).filter(el => el.offsetParent !== null && el.type !== 'hidden');
                if (inputs.length > 0) inputs[0].focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [show]);

    // Keyboard navigation
    const getFocusable = () => {
        const modal = document.querySelector('.leave-custom-modal');
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.form-control-custom, input[type="checkbox"]:not([disabled]), button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        const activeEl = document.activeElement;
        const all = getFocusable();
        const index = all.indexOf(activeEl);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else {
                all[index + 1].focus();
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentLeave.name.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Leave name is required' });
            return;
        }
        if (!currentLeave.code.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Leave code is required' });
            return;
        }

        try {
            const payload = {
                name: (currentLeave.name || '').trim(),
                code: (currentLeave.code || '').trim().toUpperCase(),
                is_paid: Boolean(currentLeave.is_paid),
                annual_limit: parseFloat(currentLeave.annual_limit) || 0,
                is_cumulative: Boolean(currentLeave.is_cumulative),
                max_limit: currentLeave.is_cumulative ? parseInt(currentLeave.max_limit, 10) || 0 : 0,
                can_surrender: Boolean(currentLeave.can_surrender),
                apply_before_days: parseInt(currentLeave.apply_before_days, 10) || 0,
                need_approval: Boolean(currentLeave.need_approval),
                is_active: Boolean(currentLeave.is_active)
            };

            let saved;
            if (editMode && currentLeave.id) {
                saved = await updateLeaveType(currentLeave.id, payload);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Leave type updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                saved = await createLeaveType(payload);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Leave type created successfully', timer: 2000, showConfirmButton: false });
            }
            if (onSuccess) onSuccess(saved);
            onHide();
        } catch (error) {
            const errorMsg = formatFriendlyError(error, `Failed to ${editMode ? 'update' : 'create'} leave type`);
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
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
                .leave-custom-modal .modal-body-custom { padding: 28px; }
                .leave-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .leave-custom-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .leave-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .leave-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .leave-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
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
                .leave-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
            `}</style>

            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5v-5z" fill="white"/>
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            {editMode ? 'Edit Leave Type' : 'Add Leave Type'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Manage leave category, quota, and encashment terms
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide}>&times;</button>
            </div>

            <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                <div className="modal-body-custom">
                    <Row>
                        <Col md={7}>
                            <Form.Group className="mb-3">
                                <Form.Label className="form-label-custom">
                                    Leave Name <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    value={currentLeave.name}
                                    onChange={(e) => setCurrentLeave({ ...currentLeave, name: e.target.value })}
                                    placeholder="Enter leave name (e.g. Casual Leave)"
                                    required
                                />
                            </Form.Group>
                        </Col>
                        <Col md={5}>
                            <Form.Group className="mb-3">
                                <Form.Label className="form-label-custom">
                                    Leave Code <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    value={currentLeave.code}
                                    onChange={(e) => setCurrentLeave({ ...currentLeave, code: e.target.value.toUpperCase() })}
                                    placeholder="e.g. CL"
                                    style={{ textTransform: 'uppercase' }}
                                    required
                                />
                            </Form.Group>
                        </Col>
                    </Row>

                    <Row>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="form-label-custom">
                                    Annual Limit (Days)
                                </Form.Label>
                                <Form.Control
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    className="form-control-custom"
                                    value={currentLeave.annual_limit}
                                    onChange={(e) => setCurrentLeave({ ...currentLeave, annual_limit: e.target.value })}
                                    placeholder="e.g. 12"
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="form-label-custom">
                                    Apply Before (Days Notice)
                                </Form.Label>
                                <Form.Control
                                    type="number"
                                    min="0"
                                    className="form-control-custom"
                                    value={currentLeave.apply_before_days}
                                    onChange={(e) => setCurrentLeave({ ...currentLeave, apply_before_days: e.target.value })}
                                    placeholder="e.g. 2 (0 for same day)"
                                />
                            </Form.Group>
                        </Col>
                    </Row>

                    <Row>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Check
                                    type="checkbox"
                                    label="Cumulative / Carry Forward"
                                    checked={currentLeave.is_cumulative}
                                    onChange={(e) => setCurrentLeave({
                                        ...currentLeave,
                                        is_cumulative: e.target.checked,
                                        max_limit: !e.target.checked ? 0 : currentLeave.max_limit
                                    })}
                                    className="form-check-input-custom mb-2"
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            {currentLeave.is_cumulative && (
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">
                                        Max Accumulation Limit (Days)
                                    </Form.Label>
                                    <Form.Control
                                        type="number"
                                        min="0"
                                        className="form-control-custom"
                                        value={currentLeave.max_limit}
                                        onChange={(e) => setCurrentLeave({ ...currentLeave, max_limit: e.target.value })}
                                        placeholder="e.g. 30"
                                    />
                                </Form.Group>
                            )}
                        </Col>
                    </Row>

                    <Row>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Check
                                    type="checkbox"
                                    label="Paid Leave"
                                    checked={currentLeave.is_paid}
                                    onChange={(e) => setCurrentLeave({ ...currentLeave, is_paid: e.target.checked })}
                                    className="form-check-input-custom"
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Check
                                    type="checkbox"
                                    label="Can Surrender / Encash"
                                    checked={currentLeave.can_surrender}
                                    onChange={(e) => setCurrentLeave({ ...currentLeave, can_surrender: e.target.checked })}
                                    className="form-check-input-custom"
                                />
                            </Form.Group>
                        </Col>
                    </Row>

                    <Row>
                        <Col md={6}>
                            <Form.Group className="mb-2">
                                <Form.Check
                                    type="checkbox"
                                    label="Need approval"
                                    checked={currentLeave.need_approval}
                                    onChange={(e) => setCurrentLeave({ ...currentLeave, need_approval: e.target.checked })}
                                    className="form-check-input-custom"
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-2">
                                <Form.Check
                                    type="checkbox"
                                    label="Active"
                                    checked={currentLeave.is_active}
                                    onChange={(e) => setCurrentLeave({ ...currentLeave, is_active: e.target.checked })}
                                    className="form-check-input-custom"
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                </div>

                <div className="modal-footer-custom">
                    <Button type="button" className="btn-close-custom" onClick={onHide}>Cancel</Button>
                    <Button type="submit" className="btn-save-custom">Save</Button>
                </div>
            </Form>
        </Modal>
    );
};

export default LeaveTypeFormModal;
