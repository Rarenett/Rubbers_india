import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { Row, Col, Card, Form, Button, Spinner, Badge, Modal, ListGroup, Image } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    searchVisitorByMobile,
    getGates,
    getGateCategories,
    getGeneratedTags,
    createGateEntry,
    updateGateEntry,
    getGateEntry,
    createGate,
    createGateCategory,
    createEntryTag,
    searchVehicleByNumber,
    createVehicleEntry,
    getGateEntries,
    getVehicleEntries,
    scanEmployeeGateEntry,
    lookupEmployeeGateEntry,
    getApprovelessConfigs,
    scanFastPassVehicle,
    getFastPassStatus,
    checkUnclosedGateEntry,
    resumeGateEntry,
    getEquipments,
    getParkAreas,
    switchEmployeeGateEntryVehicle,
    getVehiclesByEmployee,
    getVehicleTypes
} from '../../../services/GateManagementService.js';
import AppointmentService from '../../../services/AppointmentService';
import { getDepartments, getUsers, createDepartment, createUser } from '../../../services/HRManagementService.js';
import { ThemeContext } from "../../../context/ThemeContext";
import { usePermission } from '../../../hooks/usePermission';
import SpotVisitorModal from './SpotVisitorModal';
import SpotVehicleModal from './SpotVehicleModal';
import GateFormModal from './GateFormModal';
import CategoryFormModal from './CategoryFormModal';
import EntryTagFormModal from './EntryTagFormModal';
import EquipmentFormModal from './EquipmentFormModal';
import SpotAppointmentView from './SpotAppointmentView';
import CameraCapture from './CameraCapture';
import GateFaceScanner from './GateFaceScanner';
import GateFaceEnrollModal from './GateFaceEnrollModal';
import { playCheckInSound, playCheckOutSound, playErrorSound } from '../../../utils/audioNotification';
import { printEntryCard, printExitCard, downloadEntryCardPDF, downloadExitCardPDF } from '../../../utils/gateCardPdfGenerator';
import './AccessPoint.css';
const formatDateDMY = (dateStr) => {
    if (!dateStr) return '';
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
        const [y, m, d] = parts;
        return `${d}-${m}-${y}`;
    }
    return dateStr;
};

const getFullImageUrl = (path) => {
    if (!path) return null;
    if (typeof path === 'object' && path.url) path = path.url;
    if (typeof path !== 'string') return null;
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:') || path.startsWith('data:')) {
        return path;
    }
    const baseUrl = (import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
};

const isEmployeeCode = (str) => {
    if (!str || typeof str !== 'string') return false;
    const s = str.trim().toUpperCase();
    return s.startsWith('GLN') || s.startsWith('EMP') || s.startsWith('GND');
};

export const isInternalVehicle = (vehicleOrList) => {
    if (!vehicleOrList) return false;
    const list = Array.isArray(vehicleOrList) ? vehicleOrList : [vehicleOrList];
    if (list.length === 0) return false;
    return list.some(v => {
        if (!v) return false;
        // 1. Employee linked or employee flag
        if (v.employee || v.employee_name || v.is_employee) return true;
        // 2. Vehicle type name
        const typeName = String(v.vehicle_type_name || v.vehicle_type || '').toLowerCase();
        if (/employee|owner|executive|company|fleet|official/i.test(typeName)) return true;
        // 3. Company field check
        const comp = String(v.company || '').toLowerCase();
        if (/glenda|executive|owner|company\s*fleet/i.test(comp)) return true;
        // 4. Driver check
        const driver = String(v.driver || '').toLowerCase();
        if (/owner/i.test(driver)) return true;
        return false;
    });
};

export const getInternalVehicleCategory = (vehicle) => {
    if (!vehicle) return '';
    if (vehicle.employee || vehicle.is_employee || /employee/i.test(vehicle.vehicle_type_name || '')) {
        return 'Employee Vehicle';
    }
    if (vehicle.is_owner || /owner|executive/i.test(vehicle.vehicle_type_name || '') || /owner|executive/i.test(vehicle.company || '') || /owner/i.test(vehicle.driver || '')) {
        return 'Owner / Executive Vehicle';
    }
    if (/company|fleet/i.test(vehicle.vehicle_type_name || '') || /glenda|company|fleet/i.test(vehicle.company || '')) {
        return 'Company / Fleet Vehicle';
    }
    return '';
};

