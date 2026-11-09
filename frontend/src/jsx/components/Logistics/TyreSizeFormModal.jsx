import React, { useState, useEffect, Fragment } from 'react';
import { Form, Modal } from 'react-bootstrap';
import Swal from 'sweetalert2';
import axiosInstance from '../../../services/AxiosInstance';

const TyreSizeFormModal = ({ show, onHide, isEditing, itemToEdit, onSave }) => {
    const [formData, setFormData] = useState({ size: '', tyre_type: '' });
    const [animateTrigger, setAnimateTrigger] = useState(false);

    useEffect(() => {
        if (show) {
            if (isEditing && itemToEdit) {
                setFormData({ size: itemToEdit.size, tyre_type: itemToEdit.tyre_type });
            } else {
                setFormData({ size: '', tyre_type: '' });
            }
        }
    }, [show, isEditing, itemToEdit]);

    useEffect(() => {
        const handleKeyDownEscape = (e) => {
            if (e.key === 'Escape' && show) {
                setAnimateTrigger(true);
                setTimeout(() => setAnimateTrigger(false), 300);
            }
        };
        window.addEventListener('keydown', handleKeyDownEscape);
        return () => window.removeEventListener('keydown', handleKeyDownEscape);
    }, [show]);

    const handleCloseModal = () => {
        onHide();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.size.trim()) {
            Swal.fire('Error', 'Tyre size cannot be empty.', 'error');
            return;
        }
        if (!formData.tyre_type) {
            Swal.fire('Error', 'Tyre type must be selected.', 'error');
            return;
        }
        try {
            if (isEditing && itemToEdit?.id) {
                await axiosInstance.put(`/api/logistics/tyre-sizes/${itemToEdit.id}/`, formData);
            } else {
                await axiosInstance.post('/api/logistics/tyre-sizes/', formData);
            }
            onHide();
            if (onSave) onSave();
            Swal.fire({ icon: 'success', title: 'Success', text: `Tyre size ${isEditing ? 'updated' : 'created'} successfully!`, timer: 2000, showConfirmButton: false });
        } catch (err) {
            Swal.fire('Error', 'Failed to save tyre size.', 'error');
        }
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
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
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
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .item-custom-modal .btn-close-custom {
                    background-color: #7A70BA !important;
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
                    background-color: #6357a7 !important;
                }
                .item-custom-modal .btn-save-custom {
                    background-color: #2ece8a !important;
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
                    background-color: #26b277 !important;
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
                show={show}
                onHide={handleCloseModal}
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
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="white" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {isEditing ? 'Edit Tyre Size' : 'Create Tyre Size'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage tyre size
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleCloseModal}>
                        &times;
                    </button>
                </div>

                <Form onSubmit={handleSubmit}>
                    <div className="modal-body-custom">
                        <div className="form-group mb-3">
                            <Form.Label className="form-label-custom">Tyre Size <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                className="form-control-custom"
                                value={formData.size}
                                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                                placeholder="Enter tyre size"
                                required
                                autoFocus
                            />
                        </div>
                        <div className="form-group mb-3">
                            <Form.Label className="form-label-custom">Tyre Type <span className="text-danger">*</span></Form.Label>
                            <Form.Select
                                className="form-control-custom"
                                value={formData.tyre_type}
                                onChange={(e) => setFormData({ ...formData, tyre_type: e.target.value })}
                            >
                                <option value="">Select Tyre Type</option>
                                <option value="front">Front Tyre</option>
                                <option value="rear">Rear Tyre</option>
                                <option value="both">Both</option>
                            </Form.Select>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={handleCloseModal}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom">
                            {isEditing ? 'Update' : 'Save'}
                        </button>
                    </div>
                </Form>
            </Modal>
        </Fragment>
    );
};

export default TyreSizeFormModal;
