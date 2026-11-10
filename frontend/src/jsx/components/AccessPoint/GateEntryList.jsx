import React, { useState, useEffect, useContext } from 'react';
import { Row, Col, Card, Table, Badge, Button, Image, Spinner, Form, Modal, Nav } from 'react-bootstrap';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
    getGateEntries, 
    deleteGateEntry, 
    markExitGateEntry, 
    getVehicleEntries, 
    deleteVehicleEntry, 
    markExitVehicleEntry,
    getEmployeeGateEntries,
    deleteEmployeeGateEntry,
    scanEmployeeGateEntry,
    switchEmployeeGateEntryVehicle,
    getVehiclesByEmployee,
    getVehicleTypes
} from '../../../services/GateManagementService';
import { ThemeContext } from "../../../context/ThemeContext";
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import DetailsButton from '../../../components/permissions/DetailsButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import Swal from 'sweetalert2';
import GateEntryForm from './GateEntryForm';
import CheckoutModal from './CheckoutModal';
import EmployeeCheckoutModal from './EmployeeCheckoutModal';
import GateFaceScanner from './GateFaceScanner';
import GateFaceEnrollModal from './GateFaceEnrollModal';
import { playCheckInSound, playCheckOutSound, playErrorSound } from '../../../utils/audioNotification';

