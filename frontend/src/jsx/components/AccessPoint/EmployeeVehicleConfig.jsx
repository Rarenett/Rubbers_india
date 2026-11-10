import React, { useState, useEffect, useMemo } from 'react';
import { Card, Form, Modal, Spinner, Button } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { usePageTitle } from '../../../context/TitleContext';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import Pagination from '../Common/Pagination';
import {
    getEmployeeVehicleDirectory,
    getVehicleTypes,
    setVehicleAsPreferred,
    createEmployeeVehicle,
    updateEmployeeVehicle,
    deleteEmployeeVehicle,
    switchEmployeeGateEntryVehicle
} from '../../../services/GateManagementService';
import { getDepartments } from '../../../services/HRManagementService';
import './AccessPoint.css';

const getFullImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const baseUrl = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000').replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    return `${baseUrl}/${cleanPath}`;
};

const EmployeeAvatar = ({ photo, name }) => {
    const [imgError, setImgError] = useState(false);
    const fullUrl = getFullImageUrl(photo);

    if (fullUrl && !imgError) {
        return (
            <img
                src={fullUrl}
                alt={name || "Employee"}
                className="rounded-circle shadow-xs"
                style={{ width: '40px', height: '40px', objectFit: 'cover', flexShrink: 0 }}
                onError={() => setImgError(true)}
            />
        );
    }

    return (
        <div
            className="d-flex align-items-center justify-content-center bg-light rounded-circle text-muted fw-bold"
            style={{ width: '40px', height: '40px', fontSize: '14px', flexShrink: 0 }}
        >
            {name ? name.charAt(0).toUpperCase() : <i className="fa fa-user"></i>}
        </div>
    );
};