const GateEntryForm = ({ embedded = false, inModal = false, onClose = null, onSuccess = null, editEntry = null }) => {
    const { background } = useContext(ThemeContext);
    const isDark = background.value === "dark";
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const appointmentId = searchParams.get('appointmentId');
    const modeParam = searchParams.get('mode');

    const [loading, setLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isApproved, setIsApproved] = useState(false);
    const [searchMobile, setSearchMobile] = useState('');
    const { can } = usePermission();

    const [mainTab, setMainTab] = useState(modeParam === 'fast_pass' ? 'fast_pass' : 'gate_entry'); // 'gate_entry' | 'fast_pass'
    const [entryMode, setEntryMode] = useState(modeParam === 'employee' ? 'employee' : modeParam === 'vehicle' ? 'vehicle' : 'visitor'); // 'visitor' | 'vehicle' | 'employee'
    const [employeeScanResult, setEmployeeScanResult] = useState(null);
    const [isScanningEmployee, setIsScanningEmployee] = useState(false);
    const [employeeEntryMode, setEmployeeEntryMode] = useState('barcode'); // 'barcode' | 'face'
    const [showFaceEnrollModal, setShowFaceEnrollModal] = useState(false);

    // Employee Vehicle Quick Switch states
    const [showSwitchVehicleModal, setShowSwitchVehicleModal] = useState(false);
    const [targetEntryForVehicleSwitch, setTargetEntryForVehicleSwitch] = useState(null);
    const [employeeRegisteredVehicles, setEmployeeRegisteredVehicles] = useState([]);
    const [loadingEmpVehicles, setLoadingEmpVehicles] = useState(false);
    const [switchMode, setSwitchMode] = useState('existing'); // 'existing' | 'new'
    const [selectedExistingVehicleId, setSelectedExistingVehicleId] = useState('');
    const [newSwitchVehicleNumber, setNewSwitchVehicleNumber] = useState('');
    const [newSwitchVehicleType, setNewSwitchVehicleType] = useState('');
    const [switchSetAsPreferred, setSwitchSetAsPreferred] = useState(true);
    const [submittingVehicleSwitch, setSubmittingVehicleSwitch] = useState(false);
    const [gateVehicleTypes, setGateVehicleTypes] = useState([]);

    // Fast Pass (Owner & Company Vehicle) states
    const [fastPassType, setFastPassType] = useState('Owner Vehicle'); // 'Owner Vehicle' | 'Company Vehicle'
    const [fastPassPlate, setFastPassPlate] = useState('');
    const [fastPassDriver, setFastPassDriver] = useState('');
    const [fastPassLoading, setFastPassLoading] = useState(false);
    const [fastPassStatusData, setFastPassStatusData] = useState({
        inside_vehicles: [],
        company_vehicles: [],
        recent_owner_vehicles: []
    });
    const [loadingFastPassStatus, setLoadingFastPassStatus] = useState(false);

    // Company vehicle checkout popup states
    const [showCompanyCheckoutModal, setShowCompanyCheckoutModal] = useState(false);
    const [companyVehicleToCheckout, setCompanyVehicleToCheckout] = useState(null);
    const [checkoutPurpose, setCheckoutPurpose] = useState('other'); // 'other' | 'delivery'
    const [purposeNote, setPurposeNote] = useState('');
    const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
    const [deliveryNotePhoto, setDeliveryNotePhoto] = useState(null);
    const [deliveryNotePreview, setDeliveryNotePreview] = useState(null);
    const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);

    // Filter inside vehicles based on selected Fast Pass category (Owner vs Company Fleet)
    const displayedInsideVehicles = useMemo(() => {
        return (fastPassStatusData.inside_vehicles || []).filter(item => {
            if (fastPassType === 'Company Vehicle') {
                return item.vehicle_type === 'Company Vehicle';
            }
            if (fastPassType === 'Owner Vehicle') {
                return item.vehicle_type === 'Owner Vehicle';
            }
            return true;
        });
    }, [fastPassStatusData.inside_vehicles, fastPassType]);

    // Master data
    const [gates, setGates] = useState([]);
    const [categories, setCategories] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [availableTags, setAvailableTags] = useState([]);
    const [equipmentsList, setEquipmentsList] = useState([]);
    const [selectedEquipments, setSelectedEquipments] = useState([]);
    const [showEquipmentModal, setShowEquipmentModal] = useState(false);
    const [parkAreas, setParkAreas] = useState([]);

    const [formData, setFormData] = useState({
        visitor: '',
        entry_gate: '',
        department: '',
        employee: '',
        purpose_of_visit: '',
        generated_tag: '',
        generated_tags: [],
        narration: '',
        tag_number: '',
        is_permission_required: false,
        tag_category: '',
        appointment: '',
        company: '',
        driver: '',
        purpose: '',
        material_details: '',
        parking_location: '',
        park_area: '',
        parking_slot: '',
        number_of_persons: 1,
        expected_time_of_exit: ''
    });
    const [visitorData, setVisitorData] = useState(null);
    const [selectedVehicles, setSelectedVehicles] = useState([]);
    const [selectedAppointmentData, setSelectedAppointmentData] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [showSelectionModal, setShowSelectionModal] = useState(false);
    const [showSpotModal, setShowSpotModal] = useState(false);
    const [showSpotVehicleModal, setShowSpotVehicleModal] = useState(false);
    
    // History feature
    const [engagementHistory, setEngagementHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [showHistory, setShowHistory] = useState(true);

    // Appointments feature
    const [showAppointmentsModal, setShowAppointmentsModal] = useState(false);
    const [todayAppointments, setTodayAppointments] = useState([]);
    const [appointmentModalView, setAppointmentModalView] = useState('list'); // 'list' | 'create'
    const [appointmentFilterNumber, setAppointmentFilterNumber] = useState('');

    // Approveless Entry clearance bypass
    const [approvelessConfigs, setApprovelessConfigs] = useState([]);
    const [bypassApproval, setBypassApproval] = useState(false);

    const isApprovelessEligible = useMemo(() => {
        const targetEmpId = selectedAppointmentData?.concerned_staff || formData.employee;
        const targetDeptId = selectedAppointmentData?.department || formData.department;
        if (!targetEmpId || !approvelessConfigs.length) return false;
        return approvelessConfigs.some(c =>
            c.is_active &&
            String(c.employee) === String(targetEmpId) &&
            (!targetDeptId || String(c.department) === String(targetDeptId))
        );
    }, [selectedAppointmentData, formData.employee, formData.department, approvelessConfigs]);

    // Active unclosed entry / Campus outstandings (vehicles / equipments)
    const [unclosedEntryState, setUnclosedEntryState] = useState(null);

    // Visitor currently active inside campus (persons_inside > 0)
    const currentlyInsideEntry = useMemo(() => {
        if (unclosedEntryState && unclosedEntryState.is_currently_inside && unclosedEntryState.active_entry) {
            return unclosedEntryState.active_entry;
        }
        if (engagementHistory && Array.isArray(engagementHistory) && engagementHistory.length > 0) {
            const activeInside = engagementHistory.find(eng => !eng.exit_time && (eng.persons_inside == null || eng.persons_inside > 0));
            if (activeInside) {
                return activeInside;
            }
        }
        return null;
    }, [unclosedEntryState, engagementHistory]);

    const activeOutstandings = useMemo(() => {
        // If visitor is currently inside campus, this is an active visit, NOT a re-entry!
        if (currentlyInsideEntry) {
            return null;
        }
        if (unclosedEntryState && unclosedEntryState.has_outstandings) {
            return unclosedEntryState;
        }
        if (engagementHistory && Array.isArray(engagementHistory) && engagementHistory.length > 0) {
            // ONLY an unclosed entry where all persons exited (persons_inside === 0) qualifies for re-admission!
            const unclosed = engagementHistory.find(eng => !eng.exit_time && eng.persons_inside === 0);
            if (unclosed) {
                const allVehicles = [];
                if (Array.isArray(unclosed.vehicles)) {
                    unclosed.vehicles.forEach(v => {
                        if (v.vehicle_number) allVehicles.push(v.vehicle_number.trim().toUpperCase());
                    });
                }
                if (unclosed.vehicle_number) {
                    unclosed.vehicle_number.split(',').forEach(v => {
                        if (v.trim()) allVehicles.push(v.trim().toUpperCase());
                    });
                }
                const exited = new Set();
                if (Array.isArray(unclosed.partial_exit_logs)) {
                    unclosed.partial_exit_logs.forEach(log => {
                        if (log.vehicle_number) {
                            log.vehicle_number.split(',').forEach(v => exited.add(v.trim().toUpperCase()));
                        }
                        if (Array.isArray(log.vehicle_numbers)) {
                            log.vehicle_numbers.forEach(v => exited.add(String(v).trim().toUpperCase()));
                        }
                    });
                }
                const remaining = allVehicles.filter(v => !exited.has(v));
                
                // Real equipment extraction
                let equipments = '';
                let equipmentsList = [];
                if (Array.isArray(unclosed.equipment_details) && unclosed.equipment_details.length > 0) {
                    equipments = unclosed.equipment_details.map(e => e.name).join(', ');
                    equipmentsList = unclosed.equipment_details;
                } else if (Array.isArray(unclosed.equipments_details) && unclosed.equipments_details.length > 0) {
                    equipments = unclosed.equipments_details.map(e => e.name).join(', ');
                    equipmentsList = unclosed.equipments_details;
                } else {
                    equipments = (unclosed.material_details || unclosed.narration || '').trim();
                }

                if (!remaining.length && !equipmentsList.length) {
                    return null;
                }

                // Tags were surrendered at departure! A new tag must be issued.
                return {
                    id: unclosed.id,
                    visitor_id: unclosed.visitor,
                    visitor_name: unclosed.visitor_name,
                    visitor_mobile: unclosed.visitor_mobile,
                    remaining_vehicles: remaining,
                    vehicles: remaining,
                    vehicles_list: Array.isArray(unclosed.vehicles) ? unclosed.vehicles : [],
                    equipments: equipments,
                    equipments_list: equipmentsList,
                    equipment_ids: Array.isArray(unclosed.equipments) ? unclosed.equipments : equipmentsList.map(e => e.id),
                    material_details: equipments,
                    tag_code: null,
                    tag_id: null,
                    tag_ids: [],
                    tags_list: [],
                    tag_category_id: null,
                    purpose_of_visit: unclosed.purpose_of_visit || '',
                    narration: unclosed.narration || '',
                    number_of_persons: 1,
                    persons_inside: 0,
                    department_id: unclosed.department,
                    department_name: unclosed.department_name,
                    employee_id: unclosed.employee,
                    employee_name: unclosed.employee_name,
                    entry_gate_id: unclosed.entry_gate,
                    entry_gate_name: unclosed.entry_gate_name,
                    has_outstandings: true,
                    rawEntry: unclosed
                };
            }
        }
        return null;
    }, [unclosedEntryState, engagementHistory, currentlyInsideEntry]);

    const hasOutstandings = Boolean(
        activeOutstandings && (
            (activeOutstandings.remaining_vehicles && activeOutstandings.remaining_vehicles.length > 0) ||
            (activeOutstandings.equipments && activeOutstandings.equipments.length > 0) ||
            activeOutstandings.persons_inside === 0 ||
            activeOutstandings.id
        )
    );

    const hasInternalVehicle = isInternalVehicle(selectedVehicles);

    const isAppointmentApproved = Boolean(
        editEntry || 
        hasOutstandings ||
        hasInternalVehicle ||
        (selectedAppointmentData && (selectedAppointmentData.status === 'approved' || isApprovelessEligible)) || 
        bypassApproval
    );
    const hasAppointment = Boolean(formData.appointment || selectedAppointmentData || editEntry);
    const [loadingAppointments, setLoadingAppointments] = useState(false);

    // If appointment is pending but host employee is configured for approveless entry, automatically treat as approved
    useEffect(() => {
        if (selectedAppointmentData && selectedAppointmentData.status === 'pending' && isApprovelessEligible) {
            setSelectedAppointmentData(prev => prev ? ({ ...prev, status: 'approved' }) : prev);
            setFormData(prev => ({ ...prev, is_permission_required: false }));
        }
    }, [selectedAppointmentData, isApprovelessEligible]);

    // Auto-prefill form fields from active outstandings entry if present (new tag must be issued!)
    useEffect(() => {
        if (activeOutstandings && !editEntry) {
            setFormData(prev => ({
                ...prev,
                department: activeOutstandings.department_id ? String(activeOutstandings.department_id) : (prev.department || ''),
                employee: activeOutstandings.employee_id ? String(activeOutstandings.employee_id) : (prev.employee || ''),
                purpose_of_visit: activeOutstandings.purpose_of_visit || prev.purpose_of_visit || '',
                narration: activeOutstandings.narration || prev.narration || '',
                number_of_persons: 1,
                entry_gate: activeOutstandings.entry_gate_id ? String(activeOutstandings.entry_gate_id) : (prev.entry_gate || (gates.length > 0 ? String(gates[0].id) : '')),
                tag_category: '', // Blank: new tag required
                generated_tag: '', // Blank: new tag required
                generated_tags: [],
                tag_number: ''
            }));

            // Pre-fill Equipments / Tools carried into selectedEquipments
            if (Array.isArray(activeOutstandings.equipments_list) && activeOutstandings.equipments_list.length > 0) {
                const formatted = activeOutstandings.equipments_list.map(eq => ({
                    value: eq.id || eq.value,
                    label: eq.name || eq.label,
                    image: eq.image ? getFullImageUrl(eq.image) : null,
                    code: eq.code || null,
                    description: eq.description || null
                }));
                setSelectedEquipments(formatted);
            } else if (Array.isArray(activeOutstandings.equipment_ids) && activeOutstandings.equipment_ids.length > 0 && equipmentsList.length > 0) {
                const matched = equipmentsList
                    .filter(eq => activeOutstandings.equipment_ids.some(id => String(id) === String(eq.id)))
                    .map(eq => ({
                        value: eq.id,
                        label: eq.name,
                        image: eq.image ? getFullImageUrl(eq.image) : null,
                        code: eq.code,
                        description: eq.description
                    }));
                if (matched.length > 0) {
                    setSelectedEquipments(matched);
                }
            }

            // Pre-fill Vehicles carried into selectedVehicles
            if (Array.isArray(activeOutstandings.vehicles_list) && activeOutstandings.vehicles_list.length > 0) {
                setSelectedVehicles(activeOutstandings.vehicles_list);
            } else if (Array.isArray(activeOutstandings.remaining_vehicles) && activeOutstandings.remaining_vehicles.length > 0) {
                setSelectedVehicles(activeOutstandings.remaining_vehicles.map(vNum => ({ vehicle_number: vNum })));
            }
        }
    }, [activeOutstandings, editEntry, gates, equipmentsList]);

    const handleAllowEntry = () => {
        setBypassApproval(true);
        setFormData(prev => ({
            ...prev,
            is_permission_required: false
        }));
        Swal.fire({
            icon: 'success',
            title: 'Approveless Clearance Granted',
            text: 'Host official is pre-authorized. Entry form unlocked — please assign arrival gate & tag pass to admit.',
            timer: 2000,
            showConfirmButton: false
        });
    };

    // Accompanying vehicle entries (Vehicle Number, Driver Name, Vehicle Photo)
    const [vehiclesList, setVehiclesList] = useState([]);
    const [showCamera, setShowCamera] = useState(false);
    const [activeVehicleCameraIndex, setActiveVehicleCameraIndex] = useState(null);

    // Supporting documents for vehicle entry (multiple uploads)
    const [supportingDocs, setSupportingDocs] = useState([]); // [{ id, file, preview, name }]
    const [showDocCamera, setShowDocCamera] = useState(false);

    const handleAddSupportingDocs = (files) => {
        if (!files || files.length === 0) return;
        const newDocs = Array.from(files).map((file, idx) => ({
            id: `doc_${Date.now()}_${idx}`,
            file,
            preview: URL.createObjectURL(file),
            name: file.name || `Document ${supportingDocs.length + idx + 1}`
        }));
        setSupportingDocs(prev => [...prev, ...newDocs]);
    };

    const handleDocCameraCapture = (file) => {
        if (file) {
            const newDoc = {
                id: `cam_${Date.now()}`,
                file,
                preview: URL.createObjectURL(file),
                name: `Camera Snapshot ${supportingDocs.length + 1}`
            };
            setSupportingDocs(prev => [...prev, newDoc]);
        }
        setShowDocCamera(false);
    };

    const handleRemoveSupportingDoc = (index) => {
        setSupportingDocs(prev => {
            const doc = prev[index];
            if (doc && doc.preview && doc.preview.startsWith('blob:')) {
                URL.revokeObjectURL(doc.preview);
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleAddVehicle = () => {
        setVehiclesList(prev => [
            ...prev,
            {
                id: null,
                vehicle_number: '',
                driver_name: '',
                vehicle_photo: null,
                preview: null
            }
        ]);
    };

    const handleVehicleChange = (index, field, value) => {
        setVehiclesList(prev => {
            const next = [...prev];
            next[index] = {
                ...next[index],
                [field]: field === 'vehicle_number' ? value.toUpperCase() : value
            };
            return next;
        });
    };

    const handleVehiclePhotoChange = (index, file) => {
        if (!file) return;
        setVehiclesList(prev => {
            const next = [...prev];
            next[index] = {
                ...next[index],
                vehicle_photo: file,
                preview: URL.createObjectURL(file)
            };
            return next;
        });
    };

    const handleOpenVehicleCamera = (index) => {
        setActiveVehicleCameraIndex(index);
        setShowCamera(true);
    };

    const handleVehicleCameraCapture = (file) => {
        if (activeVehicleCameraIndex !== null && file) {
            handleVehiclePhotoChange(activeVehicleCameraIndex, file);
        }
        setShowCamera(false);
        setActiveVehicleCameraIndex(null);
    };

    const handleRemoveVehicle = (index) => {
        setVehiclesList(prev => prev.filter((_, i) => i !== index));
    };

    const handleRemoveVehiclePhoto = (index) => {
        setVehiclesList(prev => {
            const next = [...prev];
            next[index] = {
                ...next[index],
                vehicle_photo: null,
                preview: null
            };
            return next;
        });
    };

    // Quick Add Modals state
    const [showGateModal, setShowGateModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showTagModal, setShowTagModal] = useState(false);
    const [showDepartmentModal, setShowDepartmentModal] = useState(false);
    const [newDepartment, setNewDepartment] = useState({ name: '', code: '' });
    const [showOfficialModal, setShowOfficialModal] = useState(false);
    const [newOfficial, setNewOfficial] = useState({ first_name: '', last_name: '', email: '', phone: '', department: '' });
    const [loadingModal, setLoadingModal] = useState(false);
    const currentSelectControlRef = useRef(null);
    const formRef = useRef(null);

    const handleCreateDepartment = async (e) => {
        e.preventDefault();
        if (!newDepartment.name.trim()) {
            Swal.fire('Error', 'Department name is required', 'warning');
            return;
        }
        try {
            setLoadingModal(true);
            const created = await createDepartment({ ...newDepartment, is_active: true });
            const updatedDepts = await getDepartments();
            setDepartments(updatedDepts);
            setFormData(prev => ({ ...prev, department: created.id }));
            setShowDepartmentModal(false);
            setNewDepartment({ name: '', code: '' });
            Swal.fire({ icon: 'success', title: 'Department Added', timer: 1500, showConfirmButton: false });
        } catch (error) {
            Swal.fire('Error', 'Failed to create department', 'error');
        } finally {
            setLoadingModal(false);
        }
    };

    const handleCreateOfficial = async (e) => {
        e.preventDefault();
        if (!newOfficial.first_name.trim() || !newOfficial.email.trim()) {
            Swal.fire('Error', 'First Name and Email are required', 'warning');
            return;
        }
        try {
            setLoadingModal(true);
            const empData = new FormData();
            empData.append('first_name', newOfficial.first_name);
            empData.append('last_name', newOfficial.last_name || '');
            empData.append('email', newOfficial.email);
            empData.append('phone', newOfficial.phone || '');
            if (newOfficial.department || formData.department) {
                empData.append('department', newOfficial.department || formData.department);
            }
            const created = await createUser(empData);
            const updatedEmployees = await getUsers();
            setEmployees(updatedEmployees);
            setFormData(prev => ({ ...prev, employee: created.id }));
            setShowOfficialModal(false);
            setNewOfficial({ first_name: '', last_name: '', email: '', phone: '', department: '' });
            Swal.fire({ icon: 'success', title: 'Official Added', timer: 1500, showConfirmButton: false });
        } catch (error) {
            Swal.fire('Error', 'Failed to create official', 'error');
        } finally {
            setLoadingModal(false);
        }
    };


    // Fetch History
    useEffect(() => {
        const fetchHistory = async () => {
            if (!visitorData && selectedVehicles.length === 0) {
                setEngagementHistory([]);
                return;
            }
            try {
                setLoadingHistory(true);
                if (visitorData && entryMode === 'visitor') {
                    const response = await getGateEntries({ visitor: visitorData.id });
                    setEngagementHistory(response.results || response || []);
                } else if (selectedVehicles.length > 0 && entryMode === 'vehicle') {
                    // For history, just use the first vehicle selected
                    const response = await getVehicleEntries({ vehicle: selectedVehicles[0].id });
                    setEngagementHistory(response.results || response || []);
                }
            } catch (error) {
                console.error("Error fetching history", error);
                setEngagementHistory([]);
            } finally {
                setLoadingHistory(false);
            }
        };
        fetchHistory();
    }, [visitorData, selectedVehicles, entryMode]);

    useEffect(() => {
        fetchMasterData();
        if (appointmentId) {
            loadAppointmentData(appointmentId);
        } else {
            // Focus Search Mobile on mount
            setTimeout(() => {
                const mobileInput = document.getElementById('searchMobileInput');
                if (mobileInput) mobileInput.focus();
            }, 100);
        }
    }, [appointmentId]);

    // Global Enter handler for SweetAlert dialogs (Swal renders outside the form tree)
    useEffect(() => {
        const onGlobalKeyDown = (e) => {
            if (e.key !== 'Enter') return;
            const swalContainer = document.querySelector('.swal2-container');
            if (!swalContainer) return;
            e.preventDefault();
            e.stopPropagation();
            const confirmBtn = swalContainer.querySelector('.swal2-confirm');
            if (confirmBtn) confirmBtn.click();
        };
        document.addEventListener('keydown', onGlobalKeyDown, true); // capture phase
        return () => document.removeEventListener('keydown', onGlobalKeyDown, true);
    }, []);

    // Global Hardware Barcode Scanner Listener (captures rapid wedge keystrokes anywhere on page)
    useEffect(() => {
        let barcodeBuffer = '';
        let lastKeyTime = Date.now();

        const handleGlobalBarcodeKeyDown = (e) => {
            const activeTag = document.activeElement ? document.activeElement.tagName : '';
            const isSearchInput = document.activeElement && document.activeElement.id === 'searchMobileInput';
            if (activeTag === 'TEXTAREA' || (activeTag === 'INPUT' && !isSearchInput)) {
                return;
            }

            const currentTime = Date.now();
            if (currentTime - lastKeyTime > 150) {
                barcodeBuffer = '';
            }
            lastKeyTime = currentTime;

            if (e.key === 'Enter') {
                if (barcodeBuffer.length >= 3) {
                    const scannedCode = barcodeBuffer.trim().toUpperCase();
                    barcodeBuffer = '';
                    // If buffer matches employee pattern
                    if (isEmployeeCode(scannedCode)) {
                        e.preventDefault();
                        e.stopPropagation();
                        setMainTab('gate_entry');
                        handleScanEmployee(scannedCode);
                    }
                }
            } else if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                barcodeBuffer += e.key;
            }
        };

        window.addEventListener('keydown', handleGlobalBarcodeKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalBarcodeKeyDown);
    }, [gates, formData.entry_gate, entryMode]);

    useEffect(() => {
        if (editEntry) {
            let initialGeneratedTags = [];
            if (Array.isArray(editEntry.generated_tags_details) && editEntry.generated_tags_details.length > 0) {
                initialGeneratedTags = editEntry.generated_tags_details.map(t => t.id);
            } else if (Array.isArray(editEntry.generated_tags) && editEntry.generated_tags.length > 0) {
                initialGeneratedTags = editEntry.generated_tags.map(t => (typeof t === 'object' ? t.id : t));
            } else if (editEntry.generated_tag && editEntry.tag_number !== 'N/A') {
                initialGeneratedTags = [editEntry.generated_tag];
            }

            setFormData({
                visitor: editEntry.visitor || '',
                entry_gate: editEntry.entry_gate || '',
                department: editEntry.department || '',
                employee: editEntry.employee || '',
                purpose_of_visit: editEntry.purpose_of_visit || '',
                generated_tag: (editEntry.tag_number === 'N/A' || editEntry.tag_code === 'N/A') ? 'N/A' : (editEntry.generated_tag || (initialGeneratedTags[0] || '')),
                generated_tags: initialGeneratedTags,
                narration: editEntry.narration || '',
                tag_number: editEntry.tag_number || '',
                is_permission_required: editEntry.is_permission_required || false,
                tag_category: editEntry.tag_category || '',
                appointment: editEntry.appointment || '',
                company: editEntry.company || editEntry.company_name || editEntry.visitor_company || '',
                driver: editEntry.driver || '',
                purpose: editEntry.purpose || '',
                material_details: editEntry.material_details || '',
                parking_location: editEntry.parking_location || '',
                park_area: editEntry.park_area || '',
                parking_slot: editEntry.parking_slot || '',
                number_of_persons: editEntry.number_of_persons != null ? editEntry.number_of_persons : 1,
                expected_time_of_exit: editEntry.expected_time_of_exit ? (typeof editEntry.expected_time_of_exit === 'string' ? editEntry.expected_time_of_exit.slice(0, 5) : '') : ''
            });
            if (editEntry.visitor_mobile || editEntry.visitor_name) {
                setVisitorData({
                    id: editEntry.visitor,
                    visitor_name: editEntry.visitor_name,
                    mobile_no: editEntry.visitor_mobile,
                    company_name: editEntry.visitor_company || editEntry.company_name,
                    visitor_photo: getFullImageUrl(editEntry.visitor_photo),
                    id_card_photo: getFullImageUrl(editEntry.id_card_photo),
                    is_blacklisted: false
                });
                setSearchMobile(editEntry.visitor_mobile || '');

                if (editEntry.visitor_mobile) {
                    searchVisitorByMobile(editEntry.visitor_mobile)
                        .then(res => {
                            const v = Array.isArray(res) ? res[0] : res;
                            if (v) {
                                setVisitorData(prev => ({
                                    ...prev,
                                    ...v,
                                    visitor_name: v.visitor_name || prev?.visitor_name,
                                    mobile_no: v.mobile_no || prev?.mobile_no,
                                    visitor_photo: v.visitor_photo ? getFullImageUrl(v.visitor_photo) : prev?.visitor_photo,
                                    id_card_photo: v.id_card_photo ? getFullImageUrl(v.id_card_photo) : prev?.id_card_photo
                                }));
                            }
                        })
                        .catch(() => {});
                }
            }
            if (editEntry.vehicles && Array.isArray(editEntry.vehicles)) {
                setVehiclesList(editEntry.vehicles.map(v => {
                    return {
                        id: v.id,
                        vehicle_number: v.vehicle_number || '',
                        driver_name: v.driver_name || '',
                        vehicle_photo: v.vehicle_photo || null,
                        preview: v.vehicle_photo ? getFullImageUrl(v.vehicle_photo) : null
                    };
                }));
            }
            if (editEntry.documents && Array.isArray(editEntry.documents) && editEntry.documents.length > 0) {
                setSupportingDocs(editEntry.documents.map(d => ({
                    id: d.id,
                    file: null,
                    preview: getFullImageUrl(d.document_photo),
                    name: d.document_name || `Document #${d.id}`
                })));
            } else if (editEntry.document_photo) {
                setSupportingDocs([{
                    id: 0,
                    file: null,
                    preview: getFullImageUrl(editEntry.document_photo),
                    name: 'Supporting Document'
                }]);
            }
            if (editEntry.equipment_details && Array.isArray(editEntry.equipment_details) && editEntry.equipment_details.length > 0) {
                setSelectedEquipments(editEntry.equipment_details.map(eq => ({
                    value: eq.id,
                    label: eq.name,
                    image: eq.image ? getFullImageUrl(eq.image) : null,
                    description: eq.description
                })));
            } else if (editEntry.equipments && Array.isArray(editEntry.equipments) && editEntry.equipments.length > 0) {
                const preSelected = equipmentsList
                    .filter(eq => editEntry.equipments.includes(eq.id))
                    .map(eq => ({
                        value: eq.id,
                        label: eq.name,
                        image: eq.image ? getFullImageUrl(eq.image) : null,
                        description: eq.description
                    }));
                setSelectedEquipments(preSelected);
            }
        }
    }, [editEntry, equipmentsList]);

    const loadAppointmentData = async (id) => {
        try {
            setLoading(true);
            setEmployeeScanResult(null);
            const app = await AppointmentService.getAppointment(id);
            if (app) {
                const todayStr = (() => {
                    const d = new Date();
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                })();
                if (app.appointment_date && app.appointment_date !== todayStr) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Appointment Expired',
                        text: `This appointment was scheduled for ${formatDateDMY(app.appointment_date)}, not today. An appointment for today is required for admission.`,
                    });
                    return;
                }

                const isApproveless = approvelessConfigs.some(c =>
                    c.is_active &&
                    String(c.employee) === String(app.concerned_staff) &&
                    (!app.department || String(c.department) === String(app.department))
                );
                const isApproved = app.status === 'approved' || isApproveless;
                setSelectedAppointmentData({
                    ...app,
                    status: isApproved ? 'approved' : app.status
                });
                setBypassApproval(false);
                
                if (app.vehicle) {
                    setVisitorData(null);
                    setSelectedVehicles([]);
                    setFormData(prev => ({
                        ...prev,
                        appointment: app.id,
                        purpose_of_visit: app.purpose_of_visit,
                        department: app.department,
                        employee: app.concerned_staff,
                        is_permission_required: !isApproved
                    }));
                    setSearchMobile(app.vehicle_number);
                    setEntryMode('vehicle');
                    const data = await searchVehicleByNumber(app.vehicle_number);
                    if (Array.isArray(data) && data.length > 0) {
                        selectVehicle(data[0], true);
                    } else if (data) {
                        selectVehicle(data, true);
                    }
                } else {
                    setSelectedVehicles([]);
                    setFormData(prev => ({
                        ...prev,
                        appointment: app.id,
                        visitor_name: app.visitor_name,
                        mobile_no: app.visitor_phone,
                        purpose_of_visit: app.purpose_of_visit,
                        department: app.department,
                        employee: app.concerned_staff,
                        tag_category: app.visitor_category,
                        is_permission_required: !isApproved
                    }));
                    if (app.vehicle_number) {
                        setVehiclesList(prev => {
                            if (prev.length === 0) {
                                return [{
                                    id: null,
                                    vehicle_number: app.vehicle_number.toUpperCase(),
                                    driver_name: '',
                                    vehicle_photo: null,
                                    preview: null
                                }];
                            }
                            return prev;
                        });
                    }
                    setSearchMobile(app.visitor_phone);
                    setEntryMode('visitor');
                    handleSearchVisitorWithCustomMobile(app.visitor_phone);
                }
            }
        } catch (error) {
            console.error("Error loading appointment data", error);
            Swal.fire('Error', 'Failed to load appointment details', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleShowAppointments = async (overrideNumber = null) => {
        const queryNumber = (typeof overrideNumber === 'string')
            ? overrideNumber.trim()
            : (typeof searchMobile === 'string' ? searchMobile.trim() : '');
        try {
            setLoadingAppointments(true);
            setAppointmentModalView('list');
            setAppointmentFilterNumber(queryNumber);
            setShowAppointmentsModal(true);
            const appointments = await AppointmentService.getTodayAppointments(queryNumber);
            setTodayAppointments(appointments || []);
        } catch (error) {
            console.error("Error fetching appointments", error);
            Swal.fire('Error', 'Failed to load appointments', 'error');
        } finally {
            setLoadingAppointments(false);
        }
    };

    const handleSearchVisitorWithCustomMobile = async (mobile) => {
        try {
            setIsSearching(true);
            setEmployeeScanResult(null);
            setSelectedVehicles([]);
            const data = await searchVisitorByMobile(mobile);
            if (Array.isArray(data) && data.length > 1) {
                setSearchResults(data);
                setShowSelectionModal(true);
            } else {
                const visitor = Array.isArray(data) ? data[0] : data;
                if (visitor) {
                    setEmployeeScanResult(null);
                    setSelectedVehicles([]);
                    setEntryMode('visitor');
                    setVisitorData(visitor);
                    setFormData(prev => ({
                        ...prev,
                        visitor: visitor.id
                    }));
                } else {
                    Swal.fire({
                        icon: 'info',
                        title: 'New Visitor',
                        text: 'This visitor is not in our system. Quick register?',
                        showCancelButton: true,
                        confirmButtonText: 'Register',
                    }).then((result) => {
                        if (result.isConfirmed) setShowSpotModal(true);
                    });
                }
            }
        } catch (error) {
            console.error("Auto-search error", error);
        } finally {
            setIsSearching(false);
        }
    };

    const fetchMasterData = async () => {
        try {
            const [gatesData, categoriesData, deptsData, usersData, configsData, equipmentsData, parkAreasData] = await Promise.all([
                getGates(),
                getGateCategories(),
                getDepartments(),
                getUsers(),
                getApprovelessConfigs({ is_active: true }).catch(() => []),
                getEquipments({ is_active: true }).catch(() => []),
                getParkAreas().catch(() => [])
            ]);
            setGates(gatesData);
            setCategories(categoriesData);
            setDepartments(deptsData);
            setEmployees(usersData);
            setApprovelessConfigs(Array.isArray(configsData) ? configsData : (configsData?.results || []));
            setEquipmentsList(Array.isArray(equipmentsData) ? equipmentsData : (equipmentsData?.results || []));
            setParkAreas(Array.isArray(parkAreasData) ? parkAreasData : (parkAreasData?.results || []));
            if (Array.isArray(gatesData) && gatesData.length > 0) {
                setFormData(prev => ({
                    ...prev,
                    entry_gate: prev.entry_gate || gatesData[0].id
                }));
            }
            fetchFastPassData();
        } catch (error) {
            console.error("Error fetching master data", error);
        }
    };

    const handleScanEmployee = async (codeToScan = null) => {
        const rawCode = (codeToScan !== null && typeof codeToScan === 'string') ? codeToScan : searchMobile;
        const empNo = rawCode ? rawCode.trim().toUpperCase() : '';
        if (!empNo) {
            Swal.fire('Warning', 'Please enter or scan an Employment Number (e.g. GND12, EMP890)', 'warning').then(() => {
                const mobileInput = document.getElementById('searchMobileInput');
                if (mobileInput) mobileInput.focus();
            });
            return;
        }

        const gateId = formData.entry_gate || (gates.length > 0 ? gates[0].id : 1);

        try {
            setIsScanningEmployee(true);
            const response = await scanEmployeeGateEntry({
                employment_no: empNo,
                gate_id: gateId
            });

            const action = response.action;
            const entry = response.entry || response.data || {};
            const isCheckIn = action === 'CHECK_IN';

            // Ensure main tab is gate entry
            setMainTab('gate_entry');

            // Clear previous visitor, vehicle, and appointment state so only employee scan result is visible
            setVisitorData(null);
            setSelectedVehicles([]);
            setSelectedAppointmentData(null);
            setEngagementHistory([]);
            setUnclosedEntryState(null);
            setFormData(prev => ({
                ...prev,
                visitor: '',
                company: '',
                driver: ''
            }));

            setEmployeeScanResult({
                action,
                message: response.message,
                entry,
                timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
            });

            // Play sound effect corresponding to Check IN / Check OUT (No card printing for employees)
            if (isCheckIn) {
                playCheckInSound();
            } else {
                playCheckOutSound();
            }

            // Play a pleasant visual confirmation toast
            Swal.fire({
                icon: isCheckIn ? 'success' : 'info',
                title: isCheckIn ? '🟢 Employee Checked IN' : '🔵 Employee Checked OUT',
                html: `
                    <div style="text-align: center; padding: 4px 0;">
                        <h5 style="margin: 0 0 6px 0; font-weight: 700; color: ${isCheckIn ? '#16a34a' : '#2563eb'};">
                            ${entry.employee_name || empNo}
                        </h5>
                        <div style="font-size: 13px; color: #64748b; margin-bottom: 6px;">
                            ID: <strong style="color: #334155;">${entry.employment_no || empNo}</strong> &bull; ${entry.department_name || 'Staff'}
                        </div>
                        ${entry.vehicle_number ? `
                            <div style="display: inline-flex; align-items: center; gap: 6px; background: ${isCheckIn ? '#ecfdf5' : '#f8fafc'}; border: 1px solid ${isCheckIn ? '#a7f3d0' : '#e2e8f0'}; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600; color: ${isCheckIn ? '#065f46' : '#475569'}; margin-bottom: 6px;">
                                <i class="fa fa-car ${isCheckIn ? 'text-success' : 'text-primary'}"></i>
                                Vehicle: <strong>${entry.vehicle_number}</strong> ${isCheckIn ? '(Inside Campus)' : 'Checked OUT'}
                            </div>
                        ` : ''}
                        ${!isCheckIn && entry.stay_duration ? `
                            <div style="display: inline-block; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600; margin-top: 4px;">
                                ⏱️ Stay Duration: ${entry.stay_duration}
                            </div>
                        ` : ''}
                    </div>
                `,
                timer: 3500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });

            // Clear search bar and immediately refocus for fast continuous barcode scanning
            setSearchMobile('');
            setTimeout(() => {
                const mobileInput = document.getElementById('searchMobileInput');
                if (mobileInput) {
                    mobileInput.focus();
                }
            }, 100);

        } catch (error) {
            playErrorSound();
            console.error("Employee scan error:", error);
            const errMsg = error.response?.data?.error || error.response?.data?.detail || `No employee found with ID "${empNo}".`;
            Swal.fire({
                icon: 'error',
                title: 'Employee Not Recognized',
                text: errMsg,
                confirmButtonText: 'OK'
            }).then(() => {
                const mobileInput = document.getElementById('searchMobileInput');
                if (mobileInput) {
                    mobileInput.focus();
                    mobileInput.select();
                }
            });
        } finally {
            setIsScanningEmployee(false);
        }
    };

    const getEmployeeVehicleTypeId = (typesList = gateVehicleTypes) => {
        if (!Array.isArray(typesList) || typesList.length === 0) return '';
        const empType = typesList.find(vt => 
            vt?.name?.toLowerCase().includes('employee') || 
            vt?.name?.toLowerCase() === 'employee vehicle'
        );
        return empType ? String(empType.id) : (typesList[0] ? String(typesList[0].id) : '');
    };

    const handleOpenSwitchVehicleModal = async (entry) => {
        if (!entry) return;
        setTargetEntryForVehicleSwitch(entry);
        setSwitchMode('existing');
        setSelectedExistingVehicleId('');
        setNewSwitchVehicleNumber('');
        setSwitchSetAsPreferred(true);
        setShowSwitchVehicleModal(true);

        if (gateVehicleTypes.length === 0) {
            getVehicleTypes().then(vts => {
                const list = Array.isArray(vts) ? vts : (vts?.results || []);
                setGateVehicleTypes(list);
                setNewSwitchVehicleType(getEmployeeVehicleTypeId(list));
            }).catch(() => {});
        } else {
            setNewSwitchVehicleType(getEmployeeVehicleTypeId(gateVehicleTypes));
        }

        const empId = entry.employee || (entry.employment_detail?.user?.employee_profile?.id);
        if (empId) {
            try {
                setLoadingEmpVehicles(true);
                const vList = await getVehiclesByEmployee(empId);
                const arr = Array.isArray(vList) ? vList : (vList?.results || []);
                setEmployeeRegisteredVehicles(arr);
                const otherVehicles = arr.filter(v => v.id !== entry.vehicle_id && v.vehicle_number !== entry.vehicle_number);
                if (otherVehicles.length > 0) {
                    setSelectedExistingVehicleId(String(otherVehicles[0].id));
                    setSwitchMode('existing');
                } else if (arr.length > 0) {
                    setSelectedExistingVehicleId(String(arr[0].id));
                    setSwitchMode('existing');
                } else {
                    setSwitchMode('new');
                }
            } catch (e) {
                console.error("Error fetching employee vehicles:", e);
                setEmployeeRegisteredVehicles([]);
                setSwitchMode('new');
            } finally {
                setLoadingEmpVehicles(false);
            }
        } else {
            setEmployeeRegisteredVehicles([]);
            setSwitchMode('new');
        }
    };

    const handleConfirmSwitchVehicle = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!targetEntryForVehicleSwitch) return;

        const payload = {
            set_as_preferred: switchSetAsPreferred
        };

        if (switchMode === 'existing') {
            if (!selectedExistingVehicleId) {
                Swal.fire('Error', 'Please select a vehicle from the list.', 'warning');
                return;
            }
            payload.vehicle_id = selectedExistingVehicleId;
        } else {
            if (!newSwitchVehicleNumber.trim()) {
                Swal.fire('Error', 'Please enter the vehicle number.', 'warning');
                return;
            }
            payload.vehicle_number = newSwitchVehicleNumber.trim().toUpperCase();
            if (newSwitchVehicleType) {
                payload.vehicle_type = newSwitchVehicleType;
            }
        }

        try {
            setSubmittingVehicleSwitch(true);
            const res = await switchEmployeeGateEntryVehicle(targetEntryForVehicleSwitch.id, payload);
            const updatedEntry = res.entry || res.data || {};

            // Update scan result state in-place
            setEmployeeScanResult(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    entry: {
                        ...prev.entry,
                        ...updatedEntry,
                        vehicle_number: updatedEntry.vehicle_number || payload.vehicle_number,
                        is_preferred_vehicle: switchSetAsPreferred,
                        vehicle_type_name: updatedEntry.vehicle_type_name
                    }
                };
            });

            setShowSwitchVehicleModal(false);

            Swal.fire({
                icon: 'success',
                title: 'Vehicle Switched Successfully',
                text: res.message || `Entry updated to ${updatedEntry.vehicle_number || payload.vehicle_number}`,
                timer: 2500,
                showConfirmButton: false
            });

            // Vehicle switched (No card printing for employees)
        } catch (err) {
            console.error("Failed to switch vehicle:", err);
            const errMsg = err.response?.data?.error || err.response?.data?.detail || 'Failed to switch entry vehicle.';
            Swal.fire('Error', errMsg, 'error');
        } finally {
            setSubmittingVehicleSwitch(false);
        }
    };

    const fetchFastPassData = async () => {
        try {
            setLoadingFastPassStatus(true);
            const data = await getFastPassStatus();
            if (data) {
                setFastPassStatusData(data);
            }
        } catch (err) {
            console.error("Error fetching fast-pass status:", err);
        } finally {
            setLoadingFastPassStatus(false);
        }
    };

    const triggerCompanyVehicleCheckout = (vehicleNumber, vehicleType = 'Company Vehicle') => {
        setCompanyVehicleToCheckout({
            vehicle_number: vehicleNumber,
            vehicle_type: vehicleType
        });
        setCheckoutPurpose('other');
        setPurposeNote('');
        setDeliveryNoteNumber('');
        setDeliveryNotePhoto(null);
        setDeliveryNotePreview(null);
        setShowCompanyCheckoutModal(true);
    };

    const handleConfirmCompanyCheckout = async (purposeToUse = null) => {
        const purpose = purposeToUse || checkoutPurpose;
        if (!companyVehicleToCheckout) return;

        if (purpose === 'delivery' && !deliveryNoteNumber.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Delivery Note Required',
                text: 'Please enter the delivery note number before completing checkout.',
                confirmButtonColor: '#0284c7'
            });
            return;
        }

        if (purpose === 'other' && !purposeNote.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Purpose Note Required',
                text: 'Please enter a purpose note before completing checkout.',
                confirmButtonColor: '#0d9488'
            });
            return;
        }

        try {
            setIsSubmittingCheckout(true);
            const gateId = formData.entry_gate || (gates.length > 0 ? gates[0].id : 1);
            
            const payload = {
                vehicle_number: companyVehicleToCheckout.vehicle_number,
                vehicle_type_name: companyVehicleToCheckout.vehicle_type || 'Company Vehicle',
                gate_id: gateId,
                driver_name: fastPassDriver || '',
                force_action: 'CHECK_OUT',
                checkout_purpose: purpose,
                purpose_note: purpose === 'other' ? purposeNote.trim() : '',
                delivery_note_number: purpose === 'delivery' ? deliveryNoteNumber.trim() : '',
                delivery_note_photo: (purpose === 'delivery' && deliveryNotePhoto) ? deliveryNotePhoto : null
            };

            const response = await scanFastPassVehicle(payload);
            
            playCheckOutSound();
            const duration = response.stay_duration || '';
            const vehNum = response.vehicle_number || companyVehicleToCheckout.vehicle_number;

            // Company vehicle checkout completed (No card printing for company vehicles)

            setShowCompanyCheckoutModal(false);
            setCompanyVehicleToCheckout(null);
            setPurposeNote('');
            setDeliveryNoteNumber('');
            setDeliveryNotePhoto(null);
            setDeliveryNotePreview(null);
            setFastPassPlate('');

            Swal.fire({
                icon: 'success',
                title: `Company Vehicle Checked OUT`,
                html: `
                    <div style="text-align: center; padding: 4px 0;">
                        <h4 style="margin: 0 0 6px 0; font-weight: 700; color: #2563eb;">
                            ${vehNum}
                        </h4>
                        <div style="font-size: 13px; color: #64748b; margin-bottom: 6px;">
                            Purpose: <strong style="color: #334155; text-transform: capitalize;">${purpose === 'other' ? 'Other Purpose' : purpose}</strong>
                            ${purpose === 'other' && purposeNote ? `<br/>Purpose Note: <strong style="color: #0d9488;">${purposeNote.trim()}</strong>` : ''}
                            ${purpose === 'delivery' && deliveryNoteNumber ? `<br/>Delivery Note: <strong style="color: #0284c7;">#${deliveryNoteNumber.trim()}</strong>` : ''}
                        </div>
                        ${duration ? `
                            <div style="display: inline-block; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600; margin-top: 4px;">
                                Stay Duration: ${duration}
                            </div>
                        ` : ''}
                    </div>
                `,
                timer: 3500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });

            fetchFastPassData();
        } catch (error) {
            playErrorSound();
            console.error("Error checking out company vehicle:", error);
            const errMsg = error.response?.data?.detail || error.response?.data?.message || 'Failed to check out company vehicle.';
            Swal.fire({
                icon: 'error',
                title: 'Checkout Failed',
                text: errMsg
            });
        } finally {
            setIsSubmittingCheckout(false);
        }
    };

    const handleFastPassScan = async (plateToScan = null, typeOverride = null, forceAction = null) => {
        const rawPlate = (plateToScan !== null && typeof plateToScan === 'string') ? plateToScan : fastPassPlate;
        const plate = rawPlate ? rawPlate.trim().toUpperCase() : '';
        if (!plate) {
            Swal.fire({
                icon: 'warning',
                title: 'Vehicle Number Required',
                text: 'Please enter or click a vehicle plate number (e.g. KL 07 AB 1234)',
                timer: 2500,
                showConfirmButton: false
            }).then(() => {
                const inp = document.getElementById('fastPassPlateInput');
                if (inp) inp.focus();
            });
            return;
        }

        const vtype = typeOverride || fastPassType;
        const gateId = formData.entry_gate || (gates.length > 0 ? gates[0].id : 1);

        // Intercept Company Vehicle checkouts to ask for Purpose (Delivery vs Servicing)
        if (vtype === 'Company Vehicle') {
            const isCurrentlyInside = (fastPassStatusData.inside_vehicles || []).some(iv => 
                iv.vehicle_number && iv.vehicle_number.replace(/\s+/g, '').toUpperCase() === plate.replace(/\s+/g, '').toUpperCase()
            );
            const isCheckingOut = forceAction === 'CHECK_OUT' || (forceAction !== 'CHECK_IN' && isCurrentlyInside);
            if (isCheckingOut) {
                triggerCompanyVehicleCheckout(plate, vtype);
                return;
            }
        }

        try {
            setFastPassLoading(true);
            const response = await scanFastPassVehicle({
                vehicle_number: plate,
                vehicle_type_name: vtype,
                gate_id: gateId,
                driver_name: fastPassDriver || '',
                force_action: forceAction || null
            });

            const action = response.action;
            const isCheckIn = action === 'CHECK_IN';
            const vehicleTypeLabel = response.vehicle_type || vtype;
            const vehNum = response.vehicle_number || plate;
            const duration = response.stay_duration || '';

            // Play sound effect (No card printing for owner / company fleet vehicles)
            if (isCheckIn) {
                playCheckInSound();
            } else {
                playCheckOutSound();
            }

            Swal.fire({
                icon: isCheckIn ? 'success' : 'info',
                title: isCheckIn ? `${vehicleTypeLabel} Checked IN` : `${vehicleTypeLabel} Checked OUT`,
                html: `
                    <div style="text-align: center; padding: 4px 0;">
                        <h4 style="margin: 0 0 6px 0; font-weight: 700; font-family: inherit; color: ${isCheckIn ? '#16a34a' : '#2563eb'};">
                            ${vehNum}
                        </h4>
                        <div style="font-size: 13px; color: #64748b; margin-bottom: 6px;">
                            Category: <strong style="color: #334155;">${vehicleTypeLabel}</strong>
                        </div>
                        ${!isCheckIn && duration ? `
                            <div style="display: inline-block; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600; margin-top: 4px;">
                                Stay Duration: ${duration}
                            </div>
                        ` : ''}
                    </div>
                `,
                timer: 3500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });

            setFastPassPlate('');
            fetchFastPassData();

            setTimeout(() => {
                const inp = document.getElementById('fastPassPlateInput');
                if (inp) inp.focus();
            }, 100);

        } catch (error) {
            playErrorSound();
            console.error("Fast-pass vehicle scan error:", error);
            const errMsg = error.response?.data?.detail || error.response?.data?.message || 'Failed to record vehicle movement.';
            Swal.fire({
                icon: 'error',
                title: 'Vehicle Scan Error',
                text: errMsg,
                confirmButtonText: 'OK'
            }).then(() => {
                const inp = document.getElementById('fastPassPlateInput');
                if (inp) {
                    inp.focus();
                    inp.select();
                }
            });
        } finally {
            setFastPassLoading(false);
        }
    };

    const handleSearch = async () => {
        const trimmed = searchMobile.trim().toUpperCase();
        if (!trimmed) {
            Swal.fire('Error', 'Please enter a mobile number, vehicle number, or employee ID', 'warning');
            return;
        }

        if (mainTab === 'fast_pass') {
            await handleFastPassScan(trimmed);
            return;
        }

        // 1. If it matches known employee prefixes (GLN, EMP, GND), directly scan employee
        if (isEmployeeCode(trimmed)) {
            await handleScanEmployee(trimmed);
            return;
        }

        // 2. If it's a numeric mobile number (10+ digits), search visitor
        if (/^\d{10,}$/.test(trimmed)) {
            setEmployeeScanResult(null);
            setSelectedVehicles([]);
            await handleSearchVisitor();
            return;
        }

        // 3. For any alphanumeric code, check if an employee exists in the system
        try {
            const empLookup = await lookupEmployeeGateEntry(trimmed);
            if (empLookup && empLookup.employment_no) {
                await handleScanEmployee(trimmed);
                return;
            }
        } catch (e) {
            // Not an employee, proceed to vehicle search
        }

        // 4. If it has letters, search vehicle
        if (entryMode === 'vehicle' || /[A-Z]/.test(trimmed)) {
            setEmployeeScanResult(null);
            setVisitorData(null);
            await handleSearchVehicle();
        } else {
            setEmployeeScanResult(null);
            setSelectedVehicles([]);
            await handleSearchVisitor();
        }
    };

    const handleSearchVehicle = async () => {
        const trimmedVehicle = searchMobile.trim();
        if (trimmedVehicle.length < 3) {
            Swal.fire('Error', 'Please enter a valid vehicle number', 'warning').then(() => {
                const mobileInput = document.getElementById('searchMobileInput');
                if (mobileInput) mobileInput.focus();
            });
            return;
        }

        try {
            setIsSearching(true);
            setEmployeeScanResult(null);
            setVisitorData(null);
            const data = await searchVehicleByNumber(trimmedVehicle);

            if (Array.isArray(data) && data.length > 1) {
                // Not expected for exact vehicle number, but just in case
                selectVehicle(data[0]);
            } else {
                const vehicle = Array.isArray(data) ? data[0] : data;
                if (vehicle) {
                    selectVehicle(vehicle);
                } else {
                    throw new Error("Not found");
                }
            }
        } catch (error) {
            console.error("Vehicle search error", error);
            Swal.fire({
                icon: 'error',
                title: 'Not Found',
                text: 'Vehicle not found. Register it now?',
                showCancelButton: true,
                confirmButtonText: 'Yes, Register Now',
                cancelButtonText: 'Cancel',
            }).then((result) => {
                if (result.isConfirmed) {
                    setShowSpotVehicleModal(true);
                } else {
                    const mobileInput = document.getElementById('searchMobileInput');
                    if (mobileInput) mobileInput.focus();
                }
            });
            // vehicle not found, no state to reset
        } finally {
            setIsSearching(false);
        }
    };

    const selectVehicle = async (vehicle, skipAppointmentCheck = false) => {
        // Clear previous employee and visitor state so only vehicle is active
        setEmployeeScanResult(null);
        setVisitorData(null);
        setEntryMode('vehicle');
        setSelectedVehicles([vehicle]);

        const isInternal = isInternalVehicle(vehicle);
        const internalCategory = getInternalVehicleCategory(vehicle);

        setFormData(prev => {
            let nextDriver = prev.driver || '';
            if (vehicle.driver) {
                if (!nextDriver) {
                    nextDriver = vehicle.driver;
                } else if (!nextDriver.split(',').map(s => s.trim().toLowerCase()).includes(vehicle.driver.trim().toLowerCase())) {
                    nextDriver = `${nextDriver}, ${vehicle.driver}`;
                }
            } else if (isInternal && vehicle.employee_name) {
                nextDriver = vehicle.employee_name;
            } else if (internalCategory === 'Owner / Executive Vehicle') {
                nextDriver = 'Owner / Self';
            }

            let nextPurpose = prev.purpose_of_visit;
            if (!nextPurpose) {
                if (internalCategory === 'Employee Vehicle') {
                    nextPurpose = 'Employee Vehicle Entry';
                } else if (internalCategory === 'Company / Fleet Vehicle') {
                    nextPurpose = 'Company Vehicle Movement';
                } else if (internalCategory === 'Owner / Executive Vehicle') {
                    nextPurpose = 'Owner Vehicle Movement';
                }
            }

            let nextCompany = vehicle.company || prev.company;
            if (!nextCompany) {
                if (internalCategory === 'Owner / Executive Vehicle') {
                    nextCompany = 'Executive / Owner';
                } else if (internalCategory === 'Employee Vehicle' || internalCategory === 'Company / Fleet Vehicle') {
                    nextCompany = 'Glenda';
                }
            }

            const nextDept = (vehicle.employee_department_id ? String(vehicle.employee_department_id) : prev.department) || '';
            const nextEmp = (vehicle.employee ? String(vehicle.employee) : prev.employee) || '';

            return {
                ...prev,
                visitor: '',
                company: nextCompany,
                driver: nextDriver,
                employee: nextEmp,
                department: nextDept,
                purpose_of_visit: nextPurpose || prev.purpose_of_visit || '',
                is_permission_required: false,
                generated_tag: isInternal ? (prev.generated_tag || 'N/A') : prev.generated_tag,
                generated_tags: isInternal ? ((prev.generated_tags && prev.generated_tags.length > 0) ? prev.generated_tags : ['N/A']) : prev.generated_tags
            };
        });

        // Authorized internal/employee/company/owner vehicles NEVER require visitor appointments
        if (isInternal) {
            Swal.fire({
                icon: 'success',
                title: 'Vehicle Loaded',
                text: `${vehicle.vehicle_number} (${internalCategory || 'Authorized Vehicle'}) loaded. Gate admission unlocked.`,
                timer: 1800,
                showConfirmButton: false
            });
            return;
        }

        // If explicitly requested to skip, or already linked to an appointment, don't re-trigger appointment lookup loop
        if (skipAppointmentCheck || selectedAppointmentData) {
            return;
        }

        // Auto-check appointments for this visitor vehicle
        try {
            const appts = await AppointmentService.getTodayAppointments(vehicle.vehicle_number);
            if (Array.isArray(appts) && appts.length === 1) {
                await loadAppointmentData(appts[0].id);
                Swal.fire({
                    icon: 'success',
                    title: 'Appointment Linked',
                    text: `Found scheduled appointment for ${vehicle.vehicle_number}.`,
                    timer: 1500,
                    showConfirmButton: false
                });
                return;
            } else if (Array.isArray(appts) && appts.length > 1) {
                handleShowAppointments(vehicle.vehicle_number);
                return;
            }
        } catch (_) {}

        Swal.fire({
            icon: 'info',
            title: 'Vehicle Loaded',
            text: `${vehicle.vehicle_number} loaded. Appointment is required for gate admission.`,
            timer: 2000,
            showConfirmButton: false
        });
    };

    const handleSearchVisitor = async () => {
        const trimmedMobile = searchMobile.trim();
        if (trimmedMobile.length < 10) {
            Swal.fire('Error', 'Please enter a valid mobile number (at least 10 digits)', 'warning').then(() => {
                const mobileInput = document.getElementById('searchMobileInput');
                if (mobileInput) mobileInput.focus();
            });
            return;
        }

        try {
            setIsSearching(true);
            setEmployeeScanResult(null);
            setSelectedVehicles([]);
            setEntryMode('visitor');

            // 1. Check for active unclosed entry or visitor currently inside campus
            try {
                const unclosedRes = await checkUnclosedGateEntry(trimmedMobile);
                if (unclosedRes && unclosedRes.is_currently_inside) {
                    setUnclosedEntryState(unclosedRes);
                } else if (unclosedRes && unclosedRes.has_outstandings) {
                    setUnclosedEntryState(unclosedRes);
                } else {
                    setUnclosedEntryState(null);
                }
            } catch (unclosedCheckErr) {
                console.warn('Could not check unclosed entry:', unclosedCheckErr);
                setUnclosedEntryState(null);
            }

            setIsSearching(true);
            const data = await searchVisitorByMobile(trimmedMobile);

            if (Array.isArray(data) && data.length > 1) {
                setSearchResults(data);
                setShowSelectionModal(true);
            } else {
                const visitor = Array.isArray(data) ? data[0] : data;
                selectVisitor(visitor);
            }
        } catch (error) {
            console.error("Visitor search error", error);
            Swal.fire({
                icon: 'error',
                title: 'Not Found',
                text: 'Visitor not found. Register them now?',
                showCancelButton: true,
                confirmButtonText: 'Yes, Register Now',
                cancelButtonText: 'Cancel',
            }).then((result) => {
                if (result.isConfirmed) {
                    setShowSpotModal(true);
                } else {
                    const mobileInput = document.getElementById('searchMobileInput');
                    if (mobileInput) mobileInput.focus();
                }
            });
            setVisitorData(null);
        } finally {
            setIsSearching(false);
        }
    };

    const selectVisitor = async (visitor) => {
        // Clear previous employee and vehicle state so only visitor is active
        setEmployeeScanResult(null);
        setSelectedVehicles([]);
        setEntryMode('visitor');
        setVisitorData(visitor);
        setBypassApproval(false);
        setFormData(prev => ({
            ...prev,
            visitor: visitor.id,
            department: visitor.department || prev.department
        }));
        setShowSelectionModal(false);

        // Check unclosed entry or if visitor is currently active inside campus
        let hasActiveOutstandings = false;
        try {
            const unclosedRes = await checkUnclosedGateEntry(visitor.mobile_no, visitor.id);
            if (unclosedRes && unclosedRes.is_currently_inside && unclosedRes.active_entry) {
                setUnclosedEntryState(unclosedRes);
                Swal.fire({
                    icon: 'warning',
                    title: 'Visitor Already Inside Campus',
                    html: `<b>${visitor.visitor_name}</b> is currently active inside campus with <b>Entry #${unclosedRes.active_entry.id}</b>.<br/><br/>Pass: <b>#${unclosedRes.active_entry.tag_code || 'N/A'}</b> &bull; ${unclosedRes.active_entry.persons_inside} person(s) inside.<br/><br/><span style="color: #dc2626; font-weight: 600;">They have not exited campus yet. A re-entry pass cannot be created while already inside campus.</span>`,
                    confirmButtonText: 'View Active Entry',
                    showCancelButton: true,
                    cancelButtonText: 'Stay on Form',
                    confirmButtonColor: '#0a500f'
                }).then((r) => {
                    if (r.isConfirmed) {
                        navigate(`/access-point/gate-entries/${unclosedRes.active_entry.id}`);
                    }
                });
                return;
            } else if (unclosedRes && unclosedRes.has_outstandings) {
                setUnclosedEntryState(unclosedRes);
                hasActiveOutstandings = true;
            } else {
                setUnclosedEntryState(null);
            }
        } catch (_) {}

        // Auto-check appointments for this visitor
        try {
            const appts = await AppointmentService.getTodayAppointments(visitor.mobile_no);
            if (Array.isArray(appts) && appts.length === 1) {
                await loadAppointmentData(appts[0].id);
                Swal.fire({
                    icon: 'success',
                    title: 'Appointment Linked',
                    text: `Found scheduled appointment for ${visitor.visitor_name}.`,
                    timer: 1500,
                    showConfirmButton: false
                });
                return;
            } else if (Array.isArray(appts) && appts.length > 1) {
                handleShowAppointments(visitor.mobile_no);
                return;
            }
        } catch (_) {}

        if (hasActiveOutstandings) {
            Swal.fire({
                icon: 'success',
                title: 'Campus Outstandings Detected',
                text: `${visitor.visitor_name} has active campus outstandings. Appointment requirement is waived for re-entry.`,
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            Swal.fire({
                icon: 'info',
                title: 'Visitor Loaded',
                text: `${visitor.visitor_name} loaded. Appointment is required for gate admission.`,
                timer: 1800,
                showConfirmButton: false
            });
        }
    };

    useEffect(() => {
        const fetchTags = async () => {
            try {
                const tags = await getGeneratedTags({ status: 'Available' });
                setAvailableTags(tags);
            } catch (error) {
                console.error("Error fetching tags", error);
            }
        };
        fetchTags();
    }, []);

    const getCurrentTime = () => {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const formatTime12Hour = (timeStr) => {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        const h = parseInt(hours, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const formattedHour = h % 12 || 12;
        return `${String(formattedHour).padStart(2, '0')}:${minutes} ${ampm}`;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        let newFormData = { ...formData, [name]: value };

        if (name === 'expected_time_of_exit' && value) {
            const nowTime = getCurrentTime();
            if (value < nowTime) {
                // Immediately blur input to force the browser to close its native time picker popup
                if (e?.target && typeof e.target.blur === 'function') {
                    e.target.blur();
                }
                if (document.activeElement && typeof document.activeElement.blur === 'function') {
                    document.activeElement.blur();
                }

                newFormData.expected_time_of_exit = '';
                setFormData(newFormData);

                // Small delay lets browser compositor destroy the native picker overlay before SweetAlert opens
                setTimeout(() => {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Invalid Exit Time',
                        html: `Expected Time of Exit cannot be in the past (<b>${formatTime12Hour(value)}</b>).<br/><span style="font-size: 13px; color: #64748b; margin-top: 6px; display: inline-block;">Please select a time later than the current time (<b>${formatTime12Hour(nowTime)}</b>).</span>`,
                        confirmButtonColor: '#0a500f',
                        confirmButtonText: 'OK',
                        timer: 2000,
                        timerProgressBar: true,
                        customClass: {
                            confirmButton: 'btn btn-success px-4 py-2'
                        }
                    });
                }, 80);
                return;
            }
        }

        if (name === 'department') {
            const dept = departments.find(d => d.id === parseInt(value));
            if (dept) {
                const appNeedsPermission = selectedAppointmentData && selectedAppointmentData.status !== 'approved';
                newFormData.is_permission_required = appNeedsPermission || dept.requires_visitor_approval || false;
            }
        }

        if (name === 'number_of_persons') {
            const count = parseInt(value, 10);
            if (count > 1 && newFormData.generated_tag && newFormData.generated_tag !== 'N/A' && (!newFormData.generated_tags || newFormData.generated_tags.length === 0)) {
                newFormData.generated_tags = [newFormData.generated_tag];
            } else if (count === 1 && newFormData.generated_tags && newFormData.generated_tags.length > 0) {
                newFormData.generated_tag = newFormData.generated_tags[0];
            } else if (count > 0 && Array.isArray(newFormData.generated_tags) && newFormData.generated_tags.length > count) {
                newFormData.generated_tags = newFormData.generated_tags.slice(0, count);
                newFormData.generated_tag = newFormData.generated_tags[0] || '';
            }
        }

        setFormData(newFormData);
    };

    // ── Keyboard navigation (mirrors SubCategoryForm pattern) ──────────────────
    const getFocusable = (container) => {
        // Prefer the stable formRef, then passed container, then fallbacks
        const root = formRef.current
            || container
            || document.querySelector('.gate-entry-form-container')
            || document.querySelector('.modal-body-custom')
            || document;
        return Array.from(
            root.querySelectorAll(
                'input.form-control-custom:not([disabled]):not([readonly]), textarea.form-control-custom:not([disabled]):not([readonly]), .react-select__control, button[type="submit"]:not([disabled])'
            )
        ).filter(el => {
            if (el.offsetParent === null) return false;
            if (el.disabled) return false;
            if (el.classList && el.classList.contains('react-select__control--is-disabled')) return false;
            if (el.classList && el.classList.contains('react-select__control')) {
                const inp = el.querySelector('input');
                if (inp && inp.disabled) return false;
            }
            return true;
        });
    };

    const focusNextFromControl = (control, container) => {
        const all = getFocusable(container);
        const idx = all.indexOf(control);
        if (idx > -1 && idx < all.length - 1) {
            const next = all[idx + 1];
            if (idx === all.length - 2 && next.type === 'submit') {
                next.focus();
            } else if (next.classList && next.classList.contains('react-select__control')) {
                const inp = next.querySelector('input');
                if (inp) inp.focus();
            } else {
                next.focus();
            }
        } else if (idx === all.length - 1) {
            // already on submit button – click it
            all[idx].click();
        }
    };

    // Called by react-select's onKeyDown prop
    const handleSelectKeyDown = (e) => {
        // Record the control element so makeSelectChange can use it
        const control = e.target.closest('.react-select__control');
        if (control) currentSelectControlRef.current = control;

        if (e.key === 'Enter') {
            const menuOpen = !!document.querySelector('.react-select__menu');
            if (!menuOpen) {
                // Menu is closed: manually advance focus
                e.preventDefault();
                const formEl = e.target.closest('form');
                if (control) focusNextFromControl(control, formEl);
            }
            // If menu IS open, react-select handles selection; onChange will advance
        }
    };

    const handleSelectFocus = (e) => {
        const control = e.target.closest
            ? e.target.closest('.react-select__control')
            : null;
        if (control) currentSelectControlRef.current = control;
    };

    // Form-level onKeyDown – handles regular inputs + swal (textareas have their own handler)
    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;

        // If SweetAlert is open, click its confirm button
        const swalContainer = document.querySelector('.swal2-container');
        if (swalContainer) {
            e.preventDefault();
            const okBtn = swalContainer.querySelector('.swal2-confirm');
            if (okBtn) okBtn.click();
            return;
        }

        // Inside a react-select – handled by handleSelectKeyDown
        if (e.target.closest('.react-select')) return;

        // Textareas are handled by handleTextareaKeyDown below
        if (e.target.tagName === 'TEXTAREA') return;

        const all = getFocusable();
        const index = all.indexOf(document.activeElement);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            const next = all[index + 1];
            if (next.type === 'submit') {
                next.focus();
            } else if (next.classList && next.classList.contains('react-select__control')) {
                const inp = next.querySelector('input');
                if (inp) inp.focus();
            } else {
                next.focus();
            }
        } else if (index === all.length - 1 && all[index].type === 'submit') {
            e.preventDefault();
            all[index].click();
        }
    };

    // Textarea-specific Enter handler: Shift+Enter = new line, Enter = advance to next field
    const handleTextareaKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        if (e.shiftKey) return; // allow Shift+Enter to insert a new line
        e.preventDefault();
        const all = getFocusable();
        const index = all.indexOf(e.currentTarget);
        if (index > -1 && index < all.length - 1) {
            const next = all[index + 1];
            if (next.type === 'submit') {
                next.focus();
            } else if (next.classList && next.classList.contains('react-select__control')) {
                const inp = next.querySelector('input');
                if (inp) inp.focus();
            } else {
                next.focus();
            }
        } else if (index === all.length - 1 && all[index].type === 'submit') {
            all[index].click();
        }
    };

    const handleFocusField = (e) => {
        if (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.type === 'text')) {
            e.target.select();
        }
    };

    const handleMobileKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const swalContainer = document.querySelector('.swal2-container');
            if (swalContainer) {
                const okBtn = swalContainer.querySelector('.swal2-confirm');
                if (okBtn) okBtn.click();
                return;
            }
            handleSearch();
        }
    };

    const handleSubmitVehicle = async () => {
        if (selectedVehicles.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please verify and select at least one registered vehicle first.'
            });
            return;
        }

        if (!isAppointmentApproved) {
            Swal.fire({
                icon: 'warning',
                title: 'Approved Appointment Required',
                text: selectedAppointmentData && selectedAppointmentData.status !== 'approved'
                    ? `This appointment is currently ${selectedAppointmentData.status.toUpperCase()} and waiting for host approval. Gate entry requires an approved appointment.`
                    : 'Cannot admit vehicle without an approved appointment. Please ensure the appointment is approved by the host employee.'
            });
            return;
        }

        if (!formData.entry_gate) {
            Swal.fire('Validation Error', 'Arrival Gate is required.', 'warning');
            return;
        }

        if (formData.expected_time_of_exit) {
            const nowTime = getCurrentTime();
            if (formData.expected_time_of_exit < nowTime) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Invalid Exit Time',
                    text: `Expected Time of Exit cannot be in the past (${formatTime12Hour(formData.expected_time_of_exit)}). Current time is ${formatTime12Hour(nowTime)}.`,
                    confirmButtonColor: '#0a500f',
                    confirmButtonText: 'OK',
                    timer: 2000,
                    timerProgressBar: true
                });
                return;
            }
        }
        if (!formData.driver) {
            Swal.fire('Validation Error', 'Driver Name is required.', 'warning');
            return;
        }
        const isInternalFleet = isInternalVehicle(selectedVehicles);
        const vehNumPersons = parseInt(formData.number_of_persons, 10) || 1;
        const isVehTagNA = formData.generated_tag === 'N/A' || (Array.isArray(formData.generated_tags) && formData.generated_tags.includes('N/A')) || (isInternalFleet && (!formData.generated_tag || formData.generated_tag === ''));
        if (!isVehTagNA) {
            const assignedVehTags = (formData.generated_tags || []).filter(t => t && t !== 'N/A');
            const effectiveVehCount = vehNumPersons > 1 
                ? assignedVehTags.length 
                : (assignedVehTags.length > 0 ? assignedVehTags.length : (formData.generated_tag ? 1 : 0));
            if (effectiveVehCount === 0 && !isInternalFleet) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Validation Error',
                    text: 'Gate Pass / Vehicle Tag is required.'
                });
                return;
            }
            if (effectiveVehCount > 0 && effectiveVehCount !== vehNumPersons) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Tag Count Mismatch',
                    text: effectiveVehCount < vehNumPersons
                        ? `You have specified ${vehNumPersons} persons, but selected only ${effectiveVehCount} tag(s). Each person entering campus must receive 1 physical tag (${vehNumPersons} tags required for ${vehNumPersons} people).`
                        : `You have specified ${vehNumPersons} persons, but selected ${effectiveVehCount} tags. Please select exactly ${vehNumPersons} tag(s).`
                });
                return;
            }
        }

        const missingPhotoVehicle = selectedVehicles.find(v => !v.vehicle_photo);
        if (missingPhotoVehicle && !isInternalVehicle(missingPhotoVehicle)) {
            Swal.fire({
                icon: 'warning',
                title: 'Missing Vehicle Photo',
                text: `Vehicle ${missingPhotoVehicle.vehicle_number} is missing a Vehicle Photo. Vehicle photo is mandatory for gate entry.`
            });
            return;
        }

        try {
            setLoading(true);
            const payload = new FormData();
            selectedVehicles.forEach(v => {
                payload.append('vehicles', v.id);
            });
            if (formData.driver) payload.append('driver', formData.driver);
            if (formData.company) payload.append('company', formData.company);
            if (formData.purpose_of_visit) payload.append('purpose', formData.purpose_of_visit.trim());
            if (formData.material_details) payload.append('material_details', formData.material_details);
            if (formData.parking_location) payload.append('parking_location', formData.parking_location);
            if (formData.park_area) payload.append('park_area', formData.park_area);
            if (formData.parking_slot) payload.append('parking_slot', formData.parking_slot);
            if (formData.entry_gate) payload.append('entry_gate', formData.entry_gate);
            payload.append('number_of_persons', parseInt(formData.number_of_persons) || 1);
            if (formData.expected_time_of_exit) payload.append('expected_time_of_exit', formData.expected_time_of_exit);
            if (formData.department) payload.append('department', formData.department);
            if (formData.employee) payload.append('employee', formData.employee);
            if (formData.appointment) payload.append('appointment', formData.appointment);
            if (formData.generated_tag && formData.generated_tag !== 'N/A') payload.append('vehicle_pass', formData.generated_tag);
            const validVehTagIds = (formData.generated_tags || []).filter(t => t && t !== 'N/A');
            if (validVehTagIds.length > 0) {
                payload.append('generated_tags', JSON.stringify(validVehTagIds));
                validVehTagIds.forEach(id => payload.append('generated_tags_ids', id));
            }

            // Multiple supporting documents
            supportingDocs.forEach((doc, idx) => {
                if (doc.file instanceof File || doc.file instanceof Blob) {
                    payload.append('document_photos', doc.file, doc.name || `supporting_doc_${idx + 1}.jpg`);
                }
            });

            const createdRes = await createVehicleEntry(payload);
            const isOwnerOrCompanyOrEmployee = (selectedVehicles || []).some(v => 
                isInternalVehicle(v) ||
                v?.company === 'Owner Vehicle' || 
                v?.vehicle_type === 'Owner Vehicle' || 
                v?.vehicle_type_name === 'Owner Vehicle' || 
                v?.is_owner ||
                v?.company === 'Company Fleet' || 
                v?.company === 'Company Vehicle' || 
                v?.vehicle_type === 'Company Vehicle' || 
                v?.vehicle_type_name === 'Company Vehicle' ||
                v?.vehicle_type === 'Employee Vehicle' || 
                v?.vehicle_type_name === 'Employee Vehicle' ||
                v?.is_employee
            );
            if (!isOwnerOrCompanyOrEmployee) {
                // Automatically print Entry Card via connected printing machine for general/commercial/third-party vehicles
                printEntryCard(createdRes || {
                    vehicle_number: selectedVehicles.map(v => v.vehicle_number).join(', '),
                    park_area_name: parkAreas.find(p => String(p.id) === String(formData.park_area))?.name,
                    parking_slot_number: parkingSlots.find(s => String(s.id) === String(formData.parking_slot))?.slot_number,
                    entry_time: new Date().toISOString()
                });
            }
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Vehicle entry has been recorded.',
                timer: 1500,
                showConfirmButton: false
            });
            if (onSuccess) onSuccess(); else navigate('/access-point/gate-entries');
        } catch (error) {
            console.error("Vehicle Entry Error:", error);
            let errMsg = 'Failed to submit vehicle entry';
            if (error.response?.data) {
                const data = error.response.data;
                if (typeof data === 'string') {
                    errMsg = data;
                } else if (data.detail) {
                    errMsg = data.detail;
                } else if (data.message) {
                    errMsg = data.message;
                } else if (typeof data === 'object') {
                    const messages = Object.entries(data).map(([field, err]) => {
                        const errText = Array.isArray(err) ? err.join(' ') : (typeof err === 'object' ? JSON.stringify(err) : String(err));
                        const fieldName = (field === 'non_field_errors' || field === 'detail') ? '' : `${field.replace(/_/g, ' ')}: `;
                        return `${fieldName}${errText}`;
                    });
                    if (messages.length > 0) {
                        errMsg = messages.join('\n');
                    }
                }
            }
            Swal.fire('Error', errMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        if (entryMode === 'vehicle') {
            await handleSubmitVehicle();
            return;
        }

        if (isApproved && !bypassApproval) {
            Swal.fire({
                icon: 'success',
                title: 'Saved',
                text: 'Gate entry has been finalized.',
                timer: 1500,
                showConfirmButton: false
            });
            if (onSuccess) onSuccess(); else navigate('/access-point/gate-entries');
            return;
        }

        if (!formData.visitor || !visitorData) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please verify and select a registered visitor first.'
            }).then(() => {
                const mobileInput = document.getElementById('searchMobileInput');
                if (mobileInput) mobileInput.focus();
            });
            return;
        }

        if (!visitorData.visitor_photo) {
            Swal.fire({
                icon: 'warning',
                title: 'Missing Visitor Photo',
                text: 'Selected visitor is missing a Visitor Photo. Visitor photo is mandatory for gate entry.'
            });
            return;
        }

        if (!visitorData.id_card_photo) {
            Swal.fire({
                icon: 'warning',
                title: 'Missing ID Proof',
                text: 'Selected visitor is missing ID Card Proof. ID card proof is mandatory for gate entry.'
            });
            return;
        }

        if (currentlyInsideEntry && !editEntry) {
            Swal.fire({
                icon: 'warning',
                title: 'Visitor Already Inside Campus',
                html: `This visitor is currently active inside campus (<b>Entry #${currentlyInsideEntry.id}</b>, Pass: <b>#${currentlyInsideEntry.tag_code || currentlyInsideEntry.tag_number || 'N/A'}</b>).<br/><br/>They have not exited campus yet. A new gate pass cannot be created while already inside campus.`,
                confirmButtonText: 'View Active Entry',
                confirmButtonColor: '#0a500f'
            }).then(() => {
                navigate(`/access-point/gate-entries/${currentlyInsideEntry.id}`);
            });
            return;
        }

        if (!isAppointmentApproved) {
            Swal.fire({
                icon: 'warning',
                title: 'Approved Appointment Required',
                text: selectedAppointmentData && selectedAppointmentData.status !== 'approved'
                    ? `This appointment is currently ${selectedAppointmentData.status.toUpperCase()} and waiting for host approval. Gate entry requires an approved appointment.`
                    : 'Cannot admit visitor without an approved appointment. Please ensure the appointment is approved by the host employee.'
            });
            return;
        }

        if (visitorData.is_blacklisted) {
            Swal.fire({
                icon: 'error',
                title: 'Entry Blocked',
                text: 'This visitor is restricted/blacklisted and cannot be granted gate entry.'
            });
            return;
        }

        if (!formData.entry_gate) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Arrival Gate is required.'
            }).then(() => {
                const gateSelect = document.querySelector('.arrival-gate-select input');
                if (gateSelect) gateSelect.focus();
            });
            return;
        }

        if (formData.expected_time_of_exit) {
            const nowTime = getCurrentTime();
            if (formData.expected_time_of_exit < nowTime) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Invalid Exit Time',
                    text: `Expected Time of Exit cannot be in the past (${formatTime12Hour(formData.expected_time_of_exit)}). Current time is ${formatTime12Hour(nowTime)}.`,
                    confirmButtonColor: '#0a500f',
                    confirmButtonText: 'OK',
                    timer: 2000,
                    timerProgressBar: true
                });
                return;
            }
        }

        if (!formData.department) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Meeting Department is required.'
            }).then(() => {
                const deptSelect = document.querySelector('.department-select input');
                if (deptSelect) deptSelect.focus();
            });
            return;
        }

        if (!formData.employee) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Concerned Official is required.'
            }).then(() => {
                const empSelect = document.querySelector('.employee-select input');
                if (empSelect) empSelect.focus();
            });
            return;
        }

        if (!formData.purpose_of_visit || !formData.purpose_of_visit.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Purpose of Visit is required.'
            }).then(() => {
                const purposeInput = document.getElementById('purpose_of_visit_input');
                if (purposeInput) purposeInput.focus();
            });
            return;
        }

        if (!formData.tag_category && !hasOutstandings) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Tag Category is required.'
            }).then(() => {
                const categorySelect = document.querySelector('.category-select input');
                if (categorySelect) categorySelect.focus();
            });
            return;
        }

        const numPersons = parseInt(formData.number_of_persons, 10) || 1;
        const isTagNA = formData.generated_tag === 'N/A' || (Array.isArray(formData.generated_tags) && formData.generated_tags.includes('N/A'));
        const hasAssignedTag = isTagNA || Boolean(formData.generated_tag) || (Array.isArray(formData.generated_tags) && formData.generated_tags.length > 0);
        if (!hasAssignedTag) {
            Swal.fire({
                icon: 'warning',
                title: 'Tag Assignment Required',
                text: hasOutstandings 
                    ? 'The visitor returned their tag upon previous departure. Please assign a new tag for re-entry.'
                    : (numPersons > 1 
                        ? `Please assign tag(s) for the ${numPersons} entering persons.`
                        : 'Gate Pass / Tag Assignment is required.')
            }).then(() => {
                const tagSelect = document.querySelector('.tag-select input');
                if (tagSelect) tagSelect.focus();
            });
            return;
        }

        // Strict 1:1 validation: each person entering campus must receive exactly 1 physical tag (unless N/A)
        if (!isTagNA) {
            const assignedTags = (formData.generated_tags || []).filter(t => t && t !== 'N/A');
            const effectiveCount = numPersons > 1
                ? assignedTags.length
                : (assignedTags.length > 0 ? assignedTags.length : (formData.generated_tag ? 1 : 0));

            if (effectiveCount !== numPersons) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Tag Count Mismatch',
                    text: effectiveCount < numPersons
                        ? `You have specified ${numPersons} persons, but selected only ${effectiveCount} tag(s). Each person entering campus must receive 1 physical tag (${numPersons} tags required for ${numPersons} people).`
                        : `You have specified ${numPersons} persons, but selected ${effectiveCount} tags. Please select exactly ${numPersons} tag(s).`,
                    background: isDark ? '#1a1a2e' : '#fff',
                    color: isDark ? '#fff' : '#000'
                }).then(() => {
                    const tagSelect = document.querySelector('.tag-select input');
                    if (tagSelect) tagSelect.focus();
                });
                return;
            }
        }

        const incompleteVehicle = vehiclesList.find(v => (!v.vehicle_number || !v.vehicle_number.trim()) && (v.driver_name || v.vehicle_photo));
        if (incompleteVehicle) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please provide a Vehicle Number for each vehicle entry, or remove the empty vehicle row.'
            });
            return;
        }

        const vehicleWithoutPhoto = vehiclesList.find(v => v.vehicle_number && v.vehicle_number.trim() && !v.vehicle_photo);
        if (vehicleWithoutPhoto) {
            Swal.fire({
                icon: 'warning',
                title: 'Missing Vehicle Photo',
                text: `Accompanying vehicle ${vehicleWithoutPhoto.vehicle_number} is missing a vehicle photo. Please capture or upload a photo.`
            });
            return;
        }

        // Check if visitor has accompanied vehicle details
        const hasValidVehicles = vehiclesList.some(v => v.vehicle_number && v.vehicle_number.trim());
        if (!hasValidVehicles && !hasOutstandings) {
            const vehiclePrompt = await Swal.fire({
                title: 'Vehicle Entry',
                text: 'Is there any vehicle entry with this visitor?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Yes',
                cancelButtonText: 'No',
                confirmButtonColor: '#28a745',
                cancelButtonColor: '#6c757d',
                allowOutsideClick: false,
                allowEscapeKey: false
            });

            if (vehiclePrompt.isConfirmed) {
                // If Yes: back to form to fill vehicle details
                if (vehiclesList.length === 0) {
                    handleAddVehicle();
                }
                setTimeout(() => {
                    const vehicleSection = document.getElementById('vehicle-details-section');
                    if (vehicleSection) {
                        vehicleSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        const firstInput = vehicleSection.querySelector('input');
                        if (firstInput) firstInput.focus();
                    }
                }, 150);
                return;
            }
            // If No: continue to save the entry
        }

        try {
            setLoading(true);

            const payload = new FormData();
            payload.append('visitor', formData.visitor);
            payload.append('entry_gate', formData.entry_gate);
            payload.append('department', formData.department);
            payload.append('employee', formData.employee);
            payload.append('purpose_of_visit', formData.purpose_of_visit.trim());

            if (formData.narration) payload.append('narration', formData.narration);
            payload.append('number_of_persons', parseInt(formData.number_of_persons, 10) || 1);
            if (formData.expected_time_of_exit) payload.append('expected_time_of_exit', formData.expected_time_of_exit);
            if (formData.generated_tag) {
                if (formData.generated_tag === 'N/A') {
                    payload.append('tag_number', 'N/A');
                    if (editEntry) {
                        payload.append('generated_tag', '');
                    }
                } else {
                    payload.append('generated_tag', formData.generated_tag);
                    const matchedTag = availableTags.find(t => String(t.id) === String(formData.generated_tag));
                    if (matchedTag) {
                        if (matchedTag.tag_number) payload.append('tag_number', matchedTag.tag_number);
                        if (matchedTag.entry_tag) payload.append('entry_tag', matchedTag.entry_tag);
                    }
                }
            }
            if (formData.tag_category) payload.append('tag_category', formData.tag_category);
            if (formData.appointment) payload.append('appointment', formData.appointment);
            payload.append('is_permission_required', formData.is_permission_required ? 'true' : 'false');
            if (formData.park_area) payload.append('park_area', formData.park_area);
            if (formData.parking_slot) payload.append('parking_slot', formData.parking_slot);

            const validTagIds = (formData.generated_tags || []).filter(t => t && t !== 'N/A');
            if (validTagIds.length > 0) {
                payload.append('generated_tags', JSON.stringify(validTagIds));
                validTagIds.forEach(id => payload.append('generated_tags_ids', id));
            }

            // Accompanying vehicle entries
            const validVehicles = vehiclesList.filter(v => v.vehicle_number && v.vehicle_number.trim());
            const vehiclesMeta = validVehicles.map((v, idx) => {
                const item = {
                    vehicle_number: v.vehicle_number.trim().toUpperCase(),
                    driver_name: v.driver_name ? v.driver_name.trim() : '',
                    photo_key: `vehicle_photo_${idx}`
                };
                if (v.id) item.id = v.id;
                return item;
            });
            payload.append('vehicles_data', JSON.stringify(vehiclesMeta));

            validVehicles.forEach((v, idx) => {
                if (v.vehicle_photo instanceof File || v.vehicle_photo instanceof Blob) {
                    payload.append(`vehicle_photo_${idx}`, v.vehicle_photo);
                }
            });

            // Accompanying tools & equipment entries
            const equipmentIds = (selectedEquipments || []).map(eq => eq.value || eq.id).filter(Boolean);
            payload.append('equipments_data', JSON.stringify(equipmentIds));
            equipmentIds.forEach(id => payload.append('equipments', id));

            if (editEntry) {
                await updateGateEntry(editEntry.id, payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Updated',
                    text: 'Gate entry updated successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
                if (onSuccess) onSuccess(); else navigate('/access-point/gate-entries');
            } else if (hasOutstandings && activeOutstandings?.id) {
                const returningPersons = parseInt(formData.number_of_persons, 10) || 1;
                payload.append('returning_persons', returningPersons);
                payload.append('notes', formData.narration || 'Visitor re-entered campus (resumed unclosed entry)');

                await resumeGateEntry(activeOutstandings.id, payload);
                playCheckInSound();
                printEntryCard(activeOutstandings);
                await Swal.fire({
                    icon: 'success',
                    title: 'Re-Entry Recorded!',
                    text: `${visitorData.visitor_name} has re-entered campus (${returningPersons} person(s)).`,
                    timer: 2000,
                    showConfirmButton: false,
                    background: isDark ? '#1a1a2e' : '#fff',
                    color: isDark ? '#fff' : '#000'
                });
                if (onSuccess) onSuccess(); else navigate('/access-point/gate-entries');
                return;
            } else {
                const response = await createGateEntry(payload);
                if (response && response.is_permission_required && response.permission_status === 'pending') {
                    // Block the form and start polling for approval status
                    Swal.fire({
                        title: 'Waiting for Approval...',
                        html: 'The concerned official has been notified.<br/>Please wait...',
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        showConfirmButton: false,
                        didOpen: () => {
                            Swal.showLoading();
                            const pollInterval = setInterval(async () => {
                                try {
                                    const entryData = await getGateEntry(response.id);
                                    if (entryData.permission_status === 'approved') {
                                        clearInterval(pollInterval);
                                        printEntryCard(entryData);
                                        Swal.fire({
                                            icon: 'success',
                                            title: 'Approved!',
                                            text: 'Official has approved the entry. Please click Save to finalize.',
                                            timer: 3000,
                                            showConfirmButton: false
                                        }).then(() => {
                                            setIsApproved(true);
                                        });
                                    } else if (entryData.permission_status === 'rejected') {
                                        clearInterval(pollInterval);
                                        Swal.fire({
                                            icon: 'error',
                                            title: 'Rejected',
                                            text: 'Official has rejected the entry.',
                                            showConfirmButton: true
                                        });
                                    }
                                } catch (err) {
                                    console.error('Polling error', err);
                                }
                            }, 3000); // Check every 3 seconds
                            
                            // Attach the interval to the popup so we can clear it if needed
                            Swal.getPopup().pollInterval = pollInterval;
                        },
                        willClose: () => {
                            const popup = Swal.getPopup();
                            if (popup && popup.pollInterval) {
                                clearInterval(popup.pollInterval);
                            }
                        }
                    });
                } else {
                    // Automatically print Entry Card via connected printing machine
                    printEntryCard(response || {
                        visitor_name: visitorData?.visitor_name,
                        vehicle_number: (vehiclesList?.[0]?.vehicle_number) || visitorData?.visitor_name,
                        entry_time: new Date().toISOString(),
                        tag_number: formData.generated_tag,
                        park_area_name: parkAreas.find(p => String(p.id) === String(formData.park_area))?.name,
                        parking_slot_number: parkingSlots.find(s => String(s.id) === String(formData.parking_slot))?.slot_number,
                    });
                    Swal.fire({
                        icon: 'success',
                        title: 'Success',
                        text: 'Gate entry registered successfully',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    if (onSuccess) onSuccess(); else navigate('/access-point/gate-entries');
                }
            }
        } catch (error) {
            console.error("Error creating gate entry", error);
            let errorMsg = 'Failed to register gate entry.';
            const data = error.response?.data;
            if (typeof data === 'string') {
                errorMsg = data;
            } else if (data?.visitor) {
                errorMsg = Array.isArray(data.visitor) ? data.visitor.join(' ') : data.visitor;
            } else if (data?.detail) {
                errorMsg = data.detail;
            } else if (data?.message) {
                errorMsg = data.message;
            } else if (data && typeof data === 'object') {
                const messages = Object.entries(data).map(([field, err]) => {
                    const errText = Array.isArray(err) ? err.join(' ') : (typeof err === 'object' ? JSON.stringify(err) : String(err));
                    const fieldName = (field === 'non_field_errors' || field === 'detail') ? '' : `${field.replace(/_/g, ' ')}: `;
                    return `${fieldName}${errText}`;
                });
                if (messages.length > 0) {
                    errorMsg = messages.join('\n');
                }
            }
            Swal.fire('Validation Error', errorMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    // React-select options
    const gateOptions = gates.map(g => ({
        value: g.id,
        label: g.name || g.gate_no
    }));

    const categoryOptions = [
        { value: '', label: 'Select Category...' },
        ...categories.map(c => ({ value: c.id, label: c.name }))
    ];

    const tagOptions = [
        { value: '', label: 'Select Tag / Pass...' },
        { value: 'N/A', label: 'Not Applicable (N/A)' },
        ...availableTags
            .filter(t => !formData.tag_category || t.category_id === parseInt(formData.tag_category))
            .map(t => ({
                value: t.id,
                label: `${t.tag_type} - ${t.tag_number}`,
                color: t.colour || t.category_colour || (t.entry_tag?.category?.colour_code) || null
            }))
    ];

    if (editEntry && Array.isArray(editEntry.generated_tags_details)) {
        editEntry.generated_tags_details.forEach(gt => {
            if (!tagOptions.some(t => String(t.value) === String(gt.id))) {
                tagOptions.push({
                    value: gt.id,
                    label: `Tag - ${gt.tag_number}`,
                    color: gt.colour
                });
            }
        });
    }

    if (editEntry && editEntry.generated_tag && !tagOptions.some(t => String(t.value) === String(editEntry.generated_tag))) {
        tagOptions.push({
            value: editEntry.generated_tag,
            label: editEntry.tag_code ? `Tag - ${editEntry.tag_code}` : `Tag #${editEntry.generated_tag}`
        });
    }

    if (activeOutstandings && Array.isArray(activeOutstandings.tags_list)) {
        activeOutstandings.tags_list.forEach(gt => {
            if (!tagOptions.some(t => String(t.value) === String(gt.id))) {
                tagOptions.push({
                    value: gt.id,
                    label: `Tag - ${gt.tag_number}`,
                    color: gt.colour
                });
            }
        });
    }

    if (activeOutstandings && activeOutstandings.tag_id && !tagOptions.some(t => String(t.value) === String(activeOutstandings.tag_id))) {
        tagOptions.push({
            value: activeOutstandings.tag_id,
            label: activeOutstandings.tag_code ? `Tag - ${activeOutstandings.tag_code}` : `Tag #${activeOutstandings.tag_id}`
        });
    }

    const departmentOptions = departments.map(d => ({
        value: d.id,
        label: d.name || d.department_name
    }));

    const employeeOptions = employees
        .filter(e => {
            if (!formData.department) return true;
            return e.department && e.department.id === parseInt(formData.department);
        })
        .map(e => ({
            value: e.id,
            label: `${e.first_name} ${e.last_name} [${e.designation ? e.designation.title : 'Official'}]`
        }));

    const equipmentOptions = equipmentsList
        .filter(eq => eq.is_active !== false)
        .map(eq => ({
            value: eq.id,
            label: eq.name,
            image: eq.image ? getFullImageUrl(eq.image) : null,
            code: eq.code,
            description: eq.description
        }));

    if (activeOutstandings && Array.isArray(activeOutstandings.equipments_list)) {
        activeOutstandings.equipments_list.forEach(eq => {
            if (!equipmentOptions.some(opt => String(opt.value) === String(eq.id))) {
                equipmentOptions.push({
                    value: eq.id,
                    label: eq.name,
                    image: eq.image ? getFullImageUrl(eq.image) : null,
                    code: eq.code,
                    description: eq.description
                });
            }
        });
    }

    const hasVehiclePresence = Boolean(
        entryMode === 'vehicle' || 
        (selectedVehicles && selectedVehicles.length > 0) || 
        (vehiclesList && vehiclesList.length > 0)
    );

    const parkAreaOptions = (parkAreas || []).map(pa => {
        const total = pa.total_slots ?? pa.number_of_slots ?? 0;
        const available = pa.available_slots !== undefined ? pa.available_slots : total;
        let availabilityText = '';
        if (total > 0) {
            availabilityText = available === 0
                ? ` (${total} Slots - FULL)`
                : ` (${available} of ${total} Available)`;
        }
        return {
            value: pa.id,
            name: pa.name,
            total,
            available,
            label: `${pa.name}${availabilityText}`
        };
    });

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15, 0.15)' : 'none',
            '&:hover': { borderColor: '#0a500f' },
            borderRadius: '10px',
            fontSize: '14px',
        }),
        menu: base => ({ ...base, zIndex: 9999, fontSize: '0.875rem' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? '#f0fdf4' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    const multiTagSelectStyles = {
        ...selectStyles,
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            maxHeight: '44px',
            borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15, 0.15)' : 'none',
            '&:hover': { borderColor: '#0a500f' },
            borderRadius: '10px',
            fontSize: '13px',
            overflow: 'hidden',
        }),
        valueContainer: (base) => ({
            ...base,
            maxHeight: '40px',
            overflowY: 'auto',
            paddingTop: '2px',
            paddingBottom: '2px',
            flexWrap: 'wrap',
            scrollbarWidth: 'thin',
            scrollbarColor: '#cbd5e1 transparent',
            '&::-webkit-scrollbar': {
                width: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
                backgroundColor: '#cbd5e1',
                borderRadius: '4px',
            },
        }),
        multiValue: (base) => ({
            ...base,
            backgroundColor: isDark ? '#334155' : '#f1f5f9',
            borderRadius: '6px',
            margin: '2px 4px 2px 0',
            maxWidth: 'calc(100% - 6px)',
        }),
        multiValueLabel: (base) => ({
            ...base,
            color: isDark ? '#f8fafc' : '#1e293b',
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 5px',
        }),
        multiValueRemove: (base) => ({
            ...base,
            color: isDark ? '#94a3b8' : '#64748b',
            ':hover': {
                backgroundColor: '#fee2e2',
                color: '#ef4444',
            },
            borderRadius: '0 6px 6px 0',
            padding: '0 3px',
        }),
        indicatorsContainer: (base) => ({
            ...base,
            maxHeight: '40px',
            alignSelf: 'center',
        }),
    };

    const hasEngagementsPanel = !employeeScanResult && (Boolean(visitorData) || (selectedVehicles && selectedVehicles.length > 0));

    const formContent = (
        <div className="gate-entry-form-container" onKeyDown={handleKeyDown}>
            {/* Top Bar: Mode Selector & Active Gate */}
            <div className="d-flex align-items-center justify-content-between gap-3 mb-3 pb-2.5 border-bottom flex-wrap">
                {/* 2 Main Tabs: Gate Entry & Fast Pass */}
                <div 
                    className="d-inline-flex align-items-center p-1 rounded-3"
                    style={{ 
                        background: isDark ? '#1e293b' : '#f1f5f9', 
                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` 
                    }}
                >
                    <button
                        type="button"
                        className="btn btn-sm border-0 d-inline-flex align-items-center"
                        style={{ 
                            borderRadius: '6px', 
                            fontWeight: mainTab === 'gate_entry' ? 600 : 500, 
                            fontSize: '13px', 
                            padding: '6px 16px',
                            background: mainTab === 'gate_entry' ? (isDark ? '#334155' : '#ffffff') : 'transparent',
                            color: mainTab === 'gate_entry' ? '#0a500f' : (isDark ? '#94a3b8' : '#64748b'),
                            boxShadow: mainTab === 'gate_entry' ? '0 1px 3px rgba(10, 80, 15, 0.2)' : 'none',
                            transition: 'all 0.15s ease'
                        }}
                        onClick={() => {
                            setMainTab('gate_entry');
                        }}
                    >
                        <i className={`fa fa-id-card-clip me-2 ${mainTab === 'gate_entry' ? 'text-success' : 'opacity-75'}`}></i> Gate Entry
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm border-0 d-inline-flex align-items-center"
                        style={{ 
                            borderRadius: '6px', 
                            fontWeight: mainTab === 'fast_pass' ? 600 : 500, 
                            fontSize: '13px', 
                            padding: '6px 16px',
                            background: mainTab === 'fast_pass' ? (isDark ? '#334155' : '#ffffff') : 'transparent',
                            color: mainTab === 'fast_pass' ? '#0a500f' : (isDark ? '#94a3b8' : '#64748b'),
                            boxShadow: mainTab === 'fast_pass' ? '0 1px 3px rgba(10, 80, 15, 0.2)' : 'none',
                            transition: 'all 0.15s ease'
                        }}
                        onClick={() => {
                            setMainTab('fast_pass');
                            setEmployeeScanResult(null);
                            fetchFastPassData();
                            setTimeout(() => {
                                const inp = document.getElementById('fastPassPlateInput');
                                if (inp) inp.focus();
                            }, 50);
                        }}
                    >
                        <i className={`fa fa-car-side me-2 ${mainTab === 'fast_pass' ? 'text-success' : 'opacity-75'}`}></i> Fast Pass (Owner / Fleet)
                    </button>
                </div>
            </div>

            {/* Search Bar & Action Toolbar (Only for Gate Entry tab) */}
            {mainTab === 'gate_entry' && (
            <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-2">
                        <Form.Label className="form-label-custom mb-0 fw-semibold" style={{ fontSize: '13px', color: isDark ? '#e2e8f0' : '#334155' }}>
                            {employeeEntryMode === 'face' ? 'Face Recognition Camera Gate Entry' : 'Search Visitor / Vehicle / Employee'} <span className="text-danger ms-1">*</span>
                        </Form.Label>
                        {/* Dual-Mode Selector: Standard Entry (Visitor/Vehicle/Employee) vs Face Recognition Camera */}
                        <div className="d-inline-flex p-0.5 rounded-2 border ms-2" style={{ background: isDark ? '#0f172a' : '#f1f5f9' }}>
                            <button
                                type="button"
                                className={`btn btn-xs py-1 px-2.5 rounded-2 border-0 fw-semibold d-inline-flex align-items-center gap-1.5 transition-all ${employeeEntryMode === 'barcode' ? (isDark ? 'bg-secondary text-white shadow-xs' : 'bg-white text-dark shadow-xs') : 'text-muted'}`}
                                style={{ fontSize: '12px' }}
                                onClick={() => {
                                    setEmployeeEntryMode('barcode');
                                    setEmployeeScanResult(null);
                                    setTimeout(() => {
                                        const input = document.getElementById('searchMobileInput');
                                        if (input) input.focus();
                                    }, 50);
                                }}
                            >
                                <i className={`fa fa-search ${employeeEntryMode === 'barcode' ? 'text-primary' : 'text-muted'}`}></i> Standard Entry (Visitor / Vehicle / Employee)
                            </button>
                            <button
                                type="button"
                                className={`btn btn-xs py-1 px-2.5 rounded-2 border-0 fw-semibold d-inline-flex align-items-center gap-1.5 transition-all ${employeeEntryMode === 'face' ? 'text-white shadow-xs' : 'text-muted'}`}
                                style={{ fontSize: '12px', backgroundColor: employeeEntryMode === 'face' ? '#0a500f' : 'transparent' }}
                                onClick={() => {
                                    setEmployeeEntryMode('face');
                                    setEmployeeScanResult(null);
                                }}
                            >
                                <i className="fa fa-camera"></i> Face Camera
                            </button>
                        </div>
                    </div>

                    {/* Secondary Actions: Clean, standard outline buttons with subtle template accents */}
                    <div className="d-flex align-items-center gap-2">
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5 py-1 px-2.5 shadow-none"
                            style={{ 
                                fontSize: '12px', 
                                borderRadius: '7px', 
                                borderColor: isDark ? '#475569' : '#cbd5e1', 
                                color: isDark ? '#cbd5e1' : '#475569',
                                background: isDark ? '#1e293b' : '#ffffff' 
                            }}
                            onClick={() => {
                                setEmployeeScanResult(null);
                                setShowFaceEnrollModal(true);
                            }}
                            title="Enroll employee facial profile"
                        >
                            <i className="fa fa-user-plus text-primary" style={{ fontSize: '10px' }}></i> 
                            <span>Enroll Face</span>
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5 py-1 px-2.5 shadow-none"
                            style={{ 
                                fontSize: '12px', 
                                borderRadius: '7px', 
                                borderColor: isDark ? '#475569' : '#cbd5e1', 
                                color: isDark ? '#cbd5e1' : '#475569',
                                background: isDark ? '#1e293b' : '#ffffff' 
                            }}
                            onClick={() => {
                                setEmployeeScanResult(null);
                                setSelectedVehicles([]);
                                setEntryMode('visitor');
                                setEmployeeEntryMode('barcode');
                                setShowSpotModal(true);
                            }}
                        >
                            <i className="fa fa-user-plus text-success" style={{ fontSize: '10px' }}></i> 
                            <span>Spot Registration</span>
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5 py-1 px-2.5 shadow-none"
                            style={{ 
                                fontSize: '12px', 
                                borderRadius: '7px', 
                                borderColor: isDark ? '#475569' : '#cbd5e1', 
                                color: isDark ? '#cbd5e1' : '#475569',
                                background: isDark ? '#1e293b' : '#ffffff' 
                            }}
                            onClick={() => {
                                setEmployeeScanResult(null);
                                setVisitorData(null);
                                setEntryMode('vehicle');
                                setEmployeeEntryMode('barcode');
                                setShowSpotVehicleModal(true);
                            }}
                        >
                            <i className="fa fa-truck text-info" style={{ fontSize: '10px' }}></i> 
                            <span>New Vehicle</span>
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5 py-1 px-2.5 shadow-none"
                            style={{ 
                                fontSize: '12px', 
                                borderRadius: '7px', 
                                borderColor: isDark ? '#475569' : '#cbd5e1', 
                                color: isDark ? '#cbd5e1' : '#475569',
                                background: isDark ? '#1e293b' : '#ffffff' 
                            }}
                            onClick={() => {
                                setEmployeeScanResult(null);
                                setEmployeeEntryMode('barcode');
                                handleShowAppointments();
                            }}
                            disabled={loadingAppointments}
                        >
                            {loadingAppointments ? <Spinner size="sm" /> : <i className="fa fa-calendar-alt text-primary" style={{ fontSize: '11px' }}></i>} 
                            <span>Appointments</span>
                        </button>
                        {hasEngagementsPanel && (
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5 py-1 px-2.5 shadow-none"
                                style={{ 
                                    fontSize: '12px', 
                                    borderRadius: '7px', 
                                    borderColor: isDark ? '#475569' : '#cbd5e1', 
                                    color: isDark ? '#cbd5e1' : '#475569',
                                    background: showHistory ? (isDark ? '#334155' : '#e8faf2') : (isDark ? '#1e293b' : '#ffffff')
                                }}
                                onClick={() => setShowHistory(prev => !prev)}
                                title={showHistory ? "Hide Previous Engagements" : "Show Previous Engagements"}
                            >
                                <i className="fa fa-history text-muted" style={{ fontSize: '11px' }}></i>
                                <span>{showHistory ? 'Hide History' : 'History'}</span>
                                {engagementHistory.length > 0 && (
                                    <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle ms-0.5" style={{ fontSize: '10px', padding: '1px 5px' }}>
                                        {engagementHistory.length}
                                    </span>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Conditional View: Face Recognition Camera vs Unified Barcode / Text Input */}
                {employeeEntryMode === 'face' ? (
                    <GateFaceScanner
                        gateId={formData.entry_gate || (gates.length > 0 ? gates[0].id : 1)}
                        isDark={isDark}
                        onScanSuccess={(result) => {
                            setVisitorData(null);
                            setSelectedVehicles([]);
                            setSelectedAppointmentData(null);
                            setEngagementHistory([]);
                            setUnclosedEntryState(null);
                            setSearchMobile('');
                            setEmployeeEntryMode('barcode');
                            setFormData(prev => ({
                                ...prev,
                                visitor: '',
                                company: '',
                                driver: ''
                            }));
                            setEmployeeScanResult(result);
                        }}
                        onOpenEnroll={() => setShowFaceEnrollModal(true)}
                        onClose={() => {
                            setEmployeeEntryMode('barcode');
                            setEmployeeScanResult(null);
                            setTimeout(() => {
                                const input = document.getElementById('searchMobileInput');
                                if (input) input.focus();
                            }, 50);
                        }}
                    />
                ) : (
                    /* Unified Search Input with template green Verify button */
                    <div className="d-flex align-items-center gap-2">
                        <div 
                            className="unified-search-box d-flex align-items-center"
                            style={{ 
                                flex: 1, 
                                minWidth: 0, 
                                height: '38px',
                                borderRadius: '8px',
                                border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                                background: isDark ? '#1e293b' : '#ffffff',
                                paddingLeft: '12px',
                                paddingRight: '12px',
                                cursor: 'text',
                                transition: 'border-color 0.2s, box-shadow 0.2s'
                            }}
                            onClick={() => document.getElementById('searchMobileInput')?.focus()}
                        >
                            <div 
                                style={{ 
                                    color: '#94a3b8', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    marginRight: '10px', 
                                    flexShrink: 0,
                                    fontSize: '14px',
                                    pointerEvents: 'none'
                                }}
                            >
                                <i className={isEmployeeCode(searchMobile) ? "fa fa-id-card text-primary" : entryMode === 'vehicle' ? "fa fa-truck text-info" : "fa fa-search text-muted"}></i>
                            </div>
                            <input
                                id="searchMobileInput"
                                type="text"
                                placeholder="Enter mobile number, vehicle number, or scan employee badge / ID..."
                                value={searchMobile}
                                onChange={(e) => {
                                    const val = e.target.value.toUpperCase();
                                    setSearchMobile(val);
                                    if (isEmployeeCode(val)) {
                                        // Recognized employee ID prefix (GLN, EMP, GND)
                                    } else if (/[A-Z]/.test(val)) {
                                        setEntryMode('vehicle');
                                    } else if (/\d/.test(val)) {
                                        setEntryMode('visitor');
                                    }
                                }}
                                onKeyDown={handleMobileKeyDown}
                                style={{ 
                                    flex: 1,
                                    minWidth: 0,
                                    height: '100%',
                                    border: 'none',
                                    outline: 'none',
                                    padding: '0',
                                    fontSize: '13px', 
                                    background: 'transparent', 
                                    color: isDark ? '#f8fafc' : '#0f172a' 
                                }}
                            />
                        </div>
                        <Button
                            className="d-flex align-items-center gap-1.5 px-3.5 fw-semibold shadow-sm text-white border-0"
                            style={{ 
                                height: '38px', 
                                borderRadius: '8px', 
                                fontSize: '13px', 
                                backgroundColor: '#0a500f' 
                            }}
                            onClick={handleSearch}
                            disabled={isSearching || isScanningEmployee}
                        >
                            {isSearching || isScanningEmployee ? <Spinner size="sm" /> : <i className="fa fa-search opacity-75"></i>} 
                            <span>Verify</span>
                        </Button>
                    </div>
                )}
            </div>
            )}

            {mainTab === 'fast_pass' ? (
                <div className="fast-pass-container mt-2">
                    {/* Action Box */}
                    <div 
                        className="p-3 mb-3 rounded-3"
                        style={{
                            background: isDark ? '#1e293b' : '#f8fafc',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                        }}
                    >
                        {/* Category Segmented Pill Bar */}
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2" style={{ marginBottom: '16px' }}>
                            <div className="d-flex align-items-center gap-2">
                                <span className="text-muted fw-semibold" style={{ fontSize: '13px' }}>Vehicle Category:</span>
                                <div className="p-1 d-inline-flex rounded-2" style={{ background: isDark ? '#0f172a' : '#f1f5f9', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                                    <button
                                        type="button"
                                        className="btn btn-sm border-0 d-inline-flex align-items-center gap-1.5"
                                        style={{
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            fontWeight: fastPassType === 'Owner Vehicle' ? 600 : 500,
                                            padding: '4px 12px',
                                            background: fastPassType === 'Owner Vehicle' ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
                                            color: fastPassType === 'Owner Vehicle' ? '#d97706' : (isDark ? '#94a3b8' : '#64748b'),
                                            boxShadow: fastPassType === 'Owner Vehicle' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                                            transition: 'all 0.15s ease'
                                        }}
                                        onClick={() => {
                                            setFastPassType('Owner Vehicle');
                                            const inp = document.getElementById('fastPassPlateInput');
                                            if (inp) inp.focus();
                                        }}
                                    >
                                        <i className="fa fa-crown text-warning" style={{ fontSize: '11px' }}></i>
                                        <span>Owner Vehicle</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm border-0 d-inline-flex align-items-center gap-1.5"
                                        style={{
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            fontWeight: fastPassType === 'Company Vehicle' ? 600 : 500,
                                            padding: '4px 12px',
                                            background: fastPassType === 'Company Vehicle' ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
                                            color: fastPassType === 'Company Vehicle' ? '#0284c7' : (isDark ? '#94a3b8' : '#64748b'),
                                            boxShadow: fastPassType === 'Company Vehicle' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                                            transition: 'all 0.15s ease'
                                        }}
                                        onClick={() => {
                                            setFastPassType('Company Vehicle');
                                            const inp = document.getElementById('fastPassPlateInput');
                                            if (inp) inp.focus();
                                        }}
                                    >
                                        <i className="fa fa-building text-info" style={{ fontSize: '11px' }}></i>
                                        <span>Company Fleet</span>
                                    </button>
                                </div>
                            </div>
                            <span className="badge rounded-pill bg-light text-muted border px-2.5 py-1" style={{ fontSize: '11px', fontWeight: 500 }}>
                                <i className="fa fa-info-circle me-1" style={{ color: '#0a500f' }}></i>
                                {fastPassType === 'Owner Vehicle' 
                                    ? 'Auto-registers owner car if new. Zero form filling.' 
                                    : 'Registered company vehicles & delivery fleet.'}
                            </span>
                        </div>

                        {/* Search / Scan Input without overlapping icon */}
                        <div className="d-flex align-items-center gap-2 mb-2">
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <Form.Control
                                    id="fastPassPlateInput"
                                    type="text"
                                    placeholder={fastPassType === 'Owner Vehicle' ? "Enter or scan owner vehicle number (e.g. MH 02 AZ 9999)..." : "Enter or scan company vehicle number (e.g. TN 09 AB 1001)..."}
                                    value={fastPassPlate}
                                    onChange={(e) => setFastPassPlate(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleFastPassScan();
                                        }
                                    }}
                                    className="form-control shadow-none"
                                    style={{
                                        height: '38px',
                                        borderRadius: '8px',
                                        borderColor: isDark ? '#334155' : '#cbd5e1',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        letterSpacing: '0.3px',
                                        paddingLeft: '14px',
                                        paddingRight: '14px',
                                        background: isDark ? '#1e293b' : '#ffffff',
                                        color: isDark ? '#f8fafc' : '#0f172a'
                                    }}
                                />
                            </div>
                            <Button
                                className="d-flex align-items-center gap-1.5 px-3.5 fw-semibold shadow-sm text-white border-0"
                                style={{
                                    height: '38px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    backgroundColor: '#0a500f'
                                }}
                                onClick={() => handleFastPassScan()}
                                disabled={fastPassLoading}
                            >
                                {fastPassLoading ? <Spinner size="sm" /> : <i className="fa fa-exchange-alt"></i>}
                                <span>Check In / Out</span>
                            </Button>
                        </div>

                        <div className="d-flex align-items-center justify-content-between text-muted" style={{ fontSize: '12px' }}>
                            <span>
                                <i className="fa fa-lightbulb text-warning me-1"></i> 
                                Press <b>Enter</b> or click <b>Check In / Out</b>. Auto-detects: outside &rarr; <b>IN</b>, inside &rarr; <b>OUT</b>.
                            </span>
                            <span className="badge bg-success-subtle text-success border border-success-subtle py-0.5 px-2" style={{ fontSize: '10px' }}>
                                Instant Toggle
                            </span>
                        </div>

                        {/* Clickable Quick Fleet / Registered Vehicles */}
                        {fastPassType === 'Company Vehicle' && fastPassStatusData.company_vehicles?.length > 0 && (
                            <div className="mt-3 pt-2.5 border-top" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <span className="text-muted fw-semibold" style={{ fontSize: '12px' }}>
                                        <i className="fa fa-bolt text-warning me-1"></i> Quick Select Fleet (Tap to Check In / Out):
                                    </span>
                                </div>
                                <div className="d-flex flex-wrap gap-2">
                                    {fastPassStatusData.company_vehicles.map(v => {
                                        const isInside = fastPassStatusData.inside_vehicles.some(iv => iv.vehicle_number === v.vehicle_number);
                                        return (
                                            <button
                                                key={v.id}
                                                type="button"
                                                className="btn btn-sm d-inline-flex align-items-center gap-1.5 shadow-none py-1 px-2.5"
                                                style={{
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    letterSpacing: '0.3px',
                                                    backgroundColor: isInside ? (isDark ? 'rgba(10, 80, 15, 0.15)' : '#e8faf2') : (isDark ? '#1e293b' : '#ffffff'),
                                                    borderColor: isInside ? '#0a500f' : (isDark ? '#475569' : '#cbd5e1'),
                                                    color: isInside ? '#16a34a' : (isDark ? '#e2e8f0' : '#334155'),
                                                    border: `1px solid ${isInside ? '#0a500f' : (isDark ? '#475569' : '#cbd5e1')}`
                                                }}
                                                onClick={() => handleFastPassScan(v.vehicle_number, 'Company Vehicle')}
                                                title={isInside ? "Currently Inside - Click to Check OUT" : "Currently Outside - Click to Check IN"}
                                            >
                                                <span className="rounded-circle d-inline-block" style={{ width: '6px', height: '6px', backgroundColor: isInside ? '#0a500f' : '#94a3b8' }}></span>
                                                <span>{v.vehicle_number}</span>
                                                {isInside && <span className="badge bg-success-subtle text-success border border-success-subtle py-0 px-1" style={{ fontSize: '10px' }}>Inside</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Clickable Recent Owner Plates */}
                        {fastPassType === 'Owner Vehicle' && fastPassStatusData.recent_owner_vehicles?.length > 0 && (
                            <div className="mt-3 pt-2.5 border-top" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <span className="text-muted fw-semibold" style={{ fontSize: '12px' }}>
                                        <i className="fa fa-history text-primary me-1"></i> Frequent Owner Plates (Tap to Check In / Out):
                                    </span>
                                </div>
                                <div className="d-flex flex-wrap gap-2">
                                    {fastPassStatusData.recent_owner_vehicles.map(v => {
                                        const isInside = fastPassStatusData.inside_vehicles.some(iv => iv.vehicle_number === v.vehicle_number);
                                        return (
                                            <button
                                                key={v.id}
                                                type="button"
                                                className="btn btn-sm d-inline-flex align-items-center gap-1.5 shadow-none py-1 px-2.5"
                                                style={{
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    letterSpacing: '0.3px',
                                                    backgroundColor: isInside ? (isDark ? 'rgba(10, 80, 15, 0.15)' : '#e8faf2') : (isDark ? '#1e293b' : '#ffffff'),
                                                    borderColor: isInside ? '#0a500f' : (isDark ? '#475569' : '#cbd5e1'),
                                                    color: isInside ? '#16a34a' : (isDark ? '#e2e8f0' : '#334155'),
                                                    border: `1px solid ${isInside ? '#0a500f' : (isDark ? '#475569' : '#cbd5e1')}`
                                                }}
                                                onClick={() => handleFastPassScan(v.vehicle_number, 'Owner Vehicle')}
                                                title={isInside ? "Currently Inside - Click to Check OUT" : "Currently Outside - Click to Check IN"}
                                            >
                                                <span className="rounded-circle d-inline-block" style={{ width: '6px', height: '6px', backgroundColor: isInside ? '#0a500f' : '#94a3b8' }}></span>
                                                <span>{v.vehicle_number}</span>
                                                {isInside && <span className="badge bg-success-subtle text-success border border-success-subtle py-0 px-1" style={{ fontSize: '10px' }}>Inside</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Currently Inside Campus Section (1-Tap Exit List) */}
                    <div 
                        className="p-3 mb-4 rounded-3"
                        style={{
                            background: isDark ? '#1e293b' : '#ffffff',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                        }}
                    >
                        <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom flex-wrap gap-2" style={{ borderColor: isDark ? '#334155' : '#f1f5f9' }}>
                            <div className="d-flex align-items-center gap-2">
                                <div 
                                    className="rounded-2 d-flex align-items-center justify-content-center"
                                    style={{
                                        width: '26px',
                                        height: '26px',
                                        background: isDark ? 'rgba(10, 80, 15, 0.15)' : '#e8faf2',
                                        color: '#0a500f',
                                        fontSize: '12px'
                                    }}
                                >
                                    <i className="fa fa-parking"></i>
                                </div>
                                <h6 className="fw-semibold mb-0 text-dark" style={{ fontSize: '14px' }}>
                                    Currently Inside Campus
                                </h6>
                                <span 
                                    className="badge rounded-pill" 
                                    style={{ 
                                        fontSize: '11px', 
                                        fontWeight: 600,
                                        backgroundColor: displayedInsideVehicles.length > 0 ? '#dcfce7' : '#f1f5f9',
                                        color: displayedInsideVehicles.length > 0 ? '#15803d' : '#64748b',
                                        border: `1px solid ${displayedInsideVehicles.length > 0 ? '#86efac' : '#e2e8f0'}`
                                    }}
                                >
                                    {displayedInsideVehicles.length} {displayedInsideVehicles.length === 1 ? 'Vehicle' : 'Vehicles'}
                                </span>
                            </div>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5 py-1 px-2.5 shadow-none"
                                style={{ fontSize: '12px', borderRadius: '6px' }}
                                onClick={fetchFastPassData}
                                disabled={loadingFastPassStatus}
                            >
                                {loadingFastPassStatus ? <Spinner size="sm" /> : <i className="fa fa-sync-alt" style={{ fontSize: '11px' }}></i>}
                                {/* <span>Refresh</span> */}
                            </button>
                        </div>

                        {displayedInsideVehicles.length === 0 ? (
                            <div className="text-center py-4 text-muted" style={{ fontSize: '13px' }}>
                                <i className="fa fa-check-circle text-success opacity-50 d-block mb-2" style={{ fontSize: '26px' }}></i>
                                No {fastPassType === 'Company Vehicle' ? 'Company Fleet' : 'Owner'} vehicles currently parked inside campus.
                            </div>
                        ) : (
                            <Row className="g-2.5">
                                {displayedInsideVehicles.map(item => (
                                    <Col xs={12} sm={6} xl={4} key={item.entry_id}>
                                        <div 
                                            className="h-100 d-flex flex-column justify-content-between position-relative"
                                            style={{
                                                padding: '11px 13px',
                                                background: isDark ? '#1e293b' : '#ffffff',
                                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                borderRadius: '10px',
                                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = isDark ? '#475569' : '#0a500f';
                                                e.currentTarget.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.05)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = isDark ? '#334155' : '#e2e8f0';
                                                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.02)';
                                            }}
                                            onClick={() => {
                                                setFastPassPlate(item.vehicle_number);
                                                const inp = document.getElementById('fastPassPlateInput');
                                                if (inp) {
                                                    inp.focus();
                                                    inp.select?.();
                                                }
                                            }}
                                            title={`Click to select ${item.vehicle_number}`}
                                        >
                                            {/* Top Row: Vehicle Identity & Category Badge */}
                                            <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                                                <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                                                    <div 
                                                        className="d-flex align-items-center justify-content-center flex-shrink-0"
                                                        style={{
                                                            width: '28px',
                                                            height: '28px',
                                                            borderRadius: '7px',
                                                            background: item.vehicle_type === 'Owner Vehicle' 
                                                                ? (isDark ? 'rgba(217, 119, 6, 0.15)' : '#fef3c7') 
                                                                : (isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe'),
                                                            color: item.vehicle_type === 'Owner Vehicle' ? '#d97706' : '#0284c7',
                                                            fontSize: '12px'
                                                        }}
                                                    >
                                                        <i className={item.vehicle_type === 'Owner Vehicle' ? "fa fa-crown" : "fa fa-truck"}></i>
                                                    </div>
                                                    <span 
                                                        className="fw-bold" 
                                                        style={{ 
                                                            fontSize: '14px', 
                                                            letterSpacing: '0.4px',
                                                            color: isDark ? '#f8fafc' : '#0f172a'
                                                        }}
                                                    >
                                                        {item.vehicle_number}
                                                    </span>
                                                </div>

                                                <span 
                                                    className="badge flex-shrink-0" 
                                                    style={{ 
                                                        fontSize: '10px', 
                                                        fontWeight: 600,
                                                        padding: '2.5px 7px',
                                                        borderRadius: '8px',
                                                        backgroundColor: item.vehicle_type === 'Owner Vehicle' ? '#fffbeb' : '#f0f9ff',
                                                        color: item.vehicle_type === 'Owner Vehicle' ? '#b45309' : '#0369a1',
                                                        border: `1px solid ${item.vehicle_type === 'Owner Vehicle' ? '#fde68a' : '#bae6fd'}`
                                                    }}
                                                >
                                                    {item.vehicle_type === 'Owner Vehicle' ? 'Owner' : 'Fleet'}
                                                </span>
                                            </div>

                                            {/* Bottom Row: Clean Meta Strip */}
                                            <div 
                                                className="d-flex align-items-center gap-2 flex-wrap pt-1.5" 
                                                style={{ 
                                                    fontSize: '11px', 
                                                    color: isDark ? '#94a3b8' : '#64748b',
                                                    borderTop: `1px dashed ${isDark ? '#334155' : '#f1f5f9'}`
                                                }}
                                            >
                                                <span className="d-inline-flex align-items-center gap-1">
                                                    <i className="fa fa-door-open opacity-50" style={{ fontSize: '10px' }}></i>
                                                    {item.entry_gate_name || 'Main Gate'}
                                                </span>
                                                <span className="text-muted opacity-40">•</span>
                                                <span className="d-inline-flex align-items-center gap-1 text-success fw-medium">
                                                    <i className="fa fa-clock" style={{ fontSize: '10px' }}></i>
                                                    {item.time_inside}
                                                </span>
                                                {item.parking_location_display && (
                                                    <>
                                                        <span className="text-muted opacity-40">•</span>
                                                        <span 
                                                            className="badge d-inline-flex align-items-center gap-1"
                                                            style={{
                                                                fontSize: '10.5px',
                                                                fontWeight: 500,
                                                                padding: '1.5px 6px',
                                                                borderRadius: '5px',
                                                                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#eff6ff',
                                                                color: '#2563eb',
                                                                border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.25)' : '#bfdbfe'}`
                                                            }}
                                                            title={item.parking_location_display}
                                                        >
                                                            <i className="fa fa-parking" style={{ fontSize: '9.5px' }}></i>
                                                            {item.parking_slot_number ? `Slot #${item.parking_slot_number}` : item.parking_location_display}
                                                        </span>
                                                    </>
                                                )}
                                                {item.driver && item.driver !== '—' && item.driver !== 'Owner / Self' && item.driver !== 'Fleet Driver' && (
                                                    <>
                                                        <span className="text-muted opacity-40">•</span>
                                                        <span className="d-inline-flex align-items-center gap-1 text-truncate" style={{ maxWidth: '110px' }} title={`Driver: ${item.driver}`}>
                                                            <i className="fa fa-user opacity-50" style={{ fontSize: '9.5px' }}></i>
                                                            {item.driver}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </Col>
                                ))}
                            </Row>
                        )}
                    </div>
                </div>
            ) : (
                <div className="gate-entry-container mt-2">
                    {/* Active Scan Result Card */}
                    {employeeScanResult && employeeScanResult.entry && !visitorData && (!selectedVehicles || selectedVehicles.length === 0) && (
                        <div 
                            className="p-4 mb-4 rounded-4 shadow-sm"
                            style={{
                                background: employeeScanResult.action === 'CHECK_IN' 
                                    ? (isDark ? 'linear-gradient(135deg, rgba(22, 101, 52, 0.25) 0%, rgba(15, 23, 42, 0.6) 100%)' : 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)')
                                    : (isDark ? 'linear-gradient(135deg, rgba(30, 58, 138, 0.25) 0%, rgba(15, 23, 42, 0.6) 100%)' : 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)'),
                                border: `2px solid ${employeeScanResult.action === 'CHECK_IN' ? '#22c55e' : '#3b82f6'}`,
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <Row className="align-items-center">
                                <Col xs={12} md={3} className="text-center mb-3 mb-md-0">
                                    {employeeScanResult.entry.profile_photo ? (
                                        <img
                                            src={getFullImageUrl(employeeScanResult.entry.profile_photo)}
                                            alt="Employee"
                                            className="rounded-circle shadow-sm"
                                            style={{
                                                width: '100px',
                                                height: '100px',
                                                objectFit: 'cover',
                                                border: `3px solid ${employeeScanResult.action === 'CHECK_IN' ? '#22c55e' : '#3b82f6'}`
                                            }}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                if (e.currentTarget.parentElement) {
                                                    e.currentTarget.parentElement.innerHTML = `<div class="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold mx-auto shadow-sm" style="width: 100px; height: 100px; font-size: 32px; background: ${employeeScanResult.action === 'CHECK_IN' ? '#16a34a' : '#2563eb'}"><i class="fa fa-user"></i></div>`;
                                                }
                                            }}
                                        />
                                    ) : (
                                        <div 
                                            className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold mx-auto shadow-sm"
                                            style={{
                                                width: '100px',
                                                height: '100px',
                                                fontSize: '32px',
                                                background: employeeScanResult.action === 'CHECK_IN' ? '#16a34a' : '#2563eb'
                                            }}
                                        >
                                            <i className="fa fa-user"></i>
                                        </div>
                                    )}
                                    <div className="mt-2">
                                        <span 
                                            className={`badge px-3 py-1 rounded-pill ${employeeScanResult.action === 'CHECK_IN' ? 'bg-success' : 'bg-primary'}`}
                                            style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px' }}
                                        >
                                            {employeeScanResult.action === 'CHECK_IN' ? '🟢 CHECKED IN' : '🔵 CHECKED OUT'}
                                        </span>
                                    </div>
                                </Col>
                                <Col xs={12} md={6}>
                                    <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                        <h4 className="fw-bold mb-0 text-dark" style={{ letterSpacing: '-0.3px' }}>
                                            {employeeScanResult.entry.employee_name}
                                        </h4>
                                        <span 
                                            className="badge bg-dark-subtle text-dark border px-2 py-1" 
                                            style={{ fontSize: '13px', fontWeight: 700 }}
                                        >
                                            ID: {employeeScanResult.entry.employment_no}
                                        </span>
                                        {employeeScanResult.entry.verification_method === 'face' ? (
                                            <span 
                                                className="badge bg-info-subtle text-info border border-info-subtle px-2 py-1 d-inline-flex align-items-center gap-1"
                                                style={{ fontSize: '12px', fontWeight: 600 }}
                                            >
                                                <i className="fa fa-camera"></i> Face Verified
                                                {employeeScanResult.entry.face_match_score !== null && employeeScanResult.entry.face_match_score !== undefined && (
                                                    <span className="opacity-75">
                                                        ({Math.max(0, Math.min(100, Math.round((1 - employeeScanResult.entry.face_match_score) * 100)))}%)
                                                    </span>
                                                )}
                                            </span>
                                        ) : (
                                            <span 
                                                className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-1 d-inline-flex align-items-center gap-1"
                                                style={{ fontSize: '12px', fontWeight: 600 }}
                                            >
                                                <i className="fa fa-barcode"></i> Barcode Scanned
                                            </span>
                                        )}
                                    </div>
                                    <div className="d-flex flex-wrap gap-3 text-muted small mt-2 mb-3">
                                        <span>
                                            <i className="fa fa-building me-1 text-secondary"></i>
                                            <b>Dept:</b> {employeeScanResult.entry.department_name || 'Staff'}
                                        </span>
                                        <span>
                                            <i className="fa fa-id-badge me-1 text-secondary"></i>
                                            <b>Designation:</b> {employeeScanResult.entry.designation_name || 'Employee'}
                                        </span>
                                        {employeeScanResult.entry.phone && (
                                            <span>
                                                <i className="fa fa-phone me-1 text-secondary"></i>
                                                {employeeScanResult.entry.phone}
                                            </span>
                                        )}
                                    </div>

                                    <div 
                                        className="p-3 rounded-3" 
                                        style={{ 
                                            background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.85)', 
                                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` 
                                        }}
                                    >
                                        <Row className="g-2 text-center text-md-start">
                                            <Col sm={4}>
                                                <small className="text-muted d-block" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Gate</small>
                                                <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                                                    <i className="fa fa-door-open me-1 text-success"></i>
                                                    {employeeScanResult.action === 'CHECK_IN' 
                                                        ? (employeeScanResult.entry.entry_gate_name || 'Gate 1')
                                                        : (employeeScanResult.entry.exit_gate_name || employeeScanResult.entry.entry_gate_name || 'Gate 1')}
                                                </span>
                                            </Col>
                                            <Col sm={4}>
                                                <small className="text-muted d-block" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Event Time</small>
                                                <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                                                    <i className="fa fa-clock me-1 text-primary"></i>
                                                    {employeeScanResult.timestamp}
                                                </span>
                                            </Col>
                                            <Col sm={4}>
                                                <small className="text-muted d-block" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                                                    {employeeScanResult.action === 'CHECK_IN' ? 'Campus Status' : 'Stay Duration'}
                                                </small>
                                                <span 
                                                    className="fw-bold" 
                                                    style={{ 
                                                        fontSize: '13px', 
                                                        color: employeeScanResult.action === 'CHECK_IN' ? '#16a34a' : '#2563eb' 
                                                    }}
                                                >
                                                    {employeeScanResult.action === 'CHECK_IN' ? 'Inside Campus' : (employeeScanResult.entry.stay_duration || 'Completed')}
                                                </span>
                                            </Col>
                                        </Row>

                                        {employeeScanResult.entry.vehicle_number ? (
                                            <div 
                                                className="mt-2 pt-2 border-top d-flex align-items-center justify-content-between flex-wrap gap-2"
                                                style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}
                                            >
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="badge bg-light text-dark border fw-bold d-inline-flex align-items-center gap-1.5" style={{ fontSize: '12px', padding: '5px 10px' }}>
                                                        <i className="fa fa-car text-primary"></i>
                                                        {employeeScanResult.entry.vehicle_number}
                                                    </span>
                                                    {employeeScanResult.entry.is_preferred_vehicle && (
                                                        <span 
                                                            className="badge bg-success-subtle text-success border border-success-subtle" 
                                                            style={{ fontSize: '10.5px', padding: '3px 7px' }}
                                                            title="Registered Preferred Vehicle"
                                                        >
                                                            <i className="fa fa-star text-warning me-1"></i> Preferred Vehicle
                                                        </span>
                                                    )}
                                                    {employeeScanResult.entry.vehicle_type_name && (
                                                        <span className="text-muted small" style={{ fontSize: '11px' }}>
                                                            ({employeeScanResult.entry.vehicle_type_name})
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="d-flex align-items-center gap-2">
                                                    {employeeScanResult.entry.parking_details && (
                                                        <span 
                                                            className="badge bg-primary-subtle text-primary border border-primary-subtle d-inline-flex align-items-center gap-1"
                                                            style={{ fontSize: '11px', padding: '3px 8px' }}
                                                            title="Allocated Parking"
                                                        >
                                                            <i className="fa fa-parking"></i>
                                                            {employeeScanResult.entry.parking_details}
                                                        </span>
                                                    )}
                                                    <span 
                                                        className="badge px-2 py-1 rounded-pill"
                                                        style={{ 
                                                            fontSize: '11px',
                                                            background: employeeScanResult.action === 'CHECK_IN' ? '#ecfdf5' : '#eff6ff',
                                                            color: employeeScanResult.action === 'CHECK_IN' ? '#047857' : '#1d4ed8',
                                                            border: `1px solid ${employeeScanResult.action === 'CHECK_IN' ? '#a7f3d0' : '#bfdbfe'}`
                                                        }}
                                                    >
                                                        {employeeScanResult.action === 'CHECK_IN' ? '🚗 Vehicle Inside' : '🚗 Vehicle Checked OUT'}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : employeeScanResult.action === 'CHECK_IN' ? (
                                            <div 
                                                className="mt-2 pt-2 border-top d-flex align-items-center justify-content-between flex-wrap gap-2"
                                                style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}
                                            >
                                                <span className="text-muted small" style={{ fontSize: '11.5px' }}>
                                                    <i className="fa fa-info-circle me-1 text-info"></i> No vehicle linked for this check-in.
                                                </span>
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    className="rounded-pill px-2.5 py-0.5 fw-semibold d-inline-flex align-items-center gap-1 border shadow-sm"
                                                    style={{ fontSize: '11px' }}
                                                    onClick={() => handleOpenSwitchVehicleModal(employeeScanResult.entry)}
                                                >
                                                    <i className="fa fa-plus"></i> Assign Vehicle
                                                </Button>
                                            </div>
                                        ) : null}
                                    </div>
                                </Col>
                                <Col xs={12} md={3} className="text-center text-md-end mt-3 mt-md-0 d-flex flex-column gap-2 align-items-md-end justify-content-center">
                                    <Button 
                                        variant="success" 
                                        size="sm" 
                                        className="rounded-pill px-3 py-1.5 text-white fw-semibold d-inline-flex align-items-center gap-1.5 shadow-sm border-0"
                                        style={{ backgroundColor: '#0a500f', fontSize: '12px' }}
                                        onClick={() => {
                                            setEmployeeScanResult(null);
                                            setEmployeeEntryMode('barcode');
                                            setSearchMobile('');
                                            setTimeout(() => {
                                                const mobileInput = document.getElementById('searchMobileInput');
                                                if (mobileInput) mobileInput.focus();
                                            }, 50);
                                        }}
                                        title="Return to Visitor, Vehicle & Barcode Entry screen"
                                    >
                                        <i className="fa fa-arrow-left"></i> Back to Visitor / Vehicle Entry
                                    </Button>
                                    {employeeEntryMode === 'face' ? (
                                        <Button 
                                            variant="outline-secondary" 
                                            size="sm" 
                                            className="rounded-pill px-3 py-1 d-inline-flex align-items-center gap-1.5"
                                            style={{ 
                                                fontSize: '12px', 
                                                borderColor: isDark ? '#475569' : '#cbd5e1', 
                                                color: isDark ? '#cbd5e1' : '#475569',
                                                background: isDark ? '#1e293b' : '#ffffff' 
                                            }}
                                            onClick={() => {
                                                setEmployeeScanResult(null);
                                            }}
                                            title="Keep camera open to scan next employee"
                                        >
                                            <i className="fa fa-camera"></i> Scan Next Employee
                                        </Button>
                                    ) : (
                                        <Button 
                                            variant="outline-secondary" 
                                            size="sm" 
                                            className="rounded-pill px-3 py-1 d-inline-flex align-items-center gap-1.5"
                                            style={{ 
                                                fontSize: '12px', 
                                                borderColor: isDark ? '#475569' : '#cbd5e1', 
                                                color: isDark ? '#cbd5e1' : '#475569',
                                                background: isDark ? '#1e293b' : '#ffffff' 
                                            }}
                                            onClick={() => {
                                                setEmployeeScanResult(null);
                                                setSearchMobile('');
                                                const mobileInput = document.getElementById('searchMobileInput');
                                                if (mobileInput) mobileInput.focus();
                                            }}
                                        >
                                            <i className="fa fa-check me-1"></i> Dismiss
                                        </Button>
                                    )}
                                </Col>
                            </Row>
                        </div>
                    )}


                {!employeeScanResult && visitorData && (
                    <div 
                        className="mb-3 p-3 rounded-3"
                        style={{
                            background: isDark ? '#1e293b' : '#ffffff',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            position: 'relative'
                        }}
                    >
                        <div className="d-flex align-items-start gap-3 flex-wrap flex-sm-nowrap">
                            {/* Avatar Photo */}
                            <div className="position-relative flex-shrink-0">
                                {visitorData.visitor_photo ? (
                                    <div 
                                        className="rounded-circle overflow-hidden" 
                                        style={{ width: '52px', height: '52px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}
                                    >
                                        <img 
                                            src={getFullImageUrl(visitorData.visitor_photo)} 
                                            alt={visitorData.visitor_name} 
                                            className="w-100 h-100 object-fit-cover" 
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                if (e.currentTarget.parentElement) {
                                                    e.currentTarget.parentElement.innerHTML = '<div class="w-100 h-100 bg-light text-secondary d-flex align-items-center justify-content-center"><i class="fa fa-user fs-5 text-muted"></i></div>';
                                                }
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div 
                                        className="rounded-circle d-flex align-items-center justify-content-center" 
                                        style={{ width: '52px', height: '52px', background: isDark ? '#334155' : '#f1f5f9', color: isDark ? '#94a3b8' : '#64748b', border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}` }}
                                    >
                                        <i className="fa fa-user fs-5"></i>
                                    </div>
                                )}
                            </div>

                            {/* Profile Content */}
                            <div className="flex-grow-1 min-w-0">
                                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: '15px' }}>
                                            {visitorData.visitor_name}
                                        </h5>
                                        <span className="badge bg-light text-secondary border fw-medium px-2 py-0.5" style={{ fontSize: '11px', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                                            <i className="fa fa-building me-1 text-muted"></i>
                                            {visitorData.company_name || 'Individual Visitor'}
                                        </span>
                                        {visitorData.is_blacklisted && (
                                            <span className="badge bg-danger text-white px-2 py-0.5 fw-bold" style={{ fontSize: '11px' }}>
                                                <i className="fa fa-ban me-1"></i> RESTRICTED
                                            </span>
                                        )}
                                    </div>

                                    <div className="d-flex align-items-center gap-2">
                                        {/* ID Card preview thumbnail */}
                                        {visitorData.id_card_photo ? (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5 py-1 px-2.5 shadow-none"
                                                style={{ borderRadius: '7px', fontSize: '12px', borderColor: isDark ? '#475569' : '#d1d5db', color: isDark ? '#cbd5e1' : '#475569' }}
                                                onClick={() => window.open(getFullImageUrl(visitorData.id_card_photo), '_blank')}
                                                title="Click to view full ID card"
                                            >
                                                <img 
                                                    src={getFullImageUrl(visitorData.id_card_photo)} 
                                                    alt="ID" 
                                                    style={{ width: '20px', height: '14px', objectFit: 'cover', borderRadius: '2px' }} 
                                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                />
                                                <span className="fw-medium">View ID</span>
                                                <i className="fa fa-external-link-alt text-muted" style={{ fontSize: '10px' }}></i>
                                            </button>
                                        ) : (
                                            <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1" style={{ fontSize: '11px' }}>
                                                <i className="fa fa-exclamation-triangle me-1"></i> ID Missing
                                            </span>
                                        )}

                                        {/* Change button */}
                                        <Button 
                                            variant="outline-secondary" 
                                            size="sm" 
                                            className="d-flex align-items-center gap-1 py-1 px-2.5 fw-medium shadow-none"
                                            style={{ borderRadius: '7px', fontSize: '12px', borderColor: isDark ? '#475569' : '#d1d5db', color: isDark ? '#cbd5e1' : '#475569' }}
                                            onClick={() => {
                                                setVisitorData(null);
                                                setSelectedAppointmentData(null);
                                                setBypassApproval(false);
                                                setUnclosedEntryState(null);
                                                setFormData(prev => ({ ...prev, visitor: '' }));
                                            }}
                                            title="Clear selected visitor"
                                        >
                                            <i className="fa fa-times text-muted"></i> Change
                                        </Button>
                                    </div>
                                </div>

                                {/* Contact & Meta Strip */}
                                <div className="d-flex align-items-center flex-wrap gap-3 small text-muted mb-2">
                                    <span className="d-flex align-items-center gap-1 text-dark fw-medium">
                                        <i className="fa fa-phone-alt text-muted me-1" style={{ fontSize: '12px' }}></i>
                                        {visitorData.mobile_no}
                                    </span>
                                    {visitorData.email && (
                                        <span><i className="fa fa-envelope text-muted me-1"></i> {visitorData.email}</span>
                                    )}
                                    {engagementHistory.length > 0 && (
                                        <span className="badge bg-light text-secondary border px-2 py-0.5" style={{ fontSize: '11px', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                                            <i className="fa fa-history text-muted me-1"></i> {engagementHistory.length} Past Visit{engagementHistory.length > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>

                                {/* Linked Appointment Pill / Strip */}
                                {selectedAppointmentData && (
                                    <div 
                                        className="p-2 px-3 rounded-2 d-flex align-items-center justify-content-between flex-wrap gap-2 mt-2"
                                        style={{ background: isDark ? '#0f172a' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}
                                    >
                                        <div className="d-flex align-items-center flex-wrap gap-3 small">
                                            <span className="text-secondary d-flex align-items-center gap-1">
                                                <span className="text-muted">Appt</span>
                                                <strong className="text-dark font-monospace">#{selectedAppointmentData.id}</strong>
                                            </span>
                                            <span className="text-secondary d-flex align-items-center gap-1">
                                                <i className="fa fa-clock text-muted"></i>
                                                {selectedAppointmentData.appointment_time || 'Scheduled Today'}
                                            </span>
                                            {selectedAppointmentData.concerned_staff_name && (
                                                <span className="text-secondary d-flex align-items-center gap-1">
                                                    <i className="fa fa-user text-muted"></i>
                                                    Host: <strong className="text-dark">{selectedAppointmentData.concerned_staff_name}</strong>
                                                </span>
                                            )}
                                            {selectedAppointmentData.contact_person_name && (
                                                <span className="text-secondary d-flex align-items-center gap-1">
                                                    <i className="fa fa-address-book text-muted"></i>
                                                    Contact: <strong className="text-dark">{selectedAppointmentData.contact_person_name}</strong>
                                                </span>
                                            )}
                                            {selectedAppointmentData.contact_number && (
                                                <span className="text-secondary d-flex align-items-center gap-1">
                                                    <i className="fa fa-phone text-muted"></i>
                                                    {selectedAppointmentData.contact_number}
                                                </span>
                                            )}
                                        </div>
                                        <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                            <span 
                                                className="rounded-pill d-inline-flex align-items-center gap-1.5"
                                                style={{ 
                                                    fontSize: '11px', 
                                                    fontWeight: 600,
                                                    letterSpacing: '0.4px',
                                                    padding: '3px 10px',
                                                    backgroundColor: (selectedAppointmentData.status === 'approved' || isApprovelessEligible) ? '#dcfce7' : '#fef3c7',
                                                    color: (selectedAppointmentData.status === 'approved' || isApprovelessEligible) ? '#166534' : '#92400e',
                                                    border: `1px solid ${(selectedAppointmentData.status === 'approved' || isApprovelessEligible) ? '#bbf7d0' : '#fde68a'}`,
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                <span 
                                                    className="rounded-circle" 
                                                    style={{ 
                                                        width: '6px', 
                                                        height: '6px', 
                                                        backgroundColor: (selectedAppointmentData.status === 'approved' || isApprovelessEligible) ? '#16a34a' : '#d97706' 
                                                    }}
                                                />
                                                {(selectedAppointmentData.status === 'approved' || isApprovelessEligible) ? 'APPROVED' : (selectedAppointmentData.status ? selectedAppointmentData.status.toUpperCase() : 'PENDING')}
                                            </span>
                                            {isApprovelessEligible && (
                                                <span 
                                                    className="badge light badge-success d-inline-flex align-items-center gap-1"
                                                    style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '12px' }}
                                                    title="Host official is pre-authorized for approveless gate clearance"
                                                >
                                                    <i className="fa fa-user-shield" style={{ fontSize: '10px' }}></i> Approveless
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Warning missing photo or ID */}
                        {(!visitorData.visitor_photo || !visitorData.id_card_photo) && (
                            <div className="mt-2.5 pt-2 border-top text-danger small fw-medium d-flex align-items-center gap-1.5">
                                <i className="fa fa-exclamation-circle text-danger"></i>
                                <span>
                                    {!visitorData.visitor_photo && !visitorData.id_card_photo
                                        ? 'Mandatory Visitor Photo and ID Proof are missing. Please capture or upload before admitting.'
                                        : !visitorData.visitor_photo
                                            ? 'Mandatory Visitor Photo is missing. Please capture a live photo before admitting.'
                                            : 'Mandatory ID Proof is missing. Please upload verification proof before admitting.'}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {!employeeScanResult && !visitorData && selectedVehicles.length > 0 && entryMode === 'vehicle' && (
                    <div className="mb-3">
                        {selectedVehicles.map(vehicle => (
                            <div 
                                key={vehicle.id} 
                                className="p-3 mb-2 rounded-3"
                                style={{
                                    background: isDark ? '#1e293b' : '#ffffff',
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    position: 'relative'
                                }}
                            >
                                <div className="d-flex align-items-center gap-3 flex-wrap flex-sm-nowrap">
                                    <div className="flex-shrink-0">
                                        {vehicle.vehicle_photo ? (
                                            <div 
                                                className="rounded-circle overflow-hidden" 
                                                style={{ width: '52px', height: '52px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}
                                            >
                                                <Image
                                                    src={getFullImageUrl(vehicle.vehicle_photo)}
                                                    className="w-100 h-100 object-fit-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div 
                                                className="rounded-circle d-flex align-items-center justify-content-center" 
                                                style={{ width: '52px', height: '52px', background: isDark ? '#334155' : '#f1f5f9', color: isDark ? '#94a3b8' : '#64748b', border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}` }} 
                                                title="Vehicle Photo Missing"
                                            >
                                                <i className="fa fa-truck fs-5"></i>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-grow-1 min-w-0">
                                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
                                            <div className="d-flex align-items-center flex-wrap gap-2">
                                                <h5 className="mb-0 fw-bold font-monospace text-dark" style={{ fontSize: '15px' }}>
                                                    {vehicle.vehicle_number}
                                                </h5>
                                                {getInternalVehicleCategory(vehicle) && (
                                                    <span className={`badge ${
                                                        getInternalVehicleCategory(vehicle) === 'Employee Vehicle'
                                                            ? 'bg-info-subtle text-info border border-info-subtle'
                                                            : getInternalVehicleCategory(vehicle) === 'Owner / Executive Vehicle'
                                                                ? 'bg-primary-subtle text-primary border border-primary-subtle'
                                                                : 'bg-success-subtle text-success border border-success-subtle'
                                                    } fw-medium px-2 py-0.5`} style={{ fontSize: '11px' }}>
                                                        <i className={`fa ${getInternalVehicleCategory(vehicle) === 'Employee Vehicle' ? 'fa-id-badge' : getInternalVehicleCategory(vehicle) === 'Owner / Executive Vehicle' ? 'fa-crown' : 'fa-truck'} me-1`}></i>
                                                        {getInternalVehicleCategory(vehicle)}
                                                    </span>
                                                )}
                                                {vehicle.company && !getInternalVehicleCategory(vehicle) && (
                                                    <span className="badge bg-light text-secondary border fw-medium px-2 py-0.5" style={{ fontSize: '11px', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                                                        <i className="fa fa-building me-1 text-muted"></i>
                                                        {vehicle.company}
                                                    </span>
                                                )}
                                            </div>
                                            <Button 
                                                variant="outline-secondary" 
                                                size="sm" 
                                                className="d-flex align-items-center gap-1 py-1 px-2.5 fw-medium shadow-none"
                                                style={{ borderRadius: '7px', fontSize: '12px', borderColor: isDark ? '#475569' : '#d1d5db', color: isDark ? '#cbd5e1' : '#475569' }}
                                                onClick={() => {
                                                    setSelectedVehicles(prev => {
                                                        const next = prev.filter(v => v.id !== vehicle.id);
                                                        if (next.length === 0) {
                                                            setFormData(f => ({ ...f, driver: '', company: '' }));
                                                        }
                                                        return next;
                                                    });
                                                }}
                                            >
                                                <i className="fa fa-times text-muted"></i> Remove
                                            </Button>
                                        </div>
                                        <div className="d-flex align-items-center flex-wrap gap-3 small text-muted">
                                            {vehicle.driver && (
                                                <span><i className="fa fa-user me-1 text-muted"></i> Driver: <strong className="text-dark">{vehicle.driver}</strong></span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {!vehicle.vehicle_photo && (
                                    isInternalVehicle(vehicle) ? (
                                        <div className="mt-2 pt-2 border-top text-muted small d-flex align-items-center gap-1.5">
                                            <i className="fa fa-info-circle text-primary"></i>
                                            <span>Vehicle photo not registered (Optional for authorized internal / fleet / owner vehicles)</span>
                                        </div>
                                    ) : (
                                        <div className="mt-2 pt-2 border-top text-danger small fw-medium d-flex align-items-center gap-1">
                                            <i className="fa fa-exclamation-circle"></i>
                                            <span>Mandatory Vehicle Photo is missing for this vehicle. Please update before admitting.</span>
                                        </div>
                                    )
                                )}
                            </div>
                        ))}
                    </div>
                )}

            {!employeeScanResult && employeeEntryMode !== 'face' && (
            isAppointmentApproved ? (
                <Form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown} onFocus={handleFocusField}>
                {currentlyInsideEntry && !editEntry && (
                    <div 
                        style={{
                            background: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                            border: `1.5px solid ${isDark ? '#ef4444' : '#f87171'}`,
                            borderRadius: '10px',
                            padding: '14px 16px',
                            marginBottom: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '12px'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div 
                                style={{ 
                                    width: '40px', 
                                    height: '40px', 
                                    borderRadius: '50%', 
                                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2', 
                                    color: '#dc2626', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    fontSize: '18px',
                                    flexShrink: 0
                                }}
                            >
                                <i className="fa fa-person-circle-check"></i>
                            </div>
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: isDark ? '#f8fafc' : '#991b1b' }}>
                                    {entryMode === 'vehicle' ? 'Vehicle Is Currently Active Inside Campus' : 'Visitor Is Currently Active Inside Campus'}
                                </div>
                                <div style={{ fontSize: '12.5px', color: isDark ? '#cbd5e1' : '#7f1d1d', marginTop: '2px' }}>
                                    <strong>{entryMode === 'vehicle' ? (selectedVehicles[0]?.vehicle_number || currentlyInsideEntry.vehicle_number || 'Vehicle') : (currentlyInsideEntry.visitor_name || visitorData?.visitor_name || 'Visitor')}</strong> is currently on campus (Entry <strong>#{currentlyInsideEntry.id}</strong> &bull; {entryMode === 'vehicle' ? `Driver: ${currentlyInsideEntry.driver || selectedVehicles[0]?.driver || 'N/A'}` : `Pass #${currentlyInsideEntry.tag_code || currentlyInsideEntry.tag_number || 'N/A'}`} &bull; {currentlyInsideEntry.persons_inside || 1} person(s) inside).
                                    <span className="d-block mt-0.5" style={{ color: isDark ? '#f87171' : '#b91c1c', fontWeight: 600 }}>
                                        {entryMode === 'vehicle' ? 'Vehicle has not exited campus yet. Mark exit before creating a new entry.' : 'They have not exited campus yet. A re-entry pass cannot be created while already inside campus.'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <Button 
                                variant="outline-secondary" 
                                size="sm" 
                                onClick={() => navigate(`/access-point/gate-entries/${currentlyInsideEntry.id}`)}
                            >
                                <i className="fa fa-eye me-1"></i> View Entry #{currentlyInsideEntry.id}
                            </Button>
                            <Button 
                                variant="danger" 
                                size="sm" 
                                onClick={() => navigate(`/access-point/gate-entries?status=active&tab=${entryMode === 'vehicle' ? 'vehicles' : 'visitors'}&checkout=${currentlyInsideEntry.id}`)}
                            >
                                <i className="fa fa-arrow-right-from-bracket me-1"></i> Mark Exit
                            </Button>
                        </div>
                    </div>
                )}
                {hasOutstandings && (
                    <div 
                        className="p-3 mb-3 rounded-3"
                        style={{ 
                            background: isDark ? '#1e293b' : '#ffffff', 
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                            borderLeft: `4px solid ${isDark ? '#10b981' : '#059669'}`,
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div 
                                    style={{
                                        width: '38px',
                                        height: '38px',
                                        borderRadius: '8px',
                                        background: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                                        color: isDark ? '#34d399' : '#059669',
                                        border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0'}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '16px',
                                        flexShrink: 0
                                    }}
                                >
                                    <i className="fa fa-door-open"></i>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '14px', fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a', letterSpacing: '0.1px' }}>
                                            Campus Re-Entry Authorized
                                        </span>
                                        <span 
                                            style={{ 
                                                fontSize: '10.5px', 
                                                fontWeight: 700,
                                                letterSpacing: '0.4px',
                                                padding: '2px 8px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7',
                                                color: isDark ? '#34d399' : '#166534',
                                                border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.3)' : '#bbf7d0'}`,
                                                borderRadius: '20px',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            <span 
                                                style={{ 
                                                    width: '6px', 
                                                    height: '6px', 
                                                    borderRadius: '50%', 
                                                    backgroundColor: isDark ? '#34d399' : '#16a34a',
                                                    display: 'inline-block'
                                                }}
                                            />
                                            PRE-AUTHORIZED RE-ENTRY
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '2px' }}>
                                        Outstanding vehicle/tools on campus (0 persons inside) • Physical pass surrendered upon exit • Issue new tag for re-admission
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div 
                            style={{ 
                                background: isDark ? '#0f172a' : '#f8fafc', 
                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                borderRadius: '8px',
                                padding: '8px 12px',
                                marginTop: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '8px'
                            }}
                        >
                            <div 
                                style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '6px', 
                                    fontSize: '11px', 
                                    fontWeight: 700, 
                                    color: isDark ? '#94a3b8' : '#64748b', 
                                    textTransform: 'uppercase', 
                                    letterSpacing: '0.5px'
                                }}
                            >
                                <i className="fa fa-boxes" style={{ color: '#d97706', fontSize: '12px' }}></i>
                                <span>On Campus:</span>
                            </div>

                            {activeOutstandings?.remaining_vehicles?.length > 0 && (
                                <div 
                                    style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '6px', 
                                        padding: '4px 10px', 
                                        borderRadius: '6px',
                                        background: isDark ? '#1e293b' : '#ffffff', 
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
                                    }}
                                >
                                    <i className="fa fa-car text-warning" style={{ fontSize: '12px' }}></i>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b' }}>Vehicle:</span>
                                    <span 
                                        className="font-monospace" 
                                        style={{ 
                                            color: isDark ? '#fbbf24' : '#b45309', 
                                            fontWeight: 700, 
                                            fontSize: '12px',
                                            letterSpacing: '0.3px'
                                        }}
                                    >
                                        {activeOutstandings.remaining_vehicles.join(', ')}
                                    </span>
                                </div>
                            )}

                            {activeOutstandings?.equipments && (
                                <div 
                                    style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '6px', 
                                        padding: '4px 10px', 
                                        borderRadius: '6px',
                                        background: isDark ? '#1e293b' : '#ffffff', 
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
                                    }}
                                >
                                    <i className="fa fa-tools text-primary" style={{ fontSize: '12px' }}></i>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b' }}>Equipment:</span>
                                    <span 
                                        style={{ 
                                            color: isDark ? '#93c5fd' : '#1d4ed8', 
                                            fontWeight: 600, 
                                            fontSize: '12px' 
                                        }}
                                    >
                                        {activeOutstandings.equipments}
                                    </span>
                                </div>
                            )}

                            <div 
                                style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '6px', 
                                    padding: '4px 10px', 
                                    borderRadius: '6px',
                                    background: isDark ? '#1e293b' : '#ffffff', 
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
                                }}
                            >
                                <i className="fa fa-id-badge text-success" style={{ fontSize: '12px' }}></i>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b' }}>Pass:</span>
                                <span 
                                    className="badge bg-success-subtle text-success border border-success-subtle" 
                                    style={{ 
                                        fontSize: '11px', 
                                        fontWeight: 700,
                                        padding: '2px 6px'
                                    }}
                                >
                                    <i className="fa fa-check me-1"></i>Returned (Issue New Tag)
                                </span>
                            </div>
                        </div>
                    </div>
                )}
                {bypassApproval && (
                    <div 
                        className="d-flex align-items-center justify-content-between p-2.5 mb-3 rounded-2 shadow-xs"
                        style={{ 
                            backgroundColor: '#ecfdf5', 
                            border: '1px solid #a7f3d0', 
                            color: '#065f46',
                            fontSize: '13px' 
                        }}
                    >
                        <div className="d-flex align-items-center gap-2">
                            <i className="fa fa-shield-alt text-success fs-5"></i>
                            <span>
                                <strong>Approveless Entry Clearance Active:</strong> Admitting visitor/vehicle directly without host authorization.
                            </span>
                        </div>
                        <Badge bg="success" className="px-2 py-1">Approveless Clearance</Badge>
                    </div>
                )}
                <div className="mb-3 border-bottom pb-2">
                    <span className="small text-muted text-uppercase fw-bold" style={{ letterSpacing: '0.5px' }}>Entry Information</span>
                </div>

                {/* Row 1: Arrival Gate, Expected Time of Exit & Number of Persons */}
                <Row className="mb-3">
                    <Col md={6}>
                        <Form.Group className="mb-3">
                            <Form.Label className="form-label-custom">Arrival Gate <span className="text-danger ms-1">*</span></Form.Label>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Select
                                        className="arrival-gate-select react-select-container"
                                        classNamePrefix="react-select"
                                        styles={selectStyles}
                                        options={gateOptions}
                                        value={gateOptions.find(o => String(o.value) === String(formData.entry_gate)) || null}
                                        onChange={(selected) => {
                                            handleChange({
                                                target: {
                                                    name: 'entry_gate',
                                                    value: selected ? selected.value : ''
                                                }
                                            });
                                            const ctrl = currentSelectControlRef.current;
                                            const formEl = ctrl?.closest('form');
                                            if (selected !== null) setTimeout(() => { if (ctrl) focusNextFromControl(ctrl, formEl); }, 50);
                                        }}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        openMenuOnFocus={true}
                                        placeholder="Choose Gate..."
                                        isClearable
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="quick-add-btn"
                                    title="Add New Gate"
                                    onClick={() => setShowGateModal(true)}
                                >+</button>
                            </div>
                        </Form.Group>
                    </Col>

                    <Col md={3}>
                        <Form.Group className="mb-3">
                            <Form.Label className="form-label-custom">Expected Time of Exit</Form.Label>
                            <Form.Control
                                type="time"
                                className="form-control-custom"
                                name="expected_time_of_exit"
                                value={formData.expected_time_of_exit}
                                min={getCurrentTime()}
                                onChange={handleChange}
                            />
                        </Form.Group>
                    </Col>

                    <Col md={3}>
                        <Form.Group className="mb-3">
                            <Form.Label className="form-label-custom">Number of Persons <span className="text-danger ms-1">*</span></Form.Label>
                            <Form.Control
                                type="number"
                                min="1"
                                className="form-control-custom"
                                name="number_of_persons"
                                value={formData.number_of_persons}
                                onChange={handleChange}
                                placeholder="1"
                            />
                            {parseInt(formData.number_of_persons, 10) > 1 && !(formData.generated_tags || []).includes('N/A') && formData.generated_tag !== 'N/A' && (
                                <div className={`mt-1.5 d-flex align-items-center gap-1.5 ${(formData.generated_tags || []).length === parseInt(formData.number_of_persons, 10) ? 'text-success' : 'text-warning'}`} style={{ fontSize: '11px', fontWeight: 500 }}>
                                    <i className={`fa ${(formData.generated_tags || []).length === parseInt(formData.number_of_persons, 10) ? 'fa-check-circle' : 'fa-info-circle'}`}></i>
                                    <span>
                                        {(formData.generated_tags || []).length === parseInt(formData.number_of_persons, 10)
                                            ? `${formData.number_of_persons} tags assigned (${(formData.generated_tags || []).length}/${formData.number_of_persons})`
                                            : `${formData.number_of_persons} require ${formData.number_of_persons} tags`
                                        }
                                    </span>
                                </div>
                            )}
                        </Form.Group>
                    </Col>
                </Row>

                {/* Row 2: Tag Category & Gate Pass / Tag Assignment */}
                {entryMode === 'visitor' ? (
                    <Row className="mb-3">
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="form-label-custom">Tag Category <span className="text-danger">*</span></Form.Label>
                                <div className="d-flex align-items-center gap-2">
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Select
                                            className="category-select react-select-container"
                                            classNamePrefix="react-select"
                                            styles={selectStyles}
                                            options={categoryOptions}
                                            value={categoryOptions.find(o => String(o.value) === String(formData.tag_category)) || null}
                                            onChange={(selected) => {
                                                handleChange({
                                                    target: {
                                                        name: 'tag_category',
                                                        value: selected ? selected.value : ''
                                                    }
                                                });
                                                setFormData(prev => ({
                                                    ...prev,
                                                    tag_category: selected ? selected.value : '',
                                                    generated_tag: ''
                                                }));
                                                const ctrl = currentSelectControlRef.current;
                                                const formEl = ctrl?.closest('form');
                                                if (selected !== null) setTimeout(() => { if (ctrl) focusNextFromControl(ctrl, formEl); }, 50);
                                            }}
                                            onFocus={handleSelectFocus}
                                            onKeyDown={handleSelectKeyDown}
                                            openMenuOnFocus={true}
                                            placeholder="Select Tag Category..."
                                            isClearable
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="quick-add-btn"
                                        title="Add New Category"
                                        onClick={() => setShowCategoryModal(true)}
                                    >+</button>
                                </div>
                            </Form.Group>
                        </Col>

                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="form-label-custom d-flex justify-content-between align-items-center">
                                    <span>Gate Pass / Tag Assignment <span className="text-danger">*</span></span>
                                    {parseInt(formData.number_of_persons, 10) > 1 && (
                                        <span className={`badge ${
                                            (formData.generated_tags || []).length === parseInt(formData.number_of_persons, 10)
                                                ? 'badge-success light'
                                                : ((formData.generated_tags || []).includes('N/A') || formData.generated_tag === 'N/A' ? 'badge-secondary light' : 'badge-danger light')
                                        }`} style={{ fontSize: '11px', fontWeight: 600 }}>
                                            {(formData.generated_tags || []).includes('N/A') || formData.generated_tag === 'N/A'
                                                ? 'N/A (No Physical Tags)'
                                                : `${(formData.generated_tags || []).length} of ${formData.number_of_persons} tags selected`
                                            }
                                        </span>
                                    )}
                                </Form.Label>
                                <div className="d-flex align-items-center gap-2">
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {parseInt(formData.number_of_persons, 10) > 1 ? (
                                            <Select
                                                isMulti
                                                className="tag-select tag-select-scrollable react-select-container"
                                                classNamePrefix="react-select"
                                                styles={multiTagSelectStyles}
                                                options={tagOptions}
                                                value={
                                                    (formData.generated_tag === 'N/A' || (formData.generated_tags || []).includes('N/A'))
                                                        ? tagOptions.filter(o => o.value === 'N/A')
                                                        : tagOptions.filter(o => (formData.generated_tags || []).some(id => String(id) === String(o.value)))
                                                }
                                                onChange={(selected) => {
                                                    const targetPersons = parseInt(formData.number_of_persons, 10) || 1;
                                                    let shouldAdvance = false;

                                                    if (!selected || (Array.isArray(selected) && selected.length === 0)) {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            generated_tags: [],
                                                            generated_tag: ''
                                                        }));
                                                    } else {
                                                        const arr = Array.isArray(selected) ? selected : [selected];
                                                        const lastSelected = arr[arr.length - 1];
                                                        if (lastSelected?.value === 'N/A') {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                generated_tags: ['N/A'],
                                                                generated_tag: 'N/A'
                                                            }));
                                                            shouldAdvance = true;
                                                        } else {
                                                            const filtered = arr.filter(s => s.value !== 'N/A');
                                                            const prevCount = (formData.generated_tags || []).filter(t => t !== 'N/A').length;
                                                            const ids = filtered.map(s => s.value).slice(0, targetPersons);
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                generated_tags: ids,
                                                                generated_tag: ids[0] || ''
                                                            }));
                                                            // Move control to next column only when all required tags are filled
                                                            if (ids.length >= targetPersons && ids.length > prevCount) {
                                                                shouldAdvance = true;
                                                            }
                                                        }
                                                    }

                                                    if (shouldAdvance) {
                                                        const formEl = formRef.current || document.querySelector('.gate-entry-form-container') || document;
                                                        const ctrl = currentSelectControlRef.current || (formEl?.querySelector ? formEl.querySelector('.tag-select .react-select__control') : document.querySelector('.tag-select .react-select__control'));
                                                        setTimeout(() => {
                                                            if (ctrl) focusNextFromControl(ctrl, formEl);
                                                        }, 60);
                                                    }
                                                }}
                                                closeMenuOnSelect={(formData.generated_tags || []).filter(t => t !== 'N/A').length + 1 >= parseInt(formData.number_of_persons, 10)}
                                                isOptionDisabled={(option) => {
                                                    if (option.value === 'N/A') return false;
                                                    const currentTags = (formData.generated_tags || []).filter(t => t !== 'N/A');
                                                    const targetCount = parseInt(formData.number_of_persons, 10) || 1;
                                                    return currentTags.length >= targetCount && !currentTags.some(id => String(id) === String(option.value));
                                                }}
                                                onFocus={handleSelectFocus}
                                                onKeyDown={handleSelectKeyDown}
                                                openMenuOnFocus={true}
                                                placeholder={`Select ${formData.number_of_persons} Tags / Passes...`}
                                                isClearable
                                                formatOptionLabel={(option) => (
                                                    <div className="d-flex align-items-center">
                                                        {option.value === 'N/A' ? (
                                                            <span className="d-inline-flex align-items-center fw-medium text-secondary">
                                                                <i className="fa fa-ban me-1.5 opacity-75" style={{ fontSize: '12px' }}></i>
                                                                {option.label}
                                                            </span>
                                                        ) : (
                                                            <span>{option.label}</span>
                                                        )}
                                                        {option.color && (
                                                            <div
                                                                className="ms-2 rounded-circle"
                                                                style={{ width: '12px', height: '12px', backgroundColor: option.color }}
                                                            ></div>
                                                        )}
                                                    </div>
                                                )}
                                            />
                                        ) : (
                                            <Select
                                                className="tag-select react-select-container"
                                                classNamePrefix="react-select"
                                                styles={selectStyles}
                                                options={tagOptions}
                                                value={tagOptions.find(o => String(o.value) === String(formData.generated_tag)) || null}
                                                onChange={(selected) => {
                                                    const val = selected ? selected.value : '';
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        generated_tag: val,
                                                        generated_tags: val ? [val] : []
                                                    }));
                                                    const formEl = formRef.current || document.querySelector('.gate-entry-form-container') || document;
                                                    const ctrl = currentSelectControlRef.current || (formEl?.querySelector ? formEl.querySelector('.tag-select .react-select__control') : document.querySelector('.tag-select .react-select__control'));
                                                    if (val) setTimeout(() => { if (ctrl) focusNextFromControl(ctrl, formEl); }, 60);
                                                }}
                                                onFocus={handleSelectFocus}
                                                onKeyDown={handleSelectKeyDown}
                                                openMenuOnFocus={true}
                                                placeholder="Select Tag / Pass..."
                                                isClearable
                                                formatOptionLabel={(option) => (
                                                    <div className="d-flex align-items-center">
                                                        {option.value === 'N/A' ? (
                                                            <span className="d-inline-flex align-items-center fw-medium text-secondary">
                                                                <i className="fa fa-ban me-1.5 opacity-75" style={{ fontSize: '12px' }}></i>
                                                                {option.label}
                                                            </span>
                                                        ) : (
                                                            <span>{option.label}</span>
                                                        )}
                                                        {option.color && (
                                                            <div
                                                                className="ms-2 rounded-circle"
                                                                style={{ width: '12px', height: '12px', backgroundColor: option.color }}
                                                            ></div>
                                                        )}
                                                    </div>
                                                )}
                                            />
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        className="quick-add-btn"
                                        title="Add New Tag"
                                        onClick={() => setShowTagModal(true)}
                                    >+</button>
                                </div>
                                {parseInt(formData.number_of_persons, 10) > 1 && !(formData.generated_tags || []).includes('N/A') && formData.generated_tag !== 'N/A' && (
                                    <div className={`mt-1.5 d-flex align-items-center gap-1.5 ${(formData.generated_tags || []).length === parseInt(formData.number_of_persons, 10) ? 'text-success' : 'text-danger'}`} style={{ fontSize: '12px', fontWeight: 500 }}>
                                        <i className={`fa ${(formData.generated_tags || []).length === parseInt(formData.number_of_persons, 10) ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                                        <span>
                                            {(formData.generated_tags || []).length === parseInt(formData.number_of_persons, 10)
                                                ? `All ${formData.number_of_persons} tags assigned (${(formData.generated_tags || []).length}/${formData.number_of_persons})`
                                                : `${parseInt(formData.number_of_persons, 10) - (formData.generated_tags || []).length} more tag(s) required — exactly 1 physical tag per person (${(formData.generated_tags || []).length} of ${formData.number_of_persons} assigned)`
                                            }
                                        </span>
                                    </div>
                                )}
                            </Form.Group>
                        </Col>
                    </Row>
                ) : (
                    <Row className="mb-3">
                        <Col md={12}>
                            <Form.Group className="mb-3">
                                <Form.Label className="form-label-custom d-flex justify-content-between align-items-center">
                                    <span>Gate Pass / Vehicle Tag <span className="text-danger">*</span></span>
                                    {parseInt(formData.number_of_persons, 10) > 1 && (
                                        <span className={`badge ${
                                            (formData.generated_tags || []).length === parseInt(formData.number_of_persons, 10)
                                                ? 'badge-success light'
                                                : ((formData.generated_tags || []).includes('N/A') || formData.generated_tag === 'N/A' ? 'badge-secondary light' : 'badge-danger light')
                                        }`} style={{ fontSize: '11px', fontWeight: 600 }}>
                                            {(formData.generated_tags || []).includes('N/A') || formData.generated_tag === 'N/A'
                                                ? 'N/A (No Physical Tags)'
                                                : `${(formData.generated_tags || []).length} of ${formData.number_of_persons} tags selected`
                                            }
                                        </span>
                                    )}
                                </Form.Label>
                                <div className="d-flex align-items-center gap-2">
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {parseInt(formData.number_of_persons, 10) > 1 ? (
                                            <Select
                                                isMulti
                                                className="tag-select tag-select-scrollable react-select-container"
                                                classNamePrefix="react-select"
                                                styles={multiTagSelectStyles}
                                                options={tagOptions}
                                                value={
                                                    (formData.generated_tag === 'N/A' || (formData.generated_tags || []).includes('N/A'))
                                                        ? tagOptions.filter(o => o.value === 'N/A')
                                                        : tagOptions.filter(o => (formData.generated_tags || []).some(id => String(id) === String(o.value)))
                                                }
                                                onChange={(selected) => {
                                                    const targetPersons = parseInt(formData.number_of_persons, 10) || 1;
                                                    let shouldAdvance = false;

                                                    if (!selected || (Array.isArray(selected) && selected.length === 0)) {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            generated_tags: [],
                                                            generated_tag: ''
                                                        }));
                                                    } else {
                                                        const arr = Array.isArray(selected) ? selected : [selected];
                                                        const lastSelected = arr[arr.length - 1];
                                                        if (lastSelected?.value === 'N/A') {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                generated_tags: ['N/A'],
                                                                generated_tag: 'N/A'
                                                            }));
                                                            shouldAdvance = true;
                                                        } else {
                                                            const filtered = arr.filter(s => s.value !== 'N/A');
                                                            const prevCount = (formData.generated_tags || []).filter(t => t !== 'N/A').length;
                                                            const ids = filtered.map(s => s.value).slice(0, targetPersons);
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                generated_tags: ids,
                                                                generated_tag: ids[0] || ''
                                                            }));
                                                            // Move control to next column only when all required tags are filled
                                                            if (ids.length >= targetPersons && ids.length > prevCount) {
                                                                shouldAdvance = true;
                                                            }
                                                        }
                                                    }

                                                    if (shouldAdvance) {
                                                        const formEl = formRef.current || document.querySelector('.gate-entry-form-container') || document;
                                                        const ctrl = currentSelectControlRef.current || (formEl?.querySelector ? formEl.querySelector('.tag-select .react-select__control') : document.querySelector('.tag-select .react-select__control'));
                                                        setTimeout(() => {
                                                            if (ctrl) focusNextFromControl(ctrl, formEl);
                                                        }, 60);
                                                    }
                                                }}
                                                closeMenuOnSelect={(formData.generated_tags || []).filter(t => t !== 'N/A').length + 1 >= parseInt(formData.number_of_persons, 10)}
                                                isOptionDisabled={(option) => {
                                                    if (option.value === 'N/A') return false;
                                                    const currentTags = (formData.generated_tags || []).filter(t => t !== 'N/A');
                                                    const targetCount = parseInt(formData.number_of_persons, 10) || 1;
                                                    return currentTags.length >= targetCount && !currentTags.some(id => String(id) === String(option.value));
                                                }}
                                                onFocus={handleSelectFocus}
                                                onKeyDown={handleSelectKeyDown}
                                                openMenuOnFocus={true}
                                                placeholder={`Select ${formData.number_of_persons} Tags / Passes...`}
                                                isClearable
                                                formatOptionLabel={(option) => (
                                                    <div className="d-flex align-items-center">
                                                        {option.value === 'N/A' ? (
                                                            <span className="d-inline-flex align-items-center fw-medium text-secondary">
                                                                <i className="fa fa-ban me-1.5 opacity-75" style={{ fontSize: '12px' }}></i>
                                                                {option.label}
                                                            </span>
                                                        ) : (
                                                            <span>{option.label}</span>
                                                        )}
                                                        {option.color && (
                                                            <div
                                                                className="ms-2 rounded-circle"
                                                                style={{ width: '12px', height: '12px', backgroundColor: option.color }}
                                                            ></div>
                                                        )}
                                                    </div>
                                                )}
                                            />
                                        ) : (
                                            <Select
                                                className="tag-select react-select-container"
                                                classNamePrefix="react-select"
                                                styles={selectStyles}
                                                options={tagOptions}
                                                value={tagOptions.find(o => String(o.value) === String(formData.generated_tag)) || null}
                                                onChange={(selected) => {
                                                    const val = selected ? selected.value : '';
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        generated_tag: val,
                                                        generated_tags: val ? [val] : []
                                                    }));
                                                    const formEl = formRef.current || document.querySelector('.gate-entry-form-container') || document;
                                                    const ctrl = currentSelectControlRef.current || (formEl?.querySelector ? formEl.querySelector('.tag-select .react-select__control') : document.querySelector('.tag-select .react-select__control'));
                                                    if (val) setTimeout(() => { if (ctrl) focusNextFromControl(ctrl, formEl); }, 60);
                                                }}
                                                onFocus={handleSelectFocus}
                                                onKeyDown={handleSelectKeyDown}
                                                openMenuOnFocus={true}
                                                placeholder="Select Vehicle Tag / Pass..."
                                                isClearable
                                                formatOptionLabel={(option) => (
                                                    <div className="d-flex align-items-center">
                                                        {option.value === 'N/A' ? (
                                                            <span className="d-inline-flex align-items-center fw-medium text-secondary">
                                                                <i className="fa fa-ban me-1.5 opacity-75" style={{ fontSize: '12px' }}></i>
                                                                {option.label}
                                                            </span>
                                                        ) : (
                                                            <span>{option.label}</span>
                                                        )}
                                                        {option.color && (
                                                            <div
                                                                className="ms-2 rounded-circle"
                                                                style={{ width: '12px', height: '12px', backgroundColor: option.color }}
                                                            ></div>
                                                        )}
                                                    </div>
                                                )}
                                            />
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        className="quick-add-btn"
                                        title="Add New Tag"
                                        onClick={() => setShowTagModal(true)}
                                    >+</button>
                                </div>
                                {parseInt(formData.number_of_persons, 10) > 1 && !(formData.generated_tags || []).includes('N/A') && formData.generated_tag !== 'N/A' && (
                                    <div className={`mt-1.5 d-flex align-items-center gap-1.5 ${(formData.generated_tags || []).length === parseInt(formData.number_of_persons, 10) ? 'text-success' : 'text-danger'}`} style={{ fontSize: '12px', fontWeight: 500 }}>
                                        <i className={`fa ${(formData.generated_tags || []).length === parseInt(formData.number_of_persons, 10) ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                                        <span>
                                            {(formData.generated_tags || []).length === parseInt(formData.number_of_persons, 10)
                                                ? `All ${formData.number_of_persons} tags assigned (${(formData.generated_tags || []).length}/${formData.number_of_persons})`
                                                : `${parseInt(formData.number_of_persons, 10) - (formData.generated_tags || []).length} more tag(s) required — exactly 1 physical tag per person (${(formData.generated_tags || []).length} of ${formData.number_of_persons} assigned)`
                                            }
                                        </span>
                                    </div>
                                )}
                            </Form.Group>
                        </Col>
                    </Row>
                )}

                {/* Row 3: Meeting Dept & Concerned Official */}
                <Row className="mb-3">
                    <Col md={6}>
                        <Form.Group className="mb-3">
                            <Form.Label className="form-label-custom">Meeting Department {!isInternalVehicle(selectedVehicles) && <span className="text-danger ms-1">*</span>}</Form.Label>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Select
                                        className="department-select react-select-container"
                                        classNamePrefix="react-select"
                                        styles={selectStyles}
                                        options={departmentOptions}
                                        value={departmentOptions.find(o => String(o.value) === String(formData.department)) || null}
                                        onChange={(selected) => {
                                            handleChange({
                                                target: {
                                                    name: 'department',
                                                    value: selected ? selected.value : ''
                                                }
                                            });
                                            const ctrl = currentSelectControlRef.current;
                                            const formEl = ctrl?.closest('form');
                                            if (selected !== null) setTimeout(() => { if (ctrl) focusNextFromControl(ctrl, formEl); }, 50);
                                        }}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        openMenuOnFocus={true}
                                        placeholder="Select Target Department..."
                                        isClearable
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="quick-add-btn"
                                    title="Add New Department"
                                    onClick={() => setShowDepartmentModal(true)}
                                >+</button>
                            </div>
                        </Form.Group>
                    </Col>

                    <Col md={6}>
                        <Form.Group className="mb-3">
                            <Form.Label className="form-label-custom">
                                Concerned Official {entryMode === 'visitor' && <span className="text-danger ms-1">*</span>}
                            </Form.Label>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Select
                                        className="employee-select react-select-container"
                                        classNamePrefix="react-select"
                                        styles={selectStyles}
                                        options={employeeOptions}
                                        value={employeeOptions.find(o => String(o.value) === String(formData.employee)) || null}
                                        onChange={(selected) => {
                                            handleChange({
                                                target: {
                                                    name: 'employee',
                                                    value: selected ? selected.value : ''
                                                }
                                            });
                                            const ctrl = currentSelectControlRef.current;
                                            const formEl = ctrl?.closest('form');
                                            if (selected !== null) setTimeout(() => { if (ctrl) focusNextFromControl(ctrl, formEl); }, 50);
                                        }}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        openMenuOnFocus={true}
                                        placeholder="Assign Employee..."
                                        isClearable
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="quick-add-btn"
                                    title="Add New Official"
                                    onClick={() => setShowOfficialModal(true)}
                                >+</button>
                            </div>
                        </Form.Group>
                    </Col>
                </Row>
                
                {/* Vehicle Mode Details */}
                {entryMode === 'vehicle' && (
                    <Row className="mb-3">
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="form-label-custom">Driver Name <span className="text-danger ms-1">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    name="driver"
                                    value={formData.driver}
                                    onChange={handleChange}
                                    className="form-control-custom"
                                    placeholder="Enter Driver Name"
                                    required={entryMode === 'vehicle'}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="form-label-custom">Company</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="company"
                                    value={formData.company}
                                    onChange={handleChange}
                                    className="form-control-custom"
                                    placeholder="Enter Company Name"
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                )}

                {entryMode === 'vehicle' && (
                    <Row className="mb-3">
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="form-label-custom">Material Details</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="material_details"
                                    value={formData.material_details}
                                    onChange={handleChange}
                                    className="form-control-custom"
                                    placeholder="E.g. Steel pipes, Office supplies..."
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="form-label-custom">
                                    <i className="fa fa-parking text-primary me-1.5"></i>
                                    Parking Area / Lot
                                </Form.Label>
                                <Select
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    styles={selectStyles}
                                    options={parkAreaOptions}
                                    value={parkAreaOptions.find(o => String(o.value) === String(formData.park_area)) || null}
                                    onChange={(selected) => {
                                        const areaVal = selected ? selected.value : '';
                                        setFormData(prev => ({
                                            ...prev,
                                            park_area: areaVal
                                        }));
                                    }}
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleSelectKeyDown}
                                    openMenuOnFocus={true}
                                    placeholder="Select Parking Area / Lot..."
                                    isClearable
                                    isOptionDisabled={(option) => option.total > 0 && option.available === 0 && String(option.value) !== String(formData.park_area)}
                                    formatOptionLabel={(option) => (
                                        <div className="d-flex align-items-center justify-content-between w-100">
                                            <span className="fw-medium">{option.name || option.label}</span>
                                            {option.total > 0 && (
                                                <span 
                                                    className={`badge rounded-pill ms-2 ${option.available === 0 ? 'bg-danger text-white' : 'bg-success-subtle text-success border border-success-subtle'}`}
                                                    style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px' }}
                                                >
                                                    {option.available === 0 ? 'Full (0 Free)' : `${option.available} of ${option.total} Available`}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                )}

                <Row className="mb-3">
                    <Col md={12}>
                        <Form.Group className="mb-3">
                            <Form.Label className="form-label-custom">Purpose of Visit <span className="text-danger ms-1">*</span></Form.Label>
                            <Form.Control
                                id="purpose_of_visit_input"
                                as="textarea"
                                rows={2}
                                name="purpose_of_visit"
                                value={formData.purpose_of_visit}
                                onChange={handleChange}
                                onKeyDown={handleTextareaKeyDown}
                                className="form-control-custom"
                                placeholder="Write detailed purpose here... (e.g. Sales pitch, Delivery)"
                                required
                            />
                        </Form.Group>
                    </Col>
                </Row>

                {/* Vehicle Details Section (Multiple entries allowed) - Only for visitor entry mode */}
                {entryMode !== 'vehicle' && (
                <div className="mb-4" id="vehicle-details-section">
                    <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                        <div className="d-flex align-items-center gap-2">
                            <div 
                                className="d-flex align-items-center justify-content-center rounded-circle"
                                style={{ width: '28px', height: '28px', background: '#e8fdf4', color: '#16a34a' }}
                            >
                                <i className="fa fa-car" style={{ fontSize: '13px' }}></i>
                            </div>
                            <span className="small text-muted text-uppercase fw-bold" style={{ letterSpacing: '0.5px' }}>
                                Vehicle Details
                            </span>
                            {vehiclesList.length > 0 && (
                                <span 
                                    className="badge rounded-pill" 
                                    style={{ background: '#e8fdf4', color: '#16a34a', border: '1px solid #bbf7d0', fontSize: '11px', fontWeight: 600, padding: '3px 8px' }}
                                >
                                    {vehiclesList.length}
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            className="btn btn-sm d-inline-flex align-items-center gap-1 shadow-none"
                            style={{
                                background: '#e8fdf4',
                                color: '#16a34a',
                                border: '1px solid #a7f3d0',
                                borderRadius: '20px',
                                padding: '5px 14px',
                                fontSize: '12px',
                                fontWeight: 600,
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#0a500f'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#e8fdf4'; e.currentTarget.style.color = '#16a34a'; }}
                            onClick={handleAddVehicle}
                        >
                            <i className="fa fa-plus-circle"></i>
                            <span>Vehicle</span>
                        </button>
                    </div>

                    {vehiclesList.length === 0 ? (
                        <div
                            className="p-3 rounded-3 text-center border border-dashed"
                            style={{
                                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                                borderColor: '#cbd5e1',
                                borderRadius: '10px'
                            }}
                        >
                            <div className="d-flex align-items-center justify-content-center gap-2 text-muted small">
                                <div 
                                    className="rounded-circle d-flex align-items-center justify-content-center"
                                    style={{ width: '28px', height: '28px', background: '#e2e8f0', color: '#64748b' }}
                                >
                                    <i className="fa fa-car" style={{ fontSize: '13px' }}></i>
                                </div>
                                <span>No vehicles added for this entry. Click <strong role="button" className="text-success cursor-pointer fw-bold" onClick={handleAddVehicle}>+ Add Vehicle</strong> if visitor is accompanied by vehicle(s).</span>
                            </div>
                        </div>
                    ) : (
                        <div className="d-flex flex-column gap-3">
                            {/* Parking Area / Lot Selection (placed along with vehicle details) */}
                            <div 
                                className="p-3 rounded-3" 
                                style={{ 
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', 
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` 
                                }}
                            >
                                <Form.Group>
                                    <Form.Label className="form-label-custom d-flex align-items-center justify-content-between mb-1.5">
                                        <span className="fw-semibold">
                                            <i className="fa fa-parking text-primary me-1.5"></i>
                                            Parking Area / Lot
                                        </span>
                                        <span className="text-muted small fw-normal">
                                            Vehicle can be parked anywhere in this area
                                        </span>
                                    </Form.Label>
                                    <Select
                                        className="react-select-container"
                                        classNamePrefix="react-select"
                                        styles={selectStyles}
                                        options={parkAreaOptions}
                                        value={parkAreaOptions.find(o => String(o.value) === String(formData.park_area)) || null}
                                        onChange={(selected) => {
                                            const areaVal = selected ? selected.value : '';
                                            setFormData(prev => ({
                                                ...prev,
                                                park_area: areaVal
                                            }));
                                        }}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        openMenuOnFocus={true}
                                        placeholder="Select Parking Area / Lot..."
                                        isClearable
                                        isOptionDisabled={(option) => option.total > 0 && option.available === 0 && String(option.value) !== String(formData.park_area)}
                                        formatOptionLabel={(option) => (
                                            <div className="d-flex align-items-center justify-content-between w-100">
                                                <span className="fw-medium">{option.name || option.label}</span>
                                                {option.total > 0 && (
                                                    <span 
                                                        className={`badge rounded-pill ms-2 ${option.available === 0 ? 'bg-danger text-white' : 'bg-success-subtle text-success border border-success-subtle'}`}
                                                        style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px' }}
                                                    >
                                                        {option.available === 0 ? 'Full (0 Free)' : `${option.available} of ${option.total} Available`}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    />
                                </Form.Group>
                            </div>

                            {vehiclesList.map((veh, index) => (
                                <Card
                                    key={index}
                                    className="border shadow-none rounded-3 position-relative"
                                    style={{
                                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                                        borderColor: '#e2e8f0',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                                    }}
                                >
                                    <Card.Body className="p-3">
                                        <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom" style={{ borderColor: '#f1f5f9' }}>
                                            <span 
                                                className="badge rounded-pill d-inline-flex align-items-center gap-1"
                                                style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 600, padding: '4px 10px' }}
                                            >
                                                <i className="fa fa-car text-success"></i> Vehicle #{index + 1}
                                            </span>
                                            <button
                                                type="button"
                                                className="btn btn-sm text-danger p-0 border-0 d-inline-flex align-items-center gap-1"
                                                style={{ fontSize: '12px', fontWeight: 500, background: 'transparent' }}
                                                onClick={() => handleRemoveVehicle(index)}
                                                title="Remove this vehicle"
                                            >
                                                <i className="fa fa-trash-alt" style={{ fontSize: '11px' }}></i> Remove
                                            </button>
                                        </div>

                                        <Row className="g-3 align-items-center">
                                            <Col md={4}>
                                                <Form.Group>
                                                    <Form.Label className="form-label-custom small mb-1" style={{ color: '#475569', fontWeight: 500 }}>
                                                        Vehicle Number <span className="text-danger">*</span>
                                                    </Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        className="form-control-custom vehicle-input-upper"
                                                        placeholder="e.g. KL-07-AB-1234"
                                                        value={veh.vehicle_number}
                                                        onChange={(e) => handleVehicleChange(index, 'vehicle_number', e.target.value)}
                                                        required
                                                    />
                                                </Form.Group>
                                            </Col>

                                            <Col md={4}>
                                                <Form.Group>
                                                    <Form.Label className="form-label-custom small mb-1" style={{ color: '#475569', fontWeight: 500 }}>
                                                        Driver Name
                                                    </Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        className="form-control-custom"
                                                        placeholder="e.g. Driver or visitor name"
                                                        value={veh.driver_name}
                                                        onChange={(e) => handleVehicleChange(index, 'driver_name', e.target.value)}
                                                    />
                                                </Form.Group>
                                            </Col>

                                            <Col md={4}>
                                                <Form.Group>
                                                    <Form.Label className="form-label-custom small mb-1" style={{ color: '#475569', fontWeight: 500 }}>
                                                        Vehicle Photo
                                                    </Form.Label>
                                                    {veh.preview ? (
                                                        <div 
                                                            className="d-flex align-items-center justify-content-between p-1 px-2 border rounded-3 bg-white shadow-sm"
                                                            style={{ height: '38px', borderColor: '#86efac' }}
                                                        >
                                                            <div className="d-flex align-items-center gap-2 overflow-hidden">
                                                                <div 
                                                                    className="rounded overflow-hidden flex-shrink-0 cursor-pointer shadow-sm"
                                                                    style={{ width: '36px', height: '28px', border: '1px solid #e2e8f0' }}
                                                                    onClick={() => window.open(veh.preview, '_blank')}
                                                                    title="Click to view photo"
                                                                >
                                                                    <img 
                                                                        src={veh.preview} 
                                                                        alt={`Vehicle ${index + 1}`} 
                                                                        className="w-100 h-100" 
                                                                        style={{ objectFit: 'cover' }}
                                                                    />
                                                                </div>
                                                                <span className="small fw-semibold text-truncate" style={{ fontSize: '11px', color: '#15803d' }}>
                                                                    <i className="fa fa-check-circle me-1"></i>Photo ready
                                                                </span>
                                                            </div>
                                                            <div className="d-flex align-items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm p-1 text-secondary border-0"
                                                                    style={{ fontSize: '12px', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
                                                                    onClick={() => handleOpenVehicleCamera(index)}
                                                                    title="Retake photo using camera"
                                                                >
                                                                    <i className="fa fa-camera"></i>
                                                                </button>
                                                                <label
                                                                    className="btn btn-sm p-1 text-secondary border-0 mb-0 cursor-pointer"
                                                                    style={{ fontSize: '12px', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
                                                                    title="Upload replacement photo"
                                                                >
                                                                    <i className="fa fa-upload"></i>
                                                                    <input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        hidden
                                                                        onChange={(e) => {
                                                                            if (e.target.files && e.target.files[0]) {
                                                                                handleVehiclePhotoChange(index, e.target.files[0]);
                                                                            }
                                                                        }}
                                                                    />
                                                                </label>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm p-1 text-danger border-0"
                                                                    style={{ fontSize: '12px', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
                                                                    onClick={() => handleRemoveVehiclePhoto(index)}
                                                                    title="Remove photo"
                                                                >
                                                                    <i className="fa fa-times-circle"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="d-flex align-items-center gap-2" style={{ height: '38px' }}>
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm d-flex align-items-center justify-content-center gap-1 flex-fill h-100 shadow-none"
                                                                style={{
                                                                    background: '#f0fdf4',
                                                                    color: '#15803d',
                                                                    border: '1px solid #86efac',
                                                                    borderRadius: '8px',
                                                                    fontSize: '12px',
                                                                    fontWeight: 600,
                                                                    transition: 'all 0.2s ease'
                                                                }}
                                                                onMouseEnter={(e) => { e.currentTarget.style.background = '#0a500f'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#0a500f'; }}
                                                                onMouseLeave={(e) => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.color = '#15803d'; e.currentTarget.style.borderColor = '#86efac'; }}
                                                                onClick={() => handleOpenVehicleCamera(index)}
                                                            >
                                                                <i className="fa fa-camera"></i>
                                                                <span>Capture</span>
                                                            </button>

                                                            <label
                                                                className="btn btn-sm d-flex align-items-center justify-content-center gap-1 flex-fill h-100 mb-0 shadow-none cursor-pointer"
                                                                style={{
                                                                    background: '#f8fafc',
                                                                    color: '#475569',
                                                                    border: '1px solid #cbd5e1',
                                                                    borderRadius: '8px',
                                                                    fontSize: '12px',
                                                                    fontWeight: 600,
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s ease'
                                                                }}
                                                                onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
                                                                onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                                                            >
                                                                <i className="fa fa-upload"></i>
                                                                <span>Upload</span>
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    hidden
                                                                    onChange={(e) => {
                                                                        if (e.target.files && e.target.files[0]) {
                                                                            handleVehiclePhotoChange(index, e.target.files[0]);
                                                                        }
                                                                    }}
                                                                />
                                                            </label>
                                                        </div>
                                                    )}
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                    </Card.Body>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
                )}
                
                {entryMode === 'vehicle' && (
                <>
                {/* Supporting Document Section for Vehicle Entry (Multiple Uploads Supported) */}
                <div className="mb-4">
                    <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom flex-wrap gap-2">
                        <div className="d-flex align-items-center gap-2">
                            <div 
                                className="d-flex align-items-center justify-content-center rounded-circle"
                                style={{ width: '28px', height: '28px', background: '#eff6ff', color: '#2563eb' }}
                            >
                                <i className="fa fa-file-invoice" style={{ fontSize: '13px' }}></i>
                            </div>
                            <span className="small text-muted text-uppercase fw-bold" style={{ letterSpacing: '0.5px' }}>
                                Supporting Documents
                            </span>
                            {supportingDocs.length > 0 && (
                                <span className="badge rounded-pill bg-primary" style={{ fontSize: '11px', fontWeight: 600 }}>
                                    {supportingDocs.length} {supportingDocs.length === 1 ? 'file' : 'files'}
                                </span>
                            )}
                            <span className="badge rounded-pill bg-light text-muted border" style={{ fontSize: '10px', fontWeight: 500 }}>
                                Delivery Challan / Invoice / Pass / Driver License
                            </span>
                        </div>
                    </div>

                    <Card
                        className="border shadow-none rounded-3"
                        style={{
                            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                            borderColor: '#e2e8f0',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                        }}
                    >
                        <Card.Body className="p-3">
                            {supportingDocs.length > 0 ? (
                                <div>
                                    <div className="d-flex flex-wrap gap-3">
                                        {supportingDocs.map((doc, index) => (
                                            <div
                                                key={doc.id || index}
                                                className="border rounded-3 p-2 bg-white shadow-xs position-relative d-flex flex-column align-items-center"
                                                style={{
                                                    width: '130px',
                                                    borderColor: '#bfdbfe',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-danger position-absolute rounded-circle p-0 d-flex align-items-center justify-content-center shadow-sm"
                                                    style={{
                                                        top: '-7px',
                                                        right: '-7px',
                                                        width: '20px',
                                                        height: '20px',
                                                        fontSize: '10px',
                                                        zIndex: 2
                                                    }}
                                                    onClick={() => handleRemoveSupportingDoc(index)}
                                                    title="Remove this document"
                                                >
                                                    <i className="fa fa-times"></i>
                                                </button>

                                                <div
                                                    className="rounded overflow-hidden cursor-pointer w-100"
                                                    style={{ height: '85px', border: '1px solid #e2e8f0' }}
                                                    onClick={() => window.open(doc.preview, '_blank')}
                                                    title="Click to view full image"
                                                >
                                                    <img
                                                        src={doc.preview}
                                                        alt={doc.name || `Document ${index + 1}`}
                                                        className="w-100 h-100"
                                                        style={{ objectFit: 'cover' }}
                                                    />
                                                </div>

                                                <span
                                                    className="small fw-semibold text-truncate text-center w-100 mt-1"
                                                    style={{ fontSize: '11px', color: '#334155' }}
                                                    title={doc.name || `Document ${index + 1}`}
                                                >
                                                    {doc.name || `Document #${index + 1}`}
                                                </span>
                                            </div>
                                        ))}

                                        {/* Quick Add More Tile */}
                                        <div
                                            className="border border-dashed rounded-3 p-2 d-flex flex-column align-items-center justify-content-center gap-1 text-muted"
                                            style={{
                                                width: '130px',
                                                height: '116px',
                                                borderColor: '#cbd5e1',
                                                backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : '#f8fafc'
                                            }}
                                        >
                                            <span className="small fw-bold text-muted" style={{ fontSize: '11px' }}>Add More</span>
                                            <div className="d-flex gap-1 mt-1">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-light border p-1"
                                                    style={{ fontSize: '11px', borderRadius: '6px', width: '28px', height: '28px' }}
                                                    onClick={() => setShowDocCamera(true)}
                                                    title="Add photo from camera"
                                                >
                                                    <i className="fa fa-camera text-primary"></i>
                                                </button>
                                                <label
                                                    className="btn btn-sm btn-light border p-1 mb-0 cursor-pointer d-flex align-items-center justify-content-center"
                                                    style={{ fontSize: '11px', borderRadius: '6px', width: '28px', height: '28px' }}
                                                    title="Upload photo from files"
                                                >
                                                    <i className="fa fa-upload text-success"></i>
                                                    <input
                                                        type="file"
                                                        multiple
                                                        accept="image/*"
                                                        hidden
                                                        onChange={(e) => {
                                                            if (e.target.files && e.target.files.length > 0) {
                                                                handleAddSupportingDocs(e.target.files);
                                                                e.target.value = '';
                                                            }
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="p-3 rounded-3 text-center border border-dashed"
                                    style={{
                                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                                        borderColor: '#cbd5e1',
                                        borderRadius: '10px'
                                    }}
                                >
                                    <div className="d-flex flex-column align-items-center justify-content-center gap-2 text-muted small py-2">
                                        <div 
                                            className="rounded-circle d-flex align-items-center justify-content-center"
                                            style={{ width: '38px', height: '38px', background: '#eff6ff', color: '#3b82f6' }}
                                        >
                                            <i className="fa fa-file-invoice" style={{ fontSize: '16px' }}></i>
                                        </div>
                                        <div className="fw-medium text-dark">Upload Supporting Documents / Challans / Bills</div>
                                        <div className="text-muted" style={{ fontSize: '12px' }}>
                                            Multiple files allowed (delivery challan, invoice, driver licence, or material bills)
                                        </div>
                                        <div className="d-flex align-items-center gap-2 mt-2">
                                            <button
                                                type="button"
                                                className="btn btn-sm d-inline-flex align-items-center gap-1 shadow-none"
                                                style={{
                                                    background: '#eff6ff',
                                                    color: '#2563eb',
                                                    border: '1px solid #bfdbfe',
                                                    borderRadius: '8px',
                                                    padding: '6px 14px',
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onClick={() => setShowDocCamera(true)}
                                            >
                                                <i className="fa fa-camera"></i>
                                                <span>Capture with Camera</span>
                                            </button>

                                            <label
                                                className="btn btn-sm d-inline-flex align-items-center gap-1 mb-0 shadow-none cursor-pointer"
                                                style={{
                                                    background: '#f8fafc',
                                                    color: '#475569',
                                                    border: '1px solid #cbd5e1',
                                                    borderRadius: '8px',
                                                    padding: '6px 14px',
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <i className="fa fa-upload"></i>
                                                <span>Upload File(s)</span>
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept="image/*"
                                                    hidden
                                                    onChange={(e) => {
                                                        if (e.target.files && e.target.files.length > 0) {
                                                            handleAddSupportingDocs(e.target.files);
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
                </>
                )}

                {/* Equipment & Tools Details Section (Multi-select dropdown with custom format and quick add modal) */}
                <div className="mb-4" id="equipment-details-section">
                    <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom flex-wrap gap-2">
                        <div className="d-flex align-items-center gap-2">
                            <div 
                                className="d-flex align-items-center justify-content-center rounded-circle"
                                style={{ width: '28px', height: '28px', background: '#e8fdf4', color: '#16a34a' }}
                            >
                                <i className="fa fa-tools" style={{ fontSize: '13px' }}></i>
                            </div>
                            <span className="small text-muted text-uppercase fw-bold" style={{ letterSpacing: '0.5px' }}>
                                Equipment & Tools Details
                            </span>
                            {selectedEquipments.length > 0 && (
                                <span 
                                    className="badge rounded-pill" 
                                    style={{ background: '#e8fdf4', color: '#16a34a', border: '1px solid #bbf7d0', fontSize: '11px', fontWeight: 600, padding: '3px 8px' }}
                                >
                                    {selectedEquipments.length} {selectedEquipments.length === 1 ? 'item' : 'items'}
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            className="btn btn-sm d-inline-flex align-items-center gap-1 shadow-none"
                            style={{
                                background: '#e8fdf4',
                                color: '#16a34a',
                                border: '1px solid #a7f3d0',
                                borderRadius: '20px',
                                padding: '5px 14px',
                                fontSize: '12px',
                                fontWeight: 600,
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#0a500f'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#e8fdf4'; e.currentTarget.style.color = '#16a34a'; }}
                            onClick={() => setShowEquipmentModal(true)}
                        >
                            <i className="fa fa-plus-circle"></i>
                            <span>Tool</span>
                        </button>
                    </div>

                    <Card
                        className="border shadow-none rounded-3"
                        style={{
                            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                            borderColor: '#e2e8f0',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                        }}
                    >
                        <Card.Body className="p-3">
                            <Form.Group className="mb-0">
                                <Form.Label className="form-label-custom small mb-1" style={{ color: '#475569', fontWeight: 500 }}>
                                    Select Tools / Equipments Carried
                                </Form.Label>
                                <div className="d-flex align-items-center gap-2">
                                    <div className="flex-grow-1">
                                        <Select
                                            isMulti
                                            options={equipmentOptions}
                                            value={selectedEquipments}
                                            onChange={(selected) => setSelectedEquipments(selected || [])}
                                            placeholder="Search & select tools / equipments carried by visitor..."
                                            styles={{
                                                ...selectStyles,
                                                multiValue: (base) => ({
                                                    ...base,
                                                    backgroundColor: '#e8fdf4',
                                                    borderRadius: '6px',
                                                    border: '1px solid #bbf7d0',
                                                    padding: '2px 4px'
                                                }),
                                                multiValueLabel: (base) => ({
                                                    ...base,
                                                    color: '#15803d',
                                                    fontWeight: 600,
                                                    fontSize: '12px'
                                                }),
                                                multiValueRemove: (base) => ({
                                                    ...base,
                                                    color: '#15803d',
                                                    ':hover': {
                                                        backgroundColor: '#bbf7d0',
                                                        color: '#dc2626'
                                                    }
                                                })
                                            }}
                                            formatOptionLabel={(option) => (
                                                <div className="d-flex align-items-center gap-2">
                                                    {option.image ? (
                                                        <img
                                                            src={option.image}
                                                            alt={option.label}
                                                            style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                                                        />
                                                    ) : (
                                                        <div
                                                            className="d-flex align-items-center justify-content-center rounded"
                                                            style={{ width: '28px', height: '28px', background: '#f1f5f9', color: '#64748b' }}
                                                        >
                                                            <i className="fa fa-wrench" style={{ fontSize: '12px' }}></i>
                                                        </div>
                                                    )}
                                                    <div className="d-flex flex-column">
                                                        <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>{option.label}</span>
                                                        {option.description && (
                                                            <span className="text-muted" style={{ fontSize: '11px' }}>{option.description}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            className="react-select-container"
                                            classNamePrefix="react-select"
                                            isClearable
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-sm d-flex align-items-center justify-content-center p-0 flex-shrink-0"
                                        style={{
                                            width: '38px',
                                            height: '38px',
                                            borderRadius: '8px',
                                            background: '#0a500f',
                                            color: '#ffffff',
                                            border: 'none',
                                            transition: 'all 0.2s ease',
                                            boxShadow: '0 2px 4px rgba(10, 80, 15, 0.2)'
                                        }}
                                        onClick={() => setShowEquipmentModal(true)}
                                        title="Quick Add New Tool to Master"
                                    >
                                        <i className="fa fa-plus"></i>
                                    </button>
                                </div>
                            </Form.Group>

                            {selectedEquipments.length === 0 ? (
                                <div
                                    className="p-2.5 px-3 rounded-3 border border-dashed mt-3 text-center"
                                    style={{
                                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                                        borderColor: '#cbd5e1',
                                        borderRadius: '8px'
                                    }}
                                >
                                    <span className="small text-muted" style={{ fontSize: '12px' }}>
                                        <i className="fa fa-info-circle me-1.5 text-secondary"></i>
                                        No tools or equipments logged. Select from the dropdown above or click <strong role="button" className="text-success cursor-pointer" onClick={() => setShowEquipmentModal(true)}>+ Tool</strong> to add a new equipment to the list.
                                    </span>
                                </div>
                            ) : (
                                <div className="d-flex flex-wrap gap-2 mt-3 pt-2 border-top">
                                    {selectedEquipments.map((eq, idx) => (
                                        <div
                                            key={eq.value || eq.id || idx}
                                            className="d-flex align-items-center gap-2 p-1.5 pe-2.5 rounded-3 border shadow-xs"
                                            style={{
                                                backgroundColor: isDark ? '#1e293b' : '#f0fdf4',
                                                borderColor: '#bbf7d0',
                                                maxWidth: '280px'
                                            }}
                                        >
                                            {eq.image ? (
                                                <img
                                                    src={eq.image}
                                                    alt={eq.label}
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: '6px',
                                                        objectFit: 'cover',
                                                        border: '1px solid #cbd5e1'
                                                    }}
                                                />
                                            ) : (
                                                <div
                                                    className="rounded d-flex align-items-center justify-content-center"
                                                    style={{ width: '32px', height: '32px', background: '#dcfce7', color: '#15803d' }}
                                                >
                                                    <i className="fa fa-wrench" style={{ fontSize: '13px' }}></i>
                                                </div>
                                            )}
                                            <div className="d-flex flex-column overflow-hidden me-1" style={{ lineHeight: '1.2' }}>
                                                <span className="fw-semibold text-truncate text-dark" style={{ fontSize: '12.5px' }} title={eq.label}>
                                                    {eq.label}
                                                </span>
                                                {eq.description && (
                                                    <span className="text-muted text-truncate" style={{ fontSize: '11px' }} title={eq.description}>
                                                        {eq.description}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-sm text-danger p-0 border-0 ms-auto"
                                                style={{ fontSize: '14px', lineHeight: 1 }}
                                                onClick={() => setSelectedEquipments(prev => prev.filter((_, i) => i !== idx))}
                                                title="Remove this tool"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>


                <Row className="mb-4">
                    <Col md={12}>
                        <Form.Group>
                            <Form.Label className="form-label-custom">Supervisor Remarks / Narration</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                name="narration"
                                value={formData.narration}
                                onChange={handleChange}
                                onKeyDown={handleTextareaKeyDown}
                                className="form-control-custom"
                                placeholder="Additional internal notes about the entry..."
                            />
                        </Form.Group>
                    </Col>
                </Row>

                {entryMode === 'visitor' && formData.is_permission_required && (
                    <Row className="mb-4">
                        <Col md={12}>
                            <Card className="border shadow-none bg-light bg-opacity-25 rounded-3">
                                <Card.Body className="p-3">
                                    <div className="d-flex align-items-center justify-content-between">
                                        <div className="d-flex align-items-center">
                                            <div className="bg-warning text-white rounded-circle me-3 d-flex align-items-center justify-content-center" style={{ width: '35px', height: '35px' }}>
                                                <i className="fa fa-shield-alt"></i>
                                            </div>
                                            <div>
                                                <h6 className="mb-0 fw-bold text-dark">Entry Authorization</h6>
                                                <p className="text-muted small mb-0">Verify if departmental permission is mandatory for this visit</p>
                                            </div>
                                        </div>
                                        <Form.Check
                                            type="checkbox"
                                            id="is_permission_required"
                                            name="is_permission_required"
                                            label="Permission Needed from Department"
                                            checked={formData.is_permission_required}
                                            onChange={(e) => setFormData({ ...formData, is_permission_required: e.target.checked })}
                                            className="fw-bold"
                                            disabled={!bypassApproval && ((formData.department && departments.find(d => d.id === parseInt(formData.department))?.requires_visitor_approval) || (selectedAppointmentData && selectedAppointmentData.status !== 'approved'))}
                                        />
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                )}

                <div className="modal-footer-custom d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
                    <div>
                        {visitorData && visitorData.is_blacklisted && <span className="text-danger fw-bold small"><i className="fa fa-ban me-1"></i> ENTRY BLOCKED: PROTECTED VISITOR</span>}
                        {visitorData && !visitorData.is_blacklisted && formData.is_permission_required && <span className="text-info fw-bold small"><i className="fa fa-paper-plane me-1"></i> ENTRY WILL BE SENT FOR APPROVAL</span>}
                    </div>
                    <div className="d-flex gap-2">
                        <Button
                            type="button"
                            className="btn-close-custom"
                            onClick={() => {
                                if (onClose) onClose();
                                else navigate('/access-point/gate-entries');
                            }}
                        >
                            Close
                        </Button>
                        {(can('gate_entries', editEntry ? 'edit' : 'create') || can('gate-entry', editEntry ? 'edit' : 'create') || can('gate_entries', 'create')) && (
                            <Button
                                type="submit"
                                className="btn-save-custom"
                                disabled={loading || (entryMode === 'visitor' && visitorData && visitorData.is_blacklisted)}
                            >
                                {loading ? <Spinner size="sm" /> : (
                                    editEntry ? 'Update' : ((formData.is_permission_required && !isApproved) ? 'Request Permission' : 'Save')
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </Form>
            ) : selectedAppointmentData && selectedAppointmentData.status === 'pending' && !isApprovelessEligible ? (
                /* Appointment Pending Approval State - Gate Entry Locked */
                <div 
                    className="p-4 my-3 rounded-3 border"
                    style={{ 
                        background: isApprovelessEligible ? (isDark ? '#064e3b18' : '#f0fdf4') : (isDark ? '#1e293b' : '#fafafa'), 
                        borderColor: isApprovelessEligible ? (isDark ? '#047857' : '#bbf7d0') : (isDark ? '#334155' : '#e5e7eb') 
                    }}
                >
                    {isApprovelessEligible ? (
                        /* Approveless Entry Authorized Header */
                        <div className="text-center mb-3">
                            <div
                                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                                style={{ 
                                    width: '46px', 
                                    height: '46px', 
                                    background: isDark ? '#064e3b' : '#dcfce7', 
                                    color: isDark ? '#6ee7b7' : '#15803d', 
                                    border: `1px solid ${isDark ? '#059669' : '#bbf7d0'}` 
                                }}
                            >
                                <i className="fa fa-user-shield" style={{ fontSize: '20px' }}></i>
                            </div>

                            <h5 className="fw-semibold text-dark mb-1" style={{ fontSize: '16px' }}>
                                Approveless Entry Authorized
                            </h5>

                            <p className="text-muted small mb-0" style={{ maxWidth: '580px', margin: '0 auto', fontSize: '13px' }}>
                                Host official <strong className="text-dark">{selectedAppointmentData.concerned_staff_name || 'Host Staff'}</strong>
                                {selectedAppointmentData.department_name && ` (${selectedAppointmentData.department_name})`} is pre-authorized for approveless gate clearance. Click <strong className="text-success">Allow Entry</strong> below to admit immediately without waiting for host authorization.
                            </p>
                        </div>
                    ) : (
                        /* Standard Host Approval Required Header */
                        <div className="text-center mb-3">
                            <div
                                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                                style={{ 
                                    width: '44px', 
                                    height: '44px', 
                                    background: isDark ? '#334155' : '#fef3c7', 
                                    color: isDark ? '#fde68a' : '#d97706', 
                                    border: `1px solid ${isDark ? '#475569' : '#fde68a'}` 
                                }}
                            >
                                <i className="fa fa-hourglass-half" style={{ fontSize: '18px' }}></i>
                            </div>

                            <h5 className="fw-semibold text-dark mb-1" style={{ fontSize: '16px' }}>
                                Host Approval Required Before Admission
                            </h5>

                            <p className="text-muted small mb-0" style={{ maxWidth: '580px', margin: '0 auto', fontSize: '13px' }}>
                                Appointment <strong className="text-dark">#{selectedAppointmentData.id}</strong> is currently awaiting authorization from host official{' '}
                                <strong className="text-dark">{selectedAppointmentData.concerned_staff_name || 'Host Staff'}</strong>
                                {selectedAppointmentData.department_name && ` (${selectedAppointmentData.department_name})`}. The gate entry form will automatically unlock once the host employee grants clearance.
                            </p>
                        </div>
                    )}

                    {/* 4 Metric KPI Strip */}
                    <div 
                        className="rounded-3 p-3 mb-3"
                        style={{
                            background: isDark ? '#0f172a' : '#ffffff',
                            border: `1px solid ${isApprovelessEligible ? (isDark ? '#047857' : '#bbf7d0') : (isDark ? '#334155' : '#e5e7eb')}`
                        }}
                    >
                        <Row className="g-3 text-center text-sm-start align-items-center">
                            <Col xs={6} md={3} className="border-end-md">
                                <span className="text-muted text-uppercase d-block" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>APPOINTMENT</span>
                                <span className="fw-bold font-monospace text-dark fs-6">#{selectedAppointmentData.id}</span>
                            </Col>
                            <Col xs={6} md={4} className="border-end-md">
                                <span className="text-muted text-uppercase d-block" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>HOST OFFICIAL</span>
                                <span className="fw-semibold text-dark d-block text-truncate" title={selectedAppointmentData.concerned_staff_name}>
                                    {selectedAppointmentData.concerned_staff_name || 'Unassigned'}
                                </span>
                                {selectedAppointmentData.department_name && (
                                    <small className="text-muted">{selectedAppointmentData.department_name}</small>
                                )}
                            </Col>
                            <Col xs={6} md={2} className="border-end-md">
                                <span className="text-muted text-uppercase d-block" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>TIME</span>
                                <span className="fw-medium text-dark">{selectedAppointmentData.appointment_time || 'Today'}</span>
                            </Col>
                            <Col xs={6} md={3} className="d-flex flex-column align-items-sm-start justify-content-center">
                                <span className="text-muted text-uppercase d-block" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>STATUS</span>
                                {isApprovelessEligible ? (
                                    <span 
                                        className="rounded-pill d-inline-flex align-items-center gap-1.5"
                                        style={{ 
                                            fontSize: '11px', 
                                            fontWeight: 600, 
                                            padding: '4px 10px', 
                                            backgroundColor: '#dcfce7', 
                                            color: '#15803d', 
                                            border: '1px solid #bbf7d0',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        <i className="fa fa-check-circle text-success" style={{ fontSize: '12px' }}></i>
                                        Pre-Authorized
                                    </span>
                                ) : (
                                    <span 
                                        className="rounded-pill d-inline-flex align-items-center gap-1.5"
                                        style={{ 
                                            fontSize: '11px', 
                                            fontWeight: 600, 
                                            padding: '4px 10px', 
                                            backgroundColor: '#fef3c7', 
                                            color: '#92400e', 
                                            border: '1px solid #fde68a',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        <span className="spinner-grow spinner-grow-sm" style={{ width: '6px', height: '6px', color: '#b45309' }}></span>
                                        Awaiting Host
                                    </span>
                                )}
                            </Col>
                        </Row>
                    </div>

                    {/* Actions */}
                    <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap">
                        {isApprovelessEligible ? (
                            <Button
                                className="px-4 py-2 fw-bold text-white shadow-sm d-flex align-items-center gap-2 border-0"
                                style={{ borderRadius: '7px', fontSize: '13px', backgroundColor: '#10b981' }}
                                onClick={handleAllowEntry}
                            >
                                <i className="fa fa-unlock-alt"></i>
                                <span>Allow Entry</span>
                            </Button>
                        ) : (
                            <Button
                                className="px-3.5 py-1.5 fw-semibold text-white shadow-sm d-flex align-items-center gap-2 border-0"
                                style={{ borderRadius: '7px', fontSize: '13px', backgroundColor: '#0a500f' }}
                                onClick={() => loadAppointmentData(selectedAppointmentData.id)}
                                disabled={loading}
                            >
                                {loading ? <Spinner size="sm" /> : <i className="fa fa-sync-alt opacity-75"></i>}
                                <span>Check Approval Status</span>
                            </Button>
                        )}

                        {selectedAppointmentData.contact_number && (
                            <a
                                href={`tel:${selectedAppointmentData.contact_number}`}
                                className="btn btn-outline-secondary px-3 py-1.5 fw-medium shadow-none d-flex align-items-center gap-2 text-decoration-none"
                                style={{ borderRadius: '7px', fontSize: '13px', background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#475569' : '#cbd5e1', color: isDark ? '#cbd5e1' : '#334155' }}
                            >
                                <i className="fa fa-phone-alt text-success"></i>
                                <span>Call Contact: {selectedAppointmentData.contact_number}</span>
                            </a>
                        )}

                        <Button
                            variant="outline-secondary"
                            className="px-3 py-1.5 fw-medium shadow-none d-flex align-items-center gap-2"
                            style={{ borderRadius: '7px', fontSize: '13px', background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#475569' : '#cbd5e1', color: isDark ? '#cbd5e1' : '#334155' }}
                            onClick={() => handleShowAppointments(visitorData?.mobile_no || selectedVehicles?.[0]?.vehicle_number || searchMobile)}
                        >
                            <i className="fa fa-exchange-alt text-muted"></i>
                            <span>Switch Appointment</span>
                        </Button>
                    </div>
                </div>
            ) : selectedAppointmentData && selectedAppointmentData.status === 'rejected' ? (
                /* Appointment Rejected State */
                <div 
                    className="p-4 my-3 rounded-3 text-center border" 
                    style={{ background: isDark ? '#1e293b' : '#fef2f2', borderColor: isDark ? '#7f1d1d' : '#fecaca' }}
                >
                    <div
                        className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                        style={{ width: '44px', height: '44px', background: '#fee2e2', color: '#dc2626' }}
                    >
                        <i className="fa fa-times-circle" style={{ fontSize: '20px' }}></i>
                    </div>

                    <h5 className="fw-semibold text-danger mb-1" style={{ fontSize: '16px' }}>
                        Appointment Rejected
                    </h5>

                    <p className="text-muted small mb-3" style={{ maxWidth: '540px', margin: '0 auto', fontSize: '13px' }}>
                        This appointment was rejected by host official{' '}
                        <strong className="text-dark">{selectedAppointmentData.concerned_staff_name || 'Host Staff'}</strong>. Gate admission cannot be granted for rejected appointments.
                    </p>

                    <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap mb-2">
                        <Button
                            variant="outline-secondary"
                            className="px-3 py-1.5 fw-medium shadow-none d-flex align-items-center gap-2"
                            style={{ borderRadius: '7px', fontSize: '13px', background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#475569' : '#cbd5e1', color: isDark ? '#cbd5e1' : '#334155' }}
                            onClick={() => handleShowAppointments(visitorData?.mobile_no || selectedVehicles?.[0]?.vehicle_number || searchMobile)}
                        >
                            <i className="fa fa-calendar-alt text-muted"></i>
                            <span>Select Different Appointment</span>
                        </Button>
                    </div>
                </div>
            ) : (
                /* Appointment Required State - Hides form fields until appointment is connected */
                <div 
                    className="p-4 my-3 rounded-3 text-center border" 
                    style={{ background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0' }}
                >
                    <div
                        className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2.5"
                        style={{ 
                            width: '48px', 
                            height: '48px', 
                            background: isDark ? 'rgba(10, 80, 15, 0.15)' : '#e8faf2', 
                            color: '#0a500f', 
                            border: `1.5px solid ${isDark ? 'rgba(10, 80, 15, 0.3)' : '#bbf0d8'}` 
                        }}
                    >
                        <i className="fa fa-calendar-check fs-5"></i>
                    </div>

                    <h5 className="fw-bold text-dark mb-1" style={{ fontSize: '16px' }}>
                        Appointment Required for Admission
                    </h5>

                    <p className="text-muted small mb-3" style={{ maxWidth: '520px', margin: '0 auto', fontSize: '13px' }}>
                        {visitorData
                            ? `Visitors must have an appointment before entry. Please select an existing appointment for ${visitorData.visitor_name} or create a fast spot appointment.`
                            : selectedVehicles.length > 0
                                ? `Vehicles must have an appointment before entry. Please select an existing appointment for ${selectedVehicles[0].vehicle_number} or create a spot appointment.`
                                : 'Visitors and vehicles must have an appointment before admission. Please search for a visitor/vehicle or check scheduled appointments to begin.'
                        }
                    </p>

                    <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap mb-2">
                        <Button
                            className="px-3.5 py-2 fw-semibold text-white shadow-sm d-flex align-items-center gap-2 border-0"
                            style={{ borderRadius: '8px', fontSize: '13px', backgroundColor: '#0a500f' }}
                            onClick={() => handleShowAppointments(visitorData?.mobile_no || selectedVehicles?.[0]?.vehicle_number || searchMobile)}
                        >
                            <i className="fa fa-calendar-alt opacity-75"></i>
                            <span>Check Appointments {visitorData ? `for ${visitorData.visitor_name}` : selectedVehicles.length > 0 ? `for ${selectedVehicles[0].vehicle_number}` : ''}</span>
                        </Button>

                        <Button
                            variant="outline-secondary"
                            className="px-3.5 py-2 fw-medium shadow-none d-flex align-items-center gap-2"
                            style={{ borderRadius: '8px', fontSize: '13px', background: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#475569' : '#cbd5e1', color: isDark ? '#cbd5e1' : '#334155' }}
                            onClick={() => {
                                setAppointmentFilterNumber(visitorData?.mobile_no || selectedVehicles?.[0]?.vehicle_number || (searchMobile || '').trim());
                                setAppointmentModalView('create');
                                setShowAppointmentsModal(true);
                            }}
                        >
                            <i className="fa fa-plus text-success"></i>
                            <span>Create Spot Appointment</span>
                        </Button>
                    </div>
                </div>
            ))}

            </div>
            )}

            {/* Multiple Visitor Selection Modal */}
            <Modal
                show={showSelectionModal}
                onHide={() => setShowSelectionModal(false)}
                centered
                size="md"
                className="selection-modal"
            >
                <Modal.Header closeButton className="border-bottom">
                    <Modal.Title className="fw-bold" style={{ fontSize: '16px' }}>
                        Multiple Visitors Found
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    <p className="text-muted small">
                        Several visitors share this mobile number. Please select the correct person:
                    </p>
                    <ListGroup variant="flush" className="rounded-3 border overflow-hidden mt-3">
                        {searchResults.map(visitor => (
                            <ListGroup.Item
                                key={visitor.id}
                                action
                                onClick={() => selectVisitor(visitor)}
                                className="d-flex align-items-center py-3 px-3 cursor-pointer border-bottom"
                            >
                                <div className="me-3">
                                    <Image
                                        src={visitor.visitor_photo ? getFullImageUrl(visitor.visitor_photo) : 'https://via.placeholder.com/40'}
                                        roundedCircle
                                        style={{ width: '40px', height: '40px', objectFit: 'cover' }}
                                    />
                                </div>
                                <div className="flex-grow-1">
                                    <h6 className="mb-0 fw-bold small">{visitor.visitor_name}</h6>
                                    <p className="mb-0 small text-muted">
                                        {visitor.company_name ? `${visitor.company_name}` : 'No Organization'}
                                        {visitor.department_name ? ` • ${visitor.department_name}` : ''}
                                    </p>
                                </div>
                                <i className="fa fa-chevron-right text-muted small ms-2"></i>
                            </ListGroup.Item>
                        ))}
                    </ListGroup>
                </Modal.Body>
                <Modal.Footer className="border-top">
                    <Button variant="secondary" onClick={() => setShowSelectionModal(false)} className="px-4 btn-sm rounded-3">
                        Cancel
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Spot Visitor / Vehicle Registration Modal */}
            <SpotVisitorModal
                show={showSpotModal}
                onHide={() => setShowSpotModal(false)}
                initialMode={entryMode}
                onVisitorCreated={(visitor) => {
                    selectVisitor(visitor);
                }}
                onVehicleCreated={(created) => {
                    setSelectedVehicles(prev => [...prev, created]);
                    setFormData(prev => ({
                        ...prev,
                        company: created.company || '',
                        driver: created.driver || ''
                    }));
                }}
                initialMobile={entryMode === 'visitor' ? searchMobile : ''}
                initialVehicleNumber={entryMode === 'vehicle' ? searchMobile : (searchMobile.match(/[a-zA-Z]/) ? searchMobile : '')}
                initialDepartment={formData.department}
                isDark={isDark}
            />

            <SpotVehicleModal
                show={showSpotVehicleModal}
                onHide={() => setShowSpotVehicleModal(false)}
                initialVehicleNumber={searchMobile}
                onVehicleCreated={(created) => {
                    setSelectedVehicles(prev => [...prev, created]);
                    setFormData(prev => ({
                        ...prev,
                        company: created.company || '',
                        driver: created.driver || ''
                    }));
                }}
            />


            {/* Quick-Add Arrival Gate Modal */}
            <GateFormModal
                show={showGateModal}
                onHide={() => setShowGateModal(false)}
                onSaved={(created) => {
                    fetchMasterData();
                    if (created?.id) setFormData(prev => ({ ...prev, entry_gate: created.id }));
                }}
            />

            {/* Quick-Add Tag Category Modal */}
            <CategoryFormModal
                show={showCategoryModal}
                onHide={() => setShowCategoryModal(false)}
                onSaved={(created) => {
                    fetchMasterData();
                    if (created?.id) setFormData(prev => ({ ...prev, tag_category: created.id }));
                }}
            />

            {/* Quick-Add Gate Pass / Tag Modal */}
            <EntryTagFormModal
                show={showTagModal}
                onHide={() => setShowTagModal(false)}
                onSaved={(created) => {
                    fetchMasterData();
                    if (created?.id) setFormData(prev => ({ ...prev, generated_tag: created.id }));
                }}
                existingCategories={categories}
            />

            {/* Quick-Add Tool / Equipment Modal */}
            <EquipmentFormModal
                show={showEquipmentModal}
                onHide={() => setShowEquipmentModal(false)}
                isDark={isDark}
                onSaved={(created) => {
                    fetchMasterData();
                    if (created?.id) {
                        setSelectedEquipments(prev => [
                            ...prev,
                            {
                                value: created.id,
                                label: created.name,
                                image: created.image ? getFullImageUrl(created.image) : null,
                                code: created.code,
                                description: created.description
                            }
                        ]);
                    }
                }}
            />

            {/* Appointments Modal */}
            <Modal
                show={showAppointmentsModal}
                onHide={() => setShowAppointmentsModal(false)}
                centered
                size="lg"
                enforceFocus={false}
                style={{ zIndex: 1060 }}
                dialogClassName="appointment-custom-modal item-custom-modal"
                backdrop="static"
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
                                {appointmentModalView === 'create' ? 'Create Spot Appointment' : "Today's Appointments"}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                {appointmentModalView === 'create'
                                    ? 'Enter details to manage appointment'
                                    : appointmentFilterNumber
                                        ? `Filtered appointments for "${appointmentFilterNumber}"`
                                        : "Select an appointment to link with gate entry"}
                            </p>
                        </div>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        {appointmentModalView === 'list' ? (
                            <button
                                type="button"
                                className="d-flex align-items-center gap-2 border-0"
                                style={{
                                    background: 'linear-gradient(135deg, #0a500f 0%, #20b876 100%)',
                                    color: '#ffffff',
                                    borderRadius: '8px',
                                    padding: '7px 16px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 2px 6px rgba(10, 80, 15, 0.25)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 4px 10px rgba(10, 80, 15, 0.35)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(10, 80, 15, 0.25)';
                                }}
                                onClick={() => setAppointmentModalView('create')}
                            >
                                <i className="fa fa-plus-circle"></i>
                                <span>+ Spot Appointment</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="d-flex align-items-center gap-2"
                                style={{
                                    background: '#ffffff',
                                    color: '#475569',
                                    border: '1.5px solid #e2e8f0',
                                    borderRadius: '8px',
                                    padding: '7px 16px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f0fdf6';
                                    e.currentTarget.style.borderColor = '#0a500f';
                                    e.currentTarget.style.color = '#15803d';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 3px 8px rgba(10, 80, 15, 0.15)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#ffffff';
                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                    e.currentTarget.style.color = '#475569';
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)';
                                }}
                                onClick={() => setAppointmentModalView('list')}
                            >
                                <i className="fa fa-arrow-left" style={{ fontSize: '12px' }}></i>
                                <span>Today's List</span>
                            </button>
                        )}
                        <div style={{ width: '1px', height: '22px', backgroundColor: '#e2e8f0', margin: '0 4px' }}></div>
                        <button type="button" className="modal-close-x" onClick={() => setShowAppointmentsModal(false)}>
                            &times;
                        </button>
                    </div>
                </div>

                <Modal.Body className="p-0">
                    {appointmentModalView === 'create' ? (
                        <SpotAppointmentView
                            initialMode={entryMode}
                            initialSearch={appointmentFilterNumber || searchMobile}
                            initialVisitor={visitorData}
                            initialVehicle={selectedVehicles?.[0] || null}
                            initialDepartment={formData.department}
                            initialEmployee={formData.employee}
                            initialPurpose={formData.purpose_of_visit}
                            initialCategory={formData.tag_category}
                            categories={categories}
                            isDark={isDark}
                            onSuccess={async (createdApp) => {
                                try {
                                    const appts = await AppointmentService.getTodayAppointments(appointmentFilterNumber || searchMobile || '');
                                    setTodayAppointments(appts || []);
                                } catch (_) {}

                                if (createdApp && createdApp.id) {
                                    await loadAppointmentData(createdApp.id);
                                }
                                setShowAppointmentsModal(false);
                            }}
                            onCancel={() => setAppointmentModalView('list')}
                        />
                    ) : (
                        <>
                            {/* Filter Bar if a number is filtered */}
                            {appointmentFilterNumber && (
                                <div className="py-2 px-4 bg-light border-bottom d-flex align-items-center justify-content-between">
                                    <div className="d-flex align-items-center gap-2">
                                        <span className="small text-muted fw-semibold">Appointments for:</span>
                                        <Badge bg="primary" className="px-2 py-1" style={{ fontSize: '12px', fontWeight: 600 }}>
                                            <i className={/[A-Z]/.test(String(appointmentFilterNumber || '').toUpperCase()) ? "fa fa-truck me-1" : "fa fa-phone me-1"}></i>
                                            {String(appointmentFilterNumber || '')}
                                        </Badge>
                                    </div>
                                    <Button
                                        variant="link"
                                        size="sm"
                                        className="p-0 text-primary text-decoration-none fw-semibold"
                                        style={{ fontSize: '12px' }}
                                        onClick={() => handleShowAppointments('')}
                                    >
                                        <i className="fa fa-times-circle me-1"></i> View All Today's Appointments
                                    </Button>
                                </div>
                            )}

                            {loadingAppointments ? (
                                <div className="text-center p-5">
                                    <Spinner animation="border" variant="primary" />
                                    <p className="text-muted mt-3 mb-0">Loading appointments...</p>
                                </div>
                            ) : todayAppointments.length === 0 ? (
                                <div className="text-center p-5">
                                    <i className="fa fa-calendar-times text-muted fs-1 mb-3"></i>
                                    <p className="text-muted mb-2">
                                        {appointmentFilterNumber ? (
                                            <>No appointments found for <strong>{appointmentFilterNumber}</strong> today.</>
                                        ) : (
                                            'No appointments scheduled for today.'
                                        )}
                                    </p>
                                    <div className="d-flex align-items-center justify-content-center gap-2 mt-3">
                                        <Button
                                            variant="success"
                                            className="px-3 py-2 fw-bold shadow-sm"
                                            style={{ borderRadius: '8px', fontSize: '13px', background: '#0a500f', borderColor: '#0a500f' }}
                                            onClick={() => setAppointmentModalView('create')}
                                        >
                                            <i className="fa fa-plus-circle me-2"></i>
                                            Create Spot Appointment {appointmentFilterNumber ? `for ${appointmentFilterNumber}` : ''}
                                        </Button>
                                        {appointmentFilterNumber && (
                                            <Button
                                                variant="outline-secondary"
                                                className="px-3 py-2 fw-semibold"
                                                style={{ borderRadius: '8px', fontSize: '13px' }}
                                                onClick={() => handleShowAppointments('')}
                                            >
                                                <i className="fa fa-list me-1"></i> View All Today
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <ListGroup variant="flush">
                                    {todayAppointments.map(app => (
                                        <ListGroup.Item 
                                            key={app.id} 
                                            action 
                                            className="d-flex align-items-center p-3 cursor-pointer border-bottom"
                                            onClick={() => {
                                                setShowAppointmentsModal(false);
                                                loadAppointmentData(app.id);
                                            }}
                                        >
                                            <div className={`bg-light rounded-circle d-flex align-items-center justify-content-center me-3 text-${app.vehicle_number ? 'success' : 'primary'}`} style={{ width: '45px', height: '45px' }}>
                                                <i className={`fa ${app.vehicle_number ? 'fa-truck' : 'fa-user'} fs-5`}></i>
                                            </div>
                                            <div className="flex-grow-1">
                                                <h6 className="mb-1 fw-bold text-dark">{app.vehicle_number ? app.vehicle_number : app.visitor_name}</h6>
                                                <div className="d-flex flex-column gap-1">
                                                    <div className="d-flex gap-3 small text-muted">
                                                        {app.vehicle_number ? (
                                                            <span><i className="fa fa-car me-1"></i> {app.vehicle_type_name || 'Vehicle'}</span>
                                                        ) : (
                                                            <span><i className="fa fa-phone-alt me-1"></i> {app.visitor_phone}</span>
                                                        )}
                                                        <span>
                                                            <i className="fa fa-clock me-1"></i> {app.appointment_time}
                                                            {app.appointment_date && app.appointment_date !== new Date().toISOString().split('T')[0] && (
                                                                <span className="badge bg-light text-muted border ms-2 px-2 py-0.5" style={{ fontSize: '10px', borderRadius: '4px' }}>
                                                                    <i className="fa fa-calendar me-1"></i>{formatDateDMY(app.appointment_date)}
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                    {(app.contact_person_name || app.contact_number) && (
                                                        <div className="d-flex gap-3 small text-secondary">
                                                            {app.contact_person_name && (
                                                                <span><i className="fa fa-id-badge me-1"></i> Contact: {app.contact_person_name}</span>
                                                            )}
                                                            {app.contact_number && (
                                                                <span><i className="fa fa-phone me-1"></i> {app.contact_number}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="d-flex align-items-center">
                                                {(() => {
                                                    const isAppApproveless = approvelessConfigs.some(c =>
                                                        c.is_active &&
                                                        String(c.employee) === String(app.concerned_staff) &&
                                                        (!app.department || String(c.department) === String(app.department))
                                                    );
                                                    const isAppApproved = app.status === 'approved' || isAppApproveless;
                                                    return (
                                                        <Badge bg={isAppApproved ? 'success' : 'warning'}>
                                                            {isAppApproved ? 'APPROVED' : (app.status ? app.status.toUpperCase() : 'PENDING')}
                                                        </Badge>
                                                    );
                                                })()}
                                                <i className="fa fa-chevron-right text-muted small ms-3"></i>
                                            </div>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            )}
                        </>
                    )}
                </Modal.Body>
            </Modal>

            {/* Quick-Add Department Modal */}
            <Modal
                show={showDepartmentModal}
                onHide={() => setShowDepartmentModal(false)}
                centered
                size="md"
                dialogClassName="gate-custom-modal"
                backdrop="static"
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-building text-white" style={{ fontSize: '18px' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Add Department
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to add new department
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowDepartmentModal(false)}>
                        &times;
                    </button>
                </div>
                <Form onSubmit={handleCreateDepartment}>
                    <div className="modal-body-custom">
                        <Form.Group className="mb-3">
                            <Form.Label className="form-label-custom">Department Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                className="form-control-custom"
                                placeholder="e.g. Human Resources, Tech, Sales"
                                value={newDepartment.name}
                                onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                                autoFocus
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-2">
                            <Form.Label className="form-label-custom">Department Code</Form.Label>
                            <Form.Control
                                type="text"
                                className="form-control-custom"
                                placeholder="e.g. HR, TECH, SLS"
                                value={newDepartment.code}
                                onChange={(e) => setNewDepartment({ ...newDepartment, code: e.target.value })}
                            />
                        </Form.Group>
                    </div>
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={() => setShowDepartmentModal(false)}>Cancel</button>
                        <button type="submit" className="btn-save-custom" disabled={loadingModal}>{loadingModal ? <Spinner size="sm" /> : 'Save Dept'}</button>
                    </div>
                </Form>
            </Modal>

            {/* Quick-Add Official Modal */}
            <Modal
                show={showOfficialModal}
                onHide={() => setShowOfficialModal(false)}
                centered
                size="md"
                dialogClassName="gate-custom-modal"
                backdrop="static"
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-user-tie text-white" style={{ fontSize: '18px' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Add Official / Employee
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to add staff member
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowOfficialModal(false)}>
                        &times;
                    </button>
                </div>
                <Form onSubmit={handleCreateOfficial}>
                    <div className="modal-body-custom">
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">First Name <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="text"
                                        className="form-control-custom"
                                        placeholder="First Name"
                                        value={newOfficial.first_name}
                                        onChange={(e) => setNewOfficial({ ...newOfficial, first_name: e.target.value })}
                                        autoFocus
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Last Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        className="form-control-custom"
                                        placeholder="Last Name"
                                        value={newOfficial.last_name}
                                        onChange={(e) => setNewOfficial({ ...newOfficial, last_name: e.target.value })}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Email <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="email"
                                        className="form-control-custom"
                                        placeholder="email@example.com"
                                        value={newOfficial.email}
                                        onChange={(e) => setNewOfficial({ ...newOfficial, email: e.target.value })}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Phone</Form.Label>
                                    <Form.Control
                                        type="text"
                                        className="form-control-custom"
                                        placeholder="Phone number"
                                        value={newOfficial.phone}
                                        onChange={(e) => setNewOfficial({ ...newOfficial, phone: e.target.value })}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Form.Group className="mb-2">
                            <Form.Label className="form-label-custom">Department</Form.Label>
                            <Select
                                className="react-select-container"
                                classNamePrefix="react-select"
                                styles={selectStyles}
                                options={departmentOptions}
                                value={departmentOptions.find(o => String(o.value) === String(newOfficial.department)) || null}
                                onChange={(sel) => setNewOfficial({ ...newOfficial, department: sel ? sel.value : '' })}
                                placeholder="Select Department..."
                                isClearable
                            />
                        </Form.Group>
                    </div>
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={() => setShowOfficialModal(false)}>Cancel</button>
                        <button type="submit" className="btn-save-custom" disabled={loadingModal}>{loadingModal ? <Spinner size="sm" /> : 'Save Official'}</button>
                    </div>
                </Form>
            </Modal>

            {/* Vehicle Camera Capture Modal */}
            <CameraCapture
                show={showCamera}
                onHide={() => {
                    setShowCamera(false);
                    setActiveVehicleCameraIndex(null);
                }}
                onCapture={handleVehicleCameraCapture}
                title={activeVehicleCameraIndex !== null ? `Capture Photo for Vehicle #${activeVehicleCameraIndex + 1}` : 'Capture Vehicle Photo'}
                isDark={isDark}
            />

            {/* Supporting Document Camera Capture Modal */}
            <CameraCapture
                show={showDocCamera}
                onHide={() => setShowDocCamera(false)}
                onCapture={handleDocCameraCapture}
                title="Capture Supporting Document Photo"
                isDark={isDark}
            />

            {/* Employee Face Enrollment Modal */}
            <GateFaceEnrollModal
                show={showFaceEnrollModal}
                onHide={() => setShowFaceEnrollModal(false)}
                onEnrolled={(emp) => {
                    Swal.fire({
                        icon: 'success',
                        title: 'Face Enrolled!',
                        text: `Facial descriptor registered successfully for ${emp?.first_name || ''} ${emp?.last_name || ''} (${emp?.employment_no || ''}).`,
                        timer: 2500,
                        showConfirmButton: false
                    });
                }}
                isDark={isDark}
            />

            {/* Employee Vehicle Switch / Assign Modal - Matching Fines & Tokens Design Standard */}
            <Modal
                show={showSwitchVehicleModal}
                onHide={() => !submittingVehicleSwitch && setShowSwitchVehicleModal(false)}
                backdrop="static"
                keyboard={false}
                centered
                size="lg"
                dialogClassName="custom-modal-fade"
                contentClassName="border-0 shadow-lg"
                style={{ borderRadius: '16px', overflow: 'hidden' }}
            >
                <div style={{
                    padding: '24px 32px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    background: isDark ? '#1e293b' : '#ffffff',
                    color: isDark ? '#f8fafc' : '#1e293b'
                }}>
                    <form onSubmit={handleConfirmSwitchVehicle}>
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
                                background-color: ${isDark ? '#0f172a' : '#f8fafc'} !important;
                                border-color: ${isDark ? '#334155' : '#e2e8f0'} !important;
                                color: ${isDark ? '#94a3b8' : '#64748b'} !important;
                            }
                            .veh-tab-btn:not(.active):hover {
                                background-color: ${isDark ? '#1e293b' : '#f1f5f9'} !important;
                                color: ${isDark ? '#f8fafc' : '#1e293b'} !important;
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
                                        <h5 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: isDark ? '#fff' : '#1e293b' }}>
                                            {switchMode === 'new' ? 'Register New Vehicle' : 'Update Check-in Vehicle'}
                                        </h5>
                                        <p style={{ margin: 0, fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                                            {switchMode === 'new'
                                                ? 'Add and assign a vehicle to the employee'
                                                : 'Select or switch employee check-in vehicle preferences'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => !submittingVehicleSwitch && setShowSwitchVehicleModal(false)}
                                    aria-label="Close"
                                    style={isDark ? { filter: 'invert(1)' } : {}}
                                />
                            </div>
                        </div>

                        <hr style={{ borderColor: isDark ? '#334155' : '#e2e8f0', margin: '16px 0 20px 0' }} />

                        {/* Employee Identity Box */}
                        {targetEntryForVehicleSwitch && (
                            <div className="p-3 rounded border mb-3 d-flex align-items-center justify-content-between" style={{ background: isDark ? '#0f172a' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0', borderRadius: '10px' }}>
                                <div>
                                    <div className="fw-bold" style={{ color: isDark ? '#fff' : '#1e293b', fontSize: '0.95rem' }}>{targetEntryForVehicleSwitch.employee_name || 'Employee'}</div>
                                    <div className="text-muted" style={{ fontSize: '12px' }}>
                                        ID: <span className="fw-semibold" style={{ color: isDark ? '#cbd5e1' : '#1e293b' }}>{targetEntryForVehicleSwitch.employment_no || '—'}</span> &bull; Current: <strong style={{ color: '#0a500f' }}>{targetEntryForVehicleSwitch.vehicle_number || 'No Vehicle'}</strong>
                                    </div>
                                </div>
                                <div>
                                    <span className="badge badge-success light py-1 px-2" style={{ fontSize: '11px' }}>
                                        <span className="me-1">●</span> Inside Campus
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Navigation Pills (Existing vs Register New) */}
                        <div className="d-flex gap-2 mb-3">
                            <button
                                type="button"
                                className={`btn veh-tab-btn flex-fill ${switchMode === 'existing' ? 'active' : ''}`}
                                onClick={() => setSwitchMode('existing')}
                            >
                                <i className="fa fa-list me-1.5"></i> Registered Vehicles {employeeRegisteredVehicles.length > 0 && `(${employeeRegisteredVehicles.length})`}
                            </button>
                            <button
                                type="button"
                                className={`btn veh-tab-btn flex-fill ${switchMode === 'new' ? 'active' : ''}`}
                                onClick={() => {
                                    setSwitchMode('new');
                                    if (!newSwitchVehicleType) {
                                        setNewSwitchVehicleType(getEmployeeVehicleTypeId(gateVehicleTypes));
                                    }
                                }}
                            >
                                <i className="fa fa-plus me-1.5"></i> Register New Vehicle
                            </button>
                        </div>

                        {switchMode === 'existing' ? (
                            <div>
                                {loadingEmpVehicles ? (
                                    <div className="text-center py-4">
                                        <Spinner animation="border" size="sm" variant="primary" />
                                        <div className="small text-muted mt-2">Loading registered vehicles...</div>
                                    </div>
                                ) : employeeRegisteredVehicles.length === 0 ? (
                                    <div className="p-4 text-center rounded border text-muted small mb-3" style={{ background: isDark ? '#0f172a' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0', borderRadius: '10px' }}>
                                        <i className="fa fa-car fa-2x text-muted mb-2 opacity-50 d-block"></i>
                                        No registered vehicles found for this employee.
                                        <div className="mt-2">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-link text-decoration-none fw-semibold"
                                                style={{ color: '#0a500f' }}
                                                onClick={() => setSwitchMode('new')}
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
                                                style={{
                                                    background: isDark ? '#0f172a' : '#fff',
                                                    color: isDark ? '#fff' : '#000',
                                                    borderColor: isDark ? '#334155' : '#e2e8f0'
                                                }}
                                            >
                                                <option value="">-- Choose from Registered Vehicles --</option>
                                                {employeeRegisteredVehicles.map(v => (
                                                    <option key={v.id} value={v.id}>
                                                        {v.vehicle_number} {v.is_preferred ? '★ [Preferred]' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="row">
                                <div className="form-group col-md-6 col-12 mb-3">
                                    <label className="fw-semibold">New Vehicle Number / Plate <span className="text-danger">*</span></label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. KL 07 CD 5678"
                                        value={newSwitchVehicleNumber}
                                        onChange={(e) => setNewSwitchVehicleNumber(e.target.value.toUpperCase())}
                                        required
                                        autoFocus
                                        style={{
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            fontWeight: 600,
                                            background: isDark ? '#0f172a' : '#fff',
                                            color: isDark ? '#fff' : '#000',
                                            borderColor: isDark ? '#334155' : '#e2e8f0'
                                        }}
                                    />
                                </div>

                                <div className="form-group col-md-6 col-12 mb-3">
                                    <label className="fw-semibold">Vehicle Type</label>
                                    <select
                                        className="form-control form-select"
                                        value={newSwitchVehicleType || getEmployeeVehicleTypeId(gateVehicleTypes)}
                                        onChange={(e) => setNewSwitchVehicleType(e.target.value)}
                                        style={{
                                            background: isDark ? '#0f172a' : '#fff',
                                            color: isDark ? '#fff' : '#000',
                                            borderColor: isDark ? '#334155' : '#e2e8f0'
                                        }}
                                    >
                                        <option value="">-- Select Type --</option>
                                        {gateVehicleTypes.map(vt => (
                                            <option key={vt.id} value={vt.id}>{vt.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="row">
                            <div className="col-12 mb-3">
                                <div className="p-3 rounded border" style={{ background: isDark ? '#0f172a' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0', borderRadius: '8px' }}>
                                    <Form.Check
                                        type="switch"
                                        id="form-switch-pref-toggle"
                                        label={
                                            <div>
                                                <span className="fw-semibold" style={{ color: isDark ? '#fff' : '#1e293b', fontSize: '13px' }}>Set as Employee's New Preferred Vehicle</span>
                                                <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                                                    Future check-ins will automatically default to this vehicle number.
                                                </div>
                                            </div>
                                        }
                                        checked={switchSetAsPreferred}
                                        onChange={(e) => setSwitchSetAsPreferred(e.target.checked)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer Actions - Exact Fines & Tokens Buttons */}
                        <div
                            className="modal-actions d-flex justify-content-end align-items-center gap-2 mt-4 pt-3"
                            style={{ borderTop: isDark ? '1px solid #334155' : '1px solid #f1f5f9' }}
                        >
                            <button
                                type="button"
                                className="pkg-close-btn"
                                onClick={() => !submittingVehicleSwitch && setShowSwitchVehicleModal(false)}
                                disabled={submittingVehicleSwitch}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="pkg-submit-btn d-flex align-items-center gap-2"
                                disabled={submittingVehicleSwitch || (switchMode === 'existing' && !selectedExistingVehicleId)}
                            >
                                {submittingVehicleSwitch && <Spinner animation="border" size="sm" />}
                                {switchMode === 'existing' ? 'Update & Switch Vehicle' : 'Save & Register Vehicle'}
                            </button>
                        </div>
                    </form>
                </div>
            </Modal>


            {/* COMPANY VEHICLE CHECKOUT PURPOSE MODAL */}
            <Modal
                show={showCompanyCheckoutModal}
                onHide={() => !isSubmittingCheckout && setShowCompanyCheckoutModal(false)}
                centered
                size="md"
                dialogClassName="item-custom-modal company-checkout-modal"
                backdrop="static"
            >
                <div className="modal-header-custom" style={{ padding: '20px 24px 16px 24px' }}>
                    <div className="d-flex align-items-center gap-3">
                        <div 
                            className="modal-icon-circle"
                            style={{
                                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                width: '42px',
                                height: '42px',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}
                        >
                            <i className="fa fa-truck text-white" style={{ fontSize: '18px' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '17px', color: '#1e293b' }}>
                                Company Vehicle Exit Clearance
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Vehicle: <strong className="text-dark">{companyVehicleToCheckout?.vehicle_number}</strong> • Purpose of Exit
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        className="modal-close-x" 
                        onClick={() => !isSubmittingCheckout && setShowCompanyCheckoutModal(false)}
                        disabled={isSubmittingCheckout}
                    >
                        &times;
                    </button>
                </div>

                <Modal.Body className="p-4">
                    <div className="mb-3 text-muted" style={{ fontSize: '13px' }}>
                        Please select the reason for this company vehicle departing campus:
                    </div>

                    {/* 2 Purpose Option Cards */}
                    <div className="row g-3 mb-3">
                        {/* Other Purpose Card */}
                        <div className="col-6">
                            <div
                                onClick={() => setCheckoutPurpose('other')}
                                style={{
                                    border: checkoutPurpose === 'other' ? '2px solid #0d9488' : `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    background: checkoutPurpose === 'other' 
                                        ? (isDark ? 'rgba(13, 148, 136, 0.15)' : '#f0fdfa') 
                                        : (isDark ? '#1e293b' : '#ffffff'),
                                    borderRadius: '12px',
                                    padding: '16px 12px',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: checkoutPurpose === 'other' ? '0 4px 12px rgba(13, 148, 136, 0.2)' : '0 1px 3px rgba(0,0,0,0.02)',
                                    position: 'relative',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between'
                                }}
                            >
                                {checkoutPurpose === 'other' && (
                                    <div 
                                        style={{ 
                                            position: 'absolute', 
                                            top: '8px', 
                                            right: '8px', 
                                            width: '18px', 
                                            height: '18px', 
                                            borderRadius: '50%', 
                                            background: '#0d9488', 
                                            color: '#fff', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            fontSize: '10px' 
                                        }}
                                    >
                                        <i className="fa fa-check"></i>
                                    </div>
                                )}
                                <div>
                                    <div 
                                        className="mx-auto mb-2 rounded-circle d-flex align-items-center justify-content-center"
                                        style={{
                                            width: '46px',
                                            height: '46px',
                                            background: checkoutPurpose === 'other' ? '#ccfbf1' : (isDark ? '#334155' : '#f1f5f9'),
                                            color: checkoutPurpose === 'other' ? '#0f766e' : '#64748b',
                                            fontSize: '20px'
                                        }}
                                    >
                                        <i className="fa fa-clipboard-list"></i>
                                    </div>
                                    <h6 className="fw-bold mb-1" style={{ fontSize: '14px', color: isDark ? '#f8fafc' : '#0f172a' }}>
                                        Other Purpose
                                    </h6>
                                    <p className="text-muted mb-0" style={{ fontSize: '11px', lineHeight: '1.3' }}>
                                        Servicing, repairs, official errands, or general company use
                                    </p>
                                </div>
                                <div className="mt-3">
                                    <span 
                                        className="badge rounded-pill"
                                        style={{
                                            fontSize: '10px',
                                            fontWeight: 600,
                                            backgroundColor: checkoutPurpose === 'other' ? '#ccfbf1' : '#f1f5f9',
                                            color: checkoutPurpose === 'other' ? '#115e59' : '#64748b',
                                            border: `1px solid ${checkoutPurpose === 'other' ? '#99f6e4' : '#e2e8f0'}`,
                                            padding: '4px 8px'
                                        }}
                                    >
                                        📝 Purpose Note Required
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Delivery Card */}
                        <div className="col-6">
                            <div
                                onClick={() => setCheckoutPurpose('delivery')}
                                style={{
                                    border: checkoutPurpose === 'delivery' ? '2px solid #0284c7' : `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    background: checkoutPurpose === 'delivery' 
                                        ? (isDark ? 'rgba(2, 132, 199, 0.15)' : '#f0f9ff') 
                                        : (isDark ? '#1e293b' : '#ffffff'),
                                    borderRadius: '12px',
                                    padding: '16px 12px',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: checkoutPurpose === 'delivery' ? '0 4px 12px rgba(2, 132, 199, 0.18)' : '0 1px 3px rgba(0,0,0,0.02)',
                                    position: 'relative',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between'
                                }}
                            >
                                {checkoutPurpose === 'delivery' && (
                                    <div 
                                        style={{ 
                                            position: 'absolute', 
                                            top: '8px', 
                                            right: '8px', 
                                            width: '18px', 
                                            height: '18px', 
                                            borderRadius: '50%', 
                                            background: '#0284c7', 
                                            color: '#fff', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            fontSize: '10px' 
                                        }}
                                    >
                                        <i className="fa fa-check"></i>
                                    </div>
                                )}
                                <div>
                                    <div 
                                        className="mx-auto mb-2 rounded-circle d-flex align-items-center justify-content-center"
                                        style={{
                                            width: '46px',
                                            height: '46px',
                                            background: checkoutPurpose === 'delivery' ? '#e0f2fe' : (isDark ? '#334155' : '#f1f5f9'),
                                            color: checkoutPurpose === 'delivery' ? '#0284c7' : '#64748b',
                                            fontSize: '20px'
                                        }}
                                    >
                                        <i className="fa fa-shipping-fast"></i>
                                    </div>
                                    <h6 className="fw-bold mb-1" style={{ fontSize: '14px', color: isDark ? '#f8fafc' : '#0f172a' }}>
                                        Delivery
                                    </h6>
                                    <p className="text-muted mb-0" style={{ fontSize: '11px', lineHeight: '1.3' }}>
                                        Goods dispatch, orders or customer delivery
                                    </p>
                                </div>
                                <div className="mt-3">
                                    <span 
                                        className="badge rounded-pill"
                                        style={{
                                            fontSize: '10px',
                                            fontWeight: 600,
                                            backgroundColor: checkoutPurpose === 'delivery' ? '#e0f2fe' : '#f1f5f9',
                                            color: checkoutPurpose === 'delivery' ? '#0369a1' : '#64748b',
                                            border: `1px solid ${checkoutPurpose === 'delivery' ? '#7dd3fc' : '#e2e8f0'}`,
                                            padding: '4px 8px'
                                        }}
                                    >
                                        📋 Delivery Note Required
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Delivery Form (Only visible when Purpose is Delivery) */}
                    {checkoutPurpose === 'delivery' && (
                        <div 
                            className="p-3 rounded-3 mt-3"
                            style={{
                                background: isDark ? '#0f172a' : '#f8fafc',
                                border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`
                            }}
                        >
                            <div className="d-flex align-items-center mb-2.5 pb-2 border-bottom" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                                <i className="fa fa-file-invoice text-info me-2" style={{ fontSize: '13px' }}></i>
                                <span className="fw-bold text-dark" style={{ fontSize: '13px' }}>Delivery Documentation</span>
                            </div>

                            <Form.Group className="mb-3">
                                <Form.Label className="fw-semibold text-dark mb-1" style={{ fontSize: '12.5px' }}>
                                    Delivery Note Number <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="Enter Delivery Note # (e.g. DN-2026-0045, INV-8921)..."
                                    value={deliveryNoteNumber}
                                    onChange={(e) => setDeliveryNoteNumber(e.target.value.toUpperCase())}
                                    className="form-control shadow-none"
                                    style={{
                                        height: '38px',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        borderColor: isDark ? '#334155' : '#cbd5e1',
                                        background: isDark ? '#1e293b' : '#ffffff',
                                        color: isDark ? '#f8fafc' : '#0f172a',
                                        transition: 'border-color 0.2s, box-shadow 0.2s'
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = '#0284c7';
                                        e.target.style.boxShadow = '0 0 0 3px rgba(2, 132, 199, 0.15)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = isDark ? '#334155' : '#cbd5e1';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                    autoFocus
                                />
                                {!deliveryNoteNumber.trim() && (
                                    <div className="text-danger mt-1" style={{ fontSize: '11px' }}>
                                        * Please enter the delivery note number to complete checkout.
                                    </div>
                                )}
                            </Form.Group>

                            <Form.Group className="mb-1">
                                <Form.Label className="fw-semibold text-dark mb-1 d-flex justify-content-between align-items-center" style={{ fontSize: '12.5px' }}>
                                    <span>Attach Delivery Note Image / Proof</span>
                                    <span className="text-muted" style={{ fontSize: '11px' }}>Optional / Recommended</span>
                                </Form.Label>
                                
                                {deliveryNotePreview ? (
                                    <div 
                                        className="p-2 rounded-3 d-flex align-items-center justify-content-between"
                                        style={{
                                            background: isDark ? '#1e293b' : '#ffffff',
                                            border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`
                                        }}
                                    >
                                        <div className="d-flex align-items-center gap-2.5">
                                            <img
                                                src={deliveryNotePreview}
                                                alt="Delivery Note Preview"
                                                style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                            />
                                            <div style={{ maxWidth: '240px' }}>
                                                <div className="fw-semibold text-truncate text-dark" style={{ fontSize: '12px' }}>
                                                    {deliveryNotePhoto?.name || 'delivery_note.jpg'}
                                                </div>
                                                <div className="text-muted" style={{ fontSize: '10.5px' }}>
                                                    {deliveryNotePhoto?.size ? `${(deliveryNotePhoto.size / 1024).toFixed(1)} KB` : 'Image attached'}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1 py-1 px-2"
                                            style={{ fontSize: '11px', borderRadius: '6px' }}
                                            onClick={() => {
                                                setDeliveryNotePhoto(null);
                                                setDeliveryNotePreview(null);
                                            }}
                                        >
                                            <i className="fa fa-trash-alt"></i> Remove
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        className="p-3 text-center rounded-3"
                                        style={{
                                            border: '2px dashed #cbd5e1',
                                            background: isDark ? '#1e293b' : '#ffffff',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onClick={() => {
                                            const fileInput = document.getElementById('companyDeliveryNoteFileInput');
                                            if (fileInput) fileInput.click();
                                        }}
                                    >
                                        <i className="fa fa-camera-retro mb-1 d-block" style={{ fontSize: '20px', color: '#0284c7' }}></i>
                                        <div className="fw-semibold text-dark" style={{ fontSize: '12px' }}>
                                            Attach Delivery Note Photo
                                        </div>
                                        <div className="text-muted" style={{ fontSize: '11px' }}>
                                            Click to take photo or upload file (JPG, PNG)
                                        </div>
                                        <input
                                            id="companyDeliveryNoteFileInput"
                                            type="file"
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            onChange={(e) => {
                                                const file = e.target.files && e.target.files[0];
                                                if (file) {
                                                    setDeliveryNotePhoto(file);
                                                    setDeliveryNotePreview(URL.createObjectURL(file));
                                                }
                                            }}
                                        />
                                    </div>
                                )}
                            </Form.Group>
                        </div>
                    )}

                    {/* Other Purpose Form (Only visible when Purpose is Other Purpose) */}
                    {checkoutPurpose === 'other' && (
                        <div 
                            className="p-3 rounded-3 mt-3"
                            style={{
                                background: isDark ? '#0f172a' : '#f8fafc',
                                border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`
                            }}
                        >
                            <div className="d-flex align-items-center mb-2.5 pb-2 border-bottom" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                                <i className="fa fa-pen-fancy me-2" style={{ fontSize: '13px', color: '#0d9488' }}></i>
                                <span className="fw-bold text-dark" style={{ fontSize: '13px' }}>Purpose Details</span>
                            </div>

                            <Form.Group className="mb-0">
                                <Form.Label className="fw-semibold text-dark mb-1" style={{ fontSize: '12.5px' }}>
                                    Purpose Note <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="Enter details / reason for checkout (e.g. Servicing, Routine workshop inspection, Official errand)..."
                                    value={purposeNote}
                                    onChange={(e) => setPurposeNote(e.target.value)}
                                    className="form-control shadow-none"
                                    style={{
                                        height: '38px',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        borderColor: isDark ? '#334155' : '#cbd5e1',
                                        background: isDark ? '#1e293b' : '#ffffff',
                                        color: isDark ? '#f8fafc' : '#0f172a',
                                        transition: 'border-color 0.2s, box-shadow 0.2s'
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = '#0d9488';
                                        e.target.style.boxShadow = '0 0 0 3px rgba(13, 148, 136, 0.15)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = isDark ? '#334155' : '#cbd5e1';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                    autoFocus
                                />
                                {!purposeNote.trim() && (
                                    <div className="text-danger mt-1" style={{ fontSize: '11px' }}>
                                        * Please enter a purpose note to complete checkout.
                                    </div>
                                )}
                            </Form.Group>
                        </div>
                    )}
                </Modal.Body>

                <div 
                    className="modal-footer-custom d-flex align-items-center justify-content-between p-3 border-top"
                    style={{ borderColor: isDark ? '#334155' : '#f1f5f9' }}
                >
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary px-3 py-1.5"
                        style={{ borderRadius: '7px', fontSize: '13px' }}
                        onClick={() => setShowCompanyCheckoutModal(false)}
                        disabled={isSubmittingCheckout}
                    >
                        Cancel
                    </button>

                    <div className="d-flex align-items-center gap-2">
                        {checkoutPurpose === 'other' ? (
                            <Button
                                className="d-inline-flex align-items-center gap-1.5 px-4 py-2 border-0 text-white shadow-sm"
                                style={{
                                    backgroundColor: '#0d9488',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    opacity: !purposeNote.trim() ? 0.6 : 1
                                }}
                                onClick={() => handleConfirmCompanyCheckout('other')}
                                disabled={isSubmittingCheckout || !purposeNote.trim()}
                            >
                                {isSubmittingCheckout ? (
                                    <>
                                        <Spinner size="sm" className="me-1 text-white" />
                                        <span>Checking Out...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa fa-clipboard-check"></i>
                                        <span>Check Out (Other Purpose)</span>
                                    </>
                                )}
                            </Button>
                        ) : (
                            <Button
                                className="d-inline-flex align-items-center gap-1.5 px-4 py-2 border-0 text-white shadow-sm"
                                style={{
                                    backgroundColor: '#0284c7',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    opacity: !deliveryNoteNumber.trim() ? 0.6 : 1
                                }}
                                onClick={() => handleConfirmCompanyCheckout('delivery')}
                                disabled={isSubmittingCheckout || !deliveryNoteNumber.trim()}
                            >
                                {isSubmittingCheckout ? (
                                    <>
                                        <Spinner size="sm" className="me-1" />
                                        <span>Checking Out...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa fa-truck"></i>
                                        <span>Check Out with Delivery Note</span>
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </Modal>

            <style dangerouslySetInnerHTML={{
                __html: `
                .form-control-custom {
                    border: 1px solid #cbd5e1 !important;
                    border-radius: 10px;
                    padding: 8px 12px;
                    font-size: 13px;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                .unified-search-box:focus-within {
                    border-color: #0a500f !important;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15) !important;
                }
                input.form-control-custom,
                select.form-control-custom {
                    height: 38px !important;
                    min-height: 38px !important;
                }
                .form-control-custom:focus {
                    border-color: #0a500f !important;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15) !important;
                    outline: none;
                }
                .form-control-custom.is-invalid,
                .form-control-custom:invalid:not(:placeholder-shown) {
                    border-color: #ef4444 !important;
                }
                .vehicle-input-upper {
                    text-transform: uppercase !important;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                }
                .vehicle-input-upper::placeholder {
                    text-transform: none !important;
                    font-weight: 400 !important;
                    letter-spacing: normal !important;
                    color: #94a3b8 !important;
                }
                .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                    display: flex;
                    align-items: center;
                }
                .quick-add-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    background: linear-gradient(135deg, #0a500f, #073d0b);
                    border: none;
                    color: white;
                    font-size: 18px;
                    font-weight: 400;
                    line-height: 1;
                    cursor: pointer;
                    flex-shrink: 0;
                    transition: opacity 0.2s, transform 0.15s;
                    box-shadow: 0 2px 6px rgba(10, 80, 15,0.35);
                    margin-top: 1px;
                }
                .quick-add-btn:hover {
                    opacity: 0.88;
                    transform: scale(1.08);
                }
                .quick-add-btn:active { transform: scale(0.96); }
                .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    border-color: #0a500f !important;
                    color: #fff !important;
                    font-weight: 500;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border-radius: 8px;
                }
                .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    border-color: #0a500f !important;
                    color: #fff !important;
                    font-weight: 500;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border-radius: 8px;
                }
                .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                .appointment-custom-modal .modal-content,
                .item-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                @keyframes pulseAmber {
                    0% { transform: scale(0.96); box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.45); }
                    70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(217, 119, 6, 0); }
                    100% { transform: scale(0.96); box-shadow: 0 0 0 0 rgba(217, 119, 6, 0); }
                }
                .pulse-amber-glow {
                    animation: pulseAmber 2.2s infinite;
                }
                .appointment-custom-modal .modal-header-custom,
                .item-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                    background-color: #ffffff;
                }
                .appointment-custom-modal .modal-icon-circle,
                .item-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                    flex-shrink: 0;
                }
                .appointment-custom-modal .modal-close-x,
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
                .appointment-custom-modal .modal-close-x:hover,
                .item-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                `
            }} />
        </div>
    );


    const rightColumn = (
        <div 
            style={{ 
                height: '100%', 
                maxHeight: '75vh',
                display: 'flex', 
                flexDirection: 'column', 
                borderRadius: '16px', 
                overflow: 'hidden', 
                border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`, 
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                background: isDark ? '#1e293b' : '#ffffff',
                position: 'sticky',
                top: '0'
            }}
        >
            <div 
                style={{ 
                    background: isDark ? '#0f172a' : '#ffffff', 
                    borderBottom: `2px solid ${isDark ? '#334155' : '#e8fdf4'}`, 
                    padding: '12px 16px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between' 
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#e8fdf4', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fa fa-history" style={{ color: '#0a500f', fontSize: '0.9rem' }}></i>
                    </div>
                    <div>
                        <div style={{ color: isDark ? '#f8fafc' : '#1e293b', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.3px' }}>Previous Engagements</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                            {engagementHistory.length > 0 ? `${engagementHistory.length} visit${engagementHistory.length > 1 ? 's' : ''} recorded` : 'No history yet'}
                        </div>
                    </div>
                </div>
                <button 
                    onClick={() => setShowHistory(false)} 
                    style={{ background: isDark ? '#334155' : '#f1f5f9', border: 'none', borderRadius: '8px', color: '#94a3b8', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.8rem' }} 
                    title="Hide panel"
                >
                    <i className="fa fa-times"></i>
                </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', background: isDark ? '#1e293b' : '#f8fafc', padding: '12px' }}>
                {loadingHistory ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '12px' }}>
                        <div className="spinner-border spinner-border-sm text-primary"></div>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Loading history...</span>
                    </div>
                ) : engagementHistory && engagementHistory.length > 0 ? (
                    <div style={{ position: 'relative', paddingLeft: '22px' }}>
                        <div style={{ position: 'absolute', left: '8px', top: '8px', bottom: '8px', width: '2px', background: 'linear-gradient(to bottom, #0a500f, #e2e8f0)' }}></div>
                        {engagementHistory.map((eng, idx) => {
                            const dateStr = eng.entry_time ? new Date(eng.entry_time).toLocaleDateString('en-GB') : 'Unknown Date';
                            const inTime = eng.entry_time ? new Date(eng.entry_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
                            const outTime = eng.exit_time ? new Date(eng.exit_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : null;
                            const metPerson = entryMode === 'visitor' ? eng.employee_name : (eng.driver || 'N/A');
                            const purpose = eng.purpose_of_visit || eng.purpose || null;
                            const isOut = !!eng.exit_time || (entryMode === 'vehicle' && eng.status === 'exited') || (entryMode === 'visitor' && eng.verification_status === 'exited');
                            let duration = null;
                            if (eng.entry_time && eng.exit_time) {
                                const mins = Math.round((new Date(eng.exit_time) - new Date(eng.entry_time)) / 60000);
                                duration = mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h ${mins%60}m`;
                            }
                            return (
                                <div key={idx} style={{ position: 'relative', marginBottom: '10px' }}>
                                    <div style={{ position: 'absolute', left: '-18px', top: '12px', width: '9px', height: '9px', borderRadius: '50%', background: isOut ? '#0a500f' : '#f59e0b', border: '2px solid #fff', boxShadow: `0 0 0 2px ${isOut ? '#0a500f' : '#f59e0b'}44` }}></div>
                                    <div style={{ background: isDark ? '#0f172a' : '#fff', borderRadius: '12px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                                        <div style={{ padding: '7px 10px', background: isOut ? (isDark ? 'rgba(34, 197, 94, 0.1)' : 'linear-gradient(90deg, #f0fdf4, #fff)') : (isDark ? 'rgba(245, 158, 11, 0.1)' : 'linear-gradient(90deg, #fffbeb, #fff)'), borderBottom: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.75rem', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                                <i className="fa fa-calendar-day me-1" style={{ color: '#94a3b8' }}></i>{dateStr}
                                            </span>
                                            <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.4px', padding: '1px 7px', borderRadius: '20px', background: isOut ? '#dcfce7' : '#fef3c7', color: isOut ? '#16a34a' : '#d97706' }}>
                                                {isOut ? '\u2713 EXITED' : '\u25cf IN CAMPUS'}
                                            </span>
                                        </div>
                                        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <i className="fa fa-sign-in-alt text-success"></i>
                                                    <strong style={{ color: isDark ? '#f8fafc' : '#1e293b' }}>{inTime}</strong>
                                                </span>
                                                {outTime && (<>
                                                    <span style={{ color: '#cbd5e1' }}>&#8594;</span>
                                                    <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                        <i className="fa fa-sign-out-alt text-danger"></i>
                                                        <strong style={{ color: isDark ? '#f8fafc' : '#1e293b' }}>{outTime}</strong>
                                                    </span>
                                                </>)}
                                                {duration && (
                                                    <span style={{ marginLeft: 'auto', fontSize: '0.62rem', fontWeight: 600, background: isDark ? '#334155' : '#f1f5f9', color: isDark ? '#e2e8f0' : '#475569', padding: '1px 6px', borderRadius: '8px' }}>
                                                        <i className="fa fa-hourglass-half me-1" style={{ fontSize: '0.55rem' }}></i>{duration}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <i className={entryMode === 'visitor' ? 'fa fa-user-tie' : 'fa fa-id-card'} style={{ color: '#94a3b8', width: '12px' }}></i>
                                                <span style={{ color: '#94a3b8' }}>{entryMode === 'visitor' ? 'Met' : 'Driver'}:</span>
                                                <strong style={{ color: isDark ? '#cbd5e1' : '#334155' }}>{metPerson}</strong>
                                            </div>
                                            {purpose && (
                                                <div style={{ fontSize: '0.68rem', color: isDark ? '#94a3b8' : '#64748b', background: isDark ? '#1e293b' : '#f8fafc', borderRadius: '6px', padding: '3px 7px', borderLeft: '2px solid #0a500f', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={purpose}>
                                                    <i className="fa fa-quote-left me-1" style={{ fontSize: '0.55rem', color: '#cbd5e1' }}></i>{purpose}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', textAlign: 'center' }}>
                        <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                            <i className="fa fa-calendar-times" style={{ fontSize: '1.3rem', color: '#cbd5e1' }}></i>
                        </div>
                        <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.82rem', marginBottom: '2px' }}>No History Found</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>This is their first registered visit</div>
                    </div>
                )}
            </div>

            {/* Current Outstandings Section at the bottom of Previous Engagements */}
            {hasOutstandings && activeOutstandings && (
                <div 
                    style={{ 
                        background: isDark ? '#0b1324' : '#ffffff', 
                        borderTop: `2px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        padding: '12px 14px',
                        boxShadow: '0 -4px 14px rgba(0, 0, 0, 0.04)',
                        flexShrink: 0
                    }}
                >
                    <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="d-flex align-items-center gap-1.5">
                            <span 
                                style={{ 
                                    width: '24px', 
                                    height: '24px', 
                                    borderRadius: '6px', 
                                    background: '#fef3c7', 
                                    color: '#d97706',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '11px'
                                }}
                            >
                                <i className="fa fa-boxes"></i>
                            </span>
                            <span style={{ fontWeight: 700, fontSize: '0.78rem', color: isDark ? '#f8fafc' : '#0f172a', letterSpacing: '0.2px' }}>
                                Current Outstandings
                            </span>
                        </div>
                        <span 
                            className="badge" 
                            style={{ 
                                background: '#fef3c7', 
                                color: '#b45309', 
                                fontSize: '0.62rem', 
                                fontWeight: 700,
                                letterSpacing: '0.3px',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                border: '1px solid #fde68a'
                            }}
                        >
                            ● ACTIVE ON CAMPUS
                        </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: 0 }}>
                        {/* 1. Vehicles */}
                        <div 
                            style={{ 
                                background: isDark ? '#1e293b' : '#f8fafc', 
                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, 
                                borderRadius: '8px', 
                                padding: '6px 10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '6px'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#64748b' }}>
                                <i className="fa fa-car text-warning" style={{ fontSize: '0.8rem' }}></i>
                                <span style={{ fontWeight: 600, color: isDark ? '#cbd5e1' : '#475569' }}>Vehicles:</span>
                            </div>
                            {activeOutstandings.remaining_vehicles && activeOutstandings.remaining_vehicles.length > 0 ? (
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    {activeOutstandings.remaining_vehicles.map((vNum, i) => (
                                        <span 
                                            key={i}
                                            className="badge font-monospace"
                                            style={{ 
                                                background: '#fef3c7', 
                                                color: '#92400e', 
                                                fontSize: '0.7rem', 
                                                fontWeight: 700,
                                                border: '1px solid #fde68a',
                                                padding: '2px 6px'
                                            }}
                                        >
                                            {vNum}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>None parked</span>
                            )}
                        </div>

                        {/* 2. Equipments / Tools / Materials */}
                        <div 
                            style={{ 
                                background: isDark ? '#1e293b' : '#f8fafc', 
                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, 
                                borderRadius: '8px', 
                                padding: '6px 10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '6px'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#64748b' }}>
                                <i className="fa fa-tools text-primary" style={{ fontSize: '0.8rem' }}></i>
                                <span style={{ fontWeight: 600, color: isDark ? '#cbd5e1' : '#475569' }}>Equipments:</span>
                            </div>
                            {activeOutstandings.equipments ? (
                                <span 
                                    style={{ 
                                        fontSize: '0.72rem', 
                                        fontWeight: 600, 
                                        color: isDark ? '#93c5fd' : '#1e40af',
                                        maxWidth: '150px',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}
                                    title={activeOutstandings.equipments}
                                >
                                    {activeOutstandings.equipments}
                                </span>
                            ) : (
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>None logged</span>
                            )}
                        </div>

                        {/* 3. Physical Tag / Pass */}
                        <div 
                            style={{ 
                                background: isDark ? '#1e293b' : '#f8fafc', 
                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, 
                                borderRadius: '8px', 
                                padding: '6px 10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '6px'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#64748b' }}>
                                <i className="fa fa-id-badge text-secondary" style={{ fontSize: '0.8rem' }}></i>
                                <span style={{ fontWeight: 600, color: isDark ? '#cbd5e1' : '#475569' }}>Tag Status:</span>
                            </div>
                            <span 
                                className="badge"
                                style={{ 
                                    background: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5', 
                                    color: isDark ? '#34d399' : '#065f46', 
                                    border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0'}`,
                                    fontSize: '0.68rem', 
                                    fontWeight: 600 
                                }}
                            >
                                Surrendered on exit (New tag required)
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );


    const layout = (
        <div style={{ position: 'relative' }}>
            <Row className="g-3">
                <Col lg={hasEngagementsPanel && showHistory ? 8 : 12} style={{ transition: 'all 0.3s ease' }}>
                    {formContent}
                </Col>
                {hasEngagementsPanel && showHistory && (
                    <Col lg={4} style={{ transition: 'all 0.3s ease' }}>
                        {rightColumn}
                    </Col>
                )}
            </Row>
        </div>
    );

    if (inModal || embedded) {
        return layout;
    }

    return (
        <div className="container-fluid p-0">
            <div className="d-flex justify-content-start mb-3">
                <button
                    onClick={() => navigate('/access-point/gate-entries')}
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back to List
                </button>
            </div>
            <div className="row">
                <div className="col-lg-12 mx-auto">
                    <Card className="border-0 shadow-sm rounded-4">
                        <Card.Header className="bg-transparent border-bottom py-3 px-4">
                            <Card.Title className="mb-0 fw-bold" style={{ fontSize: '18px' }}>{mainTab === 'fast_pass' ? 'Fast Pass Terminal' : 'Gate Entry Registration'}</Card.Title>
                            <small className="text-muted">Record and manage entry details efficiently</small>
                        </Card.Header>
                        <Card.Body className="p-4">
                            {layout}
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default GateEntryForm;