const GateEntryList = ({ embedded = false }) => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab');
    const { background } = useContext(ThemeContext);
    const isDark = background.value === "dark";
    const { can } = usePermission();

    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editEntry, setEditEntry] = useState(null);
    const [selectedCheckoutEntry, setSelectedCheckoutEntry] = useState(null);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [selectedEmployeeCheckoutEntry, setSelectedEmployeeCheckoutEntry] = useState(null);
    const [showEmployeeCheckoutModal, setShowEmployeeCheckoutModal] = useState(false);
    const [showFaceScannerModal, setShowFaceScannerModal] = useState(false);
    const [showFaceEnrollModal, setShowFaceEnrollModal] = useState(false);
    const [previewPhoto, setPreviewPhoto] = useState(null);

    // Employee Vehicle Switch states
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

    const [activeTab, setActiveTab] = useState(() => {
        if (tabFromUrl === 'vehicles' || tabFromUrl === 'visitors' || tabFromUrl === 'employees') return tabFromUrl;
        const savedTab = sessionStorage.getItem('gate_entry_list_tab');
        if (savedTab === 'vehicles' || savedTab === 'visitors' || savedTab === 'employees') return savedTab;
        return 'visitors';
    });

    const statusFromUrl = searchParams.get('status');
    const [statusFilter, setStatusFilter] = useState(() => {
        if (statusFromUrl === 'history' || statusFromUrl === 'active') return statusFromUrl;
        return 'active'; // Default: show active entries (Inside and Ready for Exit)
    });

    useEffect(() => {
        if (tabFromUrl && (tabFromUrl === 'vehicles' || tabFromUrl === 'visitors' || tabFromUrl === 'employees') && tabFromUrl !== activeTab) {
            setActiveTab(tabFromUrl);
        }
    }, [tabFromUrl]);

    useEffect(() => {
        if (statusFromUrl && (statusFromUrl === 'history' || statusFromUrl === 'active') && statusFromUrl !== statusFilter) {
            setStatusFilter(statusFromUrl);
        }
    }, [statusFromUrl]);

    useEffect(() => {
        const checkoutId = searchParams.get('checkout');
        if (checkoutId && entries.length > 0) {
            const target = entries.find(e => String(e.id) === String(checkoutId));
            if (target) {
                setSelectedCheckoutEntry(target);
                setShowCheckoutModal(true);
            }
        }
    }, [searchParams, entries]);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        sessionStorage.setItem('gate_entry_list_tab', tab);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', tab);
            return next;
        }, { replace: true });
    };

    const handleStatusFilterChange = (status) => {
        setStatusFilter(status);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('status', status);
            return next;
        }, { replace: true });
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

    const formatReadyToExitTime = (dateStr) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;

        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();
        const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        return isToday
            ? timeStr
            : `${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, ${timeStr}`;
    };

    const getUnclosedCampusStatus = (entry) => {
        const logs = entry.partial_exit_logs || [];
        const latestLog = logs.length > 0 ? logs[logs.length - 1] : null;

        let hasVeh = false;
        if (latestLog && latestLog.remaining_vehicles !== undefined && latestLog.remaining_vehicles !== null) {
            hasVeh = Array.isArray(latestLog.remaining_vehicles) ? latestLog.remaining_vehicles.length > 0 : Boolean(latestLog.remaining_vehicles);
        } else if (entry.vehicle_number || (entry.vehicles && entry.vehicles.length > 0)) {
            const allVehs = entry.vehicles ? entry.vehicles.map(v => v.vehicle_number).filter(Boolean) : (entry.vehicle_number ? [entry.vehicle_number] : []);
            const exitedVehs = new Set();
            logs.forEach(l => {
                (l.vehicle_numbers || []).forEach(v => exitedVehs.add(String(v).toUpperCase()));
                if (l.vehicle_number) String(l.vehicle_number).split(',').forEach(v => exitedVehs.add(v.trim().toUpperCase()));
            });
            hasVeh = allVehs.some(v => !exitedVehs.has(String(v).toUpperCase()));
        }

        let hasEq = false;
        if (latestLog && latestLog.remaining_equipments !== undefined && latestLog.remaining_equipments !== null) {
            hasEq = Array.isArray(latestLog.remaining_equipments) ? latestLog.remaining_equipments.length > 0 : Boolean(latestLog.remaining_equipments);
        } else if (entry.equipments && entry.equipments.length > 0) {
            const exitedEqIds = new Set();
            logs.forEach(l => {
                (l.exiting_equipments || []).forEach(eq => exitedEqIds.add(String(eq)));
            });
            hasEq = entry.equipments.some(eq => !exitedEqIds.has(String(eq.id || eq.value || '')));
        }

        if (hasVeh && hasEq) {
            return {
                title: "All persons exited. Vehicle and tools/equipment remain on campus.",
                icon: "fa-tools",
                label: "Veh & Tools on Campus (0 Inside)"
            };
        } else if (hasEq) {
            return {
                title: "All persons exited. Tools/equipment remain inside campus.",
                icon: "fa-tools",
                label: "Tools on Campus (0 Inside)"
            };
        } else {
            return {
                title: "All persons exited. Vehicle remains parked on campus.",
                icon: "fa-parking",
                label: "Vehicle on Campus (0 Inside)"
            };
        }
    };

    const getActiveVehicleExitStatus = (entry) => {
        const logs = entry.partial_exit_logs || [];
        if (!logs.length) return false;

        const exitedVehicles = new Set();
        logs.forEach(log => {
            if (log.action === 're_entered' || log.action === 'reentry') {
                if (log.vehicle_number) {
                    log.vehicle_number.split(',').forEach(v => exitedVehicles.delete(v.trim().toUpperCase()));
                }
                if (Array.isArray(log.vehicle_numbers)) {
                    log.vehicle_numbers.forEach(v => exitedVehicles.delete(String(v).trim().toUpperCase()));
                }
            } else {
                if (log.vehicle_number) {
                    log.vehicle_number.split(',').forEach(v => {
                        const trimmed = v.trim().toUpperCase();
                        if (trimmed) exitedVehicles.add(trimmed);
                    });
                }
                if (Array.isArray(log.vehicle_numbers)) {
                    log.vehicle_numbers.forEach(v => {
                        const trimmed = String(v).trim().toUpperCase();
                        if (trimmed) exitedVehicles.add(trimmed);
                    });
                }
            }
        });
        return exitedVehicles.size > 0;
    };

    useEffect(() => {
        fetchEntries();
    }, [activeTab]);

    const fetchEntries = async () => {
        try {
            setLoading(true);
            let data = [];
            if (activeTab === 'visitors') {
                data = await getGateEntries();
            } else if (activeTab === 'vehicles') {
                data = await getVehicleEntries();
            } else if (activeTab === 'employees') {
                const res = await getEmployeeGateEntries();
                data = Array.isArray(res) ? res : (res?.results || []);
            }
            setEntries(data || []);
        } catch (error) {
            console.error("Error fetching gate entries", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Gate Entry?',
            text: `Are you sure you want to delete entry for "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                if (activeTab === 'visitors') {
                    await deleteGateEntry(id);
                } else if (activeTab === 'vehicles') {
                    await deleteVehicleEntry(id);
                } else if (activeTab === 'employees') {
                    await deleteEmployeeGateEntry(id);
                }
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Gate entry deleted successfully', timer: 2000, showConfirmButton: false });
                fetchEntries();
            } catch (error) {
                let errorMsg = 'Failed to delete gate entry';
                if (error.response && error.response.data && (error.response.data.detail || error.response.data.error)) {
                    errorMsg = error.response.data.detail || error.response.data.error;
                }
                Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
            }
        }
    };

    const handleCheckout = (entry) => {
        setSelectedCheckoutEntry(entry);
        setShowCheckoutModal(true);
    };

    const handleEmployeeCheckout = (entry) => {
        setSelectedEmployeeCheckoutEntry(entry);
        setShowEmployeeCheckoutModal(true);
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
            setShowSwitchVehicleModal(false);
            Swal.fire({
                icon: 'success',
                title: 'Vehicle Switched Successfully',
                text: res.message || 'Entry vehicle updated.',
                timer: 2500,
                showConfirmButton: false
            });
            fetchEntries();
        } catch (err) {
            console.error("Failed to switch vehicle:", err);
            const errMsg = err.response?.data?.error || err.response?.data?.detail || 'Failed to switch entry vehicle.';
            Swal.fire('Error', errMsg, 'error');
        } finally {
            setSubmittingVehicleSwitch(false);
        }
    };

    const isEntryActive = (entry) => {
        if (activeTab === 'employees') {
            return entry.status === 'inside' || (!entry.exit_time && entry.status !== 'exited');
        }
        return !entry.exit_time && (!entry.is_permission_required || entry.permission_status !== 'rejected');
    };

    const activeEntriesCount = entries.filter(isEntryActive).length;
    const historyEntriesCount = entries.length - activeEntriesCount;

    const filteredEntries = entries.filter(entry => {
        const isActive = isEntryActive(entry);
        if (statusFilter === 'active' && !isActive) return false;
        if (statusFilter === 'history' && isActive) return false;

        const search = searchTerm.toLowerCase();
        if (activeTab === 'visitors') {
            return (
                entry.visitor_name?.toLowerCase().includes(search) ||
                entry.visitor_mobile?.includes(search) ||
                entry.tag_number?.includes(search) ||
                entry.tag_code?.includes(search) ||
                entry.department_name?.toLowerCase().includes(search) ||
                entry.employee_name?.toLowerCase().includes(search)
            );
        } else if (activeTab === 'vehicles') {
            return (
                entry.driver?.toLowerCase().includes(search) ||
                entry.vehicles_data?.some(v => v.vehicle_number?.toLowerCase().includes(search)) ||
                entry.vehicles?.some(v => v.vehicle_number?.toLowerCase().includes(search)) ||
                entry.tag_number?.includes(search) ||
                entry.tag_code?.includes(search) ||
                entry.department_name?.toLowerCase().includes(search) ||
                entry.employee_name?.toLowerCase().includes(search)
            );
        } else {
            return (
                entry.employee_name?.toLowerCase().includes(search) ||
                entry.employment_no?.toLowerCase().includes(search) ||
                entry.department_name?.toLowerCase().includes(search) ||
                entry.designation_name?.toLowerCase().includes(search) ||
                entry.entry_gate_name?.toLowerCase().includes(search) ||
                entry.exit_gate_name?.toLowerCase().includes(search) ||
                entry.phone?.includes(search)
            );
        }
    });

    return (
        <div className="container-fluid p-0">
            {!embedded && (
                <div className="page-titles">
                    {/* <button
                        onClick={() => window.history.back()}
                        className="btn btn-outline-primary btn-sm d-flex align-items-center"
                        style={{ gap: '6px', borderRadius: '6px' }}
                    >
                        <i className="fa fa-arrow-left"></i> Back
                    </button> */}
                </div>
            )}

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Gate Entries Management</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Gate Entry..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <CreateButton
                                    module="gate_entries"
                                    onClick={() => { setEditEntry(null); setShowModal(true); }}
                                    className="d-flex align-items-center justify-content-center"
                                    style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px' }}
                                >
                                    Gate Entry
                                </CreateButton>
                                {activeTab === 'employees' && (
                                    <>
                                        <button
                                            type="button"
                                            className="btn btn-primary d-inline-flex align-items-center gap-1.5 shadow-sm"
                                            style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 14px', fontSize: '13px' }}
                                            onClick={() => setShowFaceScannerModal(true)}
                                            title="Open camera for live facial attendance"
                                        >
                                            <i className="fa fa-camera"></i>
                                            <span>Face Scanner</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary d-inline-flex align-items-center gap-1.5 shadow-sm"
                                            style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 14px', fontSize: '13px' }}
                                            onClick={() => setShowFaceEnrollModal(true)}
                                            title="Enroll employee facial descriptor"
                                        >
                                            <i className="fa fa-user-plus text-primary"></i>
                                            <span>Enroll Face</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </Card.Header>

                        <div className="custom-tab-1 d-flex flex-wrap justify-content-between align-items-center px-4 pt-2 border-bottom">
                            <Nav as="ul" className="nav nav-tabs border-0">
                                <Nav.Item as="li">
                                    <Nav.Link
                                        className={activeTab === 'visitors' ? 'active' : ''}
                                        onClick={() => handleTabChange('visitors')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <i className="la la-user me-2" />
                                        Visitors
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link
                                        className={activeTab === 'vehicles' ? 'active' : ''}
                                        onClick={() => handleTabChange('vehicles')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <i className="la la-truck me-2" />
                                        Vehicles
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link
                                        className={activeTab === 'employees' ? 'active' : ''}
                                        onClick={() => handleTabChange('employees')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <i className="la la-id-badge me-2" />
                                        Employees
                                    </Nav.Link>
                                </Nav.Item>
                            </Nav>

                            {/* Status Tabs: Active on Campus (Default) vs Exited / History */}
                            <div className="d-flex align-items-center gap-2 pb-2">
                                <button
                                    type="button"
                                    className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-2 shadow-xs transition-all ${statusFilter === 'active' ? 'btn-primary' : 'btn-light border text-muted'}`}
                                    style={{ fontSize: '12px' }}
                                    onClick={() => handleStatusFilterChange('active')}
                                >
                                    <span className={`rounded-circle ${statusFilter === 'active' ? 'bg-white' : 'bg-success'}`} style={{ width: '7px', height: '7px' }}></span>
                                    Active on Campus ({activeEntriesCount})
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-2 shadow-xs transition-all ${statusFilter === 'history' ? 'btn-primary' : 'btn-light border text-muted'}`}
                                    style={{ fontSize: '12px' }}
                                    onClick={() => handleStatusFilterChange('history')}
                                >
                                    <i className="fa fa-history" style={{ fontSize: '11px' }}></i>
                                    Exited & History ({historyEntriesCount})
                                </button>
                            </div>
                        </div>

                        <Card.Body className="p-0">
                            {loading ? (
                                <div className="text-center py-5">
                                    <Spinner animation="border" variant="primary" />
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-responsive-md mb-0 align-middle">
                                        <thead>
                                            <tr>
                                                {activeTab === 'employees' ? (
                                                    <>
                                                        <th><strong>EMPLOYEE</strong></th>
                                                        <th><strong>ID NO</strong></th>
                                                        <th><strong>VEHICLE</strong></th>
                                                        <th><strong>DEPARTMENT</strong></th>
                                                        <th><strong>GATE</strong></th>
                                                        <th><strong>ENTRY TIME</strong></th>
                                                        <th><strong>STAY DURATION</strong></th>
                                                        <th><strong>STATUS</strong></th>
                                                        <th className="text-end"><strong>ACTIONS</strong></th>
                                                    </>
                                                ) : (
                                                    <>
                                                        <th><strong>{activeTab === 'visitors' ? 'VISITOR' : 'VEHICLE'}</strong></th>
                                                        <th><strong>GATE / TAG</strong></th>
                                                        <th><strong>OFFICIAL</strong></th>
                                                        <th><strong>DEPARTMENT</strong></th>
                                                        <th><strong>ENTRY TIME</strong></th>
                                                        <th><strong>STATUS</strong></th>
                                                        <th className="text-end"><strong>ACTIONS</strong></th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredEntries.length > 0 ? filteredEntries.map((entry, index) => (
                                                activeTab === 'employees' ? (
                                                    <tr key={entry.id || index}>
                                                        <td>
                                                            <div className="d-flex align-items-center">
                                                                <div className="me-3" style={{ width: '40px', height: '40px', flexShrink: 0 }}>
                                                                    {entry.profile_photo ? (
                                                                        <Image
                                                                            src={getFullImageUrl(entry.profile_photo)}
                                                                            roundedCircle
                                                                            style={{ width: '40px', height: '40px', objectFit: 'cover', cursor: 'zoom-in' }}
                                                                            alt={entry.employee_name || "Employee"}
                                                                            onClick={() => {
                                                                                setPreviewPhoto({
                                                                                    url: getFullImageUrl(entry.profile_photo),
                                                                                    title: entry.employee_name || 'Employee'
                                                                                });
                                                                            }}
                                                                            title="Click to view full photo"
                                                                        />
                                                                    ) : (
                                                                        <div className="d-flex align-items-center justify-content-center bg-light rounded-circle" style={{ width: '40px', height: '40px', fontSize: '15px' }}>
                                                                            <i className="fa fa-user text-muted"></i>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <strong>{entry.employee_name}</strong>
                                                                    {entry.designation_name && entry.designation_name !== '—' && (
                                                                        <div className="text-muted small">{entry.designation_name}</div>
                                                                    )}
                                                                    {entry.phone && entry.phone !== '—' && (
                                                                        <div className="text-muted small" style={{ fontSize: '11px' }}>
                                                                            <i className="fa fa-phone me-1 opacity-50"></i>{entry.phone}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="d-flex align-items-center gap-1 flex-wrap">
                                                                <span className="badge bg-light text-dark border fw-bold" style={{ fontSize: '12px', padding: '4px 8px' }}>
                                                                    {entry.employment_no || '—'}
                                                                </span>
                                                                {entry.snapshot_image && (
                                                                    <span
                                                                        role="button"
                                                                        className="badge bg-light text-primary border cursor-pointer"
                                                                        style={{ fontSize: '11px', padding: '4px 6px', cursor: 'zoom-in' }}
                                                                        title="View Face Camera Snapshot"
                                                                        onClick={() => {
                                                                            setPreviewPhoto({
                                                                                url: getFullImageUrl(entry.snapshot_image),
                                                                                title: `Camera Snapshot — ${entry.employee_name} (${entry.employment_no})`
                                                                            });
                                                                        }}
                                                                    >
                                                                        <i className="fa fa-camera text-primary"></i>
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="mt-1">
                                                                {entry.verification_method === 'face' ? (
                                                                    <span 
                                                                        className="badge bg-info-subtle text-info border border-info-subtle px-1.5 py-0.5" 
                                                                        style={{ fontSize: '10.5px' }} 
                                                                        title={entry.face_match_score !== null && entry.face_match_score !== undefined ? `Face Verified (Match distance: ${entry.face_match_score})` : 'Face Verified'}
                                                                    >
                                                                        <i className="fa fa-camera me-1"></i> Face
                                                                        {entry.face_match_score !== null && entry.face_match_score !== undefined && (
                                                                            <span className="ms-1 opacity-75">
                                                                                {Math.max(0, Math.min(100, Math.round((1 - entry.face_match_score) * 100)))}%
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                ) : (
                                                                    <span 
                                                                        className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-1.5 py-0.5" 
                                                                        style={{ fontSize: '10.5px' }}
                                                                        title="Barcode / Card Scan"
                                                                    >
                                                                        <i className="fa fa-barcode me-1"></i> Barcode
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {entry.vehicle_number ? (
                                                                <div>
                                                                    <div className="d-flex align-items-center gap-1 flex-wrap">
                                                                        <span className="badge bg-light text-dark border fw-bold" style={{ fontSize: '11.5px', padding: '4px 7px' }}>
                                                                            <i className="fa fa-car text-primary me-1"></i>
                                                                            {entry.vehicle_number}
                                                                        </span>
                                                                        {entry.is_preferred_vehicle && (
                                                                            <span
                                                                                className="badge bg-success-subtle text-success border border-success-subtle"
                                                                                style={{ fontSize: '10px', padding: '2px 5px' }}
                                                                                title="Registered Preferred Vehicle"
                                                                            >
                                                                                <i className="fa fa-star text-warning me-0.5" style={{ fontSize: '9px' }}></i> Preferred
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {entry.parking_details && (
                                                                        <div className="mt-1">
                                                                            <span 
                                                                                className="badge bg-primary-subtle text-primary border border-primary-subtle" 
                                                                                style={{ fontSize: '10.5px', padding: '2px 6px' }}
                                                                                title={entry.parking_details}
                                                                            >
                                                                                <i className="fa fa-parking me-1"></i>
                                                                                {entry.parking_slot_number ? `Slot #${entry.parking_slot_number}` : entry.parking_details}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    {entry.vehicle_type_name && (
                                                                        <div className="text-muted small mt-0.5" style={{ fontSize: '10.5px' }}>
                                                                            {entry.vehicle_type_name}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted" style={{ fontSize: '12px' }}>—</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <span className="badge badge-info light">{entry.department_name || '—'}</span>
                                                        </td>
                                                        <td>
                                                            <strong>{entry.entry_gate_name || '—'}</strong>
                                                            {entry.exit_gate_name && (
                                                                <div className="text-muted small" style={{ fontSize: '11.5px' }}>
                                                                    <i className="fa fa-sign-out-alt me-1 text-danger"></i>Exit: {entry.exit_gate_name}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {entry.entry_time ? (
                                                                <>
                                                                    {new Date(entry.entry_time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                                    <div className="text-muted small">
                                                                        {new Date(entry.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                                    </div>
                                                                </>
                                                            ) : '—'}
                                                        </td>
                                                        <td>
                                                            {entry.stay_duration ? (
                                                                <span className="badge bg-light text-primary border" style={{ fontSize: '12px', padding: '3px 8px' }}>
                                                                    <i className="fa fa-clock me-1"></i>{entry.stay_duration}
                                                                </span>
                                                            ) : (
                                                                <span className="text-muted">—</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {entry.status === 'inside' || (!entry.exit_time && entry.status !== 'exited') ? (
                                                                <span className="badge badge-success light">Inside</span>
                                                            ) : (
                                                                <div>
                                                                    <span className="badge badge-danger light">Exited</span>
                                                                    {entry.exit_time && (
                                                                        <div className="text-muted small mt-1" style={{ fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                                                                            {formatReadyToExitTime(entry.exit_time)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end align-items-center">
                                                                {(entry.status === 'inside' || (!entry.exit_time && entry.status !== 'exited')) && (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline-primary"
                                                                        className="rounded-2 me-1"
                                                                        style={{
                                                                            height: '28px',
                                                                            padding: '0 10px',
                                                                            fontSize: '12px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center'
                                                                        }}
                                                                        onClick={() => handleEmployeeCheckout(entry)}
                                                                    >
                                                                        <i className="fa fa-sign-out-alt me-1"></i> Check Out
                                                                    </Button>
                                                                )}
                                                                {(entry.status === 'inside' || (!entry.exit_time && entry.status !== 'exited')) && (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline-warning"
                                                                        className="rounded-2 me-1"
                                                                        style={{
                                                                            height: '28px',
                                                                            padding: '0 8px',
                                                                            fontSize: '11.5px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center'
                                                                        }}
                                                                        title="Change or assign vehicle for this check-in"
                                                                        onClick={() => handleOpenSwitchVehicleModal(entry)}
                                                                    >
                                                                        <i className="fa fa-car me-1"></i> Vehicle
                                                                    </Button>
                                                                )}
                                                                {can('gate-entry', 'delete') && (
                                                                    <DeleteButton
                                                                        module="gate_entries"
                                                                        onClick={() => handleDelete(entry.id, entry.employee_name)}
                                                                    />
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    <tr key={index}>
                                                        <td>
                                                            {activeTab === 'visitors' ? (
                                                                <div className="d-flex align-items-center">
                                                                    <div className="me-3" style={{ width: '40px', height: '40px', flexShrink: 0 }}>
                                                                        <Image
                                                                            src={entry.visitor_photo ? getFullImageUrl(entry.visitor_photo) : 'https://via.placeholder.com/40'}
                                                                            roundedCircle
                                                                            style={{ width: '40px', height: '40px', objectFit: 'cover', cursor: entry.visitor_photo ? 'zoom-in' : 'default' }}
                                                                            alt={entry.visitor_name || "Visitor"}
                                                                            onClick={() => {
                                                                                if (entry.visitor_photo) {
                                                                                    setPreviewPhoto({
                                                                                        url: getFullImageUrl(entry.visitor_photo),
                                                                                        title: entry.visitor_name || 'Visitor'
                                                                                    });
                                                                                }
                                                                            }}
                                                                            title={entry.visitor_photo ? "Click to view full photo" : ""}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <strong>{entry.visitor_name}</strong>
                                                                        <div className="text-muted small">{entry.visitor_mobile}</div>
                                                                        {entry.vehicles && entry.vehicles.length > 0 && (
                                                                            <div className="mt-1 d-flex flex-wrap gap-1 align-items-center">
                                                                                <span
                                                                                    className="badge bg-light text-primary border"
                                                                                    style={{ fontSize: '10px', padding: '2px 6px', fontWeight: 600 }}
                                                                                    title={entry.vehicles.map(v => `${v.vehicle_number}${v.driver_name ? ` (${v.driver_name})` : ''}`).join(', ')}
                                                                                >
                                                                                    <i className="fa fa-car me-1"></i>
                                                                                    {entry.vehicles.length === 1
                                                                                        ? entry.vehicles[0].vehicle_number
                                                                                        : `${entry.vehicles[0].vehicle_number} (+${entry.vehicles.length - 1})`}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="d-flex align-items-center">
                                                                    {(() => {
                                                                        const vehPhoto = entry.vehicle_photo
                                                                            || (entry.vehicles && entry.vehicles[0]?.vehicle_photo)
                                                                            || (entry.vehicles_data && entry.vehicles_data[0]?.vehicle_photo);
                                                                        const fullPhotoUrl = getFullImageUrl(vehPhoto);
                                                                        const vehNumber = (entry.vehicles_data && entry.vehicles_data[0]?.vehicle_number)
                                                                            || (entry.vehicles && entry.vehicles[0]?.vehicle_number)
                                                                            || 'Vehicle';
                                                                        return (
                                                                            <div className="me-3" style={{ width: '40px', height: '40px', flexShrink: 0 }}>
                                                                                {fullPhotoUrl ? (
                                                                                    <Image
                                                                                        src={fullPhotoUrl}
                                                                                        roundedCircle
                                                                                        style={{ width: '40px', height: '40px', objectFit: 'cover', cursor: 'zoom-in' }}
                                                                                        alt={vehNumber}
                                                                                        onClick={() => setPreviewPhoto({
                                                                                            url: fullPhotoUrl,
                                                                                            title: `Vehicle ${vehNumber}`
                                                                                        })}
                                                                                        title="Click to view full photo"
                                                                                    />
                                                                                ) : (
                                                                                    <div className="d-flex align-items-center justify-content-center bg-light rounded-circle" style={{ width: '40px', height: '40px' }}>
                                                                                        <i className="fa fa-truck text-muted fs-4"></i>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                    <div>
                                                                        <strong>
                                                                            {entry.vehicles_data && entry.vehicles_data.length > 0
                                                                                ? (entry.vehicles_data.length === 1
                                                                                    ? entry.vehicles_data[0].vehicle_number
                                                                                    : `${entry.vehicles_data[0].vehicle_number} (+${entry.vehicles_data.length - 1} more)`)
                                                                                : (entry.vehicles && entry.vehicles.length > 0
                                                                                    ? (entry.vehicles.length === 1
                                                                                        ? entry.vehicles[0].vehicle_number
                                                                                        : `${entry.vehicles[0].vehicle_number} (+${entry.vehicles.length - 1} more)`)
                                                                                    : 'Unknown Vehicle')}
                                                                        </strong>
                                                                        <div className="text-muted small">{entry.driver || 'No Driver'}</div>
                                                                        {entry.parking_location_display && (
                                                                            <div className="mt-1">
                                                                                <span 
                                                                                    className="badge bg-primary-subtle text-primary border border-primary-subtle" 
                                                                                    style={{ fontSize: '10.5px', padding: '2px 6px' }}
                                                                                    title="Allocated Parking Area & Slot"
                                                                                >
                                                                                    <i className="fa fa-parking me-1"></i>
                                                                                    {entry.parking_location_display}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <strong>{entry.entry_gate_name || entry.entry_gate_no || '—'}</strong>
                                                            {entry.exit_gate_name && (
                                                                <div className="text-muted small" style={{ fontSize: '11.5px' }}>
                                                                    <i className="fa fa-sign-out-alt me-1 text-danger"></i>Exit: {entry.exit_gate_name}
                                                                </div>
                                                            )}
                                                            <div className="text-muted small">
                                                                Tag: {(entry.tag_code === 'N/A' || !entry.tag_code) ? 'N/A' : String(entry.tag_code).split(',').map(t => `#${t.trim()}`).join(', ')}
                                                            </div>
                                                        </td>
                                                        <td>{entry.employee_name}</td>
                                                        <td>
                                                            <span className="badge badge-info light">{entry.department_name}</span>
                                                        </td>
                                                        <td>
                                                            {new Date(entry.entry_time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                            <div className="text-muted small">
                                                                {new Date(entry.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {entry.exit_time ? (
                                                                <div>
                                                                    <span className="badge badge-danger light">Exited</span>
                                                                    {entry.exit_time && (
                                                                        <div className="text-muted small mt-1" style={{ fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                                                                            {formatReadyToExitTime(entry.exit_time)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : entry.is_permission_required && entry.permission_status === 'pending' ? (
                                                                <span className="badge badge-warning light">Pending Approval</span>
                                                            ) : entry.is_permission_required && entry.permission_status === 'rejected' ? (
                                                                <span className="badge badge-dark light">Rejected</span>
                                                            ) : (!entry.exit_time && entry.persons_inside === 0) ? (() => {
                                                                const unclosed = getUnclosedCampusStatus(entry);
                                                                return (
                                                                    <span className="badge badge-warning light d-inline-flex align-items-center" title={unclosed.title}>
                                                                        <i className={`fa ${unclosed.icon} me-1 text-warning`}></i> {unclosed.label}
                                                                    </span>
                                                                );
                                                            })() : (entry.verification_status === 'completed' || !!entry.movement_completed_at) ? (
                                                                <div>
                                                                    <span className="badge badge-info light d-inline-flex align-items-center">
                                                                        <i className={`fa ${activeTab === 'vehicles' ? 'fa-truck' : 'fa-walking'} me-1`}></i> Ready for Exit
                                                                    </span>
                                                                    {entry.movement_completed_at && (
                                                                        <div className="text-muted small mt-1" style={{ fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                                                                            {formatReadyToExitTime(entry.movement_completed_at)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : entry.verification_status === 'reassigned' ? (
                                                                <span className="badge badge-secondary light d-inline-flex align-items-center">
                                                                    <i className="fa fa-exchange-alt me-1"></i> Reallocated
                                                                </span>
                                                            ) : (entry.persons_inside != null && entry.number_of_persons && entry.persons_inside < entry.number_of_persons && entry.persons_inside > 0) ? (
                                                                <span className="badge badge-warning light d-inline-flex align-items-center">
                                                                    <i className="fa fa-user-minus me-1"></i> Partially Exited
                                                                </span>
                                                            ) : getActiveVehicleExitStatus(entry) ? (
                                                                <span className="badge badge-warning light d-inline-flex align-items-center">
                                                                    <i className="fa fa-car me-1"></i> Vehicle Exited
                                                                </span>
                                                            ) : (entry.partial_exit_logs && entry.partial_exit_logs.some(l => l.action === 're_entered' || l.action === 'reentry')) ? (
                                                                <span className="badge badge-success light d-inline-flex align-items-center">
                                                                    <i className="fa fa-rotate-left me-1"></i> Inside (Re-entered)
                                                                </span>
                                                            ) : (
                                                                <span className="badge badge-success light">Inside</span>
                                                            )}
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end align-items-center">
                                                                {!entry.exit_time && (!entry.is_permission_required || entry.permission_status === 'approved') && (() => {
                                                                    const hasHost = Boolean(entry.employee || entry.appointment || entry.employee_name);
                                                                    const isMovementDone = !hasHost || entry.verification_status === 'completed' || Boolean(entry.movement_completed_at);
                                                                    return (
                                                                        <span
                                                                            title={!isMovementDone ? `Checkout disabled: Host official (${entry.employee_name || 'concerned employee'}) must click 'Complete Movement' before checkout.` : "Check out and release tag"}
                                                                            className="d-inline-block me-2"
                                                                        >
                                                                            <Button
                                                                                size="sm"
                                                                                variant={isMovementDone ? "outline-primary" : "outline-secondary"}
                                                                                className="rounded-2"
                                                                                disabled={!isMovementDone}
                                                                                style={{
                                                                                    height: '28px',
                                                                                    padding: '0 10px',
                                                                                    fontSize: '12px',
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'center',
                                                                                    ...(!isMovementDone ? { opacity: 0.55, cursor: 'not-allowed' } : {})
                                                                                }}
                                                                                onClick={() => {
                                                                                    if (isMovementDone) {
                                                                                        handleCheckout(entry);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <i className={`fa ${isMovementDone ? 'fa-sign-out-alt' : 'fa-lock'} me-1`}></i> Check Out
                                                                            </Button>
                                                                        </span>
                                                                    );
                                                                })()}
                                                                {can('gate-entry', 'details') && (
                                                                    <DetailsButton
                                                                        module="gate_entries"
                                                                        onClick={() => {
                                                                            sessionStorage.setItem('gate_entry_list_tab', activeTab);
                                                                            navigate(`/access-point/gate-entry/${entry.id}?type=${activeTab === 'vehicles' ? 'vehicle' : 'visitor'}`);
                                                                        }}
                                                                        className="me-1 shadow"
                                                                        style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                    >
                                                                        <></>
                                                                    </DetailsButton>
                                                                )}
                                                                {can('gate-entry', 'edit') && (
                                                                    <EditButton
                                                                        module="gate_entries"
                                                                        onClick={() => { setEditEntry(entry); setShowModal(true); }}
                                                                        className="me-1"
                                                                    />
                                                                )}
                                                                {can('gate-entry', 'delete') && (
                                                                    <DeleteButton
                                                                        module="gate_entries"
                                                                        onClick={() => handleDelete(entry.id, activeTab === 'visitors' ? entry.visitor_name : (entry.vehicles_data?.[0]?.vehicle_number || 'Unknown Vehicle'))}
                                                                    />
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            )) : (
                                                <tr>
                                                    <td colSpan={activeTab === 'employees' ? "9" : "7"} className="text-center py-5">
                                                        <div className="text-muted">
                                                            <i className={`fa ${statusFilter === 'active' ? 'fa-user-check' : 'fa-history'} fa-2x mb-2 opacity-50`}></i>
                                                            <p className="mb-1 fw-semibold fs-14">
                                                                {statusFilter === 'active'
                                                                    ? `No active ${activeTab} currently inside campus.`
                                                                    : `No past ${activeTab} records found.`}
                                                            </p>
                                                            {statusFilter === 'active' && historyEntriesCount > 0 && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-link btn-sm text-decoration-none p-0 mt-1"
                                                                    onClick={() => handleStatusFilterChange('history')}
                                                                >
                                                                    View {historyEntriesCount} exited / historical {activeTab} &rarr;
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* GATE ENTRY FORM MODAL */}
            <Modal
                show={showModal}
                onHide={() => setShowModal(false)}
                dialogClassName="item-custom-modal gate-entry-modal"
                backdrop="static"
                keyboard={false}
                size="xl"
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
                                {editEntry ? 'Edit Gate Entry' : 'Create Gate Entry'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to record gate entry
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>
                        &times;
                    </button>
                </div>
                <div className="modal-body-custom">
                    <GateEntryForm
                        inModal={true}
                        onClose={() => setShowModal(false)}
                        onSuccess={() => {
                            setShowModal(false);
                            fetchEntries();
                        }}
                        editEntry={editEntry}
                    />
                </div>
            </Modal>

            {/* Check Out Popup Modal */}
            <CheckoutModal
                show={showCheckoutModal}
                onHide={() => {
                    setShowCheckoutModal(false);
                    setSelectedCheckoutEntry(null);
                }}
                entry={selectedCheckoutEntry}
                activeTab={activeTab}
                onSuccess={fetchEntries}
            />

            {/* Employee Custom Checkout Modal */}
            <EmployeeCheckoutModal
                show={showEmployeeCheckoutModal}
                onHide={() => {
                    setShowEmployeeCheckoutModal(false);
                    setSelectedEmployeeCheckoutEntry(null);
                }}
                entry={selectedEmployeeCheckoutEntry}
                onSuccess={fetchEntries}
            />

            {/* Photo Lightbox Modal */}
            <Modal
                show={!!previewPhoto}
                onHide={() => setPreviewPhoto(null)}
                centered
                size="md"
            >
                <Modal.Header closeButton className="py-2">
                    <Modal.Title className="fs-15 fw-bold">{previewPhoto?.title || 'Photo'}</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-0 text-center bg-black">
                    {previewPhoto?.url && (
                        <Image
                            src={previewPhoto.url}
                            alt={previewPhoto.title}
                            style={{ maxHeight: '70vh', maxWidth: '100%', objectFit: 'contain' }}
                        />
                    )}
                </Modal.Body>
            </Modal>

            {/* Employee Live Face Scanner Modal */}
            <Modal
                show={showFaceScannerModal}
                onHide={() => setShowFaceScannerModal(false)}
                centered
                size="lg"
                backdrop="static"
                dialogClassName="gate-custom-modal item-custom-modal"
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-camera text-white" style={{ fontSize: '18px' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                Face Recognition Scanner
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Live webcam employee attendance verification
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowFaceScannerModal(false)}>
                        &times;
                    </button>
                </div>
                <div className="modal-body-custom p-4">
                    <GateFaceScanner
                        gateId={1}
                        isDark={isDark}
                        onScanSuccess={() => {
                            setShowFaceScannerModal(false);
                            fetchEntries();
                        }}
                        onOpenEnroll={() => {
                            setShowFaceScannerModal(false);
                            setShowFaceEnrollModal(true);
                        }}
                        onClose={() => setShowFaceScannerModal(false)}
                    />
                </div>
            </Modal>

            {/* Employee Face Enrollment Modal */}
            <GateFaceEnrollModal
                show={showFaceEnrollModal}
                onHide={() => setShowFaceEnrollModal(false)}
                onEnrolled={(emp) => {
                    fetchEntries();
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
                                        id="list-switch-pref-toggle"
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


            <style dangerouslySetInnerHTML={{
                __html: `
                .item-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .item-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .item-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #0a500f;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
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
                .item-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .item-custom-modal .modal-body-custom {
                    padding: 22px 28px !important;
                    background-color: #ffffff !important;
                    max-height: 82vh;
                    overflow-y: auto;
                }
                .gate-entry-modal.modal-xl .modal-dialog,
                .gate-entry-modal .modal-dialog {
                    max-width: 1200px !important;
                    width: 95% !important;
                }
                .item-custom-modal .btn-close-custom {
                    background-color: #dc3545 !important;
                    border-color: #0a500f !important;
                    color: #fff !important;
                    font-weight: 500;
                    font-size: 14px;
                    padding: 10px 24px;
                    border-radius: 8px;
                }
                .item-custom-modal .btn-close-custom:hover {
                    background-color: #bb2d3b !important;
                    border-color: #073d0b !important;
                    color: #fff !important;
                }
                .item-custom-modal .btn-save-custom {
                    background-color: #0a500f !important;
                    border-color: #0a500f !important;
                    color: #fff !important;
                    font-weight: 500;
                    font-size: 14px;
                    padding: 10px 24px;
                    border-radius: 8px;
                }
                .item-custom-modal .btn-save-custom:hover {
                    background-color: #073d0b !important;
                    border-color: #073d0b !important;
                    color: #fff !important;
                }
                `
            }} />
        </div>
    );
};

export default GateEntryList;
