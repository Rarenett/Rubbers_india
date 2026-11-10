import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { createEquipment } from '../../../services/GateManagementService';
import CameraCapture from './CameraCapture';
import './AccessPoint.css';

const EquipmentFormModal = ({ show, onHide, onSaved, isDark = false }) => {
    const [loading, setLoading] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (show) {
            setFormData({ name: '', description: '' });
            setImageFile(null);
            setImagePreview(null);
            setShowCamera(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, [show]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const trimmedName = (formData.name || '').trim();
        if (!trimmedName) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Tool / Equipment Name is required.',
                returnFocus: false
            });
            return;
        }

        try {
            setLoading(true);
            const data = new FormData();
            data.append('name', trimmedName);
            if (formData.description) {
                data.append('description', formData.description.trim());
            }
            if (imageFile) {
                data.append('image', imageFile);
            }

            const response = await createEquipment(data);
            Swal.fire({
                icon: 'success',
                title: 'Saved',
                text: 'Tool / Equipment registered successfully',
                timer: 1500,
                showConfirmButton: false,
                returnFocus: false
            });

            if (onSaved) {
                onSaved(response);
            }
            onHide();
        } catch (error) {
            console.error("Error creating equipment:", error);
            const errorMsg = error.response?.data?.name?.[0] ||
                error.response?.data?.detail ||
                'Failed to register equipment.';
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
        <>
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
                        <i className="fa fa-tools text-white" style={{ fontSize: '18px' }}></i>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            Create Tool / Equipment
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Enter details to add new tool or equipment
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
                        <Form.Label className="form-label-custom">Tool / Equipment Name <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                            type="text"
                            name="name"
                            className="form-control-custom"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Enter tool or equipment name"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="mb-3">
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <Form.Label className="form-label-custom mb-0">Image Attachment</Form.Label>
                            <button
                                type="button"
                                className="btn btn-sm d-inline-flex align-items-center gap-1.5 shadow-none"
                                style={{
                                    background: '#e8fdf4',
                                    color: '#16a34a',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '6px',
                                    padding: '3px 10px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                                onClick={() => setShowCamera(true)}
                                title="Open Camera / Webcam"
                            >
                                <i className="fa fa-camera"></i>
                                <span>Capture Photo</span>
                            </button>
                        </div>

                        <div className="d-flex gap-2 align-items-center">
                            <input
                                ref={fileInputRef}
                                type="file"
                                name="image"
                                accept="image/*"
                                className="form-control form-control-custom"
                                onChange={handleImageChange}
                                style={{ padding: '8px 12px', fontSize: '13px' }}
                            />
                            <button
                                type="button"
                                className="btn btn-sm d-flex align-items-center justify-content-center flex-shrink-0"
                                style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '8px',
                                    background: '#0a500f',
                                    color: '#ffffff',
                                    border: 'none',
                                    boxShadow: '0 2px 4px rgba(10, 80, 15, 0.25)',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setShowCamera(true)}
                                title="Take Photo with Camera"
                            >
                                <i className="fa fa-camera"></i>
                            </button>
                        </div>

                        {imagePreview && (
                            <div className="mt-2 p-2 rounded-3 d-flex align-items-center gap-2" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <img
                                    src={imagePreview}
                                    alt="Preview"
                                    style={{
                                        width: '46px',
                                        height: '46px',
                                        borderRadius: '6px',
                                        objectFit: 'cover',
                                        border: '1.5px solid #0a500f'
                                    }}
                                />
                                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                    <div className="text-truncate fw-semibold text-dark" style={{ fontSize: '12px' }}>
                                        {imageFile?.name || 'Photo captured from camera'}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: '11px' }}>
                                        {imageFile?.size ? `${(imageFile.size / 1024).toFixed(1)} KB` : 'Image attached'}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-outline-danger btn-xs"
                                    onClick={handleRemoveImage}
                                    style={{ borderRadius: '4px', fontSize: '12px', padding: '4px 8px' }}
                                >
                                    <i className="fa fa-times me-1"></i> Remove
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="mb-3">
                        <Form.Label className="form-label-custom">Location / Description</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            name="description"
                            className="form-control-custom"
                            value={formData.description}
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
                            'Save Equipment'
                        )}
                    </button>
                </div>
            </Form>
        </Modal>

        {/* Camera Capture Modal */}
        <CameraCapture
            show={showCamera}
            onHide={() => setShowCamera(false)}
            onCapture={(file) => {
                setImageFile(file);
                setImagePreview(URL.createObjectURL(file));
                setShowCamera(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }}
            title="Capture Tool / Equipment Photo"
            isDark={isDark}
        />
        </>
    );
};

export default EquipmentFormModal;
