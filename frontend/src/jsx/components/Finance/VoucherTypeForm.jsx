import React, { Fragment, useState, useEffect } from 'react';
import { Modal, Form } from 'react-bootstrap';
import { useFormConfig } from '../../../hooks/useFormConfig';

const VoucherTypeForm = ({ formData, setFormData, onSave, onCancel, isEditing }) => {
    const { isFieldVisible } = useFormConfig('finance_app_vouchertype', 'VoucherTypeForm');
    const [animateTrigger, setAnimateTrigger] = useState(false);

    useEffect(() => {
        const handleKeyDownEscape = (e) => {
            if (e.key === 'Escape') {
                setAnimateTrigger(true);
                setTimeout(() => setAnimateTrigger(false), 300);
            }
        };
        window.addEventListener('keydown', handleKeyDownEscape);
        return () => window.removeEventListener('keydown', handleKeyDownEscape);
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    return (
        <Fragment>
            <style>{`
                .item-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .item-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .item-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #0a500f;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .item-custom-modal .modal-close-x {
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
                .item-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .item-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .item-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .item-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .item-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .item-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .item-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .item-custom-modal .form-check-input:checked {
                    background-color: #0a500f;
                    border-color: #0a500f;
                }
                .item-custom-modal .btn-close-custom {
                    background-color: #dc3545 !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .item-custom-modal .btn-close-custom:hover {
                    background-color: #bb2d3b !important;
                }
                .item-custom-modal .btn-save-custom {
                    background-color: #0a500f !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .item-custom-modal .btn-save-custom:hover {
                    background-color: #073d0b !important;
                }
                
                @keyframes modalFeedback {
                    0%, 100% { transform: scale(1); }
                    20%, 60% { transform: scale(0.99) translateX(-4px); }
                    40%, 80% { transform: scale(1.01) translateX(4px); }
                }
                .modal-feedback {
                    animation: modalFeedback 0.25s ease-in-out !important;
                }
            `}</style>

            <Modal 
                show={true} 
                onHide={onCancel} 
                dialogClassName={`item-custom-modal ${animateTrigger ? 'modal-feedback' : ''}`}
                backdrop="static"
                keyboard={false}
                size="md"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="white" />
                                <polyline points="14 2 14 8 20 8" fill="white" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {isEditing ? 'Edit Voucher Type' : 'Add Voucher Type'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage voucher type
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={onCancel}>
                        &times;
                    </button>
                </div>
                
                <Form onSubmit={onSave}>
                    <div className="modal-body-custom">
                        <div className="row">
                            {isFieldVisible('name') && (
                                <div className="col-md-12 mb-3">
                                    <Form.Label className="form-label-custom">Name <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="text"
                                        className="form-control-custom"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="e.g. Sales Order"
                                        required
                                    />
                                </div>
                            )}

                            {isFieldVisible('code') && (
                                <div className="col-md-12 mb-3">
                                    <Form.Label className="form-label-custom">Code <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="text"
                                        className="form-control-custom"
                                        name="code"
                                        value={formData.code}
                                        onChange={handleChange}
                                        placeholder="e.g. SO"
                                        required
                                    />
                                </div>
                            )}

                            {isFieldVisible('is_active') && (
                                <div className="col-md-12 mt-2 mb-2">
                                    <Form.Check
                                        type="switch"
                                        id="isActiveSwitch"
                                        name="is_active"
                                        checked={formData.is_active}
                                        onChange={handleChange}
                                        label="Active Status"
                                        className="fw-semibold text-dark"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={onCancel}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom">
                            {isEditing ? 'Update' : 'Save'} Voucher Type
                        </button>
                    </div>
                </Form>
            </Modal>
        </Fragment>
    );
};

export default VoucherTypeForm;
