import React, { useState, useEffect, useRef } from 'react';
import { Card, Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getEquipments,
    createEquipment,
    updateEquipment,
    deleteEquipment
} from '../../../services/GateManagementService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CameraCapture from './CameraCapture';
import './AccessPoint.css';

const EquipmentManagement = () => {
    const { can } = usePermission();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [equipments, setEquipments] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const [editId, setEditId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [previewImageModal, setPreviewImageModal] = useState({ show: false, url: '', title: '' });

    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchEquipments();
    }, []);

    const fetchEquipments = async () => {
        try {
            setLoading(true);
            const data = await getEquipments();
            setEquipments(Array.isArray(data) ? data : (data?.results || []));
        } catch (error) {
            console.error("Error fetching equipments", error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
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

    const handleShowModal = (item = null) => {
        if (item && item.id) {
            setEditMode(true);
            setEditId(item.id);
            setFormData({
                name: item.name || '',
                description: item.description || ''
            });
            setImageFile(null);
            setImagePreview(item.image || null);
        } else {
            setEditMode(false);
            setEditId(null);
            setFormData({ name: '', description: '' });
            setImageFile(null);
            setImagePreview(null);
        }
        setShowModal(true);
    };

    const handleEdit = (item) => {
        handleShowModal(item);
    };

    const resetForm = () => {
        setEditMode(false);
        setEditId(null);
        setFormData({ name: '', description: '' });
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setShowModal(false);
        setTimeout(() => {
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
        }, 100);
    };

    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                const inputs = Array.from(
                    document.querySelectorAll('.gate-custom-modal input:not([disabled]):not([readonly]), .gate-custom-modal textarea:not([disabled]):not([readonly])')
                ).filter(el => el.offsetParent !== null && el.type !== 'hidden');
                if (inputs.length > 0) {
                    inputs[0].focus();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showModal]);

    const getFocusable = () => {
        const modal = document.querySelector('.gate-custom-modal');
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.form-control-custom, button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        if (e.target.tagName.toLowerCase() === 'textarea' && e.shiftKey) return;

        const all = getFocusable();
        const index = all.indexOf(document.activeElement);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else {
                all[index + 1].focus();
            }
        }
    };

    const handleFocus = (e) => {
        if (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.type === 'text')) {
            e.target.select();
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Equipment?',
            text: `Are you sure you want to delete "${name || 'this equipment'}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteEquipment(id);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted',
                    text: 'Equipment deleted successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
                fetchEquipments();
            } catch (error) {
                let errorMsg = 'Failed to delete equipment';
                if (error.response && error.response.data && error.response.data.detail) {
                    errorMsg = error.response.data.detail;
                }
                Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const trimmedName = (formData.name || '').trim().toLowerCase();

        if (trimmedName) {
            const duplicateName = equipments.some(eq => {
                if (editMode && eq.id === editId) return false;
                return (eq.name || '').trim().toLowerCase() === trimmedName;
            });

            if (duplicateName) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Duplicate Equipment Name',
                    text: 'An Equipment or Tool with this Name already exists!'
                });
                return;
            }
        }

        try {
            setSubmitting(true);
            const data = new FormData();
            data.append('name', (formData.name || '').trim());
            if (formData.description) {
                data.append('description', formData.description.trim());
            }

            if (imageFile) {
                data.append('image', imageFile);
            }

            if (editMode) {
                await updateEquipment(editId, data);
                Swal.fire({
                    icon: 'success',
                    title: 'Updated',
                    text: 'Equipment updated successfully',
                    timer: 2000,
                    showConfirmButton: false,
                    returnFocus: false
                });
            } else {
                await createEquipment(data);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Equipment registered successfully',
                    timer: 2000,
                    showConfirmButton: false,
                    returnFocus: false
                });
            }
            resetForm();
            fetchEquipments();
        } catch (error) {
            console.error("Error saving equipment:", error);
            const errorMsg = error.response?.data?.name?.[0] ||
                error.response?.data?.detail ||
                `Failed to ${editMode ? 'update' : 'register'} equipment.`;
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorMsg,
                returnFocus: false
            });
        } finally {
            setSubmitting(false);
            setTimeout(() => {
                if (document.activeElement && typeof document.activeElement.blur === 'function') {
                    document.activeElement.blur();
                }
            }, 100);
        }
    };

    const filteredEquipments = equipments.filter(item =>
        (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="container-fluid">
            <div className="page-titles">
                <button
                    onClick={() => window.history.back()}
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                            <Card.Title className="mb-0 text-nowrap">Equipments Management</Card.Title>
                            <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                                <div className="search-bar-container w-100 m-0" style={{ maxWidth: '250px' }}>
                                    <span className="search-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="11" cy="11" r="8"></circle>
                                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                        </svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Search Equipment..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                                    <CreateButton
                                        module="gates"
                                        onClick={() => handleShowModal()}
                                    >
                                        Equipment
                                    </CreateButton>
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-responsive-md">
                                        <thead>
                                            <tr>
                                                <th><strong>EQUIPMENT NAME</strong></th>
                                                <th><strong>IMAGE</strong></th>
                                                <th><strong>LOCATION / DESCRIPTION</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredEquipments.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="text-center py-4 text-muted">
                                                        No entries
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredEquipments.map((item) => (
                                                    <tr key={item.id}>
                                                        <td><strong>{item.name || '-'}</strong></td>
                                                        <td>
                                                            {item.image ? (
                                                                <img
                                                                    src={item.image}
                                                                    alt={item.name}
                                                                    style={{
                                                                        width: '38px',
                                                                        height: '38px',
                                                                        borderRadius: '6px',
                                                                        objectFit: 'cover',
                                                                        cursor: 'pointer',
                                                                        border: '1px solid #e2e8f0'
                                                                    }}
                                                                    onClick={() => setPreviewImageModal({
                                                                        show: true,
                                                                        url: item.image,
                                                                        title: item.name
                                                                    })}
                                                                    title="Click to view full image"
                                                                />
                                                            ) : (
                                                                <span className="text-muted">-</span>
                                                            )}
                                                        </td>
                                                        <td>{item.description || '-'}</td>
                                                        <td className="text-end">
                                                            {can('gates', 'edit') || can('gates', 'delete') ? (
                                                                <div className="d-flex justify-content-end">
                                                                    <EditButton
                                                                        module="gates"
                                                                        onClick={() => handleEdit(item)}
                                                                        className="me-1"
                                                                    />
                                                                    <DeleteButton
                                                                        module="gates"
                                                                        onClick={() => handleDelete(item.id, item.name)}
                                                                    />
                                                                </div>
                                                            ) : null}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Custom Styled Popup Modal matching Gates form style */}
            <Modal
                show={showModal}
                onHide={resetForm}
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
                                {editMode ? 'Edit Equipment' : 'Create Tool / Equipment'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to {editMode ? 'update equipment' : 'add new tool or equipment'}
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={resetForm}>
                        &times;
                    </button>
                </div>

                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown} onFocus={handleFocus}>
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
                                        background: '#2ece8a',
                                        color: '#ffffff',
                                        border: 'none',
                                        boxShadow: '0 2px 4px rgba(46, 206, 138, 0.25)',
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
                                            border: '1.5px solid #2ece8a'
                                        }}
                                    />
                                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                        <div className="text-truncate fw-semibold text-dark" style={{ fontSize: '12px' }}>
                                            {imageFile?.name || 'Photo selected / captured'}
                                        </div>
                                        <div className="text-muted" style={{ fontSize: '11px' }}>
                                            {imageFile?.size ? `${(imageFile.size / 1024).toFixed(1)} KB` : 'Image ready'}
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
                        <button type="button" className="btn-close-custom" onClick={resetForm}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom" disabled={submitting}>
                            {submitting ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Saving...
                                </>
                            ) : (
                                editMode ? 'Update Equipment' : 'Save Equipment'
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
            />

            {/* Lightbox Modal for Full Image View */}
            <Modal
                show={previewImageModal.show}
                onHide={() => setPreviewImageModal({ show: false, url: '', title: '' })}
                centered
                size="md"
            >
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title className="fs-6 fw-bold">{previewImageModal.title}</Modal.Title>
                </Modal.Header>
                <Modal.Body className="text-center p-3">
                    <img
                        src={previewImageModal.url}
                        alt={previewImageModal.title}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '75vh',
                            objectFit: 'contain',
                            borderRadius: '8px'
                        }}
                    />
                </Modal.Body>
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
        </div>
    );
};

export default EquipmentManagement;
