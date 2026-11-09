import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    createRenewalSubject,
    updateRenewalSubject,
} from '../../../services/RenewalService';

const RenewalSubjectModal = ({ show, onHide, onSaved, editSubject = null }) => {
    const [loading, setLoading] = useState(false);
    const formRef = useRef(null);
    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });

    useEffect(() => {
        if (show) {
            if (editSubject && editSubject.id) {
                setFormData({
                    name: editSubject.name || '',
                    description: editSubject.description || ''
                });
            } else {
                setFormData({
                    name: '',
                    description: ''
                });
            }
            // Auto focus first input when modal opens
            setTimeout(() => {
                const all = getFocusable();
                if (all.length > 0) {
                    all[0].focus();
                }
            }, 100);
        }
    }, [show, editSubject]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const getFocusable = (container) => {
        const root = formRef.current || container || document.querySelector('.gate-custom-modal') || document;
        return Array.from(
            root.querySelectorAll(
                'input.form-control-custom:not([disabled]):not([readonly]), textarea.form-control-custom:not([disabled]):not([readonly]), button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;

        const swalContainer = document.querySelector('.swal2-container');
        if (swalContainer) {
            e.preventDefault();
            const okBtn = swalContainer.querySelector('.swal2-confirm');
            if (okBtn) okBtn.click();
            return;
        }

        if (e.target.tagName === 'TEXTAREA') return;

        const all = getFocusable();
        const index = all.indexOf(document.activeElement);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            const next = all[index + 1];
            if (next.type === 'submit') {
                next.focus();
            } else {
                next.focus();
            }
        } else if (index === all.length - 1 && all[index].type === 'submit') {
            e.preventDefault();
            all[index].click();
        }
    };

    const handleTextareaKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        if (e.shiftKey) return;
        e.preventDefault();
        const all = getFocusable();
        const index = all.indexOf(e.currentTarget);
        if (index > -1 && index < all.length - 1) {
            const next = all[index + 1];
            if (next.type === 'submit') {
                next.focus();
            } else {
                next.focus();
            }
        } else if (index === all.length - 1 && all[index].type === 'submit') {
            all[index].click();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.name.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Subject Name is required.',
                returnFocus: false
            });
            return;
        }

        try {
            setLoading(true);
            let response;
            if (editSubject && editSubject.id) {
                response = await updateRenewalSubject(editSubject.id, formData);
            } else {
                response = await createRenewalSubject(formData);
            }

            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: editSubject ? 'Renewal subject updated successfully' : 'Renewal subject created successfully',
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
            console.error("Error saving renewal subject", error);
            let errorMsg = 'Failed to save renewal subject.';
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

    return (
        <Fragment>
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
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM10 19H5V5H10V19ZM19 19H12V5H19V19Z" fill="white" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editSubject ? 'Edit Renewal Subject' : 'Create Renewal Subject'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage renewal subject
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={onHide}>
                        &times;
                    </button>
                </div>

                <Form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-12 mb-3">
                                <label className="form-label-custom">Subject Name <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    name="name"
                                    className="form-control-custom"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Enter subject name (e.g., AMC, License)"
                                    required
                                />
                            </div>

                            <div className="col-md-12 mb-3">
                                <label className="form-label-custom">Description</label>
                                <textarea
                                    rows="3"
                                    name="description"
                                    className="form-control-custom"
                                    value={formData.description}
                                    onChange={handleChange}
                                    onKeyDown={handleTextareaKeyDown}
                                    placeholder="Enter description"
                                />
                            </div>
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
                                editSubject ? 'Update Subject' : 'Save'
                            )}
                        </button>
                    </div>
                </Form>
            </Modal>

            <style>{`
                .gate-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .gate-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .gate-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
                .gate-custom-modal .modal-close-x {
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
                .gate-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .gate-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .gate-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .gate-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .gate-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .gate-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .gate-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .gate-custom-modal .btn-close-custom {
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
                .gate-custom-modal .btn-close-custom:hover {
                    background-color: #6357a7 !important;
                }
                .gate-custom-modal .btn-save-custom {
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
                .gate-custom-modal .btn-save-custom:hover {
                    background-color: #26b277 !important;
                }
            `}</style>
        </Fragment>
    );
};

export default RenewalSubjectModal;
