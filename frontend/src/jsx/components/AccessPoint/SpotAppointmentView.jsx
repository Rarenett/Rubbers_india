import React, { useState, useEffect } from 'react';
import { Form, Button, Spinner } from 'react-bootstrap';
import Swal from 'sweetalert2';
import AppointmentService from '../../../services/AppointmentService';
import GateManagementService, { searchVisitorByMobile, searchVehicleByNumber } from '../../../services/GateManagementService';
import { getEmployees } from '../../../services/HRManagementService';
import SpotVisitorModal from './SpotVisitorModal';
import SpotVehicleModal from './SpotVehicleModal';

const SpotAppointmentView = ({
    initialMode = 'visitor',
    initialSearch = '',
    initialVisitor = null,
    initialVehicle = null,
    initialDepartment = '',
    initialEmployee = '',
    initialPurpose = '',
    initialCategory = '',
    categories: propCategories = [],
    onSuccess,
    onCancel,
    isDark = false
}) => {
    const [entryMode, setEntryMode] = useState(initialMode || 'visitor');
    const [searchMobile, setSearchMobile] = useState(initialSearch || '');
    const [isSearching, setIsSearching] = useState(false);

    const [visitorData, setVisitorData] = useState(initialVisitor || null);
    const [vehicleData, setVehicleData] = useState(initialVehicle || null);

    const [showSpotModal, setShowSpotModal] = useState(false);
    const [showSpotVehicleModal, setShowSpotVehicleModal] = useState(false);

    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [departmentEmployees, setDepartmentEmployees] = useState([]);
    const [categories, setCategories] = useState(propCategories || []);

    const [submitting, setSubmitting] = useState(false);

    const getTodayDate = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getCurrentTime = () => {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const [formData, setFormData] = useState({
        department: initialDepartment || '',
        designation: '',
        concerned_staff: initialEmployee || '',
        visitor_category: initialCategory || '',
        visitor: initialVisitor ? initialVisitor.id : '',
        visitor_name: initialVisitor ? (initialVisitor.visitor_name || '') : '',
        visitor_phone: initialVisitor ? (initialVisitor.mobile_no || '') : '',
        vehicle: initialVehicle ? initialVehicle.id : '',
        vehicle_number: initialVehicle ? (initialVehicle.vehicle_number || '') : '',
        purpose_of_visit: initialPurpose || '',
        appointment_date: getTodayDate(),
        appointment_time: getCurrentTime(),
        contact_person: '',
        contact_number: ''
    });

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            if (!categories || categories.length === 0) {
                try {
                    const cats = await GateManagementService.getGateCategories();
                    setCategories(cats || []);
                    if (cats && cats.length > 0 && !formData.visitor_category) {
                        setFormData(prev => ({ ...prev, visitor_category: cats[0].id }));
                    }
                } catch (e) {
                    console.error("Error loading categories", e);
                }
            } else if (!formData.visitor_category && categories.length > 0) {
                setFormData(prev => ({ ...prev, visitor_category: categories[0].id }));
            }

            try {
                const depts = await AppointmentService.getAllDepartments();
                setDepartments(depts || []);

                if (initialDepartment) {
                    const matchedDept = (depts || []).find(d => String(d.id) === String(initialDepartment));
                    if (matchedDept) {
                        setFormData(prev => ({
                            ...prev,
                            contact_number: prev.contact_number || matchedDept.contact_number || '',
                            contact_person: prev.contact_person || matchedDept.contact_person || '',
                            contact_person_display: matchedDept.contact_person || ''
                        }));
                    }
                    loadDesignations(initialDepartment);
                    loadDepartmentEmployees(initialDepartment, matchedDept?.contact_person, matchedDept?.contact_number);
                } else {
                    try {
                        const myDept = await AppointmentService.getMyDepartment();
                        if (myDept && myDept.id) {
                            setFormData(prev => ({
                                ...prev,
                                department: myDept.id,
                                contact_person: myDept.contact_person || '',
                                contact_person_display: myDept.contact_person || '',
                                contact_number: myDept.contact_number || ''
                            }));
                            loadDesignations(myDept.id);
                            loadDepartmentEmployees(myDept.id, myDept.contact_person, myDept.contact_number);
                        }
                    } catch (_) {}
                }
            } catch (err) {
                console.error("Error loading departments", err);
            }
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    };

    useEffect(() => {
        if (initialVisitor) {
            setVisitorData(initialVisitor);
            setEntryMode('visitor');
            setFormData(prev => ({
                ...prev,
                visitor: initialVisitor.id,
                visitor_name: initialVisitor.visitor_name || '',
                visitor_phone: initialVisitor.mobile_no || ''
            }));
            setSearchMobile(initialVisitor.mobile_no || '');
        } else if (initialVehicle) {
            setVehicleData(initialVehicle);
            setEntryMode('vehicle');
            setFormData(prev => ({
                ...prev,
                vehicle: initialVehicle.id,
                vehicle_number: initialVehicle.vehicle_number || ''
            }));
            setSearchMobile(initialVehicle.vehicle_number || '');
        } else if (initialSearch) {
            setSearchMobile(initialSearch);
            const isVehicle = /[A-Z]/.test(initialSearch.toUpperCase());
            if (isVehicle) {
                setEntryMode('vehicle');
                setFormData(prev => ({
                    ...prev,
                    vehicle_number: initialSearch.toUpperCase()
                }));
                searchVehicleByNumber(initialSearch.toUpperCase()).then(data => {
                    const veh = Array.isArray(data) ? data[0] : data;
                    if (veh) {
                        setVehicleData(veh);
                        setFormData(p => ({
                            ...p,
                            vehicle: veh.id,
                            vehicle_number: veh.vehicle_number
                        }));
                    }
                }).catch(() => {});
            } else {
                setEntryMode('visitor');
                setFormData(prev => ({
                    ...prev,
                    visitor_phone: initialSearch
                }));
                searchVisitorByMobile(initialSearch).then(data => {
                    const vis = Array.isArray(data) ? data[0] : data;
                    if (vis) {
                        setVisitorData(vis);
                        setFormData(p => ({
                            ...p,
                            visitor: vis.id,
                            visitor_name: vis.visitor_name,
                            visitor_phone: vis.mobile_no
                        }));
                    }
                }).catch(() => {});
            }
        }
    }, [initialVisitor, initialVehicle, initialSearch]);

    const loadDesignations = async (deptId) => {
        try {
            const data = await AppointmentService.getDesignationsByDepartment(deptId);
            setDesignations(data || []);
        } catch (error) {
            console.error('Error loading designations:', error);
        }
    };

    const loadStaff = async (deptId, desigId) => {
        try {
            const data = await AppointmentService.getStaffByDesignation(deptId, desigId);
            setStaffList(data || []);
        } catch (error) {
            console.error('Error loading staff:', error);
        }
    };

    const loadDepartmentEmployees = async (deptId, targetPerson = null, targetNumber = null) => {
        if (!deptId) {
            setDepartmentEmployees([]);
            return;
        }
        try {
            const data = await getEmployees(deptId);
            const list = Array.isArray(data) ? data : (data?.results || []);
            setDepartmentEmployees(list);

            const deptObj = departments.find(d => String(d.id) === String(deptId));
            const personName = targetPerson ?? deptObj?.contact_person ?? '';
            const personNum = targetNumber ?? deptObj?.contact_number ?? '';

            if (personName) {
                const matched = list.find(emp => {
                    const empName = (emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`).trim().toLowerCase();
                    return empName === personName.trim().toLowerCase() ||
                           String(emp.user) === String(personName) ||
                           String(emp.id) === String(personName);
                });

                if (matched) {
                    setFormData(prev => ({
                        ...prev,
                        contact_person: matched.user || matched.id,
                        contact_person_display: matched.full_name || matched.username || personName,
                        contact_number: personNum || matched.phone || matched.mobile_number || prev.contact_number || ''
                    }));
                } else {
                    setFormData(prev => ({
                        ...prev,
                        contact_person: personName,
                        contact_person_display: personName,
                        contact_number: personNum || prev.contact_number || ''
                    }));
                }
            } else if (personNum) {
                setFormData(prev => ({
                    ...prev,
                    contact_number: personNum
                }));
            }
        } catch (error) {
            console.error('Error loading department employees:', error);
        }
    };

    const handleFieldChange = (e) => {
        const { name, value } = e.target;

        if (name === 'appointment_date' && value && value < getTodayDate()) {
            Swal.fire('Invalid Date', 'Backdated appointments are not allowed. Please select today or a future date.', 'warning');
            setFormData(prev => ({ ...prev, appointment_date: getTodayDate() }));
            return;
        }

        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'department') {
            const selectedDept = departments.find(d => String(d.id) === String(value));
            const deptContactPerson = selectedDept?.contact_person || '';
            const deptContactNumber = selectedDept?.contact_number || '';

            setFormData(prev => ({
                ...prev,
                department: value,
                designation: '',
                concerned_staff: '',
                contact_person: deptContactPerson,
                contact_person_display: deptContactPerson,
                contact_number: deptContactNumber
            }));
            setDesignations([]);
            setStaffList([]);
            if (value) {
                loadDesignations(value);
                loadDepartmentEmployees(value, deptContactPerson, deptContactNumber);
            }
        } else if (name === 'designation') {
            setFormData(prev => ({ ...prev, concerned_staff: '' }));
            setStaffList([]);
            if (formData.department && value) {
                loadStaff(formData.department, value);
            }
        } else if (name === 'contact_person') {
            const selectedEmp = departmentEmployees.find(emp => 
                String(emp.user) === String(value) || 
                String(emp.id) === String(value) ||
                (emp.full_name && emp.full_name.trim().toLowerCase() === String(value).trim().toLowerCase())
            );
            if (selectedEmp) {
                setFormData(prev => ({
                    ...prev,
                    contact_person: value,
                    contact_person_display: selectedEmp.full_name || selectedEmp.username,
                    contact_number: selectedEmp.phone || selectedEmp.mobile_number || prev.contact_number || ''
                }));
            } else {
                setFormData(prev => ({
                    ...prev,
                    contact_person: value,
                    contact_person_display: value
                }));
            }
        }
    };

    const handleSearch = async () => {
        const term = searchMobile.trim();
        if (!term) return;

        setIsSearching(true);
        if (entryMode === 'visitor') {
            try {
                const data = await searchVisitorByMobile(term);
                const visitor = Array.isArray(data) ? data[0] : data;
                if (visitor) {
                    setVisitorData(visitor);
                    setFormData(prev => ({
                        ...prev,
                        visitor: visitor.id,
                        visitor_name: visitor.visitor_name,
                        visitor_phone: visitor.mobile_no
                    }));
                    Swal.fire({
                        icon: 'success',
                        title: 'Visitor Found',
                        text: `${visitor.visitor_name} details loaded.`,
                        timer: 1500,
                        showConfirmButton: false
                    });
                } else {
                    promptNewRegistration();
                }
            } catch (err) {
                promptNewRegistration();
            } finally {
                setIsSearching(false);
            }
        } else {
            try {
                const data = await searchVehicleByNumber(term);
                const vehicle = Array.isArray(data) ? data[0] : data;
                if (vehicle) {
                    setVehicleData(vehicle);
                    setFormData(prev => ({
                        ...prev,
                        vehicle: vehicle.id,
                        vehicle_number: vehicle.vehicle_number
                    }));
                    Swal.fire({
                        icon: 'success',
                        title: 'Vehicle Found',
                        text: `${vehicle.vehicle_number} details loaded.`,
                        timer: 1500,
                        showConfirmButton: false
                    });
                } else {
                    promptNewRegistration();
                }
            } catch (err) {
                promptNewRegistration();
            } finally {
                setIsSearching(false);
            }
        }
    };

    const promptNewRegistration = () => {
        Swal.fire({
            icon: 'info',
            title: entryMode === 'visitor' ? 'Visitor Not Found' : 'Vehicle Not Found',
            text: `No record found for "${searchMobile}". Register now?`,
            showCancelButton: true,
            confirmButtonText: 'Register Now',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#2ece8a'
        }).then((result) => {
            if (result.isConfirmed) {
                setShowSpotModal(true);
            }
        });
    };

    const handleMobileKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.department) {
            Swal.fire('Required Field', 'Please select a Department.', 'warning');
            return;
        }
        if (!formData.designation) {
            Swal.fire('Required Field', 'Please select a Designation.', 'warning');
            return;
        }
        if (!formData.concerned_staff) {
            Swal.fire('Required Field', 'Please select the Concerned Staff.', 'warning');
            return;
        }
        if (!formData.visitor_category) {
            Swal.fire('Required Field', 'Please select a Visitor Category.', 'warning');
            return;
        }

        if (entryMode === 'visitor') {
            if (!visitorData && !formData.visitor) {
                Swal.fire('Required Field', 'Please verify a registered visitor or click + Spot Reg.', 'warning');
                return;
            }
        } else {
            if (!vehicleData && !formData.vehicle) {
                Swal.fire('Required Field', 'Please verify a registered vehicle or click + Spot Reg.', 'warning');
                return;
            }
        }

        if (!formData.purpose_of_visit || !formData.purpose_of_visit.trim()) {
            Swal.fire('Required Field', 'Please enter the Purpose of Visit.', 'warning');
            return;
        }

        if (formData.appointment_date && formData.appointment_date < getTodayDate()) {
            Swal.fire('Invalid Date', 'Backdated appointments are not allowed. Please select today or a future date.', 'warning');
            return;
        }

        setSubmitting(true);
        try {
            const connectedVehNum = entryMode === 'vehicle' ? (vehicleData?.vehicle_number || formData.vehicle_number || searchMobile || '').trim() : null;
            const connectedPhone = entryMode === 'visitor' ? (visitorData?.mobile_no || formData.visitor_phone || searchMobile || '').trim() : null;
            const connectedName = entryMode === 'visitor' ? (visitorData?.visitor_name || formData.visitor_name || '').trim() : null;

            const payload = {
                department: formData.department,
                designation: formData.designation,
                concerned_staff: formData.concerned_staff,
                visitor_category: formData.visitor_category || null,
                visitor: visitorData?.id || formData.visitor || null,
                visitor_name: connectedName,
                visitor_phone: connectedPhone,
                vehicle: vehicleData?.id || formData.vehicle || null,
                vehicle_number: connectedVehNum,
                purpose_of_visit: formData.purpose_of_visit.trim(),
                appointment_date: formData.appointment_date || getTodayDate(),
                appointment_time: formData.appointment_time || getCurrentTime(),
                contact_person: formData.contact_person || null,
                contact_number: formData.contact_number || null
            };

            const created = await AppointmentService.createAppointment(payload);
            Swal.fire({
                icon: 'success',
                title: 'Spot Appointment Created!',
                text: 'Appointment scheduled and linked directly to gate entry.',
                timer: 1800,
                showConfirmButton: false
            });

            if (onSuccess) {
                onSuccess(created);
            }
        } catch (err) {
            console.error('Error creating spot appointment:', err);
            const errMsg = err.response?.data ? JSON.stringify(err.response.data) : 'Failed to create appointment. Please check required fields.';
            Swal.fire('Error', errMsg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="appointment-custom-modal">
            <Form onSubmit={handleSubmit}>
                <div className="modal-body-custom">
                    <div className="row">
                        <div className="form-group col-md-4 mb-3">
                            <Form.Label className="form-label-custom">Department <span className="text-danger">*</span></Form.Label>
                            <Form.Select
                                name="department"
                                className="form-control-custom"
                                value={formData.department}
                                onChange={handleFieldChange}
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
                                onChange={handleFieldChange}
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
                                onChange={handleFieldChange}
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
                                onChange={handleFieldChange}
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
                                onChange={handleFieldChange}
                                disabled={!formData.department}
                            >
                                <option value="">Select Contact Person</option>
                                {departmentEmployees.map(s => (
                                    <option key={s.id} value={s.user || s.id}>{s.full_name || s.username}</option>
                                ))}
                                {formData.contact_person && !departmentEmployees.some(s => String(s.user || s.id) === String(formData.contact_person)) && (
                                    <option value={formData.contact_person}>{formData.contact_person_display || formData.contact_person}</option>
                                )}
                            </Form.Select>
                        </div>
                        <div className="form-group col-md-4 mb-3">
                            <Form.Label className="form-label-custom">Contact Number</Form.Label>
                            <Form.Control
                                type="text"
                                name="contact_number"
                                className="form-control-custom"
                                value={formData.contact_number}
                                onChange={handleFieldChange}
                                placeholder="Enter contact number..."
                            />
                        </div>
                    </div>

                    <div className="row">
                        <div className="form-group col-md-12 mb-3">
                            <Form.Label className="form-label-custom">
                                Registered Visitor / Vehicle <span className="text-danger">*</span>
                            </Form.Label>

                            <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
                                <div style={{ flex: '1 1 280px', minWidth: 0, position: 'relative' }}>
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
                                        className="form-control-custom"
                                        style={{ paddingLeft: '38px', height: '40px', borderRadius: '10px' }}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    className="btn-save-custom d-flex align-items-center gap-1 shadow-sm px-3 fw-bold"
                                    style={{ height: '40px', borderRadius: '8px', fontSize: '13px' }}
                                    onClick={handleSearch}
                                    disabled={isSearching || !searchMobile.trim()}
                                >
                                    {isSearching ? <Spinner size="sm" /> : <i className="fa fa-search"></i>} Verify
                                </Button>
                                <Button
                                    type="button"
                                    className="btn-close-custom d-flex align-items-center gap-1 shadow-sm px-3 fw-bold"
                                    style={{ height: '40px', borderRadius: '8px', fontSize: '13px' }}
                                    onClick={() => setShowSpotModal(true)}
                                >
                                    <i className="fa fa-plus-circle"></i> + Spot Reg.
                                </Button>
                            </div>

                            {entryMode === 'visitor' && visitorData && (
                                <div className="p-3 rounded-3 border border-success bg-white shadow-sm mt-3 d-flex align-items-center justify-content-between">
                                    <div className="d-flex align-items-center">
                                        <div className="avatar rounded-circle bg-success text-white d-flex align-items-center justify-content-center me-3" style={{ width: '40px', height: '40px' }}>
                                            <i className="fa fa-user"></i>
                                        </div>
                                        <div>
                                            <h6 className="mb-0 fw-bold">{visitorData.visitor_name}</h6>
                                            <small className="text-muted">{visitorData.mobile_no} {visitorData.company_name ? `• ${visitorData.company_name}` : ''}</small>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-link btn-sm text-danger text-decoration-none fw-semibold"
                                        onClick={() => {
                                            setVisitorData(null);
                                            setFormData(prev => ({ ...prev, visitor: '', visitor_name: '', visitor_phone: '' }));
                                        }}
                                    >
                                        <i className="fa fa-times me-1"></i>Reset
                                    </button>
                                </div>
                            )}

                            {entryMode === 'vehicle' && vehicleData && (
                                <div className="p-3 rounded-3 border border-success bg-white shadow-sm mt-3 d-flex align-items-center justify-content-between">
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
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-link btn-sm text-danger text-decoration-none fw-semibold"
                                        onClick={() => {
                                            setVehicleData(null);
                                            setFormData(prev => ({ ...prev, vehicle: '', vehicle_number: '' }));
                                        }}
                                    >
                                        <i className="fa fa-times me-1"></i>Reset
                                    </button>
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
                                onChange={handleFieldChange}
                                placeholder="Enter purpose of visit (e.g. Discussion, Delivery, Client Meeting)"
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
                                onChange={handleFieldChange}
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
                                onChange={handleFieldChange}
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="modal-footer-custom">
                    <button type="button" className="btn-close-custom" onClick={onCancel}>
                        Cancel
                    </button>
                    <button type="submit" className="btn-save-custom" disabled={submitting}>
                        {submitting ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                Saving...
                            </>
                        ) : (
                            'Save & Link to Entry'
                        )}
                    </button>
                </div>
            </Form>

            <SpotVisitorModal
                show={showSpotModal}
                onHide={() => setShowSpotModal(false)}
                initialMode={entryMode}
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
                onVehicleCreated={(vehicle) => {
                    setVehicleData(vehicle);
                    setFormData(prev => ({
                        ...prev,
                        vehicle: vehicle.id,
                        vehicle_number: vehicle.vehicle_number
                    }));
                    setSearchMobile(vehicle.vehicle_number);
                    setEntryMode('vehicle');
                }}
                initialMobile={entryMode === 'visitor' ? searchMobile : ''}
                initialVehicleNumber={entryMode === 'vehicle' ? searchMobile : (searchMobile.match(/[a-zA-Z]/) ? searchMobile : '')}
                isDark={false}
                zIndex={1070}
            />

            <SpotVehicleModal
                show={showSpotVehicleModal}
                onHide={() => setShowSpotVehicleModal(false)}
                onVehicleCreated={(vehicle) => {
                    setVehicleData(vehicle);
                    setFormData(prev => ({
                        ...prev,
                        vehicle: vehicle.id,
                        vehicle_number: vehicle.vehicle_number
                    }));
                    setSearchMobile(vehicle.vehicle_number);
                }}
                initialVehicleNumber={searchMobile}
                zIndex={1070}
            />

            <style dangerouslySetInnerHTML={{
                __html: `
                .spot-visitor-backdrop, .spot-vehicle-backdrop {
                    z-index: 1065 !important;
                }
                .appointment-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                    background-color: #fff;
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
                    border: 1px solid #cbd5e1 !important;
                    border-radius: 10px !important;
                    padding: 10px 14px !important;
                    font-size: 13px !important;
                    color: #334155 !important;
                    background-color: #fff !important;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .appointment-custom-modal .form-control-custom:focus {
                    outline: none !important;
                    border-color: #2ece8a !important;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15) !important;
                }
                .appointment-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8 !important;
                }
                .appointment-custom-modal .btn-close-custom {
                    background-color: #7A70BA !important;
                    border-color: #7A70BA !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .appointment-custom-modal .btn-close-custom:hover {
                    background-color: #6357a7 !important;
                }
                .appointment-custom-modal .btn-save-custom {
                    background-color: #2ece8a !important;
                    border-color: #2ece8a !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .appointment-custom-modal .btn-save-custom:hover {
                    background-color: #26b277 !important;
                }
            `}} />
        </div>
    );
};

export default SpotAppointmentView;