const EmployeeVehicleConfig = () => {
    usePageTitle("Employee Vehicles");
    const { can } = usePermission();

    // Data states
    const [directory, setDirectory] = useState([]);
    const [vehicleTypes, setVehicleTypes] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters & Pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [filterTab, setFilterTab] = useState('all'); // 'all' | 'vehicles' | 'inside'
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Unified Modal state matching GateEntryList.jsx style
    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const [modalMode, setModalMode] = useState('existing'); // 'existing' | 'new' | 'edit'
    const [targetEmployee, setTargetEmployee] = useState(null);
    const [selectedExistingVehicleId, setSelectedExistingVehicleId] = useState('');
    const [editingVehicle, setEditingVehicle] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Form inputs
    const [formEmployeeId, setFormEmployeeId] = useState('');
    const [formVehicleNumber, setFormVehicleNumber] = useState('');
    const [formVehicleType, setFormVehicleType] = useState('');
    const [formIsPreferred, setFormIsPreferred] = useState(true);
    const [formCompany, setFormCompany] = useState('');
    const [formDriver, setFormDriver] = useState('');
    const [formPhoto, setFormPhoto] = useState(null);
    const [formPhotoPreview, setFormPhotoPreview] = useState(null);
    const [formUpdateActiveEntry, setFormUpdateActiveEntry] = useState(true);

    const currentSelectedVehicle = useMemo(() => {
        if (!targetEmployee?.vehicles) return null;
        return targetEmployee.vehicles.find(v => String(v.id) === String(selectedExistingVehicleId)) || null;
    }, [targetEmployee, selectedExistingVehicleId]);

    const getEmployeeVehicleTypeId = (typesList = vehicleTypes) => {
        if (!Array.isArray(typesList) || typesList.length === 0) return '';
        const empType = typesList.find(vt => 
            vt?.name?.toLowerCase().includes('employee') || 
            vt?.name?.toLowerCase() === 'employee vehicle'
        );
        return empType ? String(empType.id) : (typesList[0] ? String(typesList[0].id) : '');
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const [dirData, typesData, deptsData] = await Promise.all([
                getEmployeeVehicleDirectory().catch(() => []),
                getVehicleTypes().catch(() => []),
                getDepartments().catch(() => [])
            ]);

            const typesList = Array.isArray(typesData) ? typesData : (typesData?.results || []);
            setDirectory(Array.isArray(dirData) ? dirData : (dirData?.results || []));
            setVehicleTypes(typesList);
            setDepartments(Array.isArray(deptsData) ? deptsData : (deptsData?.results || []));

            const defaultEmpType = getEmployeeVehicleTypeId(typesList);
            if (defaultEmpType) {
                setFormVehicleType(defaultEmpType);
            }
        } catch (error) {
            console.error('Error loading employee vehicle configuration data:', error);
            Swal.fire('Error', 'Failed to load configuration data. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if ((modalMode === 'new' || modalMode === 'existing') && !formVehicleType && vehicleTypes.length > 0) {
            const defaultEmpType = getEmployeeVehicleTypeId(vehicleTypes);
            if (defaultEmpType) {
                setFormVehicleType(defaultEmpType);
            }
        }
    }, [vehicleTypes, modalMode, formVehicleType]);

    const refreshDirectory = async () => {
        try {
            const data = await getEmployeeVehicleDirectory();
            const list = Array.isArray(data) ? data : (data?.results || []);
            setDirectory(list);
            if (targetEmployee) {
                const updated = list.find(d => String(d.id) === String(targetEmployee.id));
                if (updated) {
                    setTargetEmployee(updated);
                }
            }
        } catch (error) {
            console.error('Error refreshing directory:', error);
        }
    };

    // Filtered records
    const filteredDirectory = useMemo(() => {
        return directory.filter(item => {
            if (filterTab === 'vehicles' && !item.total_vehicles) return false;
            if (filterTab === 'inside' && !item.is_inside) return false;
            if (selectedDepartment && String(item.department_id) !== String(selectedDepartment)) return false;
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchName = item.name?.toLowerCase().includes(term);
                const matchNo = item.employment_no?.toLowerCase().includes(term);
                const matchDept = item.department?.toLowerCase().includes(term);
                const matchVeh = item.vehicles?.some(v => v.vehicle_number?.toLowerCase().includes(term));
                if (!matchName && !matchNo && !matchDept && !matchVeh) return false;
            }
            return true;
        });
    }, [directory, searchTerm, selectedDepartment, filterTab]);

    // Statistics counts
    const stats = useMemo(() => {
        const totalStaff = directory.length;
        const staffWithVehicles = directory.filter(d => d.total_vehicles > 0).length;
        const insideCampus = directory.filter(d => d.is_inside).length;
        return { totalStaff, staffWithVehicles, insideCampus };
    }, [directory]);

    // Pagination calculations
    const totalRecords = filteredDirectory.length;
    const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;
    const indexOfFirst = (currentPage - 1) * itemsPerPage;
    const indexOfLast = indexOfFirst + itemsPerPage;
    const currentData = filteredDirectory.slice(indexOfFirst, indexOfLast);

    // Modal openers matching standard Glenda workflow
    const handleOpenManageModal = (employee) => {
        if (!employee) return;
        setTargetEmployee(employee);
        setEditingVehicle(null);
        setFormEmployeeId(employee.id);

        if (employee.vehicles && employee.vehicles.length > 0) {
            setModalMode('existing');
            const pref = employee.vehicles.find(v => v.is_preferred) || employee.preferred_vehicle || employee.vehicles[0];
            setSelectedExistingVehicleId(pref ? String(pref.id) : String(employee.vehicles[0].id));
        } else {
            setModalMode('new');
            setSelectedExistingVehicleId('');
        }

        setFormVehicleNumber('');
        setFormVehicleType(getEmployeeVehicleTypeId());
        setFormDriver(employee.name);
        setFormCompany('');
        setFormPhoto(null);
        setFormPhotoPreview(null);
        setFormIsPreferred(true);
        setFormUpdateActiveEntry(Boolean(employee.is_inside));
        setShowVehicleModal(true);
    };

    const handleOpenAddModal = (employee = null) => {
        setTargetEmployee(employee);
        setEditingVehicle(null);
        setModalMode('new');
        setSelectedExistingVehicleId('');
        setFormEmployeeId(employee ? employee.id : '');
        setFormVehicleNumber('');
        setFormVehicleType(getEmployeeVehicleTypeId());
        setFormDriver(employee ? employee.name : '');
        setFormCompany('');
        setFormPhoto(null);
        setFormPhotoPreview(null);
        setFormIsPreferred(true);
        setFormUpdateActiveEntry(employee ? Boolean(employee.is_inside) : false);
        setShowVehicleModal(true);
    };

    const handleStartEditVehicle = (vehicle, employee) => {
        if (!vehicle) return;
        setEditingVehicle(vehicle);
        setModalMode('edit');
        setFormVehicleNumber(vehicle.vehicle_number || '');
        setFormVehicleType(vehicle.vehicle_type ? String(vehicle.vehicle_type) : '');
        setFormDriver(vehicle.driver || (employee ? employee.name : ''));
        setFormCompany(vehicle.company || '');
        setFormPhoto(null);
        setFormPhotoPreview(vehicle.vehicle_photo ? getFullImageUrl(vehicle.vehicle_photo) : null);
        setFormIsPreferred(Boolean(vehicle.is_preferred));
        setFormUpdateActiveEntry(employee ? Boolean(employee.is_inside) : false);
    };

    // Handle Vehicle Deletion
    const handleDeleteVehicle = async (vehicle, employee) => {
        if (!vehicle) return;
        const empName = employee?.name || 'this employee';
        const result = await Swal.fire({
            title: 'Delete Vehicle?',
            html: `Are you sure you want to delete vehicle <strong>${vehicle.vehicle_number}</strong> for <strong>${empName}</strong>?<br/><span class="text-muted small">This action cannot be undone.</span>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, delete vehicle',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            try {
                await deleteEmployeeVehicle(vehicle.id);
                Swal.fire({
                    icon: 'success',
                    title: 'Vehicle Deleted',
                    text: `Vehicle ${vehicle.vehicle_number} was successfully removed.`,
                    timer: 2000,
                    showConfirmButton: false
                });
                if (modalMode === 'edit') {
                    setModalMode('existing');
                    setEditingVehicle(null);
                }
                await refreshDirectory();
            } catch (error) {
                console.error('Error deleting vehicle:', error);
                const errMsg = error.response?.data?.detail || error.response?.data?.error || 'Failed to delete vehicle.';
                Swal.fire('Error', errMsg, 'error');
            }
        }
    };

    // Handle Modal Form Submit
    const handleSubmitVehicleForm = async (e) => {
        if (e && e.preventDefault) e.preventDefault();

        try {
            setSubmitting(true);

            if (modalMode === 'existing') {
                if (!selectedExistingVehicleId) {
                    Swal.fire('Error', 'Please select a vehicle from the list.', 'warning');
                    return;
                }

                // 1. Set as Preferred if checked
                if (formIsPreferred && targetEmployee) {
                    await setVehicleAsPreferred(selectedExistingVehicleId, { employee_id: targetEmployee.id });
                }

                // 2. Switch Active Campus Entry if employee is currently inside
                if (formUpdateActiveEntry && targetEmployee?.is_inside && targetEmployee?.active_entry_id) {
                    await switchEmployeeGateEntryVehicle(targetEmployee.active_entry_id, {
                        vehicle_id: selectedExistingVehicleId,
                        set_as_preferred: formIsPreferred
                    });
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Vehicle Updated',
                    text: 'Vehicle preference updated successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
                setShowVehicleModal(false);
                await refreshDirectory();

            } else if (modalMode === 'new') {
                const targetEmpId = formEmployeeId || targetEmployee?.id;
                if (!targetEmpId) {
                    Swal.fire('Error', 'Please select an employee.', 'warning');
                    return;
                }
                if (!formVehicleNumber.trim()) {
                    Swal.fire('Error', 'Vehicle number is required.', 'warning');
                    return;
                }

                const formData = new FormData();
                formData.append('employee', targetEmpId);
                formData.append('vehicle_number', formVehicleNumber.trim().toUpperCase());
                if (formVehicleType) {
                    formData.append('vehicle_type', formVehicleType);
                }
                formData.append('is_preferred', formIsPreferred ? 'true' : 'false');
                if (formCompany) formData.append('company', formCompany);
                if (formDriver) formData.append('driver', formDriver);
                if (formPhoto) formData.append('vehicle_photo', formPhoto);

                const savedVehicle = await createEmployeeVehicle(formData);

                const empObj = targetEmployee || directory.find(d => String(d.id) === String(targetEmpId));
                if (empObj && empObj.is_inside && empObj.active_entry_id && formUpdateActiveEntry && savedVehicle?.id) {
                    await switchEmployeeGateEntryVehicle(empObj.active_entry_id, {
                        vehicle_id: savedVehicle.id,
                        set_as_preferred: formIsPreferred
                    });
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Vehicle Registered',
                    text: `Vehicle ${formVehicleNumber.toUpperCase()} registered successfully!`,
                    timer: 2000,
                    showConfirmButton: false
                });
                setShowVehicleModal(false);
                await refreshDirectory();

            } else if (modalMode === 'edit') {
                if (!editingVehicle) return;
                const targetEmpId = formEmployeeId || targetEmployee?.id;

                const formData = new FormData();
                if (targetEmpId) formData.append('employee', targetEmpId);
                formData.append('vehicle_number', formVehicleNumber.trim().toUpperCase());
                if (formVehicleType) {
                    formData.append('vehicle_type', formVehicleType);
                }
                formData.append('is_preferred', formIsPreferred ? 'true' : 'false');
                if (formCompany) formData.append('company', formCompany);
                if (formDriver) formData.append('driver', formDriver);
                if (formPhoto) formData.append('vehicle_photo', formPhoto);

                await updateEmployeeVehicle(editingVehicle.id, formData);

                if (formIsPreferred && targetEmpId) {
                    await setVehicleAsPreferred(editingVehicle.id, { employee_id: targetEmpId });
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Vehicle Updated',
                    text: `Vehicle ${formVehicleNumber.toUpperCase()} updated successfully!`,
                    timer: 2000,
                    showConfirmButton: false
                });
                setModalMode('existing');
                setEditingVehicle(null);
                await refreshDirectory();
            }

        } catch (error) {
            console.error('Error in vehicle modal submit:', error);
            const errMsg = error.response?.data?.vehicle_number || error.response?.data?.error || error.response?.data?.detail || 'Failed to process vehicle request.';
            Swal.fire('Error', Array.isArray(errMsg) ? errMsg[0] : errMsg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="container-fluid">
            {/* Standard Glenda Navigation Title */}
            <div className="page-titles">
                <button
                    onClick={() => window.history.back()}
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>

            {/* Main Content Card */}
            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        {/* Standard Glenda Card Header with Title, Search, and Create Button */}
                        <Card.Header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                            <Card.Title className="mb-0 text-nowrap">Employee Vehicles</Card.Title>
                            <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 flex-grow-1 justify-content-md-end">
                                <div style={{ width: '280px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search by Employee, ID, Vehicle..."
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        style={{ height: '34px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                                    <CreateButton
                                        module="gates"
                                        onClick={() => handleOpenAddModal(null)}
                                        style={{ height: '34px', borderRadius: '6px', whiteSpace: 'nowrap' }}
                                    >
                                        Vehicle
                                    </CreateButton>
                                </div>
                            </div>
                        </Card.Header>

                        {/* Standard Glenda Filter Toolbar */}
                        <div className="custom-tab-1 d-flex flex-wrap justify-content-between align-items-center px-4 py-2 border-bottom">
                            <div className="d-flex align-items-center gap-2 flex-wrap pb-1 pb-sm-0">
                                <button
                                    type="button"
                                    className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-2 transition-all ${filterTab === 'all' ? 'btn-primary' : 'btn-light border text-muted'}`}
                                    style={{ fontSize: '12px', outline: 'none', boxShadow: 'none' }}
                                    onClick={() => { setFilterTab('all'); setCurrentPage(1); }}
                                >
                                    All Staff ({directory.length})
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-2 transition-all ${filterTab === 'vehicles' ? 'btn-primary' : 'btn-light border text-muted'}`}
                                    style={{ fontSize: '12px', outline: 'none', boxShadow: 'none' }}
                                    onClick={() => { setFilterTab('vehicles'); setCurrentPage(1); }}
                                >
                                    <span className={`rounded-circle ${filterTab === 'vehicles' ? 'bg-white' : 'bg-primary'}`} style={{ width: '7px', height: '7px' }}></span>
                                    With Vehicles ({stats.staffWithVehicles})
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-2 transition-all ${filterTab === 'inside' ? 'btn-primary' : 'btn-light border text-muted'}`}
                                    style={{ fontSize: '12px', outline: 'none', boxShadow: 'none' }}
                                    onClick={() => { setFilterTab('inside'); setCurrentPage(1); }}
                                >
                                    <span className={`rounded-circle ${filterTab === 'inside' ? 'bg-white' : 'bg-success'}`} style={{ width: '7px', height: '7px' }}></span>
                                    Inside Campus ({stats.insideCampus})
                                </button>
                            </div>

                            <div className="d-flex align-items-center gap-2 mt-2 mt-sm-0">
                                <Form.Select
                                    size="sm"
                                    value={selectedDepartment}
                                    onChange={(e) => { setSelectedDepartment(e.target.value); setCurrentPage(1); }}
                                    style={{ minWidth: '180px', height: '34px', borderRadius: '6px', fontSize: '12px' }}
                                >
                                    <option value="">All Departments</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id}>{d.name || d.department_name}</option>
                                    ))}
                                </Form.Select>
                            </div>
                        </div>

                        {/* Directory Table */}
                        <Card.Body className="p-0">
                            {loading ? (
                                <div className="text-center py-5">
                                    <Spinner animation="border" variant="primary" />
                                    <p className="mt-2 text-muted small">Loading employee fleet configurations...</p>
                                </div>
                            ) : currentData.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <i className="fa fa-car fs-2 opacity-25 mb-2 d-block"></i>
                                    No employee vehicles found matching the filters
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-responsive-md mb-0 align-middle" style={{ minWidth: '980px' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ minWidth: '190px', whiteSpace: 'nowrap' }}><strong>EMPLOYEE</strong></th>
                                                <th style={{ minWidth: '110px', whiteSpace: 'nowrap' }}><strong>ID NUMBER</strong></th>
                                                <th style={{ minWidth: '160px', whiteSpace: 'nowrap' }}><strong>DEPARTMENT & ROLE</strong></th>
                                                <th style={{ minWidth: '230px', whiteSpace: 'nowrap' }}><strong>REGISTERED VEHICLES</strong></th>
                                                <th className="text-center" style={{ minWidth: '120px', whiteSpace: 'nowrap' }}><strong>CAMPUS STATUS</strong></th>
                                                <th className="text-end pe-4" style={{ minWidth: '150px', whiteSpace: 'nowrap' }}><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentData.map((emp) => (
                                                <tr key={emp.id}>
                                                    {/* Employee Identity */}
                                                    <td>
                                                        <div className="d-flex align-items-center">
                                                            <div className="me-3" style={{ width: '40px', height: '40px', flexShrink: 0 }}>
                                                                <EmployeeAvatar photo={emp.photo} name={emp.name} />
                                                            </div>
                                                            <div>
                                                                <strong className="text-dark">{emp.name}</strong>
                                                                {emp.phone && emp.phone !== '—' && (
                                                                    <div className="text-muted small" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                                                                        <i className="fa fa-phone me-1 opacity-50"></i>{emp.phone}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Employment Number */}
                                                    <td>
                                                        <span className="badge bg-light text-dark border fw-bold text-nowrap" style={{ fontSize: '11.5px', padding: '4px 8px' }}>
                                                            {emp.employment_no || '—'}
                                                        </span>
                                                    </td>

                                                    {/* Department & Role */}
                                                    <td>
                                                        <div className="text-dark"><strong>{emp.department || '—'}</strong></div>
                                                        {emp.designation && emp.designation !== '—' && (
                                                             <div className="text-muted small">{emp.designation}</div>
                                                        )}
                                                    </td>

                                                    {/* Unified Registered Vehicles Column */}
                                                    <td>
                                                        {emp.vehicles && emp.vehicles.length > 0 ? (
                                                            <div className="d-flex flex-column align-items-start gap-1">
                                                                {[
                                                                    ...emp.vehicles.filter(v => v.is_preferred || v.id === emp.preferred_vehicle?.id),
                                                                    ...emp.vehicles.filter(v => !v.is_preferred && v.id !== emp.preferred_vehicle?.id)
                                                                ].map((v) => {
                                                                    const isPrimary = Boolean(v.is_preferred || v.id === emp.preferred_vehicle?.id);
                                                                    return (
                                                                        <span
                                                                            key={v.id}
                                                                            className={`badge text-nowrap fw-bold ${
                                                                                isPrimary
                                                                                    ? 'badge-success light border border-success'
                                                                                    : 'bg-light text-dark border'
                                                                            }`}
                                                                            style={{
                                                                                fontSize: '12px',
                                                                                padding: '4px 8px',
                                                                                letterSpacing: '0.4px',
                                                                                borderRadius: '5px',
                                                                                cursor: 'pointer'
                                                                            }}
                                                                            onClick={() => handleOpenManageModal(emp)}
                                                                            title={isPrimary ? `${v.vehicle_number} (Primary Vehicle - Click to manage)` : `${v.vehicle_number} (Alternate Vehicle - Click to manage)`}
                                                                        >
                                                                            {isPrimary && <i className="fa fa-star text-warning me-1"></i>}
                                                                            {v.vehicle_number}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted small text-nowrap fst-italic">No vehicle</span>
                                                        )}
                                                    </td>

                                                    {/* Campus Status */}
                                                    <td className="text-center">
                                                        {emp.is_inside ? (
                                                            <div>
                                                                <span className="badge badge-success light">Inside</span>
                                                                {emp.active_vehicle_number && (
                                                                    <div className="text-muted small mt-1" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                                                                        <i className="fa fa-car me-1 text-primary"></i>{emp.active_vehicle_number}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="badge badge-secondary light">Outside</span>
                                                        )}
                                                    </td>

                                                    {/* Actions Column */}
                                                    <td className="text-end pe-4">
                                                        <div className="d-flex justify-content-end align-items-center">
                                                            {/* Settings button to manage vehicles */}
                                                            {emp.vehicles && emp.vehicles.length > 0 && (
                                                                <Button
                                                                    variant="outline-primary"
                                                                    size="sm"
                                                                    className="shadow me-1"
                                                                    style={{
                                                                        width: '28px',
                                                                        height: '28px',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        padding: 0,
                                                                        fontSize: '13px',
                                                                        borderRadius: '6px'
                                                                    }}
                                                                    onClick={() => handleOpenManageModal(emp)}
                                                                    title={`Manage vehicles for ${emp.name}`}
                                                                >
                                                                    <i className="fa fa-cog"></i>
                                                                </Button>
                                                            )}

                                                            {/* Add vehicle button */}
                                                            {can('gates', 'create') && (
                                                                <Button
                                                                    variant="outline-primary"
                                                                    size="sm"
                                                                    className="shadow"
                                                                    style={{
                                                                        width: '28px',
                                                                        height: '28px',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        padding: 0,
                                                                        fontSize: '12px',
                                                                        borderRadius: '6px'
                                                                    }}
                                                                    onClick={() => handleOpenAddModal(emp)}
                                                                    title="Add Vehicle"
                                                                >
                                                                    <i className="fa fa-plus"></i>
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Standard Glenda Pagination */}
                            <div className="px-4 pb-3">
                                <Pagination
                                    currentPage={currentPage}
                                    setCurrentPage={setCurrentPage}
                                    totalPages={totalPages}
                                    indexOfFirst={indexOfFirst}
                                    indexOfLast={indexOfLast}
                                    totalRecords={totalRecords}
                                    loading={loading}
                                />
                            </div>
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Unified Check-in / Vehicle Preference Modal - Exact Match to Fines & Tokens Standard */}
            <Modal
                show={showVehicleModal}
                onHide={() => !submitting && setShowVehicleModal(false)}
                backdrop="static"
                keyboard={false}
                centered
                size="lg"
                dialogClassName="custom-modal-fade"
                contentClassName="border-0 shadow-lg"
                style={{ borderRadius: '16px', overflow: 'hidden' }}
            >
                <div style={{ padding: '24px 32px', maxHeight: '90vh', overflowY: 'auto' }}>
                    <form onSubmit={handleSubmitVehicleForm}>
                        <style>{`
                            .pkg-close-btn {
                                background-color: #dc3545 !important;
                                color: white !important;
                                border-radius: 8px !important;
                                font-weight: 500 !important;
                                font-size: 14px !important;
                                padding: 10px 24px !important;
                                border: none !important;
                                cursor: pointer;
                                transition: background-color 0.2s, transform 0.1s !important;
                            }
                            .pkg-close-btn:hover {
                                background-color: #bb2d3b !important;
                            }
                            .pkg-submit-btn {
                                background-color: #0a500f !important;
                                color: white !important;
                                border-radius: 8px !important;
                                font-weight: 500 !important;
                                font-size: 14px !important;
                                padding: 10px 24px !important;
                                border: none !important;
                                cursor: pointer;
                                transition: background-color 0.2s, transform 0.1s !important;
                            }
                            .pkg-submit-btn:hover, .pkg-submit-btn:focus {
                                background-color: #073d0b !important;
                                box-shadow: 0 0 0 4px rgba(10, 80, 15, 0.4) !important;
                                outline: none !important;
                            }
                            .veh-tab-btn {
                                font-size: 13px !important;
                                border-radius: 8px !important;
                                padding: 8px 16px !important;
                                font-weight: 600 !important;
                                border: 1px solid #e2e8f0 !important;
                                transition: all 0.2s ease !important;
                                cursor: pointer;
                            }
                            .veh-tab-btn.active {
                                background-color: #0a500f !important;
                                border-color: #0a500f !important;
                                color: #ffffff !important;
                                box-shadow: 0 2px 6px rgba(10, 80, 15, 0.3) !important;
                            }
                            .veh-tab-btn:not(.active) {
                                background-color: #f8fafc !important;
                                color: #64748b !important;
                            }
                            .veh-tab-btn:not(.active):hover {
                                background-color: #f1f5f9 !important;
                                color: #1e293b !important;
                            }
                        `}</style>

                        {/* Modal Header */}
                        <div style={{ marginBottom: '0' }}>
                            <div className="d-flex align-items-center justify-content-between gap-3 mb-1" style={{ paddingBottom: '4px' }}>
                                <div className="d-flex align-items-center gap-3">
                                    <div style={{
                                        width: '48px', height: '48px', borderRadius: '50%',
                                        background: '#0a500f',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.9 2 11.2 2 11.5V16c0 .6.4 1 1 1h2"/>
                                            <circle cx="7" cy="17" r="2"/>
                                            <circle cx="17" cy="17" r="2"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h5 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>
                                            {modalMode === 'edit'
                                                ? 'Edit Vehicle Details'
                                                : modalMode === 'existing'
                                                ? 'Update Check-in Vehicle'
                                                : 'Register New Vehicle'}
                                        </h5>
                                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                                            {modalMode === 'edit'
                                                ? 'Modify vehicle registration or preference settings'
                                                : modalMode === 'existing'
                                                ? 'Select or switch employee vehicle preferences'
                                                : 'Enter vehicle details to add to employee records'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => !submitting && setShowVehicleModal(false)}
                                    aria-label="Close"
                                />
                            </div>
                        </div>

                        <hr style={{ borderColor: '#e2e8f0', margin: '16px 0 20px 0' }} />

                        {/* Employee Identity Box */}
                        {targetEmployee && (
                            <div className="p-3 rounded border mb-3 d-flex align-items-center justify-content-between" style={{ background: '#f8fafc', borderColor: '#e2e8f0', borderRadius: '10px' }}>
                                <div>
                                    <div className="fw-bold" style={{ color: '#1e293b', fontSize: '0.95rem' }}>{targetEmployee.name}</div>
                                    <div className="text-muted" style={{ fontSize: '12px' }}>
                                        ID: <span className="fw-semibold text-dark">{targetEmployee.employment_no || '—'}</span> &bull; Current: <strong style={{ color: '#0a500f' }}>{targetEmployee.preferred_vehicle?.vehicle_number || (targetEmployee.vehicles?.[0]?.vehicle_number || 'No Vehicle')}</strong>
                                    </div>
                                </div>
                                <div>
                                    {targetEmployee.is_inside ? (
                                        <span className="badge badge-success light py-1 px-2" style={{ fontSize: '11px' }}>
                                            <span className="me-1">●</span> Inside Campus
                                        </span>
                                    ) : (
                                        <span className="badge bg-light text-muted border py-1 px-2" style={{ fontSize: '11px' }}>
                                            Outside
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Navigation Pills (Existing vs Register New) */}
                        {targetEmployee && modalMode !== 'edit' && (
                            <div className="d-flex gap-2 mb-3">
                                <button
                                    type="button"
                                    className={`btn veh-tab-btn flex-fill ${modalMode === 'existing' ? 'active' : ''}`}
                                    onClick={() => {
                                        setModalMode('existing');
                                        setEditingVehicle(null);
                                    }}
                                >
                                    <i className="fa fa-list me-1.5"></i> Registered Vehicles {targetEmployee.vehicles?.length > 0 && `(${targetEmployee.vehicles.length})`}
                                </button>
                                <button
                                    type="button"
                                    className={`btn veh-tab-btn flex-fill ${modalMode === 'new' ? 'active' : ''}`}
                                    onClick={() => {
                                        setModalMode('new');
                                        setEditingVehicle(null);
                                        setFormVehicleNumber('');
                                        setFormVehicleType(getEmployeeVehicleTypeId());
                                        setFormDriver(targetEmployee.name);
                                        setFormIsPreferred(true);
                                    }}
                                >
                                    <i className="fa fa-plus me-1.5"></i> Register New Vehicle
                                </button>
                            </div>
                        )}

                        {/* Edit Mode Header */}
                        {modalMode === 'edit' && (
                            <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                                <div className="fw-bold" style={{ color: '#1e293b', fontSize: '0.9rem' }}>
                                    <i className="fa fa-pencil-alt text-warning me-1.5"></i> Edit Vehicle: <span className="text-primary">{editingVehicle?.vehicle_number}</span>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-link p-0 text-decoration-none small"
                                    style={{ color: '#64748b', fontSize: '12px' }}
                                    onClick={() => {
                                        setModalMode('existing');
                                        setEditingVehicle(null);
                                    }}
                                >
                                    &larr; Back to registered list
                                </button>
                            </div>
                        )}

                        {/* Tab 1: Existing Vehicles Selection */}
                        {modalMode === 'existing' && (
                            <div>
                                {(!targetEmployee?.vehicles || targetEmployee.vehicles.length === 0) ? (
                                    <div className="p-4 text-center rounded border text-muted small mb-3" style={{ background: '#f8fafc', borderColor: '#e2e8f0', borderRadius: '10px' }}>
                                        <i className="fa fa-car fa-2x text-muted mb-2 opacity-50 d-block"></i>
                                        No registered vehicles found for this employee.
                                        <div className="mt-2">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-link text-decoration-none fw-semibold"
                                                style={{ color: '#0a500f' }}
                                                onClick={() => setModalMode('new')}
                                            >
                                                + Click here to register a new vehicle &rarr;
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="row">
                                        <div className="form-group col-12 mb-3">
                                            <label className="fw-semibold">Select Vehicle <span className="text-danger">*</span></label>
                                            <select
                                                className="form-control form-select"
                                                value={selectedExistingVehicleId}
                                                onChange={(e) => setSelectedExistingVehicleId(e.target.value)}
                                                required
                                            >
                                                <option value="">-- Choose from Registered Vehicles --</option>
                                                {targetEmployee.vehicles.map(v => (
                                                    <option key={v.id} value={v.id}>
                                                        {v.vehicle_number} {v.is_preferred ? '★ [Preferred]' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Action symbols for the selected vehicle */}
                                        {currentSelectedVehicle && (
                                            <div className="col-12 mb-3">
                                                <div className="d-flex align-items-center justify-content-between p-2.5 px-3 rounded border" style={{ background: '#f8fafc', borderColor: '#e2e8f0', borderRadius: '8px' }}>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="fw-bold" style={{ color: '#1e293b', fontSize: '13px' }}>{currentSelectedVehicle.vehicle_number}</span>
                                                        {currentSelectedVehicle.is_preferred && (
                                                            <span className="badge badge-success light py-1 px-2" style={{ fontSize: '10px' }}>
                                                                <i className="fa fa-star text-warning me-1"></i> Preferred
                                                            </span>
                                                        )}
                                                        {currentSelectedVehicle.driver && <span className="text-muted" style={{ fontSize: '12px' }}>({currentSelectedVehicle.driver})</span>}
                                                    </div>
                                                    <div className="d-flex align-items-center gap-1">
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-primary"
                                                            style={{ width: '28px', height: '28px', padding: 0, borderRadius: '6px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                                            onClick={() => handleStartEditVehicle(currentSelectedVehicle, targetEmployee)}
                                                            title="Edit vehicle"
                                                        >
                                                            <i className="fa fa-pencil-alt"></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger"
                                                            style={{ width: '28px', height: '28px', padding: 0, borderRadius: '6px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                                            onClick={() => handleDeleteVehicle(currentSelectedVehicle, targetEmployee)}
                                                            title="Delete vehicle"
                                                        >
                                                            <i className="fa fa-trash"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Set as preferred toggle switch */}
                                        <div className="col-12 mb-3">
                                            <div className="p-3 rounded border" style={{ background: '#f8fafc', borderColor: '#e2e8f0', borderRadius: '8px' }}>
                                                <Form.Check
                                                    type="switch"
                                                    id="modal-existing-preferred-switch"
                                                    label={
                                                        <div>
                                                            <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>Set as Employee's New Preferred Vehicle</span>
                                                            <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                                                                Future check-ins will automatically default to this vehicle number.
                                                            </div>
                                                        </div>
                                                    }
                                                    checked={formIsPreferred}
                                                    onChange={(e) => setFormIsPreferred(e.target.checked)}
                                                />
                                            </div>
                                        </div>

                                        {/* Active campus entry switch */}
                                        {targetEmployee.is_inside && (
                                            <div className="col-12 mb-3">
                                                <div className="p-3 rounded border" style={{ background: '#fffbeb', borderColor: '#fde68a', borderRadius: '8px' }}>
                                                    <Form.Check
                                                        type="checkbox"
                                                        id="modal-existing-active-entry-switch"
                                                        label={
                                                            <div>
                                                                <span className="fw-semibold text-warning small">Update Current Active Gate Entry</span>
                                                                <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                                                                    Employee is currently inside campus. Immediately switch active campus entry to this vehicle.
                                                                </div>
                                                            </div>
                                                        }
                                                        checked={formUpdateActiveEntry}
                                                        onChange={(e) => setFormUpdateActiveEntry(e.target.checked)}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab 2 / 3: New or Edit Vehicle */}
                        {(modalMode === 'new' || modalMode === 'edit') && (
                            <div className="row">
                                {!targetEmployee && (
                                    <div className="form-group col-12 mb-3">
                                        <label className="fw-semibold">Employee <span className="text-danger">*</span></label>
                                        <select
                                            className="form-control form-select"
                                            value={formEmployeeId}
                                            onChange={(e) => {
                                                setFormEmployeeId(e.target.value);
                                                const found = directory.find(d => String(d.id) === String(e.target.value));
                                                if (found) {
                                                    setFormDriver(found.name);
                                                    setFormUpdateActiveEntry(found.is_inside);
                                                }
                                            }}
                                            required
                                        >
                                            <option value="">-- Choose Employee --</option>
                                            {directory.map(d => (
                                                <option key={d.id} value={d.id}>{d.name} ({d.employment_no}) - {d.department}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="form-group col-md-6 col-12 mb-3">
                                    <label className="fw-semibold">{modalMode === 'new' ? 'New Vehicle Number / Plate' : 'Vehicle Plate Number'} <span className="text-danger">*</span></label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. KL 07 CD 5678"
                                        value={formVehicleNumber}
                                        onChange={(e) => setFormVehicleNumber(e.target.value.toUpperCase())}
                                        required
                                        autoFocus
                                        style={{
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            fontWeight: 600
                                        }}
                                    />
                                </div>

                                <div className="form-group col-md-6 col-12 mb-3">
                                    <label className="fw-semibold">Vehicle Type</label>
                                    <select
                                        className="form-control form-select"
                                        value={formVehicleType || getEmployeeVehicleTypeId()}
                                        onChange={(e) => setFormVehicleType(e.target.value)}
                                    >
                                        <option value="">-- Select Type --</option>
                                        {vehicleTypes.map(vt => (
                                            <option key={vt.id} value={vt.id}>{vt.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="col-12 mb-3">
                                    <div className="p-3 rounded border" style={{ background: '#f8fafc', borderColor: '#e2e8f0', borderRadius: '8px' }}>
                                        <Form.Check
                                            type="switch"
                                            id="modal-form-pref-switch"
                                            label={
                                                <div>
                                                    <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>Set as Employee's New Preferred Vehicle</span>
                                                    <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                                                        Future check-ins will automatically default to this vehicle number.
                                                    </div>
                                                </div>
                                            }
                                            checked={formIsPreferred}
                                            onChange={(e) => setFormIsPreferred(e.target.checked)}
                                        />
                                    </div>
                                </div>

                                {(targetEmployee?.is_inside || directory.find(d => String(d.id) === String(formEmployeeId))?.is_inside) && (
                                    <div className="col-12 mb-3">
                                        <div className="p-3 rounded border" style={{ background: '#fffbeb', borderColor: '#fde68a', borderRadius: '8px' }}>
                                            <Form.Check
                                                type="checkbox"
                                                id="modal-form-active-entry-switch"
                                                label={
                                                    <div>
                                                        <span className="fw-semibold text-warning small">Update Current Active Gate Entry</span>
                                                        <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                                                            Employee is currently inside campus. Immediately switch active campus entry to this vehicle.
                                                        </div>
                                                    </div>
                                                }
                                                checked={formUpdateActiveEntry}
                                                onChange={(e) => setFormUpdateActiveEntry(e.target.checked)}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="form-group col-md-6 col-12 mb-3">
                                    <label className="fw-semibold">Driver Name (Optional)</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Driver Name"
                                        value={formDriver}
                                        onChange={(e) => setFormDriver(e.target.value)}
                                    />
                                </div>

                                <div className="form-group col-md-6 col-12 mb-3">
                                    <label className="fw-semibold">Vehicle Photo (Optional)</label>
                                    <div style={{ border: '1px dashed #d2dce8', borderRadius: '8px', padding: '8px 12px', background: '#f8fafc', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="file"
                                            className="form-control-file"
                                            accept="image/*"
                                            style={{ fontSize: '0.88rem' }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setFormPhoto(file);
                                                    setFormPhotoPreview(URL.createObjectURL(file));
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

                                {formPhotoPreview && (
                                    <div className="col-12 mb-3 text-center">
                                        <div className="position-relative d-inline-block">
                                            <img
                                                src={formPhotoPreview}
                                                alt="Vehicle Preview"
                                                className="rounded border shadow-sm"
                                                style={{ maxHeight: '90px', maxWidth: '100%', objectFit: 'cover' }}
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-danger position-absolute top-0 end-0 translate-middle rounded-circle p-0"
                                                style={{ width: '20px', height: '20px', lineHeight: '18px', fontSize: '10px' }}
                                                onClick={() => {
                                                    setFormPhoto(null);
                                                    setFormPhotoPreview(null);
                                                }}
                                                title="Remove photo"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Modal Footer Actions - Exact Fines & Tokens Buttons */}
                        <div
                            className="modal-actions d-flex justify-content-end align-items-center gap-2 mt-4 pt-3"
                            style={{ borderTop: '1px solid #f1f5f9' }}
                        >
                            {modalMode === 'edit' && editingVehicle && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger me-auto"
                                    style={{ borderRadius: '8px', padding: '9px 16px', fontWeight: 500 }}
                                    onClick={() => handleDeleteVehicle(editingVehicle, targetEmployee)}
                                    disabled={submitting}
                                >
                                    <i className="fa fa-trash me-1.5"></i> Delete Vehicle
                                </button>
                            )}
                            <button
                                type="button"
                                className="pkg-close-btn"
                                onClick={() => !submitting && setShowVehicleModal(false)}
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="pkg-submit-btn d-flex align-items-center gap-2"
                                disabled={submitting || (modalMode === 'existing' && !selectedExistingVehicleId)}
                            >
                                {submitting && <Spinner animation="border" size="sm" />}
                                {modalMode === 'existing'
                                    ? 'Update & Switch Vehicle'
                                    : modalMode === 'new'
                                    ? 'Save & Register Vehicle'
                                    : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </Modal>
        </div>
    );
};

export default EmployeeVehicleConfig;
