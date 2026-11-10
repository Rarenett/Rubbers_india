import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Modal, Form, Button, Row, Col, Spinner } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import { createVisitor, createVehicle, getVehicleTypes } from '../../../services/GateManagementService';
import { getDepartments } from '../../../services/HRManagementService';
import CameraCapture from './CameraCapture';

const SpotVisitorModal = ({ 
    show, 
    onHide, 
    onVisitorCreated, 
    onVehicleCreated, 
    initialMobile = '', 
    initialVehicleNumber = '', 
    initialDepartment = '', 
    initialMode = 'visitor', 
    isDark = false, 
    zIndex = 1070 
}) => {
    // Mode tab: 'visitor' | 'vehicle'
    const [activeTab, setActiveTab] = useState(initialMode || 'visitor');

    // Visitor states
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [showCamera, setShowCamera] = useState(false);
    const [activeCameraField, setActiveCameraField] = useState(null);

    const visitorFormRef = useRef(null);
    const visitorNameRef = useRef(null);
    const vehicleNumRef = useRef(null);

    const [formData, setFormData] = useState({
        visitor_name: '',
        mobile_no: initialMobile,
        email: '',
        address: '',
        company_name: '',
        department: initialDepartment,
        visitor_photo: null,
        id_card_photo: null,
        visiting_card_photo: null
    });

    const [previews, setPreviews] = useState({
        visitor_photo: null,
        id_card_photo: null,
        visiting_card_photo: null,
        vehicle_photo: null
    });

    // Vehicle states
    const [vehicleLoading, setVehicleLoading] = useState(false);
    const [vehicleTypes, setVehicleTypes] = useState([]);
    const [vehicleFormData, setVehicleFormData] = useState({
        vehicle_number: initialVehicleNumber || (initialMobile && initialMobile.match(/[a-zA-Z]/) ? initialMobile : ''),
        vehicle_type: '',
        company: '',
        driver: '',
        vehicle_photo: null
    });

    useEffect(() => {
        if (show) {
            fetchDepartments();
            fetchVehicleTypes();

            const detectedMode = initialMode || (initialVehicleNumber || (initialMobile && initialMobile.match(/[a-zA-Z]/)) ? 'vehicle' : 'visitor');
            setActiveTab(detectedMode);

            setFormData(prev => ({
                ...prev,
                mobile_no: initialMobile && !initialMobile.match(/[a-zA-Z]/) ? initialMobile : prev.mobile_no,
                department: initialDepartment || prev.department
            }));

            setVehicleFormData(prev => ({
                ...prev,
                vehicle_number: initialVehicleNumber || (initialMobile && initialMobile.match(/[a-zA-Z]/) ? initialMobile.toUpperCase() : prev.vehicle_number)
            }));

            setTimeout(() => {
                if (detectedMode === 'vehicle') {
                    if (vehicleNumRef.current) vehicleNumRef.current.focus();
                } else {
                    if (visitorNameRef.current) visitorNameRef.current.focus();
                }
            }, 200);
        }
    }, [show, initialMobile, initialVehicleNumber, initialDepartment, initialMode]);

    const fetchDepartments = async () => {
        try {
            const data = await getDepartments();
            setDepartments(data || []);
        } catch (error) {
            console.error('Error fetching departments', error);
        }
    };

    const fetchVehicleTypes = async () => {
        try {
            const data = await getVehicleTypes();
            setVehicleTypes(data || []);
        } catch (error) {
            console.error('Error fetching vehicle types', error);
        }
    };

    const toOptions = (items) => (items || []).map(item => ({
        value: item.id,
        label: item.name
    }));

    const findOption = (options, value) => (options || []).find(o => String(o.value) === String(value)) || null;

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15, 0.15)' : 'none',
            '&:hover': { borderColor: '#0a500f' },
            borderRadius: '10px',
            fontSize: '13px',
            backgroundColor: '#fff'
        }),
        menu: base => ({ ...base, zIndex: 9999, fontSize: '0.875rem' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? '#e8fcf3' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    const handleChange = (e) => {
        const { name, value, files } = e.target;
        if (files && files[0]) {
            setFormData(prev => ({ ...prev, [name]: files[0] }));
            setPreviews(prev => ({ ...prev, [name]: URL.createObjectURL(files[0]) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleVehicleChange = (e) => {
        const { name, value, files } = e.target;
        if (files && files[0]) {
            setVehicleFormData(prev => ({ ...prev, [name]: files[0] }));
            setPreviews(prev => ({ ...prev, [name]: URL.createObjectURL(files[0]) }));
        } else {
            setVehicleFormData(prev => ({
                ...prev,
                [name]: name === 'vehicle_number' ? value.toUpperCase() : value
            }));
        }
    };

    const handleCameraCapture = (field) => {
        setActiveCameraField(field);
        setShowCamera(true);
    };

    const onCameraImageCaptured = (file) => {
        if (activeCameraField === 'vehicle_photo') {
            setVehicleFormData(prev => ({ ...prev, vehicle_photo: file }));
            setPreviews(prev => ({ ...prev, vehicle_photo: URL.createObjectURL(file) }));
        } else {
            setFormData(prev => ({ ...prev, [activeCameraField]: file }));
            setPreviews(prev => ({ ...prev, [activeCameraField]: URL.createObjectURL(file) }));
        }
        setShowCamera(false);
    };

    // Keyboard navigation
    const getFocusable = () => {
        const root = visitorFormRef.current || document;
        return Array.from(
            root.querySelectorAll(
                'input:not([type="file"]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled]), button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const advanceFocus = (fromEl) => {
        const all = getFocusable();
        const index = all.indexOf(fromEl);
        if (index > -1 && index < all.length - 1) {
            all[index + 1].focus();
        } else if (index === all.length - 1) {
            all[index].click();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        if (e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        advanceFocus(e.target);
    };

    // Submit Visitor
    const handleSubmitVisitor = async (e) => {
        if (e) e.preventDefault();
        if (!formData.visitor_name.trim()) {
            Swal.fire('Error', 'Visitor Name is required', 'warning');
            return;
        }
        if (!formData.mobile_no.trim()) {
            Swal.fire('Error', 'Mobile Number is required', 'warning');
            return;
        }
        if (!formData.visitor_photo) {
            Swal.fire('Validation Error', 'Visitor Photo is mandatory. Please capture or upload a visitor photo.', 'warning');
            return;
        }
        if (!formData.id_card_photo) {
            Swal.fire('Validation Error', 'ID Card Photo is mandatory. Please capture or upload an ID card photo.', 'warning');
            return;
        }

        const data = new FormData();
        Object.keys(formData).forEach(key => {
            if (formData[key] !== null && formData[key] !== undefined) {
                data.append(key, formData[key]);
            }
        });

        try {
            setLoading(true);
            const newVisitor = await createVisitor(data);
            Swal.fire({
                icon: 'success',
                title: 'Visitor Registered',
                text: 'Visitor registered successfully.',
                timer: 2000,
                showConfirmButton: false
            });
            if (onVisitorCreated) {
                onVisitorCreated(newVisitor);
            }
            onHide();
        } catch (error) {
            console.error('Error creating visitor', error);
            const errorMsg = error.response?.data?.mobile_no?.[0] || 'Failed to register visitor. Please try again.';
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        } finally {
            setLoading(false);
        }
    };

    // Submit Vehicle
    const handleSubmitVehicle = async (e) => {
        if (e) e.preventDefault();
        if (!vehicleFormData.vehicle_number.trim()) {
            Swal.fire('Error', 'Vehicle Number is required', 'warning');
            return;
        }
        if (!vehicleFormData.vehicle_photo) {
            Swal.fire('Validation Error', 'Vehicle Photo is mandatory. Please capture or upload a vehicle photo.', 'warning');
            return;
        }

        try {
            setVehicleLoading(true);
            const submitData = new FormData();
            submitData.append('vehicle_number', vehicleFormData.vehicle_number.trim().toUpperCase());
            if (vehicleFormData.vehicle_type) submitData.append('vehicle_type', vehicleFormData.vehicle_type);
            if (vehicleFormData.company) submitData.append('company', vehicleFormData.company);
            if (vehicleFormData.driver) submitData.append('driver', vehicleFormData.driver);
            if (vehicleFormData.vehicle_photo) submitData.append('vehicle_photo', vehicleFormData.vehicle_photo);

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
            onHide();
        } catch (error) {
            console.error('Error creating vehicle', error);
            const errorMsg = error.response?.data?.vehicle_number?.[0] || 'Failed to register vehicle. Please try again.';
            Swal.fire('Error', errorMsg, 'error');
        } finally {
            setVehicleLoading(false);
        }
    };

    return (
        <Modal 
            show={show} 
            onHide={onHide} 
            dialogClassName="item-custom-modal visitor-modal"
            backdrop="static"
            keyboard={false}
            restoreFocus={false}
            enforceFocus={false}
            size="lg" 
            centered 
            style={{ zIndex }} 
            backdropClassName="spot-visitor-backdrop"
        >
            {/* Standard Modal Header */}
            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {activeTab === 'visitor' ? (
                                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="white" />
                            ) : (
                                <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="white" />
                            )}
                        </svg>
                    </div>
                    <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                    {activeTab === 'visitor' ? 'New Visitor Registration' : 'New Vehicle Registration'}
                                </h4>
                                <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                    {activeTab === 'visitor' ? 'Enter visitor personal and company information' : 'Enter vehicle registration details'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide}>
                    &times;
                </button>
            </div>

            {/* Standard Modal Body */}
            <div className="modal-body-custom">
                {/* Canonical Toggle Switcher Pill */}
                <div className="text-center mb-4">
                    <div style={{ background: '#f1f5f9', padding: '4px', borderRadius: '10px', display: 'inline-flex', position: 'relative', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }}>
                        <div 
                            style={{ 
                                position: 'absolute', 
                                top: '4px', bottom: '4px', width: 'calc(50% - 4px)', background: '#fff', borderRadius: '8px', 
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)', 
                                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                transform: activeTab === 'visitor' ? 'translateX(0)' : 'translateX(100%)',
                                left: '4px'
                            }} 
                        />
                        <button 
                            type="button" 
                            style={{ 
                                position: 'relative', 
                                zIndex: 1, 
                                border: 'none', 
                                background: 'transparent', 
                                padding: '8px 32px', 
                                fontSize: '14px', 
                                fontWeight: activeTab === 'visitor' ? '600' : '500', 
                                color: activeTab === 'visitor' ? '#0a500f' : '#64748b', 
                                transition: 'color 0.3s ease', 
                                cursor: 'pointer' 
                            }} 
                            onClick={() => {
                                setActiveTab('visitor');
                                setTimeout(() => visitorNameRef.current && visitorNameRef.current.focus(), 100);
                            }}
                        >
                            <i className="fa fa-user me-2"></i>Visitor
                        </button>
                        <button 
                            type="button" 
                            style={{ 
                                position: 'relative', 
                                zIndex: 1, 
                                border: 'none', 
                                background: 'transparent', 
                                padding: '8px 32px', 
                                fontSize: '14px', 
                                fontWeight: activeTab === 'vehicle' ? '600' : '500', 
                                color: activeTab === 'vehicle' ? '#0a500f' : '#64748b', 
                                transition: 'color 0.3s ease', 
                                cursor: 'pointer' 
                            }} 
                            onClick={() => {
                                setActiveTab('vehicle');
                                setTimeout(() => vehicleNumRef.current && vehicleNumRef.current.focus(), 100);
                            }}
                        >
                            <i className="fa fa-car me-2"></i>Vehicle
                        </button>
                    </div>
                </div>

                {/* ──────── VISITOR FORM ──────── */}
                {activeTab === 'visitor' ? (
                    <Form ref={visitorFormRef} onSubmit={handleSubmitVisitor} onKeyDown={handleKeyDown}>
                        <div className="row mb-3">
                            <div className="col-md-6">
                                <Form.Label className="form-label-custom">Visitor Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control 
                                    ref={visitorNameRef}
                                    type="text" 
                                    name="visitor_name" 
                                    className="form-control-custom" 
                                    value={formData.visitor_name} 
                                    onChange={handleChange} 
                                    placeholder="Enter visitor name" 
                                    autoFocus={true} 
                                    required 
                                />
                            </div>
                            <div className="col-md-6">
                                <Form.Label className="form-label-custom">Mobile Number <span className="text-danger">*</span></Form.Label>
                                <Form.Control 
                                    type="text" 
                                    name="mobile_no" 
                                    className="form-control-custom" 
                                    value={formData.mobile_no} 
                                    onChange={handleChange} 
                                    placeholder="e.g. 9876543210" 
                                    maxLength={15} 
                                    required 
                                />
                            </div>
                        </div>

                        <div className="row mb-3">
                            <div className="col-md-6">
                                <Form.Label className="form-label-custom">Email Address</Form.Label>
                                <Form.Control 
                                    type="email" 
                                    name="email" 
                                    className="form-control-custom" 
                                    value={formData.email} 
                                    onChange={handleChange} 
                                    placeholder="e.g. visitor@company.com" 
                                />
                            </div>
                            <div className="col-md-6">
                                <Form.Label className="form-label-custom">Company Name</Form.Label>
                                <Form.Control 
                                    type="text" 
                                    name="company_name" 
                                    className="form-control-custom" 
                                    value={formData.company_name} 
                                    onChange={handleChange} 
                                    placeholder="e.g. Acme Corp" 
                                />
                            </div>
                        </div>

                        <div className="row mb-3">
                            <div className="col-md-6">
                                <Form.Label className="form-label-custom">Department <span className="text-danger">*</span></Form.Label>
                                <Select 
                                    classNamePrefix="react-select" 
                                    options={toOptions(departments)} 
                                    value={findOption(toOptions(departments), formData.department)} 
                                    onChange={(opt) => setFormData(prev => ({ ...prev, department: opt ? opt.value : '' }))} 
                                    placeholder="Select Department..." 
                                    isClearable 
                                    openMenuOnFocus={true} 
                                    styles={selectStyles} 
                                    isDisabled={!!initialDepartment}
                                />
                            </div>
                            <div className="col-md-6">
                                <Form.Label className="form-label-custom">Address</Form.Label>
                                <Form.Control 
                                    type="text" 
                                    name="address" 
                                    className="form-control-custom" 
                                    value={formData.address} 
                                    onChange={handleChange} 
                                    placeholder="Enter address..." 
                                />
                            </div>
                        </div>

                        <hr className="my-3" style={{ borderColor: '#e2e8f0' }} />
                        <h6 className="font-w600 text-dark mb-3" style={{ fontSize: '14px' }}>Document Uploads (Photos)</h6>
                        
                        <div className="row">
                            {/* Visitor Photo */}
                            <div className="col-md-4 mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <Form.Label className="form-label-custom mb-0">Visitor Photo <span className="text-danger">*</span></Form.Label>
                                    <Button 
                                        size="sm" 
                                        type="button" 
                                        onClick={() => handleCameraCapture('visitor_photo')} 
                                        className="btn-camera-upload d-flex align-items-center gap-1 px-2 py-1" 
                                        style={{ background: '#0a500f', borderColor: '#0a500f', color: '#fff', fontSize: '11px', borderRadius: '6px' }}
                                    >
                                        <i className="fa fa-camera"></i> Camera
                                    </Button>
                                </div>
                                <div 
                                    className={`image-upload-btn dropzone-upload${previews.visitor_photo ? ' has-image' : ''}`} 
                                    role="button" 
                                    tabIndex={0} 
                                    onClick={() => document.getElementById('visitor_photo_file')?.click()}
                                >
                                    {previews.visitor_photo ? (
                                        <Fragment>
                                            <img src={previews.visitor_photo} alt="preview" className="dz-thumb" />
                                            <div className="dz-file-info">
                                                <span className="dz-file-name">{formData.visitor_photo?.name || 'Photo captured'}</span>
                                                <span className="dz-file-hint">Click to replace</span>
                                            </div>
                                            <button 
                                                type="button" 
                                                className="dz-remove-btn" 
                                                title="Remove photo" 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    setFormData(prev => ({ ...prev, visitor_photo: null })); 
                                                    setPreviews(prev => ({ ...prev, visitor_photo: null })); 
                                                }}
                                            >×</button>
                                        </Fragment>
                                    ) : (
                                        <Fragment>
                                            <svg className="dz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M7 17a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 8.96" />
                                                <path d="M12 12v7" />
                                                <path d="M9.5 14.5 12 12l2.5 2.5" />
                                            </svg>
                                            <span className="dz-title">Drag &amp; drop, or <span>browse</span></span>
                                            <span className="dz-subtitle">PNG or JPG</span>
                                        </Fragment>
                                    )}
                                    <input id="visitor_photo_file" type="file" name="visitor_photo" accept="image/*" style={{ display: 'none' }} onChange={handleChange} />
                                </div>
                            </div>

                            {/* ID Card Photo */}
                            <div className="col-md-4 mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <Form.Label className="form-label-custom mb-0">ID Card Photo <span className="text-danger">*</span></Form.Label>
                                    <Button 
                                        size="sm" 
                                        type="button" 
                                        onClick={() => handleCameraCapture('id_card_photo')} 
                                        className="btn-camera-upload d-flex align-items-center gap-1 px-2 py-1" 
                                        style={{ background: '#0a500f', borderColor: '#0a500f', color: '#fff', fontSize: '11px', borderRadius: '6px' }}
                                    >
                                        <i className="fa fa-camera"></i> Camera
                                    </Button>
                                </div>
                                <div 
                                    className={`image-upload-btn dropzone-upload${previews.id_card_photo ? ' has-image' : ''}`} 
                                    role="button" 
                                    tabIndex={0} 
                                    onClick={() => document.getElementById('id_card_photo_file')?.click()}
                                >
                                    {previews.id_card_photo ? (
                                        <Fragment>
                                            <img src={previews.id_card_photo} alt="preview" className="dz-thumb" />
                                            <div className="dz-file-info">
                                                <span className="dz-file-name">{formData.id_card_photo?.name || 'Photo captured'}</span>
                                                <span className="dz-file-hint">Click to replace</span>
                                            </div>
                                            <button 
                                                type="button" 
                                                className="dz-remove-btn" 
                                                title="Remove photo" 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    setFormData(prev => ({ ...prev, id_card_photo: null })); 
                                                    setPreviews(prev => ({ ...prev, id_card_photo: null })); 
                                                }}
                                            >×</button>
                                        </Fragment>
                                    ) : (
                                        <Fragment>
                                            <svg className="dz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M7 17a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 8.96" />
                                                <path d="M12 12v7" />
                                                <path d="M9.5 14.5 12 12l2.5 2.5" />
                                            </svg>
                                            <span className="dz-title">Drag &amp; drop, or <span>browse</span></span>
                                            <span className="dz-subtitle">PNG or JPG</span>
                                        </Fragment>
                                    )}
                                    <input id="id_card_photo_file" type="file" name="id_card_photo" accept="image/*" style={{ display: 'none' }} onChange={handleChange} />
                                </div>
                            </div>

                            {/* Visiting Card Photo */}
                            <div className="col-md-4 mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <Form.Label className="form-label-custom mb-0">Visiting Card</Form.Label>
                                    <Button 
                                        size="sm" 
                                        type="button" 
                                        onClick={() => handleCameraCapture('visiting_card_photo')} 
                                        className="btn-camera-upload d-flex align-items-center gap-1 px-2 py-1" 
                                        style={{ background: '#0a500f', borderColor: '#0a500f', color: '#fff', fontSize: '11px', borderRadius: '6px' }}
                                    >
                                        <i className="fa fa-camera"></i> Camera
                                    </Button>
                                </div>
                                <div 
                                    className={`image-upload-btn dropzone-upload${previews.visiting_card_photo ? ' has-image' : ''}`} 
                                    role="button" 
                                    tabIndex={0} 
                                    onClick={() => document.getElementById('visiting_card_photo_file')?.click()}
                                >
                                    {previews.visiting_card_photo ? (
                                        <Fragment>
                                            <img src={previews.visiting_card_photo} alt="preview" className="dz-thumb" />
                                            <div className="dz-file-info">
                                                <span className="dz-file-name">{formData.visiting_card_photo?.name || 'Photo captured'}</span>
                                                <span className="dz-file-hint">Click to replace</span>
                                            </div>
                                            <button 
                                                type="button" 
                                                className="dz-remove-btn" 
                                                title="Remove photo" 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    setFormData(prev => ({ ...prev, visiting_card_photo: null })); 
                                                    setPreviews(prev => ({ ...prev, visiting_card_photo: null })); 
                                                }}
                                            >×</button>
                                        </Fragment>
                                    ) : (
                                        <Fragment>
                                            <svg className="dz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M7 17a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 8.96" />
                                                <path d="M12 12v7" />
                                                <path d="M9.5 14.5 12 12l2.5 2.5" />
                                            </svg>
                                            <span className="dz-title">Drag &amp; drop, or <span>browse</span></span>
                                            <span className="dz-subtitle">PNG or JPG</span>
                                        </Fragment>
                                    )}
                                    <input id="visiting_card_photo_file" type="file" name="visiting_card_photo" accept="image/*" style={{ display: 'none' }} onChange={handleChange} />
                                </div>
                            </div>
                        </div>

                        {/* Standard Footer */}
                        <div className="modal-footer-custom mt-3">
                            <Button type="button" className="btn-close-custom" onClick={onHide}>
                                Close
                            </Button>
                            <Button type="submit" className="btn-save-custom" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Spinner size="sm" className="me-2" />
                                        Processing...
                                    </>
                                ) : (
                                    'Save & Proceed'
                                )}
                            </Button>
                        </div>
                    </Form>
                ) : (
                    /* ──────── VEHICLE FORM ──────── */
                    <Form onSubmit={handleSubmitVehicle} onKeyDown={handleKeyDown}>
                        <div className="row mb-3">
                            <div className="col-md-6">
                                <Form.Label className="form-label-custom">Vehicle Number <span className="text-danger">*</span></Form.Label>
                                <Form.Control 
                                    ref={vehicleNumRef}
                                    type="text" 
                                    name="vehicle_number" 
                                    className="form-control-custom fw-bold" 
                                    value={vehicleFormData.vehicle_number} 
                                    onChange={handleVehicleChange} 
                                    placeholder="e.g. KL 01 AB 1234" 
                                    autoFocus={true} 
                                    required 
                                    style={{ letterSpacing: '1px' }}
                                />
                            </div>
                            <div className="col-md-6">
                                <Form.Label className="form-label-custom">Vehicle Type</Form.Label>
                                <Select 
                                    classNamePrefix="react-select" 
                                    options={toOptions(vehicleTypes)} 
                                    value={findOption(toOptions(vehicleTypes), vehicleFormData.vehicle_type)} 
                                    onChange={(opt) => setVehicleFormData(prev => ({ ...prev, vehicle_type: opt ? opt.value : '' }))} 
                                    placeholder="Select Vehicle Type..." 
                                    isClearable 
                                    openMenuOnFocus={true} 
                                    styles={selectStyles} 
                                />
                            </div>
                        </div>

                        <div className="row mb-3">
                            <div className="col-md-6">
                                <Form.Label className="form-label-custom">Company / Vendor Name</Form.Label>
                                <Form.Control 
                                    type="text" 
                                    name="company" 
                                    className="form-control-custom" 
                                    value={vehicleFormData.company} 
                                    onChange={handleVehicleChange} 
                                    placeholder="e.g. Logistics Inc" 
                                />
                            </div>
                            <div className="col-md-6">
                                <Form.Label className="form-label-custom">Driver Name</Form.Label>
                                <Form.Control 
                                    type="text" 
                                    name="driver" 
                                    className="form-control-custom" 
                                    value={vehicleFormData.driver} 
                                    onChange={handleVehicleChange} 
                                    placeholder="e.g. John Doe" 
                                />
                            </div>
                        </div>

                        <hr className="my-3" style={{ borderColor: '#e2e8f0' }} />
                        <h6 className="font-w600 text-dark mb-3" style={{ fontSize: '14px' }}>Document Uploads (Photos)</h6>
                        
                        <div className="row">
                            {/* Vehicle Photo */}
                            <div className="col-md-4 mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <Form.Label className="form-label-custom mb-0">Vehicle Photo <span className="text-danger">*</span></Form.Label>
                                    <Button 
                                        size="sm" 
                                        type="button" 
                                        onClick={() => handleCameraCapture('vehicle_photo')} 
                                        className="btn-camera-upload d-flex align-items-center gap-1 px-2 py-1" 
                                        style={{ background: '#0a500f', borderColor: '#0a500f', color: '#fff', fontSize: '11px', borderRadius: '6px' }}
                                    >
                                        <i className="fa fa-camera"></i> Camera
                                    </Button>
                                </div>
                                <div 
                                    className={`image-upload-btn dropzone-upload${previews.vehicle_photo ? ' has-image' : ''}`} 
                                    role="button" 
                                    tabIndex={0} 
                                    onClick={() => document.getElementById('vehicle_photo_file')?.click()}
                                >
                                    {previews.vehicle_photo ? (
                                        <Fragment>
                                            <img src={previews.vehicle_photo} alt="preview" className="dz-thumb" />
                                            <div className="dz-file-info">
                                                <span className="dz-file-name">{vehicleFormData.vehicle_photo?.name || 'Photo captured'}</span>
                                                <span className="dz-file-hint">Click to replace</span>
                                            </div>
                                            <button 
                                                type="button" 
                                                className="dz-remove-btn" 
                                                title="Remove photo" 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    setVehicleFormData(prev => ({ ...prev, vehicle_photo: null })); 
                                                    setPreviews(prev => ({ ...prev, vehicle_photo: null })); 
                                                }}
                                            >×</button>
                                        </Fragment>
                                    ) : (
                                        <Fragment>
                                            <svg className="dz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M7 17a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 8.96" />
                                                <path d="M12 12v7" />
                                                <path d="M9.5 14.5 12 12l2.5 2.5" />
                                            </svg>
                                            <span className="dz-title">Drag &amp; drop, or <span>browse</span></span>
                                            <span className="dz-subtitle">PNG or JPG</span>
                                        </Fragment>
                                    )}
                                    <input id="vehicle_photo_file" type="file" name="vehicle_photo" accept="image/*" style={{ display: 'none' }} onChange={handleVehicleChange} />
                                </div>
                            </div>
                        </div>

                        {/* Standard Footer */}
                        <div className="modal-footer-custom mt-3">
                            <Button type="button" className="btn-close-custom" onClick={onHide}>
                                Close
                            </Button>
                            <Button type="submit" className="btn-save-custom" disabled={vehicleLoading}>
                                {vehicleLoading ? (
                                    <>
                                        <Spinner size="sm" className="me-2" />
                                        Processing...
                                    </>
                                ) : (
                                    'Save & Proceed'
                                )}
                            </Button>
                        </div>
                    </Form>
                )}
            </div>

            <CameraCapture
                show={showCamera}
                onHide={() => setShowCamera(false)}
                onCapture={onCameraImageCaptured}
                title={`Capture ${activeCameraField?.replace(/_/g, ' ')}`}
                isDark={isDark}
                zIndex={zIndex + 10}
            />

            <style dangerouslySetInnerHTML={{
                __html: `
                .spot-visitor-backdrop {
                    z-index: ${zIndex - 5} !important;
                }
                .item-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden !important;
                }
                .item-custom-modal .modal-header-custom {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    padding: 24px 28px 16px 28px !important;
                    border-bottom: 1px solid #f1f5f9 !important;
                    background-color: #ffffff !important;
                    width: 100% !important;
                }
                .item-custom-modal .modal-icon-circle {
                    width: 48px !important;
                    height: 48px !important;
                    background-color: #0a500f !important;
                    border-radius: 50% !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2) !important;
                    flex-shrink: 0 !important;
                }
                .item-custom-modal .modal-close-x {
                    border: none !important;
                    background: transparent !important;
                    font-size: 28px !important;
                    color: #aaa !important;
                    cursor: pointer !important;
                    transition: color 0.2s !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    padding: 4px !important;
                    line-height: 1 !important;
                }
                .item-custom-modal .modal-close-x:hover {
                    color: #555 !important;
                }
                .item-custom-modal .modal-body-custom {
                    padding: 24px 28px !important;
                    background-color: #ffffff !important;
                }
                .item-custom-modal .form-label-custom {
                    font-size: 13px !important;
                    font-weight: 500 !important;
                    color: #4a5568 !important;
                    margin-bottom: 6px !important;
                }
                .item-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1 !important;
                    border-radius: 10px !important;
                    padding: 10px 14px !important;
                    height: 38px !important;
                    font-size: 13px !important;
                    color: #334155 !important;
                    background-color: #fff !important;
                    transition: border-color 0.2s, box-shadow 0.2s !important;
                    width: 100% !important;
                }
                .item-custom-modal textarea.form-control-custom {
                    height: auto !important;
                }
                .item-custom-modal .form-control-custom:focus {
                    outline: none !important;
                    border-color: #0a500f !important;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15) !important;
                }
                .item-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8 !important;
                }
                .item-custom-modal .modal-footer-custom {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: flex-end !important;
                    padding: 20px 28px 24px 28px !important;
                    border-top: 1px solid #f1f5f9 !important;
                    background-color: #fafbfc !important;
                    gap: 12px !important;
                    margin: 0 -28px -24px -28px !important;
                }
                .item-custom-modal .btn-close-custom {
                    background-color: #dc3545 !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer !important;
                    transition: background-color 0.2s, transform 0.1s !important;
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
                    cursor: pointer !important;
                    transition: background-color 0.2s, transform 0.1s !important;
                    display: inline-flex !important;
                    align-items: center !important;
                }
                .item-custom-modal .btn-save-custom:hover:not(:disabled) {
                    background-color: #25a870 !important;
                }
                .item-custom-modal .btn-save-custom:disabled {
                    opacity: 0.65 !important;
                    cursor: not-allowed !important;
                }
                .item-custom-modal .dropzone-upload {
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 6px !important;
                    text-align: center !important;
                    border: 2px dashed #cbd5e1 !important;
                    border-radius: 12px !important;
                    background-color: #fafbfc !important;
                    padding: 18px 14px !important;
                    cursor: pointer !important;
                    transition: border-color 0.2s, background-color 0.2s, transform 0.15s !important;
                    outline: none !important;
                }
                .item-custom-modal .dropzone-upload:hover {
                    border-color: #0a500f !important;
                    background-color: #f0fdf6 !important;
                }
                .item-custom-modal .dropzone-upload .dz-icon {
                    width: 30px !important;
                    height: 30px !important;
                    color: #0a500f !important;
                }
                .item-custom-modal .dropzone-upload .dz-title {
                    font-size: 13px !important;
                    font-weight: 600 !important;
                    color: #475569 !important;
                }
                .item-custom-modal .dropzone-upload .dz-title span {
                    color: #16a34a !important;
                    text-decoration: underline !important;
                }
                .item-custom-modal .dropzone-upload .dz-subtitle {
                    font-size: 11px !important;
                    color: #94a3b8 !important;
                }
                .item-custom-modal .dropzone-upload.has-image {
                    flex-direction: row !important;
                    justify-content: flex-start !important;
                    text-align: left !important;
                    padding: 10px 14px !important;
                    gap: 12px !important;
                }
                .item-custom-modal .dz-thumb {
                    width: 52px !important;
                    height: 52px !important;
                    border-radius: 8px !important;
                    object-fit: cover !important;
                    border: 1px solid #e2e8f0 !important;
                    flex-shrink: 0 !important;
                }
                .item-custom-modal .dz-file-info {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 2px !important;
                    overflow: hidden !important;
                    flex: 1 !important;
                }
                .item-custom-modal .dz-file-name {
                    font-size: 12px !important;
                    font-weight: 600 !important;
                    color: #1e293b !important;
                    white-space: nowrap !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                }
                .item-custom-modal .dz-file-hint {
                    font-size: 11px !important;
                    color: #64748b !important;
                }
                .item-custom-modal .dz-remove-btn {
                    border: none !important;
                    background: #fee2e2 !important;
                    color: #ef4444 !important;
                    border-radius: 50% !important;
                    width: 24px !important;
                    height: 24px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    font-size: 14px !important;
                    cursor: pointer !important;
                    line-height: 1 !important;
                    flex-shrink: 0 !important;
                }
                .item-custom-modal .dz-remove-btn:hover {
                    background: #ef4444 !important;
                    color: #fff !important;
                }
                `
            }} />
        </Modal>
    );
};

export default SpotVisitorModal;
