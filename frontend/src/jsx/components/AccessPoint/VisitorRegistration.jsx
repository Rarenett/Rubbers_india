import React, { useState, useEffect, Fragment, useContext, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Row, Col, Card, Form, Button, Image, Badge, Spinner, Table, Modal } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import { searchVisitorByMobile, createVisitor, getVisitors, updateVisitor, deleteVisitor, getVehicles, getVehicleTypes, createVehicle, updateVehicle, deleteVehicle } from '../../../services/GateManagementService';
import { getDepartments, getEmployees } from '../../../services/HRManagementService';
import { ThemeContext } from "../../../context/ThemeContext";
import CameraCapture from './CameraCapture.jsx';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const VisitorRegistration = ({ embedded = false }) => {
    const { background } = useContext(ThemeContext);
    const isDark = background.value === "dark";
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { can } = usePermission();

    const [tableSearchTerm, setTableSearchTerm] = useState('');
    const [visitorFound, setVisitorFound] = useState(null); // null = modal closed, false = new visitor, object = returning/editing visitor
    const [loading, setLoading] = useState(false);
    const [visitors, setVisitors] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [zoomImage, setZoomImage] = useState(null);
    const [cameraField, setCameraField] = useState(null);
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'vehicles' ? 'vehicles' : 'visitors');
    const [registrationType, setRegistrationType] = useState('visitor');
    const [vehicles, setVehicles] = useState([]);
    const [vehicleTypes, setVehicleTypes] = useState([]);

    // Pagination (matching SalesOrderList)
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [formData, setFormData] = useState({
        visitor_name: '',
        mobile_no: '',
        email: '',
        address: '',
        company_name: '',
        department: '',
        narration: '',
        is_blacklisted: false,
        blacklist_reason: '',
        visitor_photo: null,
        id_card_photo: null,
        visiting_card_photo: null,
        vehicle_number: '',
        vehicle_type: '',
        company: '',
        driver: '',
        employee: '',
        is_preferred: false,
        vehicle_photo: null
    });

    const [previews, setPreviews] = useState({
        visitor_photo: null,
        id_card_photo: null,
        visiting_card_photo: null,
        vehicle_number: '',
        vehicle_type: '',
        company: '',
        driver: '',
        employee: '',
        is_preferred: false,
        vehicle_photo: null
    });

    useEffect(() => {
        fetchVisitors();
        fetchDepartments();
        fetchVehicles();
        fetchVehicleTypes();
        fetchEmployees();
    }, []);

    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam === 'vehicles') {
            setActiveTab('vehicles');
        } else if (tabParam === 'visitors') {
            setActiveTab('visitors');
        }
    }, [searchParams]);

    // Reset pagination to page 1 whenever tab or search filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, tableSearchTerm]);

    const fetchVehicles = async () => {
        try {
            const data = await getVehicles();
            if (Array.isArray(data)) {
                setVehicles(data);
            } else if (data && Array.isArray(data.results)) {
                setVehicles(data.results);
            } else {
                setVehicles([]);
            }
        } catch (error) {
            console.error('Error fetching vehicles', error);
        }
    };

    const fetchVehicleTypes = async () => {
        try {
            const data = await getVehicleTypes();
            setVehicleTypes(data);
        } catch (error) {
            console.error('Error fetching vehicle types', error);
        }
    };

    const fetchEmployees = async () => {
        try {
            const data = await getEmployees();
            if (Array.isArray(data)) {
                setEmployees(data);
            } else if (data && Array.isArray(data.results)) {
                setEmployees(data.results);
            } else {
                setEmployees([]);
            }
        } catch (error) {
            console.error('Error fetching employees', error);
        }
    };

    const fetchDepartments = async () => {
        try {
            const data = await getDepartments();
            setDepartments(data);
        } catch (error) {
            console.error("Error fetching departments", error);
        }
    };

    const fetchVisitors = async () => {
        try {
            const data = await getVisitors();
            if (Array.isArray(data)) {
                setVisitors(data);
            } else if (data && Array.isArray(data.results)) {
                setVisitors(data.results);
            } else {
                setVisitors([]);
            }
        } catch (error) {
            console.error("Error fetching visitors", error);
            const status = error?.response?.status;
            const msg = status === 401
                ? 'Your session has expired. Please log in again.'
                : `Failed to load visitor list (Error ${status || 'unknown'}). Please refresh.`;
            Swal.fire({ icon: 'error', title: 'Error', text: msg, timer: 5000, timerProgressBar: true });
        }
    };

    const getFullImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
            return path;
        }
        const baseUrl = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${baseUrl}${cleanPath}`;
    };

    const handleZoom = (imagePath) => {
        const fullUrl = getFullImageUrl(imagePath);
        if (fullUrl) {
            setZoomImage(fullUrl);
        }
    };

    const handleCameraCapture = (file) => {
        if (!cameraField) return;
        setFormData(prev => ({ ...prev, [cameraField]: file }));
        setPreviews(prev => ({ ...prev, [cameraField]: URL.createObjectURL(file) }));
        const closedField = cameraField;
        setCameraField(null);
        setTimeout(() => {
            if (closedField === 'visitor_photo') {
                document.getElementById('btn_camera_id_card_photo')?.focus();
            } else if (closedField === 'id_card_photo') {
                document.getElementById('btn_camera_visiting_card_photo')?.focus();
            } else if (closedField === 'visiting_card_photo') {
                document.querySelector('.visitor-modal button[type="submit"]')?.focus();
            }
        }, 150);
    };

    // Auto-focus first input when visitor modal opens
    useEffect(() => {
        if (visitorFound !== null) {
            const timer = setTimeout(() => {
                const modal = document.querySelector('.visitor-modal');
                if (modal) {
                    const firstInput = modal.querySelector('input[name="visitor_name"]:not([disabled]):not([readonly])');
                    if (firstInput) {
                        firstInput.focus();
                    }
                }
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [visitorFound]);

    // Helper for warning popups with automatic Enter dismissal and refocusing
    const showWarningAndRefocus = (title, text, focusTargetSelector) => {
        Swal.fire({
            icon: 'warning',
            title,
            text,
            confirmButtonColor: '#2ece8a',
            focusConfirm: true,
            returnFocus: false,
            didOpen: (popup) => {
                const btn = popup.querySelector('.swal2-confirm');
                if (btn) btn.focus();
                const keyHandler = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (btn) btn.click();
                        document.removeEventListener('keydown', keyHandler, true);
                    }
                };
                document.addEventListener('keydown', keyHandler, true);
            }
        }).then(() => {
            setTimeout(() => {
                if (!focusTargetSelector) return;
                const el = document.querySelector(focusTargetSelector);
                if (el) {
                    if (el.classList && el.classList.contains('react-select__control')) {
                        const inp = el.querySelector('input');
                        if (inp) inp.focus();
                    } else {
                        el.focus();
                        if (el.select) el.select();
                    }
                }
            }, 100);
        });
    };

    // Keyboard navigation helpers matching StockItemList and EntryTagForm
    const getFocusable = (modalSelector) => {
        const modal = document.querySelector(modalSelector);
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                'input.form-control-custom:not([disabled]):not([readonly]), textarea.form-control-custom:not([disabled]):not([readonly]), .react-select__control, .btn-camera-upload, button[type="submit"]:not([disabled])'
            )
        ).filter(el => {
            if (el.offsetParent === null) return false;
            if (el.disabled) return false;
            if (el.classList && el.classList.contains('react-select__control--is-disabled')) return false;
            if (el.classList && el.classList.contains('react-select__control')) {
                const inputEl = el.querySelector('input');
                if (inputEl && inputEl.disabled) return false;
            }
            return true;
        });
    };

    const handleKeyDown = (e, modalSelector) => {
        if (e.key !== 'Enter') return;
        if (document.querySelector('.swal2-container')) return;
        if (e.target.tagName.toLowerCase() === 'textarea' && e.shiftKey) return;
        if (e.target.closest('.react-select')) return;
        if (e.target.classList.contains('btn-camera-upload') || e.target.classList.contains('dropzone-upload')) return;

        const all = getFocusable(modalSelector);
        const index = all.indexOf(document.activeElement);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            const next = all[index + 1];
            if (index === all.length - 2 && next.type === 'submit') {
                all[all.length - 1].click();
            } else if (next.classList && next.classList.contains('react-select__control')) {
                const inputEl = next.querySelector('input');
                if (inputEl) inputEl.focus();
            } else {
                next.focus();
                if (next.select) next.select();
            }
        }
    };

    const focusNextFromControl = (control) => {
        const modal = control.closest('.modal-content');
        if (!modal) return;
        const modalSelector = '.visitor-modal';

        const all = getFocusable(modalSelector);
        const index = all.indexOf(control);
        if (index > -1 && index < all.length - 1) {
            const next = all[index + 1];
            if (index === all.length - 2 && next.type === 'submit') {
                all[all.length - 1].click();
            } else if (next.classList && next.classList.contains('react-select__control')) {
                const inputEl = next.querySelector('input');
                if (inputEl) inputEl.focus();
            } else {
                next.focus();
                if (next.select) next.select();
            }
        }
    };

    const handleSelectFocus = (e) => {
        const control = e.target.closest('.react-select__control');
        if (control) {
            control.classList.add('react-select__control--is-focused');
        }
    };

    const handleSelectKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (document.querySelector('.swal2-container')) return;
            const control = e.target.closest('.react-select__control');
            if (control) {
                setTimeout(() => {
                    focusNextFromControl(control);
                }, 50);
            }
        }
    };

    const toOptions = (list) => (list || []).map(item => ({
        value: item.id,
        label: item.name
    }));

    const findOption = (options, value) => {
        if (!value) return null;
        return (options || []).find(o => String(o.value) === String(value)) || null;
    };

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#2ece8a' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(46, 206, 138, 0.15)' : 'none',
            '&:hover': { borderColor: '#2ece8a' },
            borderRadius: '10px',
            fontSize: '13px',
        }),
        menu: base => ({ ...base, zIndex: 9999, fontSize: '0.875rem' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#2ece8a' : state.isFocused ? '#e8fcf3' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    const handleOpenNewModal = () => {
        setVisitorFound(false);
        setRegistrationType(activeTab === 'vehicles' ? 'vehicle' : 'visitor');
        setFormData({
            visitor_name: '',
            mobile_no: '',
            email: '',
            address: '',
            company_name: '',
            department: '',
            narration: '',
            is_blacklisted: false,
            blacklist_reason: '',
            visitor_photo: null,
            id_card_photo: null,
            visiting_card_photo: null,
            vehicle_number: '',
            vehicle_type: '',
            company: '',
            driver: '',
            employee: '',
            is_preferred: false,
            vehicle_photo: null
        });
        setPreviews({
            visitor_photo: null,
            id_card_photo: null,
            visiting_card_photo: null,
            vehicle_photo: null
        });
    };

    const handleCloseModal = () => {
        setVisitorFound(null);
    };

    const handleEdit = (visitor) => {
        setVisitorFound(visitor);
        setRegistrationType('visitor');
        setFormData({
            visitor_name: visitor.visitor_name || '',
            mobile_no: visitor.mobile_no || '',
            email: visitor.email || '',
            address: visitor.address || '',
            company_name: visitor.company_name || '',
            department: visitor.department || '',
            narration: visitor.narration || '',
            is_blacklisted: visitor.is_blacklisted || false,
            blacklist_reason: visitor.blacklist_reason || '',
            visitor_photo: null,
            id_card_photo: null,
            visiting_card_photo: null,
            vehicle_number: '',
            vehicle_type: '',
            company: '',
            driver: '',
            employee: '',
            is_preferred: false,
            vehicle_photo: null
        });
        setPreviews({
            visitor_photo: visitor.visitor_photo ? getFullImageUrl(visitor.visitor_photo) : null,
            id_card_photo: visitor.id_card_photo ? getFullImageUrl(visitor.id_card_photo) : null,
            visiting_card_photo: visitor.visiting_card_photo ? getFullImageUrl(visitor.visiting_card_photo) : null,
            vehicle_photo: null
        });
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "This will permanently delete the visitor record!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteVisitor(id);
                Swal.fire('Deleted!', 'Visitor has been deleted.', 'success');
                fetchVisitors();
            } catch (error) {
                Swal.fire('Error!', 'Failed to delete visitor.', 'error');
            }
        }
    };

    const handleDeleteVehicle = async (id) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "This will permanently delete the vehicle record!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteVehicle(id);
                Swal.fire('Deleted!', 'Vehicle has been deleted.', 'success');
                fetchVehicles();
            } catch (error) {
                Swal.fire('Error!', 'Failed to delete vehicle.', 'error');
            }
        }
    };

    const handleChange = (e) => {
        const { name, value, files } = e.target;
        if (files && files[0]) {
            setFormData(prev => ({ ...prev, [name]: files[0] }));
            setPreviews(prev => ({ ...prev, [name]: URL.createObjectURL(files[0]) }));
            setTimeout(() => {
                if (name === 'visitor_photo') {
                    document.getElementById('dropzone_id_card_photo')?.focus();
                } else if (name === 'id_card_photo') {
                    document.getElementById('dropzone_visiting_card_photo')?.focus();
                } else if (name === 'visiting_card_photo') {
                    document.querySelector('.visitor-modal button[type="submit"]')?.focus();
                }
            }, 100);
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleDepartmentSelectChange = (opt) => {
        setFormData(prev => ({
            ...prev,
            department: opt ? opt.value : ''
        }));
    };

    const handleBlacklistToggle = async (visitor) => {
        const action = visitor.is_blacklisted ? 'Unblacklist' : 'Blacklist';
        const result = await Swal.fire({
            title: `${action} Visitor?`,
            text: `Are you sure you want to ${action.toLowerCase()} ${visitor.visitor_name}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: visitor.is_blacklisted ? '#28a745' : '#d33',
            confirmButtonText: `Yes, ${action}!`,
            input: visitor.is_blacklisted ? undefined : 'textarea',
            inputPlaceholder: 'Reason for blacklisting...',
            inputValidator: (value) => {
                if (!visitor.is_blacklisted && !value) {
                    return 'You must provide a reason!';
                }
            }
        });

        if (result.isConfirmed) {
            try {
                setLoading(true);
                await updateVisitor(visitor.id, {
                    is_blacklisted: !visitor.is_blacklisted,
                    blacklist_reason: result.value || ''
                });
                Swal.fire('Success', `Visitor ${action.toLowerCase()}ed successfully.`, 'success');
                fetchVisitors();
                if (visitorFound && visitorFound.id === visitor.id) {
                    setVisitorFound(prev => ({
                        ...prev,
                        is_blacklisted: !visitor.is_blacklisted,
                        blacklist_reason: result.value || ''
                    }));
                }
            } catch (error) {
                Swal.fire('Error', 'Failed to update visitor status.', 'error');
            } finally {
                setLoading(false);
            }
        }
    };

    const currentVehicleTypeId = typeof formData.vehicle_type === 'object' && formData.vehicle_type !== null
        ? formData.vehicle_type.id
        : formData.vehicle_type;
    const selectedVehicleType = vehicleTypes.find(t => String(t.id) === String(currentVehicleTypeId));
    const isEmployeeVehicle = Boolean(
        (selectedVehicleType && selectedVehicleType.name && selectedVehicleType.name.toLowerCase().includes('employee')) ||
        (typeof formData.vehicle_type === 'string' && formData.vehicle_type.toLowerCase().includes('employee'))
    );

    const employeeOptions = (employees || []).map(emp => {
        const name = (emp.full_name || emp.user_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || `Employee #${emp.id}`).trim();
        const dept = emp.department_name ? ` (${emp.department_name})` : '';
        return {
            value: emp.id,
            label: `${name}${dept}`,
            empName: name
        };
    });

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (registrationType === 'visitor') {
            if (!formData.visitor_name.trim() || !formData.mobile_no.trim() || !formData.department) {
                return showWarningAndRefocus('Validation Error', 'Please fill out all required fields (Visitor Name, Mobile Number, and Department)!', 'input[name="visitor_name"]');
            }
            const cleanMobile = (formData.mobile_no || '').replace(/\D/g, '');
            if (cleanMobile.length < 10) {
                return showWarningAndRefocus('Invalid Mobile Number', 'Please enter a valid mobile number with at least 10 digits!', 'input[name="mobile_no"]');
            }
            const hasVisitorPhoto = Boolean(formData.visitor_photo || (visitorFound && visitorFound.visitor_photo));
            if (!hasVisitorPhoto) {
                return showWarningAndRefocus('Validation Error', 'Visitor Photo is mandatory. Please capture or upload a visitor photo!', '#btn_camera_visitor_photo');
            }
            const hasIdCardPhoto = Boolean(formData.id_card_photo || (visitorFound && visitorFound.id_card_photo));
            if (!hasIdCardPhoto) {
                return showWarningAndRefocus('Validation Error', 'ID Card Photo is mandatory. Please capture or upload an ID card photo!', '#btn_camera_id_card_photo');
            }
            if (!visitorFound || !visitorFound.id) {
                const isDuplicateMobile = visitors.some(v => (v.mobile_no || '').trim() === formData.mobile_no.trim());
                if (isDuplicateMobile) {
                    return showWarningAndRefocus('Duplicate Visitor', 'A visitor with this Mobile Number already exists! Use check-in to update returning visitors.', 'input[name="mobile_no"]');
                }
            }
        } else {
            if (!formData.vehicle_number.trim() || !formData.company.trim()) {
                return showWarningAndRefocus('Validation Error', 'Please fill out all required fields (Vehicle Number, and Company Name)!', 'input[name="vehicle_number"]');
            }
            if (isEmployeeVehicle && !formData.employee) {
                return showWarningAndRefocus('Validation Error', 'Please select an Employee for this employee vehicle!', '.employee-select input');
            }
            const hasVehiclePhoto = Boolean(formData.vehicle_photo || (visitorFound && visitorFound.vehicle_photo));
            if (!hasVehiclePhoto) {
                return showWarningAndRefocus('Validation Error', 'Vehicle Photo is mandatory. Please capture or upload a vehicle photo!', '#btn_camera_vehicle_photo');
            }
            if (!visitorFound || !visitorFound.id) {
                const isDuplicateVehicle = vehicles.some(v => (v.vehicle_number || '').trim().toLowerCase() === formData.vehicle_number.trim().toLowerCase());
                if (isDuplicateVehicle) {
                    return showWarningAndRefocus('Duplicate Vehicle', 'A vehicle with this number already exists!', 'input[name="vehicle_number"]');
                }
            }
        }

        const data = new FormData();
        Object.keys(formData).forEach(key => {
            if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
                data.append(key, formData[key]);
            }
        });

        if (registrationType === 'vehicle') {
            data.set('is_preferred', (isEmployeeVehicle && formData.is_preferred) ? 'true' : 'false');
            if (isEmployeeVehicle && formData.employee) {
                data.set('employee', formData.employee);
            } else {
                data.set('employee', '');
            }
        }

        try {
            setLoading(true);
            if (registrationType === 'visitor') {
                if (visitorFound && visitorFound.id) {
                    await updateVisitor(visitorFound.id, data);
                } else {
                    await createVisitor(data);
                }
                Swal.fire({ icon: 'success', title: 'Success', text: visitorFound && visitorFound.id ? 'Visitor profile updated successfully' : 'Visitor registered successfully', timer: 2000, showConfirmButton: false });
                fetchVisitors();
            } else {
                if (visitorFound && visitorFound.id) {
                    await updateVehicle(visitorFound.id, data);
                } else {
                    await createVehicle(data);
                }
                Swal.fire({ icon: 'success', title: 'Success', text: visitorFound && visitorFound.id ? 'Vehicle updated successfully' : 'Vehicle registered successfully', timer: 2000, showConfirmButton: false });
                fetchVehicles();
            }
            setVisitorFound(null);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save record.' });
        } finally {
            setLoading(false);
        }
    };

    const filteredVisitors = visitors.filter(v => {
        const q = tableSearchTerm.toLowerCase();
        return (
            (v.visitor_name || '').toLowerCase().includes(q) ||
            (v.mobile_no || '').toLowerCase().includes(q) ||
            (v.company_name || '').toLowerCase().includes(q) ||
            (v.department_name || '').toLowerCase().includes(q)
        );
    });

    const filteredVehicles = vehicles.filter(v => {
        const q = tableSearchTerm.toLowerCase();
        return (
            (v.vehicle_number || '').toLowerCase().includes(q) ||
            (v.company || '').toLowerCase().includes(q) ||
            (v.driver || '').toLowerCase().includes(q) ||
            (v.employee_name || '').toLowerCase().includes(q) ||
            (v.vehicle_type_name || '').toLowerCase().includes(q)
        );
    });

    // Pagination calculations (matching SalesOrderList)
    const currentDataset = activeTab === 'visitors' ? filteredVisitors : filteredVehicles;
    const totalPages = Math.ceil(currentDataset.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const paginatedVisitors = filteredVisitors.slice(indexOfFirstItem, indexOfLastItem);
    const paginatedVehicles = filteredVehicles.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <div className={embedded ? "" : "container-fluid"}>
            {!embedded && (
                <div className="page-titles">
                    <button
                        onClick={() => window.history.back()}
                        className="btn btn-outline-primary btn-sm d-flex align-items-center"
                        style={{ gap: '6px', borderRadius: '6px' }}
                    >
                        <i className="fa fa-arrow-left"></i> Back
                    </button>
                </div>
            )}

            <div className="row">
                <div className="col-xl-12">
                    <Card>
                        <Card.Header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 border-0 pb-0">
                            <Card.Title className="mb-0 text-nowrap">Registered Visitors & Vehicles</Card.Title>
                            <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                                <div className="d-flex ms-3 gap-2 p-1 me-2" style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <button 
                                        className="btn btn-sm d-flex align-items-center"
                                        onClick={() => setActiveTab('visitors')}
                                        style={{
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: '6px 16px',
                                            fontWeight: activeTab === 'visitors' ? '600' : '500',
                                            background: activeTab === 'visitors' ? '#2ece8a' : 'transparent',
                                            color: activeTab === 'visitors' ? '#fff' : '#64748b',
                                            boxShadow: activeTab === 'visitors' ? '0 2px 8px rgba(46, 206, 138, 0.3)' : 'none',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            fontSize: '13px'
                                        }}
                                    >
                                        <i className="fa fa-users me-2" style={{ fontSize: '14px' }}></i> Visitors
                                    </button>
                                    <button 
                                        className="btn btn-sm d-flex align-items-center"
                                        onClick={() => setActiveTab('vehicles')}
                                        style={{
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: '6px 16px',
                                            fontWeight: activeTab === 'vehicles' ? '600' : '500',
                                            background: activeTab === 'vehicles' ? '#2ece8a' : 'transparent',
                                            color: activeTab === 'vehicles' ? '#fff' : '#64748b',
                                            boxShadow: activeTab === 'vehicles' ? '0 2px 8px rgba(46, 206, 138, 0.3)' : 'none',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            fontSize: '13px'
                                        }}
                                    >
                                        <i className="fa fa-car me-2" style={{ fontSize: '14px' }}></i> Vehicles
                                    </button>
                                </div>
                                {/* Search Table Input */}
                                <div className="search-bar-container w-100 m-0" style={{ maxWidth: '250px' }}>
                                    <span className="search-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder={activeTab === 'visitors' ? "Search Visitor..." : "Search Vehicle..."}
                                        value={tableSearchTerm}
                                        onChange={(e) => setTableSearchTerm(e.target.value)}
                                    />
                                </div>

                                <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                                    {((activeTab === 'visitors' && can('visitors', 'create')) || (activeTab === 'vehicles' && can('vehicles', 'create'))) && (
                                        <CreateButton
                                            module={activeTab === 'visitors' ? 'visitors' : 'vehicles'}
                                            onClick={handleOpenNewModal}
                                        >
                                            {activeTab === 'visitors' ? 'Visitor Registration' : 'Vehicle Registration'}
                                        </CreateButton>
                                    )}
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading && visitors.length === 0 ? (
                                <div className="text-center py-5">
                                    <Spinner animation="border" variant="primary" />
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <Table hover className="table table-responsive-md align-middle mb-0">
                                        <thead>
                                            {activeTab === 'visitors' ? (
                                                <tr>
                                                    <th style={{ width: '60px' }}><strong>SL NO.</strong></th>
                                                    <th><strong>PHOTO</strong></th>
                                                    <th><strong>VISITOR NAME</strong></th>
                                                    <th><strong>MOBILE</strong></th>
                                                    <th><strong>COMPANY</strong></th>
                                                    <th><strong>DEPARTMENT</strong></th>
                                                    <th><strong>STATUS</strong></th>
                                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                                </tr>
                                            ) : (
                                                <tr>
                                                    <th style={{ width: '60px' }}><strong>SL NO.</strong></th>
                                                    <th><strong>PHOTO</strong></th>
                                                    <th><strong>VEHICLE NO</strong></th>
                                                    <th><strong>TYPE</strong></th>
                                                    <th><strong>COMPANY</strong></th>
                                                    <th><strong>DRIVER / EMPLOYEE</strong></th>
                                                    <th><strong>PREFERRED</strong></th>
                                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                                </tr>
                                            )}
                                        </thead>
                                        <tbody>
                                            {activeTab === 'visitors' ? (
                                                paginatedVisitors.length > 0 ? (
                                                    paginatedVisitors.map((visitor, index) => (
                                                        <tr key={index}>
                                                            <td className="text-muted fw-semibold" style={{ fontSize: '13px' }}>
                                                                {indexOfFirstItem + index + 1}
                                                            </td>
                                                            <td>
                                                                <Image
                                                                    src={visitor.visitor_photo ? getFullImageUrl(visitor.visitor_photo) : 'https://via.placeholder.com/40'}
                                                                    rounded
                                                                    style={{ width: '40px', height: '40px', objectFit: 'cover', cursor: 'pointer', border: '1px solid #e2e8f0' }}
                                                                    onClick={() => handleZoom(visitor.visitor_photo)}
                                                                />
                                                            </td>
                                                            <td><strong style={{ color: '#1e293b' }}>{visitor.visitor_name}</strong></td>
                                                            <td style={{ color: '#64748b' }}>{visitor.mobile_no}</td>
                                                            <td style={{ color: '#64748b' }}>{visitor.company_name || '-'}</td>
                                                            <td style={{ color: '#64748b' }}>{visitor.department_name || '-'}</td>
                                                            <td>{visitor.is_blacklisted ? <span className="badge badge-danger light">Blacklisted</span> : <span className="badge badge-success light">Active</span>}</td>
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end align-items-center gap-2">
                                                                    {can('visitors', 'edit') && (
                                                                        <>
                                                                            <EditButton module="visitors" onClick={() => handleEdit(visitor)} style={{ width: '32px', height: '32px', borderRadius: '8px', padding: 0 }} />
                                                                            <Button variant={visitor.is_blacklisted ? "success" : "warning"} className="d-flex align-items-center justify-content-center p-0" style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none' }} onClick={() => handleBlacklistToggle(visitor)}>
                                                                                <i className={`fa fa-${visitor.is_blacklisted ? 'unlock' : 'ban'} text-white`} style={{ fontSize: '13px' }}></i>
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                    {can('visitors', 'delete') && (
                                                                        <DeleteButton module="visitors" onClick={() => handleDelete(visitor.id)} style={{ width: '32px', height: '32px', borderRadius: '8px', padding: 0 }} />
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : <tr><td colSpan="8" className="text-center py-5 text-muted">No visitor records found.</td></tr>
                                            ) : (
                                                paginatedVehicles.length > 0 ? (
                                                    paginatedVehicles.map((vehicle, index) => (
                                                        <tr key={index}>
                                                            <td className="text-muted fw-semibold" style={{ fontSize: '13px' }}>
                                                                {indexOfFirstItem + index + 1}
                                                            </td>
                                                            <td>
                                                                <Image
                                                                    src={vehicle.vehicle_photo ? getFullImageUrl(vehicle.vehicle_photo) : 'https://via.placeholder.com/40'}
                                                                    rounded
                                                                    style={{ width: '40px', height: '40px', objectFit: 'cover', cursor: 'pointer', border: '1px solid #e2e8f0' }}
                                                                    onClick={() => handleZoom(vehicle.vehicle_photo)}
                                                                />
                                                            </td>
                                                            <td><strong style={{ color: '#1e293b' }}>{vehicle.vehicle_number}</strong></td>
                                                            <td>
                                                                {vehicle.vehicle_type_name ? (
                                                                    <span 
                                                                        className="badge light badge-info d-inline-flex align-items-center" 
                                                                        style={{ 
                                                                            fontSize: '12px', 
                                                                            fontWeight: '500', 
                                                                            padding: '4px 10px', 
                                                                            borderRadius: '6px',
                                                                            backgroundColor: isDark ? 'rgba(81, 166, 245, 0.15)' : '#f0f9ff',
                                                                            color: isDark ? '#7dd3fc' : '#0284c7',
                                                                            border: isDark ? '1px solid rgba(81, 166, 245, 0.3)' : '1px solid #bae6fd'
                                                                        }}
                                                                    >
                                                                        {vehicle.vehicle_type_name}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-muted" style={{ fontSize: '12px' }}>-</span>
                                                                )}
                                                            </td>
                                                            <td style={{ color: '#64748b' }}>{vehicle.company || '-'}</td>
                                                            <td style={{ color: '#1e293b' }}>
                                                                {vehicle.employee_name ? (
                                                                    <span className="d-flex align-items-center gap-1">
                                                                        <i className="fa fa-user-circle text-primary" style={{ fontSize: '13px' }}></i>
                                                                        <span className="fw-semibold">{vehicle.employee_name}</span>
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ color: '#64748b' }}>{vehicle.driver || '-'}</span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                {vehicle.is_preferred ? (
                                                                    <span 
                                                                        className="badge light badge-success d-inline-flex align-items-center gap-1" 
                                                                        style={{ 
                                                                            fontSize: '12px', 
                                                                            fontWeight: '600', 
                                                                            padding: '4px 10px', 
                                                                            borderRadius: '6px',
                                                                            backgroundColor: isDark ? 'rgba(46, 206, 138, 0.15)' : '#ecfdf5',
                                                                            color: isDark ? '#4ade80' : '#059669',
                                                                            border: isDark ? '1px solid rgba(46, 206, 138, 0.3)' : '1px solid #a7f3d0'
                                                                        }}
                                                                    >
                                                                        <i className="fa fa-star text-warning" style={{ fontSize: '11px' }}></i>
                                                                        <span>Preferred</span>
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-muted" style={{ fontSize: '12px' }}>-</span>
                                                                )}
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end align-items-center gap-2">
                                                                    {can('vehicles', 'edit') && (
                                                                        <EditButton module="vehicles" onClick={() => {
                                                                            setVisitorFound(vehicle);
                                                                            setRegistrationType('vehicle');
                                                                            setFormData({
                                                                                vehicle_number: vehicle.vehicle_number || '',
                                                                                company: vehicle.company || '',
                                                                                driver: vehicle.driver || '',
                                                                                employee: vehicle.employee || '',
                                                                                is_preferred: Boolean(vehicle.is_preferred),
                                                                                vehicle_type: vehicle.vehicle_type || '',
                                                                                vehicle_photo: null
                                                                            });
                                                                            setPreviews({
                                                                                vehicle_photo: vehicle.vehicle_photo ? getFullImageUrl(vehicle.vehicle_photo) : null
                                                                            });
                                                                        }} style={{ width: '32px', height: '32px', borderRadius: '8px', padding: 0 }} />
                                                                    )}
                                                                    {can('vehicles', 'delete') && (
                                                                        <DeleteButton module="vehicles" onClick={() => handleDeleteVehicle(vehicle.id)} style={{ width: '32px', height: '32px', borderRadius: '8px', padding: 0 }} />
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : <tr><td colSpan="8" className="text-center py-5 text-muted">No vehicle records found.</td></tr>
                                            )}
                                        </tbody>
                                    </Table>
                                </div>
                            )}

                            {/* Pagination Controls (Matching SalesOrderList) */}
                            {currentDataset.length > 0 && (
                                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center mt-3 pt-3 border-top gap-2" style={{ borderColor: isDark ? '#334155' : '#f1f5f9' }}>
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, currentDataset.length)} of {currentDataset.length} entries
                                    </div>
                                    {totalPages > 1 && (
                                        <nav>
                                            <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                    <button 
                                                        type="button" 
                                                        className="page-link" 
                                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                                                        disabled={currentPage === 1} 
                                                        style={{ border: 'none', background: 'none' }}
                                                    >
                                                        <i className="la la-angle-left" />
                                                    </button>
                                                </li>
                                                {Array.from({ length: totalPages }, (_, index) => {
                                                    const pageNumber = index + 1;
                                                    if (
                                                        pageNumber === 1 ||
                                                        pageNumber === totalPages ||
                                                        (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                                    ) {
                                                        return (
                                                            <li key={pageNumber} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}>
                                                                <button 
                                                                    type="button" 
                                                                    className="page-link" 
                                                                    onClick={() => setCurrentPage(pageNumber)} 
                                                                    style={{ border: 'none' }}
                                                                >
                                                                    {pageNumber}
                                                                </button>
                                                            </li>
                                                        );
                                                    } else if (
                                                        pageNumber === currentPage - 2 ||
                                                        pageNumber === currentPage + 2
                                                    ) {
                                                        return (
                                                            <li key={pageNumber} className="page-item disabled">
                                                                <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                            </li>
                                                        );
                                                    }
                                                    return null;
                                                })}
                                                <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                    <button 
                                                        type="button" 
                                                        className="page-link" 
                                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                                                        disabled={currentPage === totalPages} 
                                                        style={{ border: 'none', background: 'none' }}
                                                    >
                                                        <i className="la la-angle-right" />
                                                    </button>
                                                </li>
                                            </ul>
                                        </nav>
                                    )}
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* VISITOR MODAL - Stock Item Form Style */}
            <Modal
                show={visitorFound !== null}
                onHide={handleCloseModal}
                dialogClassName="item-custom-modal visitor-modal"
                backdrop="static"
                keyboard={false}
                restoreFocus={false}
                enforceFocus={false}
                size="lg"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="white" />
                            </svg>
                        </div>
                        <div className="flex-grow-1">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                        {visitorFound && visitorFound.id ? (registrationType === 'visitor' ? 'Edit Visitor Profile' : 'Edit Vehicle Profile') : 'New Registration'}
                                    </h4>
                                    <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                        {registrationType === 'visitor' ? 'Enter visitor personal and company information' : 'Enter vehicle registration details'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleCloseModal}>
                        &times;
                    </button>
                </div>

                <Form onSubmit={handleSubmit} onKeyDown={(e) => handleKeyDown(e, '.visitor-modal')}>
                    <div className="modal-body-custom">
                        {(!visitorFound || !visitorFound.id) && (
                            <div className="text-center mb-4">
                                <div style={{ background: '#f1f5f9', padding: '4px', borderRadius: '10px', display: 'inline-flex', position: 'relative', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }}>
                                    <div 
                                        style={{ 
                                            position: 'absolute', 
                                            top: '4px', bottom: '4px', width: 'calc(50% - 4px)', background: '#fff', borderRadius: '8px', 
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)', 
                                            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            transform: registrationType === 'visitor' ? 'translateX(0)' : 'translateX(100%)',
                                            left: '4px'
                                        }} 
                                    />
                                    <button 
                                        type="button" 
                                        style={{ position: 'relative', zIndex: 1, border: 'none', background: 'transparent', padding: '6px 30px', fontSize: '14px', fontWeight: registrationType === 'visitor' ? '600' : '500', color: registrationType === 'visitor' ? '#2ece8a' : '#64748b', transition: 'color 0.3s ease', cursor: 'pointer' }} 
                                        onClick={() => setRegistrationType('visitor')}
                                    >
                                        <i className="fa fa-user me-2"></i>Visitor
                                    </button>
                                    <button 
                                        type="button" 
                                        style={{ position: 'relative', zIndex: 1, border: 'none', background: 'transparent', padding: '6px 30px', fontSize: '14px', fontWeight: registrationType === 'vehicle' ? '600' : '500', color: registrationType === 'vehicle' ? '#2ece8a' : '#64748b', transition: 'color 0.3s ease', cursor: 'pointer' }} 
                                        onClick={() => setRegistrationType('vehicle')}
                                    >
                                        <i className="fa fa-car me-2"></i>Vehicle
                                    </button>
                                </div>
                            </div>
                        )}
                        {visitorFound && visitorFound.is_blacklisted && (
                            <div className="alert alert-danger d-flex align-items-center mb-4 p-3 border-0" style={{ borderRadius: '10px', background: '#fef2f2', borderLeft: '4px solid #ef4444' }}>
                                <i className="fa fa-ban text-danger me-3" style={{ fontSize: '24px' }}></i>
                                <div>
                                    <h6 className="mb-1 text-danger fw-bold" style={{ fontSize: '14px' }}>RESTRICTED VISITOR (BLACKLISTED)</h6>
                                    <p className="mb-0 text-dark" style={{ fontSize: '13px' }}><strong>Reason:</strong> {visitorFound.blacklist_reason || 'No specific reason provided.'}</p>
                                </div>
                            </div>
                        )}

                        {registrationType === 'visitor' ? (
                            <>
                                <div className="row mb-3">
                                    <div className="col-md-6">
                                        <Form.Label className="form-label-custom">Visitor Name <span className="text-danger">*</span></Form.Label>
                                        <Form.Control type="text" name="visitor_name" className="form-control-custom" value={formData.visitor_name} onChange={handleChange} placeholder="Enter visitor name" autoFocus={true} required />
                                    </div>
                                    <div className="col-md-6">
                                        <Form.Label className="form-label-custom">Mobile Number <span className="text-danger">*</span></Form.Label>
                                        <Form.Control type="text" name="mobile_no" className="form-control-custom" value={formData.mobile_no} onChange={handleChange} readOnly={!!(visitorFound && visitorFound.id)} placeholder="e.g. 9876543210" maxLength={15} required />
                                    </div>
                                </div>
                                <div className="row mb-3">
                                    <div className="col-md-6">
                                        <Form.Label className="form-label-custom">Email Address</Form.Label>
                                        <Form.Control type="email" name="email" className="form-control-custom" value={formData.email} onChange={handleChange} placeholder="e.g. visitor@company.com" />
                                    </div>
                                    <div className="col-md-6">
                                        <Form.Label className="form-label-custom">Company Name</Form.Label>
                                        <Form.Control type="text" name="company_name" className="form-control-custom" value={formData.company_name} onChange={handleChange} placeholder="e.g. Acme Corp" />
                                    </div>
                                </div>
                                <div className="row mb-3">
                                    <div className="col-md-6">
                                        <Form.Label className="form-label-custom">Department <span className="text-danger">*</span></Form.Label>
                                        <Select classNamePrefix="react-select" options={toOptions(departments)} value={findOption(toOptions(departments), formData.department)} onChange={handleDepartmentSelectChange} onFocus={handleSelectFocus} onKeyDown={handleSelectKeyDown} placeholder="Select Department..." isClearable openMenuOnFocus={true} styles={selectStyles} />
                                    </div>
                                    <div className="col-md-6">
                                        <Form.Label className="form-label-custom">Address</Form.Label>
                                        <Form.Control type="text" name="address" className="form-control-custom" value={formData.address} onChange={handleChange} placeholder="Enter address..." />
                                    </div>
                                </div>
                                <hr className="my-3" style={{ borderColor: '#e2e8f0' }} />
                                <h6 className="font-w600 text-dark mb-3" style={{ fontSize: '14px' }}>Document Uploads (Photos)</h6>
                                <div className="row">
                                    {/* Visitor Photo */}
                                    <div className="col-md-4 mb-3">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <Form.Label className="form-label-custom mb-0">Visitor Photo <span className="text-danger">*</span></Form.Label>
                                            <Button id="btn_camera_visitor_photo" size="sm" type="button" onClick={() => setCameraField('visitor_photo')} className="btn-camera-upload d-flex align-items-center gap-1 px-2 py-1" style={{ background: '#2ece8a', borderColor: '#2ece8a', color: '#fff', fontSize: '11px', borderRadius: '6px' }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); setCameraField('visitor_photo'); } }}>
                                                <i className="fa fa-camera"></i> Camera
                                            </Button>
                                        </div>
                                        <div id="dropzone_visitor_photo" className={`image-upload-btn dropzone-upload${previews.visitor_photo || (visitorFound && visitorFound.visitor_photo) ? ' has-image' : ''}`} role="button" tabIndex={0} onClick={() => document.getElementById('visitor_photo_file')?.click()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); document.getElementById('visitor_photo_file')?.click(); } }}>
                                            {previews.visitor_photo || (visitorFound && visitorFound.visitor_photo) ? (
                                                <Fragment>
                                                    <img src={previews.visitor_photo || getFullImageUrl(visitorFound.visitor_photo)} alt="preview" className="dz-thumb" onClick={(e) => { e.stopPropagation(); handleZoom(previews.visitor_photo || visitorFound.visitor_photo); }} />
                                                    <div className="dz-file-info"><span className="dz-file-name">{formData.visitor_photo?.name || 'Current photo'}</span><span className="dz-file-hint">Click to replace</span></div>
                                                    <button type="button" className="dz-remove-btn" title="Remove photo" onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, visitor_photo: null })); setPreviews(prev => ({ ...prev, visitor_photo: null })); }}>×</button>
                                                </Fragment>
                                            ) : (
                                                <Fragment><svg className="dz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 8.96" /><path d="M12 12v7" /><path d="M9.5 14.5 12 12l2.5 2.5" /></svg><span className="dz-title">Drag &amp; drop, or <span>browse</span></span><span className="dz-subtitle">PNG or JPG</span></Fragment>
                                            )}
                                            <input id="visitor_photo_file" type="file" name="visitor_photo" accept="image/*" style={{ display: 'none' }} onChange={handleChange} />
                                        </div>
                                    </div>
                                    {/* ID Card Photo */}
                                    <div className="col-md-4 mb-3">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <Form.Label className="form-label-custom mb-0">ID Card Photo <span className="text-danger">*</span></Form.Label>
                                            <Button id="btn_camera_id_card_photo" size="sm" type="button" onClick={() => setCameraField('id_card_photo')} className="btn-camera-upload d-flex align-items-center gap-1 px-2 py-1" style={{ background: '#2ece8a', borderColor: '#2ece8a', color: '#fff', fontSize: '11px', borderRadius: '6px' }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); setCameraField('id_card_photo'); } }}>
                                                <i className="fa fa-camera"></i> Camera
                                            </Button>
                                        </div>
                                        <div id="dropzone_id_card_photo" className={`image-upload-btn dropzone-upload${previews.id_card_photo || (visitorFound && visitorFound.id_card_photo) ? ' has-image' : ''}`} role="button" tabIndex={0} onClick={() => document.getElementById('id_card_photo_file')?.click()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); document.getElementById('id_card_photo_file')?.click(); } }}>
                                            {previews.id_card_photo || (visitorFound && visitorFound.id_card_photo) ? (
                                                <Fragment>
                                                    <img src={previews.id_card_photo || getFullImageUrl(visitorFound.id_card_photo)} alt="preview" className="dz-thumb" onClick={(e) => { e.stopPropagation(); handleZoom(previews.id_card_photo || visitorFound.id_card_photo); }} />
                                                    <div className="dz-file-info"><span className="dz-file-name">{formData.id_card_photo?.name || 'Current ID photo'}</span><span className="dz-file-hint">Click to replace</span></div>
                                                    <button type="button" className="dz-remove-btn" title="Remove photo" onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, id_card_photo: null })); setPreviews(prev => ({ ...prev, id_card_photo: null })); }}>×</button>
                                                </Fragment>
                                            ) : (
                                                <Fragment><svg className="dz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 8.96" /><path d="M12 12v7" /><path d="M9.5 14.5 12 12l2.5 2.5" /></svg><span className="dz-title">Drag &amp; drop, or <span>browse</span></span><span className="dz-subtitle">PNG or JPG</span></Fragment>
                                            )}
                                            <input id="id_card_photo_file" type="file" name="id_card_photo" accept="image/*" style={{ display: 'none' }} onChange={handleChange} />
                                        </div>
                                    </div>
                                    {/* Visiting Card Photo */}
                                    <div className="col-md-4 mb-3">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <Form.Label className="form-label-custom mb-0">Visiting Card</Form.Label>
                                            <Button id="btn_camera_visiting_card_photo" size="sm" type="button" onClick={() => setCameraField('visiting_card_photo')} className="btn-camera-upload d-flex align-items-center gap-1 px-2 py-1" style={{ background: '#2ece8a', borderColor: '#2ece8a', color: '#fff', fontSize: '11px', borderRadius: '6px' }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); setCameraField('visiting_card_photo'); } }}>
                                                <i className="fa fa-camera"></i> Camera
                                            </Button>
                                        </div>
                                        <div id="dropzone_visiting_card_photo" className={`image-upload-btn dropzone-upload${previews.visiting_card_photo || (visitorFound && visitorFound.visiting_card_photo) ? ' has-image' : ''}`} role="button" tabIndex={0} onClick={() => document.getElementById('visiting_card_photo_file')?.click()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); document.getElementById('visiting_card_photo_file')?.click(); } }}>
                                            {previews.visiting_card_photo || (visitorFound && visitorFound.visiting_card_photo) ? (
                                                <Fragment>
                                                    <img src={previews.visiting_card_photo || getFullImageUrl(visitorFound.visiting_card_photo)} alt="preview" className="dz-thumb" onClick={(e) => { e.stopPropagation(); handleZoom(previews.visiting_card_photo || visitorFound.visiting_card_photo); }} />
                                                    <div className="dz-file-info"><span className="dz-file-name">{formData.visiting_card_photo?.name || 'Current card'}</span><span className="dz-file-hint">Click to replace</span></div>
                                                    <button type="button" className="dz-remove-btn" title="Remove photo" onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, visiting_card_photo: null })); setPreviews(prev => ({ ...prev, visiting_card_photo: null })); }}>×</button>
                                                </Fragment>
                                            ) : (
                                                <Fragment><svg className="dz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 8.96" /><path d="M12 12v7" /><path d="M9.5 14.5 12 12l2.5 2.5" /></svg><span className="dz-title">Drag &amp; drop, or <span>browse</span></span><span className="dz-subtitle">PNG or JPG</span></Fragment>
                                            )}
                                            <input id="visiting_card_photo_file" type="file" name="visiting_card_photo" accept="image/*" style={{ display: 'none' }} onChange={handleChange} />
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="row mb-3">
                                    <div className="col-md-6">
                                        <Form.Label className="form-label-custom">Vehicle Number <span className="text-danger">*</span></Form.Label>
                                        <Form.Control type="text" name="vehicle_number" className="form-control-custom" value={formData.vehicle_number} onChange={handleChange} placeholder="e.g. KL 01 AB 1234" autoFocus={true} required />
                                    </div>
                                    <div className="col-md-6">
                                        <Form.Label className="form-label-custom">Vehicle Type</Form.Label>
                                        <Select 
                                            classNamePrefix="react-select" 
                                            options={toOptions(vehicleTypes)} 
                                            value={findOption(toOptions(vehicleTypes), currentVehicleTypeId)} 
                                            onChange={(opt) => {
                                                const typeId = opt ? opt.value : '';
                                                const typeObj = vehicleTypes.find(t => String(t.id) === String(typeId));
                                                const isEmp = Boolean(typeObj && typeObj.name && typeObj.name.toLowerCase().includes('employee'));
                                                setFormData(prev => ({
                                                    ...prev,
                                                    vehicle_type: typeId,
                                                    ...(isEmp ? {} : { is_preferred: false })
                                                }));
                                            }} 
                                            onFocus={handleSelectFocus} 
                                            onKeyDown={handleSelectKeyDown} 
                                            placeholder="Select Vehicle Type..." 
                                            isClearable 
                                            openMenuOnFocus={true} 
                                            styles={selectStyles} 
                                        />
                                    </div>
                                </div>
                                <div className="row mb-3">
                                    <div className="col-md-6">
                                        <Form.Label className="form-label-custom">Company Name <span className="text-danger">*</span></Form.Label>
                                        <Form.Control type="text" name="company" className="form-control-custom" value={formData.company} onChange={handleChange} placeholder="e.g. Glenda" required />
                                    </div>
                                    <div className="col-md-6">
                                        {isEmployeeVehicle ? (
                                            <>
                                                <Form.Label className="form-label-custom">Employee Name <span className="text-danger">*</span></Form.Label>
                                                <Select
                                                    classNamePrefix="react-select employee-select"
                                                    options={employeeOptions}
                                                    value={
                                                        findOption(employeeOptions, formData.employee) ||
                                                        (formData.driver ? employeeOptions.find(o => o.empName?.toLowerCase() === (formData.driver || '').trim().toLowerCase()) : null)
                                                    }
                                                    onChange={(opt) => {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            employee: opt ? opt.value : '',
                                                            driver: opt ? (opt.empName || opt.label) : ''
                                                        }));
                                                    }}
                                                    onFocus={handleSelectFocus}
                                                    onKeyDown={handleSelectKeyDown}
                                                    placeholder="Select Employee..."
                                                    isClearable
                                                    openMenuOnFocus={true}
                                                    styles={selectStyles}
                                                />
                                            </>
                                        ) : (
                                            <>
                                                <Form.Label className="form-label-custom">Driver Name</Form.Label>
                                                <Form.Control type="text" name="driver" className="form-control-custom" value={formData.driver} onChange={handleChange} placeholder="Enter driver name" />
                                            </>
                                        )}
                                    </div>
                                </div>
                                {isEmployeeVehicle && (
                                    <div className="row mb-3">
                                        <div className="col-12">
                                            <div 
                                                className="d-flex align-items-center justify-content-between p-3 rounded-3" 
                                                style={{ 
                                                    background: formData.is_preferred ? '#ecfdf5' : '#f8fafc', 
                                                    border: formData.is_preferred ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                                                    transition: 'all 0.2s ease',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => setFormData(prev => ({ ...prev, is_preferred: !prev.is_preferred }))}
                                            >
                                                <div className="d-flex align-items-center gap-3">
                                                    <div 
                                                        className="d-flex align-items-center justify-content-center rounded-circle"
                                                        style={{
                                                            width: '36px',
                                                            height: '36px',
                                                            background: formData.is_preferred ? '#10b981' : '#e2e8f0',
                                                            color: formData.is_preferred ? '#fff' : '#64748b'
                                                        }}
                                                    >
                                                        <i className="fa fa-star" style={{ fontSize: '14px' }}></i>
                                                    </div>
                                                    <div>
                                                        <Form.Check
                                                            type="checkbox"
                                                            id="is_preferred_vehicle"
                                                            label={<span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>Is Preferred Vehicle?</span>}
                                                            checked={Boolean(formData.is_preferred)}
                                                            onChange={(e) => setFormData(prev => ({ ...prev, is_preferred: e.target.checked }))}
                                                            onClick={(e) => e.stopPropagation()}
                                                            style={{ cursor: 'pointer' }}
                                                        />
                                                        <small className="text-muted d-block mt-1" style={{ fontSize: '11px' }}>
                                                            Designate this vehicle as the preferred vehicle to auto-populate during employee gate entry.
                                                        </small>
                                                    </div>
                                                </div>
                                                {formData.is_preferred && (
                                                    <span 
                                                        className="badge light badge-success d-inline-flex align-items-center gap-1" 
                                                        style={{ 
                                                            fontSize: '11px', 
                                                            fontWeight: '600', 
                                                            padding: '4px 10px', 
                                                            borderRadius: '6px',
                                                            backgroundColor: isDark ? 'rgba(46, 206, 138, 0.15)' : '#ecfdf5',
                                                            color: isDark ? '#4ade80' : '#059669',
                                                            border: isDark ? '1px solid rgba(46, 206, 138, 0.3)' : '1px solid #a7f3d0'
                                                        }}
                                                    >
                                                        <i className="fa fa-star text-warning" style={{ fontSize: '10px' }}></i>
                                                        <span>Preferred Vehicle</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <hr className="my-3" style={{ borderColor: '#e2e8f0' }} />
                                <h6 className="font-w600 text-dark mb-3" style={{ fontSize: '14px' }}>Document Uploads (Photos)</h6>
                                <div className="row">
                                    {/* Vehicle Photo */}
                                    <div className="col-md-4 mb-3">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <Form.Label className="form-label-custom mb-0">Vehicle Photo <span className="text-danger">*</span></Form.Label>
                                            <Button id="btn_camera_vehicle_photo" size="sm" type="button" onClick={() => setCameraField('vehicle_photo')} className="btn-camera-upload d-flex align-items-center gap-1 px-2 py-1" style={{ background: '#2ece8a', borderColor: '#2ece8a', color: '#fff', fontSize: '11px', borderRadius: '6px' }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); setCameraField('vehicle_photo'); } }}>
                                                <i className="fa fa-camera"></i> Camera
                                            </Button>
                                        </div>
                                        <div id="dropzone_vehicle_photo" className={`image-upload-btn dropzone-upload${previews.vehicle_photo || (visitorFound && visitorFound.vehicle_photo) ? ' has-image' : ''}`} role="button" tabIndex={0} onClick={() => document.getElementById('vehicle_photo_file')?.click()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); document.getElementById('vehicle_photo_file')?.click(); } }}>
                                            {previews.vehicle_photo || (visitorFound && visitorFound.vehicle_photo) ? (
                                                <Fragment>
                                                    <img src={previews.vehicle_photo || getFullImageUrl(visitorFound.vehicle_photo)} alt="preview" className="dz-thumb" onClick={(e) => { e.stopPropagation(); handleZoom(previews.vehicle_photo || visitorFound.vehicle_photo); }} />
                                                    <div className="dz-file-info"><span className="dz-file-name">{formData.vehicle_photo?.name || 'Current photo'}</span><span className="dz-file-hint">Click to replace</span></div>
                                                    <button type="button" className="dz-remove-btn" title="Remove photo" onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, vehicle_photo: null })); setPreviews(prev => ({ ...prev, vehicle_photo: null })); }}>×</button>
                                                </Fragment>
                                            ) : (
                                                <Fragment><svg className="dz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 8.96" /><path d="M12 12v7" /><path d="M9.5 14.5 12 12l2.5 2.5" /></svg><span className="dz-title">Drag &amp; drop, or <span>browse</span></span><span className="dz-subtitle">PNG or JPG</span></Fragment>
                                            )}
                                            <input id="vehicle_photo_file" type="file" name="vehicle_photo" accept="image/*" style={{ display: 'none' }} onChange={handleChange} />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={handleCloseModal}>
                            Close
                        </Button>
                        <Button type="submit" className="btn-save-custom" disabled={loading || (visitorFound && visitorFound.is_blacklisted)}>
                            {loading ? 'Processing...' : (visitorFound && visitorFound.id ? 'Update' : 'Save')}
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* CAMERA CAPTURE MODAL */}
            <CameraCapture
                show={cameraField !== null}
                onHide={() => setCameraField(null)}
                onCapture={handleCameraCapture}
                title={
                    cameraField === 'visitor_photo' ? 'Capture Visitor Photo' :
                    cameraField === 'id_card_photo' ? 'Capture ID Card Photo' :
                    cameraField === 'vehicle_photo' ? 'Capture Vehicle Photo' :
                    'Capture Visiting Card'
                }
            />

            {/* ZOOM IMAGE MODAL */}
            <Modal show={zoomImage !== null} onHide={() => setZoomImage(null)} size="lg" centered>
                <Modal.Header closeButton className="border-0 pb-0 bg-dark text-white">
                    <Modal.Title></Modal.Title>
                </Modal.Header>
                <Modal.Body className="text-center p-3 bg-dark">
                    <Image src={zoomImage} fluid className="rounded shadow-lg" style={{ maxHeight: '80vh' }} />
                </Modal.Body>
            </Modal>

            <style dangerouslySetInnerHTML={{
                __html: `
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
                    background-color: #2ece8a !important;
                    border-radius: 50% !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2) !important;
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
                    border-color: #2ece8a !important;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15) !important;
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
                }
                .item-custom-modal .btn-close-custom {
                    background-color: #7A70BA !important;
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
                    border-color: #2ece8a !important;
                    background-color: #f0fdf6 !important;
                }
                .item-custom-modal .dropzone-upload:focus-visible {
                    border-color: #2ece8a !important;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15) !important;
                }
                .item-custom-modal .dropzone-upload.dragging {
                    border-color: #16a34a !important;
                    border-style: solid !important;
                    background-color: #ecfdf5 !important;
                    transform: scale(1.01) !important;
                }
                .item-custom-modal .dropzone-upload .dz-icon {
                    width: 30px !important;
                    height: 30px !important;
                    color: #2ece8a !important;
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
                    cursor: zoom-in !important;
                }
                .item-custom-modal .dz-file-info {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 2px !important;
                    overflow: hidden !important;
                    flex: 1 !important;
                }
                .item-custom-modal .dz-file-name {
                    font-size: 12.5px !important;
                    font-weight: 500 !important;
                    color: #334155 !important;
                    white-space: nowrap !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                }
                .item-custom-modal .dz-file-hint {
                    font-size: 11px !important;
                    color: #64748b !important;
                }
                .item-custom-modal .dz-remove-btn {
                    flex-shrink: 0 !important;
                    width: 24px !important;
                    height: 24px !important;
                    border-radius: 50% !important;
                    border: none !important;
                    background-color: #fee2e2 !important;
                    color: #dc2626 !important;
                    font-size: 14px !important;
                    line-height: 1 !important;
                    cursor: pointer !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    transition: background-color 0.2s !important;
                }
                .item-custom-modal .dz-remove-btn:hover {
                    background-color: #fecaca !important;
                }
                `
            }} />
        </div>
    );
};

export default VisitorRegistration;
