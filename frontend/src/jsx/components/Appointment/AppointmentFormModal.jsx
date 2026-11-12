import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Spinner } from 'react-bootstrap';
import Swal from 'sweetalert2';
import AsyncSelect from 'react-select/async';
import AppointmentService from '../../../services/AppointmentService';
import GateManagementService, { searchVisitorByMobile, searchVehicleByNumber } from '../../../services/GateManagementService';
import { getEmployees } from '../../../services/HRManagementService';
import SpotVisitorModal from '../AccessPoint/SpotVisitorModal';
import SpotVehicleModal from '../AccessPoint/SpotVehicleModal';

const EMPTY_APPOINTMENT = {
    department: '',
    designation: '',
    concerned_staff: '',
    visitor_category: '',
    visitor: '',
    visitor_name: '',
    visitor_phone: '',
    vehicle: '',
    vehicle_number: '',
    purpose_of_visit: '',
    appointment_date: '',
    appointment_time: '',
    contact_person: '',
    contact_number: '',
};

const getTodayDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const AppointmentFormModal = ({ show, onHide, itemToEdit, onSave }) => {
    const isEditMode = !!itemToEdit;
    const [formData, setFormData] = useState({ ...EMPTY_APPOINTMENT });

    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [departmentEmployees, setDepartmentEmployees] = useState([]);

    // Visitor Search State
    const [searchMobile, setSearchMobile] = useState('');
    const [visitorData, setVisitorData] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [showSpotModal, setShowSpotModal] = useState(false);
    const [showSpotVehicleModal, setShowSpotVehicleModal] = useState(false);
    const [entryMode, setEntryMode] = useState('visitor');
    const [vehicleData, setVehicleData] = useState(null);
    const [searchResults, setSearchResults] = useState([]);

    useEffect(() => {
        if (show) {
            loadInitialData();
            if (itemToEdit) {
                setFormData({
                    department: itemToEdit.department || '',
                    designation: itemToEdit.designation || '',
                    concerned_staff: itemToEdit.concerned_staff || '',
                    visitor_category: itemToEdit.visitor_category || '',
                    visitor: itemToEdit.visitor || '',
                    visitor_name: itemToEdit.visitor_name || '',
                    visitor_phone: itemToEdit.visitor_phone || '',
                    vehicle: itemToEdit.vehicle || '',
                    vehicle_number: itemToEdit.vehicle_number || '',
                    purpose_of_visit: itemToEdit.purpose_of_visit || '',
                    appointment_date: itemToEdit.appointment_date || '',
                    appointment_time: itemToEdit.appointment_time || '',
                    contact_person: itemToEdit.contact_person || '',
                    contact_number: itemToEdit.contact_number || '',
                });
                setSearchMobile(itemToEdit.visitor_phone || '');
                if (itemToEdit.visitor_name) {
                    setVisitorData({
                        id: itemToEdit.visitor,
                        visitor_name: itemToEdit.visitor_name,
                        mobile_no: itemToEdit.visitor_phone
                    });
                    setEntryMode('visitor');
                } else if (itemToEdit.vehicle_number) {
                    setVehicleData({
                        id: itemToEdit.vehicle,
                        vehicle_number: itemToEdit.vehicle_number,
                        company: itemToEdit.company || ''
                    });
                    setSearchMobile(itemToEdit.vehicle_number);
                    setEntryMode('vehicle');
                }
                if (itemToEdit.department) {
                    loadDesignations(itemToEdit.department);
                    loadDepartmentEmployees(itemToEdit.department);
                }
                if (itemToEdit.department && itemToEdit.designation) loadStaff(itemToEdit.department, itemToEdit.designation);
            } else {
                setFormData({ ...EMPTY_APPOINTMENT });
                setSearchMobile('');
                setVisitorData(null);
                setVehicleData(null);
                setEntryMode('visitor');
            }
        }
    }, [show, itemToEdit]);

    const loadInitialData = async () => {
        try {
            // Load Visitor Categories
            try {
                const cats = await GateManagementService.getGateCategories();
                setCategories(cats);
            } catch (e) {
                console.error("Error loading categories", e);
            }

            // Load all departments for selection
            let allDepts = [];
            try {
                allDepts = await AppointmentService.getAllDepartments();
                setDepartments(allDepts || []);
            } catch (e) {
                console.error('Error loading all departments:', e);
            }

            // In create mode, identify and load user's default department and its employees
            if (!itemToEdit) {
                let defaultDeptId = null;
                try {
                    const myDept = await AppointmentService.getMyDepartment();
                    if (myDept && myDept.id) {
                        defaultDeptId = myDept.id;
                    }
                } catch (e) {
                    // Fall back to first available department
                    if (allDepts && allDepts.length > 0) {
                        defaultDeptId = allDepts[0].id;
                    }
                }

                if (defaultDeptId) {
                    setFormData(prev => ({ 
                        ...prev, 
                        department: defaultDeptId,
                        contact_person: '',
                        contact_number: ''
                    }));
                    loadDesignations(defaultDeptId);
                    loadDepartmentEmployees(defaultDeptId);
                }
            }
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    };

    const loadDesignations = async (deptId) => {
        if (!deptId) {
            setDesignations([]);
            return;
        }
        try {
            const data = await AppointmentService.getDesignationsByDepartment(deptId);
            setDesignations(data || []);
        } catch (error) {
            console.error('Error loading designations:', error);
        }
    };

    const loadStaff = async (deptId, desigId) => {
        if (!deptId || !desigId) {
            setStaffList([]);
            return;
        }
        try {
            const data = await AppointmentService.getStaffByDesignation(deptId, desigId);
            setStaffList(data || []);
        } catch (error) {
            console.error('Error loading staff:', error);
        }
    };

    const loadDepartmentEmployees = async (deptId) => {
        if (!deptId) {
            setDepartmentEmployees([]);
            return;
        }
        try {
            const data = await getEmployees(deptId);
            const list = Array.isArray(data) ? data : (data?.results || []);
            setDepartmentEmployees(list);
        } catch (error) {
            console.error('Error loading department employees:', error);
            setDepartmentEmployees([]);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'appointment_date' && value && value < getTodayDate()) {
            Swal.fire('Invalid Date', 'Backdated appointments are not allowed. Please select today or a future date.', 'warning');
            setFormData(prev => ({ ...prev, appointment_date: getTodayDate() }));
            return;
        }

        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'department') {
            setFormData(prev => ({ 
                ...prev, 
                department: value,
                designation: '', 
                concerned_staff: '', 
                contact_person: '', 
                contact_number: '' 
            }));
            loadDesignations(value);
            loadDepartmentEmployees(value);
        } else if (name === 'designation') {
            setFormData(prev => ({ ...prev, concerned_staff: '' }));
            loadStaff(formData.department, value);
        } else if (name === 'contact_person') {
            const selectedEmp = departmentEmployees.find(emp => 
                String(emp.user) === String(value) || 
                String(emp.id) === String(value)
            );
            const empPhone = selectedEmp ? (selectedEmp.phone || selectedEmp.mobile_number || '').replace(/[^0-9]/g, '') : '';
            setFormData(prev => ({
                ...prev,
                contact_person: value,
                contact_number: empPhone || prev.contact_number || ''
            }));
        } else if (name === 'contact_number') {
            const integerVal = value.replace(/[^0-9]/g, '');
            setFormData(prev => ({ ...prev, contact_number: integerVal }));
        }
    };

    const handleMobileKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        }
    };

    const handleSearch = async () => {
        if (entryMode === 'visitor') {
            await handleSearchVisitor();
        } else {
            await handleSearchVehicle();
        }
    };

    const handleSearchVisitor = async () => {
        const trimmedMobile = searchMobile.trim();
        if (trimmedMobile.length < 10) {
            Swal.fire('Error', 'Please enter a valid mobile number (at least 10 digits)', 'warning');
            return;
        }
        try {
            setIsSearching(true);
            const data = await searchVisitorByMobile(trimmedMobile);
            const visitor = Array.isArray(data) ? data[0] : data;
            if (visitor) {
                setVisitorData(visitor);
                setFormData(prev => ({
                    ...prev,
                    visitor: visitor.id,
                    visitor_name: visitor.visitor_name,
                    visitor_phone: visitor.mobile_no
                }));
                Swal.fire({ icon: 'success', title: 'Visitor Found', text: `${visitor.visitor_name} loaded.`, timer: 1500, showConfirmButton: false });
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Not Found',
                text: 'Visitor not found. Register them now?',
                showCancelButton: true,
                confirmButtonText: 'Yes, Register Now',
            }).then((result) => {
                if (result.isConfirmed) setShowSpotModal(true);
            });
            setVisitorData(null);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchVehicle = async () => {
        const trimmedVehicle = searchMobile.trim();
        if (trimmedVehicle.length < 3) {
            Swal.fire('Error', 'Please enter a valid vehicle number', 'warning');
            return;
        }
        try {
            setIsSearching(true);
            const data = await searchVehicleByNumber(trimmedVehicle);
            const vehicle = Array.isArray(data) ? data[0] : data;
            if (vehicle) {
                setVehicleData(vehicle);
                setFormData(prev => ({
                    ...prev,
                    vehicle: vehicle.id,
                    vehicle_number: vehicle.vehicle_number
                }));
                Swal.fire({ icon: 'success', title: 'Vehicle Found', text: `${vehicle.vehicle_number} loaded.`, timer: 1500, showConfirmButton: false });
            } else {
                throw new Error("Not found");
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Not Found',
                text: 'Vehicle not found. Register it now?',
                showCancelButton: true,
                confirmButtonText: 'Yes, Register Now',
            }).then((result) => {
                if (result.isConfirmed) setShowSpotVehicleModal(true);
            });
            setVehicleData(null);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.appointment_date && formData.appointment_date < getTodayDate()) {
            Swal.fire('Invalid Date', 'Backdated appointments are not allowed. Please select today or a future date.', 'warning');
            return;
        }

        setLoading(true);
        try {
            if (isEditMode) {
                await AppointmentService.updateAppointment(itemToEdit.id, formData);
            } else {
                await AppointmentService.createAppointment(formData);
            }
            Swal.fire({
                icon: 'success',
                title: isEditMode ? 'Appointment Updated' : 'Appointment Created',
                text: isEditMode ? 'Appointment has been updated successfully.' : 'Appointment has been scheduled successfully.',
                timer: 1500,
                showConfirmButton: false
            });
            onSave();
            onHide();
        } catch (error) {
            console.error('Error saving appointment:', error);
            const errData = error.response?.data;
            let errMsg = 'Failed to save appointment. Please check all fields.';
            if (errData) {
                if (typeof errData === 'string') {
                    errMsg = errData;
                } else if (typeof errData === 'object') {
                    const messages = [];
                    for (const [key, val] of Object.entries(errData)) {
                        const fieldName = key.replace(/_/g, ' ');
                        const fieldErr = Array.isArray(val) ? val.join(', ') : String(val);
                        messages.push(`<b>${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}:</b> ${fieldErr}`);
                    }
                    if (messages.length > 0) {
                        errMsg = messages.join('<br/>');
                    }
                }
            }
            Swal.fire({
                icon: 'error',
                title: 'Failed to Save Appointment',
                html: errMsg,
                confirmButtonColor: '#0a500f'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Modal 
                show={show} 
                onHide={onHide} 
                size="lg" 
                centered
                backdrop="static"
                keyboard={false}
                dialogClassName="appointment-custom-modal"
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 4H18V2H16V4H8V2H6V4H5C3.89 4 3.01 4.9 3.01 6L3 20C3 21.1 3.89 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V10H19V20ZM19 8H5V6H19V8Z" fill="white" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {isEditMode ? 'Edit Appointment' : 'Add Appointment'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage appointment
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={onHide}>
                        &times;
                    </button>
                </div>
                
                <Form onSubmit={handleSubmit}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="form-group col-md-4 mb-3">
                                <Form.Label className="form-label-custom">Department <span className="text-danger">*</span></Form.Label>
                                <Form.Select
                                    name="department"
                                    className="form-control-custom"
                                    value={formData.department}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">Select Department</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </Form.Select>
                            </div>
                            <div className="form-group col-md-4 mb-3">
                                <Form.Label className="form-label-custom">Designation <span className="text-danger">*</span></Form.Label>
                                <Form.Select
                                    name="designation"
                                    className="form-control-custom"
                                    value={formData.designation}
                                    onChange={handleChange}
                                    required
                                    disabled={!formData.department}
                                >
                                    <option value="">Select Designation</option>
                                    {designations.map(d => (
                                        <option key={d.id} value={d.id}>{d.title}</option>
                                    ))}
                                </Form.Select>
                            </div>
                            <div className="form-group col-md-4 mb-3">
                                <Form.Label className="form-label-custom">Concerned Staff <span className="text-danger">*</span></Form.Label>
                                <Form.Select
                                    name="concerned_staff"
                                    className="form-control-custom"
                                    value={formData.concerned_staff}
                                    onChange={handleChange}
                                    required
                                    disabled={!formData.designation}
                                >
                                    <option value="">Select Staff</option>
                                    {staffList.map(s => (
                                        <option key={s.id} value={s.id}>{s.full_name}</option>
                                    ))}
                                </Form.Select>
                            </div>
                        </div>

                        <div className="row">
                            <div className="form-group col-md-4 mb-3">
                                <Form.Label className="form-label-custom">Visitor Category <span className="text-danger">*</span></Form.Label>
                                <Form.Select
                                    name="visitor_category"
                                    className="form-control-custom"
                                    value={formData.visitor_category}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">Select Category</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </Form.Select>
                            </div>
                            <div className="form-group col-md-4 mb-3">
                                <Form.Label className="form-label-custom">Contact Person</Form.Label>
                                <Form.Select
                                    name="contact_person"
                                    className="form-control-custom"
                                    value={formData.contact_person}
                                    onChange={handleChange}
                                    disabled={!formData.department}
                                >
                                    <option value="">Select Contact Person</option>
                                    {formData.contact_person && !departmentEmployees.some(s => String(s.user || s.id) === String(formData.contact_person)) && (
                                        <option value={formData.contact_person}>{itemToEdit?.contact_person_name || formData.contact_person}</option>
                                    )}
                                    {departmentEmployees.filter(s => !!s.user || !!s.id).map(s => (
                                        <option key={s.id} value={s.user || s.id}>{s.full_name || s.user_name || s.username || `Employee #${s.id}`}</option>
                                    ))}
                                </Form.Select>
                            </div>
                            <div className="form-group col-md-4 mb-3">
                                <Form.Label className="form-label-custom">Contact Number</Form.Label>
                                <Form.Control
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    name="contact_number"
                                    className="form-control-custom"
                                    value={formData.contact_number}
                                    onChange={handleChange}
                                    placeholder="Enter contact number..."
                                    maxLength={15}
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="form-group col-md-12 mb-3">
                                <Form.Label className="form-label-custom">Registered Visitor / Vehicle <span className="text-danger">*</span></Form.Label>
                                <div className="d-flex align-items-center flex-wrap gap-2 mb-3">
                                    <div style={{ flex: '1 1 280px', minWidth: 0, position: 'relative' }}>
                                        <style>{`
                                            .search-icon-input { padding-left: 38px !important; }
                                        `}</style>
                                        <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                                            <i className={entryMode === 'visitor' ? "fa fa-phone text-muted" : "fa fa-truck text-muted"}></i>
                                        </div>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search by Mobile (10 digits) or Vehicle No (e.g. MH-01-AB-1234)"
                                            value={searchMobile}
                                            onChange={(e) => {
                                                const val = e.target.value.toUpperCase();
                                                setSearchMobile(val);
                                                if (/[A-Z]/.test(val)) {
                                                    setEntryMode('vehicle');
                                                    setVisitorData(null);
                                                    setFormData(prev => ({ ...prev, visitor: '', visitor_name: '', visitor_phone: '' }));
                                                } else {
                                                    setEntryMode('visitor');
                                                    setVehicleData(null);
                                                    setFormData(prev => ({ ...prev, vehicle: '', vehicle_number: '' }));
                                                }
                                            }}
                                            onKeyDown={handleMobileKeyDown}
                                            className="form-control-custom search-icon-input"
                                            style={{ height: '38px', borderRadius: '10px' }}
                                        />
                                    </div>
                                    <Button
                                        variant="success"
                                        className="d-flex align-items-center gap-1 shadow-sm px-3 fw-bold"
                                        style={{ height: '38px', borderRadius: '8px', fontSize: '13px' }}
                                        onClick={handleSearch}
                                        disabled={isSearching}
                                    >
                                        {isSearching ? <Spinner size="sm" /> : <i className="fa fa-search"></i>} Verify
                                    </Button>
                                    <Button
                                        type="button"
                                        className="btn btn-sm d-flex align-items-center justify-content-center px-3"
                                        style={{ height: "38px", borderRadius: "8px", fontWeight: 500, backgroundColor: "var(--cc-primary, #0a500f)", border: "none", color: "white", whiteSpace: "nowrap" }}
                                        onClick={() => {
                                            if (entryMode === 'visitor') setShowSpotModal(true);
                                            else setShowSpotVehicleModal(true);
                                        }}
                                    >
                                        <i className="fa fa-plus-circle me-2"></i>{entryMode === 'visitor' ? 'New Visitor' : 'New Vehicle'}
                                    </Button>
                                </div>
                                
                                {entryMode === 'visitor' && visitorData && (
                                    <div className="p-3 rounded-3 border border-success bg-white shadow-sm mt-2">
                                        <div className="d-flex align-items-center">
                                            <div className="avatar rounded-circle bg-success text-white d-flex align-items-center justify-content-center me-3" style={{ width: '40px', height: '40px' }}>
                                                <i className="fa fa-user"></i>
                                            </div>
                                            <div>
                                                <h6 className="mb-0 fw-bold">{visitorData.visitor_name}</h6>
                                                <small className="text-muted">{visitorData.mobile_no} {visitorData.company_name ? `• ${visitorData.company_name}` : ''}</small>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {entryMode === 'vehicle' && vehicleData && (
                                    <div className="p-3 rounded-3 border border-success bg-white shadow-sm mt-2">
                                        <div className="d-flex align-items-center">
                                            <div className="avatar rounded-circle bg-success text-white d-flex align-items-center justify-content-center me-3" style={{ width: '40px', height: '40px' }}>
                                                <i className="fa fa-truck"></i>
                                            </div>
                                            <div>
                                                <h6 className="mb-0 fw-bold text-dark">{vehicleData.vehicle_number}</h6>
                                                <div className="d-flex align-items-center flex-wrap gap-3 mt-1" style={{ fontSize: '13px' }}>
                                                    {vehicleData.vehicle_type_name && (
                                                        <span className="text-muted"><i className="fa fa-car me-1 text-secondary"></i>{vehicleData.vehicle_type_name}</span>
                                                    )}
                                                    {vehicleData.company && (
                                                        <span className="text-muted"><i className="fa fa-building me-1 text-secondary"></i>{vehicleData.company}</span>
                                                    )}
                                                    {vehicleData.driver && (
                                                        <span className="text-muted"><i className="fa fa-id-badge me-1 text-secondary"></i>{vehicleData.driver}</span>
                                                    )}
                                                    {(!vehicleData.vehicle_type_name && !vehicleData.company && !vehicleData.driver) && (
                                                        <span className="text-muted">No additional info</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="row">
                            <div className="form-group col-md-12 mb-3">
                                <Form.Label className="form-label-custom">Purpose of Visit <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    as="textarea"
                                    name="purpose_of_visit"
                                    className="form-control-custom"
                                    rows={3}
                                    value={formData.purpose_of_visit}
                                    onChange={handleChange}
                                    placeholder="Enter purpose of visit"
                                    required
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="form-group col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Date <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="date"
                                    name="appointment_date"
                                    className="form-control-custom"
                                    min={getTodayDate()}
                                    value={formData.appointment_date}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Time <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="time"
                                    name="appointment_time"
                                    className="form-control-custom"
                                    value={formData.appointment_time}
                                    onChange={handleChange}
                                    required
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
                                isEditMode ? 'Update Appointment' : 'Save'
                            )}
                        </button>
                    </div>
                </Form>
            </Modal>
            
            {/* Spot Visitor Registration Modal */}
            <SpotVisitorModal
                show={showSpotModal}
                onHide={() => setShowSpotModal(false)}
                onVisitorCreated={(visitor) => {
                    setVisitorData(visitor);
                    setFormData(prev => ({
                        ...prev,
                        visitor: visitor.id,
                        visitor_name: visitor.visitor_name,
                        visitor_phone: visitor.mobile_no
                    }));
                    setSearchMobile(visitor.mobile_no);
                }}
                initialMobile={searchMobile}
                isDark={false}
            />

            <style>{`
                .appointment-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .appointment-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .appointment-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .appointment-custom-modal .modal-close-x {
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
                .appointment-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .appointment-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .appointment-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .appointment-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .appointment-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .appointment-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .appointment-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .appointment-custom-modal .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .appointment-custom-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .appointment-custom-modal .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .appointment-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
            `}</style>
        </>
    );
};

export default AppointmentFormModal;
