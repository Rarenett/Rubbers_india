import React, { useState, useEffect } from 'react';
import { Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { createGate, updateGate } from '../../../services/GateManagementService';
import './AccessPoint.css';

const GateFormModal = ({ show, onHide, onSaved, editGate = null }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        gate_no: '',
        location: ''
    });

    useEffect(() => {
        if (show) {
            if (editGate) {
                setFormData({
                    name: editGate.name || '',
                    gate_no: editGate.gate_no || '',
                    location: editGate.location || ''
                });
            } else {
                setFormData({
                    name: '',
                    gate_no: '',
                    location: ''
                });
            }
        }
    }, [show, editGate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.name.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Gate Name is required.',
                returnFocus: false
            });
            return;
        }

        try {
            setLoading(true);
            let response;
            if (editGate && editGate.id) {
                response = await updateGate(editGate.id, formData);
            } else {
                response = await createGate(formData);
            }

            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: editGate ? 'Gate updated successfully' : 'Gate created successfully',
                timer: 1500,
                showConfirmButton: false,
                returnFocus: false
            });

            if (onSaved) {
                onSaved(response);
            }
            if (onHide) {
                onHide();
            }
        } catch (error) {
            console.error("Error saving gate", error);
            let errorMsg = 'Failed to save gate.';
            if (error.response && error.response.data) {
                const data = error.response.data;
                errorMsg = data.detail || data.name || data.message || errorMsg;
                if (Array.isArray(errorMsg)) errorMsg = errorMsg.join(' ');
            }
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorMsg,
                returnFocus: false
            });
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            const swalContainer = document.querySelector('.swal2-container');
            if (swalContainer) {
                e.preventDefault();
                const okBtn = swalContainer.querySelector('.swal2-confirm');
                if (okBtn) okBtn.click();
                return;
            }
            if (e.target.tagName === 'TEXTAREA' && !e.ctrlKey) {
                return;
            }
            const focusable = Array.from(
                document.querySelectorAll('.gate-custom-modal input, .gate-custom-modal select, .gate-custom-modal textarea, .gate-custom-modal button[type="submit"]')
            ).filter(el => !el.disabled && el.offsetParent !== null && el.tabIndex !== -1);
            const idx = focusable.indexOf(document.activeElement);
            if (idx > -1 && idx < focusable.length - 1) {
                e.preventDefault();
                const next = focusable[idx + 1];
                if (next.type === 'submit') {
                    next.click();
                } else {
                    next.focus();
                }
            }
        }
    };

    return (
        <Modal
            show={show}
            onHide={onHide}
            dialogClassName="gate-custom-modal"
            backdrop="static"
            keyboard={false}
            restoreFocus={false}
            size="md"
            centered
        >
            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <i className="fa fa-door-open text-white" style={{ fontSize: '18px' }}></i>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            {editGate ? 'Edit Gate' : 'Create Gate'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Enter details to manage gate
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide}>
                    &times;
                </button>
            </div>

            <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                <div className="modal-body-custom">
                    <div className="mb-3">
                        <Form.Label className="form-label-custom">Gate Name <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                            type="text"
                            name="name"
                            className="form-control-custom"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Enter gate name"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="mb-3">
                        <Form.Label className="form-label-custom">Gate Number</Form.Label>
                        <Form.Control
                            type="text"
                            name="gate_no"
                            className="form-control-custom"
                            value={formData.gate_no}
                            onChange={handleChange}
                            placeholder="e.g. GATE-01"
                        />
                    </div>

                    <div className="mb-3">
                        <Form.Label className="form-label-custom">Location / Description</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            name="location"
                            className="form-control-custom"
                            value={formData.location}
                            onChange={handleChange}
                            placeholder="Enter location or description"
                        />
                    </div>
                </div>

                <div className="modal-footer-custom">
                    <button type="button" className="btn-close-custom" onClick={onHide}>
                        Cancel
                    </button>
                    <button type="submit" className="btn-save-custom" disabled={loading}>
                        {loading ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                Saving...
                            </>
                        ) : (
                            editGate ? 'Update Gate' : 'Create Gate'
                        )}
                    </button>
                </div>
            </Form>
        </Modal>
    );
};

export default GateFormModal;
