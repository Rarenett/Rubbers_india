import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Button, Row, Col, Spinner } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import { createVehicle, getVehicleTypes } from '../../../services/GateManagementService';
import CameraCapture from './CameraCapture';
import './AccessPoint.css';

const SpotVehicleModal = ({ show, onHide, onVehicleCreated, initialVehicleNumber = '', isDark = false, zIndex = 1070 }) => {
    const [loading, setLoading] = useState(false);
    const [vehicleTypes, setVehicleTypes] = useState([]);
    
    const formRef = useRef(null);
    const companyRef = useRef(null);

    const [formData, setFormData] = useState({
        vehicle_number: initialVehicleNumber,
        vehicle_type: '',
        company: '',
        driver: '',
        vehicle_photo: null
    });
    const [photoPreview, setPhotoPreview] = useState(null);
    const [showCamera, setShowCamera] = useState(false);

    useEffect(() => {
        if (show) {
            fetchVehicleTypes();
            setFormData(prev => ({
                ...prev,
                vehicle_number: initialVehicleNumber
            }));
            setTimeout(() => {
                if (companyRef.current) companyRef.current.focus();
            }, 200);
        }
    }, [show, initialVehicleNumber]);

    const fetchVehicleTypes = async () => {
        try {
            const types = await getVehicleTypes();
            setVehicleTypes(types || []);
        } catch (error) {
            console.error("Error fetching vehicle types", error);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSelectChange = (selectedOption, actionMeta) => {
        setFormData({ ...formData, [actionMeta.name]: selectedOption ? selectedOption.value : '' });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({ ...prev, vehicle_photo: file }));
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleCameraCapture = (file) => {
        setFormData(prev => ({ ...prev, vehicle_photo: file }));
        setPhotoPreview(URL.createObjectURL(file));
        setShowCamera(false);
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        
        if (!formData.vehicle_number.trim()) {
            Swal.fire('Error', 'Vehicle Number is required', 'warning');
            return;
        }

        if (!formData.vehicle_photo) {
            Swal.fire('Validation Error', 'Vehicle Photo is mandatory. Please capture or upload a vehicle photo.', 'warning');
            return;
        }

        try {
            setLoading(true);
            const submitData = new FormData();
            submitData.append('vehicle_number', formData.vehicle_number);
            if (formData.vehicle_type) submitData.append('vehicle_type', formData.vehicle_type);
            if (formData.company) submitData.append('company', formData.company);
            if (formData.driver) submitData.append('driver', formData.driver);
            if (formData.vehicle_photo) submitData.append('vehicle_photo', formData.vehicle_photo);

            const created = await createVehicle(submitData);
            
            Swal.fire({
                icon: 'success',
                title: 'Vehicle Registered',
                text: 'New vehicle has been added to the system',
                timer: 1500,
                showConfirmButton: false
            });
            
            if (onVehicleCreated) {
                onVehicleCreated(created);
            }
            
            handleClose();
        } catch (error) {
            console.error("Error creating vehicle", error);
            const errorMsg = error.response?.data?.vehicle_number?.[0] || 'Failed to register vehicle. Please try again.';
            Swal.fire('Error', errorMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setFormData({
            vehicle_number: '',
            vehicle_type: '',
            company: '',
            driver: '',
            vehicle_photo: null
        });
        setPhotoPreview(null);
        setShowCamera(false);
        onHide();
    };

    // Keyboard navigation
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const formElements = Array.from(formRef.current.elements)
                .filter(el => !el.disabled && el.tabIndex !== -1 && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'BUTTON' || el.tagName === 'TEXTAREA'));
            
            const index = formElements.indexOf(e.target);
            if (index > -1 && index < formElements.length - 1) {
                formElements[index + 1].focus();
            } else if (index === formElements.length - 1 || e.target.type === 'submit') {
                handleSubmit(e);
            }
        }
    };

    const typeOptions = vehicleTypes.map(t => ({ value: t.id, label: t.name }));

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#2ece8a' : (isDark ? '#334155' : '#cbd5e1'),
            boxShadow: state.isFocused ? '0 0 0 3px rgba(46, 206, 138, 0.15)' : 'none',
            '&:hover': { borderColor: '#2ece8a' },
            borderRadius: '10px',
            fontSize: '13px',
            backgroundColor: isDark ? '#0f172a' : '#fff',
            color: isDark ? '#f8fafc' : '#1e293b'
        }),
        menu: base => ({
            ...base,
            zIndex: 9999,
            fontSize: '13px',
            backgroundColor: isDark ? '#1e293b' : '#fff'
        }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#2ece8a' : state.isFocused ? (isDark ? '#334155' : '#e8fcf3') : 'transparent',
            color: state.isSelected ? 'white' : (isDark ? '#f8fafc' : '#333'),
            cursor: 'pointer',
        }),
        singleValue: base => ({
            ...base,
            color: isDark ? '#f8fafc' : '#1e293b'
        })
    };

    return (
        <Modal 
            show={show} 
            onHide={handleClose} 
            size="lg" 
            centered
            backdrop="static"
            keyboard={false}
            dialogClassName="gate-custom-modal item-custom-modal spot-vehicle-modal"
            style={{ zIndex }}
            backdropClassName="spot-vehicle-backdrop"
        >
            {/* Standard Glenda Modal Header */}
            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <i className="fa fa-truck text-white" style={{ fontSize: '18px' }}></i>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                            New Vehicle Registration
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Quick spot registration for an unregistered vehicle
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={handleClose}>
                    &times;
                </button>
            </div>
            
            <Form ref={formRef} onKeyDown={handleKeyDown} onSubmit={handleSubmit}>
                <div className="modal-body-custom">
                    <Row className="mb-3">
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label className="form-label-custom">
                                    Vehicle Number <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    name="vehicle_number"
                                    value={formData.vehicle_number}
                                    onChange={(e) => setFormData({...formData, vehicle_number: e.target.value.toUpperCase()})}
                                    placeholder="e.g. KL 01 AB 1234"
                                    className="form-control-custom fw-bold"
                                    style={{ letterSpacing: '0.5px' }}
                                    autoFocus
                                    required
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label className="form-label-custom">Vehicle Type</Form.Label>
                                <Select
                                    name="vehicle_type"
                                    options={typeOptions}
                                    value={typeOptions.find(o => o.value === formData.vehicle_type) || null}
                                    onChange={handleSelectChange}
                                    placeholder="Select Type..."
                                    classNamePrefix="react-select"
                                    isClearable
                                    styles={selectStyles}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                    
                    <Row className="mb-3">
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label className="form-label-custom">Company / Vendor Name</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="company"
                                    ref={companyRef}
                                    value={formData.company}
                                    onChange={handleChange}
                                    placeholder="e.g. Logistics Inc"
                                    className="form-control-custom"
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label className="form-label-custom">Driver Name</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="driver"
                                    value={formData.driver}
                                    onChange={handleChange}
                                    placeholder="e.g. Driver Name"
                                    className="form-control-custom"
                                />
                            </Form.Group>
                        </Col>
                    </Row>

                    <Row className="mb-2">
                        <Col md={6}>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <Form.Label className="form-label-custom mb-0">
                                    Vehicle Photo <span className="text-danger">*</span>
                                </Form.Label>
                                <Button 
                                    size="sm" 
                                    type="button" 
                                    onClick={() => setShowCamera(true)} 
                                    className="btn-camera-upload d-flex align-items-center gap-1 px-2.5 py-1 text-white border-0 shadow-xs" 
                                    style={{ background: '#2ece8a', fontSize: '11px', borderRadius: '6px' }}
                                >
                                    <i className="fa fa-camera"></i> Camera
                                </Button>
                            </div>
                            <div 
                                className={`image-upload-btn dropzone-upload${photoPreview ? ' has-image' : ''}`} 
                                role="button" 
                                tabIndex={0} 
                                onClick={() => document.getElementById('spot_vehicle_photo_file')?.click()}
                            >
                                {photoPreview ? (
                                    <>
                                        <img src={photoPreview} alt="preview" className="dz-thumb" />
                                        <div className="dz-file-info">
                                            <span className="dz-file-name">{formData.vehicle_photo?.name || 'Photo captured'}</span>
                                            <span className="dz-file-hint">Click to replace</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            className="dz-remove-btn" 
                                            title="Remove photo" 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setFormData(prev => ({ ...prev, vehicle_photo: null })); 
                                                setPhotoPreview(null); 
                                            }}
                                        >×</button>
                                    </>
                                ) : (
                                    <>
                                        <svg className="dz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M7 17a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 8.96" />
                                            <path d="M12 12v7" />
                                            <path d="M9.5 14.5 12 12l2.5 2.5" />
                                        </svg>
                                        <span className="dz-title">Drag &amp; drop, or <span>browse</span></span>
                                        <span className="dz-subtitle">PNG or JPG</span>
                                    </>
                                )}
                                <input id="spot_vehicle_photo_file" type="file" name="vehicle_photo" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* Standard Glenda Modal Footer */}
                <div className="modal-footer-custom">
                    <button 
                        type="button" 
                        onClick={handleClose}
                        className="btn-close-custom"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="btn-save-custom"
                    >
                        {loading ? (
                            <>
                                <Spinner size="sm" className="me-1.5" />
                                Saving...
                            </>
                        ) : (
                            'Register & Proceed'
                        )}
                    </button>
                </div>
            </Form>

            <CameraCapture
                show={showCamera}
                onHide={() => setShowCamera(false)}
                onCapture={handleCameraCapture}
                title="Capture Vehicle Photo"
                isDark={isDark}
            />
            <style dangerouslySetInnerHTML={{
                __html: `
                .spot-vehicle-backdrop {
                    z-index: ${zIndex - 5} !important;
                }
                .spot-vehicle-modal .dropzone-upload {
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 6px !important;
                    text-align: center !important;
                    border: 2px dashed #cbd5e1 !important;
                    border-radius: 12px !important;
                    background-color: #fafbfc !important;
                    padding: 16px 14px !important;
                    cursor: pointer !important;
                    transition: border-color 0.2s, background-color 0.2s !important;
                    outline: none !important;
                    min-height: 95px !important;
                }
                .spot-vehicle-modal .dropzone-upload:hover {
                    border-color: #2ece8a !important;
                    background-color: #f0fdf6 !important;
                }
                .spot-vehicle-modal .dropzone-upload .dz-icon {
                    width: 28px !important;
                    height: 28px !important;
                    color: #2ece8a !important;
                }
                .spot-vehicle-modal .dropzone-upload .dz-title {
                    font-size: 13px !important;
                    font-weight: 600 !important;
                    color: #475569 !important;
                }
                .spot-vehicle-modal .dropzone-upload .dz-title span {
                    color: #16a34a !important;
                    text-decoration: underline !important;
                }
                .spot-vehicle-modal .dropzone-upload .dz-subtitle {
                    font-size: 11px !important;
                    color: #94a3b8 !important;
                }
                .spot-vehicle-modal .dropzone-upload.has-image {
                    flex-direction: row !important;
                    justify-content: flex-start !important;
                    text-align: left !important;
                    padding: 10px 14px !important;
                    gap: 12px !important;
                }
                .spot-vehicle-modal .dz-thumb {
                    width: 50px !important;
                    height: 50px !important;
                    border-radius: 8px !important;
                    object-fit: cover !important;
                    border: 1px solid #e2e8f0 !important;
                    flex-shrink: 0 !important;
                }
                .spot-vehicle-modal .dz-file-info {
                    display: flex !important;
                    flex-direction: column !important;
                    flex: 1 !important;
                    overflow: hidden !important;
                }
                .spot-vehicle-modal .dz-file-name {
                    font-size: 12px !important;
                    font-weight: 600 !important;
                    color: #1e293b !important;
                    white-space: nowrap !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                }
                .spot-vehicle-modal .dz-file-hint {
                    font-size: 11px !important;
                    color: #94a3b8 !important;
                }
                .spot-vehicle-modal .dz-remove-btn {
                    border: none !important;
                    background: #fee2e2 !important;
                    color: #ef4444 !important;
                    width: 24px !important;
                    height: 24px !important;
                    border-radius: 50% !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    cursor: pointer !important;
                    font-size: 14px !important;
                    line-height: 1 !important;
                }
                `
            }} />
        </Modal>
    );
};

export default SpotVehicleModal;
