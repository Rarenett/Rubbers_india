import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Row, Col, Card, Badge, Button, Modal, Form, Spinner, Image, Table, Nav } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { ThemeContext } from "../../../context/ThemeContext";
import { usePermission } from '../../../hooks/usePermission';
import {
    getAllocatedVisitors,
    reallocateVisitor,
    completeVisitorMovement,
    respondReallocation,
    cancelReallocation
} from '../../../services/GateManagementService';
import { getUsers, getDepartments } from '../../../services/HRManagementService';

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

const formatDateDMY = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTimeHM = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
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

const getSoftTagBadgeStyle = (tagColour, isDark) => {
    if (!tagColour) {
        return {
            backgroundColor: isDark ? 'rgba(10, 80, 15, 0.15)' : '#e8fdf4',
            color: isDark ? '#6ee7b7' : '#047857',
            borderColor: isDark ? 'rgba(10, 80, 15, 0.35)' : '#a7f3d0',
            dotColor: '#0a500f'
        };
    }
    if (tagColour.startsWith('#') && (tagColour.length === 7 || tagColour.length === 9)) {
        const r = parseInt(tagColour.slice(1, 3), 16) || 0;
        const g = parseInt(tagColour.slice(3, 5), 16) || 0;
        const b = parseInt(tagColour.slice(5, 7), 16) || 0;
        return {
            backgroundColor: isDark 
                ? `rgba(${r}, ${g}, ${b}, 0.18)` 
                : `rgba(${r}, ${g}, ${b}, 0.08)`,
            color: isDark 
                ? `rgb(${Math.min(255, Math.round(r * 0.7 + 100))}, ${Math.min(255, Math.round(g * 0.7 + 100))}, ${Math.min(255, Math.round(b * 0.7 + 100))})` 
                : `rgb(${Math.max(0, Math.round(r * 0.65))}, ${Math.max(0, Math.round(g * 0.65))}, ${Math.max(0, Math.round(b * 0.65))})`,
            borderColor: isDark 
                ? `rgba(${r}, ${g}, ${b}, 0.35)` 
                : `rgba(${r}, ${g}, ${b}, 0.22)`,
            dotColor: tagColour
        };
    }
    return {
        backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff',
        color: isDark ? '#a5b4fc' : '#4338ca',
        borderColor: isDark ? 'rgba(99, 102, 241, 0.35)' : '#c7d2fe',
        dotColor: tagColour
    };
};

const doesEmployeeMatchDepartment = (emp, targetDept) => {
    if (!emp || !targetDept) return false;
    const targetId = String(targetDept.value);
    const targetLabel = (targetDept.label || '').trim().toLowerCase();

    if (emp.department) {
        if (typeof emp.department === 'object') {
            if (emp.department.id !== undefined && String(emp.department.id) === targetId) {
                return true;
            }
            if (emp.department.name && emp.department.name.trim().toLowerCase() === targetLabel) {
                return true;
            }
        } else if (String(emp.department) === targetId) {
            return true;
        } else if (typeof emp.department === 'string' && emp.department.trim().toLowerCase() === targetLabel) {
            return true;
        }
    }

    if (emp.department_id !== undefined && emp.department_id !== null && String(emp.department_id) === targetId) {
        return true;
    }

    if (emp.employee_profile && emp.employee_profile.department) {
        const d = emp.employee_profile.department;
        if (typeof d === 'object' && d.id !== undefined && String(d.id) === targetId) return true;
        if (typeof d !== 'object' && String(d) === targetId) return true;
    }

    return false;
};

const VisitorReallocation = ({ embedded = false }) => {
    const navigate = useNavigate();
    const { background } = useContext(ThemeContext);
    const isDark = background.value === "dark";
    const { can } = usePermission();

    const auth = useSelector(state => state?.auth);
    const currentUser = useMemo(() => {
        if (auth?.user) return auth.user;
        try {
            const details = localStorage.getItem('userDetails');
            if (!details) return null;
            const parsed = JSON.parse(details);
            return parsed?.user || parsed;
        } catch {
            return null;
        }
    }, [auth]);

    // Helper: checks if current logged-in user is the last allocated (current host) employee
    const isLastAllocatedEmployee = (entry) => {
        if (!entry || !currentUser) return false;
        const entryEmpId = typeof entry.employee === 'object' && entry.employee !== null
            ? entry.employee.id
            : entry.employee;
        const currentUserId = currentUser.id;
        if (entryEmpId === undefined || entryEmpId === null || currentUserId === undefined || currentUserId === null) {
            return false;
        }
        return String(entryEmpId) === String(currentUserId);
    };

    // Data State
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);

    // Filters
    const [selectedFilterDepartment, setSelectedFilterDepartment] = useState(null); // filter by dept
    const [selectedEmployee, setSelectedEmployee] = useState(null); // null = current user or all
    const [viewAllEmployees, setViewAllEmployees] = useState(true);
    const [activeStatusTab, setActiveStatusTab] = useState('active'); // 'active', 'completed', 'reassigned', 'all'
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Detail Modal State
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedDetailEntry, setSelectedDetailEntry] = useState(null);

    // Reallocation Modal State
    const [showReallocateModal, setShowReallocateModal] = useState(false);
    const [reallocateEntry, setReallocateEntry] = useState(null);
    const [targetEmployee, setTargetEmployee] = useState(null);
    const [targetDepartment, setTargetDepartment] = useState(null);
    const [reallocateReason, setReallocateReason] = useState('');
    const [isReallocating, setIsReallocating] = useState(false);

    // Complete Movement Modal State (Default Popup Style)
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [completeEntry, setCompleteEntry] = useState(null);
    const [completeNotes, setCompleteNotes] = useState('');
    const [isCompleting, setIsCompleting] = useState(false);

    // Accept / Decline / Cancel Reallocation Modal States (Default System Popup Style)
    const [showDeclineModal, setShowDeclineModal] = useState(false);
    const [declineEntry, setDeclineEntry] = useState(null);
    const [declineReason, setDeclineReason] = useState('');
    const [isDeclining, setIsDeclining] = useState(false);

    const [showAcceptModal, setShowAcceptModal] = useState(false);
    const [acceptEntry, setAcceptEntry] = useState(null);
    const [isAccepting, setIsAccepting] = useState(false);

    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelEntry, setCancelEntry] = useState(null);
    const [isCancelling, setIsCancelling] = useState(false);

    // Photo Preview Modal State
    const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);

    // Load initial master data
    useEffect(() => {
        const fetchMasters = async () => {
            try {
                const [usersData, deptsData] = await Promise.all([
                    getUsers(),
                    getDepartments()
                ]);
                setEmployees(usersData || []);
                setDepartments(deptsData || []);
            } catch (err) {
                console.error("Error fetching employee master data", err);
            }
        };
        fetchMasters();
    }, []);

    // Fetch allocated visitors when filters change
    useEffect(() => {
        fetchAllocatedList();
    }, [selectedFilterDepartment, selectedEmployee, viewAllEmployees, activeStatusTab]);

    const fetchAllocatedList = async () => {
        try {
            setLoading(true);
            const params = {
                status: activeStatusTab
            };
            if (selectedFilterDepartment) {
                params.department = selectedFilterDepartment.value;
            }
            if (selectedEmployee) {
                params.employee = selectedEmployee.value;
            } else if (viewAllEmployees) {
                params.all = 'true';
            }

            const data = await getAllocatedVisitors(params);
            setEntries(Array.isArray(data) ? data : (data.results || []));
        } catch (err) {
            console.error("Error fetching allocated visitors", err);
            setEntries([]);
        } finally {
            setLoading(false);
        }
    };

    // Filter by department and live search text
    const filteredEntries = useMemo(() => {
        let result = entries;
        if (selectedFilterDepartment) {
            result = result.filter(e => {
                if (e.department_id) return String(e.department_id) === String(selectedFilterDepartment.value);
                if (e.department && typeof e.department === 'object') return String(e.department.id) === String(selectedFilterDepartment.value);
                if (e.department_name) return e.department_name.trim().toLowerCase() === (selectedFilterDepartment.label || '').trim().toLowerCase();
                return false;
            });
        }
        if (!searchTerm.trim()) return result;
        const q = searchTerm.toLowerCase();
        return result.filter(e => {
            const visitorName = (e.visitor_name || '').toLowerCase();
            const mobile = (e.visitor_mobile || '').toLowerCase();
            const company = (e.company_name || e.visitor_company || '').toLowerCase();
            const empName = (e.employee_name || '').toLowerCase();
            const tag = (e.tag_code || e.tag_number || '').toLowerCase();
            const vehicleMatch = e.vehicles && e.vehicles.some(v => 
                (v.vehicle_number || '').toLowerCase().includes(q) || 
                (v.driver_name || '').toLowerCase().includes(q)
            );
            return visitorName.includes(q) || mobile.includes(q) || company.includes(q) || 
                   empName.includes(q) || tag.includes(q) || vehicleMatch;
        });
    }, [entries, selectedFilterDepartment, searchTerm]);

    // Reset pagination to page 1 on filter or search change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedFilterDepartment, selectedEmployee, activeStatusTab]);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentEntries = filteredEntries.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);

    // Handle Open Detail Modal
    const handleOpenDetail = (entry) => {
        setSelectedDetailEntry(entry);
        setShowDetailModal(true);
    };

    // Handle Open Reallocation Modal
    const handleOpenReallocate = (entry) => {
        const canManage = isLastAllocatedEmployee(entry) || currentUser?.is_superuser;
        if (!canManage) {
            Swal.fire({
                icon: 'warning',
                title: 'Permission Denied',
                text: `Only the currently allocated employee (${entry.employee_name || 'current host'}) can reallocate this visitor.`
            });
            return;
        }
        setReallocateEntry(entry);
        setTargetDepartment(null);
        setTargetEmployee(null);
        setReallocateReason('');
        setShowReallocateModal(true);
    };

    // Handle Submit Reallocation
    const handleConfirmReallocation = async (e) => {
        e.preventDefault();
        if (!targetDepartment) {
            Swal.fire('Validation Error', 'Please select the receiving department first.', 'warning');
            return;
        }
        if (!targetEmployee) {
            Swal.fire('Validation Error', 'Please select the employee under this department to reallocate to.', 'warning');
            return;
        }

        try {
            setIsReallocating(true);
            const payload = {
                to_employee: targetEmployee.value,
                to_department: targetDepartment.value,
                reason: reallocateReason
            };

            await reallocateVisitor(reallocateEntry.id, payload, reallocateEntry.entry_type || 'visitor');

            Swal.fire({
                icon: 'success',
                title: 'Reallocation Request Sent',
                text: `Transfer request sent to ${targetEmployee.label}. Awaiting their approval before responsibility transfers. If rejected, the visitor remains your responsibility.`,
                confirmButtonColor: '#0a500f'
            });

            setShowReallocateModal(false);
            setReallocateEntry(null);
            setTargetDepartment(null);
            setTargetEmployee(null);
            setReallocateReason('');
            fetchAllocatedList();
        } catch (err) {
            console.error("Reallocation failed", err);
            const msg = err.response?.data?.detail || 'Failed to reallocate visitor.';
            Swal.fire('Error', msg, 'error');
        } finally {
            setIsReallocating(false);
        }
    };

    // Handle Open Decline Reallocation Modal
    const handleOpenDeclineModal = (entry) => {
        setDeclineEntry(entry);
        setDeclineReason('');
        setShowDeclineModal(true);
    };

    // Handle Confirm Decline Reallocation
    const handleConfirmDecline = async (e) => {
        if (e) e.preventDefault();
        if (!declineEntry) return;
        const reallocId = declineEntry.pending_reallocation?.id || declineEntry.realloc_id;
        if (!reallocId) return;

        try {
            setIsDeclining(true);
            await respondReallocation(reallocId, 'reject', declineReason.trim());
            setShowDeclineModal(false);
            setDeclineEntry(null);
            setDeclineReason('');
            Swal.fire({
                icon: 'success',
                title: 'Reallocation Declined',
                text: 'The visitor remains the responsibility of the current host employee.',
                timer: 2200,
                showConfirmButton: false
            });
            fetchAllocatedList();
            if (showDetailModal) {
                setShowDetailModal(false);
                setSelectedDetailEntry(null);
            }
        } catch (err) {
            console.error("Failed to decline reallocation", err);
            const msg = err.response?.data?.detail || 'Failed to decline reallocation.';
            Swal.fire('Error', msg, 'error');
        } finally {
            setIsDeclining(false);
        }
    };

    // Handle Open Accept Reallocation Modal
    const handleOpenAcceptModal = (entry) => {
        setAcceptEntry(entry);
        setShowAcceptModal(true);
    };

    // Handle Confirm Accept Reallocation
    const handleConfirmAccept = async (e) => {
        if (e) e.preventDefault();
        if (!acceptEntry) return;
        const reallocId = acceptEntry.pending_reallocation?.id || acceptEntry.realloc_id;
        if (!reallocId) return;

        try {
            setIsAccepting(true);
            await respondReallocation(reallocId, 'approve');
            setShowAcceptModal(false);
            setAcceptEntry(null);
            Swal.fire({
                icon: 'success',
                title: 'Reallocation Accepted',
                text: 'You are now the active host official for this visitor.',
                timer: 2200,
                showConfirmButton: false
            });
            fetchAllocatedList();
            if (showDetailModal) {
                setShowDetailModal(false);
                setSelectedDetailEntry(null);
            }
        } catch (err) {
            console.error("Failed to accept reallocation", err);
            const msg = err.response?.data?.detail || 'Failed to accept reallocation.';
            Swal.fire('Error', msg, 'error');
        } finally {
            setIsAccepting(false);
        }
    };

    // Handle Open Cancel Reallocation Modal
    const handleOpenCancelModal = (entry) => {
        setCancelEntry(entry);
        setShowCancelModal(true);
    };

    // Handle Confirm Cancel Reallocation Request
    const handleConfirmCancel = async (e) => {
        if (e) e.preventDefault();
        if (!cancelEntry) return;
        const reallocId = cancelEntry.pending_reallocation?.id || cancelEntry.realloc_id;
        if (!reallocId) return;

        try {
            setIsCancelling(true);
            await cancelReallocation(reallocId);
            setShowCancelModal(false);
            setCancelEntry(null);
            Swal.fire({
                icon: 'success',
                title: 'Request Cancelled',
                text: 'The reallocation request was withdrawn. You remain the responsible host.',
                timer: 2200,
                showConfirmButton: false
            });
            fetchAllocatedList();
            if (showDetailModal) {
                setShowDetailModal(false);
                setSelectedDetailEntry(null);
            }
        } catch (err) {
            console.error("Failed to cancel reallocation", err);
            const msg = err.response?.data?.detail || 'Failed to cancel reallocation.';
            Swal.fire('Error', msg, 'error');
        } finally {
            setIsCancelling(false);
        }
    };

    // Handle Open Complete Movement Modal
    const handleOpenComplete = (entry) => {
        const canManage = isLastAllocatedEmployee(entry) || currentUser?.is_superuser;
        if (!canManage) {
            Swal.fire({
                icon: 'warning',
                title: 'Permission Denied',
                text: `Only the currently allocated employee (${entry.employee_name || 'current host'}) has permission to complete this visitor's movement.`
            });
            return;
        }
        setCompleteEntry(entry);
        setCompleteNotes('');
        setShowCompleteModal(true);
    };

    // Handle Confirm Complete Movement
    const handleConfirmComplete = async (e) => {
        if (e) e.preventDefault();
        if (!completeEntry) return;

        try {
            setIsCompleting(true);
            await completeVisitorMovement(completeEntry.id, { notes: completeNotes.trim() }, completeEntry.entry_type || 'visitor');
            Swal.fire({
                icon: 'success',
                title: 'Movement Completed',
                text: `${completeEntry.visitor_name} is now marked ready for gate exit.`,
                timer: 2000,
                showConfirmButton: false
            });
            setShowCompleteModal(false);
            setCompleteEntry(null);
            setCompleteNotes('');
            fetchAllocatedList();
        } catch (err) {
            console.error("Error completing movement", err);
            const msg = err.response?.data?.detail || 'Failed to complete visitor movement.';
            Swal.fire('Error', msg, 'error');
        } finally {
            setIsCompleting(false);
        }
    };

    // Department options
    const departmentOptions = useMemo(() => {
        return departments.map(d => ({
            value: d.id,
            label: d.name || d.department_name
        }));
    }, [departments]);

    // All employee options for dropdowns
    const employeeOptions = useMemo(() => {
        return employees.map(emp => ({
            value: emp.id,
            label: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.username,
            department: emp.department
        }));
    }, [employees]);

    // Filtered employee options for the top filter bar
    const filterEmployeeOptions = useMemo(() => {
        if (!selectedFilterDepartment) return employeeOptions;
        return employees
            .filter(emp => doesEmployeeMatchDepartment(emp, selectedFilterDepartment))
            .map(emp => ({
                value: emp.id,
                label: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.username,
                department: emp.department
            }));
    }, [employees, employeeOptions, selectedFilterDepartment]);

    // Filtered employee options for the Reallocation Modal:
    // Strictly under targetDepartment and excluding current host of reallocateEntry
    const reallocateEmployeeOptions = useMemo(() => {
        if (!targetDepartment) return [];
        return employees
            .filter(emp => {
                if (reallocateEntry && emp.id === reallocateEntry.employee) return false;
                return doesEmployeeMatchDepartment(emp, targetDepartment);
            })
            .map(emp => {
                const name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.username;
                const desig = emp.designation?.title || emp.designation?.name || (typeof emp.designation === 'string' ? emp.designation : '');
                return {
                    value: emp.id,
                    label: desig ? `${name} (${desig})` : name,
                    department: emp.department
                };
            });
    }, [employees, targetDepartment, reallocateEntry]);

    // React-Select styles tailored to theme
    // React-Select styles tailored to standard 38px height
    const selectStyles = {
        control: (base, state) => ({
            ...base,
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor: state.isFocused ? '#0a500f' : (isDark ? '#334155' : '#cbd5e1'),
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15, 0.15)' : 'none',
            '&:hover': {
                borderColor: '#0a500f'
            },
            borderRadius: '6px',
            fontSize: '13px',
            minHeight: '38px',
            height: '38px'
        }),
        valueContainer: (base) => ({
            ...base,
            height: '38px',
            padding: '0 10px'
        }),
        input: (base) => ({
            ...base,
            margin: '0px'
        }),
        indicatorsContainer: (base) => ({
            ...base,
            height: '38px'
        }),
        menu: (base) => ({
            ...base,
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            zIndex: 99999
        }),
        menuPortal: (base) => ({
            ...base,
            zIndex: 99999
        }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected 
                ? '#0a500f' 
                : state.isFocused 
                    ? (isDark ? '#334155' : '#f0fdf4') 
                    : 'transparent',
            color: state.isSelected ? '#ffffff' : (isDark ? '#f1f5f9' : '#1e293b'),
            fontSize: '13px',
            cursor: 'pointer'
        }),
        singleValue: (base) => ({
            ...base,
            color: isDark ? '#f1f5f9' : '#1e293b'
        })
    };

    return (
        <div className={embedded ? "" : "container-fluid p-0"}>
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <Card.Title className="mb-0">Visitor Reallocation & Campus Movement</Card.Title>
                            <div className="d-flex flex-wrap gap-2 align-items-center">
                                <div style={{ flex: '1 1 auto', minWidth: '220px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Visitor / Vehicle / Tag..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                    {searchTerm && (
                                        <button 
                                            type="button" 
                                            className="btn btn-sm position-absolute top-50 end-0 translate-middle-y p-0 me-2 text-muted border-0" 
                                            onClick={() => setSearchTerm('')}
                                        >
                                            &times;
                                        </button>
                                    )}
                                </div>
                                <Button 
                                    variant="outline-secondary" 
                                    size="sm" 
                                    style={{ height: '38px', borderRadius: '6px', fontWeight: '500' }}
                                    onClick={fetchAllocatedList}
                                    title="Refresh List"
                                >
                                    <i className={`fa fa-sync-alt me-1 ${loading ? 'fa-spin' : ''}`}></i>
                                    <span>Refresh</span>
                                </Button>
                            </div>
                        </Card.Header>

                        {/* Sub-Header Filter Bar: Movement Status Tabs (Left) + Department & Employee Filters (Right) */}
                        <div 
                            className="px-4 py-2 border-bottom d-flex flex-wrap align-items-center justify-content-between gap-3"
                            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fafbfc' }}
                        >
                            {/* Movement Status Tabs */}
                            <div 
                                className="d-flex align-items-center p-1 rounded-3" 
                                style={{ background: isDark ? '#1e293b' : '#f1f5f9', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}
                            >
                                <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => setActiveStatusTab('active')}
                                    style={{
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '4px 14px',
                                        fontSize: '12px',
                                        fontWeight: activeStatusTab === 'active' ? '600' : '500',
                                        background: activeStatusTab === 'active' ? '#0a500f' : 'transparent',
                                        color: activeStatusTab === 'active' ? '#ffffff' : '#64748b',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    Active
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => setActiveStatusTab('completed')}
                                    style={{
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '4px 14px',
                                        fontSize: '12px',
                                        fontWeight: activeStatusTab === 'completed' ? '600' : '500',
                                        background: activeStatusTab === 'completed' ? '#0a500f' : 'transparent',
                                        color: activeStatusTab === 'completed' ? '#ffffff' : '#64748b',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    Completed
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => setActiveStatusTab('reassigned')}
                                    style={{
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '4px 14px',
                                        fontSize: '12px',
                                        fontWeight: activeStatusTab === 'reassigned' ? '600' : '500',
                                        background: activeStatusTab === 'reassigned' ? '#0a500f' : 'transparent',
                                        color: activeStatusTab === 'reassigned' ? '#ffffff' : '#64748b',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    Transferred
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => setActiveStatusTab('pending_approval')}
                                    style={{
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '4px 14px',
                                        fontSize: '12px',
                                        fontWeight: activeStatusTab === 'pending_approval' ? '600' : '500',
                                        background: activeStatusTab === 'pending_approval' ? '#eab308' : 'transparent',
                                        color: activeStatusTab === 'pending_approval' ? '#ffffff' : '#64748b',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    Pending Approval
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => setActiveStatusTab('all')}
                                    style={{
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '4px 14px',
                                        fontSize: '12px',
                                        fontWeight: activeStatusTab === 'all' ? '600' : '500',
                                        background: activeStatusTab === 'all' ? '#0a500f' : 'transparent',
                                        color: activeStatusTab === 'all' ? '#ffffff' : '#64748b',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    All
                                </button>
                            </div>

                            {/* Department and Employee Filter Dropdowns */}
                            <div className="d-flex align-items-center gap-2.5 ms-auto">
                                <div style={{ width: '190px' }}>
                                    <Select
                                        options={departmentOptions}
                                        value={selectedFilterDepartment}
                                        onChange={(sel) => {
                                            setSelectedFilterDepartment(sel);
                                            setSelectedEmployee(null);
                                        }}
                                        styles={selectStyles}
                                        placeholder="All Departments..."
                                        isClearable
                                        menuPortalTarget={document.body}
                                    />
                                </div>
                                <div style={{ width: '210px' }}>
                                    <Select
                                        options={filterEmployeeOptions}
                                        value={selectedEmployee}
                                        onChange={(sel) => {
                                            setSelectedEmployee(sel);
                                            setViewAllEmployees(!sel);
                                        }}
                                        styles={selectStyles}
                                        placeholder={selectedFilterDepartment ? `Employees in ${selectedFilterDepartment.label}...` : "All Employees..."}
                                        isClearable
                                        menuPortalTarget={document.body}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Card Body: Table Matching ManageMenus Style */}
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
                                                <th><strong>VISITOR</strong></th>
                                                <th><strong>VEHICLE</strong></th>
                                                <th><strong>HOST OFFICIAL</strong></th>
                                                <th><strong>GATE & TAG</strong></th>
                                                <th><strong>ENTRY TIME</strong></th>
                                                <th><strong>STATUS</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredEntries.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" className="text-center py-4 text-muted">No entries</td>
                                                </tr>
                                            ) : (
                                                currentEntries.map((entry) => {
                                                    const isCompleted = entry.verification_status === 'completed';
                                                    const isReassigned = entry.verification_status === 'reassigned';
                                                    const hasExited = !!entry.exit_time;
                                                    const isHost = isLastAllocatedEmployee(entry) || currentUser?.is_superuser;
                                                    const canReallocate = isHost && !hasExited && !isCompleted;
                                                    const canComplete = isHost && !hasExited && !isCompleted;
                                                    const hostTitle = entry.employee_name || 'the allocated employee';

                                                    return (
                                                        <tr key={`${entry.entry_type || 'visitor'}-${entry.id}`}>
                                                            {/* Visitor Column */}
                                                            <td>
                                                                <strong>{entry.visitor_name || 'Anonymous Visitor'}</strong>
                                                                <div className="text-muted small">
                                                                    {entry.visitor_mobile || '—'}
                                                                    {(entry.company_name || entry.visitor_company) && (
                                                                        <span> &bull; {entry.company_name || entry.visitor_company}</span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* Vehicle Column */}
                                                            <td>
                                                                {entry.vehicles && entry.vehicles.length > 0 ? (
                                                                    <div>
                                                                        <strong>{entry.vehicles[0].vehicle_number}</strong>
                                                                        {entry.vehicles[0].driver_name && (
                                                                            <div className="text-muted small">({entry.vehicles[0].driver_name})</div>
                                                                        )}
                                                                        {entry.vehicles.length > 1 && (
                                                                            <span className="badge badge-info light ms-1" style={{ fontSize: '10px' }}>
                                                                                +{entry.vehicles.length - 1} more
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-muted">-</span>
                                                                )}
                                                            </td>

                                                            {/* Host Official Column */}
                                                            <td>
                                                                <strong>{entry.employee_name || 'Unassigned'}</strong>
                                                                <div className="text-muted small">{entry.department_name || 'General Dept'}</div>
                                                                {entry.has_pending_reallocation && entry.pending_reallocation && (
                                                                    <div className="text-warning small fw-semibold mt-1" style={{ fontSize: '11px' }}>
                                                                        <i className="fa fa-clock me-1"></i>Req &rarr; {entry.pending_reallocation.to_employee_name}
                                                                    </div>
                                                                )}
                                                                {entry.reallocations && entry.reallocations.length > 0 && !entry.has_pending_reallocation && (
                                                                    <div className="text-primary small" style={{ fontSize: '11px' }}>
                                                                        <i className="fa fa-exchange-alt me-1"></i>Transferred ({entry.reallocations.length})
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* Gate & Tag Column */}
                                                            <td>
                                                                <div>{entry.entry_gate_name || `Gate #${entry.entry_gate_no || '1'}`}</div>
                                                                {(entry.tag_code || entry.tag_number) ? (
                                                                    <span className="badge badge-info light mt-1">
                                                                        <i className="fa fa-tag me-1"></i> Tag #{entry.tag_code || entry.tag_number}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-muted small">-</span>
                                                                )}
                                                            </td>

                                                            {/* Entry Time Column */}
                                                            <td>
                                                                {formatDateDMY(entry.entry_time)}
                                                                <div className="text-muted small">
                                                                    {formatTimeHM(entry.entry_time)}
                                                                </div>
                                                            </td>

                                                            {/* Movement Status Column */}
                                                            <td>
                                                                {hasExited ? (
                                                                    <div>
                                                                        <span className="badge light badge-danger">Exited</span>
                                                                        {entry.exit_time && (
                                                                            <div className="text-muted small mt-1" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                                                                                {formatReadyToExitTime(entry.exit_time)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : isCompleted ? (
                                                                    <div>
                                                                        <span className="badge light badge-info">Ready for Exit</span>
                                                                        {entry.movement_completed_at && (
                                                                            <div className="text-muted small mt-1" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                                                                                {formatReadyToExitTime(entry.movement_completed_at)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : entry.has_pending_reallocation ? (
                                                                    <span className="badge light badge-warning d-inline-flex align-items-center gap-1">
                                                                        <span className="spinner-grow spinner-grow-sm text-warning" style={{ width: '5px', height: '5px' }}></span>
                                                                        Reallocation Pending
                                                                    </span>
                                                                ) : isReassigned ? (
                                                                    <span className="badge light badge-warning">Transferred</span>
                                                                ) : (
                                                                    <span className="badge light badge-success">Active</span>
                                                                )}
                                                            </td>

                                                            {/* Actions Column */}
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end gap-1">
                                                                    <Button
                                                                        variant="outline-primary"
                                                                        size="sm"
                                                                        className="shadow"
                                                                        style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                        onClick={() => handleOpenDetail(entry)}
                                                                        title="View Details"
                                                                    >
                                                                        <i className="fa fa-eye"></i>
                                                                    </Button>

                                                                    {/* If pending reallocation & current user is recipient: Accept / Decline */}
                                                                    {entry.has_pending_reallocation && entry.pending_reallocation && (currentUser?.id === entry.pending_reallocation.to_employee || currentUser?.is_superuser) && (
                                                                        <>
                                                                            <Button
                                                                                variant="outline-success"
                                                                                size="sm"
                                                                                className="shadow"
                                                                                style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                                onClick={() => handleOpenAcceptModal(entry)}
                                                                                title="Accept Reallocation"
                                                                            >
                                                                                <i className="fa fa-check"></i>
                                                                            </Button>
                                                                            <Button
                                                                                variant="outline-danger"
                                                                                size="sm"
                                                                                className="shadow"
                                                                                style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                                onClick={() => handleOpenDeclineModal(entry)}
                                                                                title="Decline Reallocation"
                                                                            >
                                                                                <i className="fa fa-times"></i>
                                                                            </Button>
                                                                        </>
                                                                    )}

                                                                    {/* If pending reallocation & current user is initiator: Cancel request */}
                                                                    {entry.has_pending_reallocation && entry.pending_reallocation && (currentUser?.id === entry.pending_reallocation.from_employee || currentUser?.is_superuser) && (
                                                                        <Button
                                                                            variant="outline-secondary"
                                                                            size="sm"
                                                                            className="shadow"
                                                                            style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                            onClick={() => handleOpenCancelModal(entry)}
                                                                            title="Cancel Reallocation Request"
                                                                        >
                                                                            <i className="fa fa-ban"></i>
                                                                        </Button>
                                                                    )}

                                                                    {!hasExited && !isCompleted && (
                                                                        <>
                                                                            <Button
                                                                                variant="outline-warning"
                                                                                size="sm"
                                                                                className="shadow"
                                                                                style={{ 
                                                                                    width: '28px', 
                                                                                    height: '28px', 
                                                                                    display: 'inline-flex', 
                                                                                    alignItems: 'center', 
                                                                                    justifyContent: 'center', 
                                                                                    padding: '0', 
                                                                                    fontSize: '12px', 
                                                                                    borderRadius: '6px',
                                                                                    opacity: (canReallocate && !entry.has_pending_reallocation) ? 1 : 0.45,
                                                                                    cursor: (canReallocate && !entry.has_pending_reallocation) ? 'pointer' : 'not-allowed'
                                                                                }}
                                                                                disabled={!canReallocate || entry.has_pending_reallocation}
                                                                                onClick={() => canReallocate && !entry.has_pending_reallocation && handleOpenReallocate(entry)}
                                                                                title={
                                                                                    entry.has_pending_reallocation
                                                                                        ? "A reallocation request is already pending approval"
                                                                                        : (!canReallocate ? `Only ${hostTitle} can reallocate this visitor` : "Reallocate Visitor")
                                                                                }
                                                                            >
                                                                                <i className="fa fa-exchange-alt"></i>
                                                                            </Button>

                                                                            <Button
                                                                                variant="outline-success"
                                                                                size="sm"
                                                                                className="shadow"
                                                                                style={{ 
                                                                                    width: '28px', 
                                                                                    height: '28px', 
                                                                                    display: 'inline-flex', 
                                                                                    alignItems: 'center', 
                                                                                    justifyContent: 'center', 
                                                                                    padding: '0', 
                                                                                    fontSize: '12px', 
                                                                                    borderRadius: '6px',
                                                                                    opacity: canComplete ? 1 : 0.45,
                                                                                    cursor: canComplete ? 'pointer' : 'not-allowed'
                                                                                }}
                                                                                disabled={!canComplete}
                                                                                onClick={() => canComplete && handleOpenComplete(entry)}
                                                                                title={!canComplete ? `Only ${hostTitle} can complete movement` : "Complete Movement"}
                                                                            >
                                                                                <i className="fa fa-check"></i>
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {filteredEntries.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredEntries.length)} of {filteredEntries.length} entries
                                    </div>
                                    {totalPages > 1 && (
                                        <nav>
                                            <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
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
                                                                <button type="button" className="page-link" onClick={() => setCurrentPage(pageNumber)} style={{ border: 'none' }}>
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
                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
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

            {/* DETAIL MODAL (CheckoutModal Style) */}
            <Modal 
                show={showDetailModal} 
                onHide={() => setShowDetailModal(false)} 
                size="lg" 
                centered
                dialogClassName={`item-custom-modal ${isDark ? 'dark-mode-modal' : ''}`}
            >
                {selectedDetailEntry && (
                    <div>
                        {/* Modal Header */}
                        <div className="modal-header-custom">
                            <div className="d-flex align-items-center" style={{ gap: '18px' }}>
                                <div 
                                    className="modal-icon-circle" 
                                    style={{ 
                                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                        boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)',
                                        width: '52px',
                                        height: '52px'
                                    }}
                                >
                                    <i className="fa fa-id-card text-white fs-4"></i>
                                </div>
                                <div>
                                    <h4 className="modal-title font-w700 mb-1" style={{ fontSize: '20px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                        Gate Entry Details
                                    </h4>
                                    <p className="text-muted mb-0" style={{ fontSize: '13.5px' }}>
                                        Visitor profile, campus movements, and vehicle trail
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="modal-close-x"
                                onClick={() => setShowDetailModal(false)}
                                title="Close"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="modal-body-custom">
                            {/* Pending Reallocation Alert Banner */}
                            {selectedDetailEntry.has_pending_reallocation && selectedDetailEntry.pending_reallocation && (
                                <div 
                                    className="p-3 mb-4 rounded-3 d-flex flex-wrap align-items-center justify-content-between gap-3 shadow-xs"
                                    style={{
                                        backgroundColor: isDark ? 'rgba(234, 179, 8, 0.12)' : '#fef9c3',
                                        border: '1.5px solid #facc15',
                                        color: isDark ? '#fef08a' : '#854d0e'
                                    }}
                                >
                                    <div className="d-flex align-items-center gap-3">
                                        <div 
                                            className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0"
                                            style={{ width: '38px', height: '38px', backgroundColor: '#eab308' }}
                                        >
                                            <i className="fa fa-clock fa-lg"></i>
                                        </div>
                                        <div>
                                            <div className="fw-bold" style={{ fontSize: '14px' }}>
                                                Reallocation Approval Pending
                                            </div>
                                            <div style={{ fontSize: '12.5px' }}>
                                                Host <strong>{selectedDetailEntry.pending_reallocation.from_employee_name}</strong> requested to transfer responsibility to <strong>{selectedDetailEntry.pending_reallocation.to_employee_name}</strong> ({selectedDetailEntry.pending_reallocation.to_department_name || 'Dept'}).
                                                {selectedDetailEntry.pending_reallocation.reason && <span className="ms-1 fst-italic">"{selectedDetailEntry.pending_reallocation.reason}"</span>}
                                            </div>
                                            <div className="text-muted small mt-0.5" style={{ fontSize: '11px' }}>
                                                If declined, this visitor remains the current host ({selectedDetailEntry.employee_name})'s responsibility.
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action buttons if current user is to_employee or from_employee */}
                                    <div className="d-flex align-items-center gap-2">
                                        {(currentUser?.id === selectedDetailEntry.pending_reallocation.to_employee || currentUser?.is_superuser) && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="success"
                                                    className="fw-semibold px-3 shadow-xs"
                                                    style={{ height: '34px', fontSize: '12px' }}
                                                    onClick={() => handleOpenAcceptModal(selectedDetailEntry)}
                                                >
                                                    <i className="fa fa-check me-1"></i> Accept Transfer
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline-danger"
                                                    className="fw-semibold px-3 shadow-xs"
                                                    style={{ height: '34px', fontSize: '12px' }}
                                                    onClick={() => handleOpenDeclineModal(selectedDetailEntry)}
                                                >
                                                    <i className="fa fa-times me-1"></i> Decline
                                                </Button>
                                            </>
                                        )}

                                        {(currentUser?.id === selectedDetailEntry.pending_reallocation.from_employee || currentUser?.is_superuser) && (
                                            <Button
                                                size="sm"
                                                variant="outline-secondary"
                                                className="fw-semibold px-3 shadow-xs"
                                                style={{ height: '34px', fontSize: '12px' }}
                                                onClick={() => handleOpenCancelModal(selectedDetailEntry)}
                                            >
                                                <i className="fa fa-ban me-1"></i> Cancel Request
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Visitor Profile Section */}
                            <div 
                                className="p-4 mb-4 rounded-4" 
                                style={{ 
                                    background: isDark ? 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)'
                                }}
                            >
                                <div className="d-flex align-items-center mb-3 pb-3 border-bottom" style={{ gap: '22px', borderColor: isDark ? '#334155' : '#eef2f6' }}>
                                    <div 
                                        style={{ 
                                            width: '68px', 
                                            height: '68px', 
                                            borderRadius: '18px', 
                                            overflow: 'hidden', 
                                            flexShrink: 0,
                                            border: '2.5px solid #0a500f',
                                            boxShadow: '0 4px 14px rgba(10, 80, 15, 0.25)',
                                            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        {selectedDetailEntry.visitor_photo || selectedDetailEntry.driver_photo ? (
                                            <img 
                                                src={getFullImageUrl(selectedDetailEntry.visitor_photo || selectedDetailEntry.driver_photo)} 
                                                alt={selectedDetailEntry.visitor_name} 
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                            />
                                        ) : (
                                            <i className={`fa ${selectedDetailEntry.entry_type === 'vehicle' ? 'fa-truck' : 'fa-user'} text-muted fs-2`}></i>
                                        )}
                                    </div>
                                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                        <h5 className="fw-bold mb-2" style={{ fontSize: '20px', color: isDark ? '#f8fafc' : '#0f172a', lineHeight: 1.3 }}>
                                            {selectedDetailEntry.visitor_name}
                                        </h5>
                                        <div className="d-flex flex-wrap align-items-center" style={{ gap: '10px' }}>
                                            {selectedDetailEntry.visitor_mobile && (
                                                <span 
                                                    className="badge border" 
                                                    style={{ 
                                                        backgroundColor: isDark ? '#1e293b' : '#ffffff', 
                                                        borderColor: isDark ? '#334155' : '#e2e8f0', 
                                                        color: isDark ? '#94a3b8' : '#475569', 
                                                        fontSize: '12px', 
                                                        fontWeight: 500,
                                                        borderRadius: '8px',
                                                        padding: '6px 12px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    <i className="fa fa-phone-alt text-success" style={{ fontSize: '11px' }}></i>
                                                    <span>{selectedDetailEntry.visitor_mobile}</span>
                                                </span>
                                            )}
                                            {(selectedDetailEntry.company_name || selectedDetailEntry.visitor_company) && (
                                                <span 
                                                    className="badge border" 
                                                    style={{ 
                                                        backgroundColor: isDark ? '#1e293b' : '#ffffff', 
                                                        borderColor: isDark ? '#334155' : '#e2e8f0', 
                                                        color: isDark ? '#94a3b8' : '#475569', 
                                                        fontSize: '12px', 
                                                        fontWeight: 500,
                                                        borderRadius: '8px',
                                                        padding: '6px 12px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    <i className="fa fa-building text-primary" style={{ fontSize: '11px' }}></i>
                                                    <span>{selectedDetailEntry.company_name || selectedDetailEntry.visitor_company}</span>
                                                </span>
                                            )}
                                            {selectedDetailEntry.email && (
                                                <span 
                                                    className="badge border" 
                                                    style={{ 
                                                        backgroundColor: isDark ? '#1e293b' : '#ffffff', 
                                                        borderColor: isDark ? '#334155' : '#e2e8f0', 
                                                        color: isDark ? '#94a3b8' : '#475569', 
                                                        fontSize: '12px', 
                                                        fontWeight: 500,
                                                        borderRadius: '8px',
                                                        padding: '6px 12px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    <i className="fa fa-envelope text-warning" style={{ fontSize: '11px' }}></i>
                                                    <span>{selectedDetailEntry.email}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="d-flex flex-column align-items-end gap-2 flex-shrink-0">
                                        {selectedDetailEntry.tag_code || selectedDetailEntry.tag_number ? (() => {
                                            const tagStyle = getSoftTagBadgeStyle(selectedDetailEntry.tag_colour, isDark);
                                            return (
                                                <span 
                                                    className="badge d-inline-flex align-items-center gap-1.5" 
                                                    style={{ 
                                                        backgroundColor: tagStyle.backgroundColor,
                                                        color: tagStyle.color,
                                                        border: `1.5px solid ${tagStyle.borderColor}`,
                                                        fontSize: '12px',
                                                        fontWeight: 600,
                                                        padding: '6px 14px',
                                                        borderRadius: '20px'
                                                    }}
                                                >
                                                    <i className="fa fa-id-badge" style={{ color: tagStyle.dotColor, fontSize: '12px' }}></i>
                                                    <span>Tag #{selectedDetailEntry.tag_code || selectedDetailEntry.tag_number}</span>
                                                </span>
                                            );
                                        })() : null}
                                        {(selectedDetailEntry.id_card_photo || selectedDetailEntry.driver_license_photo) && (
                                            <div 
                                                className="d-inline-flex flex-column align-items-center cursor-pointer p-1.5 border rounded-3 shadow-sm"
                                                style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0' }}
                                                onClick={() => window.open(getFullImageUrl(selectedDetailEntry.id_card_photo || selectedDetailEntry.driver_license_photo), '_blank')}
                                                title="Click to view full ID proof"
                                            >
                                                <img 
                                                    src={getFullImageUrl(selectedDetailEntry.id_card_photo || selectedDetailEntry.driver_license_photo)} 
                                                    alt="ID Proof" 
                                                    style={{ width: '70px', height: '44px', objectFit: 'cover', borderRadius: '6px' }}
                                                />
                                                <span className="small text-muted mt-1 fw-bold" style={{ fontSize: '10px' }}>
                                                    <i className="fa fa-external-link-alt me-1"></i>View ID Proof
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Visit Metadata Grid */}
                                <Row className="g-3">
                                    <Col md={4} sm={6}>
                                        <div className="p-3 rounded-3 h-100" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#eef2f6'}` }}>
                                            <div className="text-muted d-flex align-items-center gap-2 mb-1" style={{ fontSize: '12px' }}>
                                                <i className="fa fa-user-tie text-primary"></i> Current Host
                                            </div>
                                            <div className="fw-bold text-truncate" style={{ fontSize: '14px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                                {selectedDetailEntry.employee_name || 'N/A'}
                                            </div>
                                        </div>
                                    </Col>
                                    <Col md={4} sm={6}>
                                        <div className="p-3 rounded-3 h-100" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#eef2f6'}` }}>
                                            <div className="text-muted d-flex align-items-center gap-2 mb-1" style={{ fontSize: '12px' }}>
                                                <i className="fa fa-sitemap text-info"></i> Department
                                            </div>
                                            <div className="fw-bold text-truncate" style={{ fontSize: '14px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                                {selectedDetailEntry.department_name || 'N/A'}
                                            </div>
                                        </div>
                                    </Col>
                                    <Col md={4} sm={6}>
                                        <div className="p-3 rounded-3 h-100" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#eef2f6'}` }}>
                                            <div className="text-muted d-flex align-items-center gap-2 mb-1" style={{ fontSize: '12px' }}>
                                                <i className="fa fa-door-open text-warning"></i> Entry Gate
                                            </div>
                                            <div className="fw-bold text-truncate" style={{ fontSize: '14px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                                {selectedDetailEntry.entry_gate_name || `Gate #${selectedDetailEntry.entry_gate_no || '1'}`}
                                            </div>
                                        </div>
                                    </Col>
                                    <Col md={4} sm={6}>
                                        <div className="p-3 rounded-3 h-100" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#eef2f6'}` }}>
                                            <div className="text-muted d-flex align-items-center gap-2 mb-1" style={{ fontSize: '12px' }}>
                                                <i className="fa fa-clock text-success"></i> Entry Timestamp
                                            </div>
                                            <div className="fw-bold text-truncate" style={{ fontSize: '14px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                                {formatDateDMY(selectedDetailEntry.entry_time)} {formatTimeHM(selectedDetailEntry.entry_time)}
                                            </div>
                                        </div>
                                    </Col>
                                    <Col md={4} sm={6}>
                                        <div className="p-3 rounded-3 h-100" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#eef2f6'}` }}>
                                            <div className="text-muted d-flex align-items-center gap-2 mb-1" style={{ fontSize: '12px' }}>
                                                <i className="fa fa-users text-primary"></i> Number of Persons
                                            </div>
                                            <div className="fw-bold text-truncate" style={{ fontSize: '14px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                                {selectedDetailEntry.number_of_persons || 1} Person(s)
                                            </div>
                                        </div>
                                    </Col>
                                    <Col md={4} sm={6}>
                                        <div className="p-3 rounded-3 h-100" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#eef2f6'}` }}>
                                            <div className="text-muted d-flex align-items-center gap-2 mb-1" style={{ fontSize: '12px' }}>
                                                <i className="fa fa-hourglass-half text-secondary"></i> Expected Exit
                                            </div>
                                            <div className="fw-bold text-truncate" style={{ fontSize: '14px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                                {selectedDetailEntry.expected_time_of_exit || 'Not specified'}
                                            </div>
                                        </div>
                                    </Col>
                                </Row>
                            </div>

                            {/* Purpose of Visit & Narration */}
                            <div className="mb-4">
                                <Form.Label className="small fw-bold text-muted text-uppercase" style={{ letterSpacing: '0.5px' }}>
                                    Purpose of Visit
                                </Form.Label>
                                <div className="p-3 border rounded-3" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0', fontSize: '13.5px' }}>
                                    {selectedDetailEntry.purpose_of_visit || 'No specific purpose recorded.'}
                                </div>
                            </div>

                            {selectedDetailEntry.narration && (
                                <div className="mb-4">
                                    <Form.Label className="small fw-bold text-muted text-uppercase" style={{ letterSpacing: '0.5px' }}>
                                        Supervisor Narration / Remarks
                                    </Form.Label>
                                    <div className="p-3 border rounded-3" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0', fontSize: '13.5px' }}>
                                        {selectedDetailEntry.narration}
                                    </div>
                                </div>
                            )}

                            {/* Accompanied Vehicles Section */}
                            <h6 className="fw-bold text-uppercase small text-muted mb-3" style={{ letterSpacing: '0.5px' }}>
                                <i className="fa fa-car me-1.5 text-success"></i> Accompanied Vehicles ({selectedDetailEntry.vehicles?.length || 0})
                            </h6>
                            {selectedDetailEntry.vehicles && selectedDetailEntry.vehicles.length > 0 ? (
                                <div className="d-flex flex-column gap-2 mb-4">
                                    {selectedDetailEntry.vehicles.map((v, idx) => (
                                        <div key={v.id || idx} className="p-3 border rounded-3 d-flex align-items-center justify-content-between" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                                            <div className="d-flex align-items-center gap-3">
                                                {v.vehicle_photo ? (
                                                    <div 
                                                        className="rounded overflow-hidden shadow-sm cursor-pointer"
                                                        style={{ width: '54px', height: '38px', border: '1px solid #cbd5e1' }}
                                                        onClick={() => setPreviewPhotoUrl(getFullImageUrl(v.vehicle_photo))}
                                                        title="Click to view full photo"
                                                    >
                                                        <img 
                                                            src={getFullImageUrl(v.vehicle_photo)} 
                                                            alt={v.vehicle_number} 
                                                            className="w-100 h-100 object-fit-cover" 
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="rounded p-2 bg-light text-muted">
                                                        <i className="fa fa-car fs-5"></i>
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="fw-bold" style={{ fontSize: '14px', letterSpacing: '0.5px' }}>
                                                        {v.vehicle_number}
                                                    </div>
                                                    <div className="small text-muted">
                                                        Driver: <strong>{v.driver_name || 'Visitor / Self'}</strong>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="badge rounded-pill bg-light text-secondary border">
                                                Vehicle #{idx + 1}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted small mb-4 fst-italic">No accompanied vehicles registered for this entry.</p>
                            )}

                            {/* Reallocation History Timeline */}
                            <h6 className="fw-bold text-uppercase small text-muted mb-3" style={{ letterSpacing: '0.5px' }}>
                                <i className="fa fa-history me-1.5 text-info"></i> Reallocation & Movement History
                            </h6>
                            {selectedDetailEntry.reallocations && selectedDetailEntry.reallocations.length > 0 ? (
                                <div className="border rounded-3 p-3 mb-4" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                                    <div className="d-flex flex-column gap-3">
                                        {selectedDetailEntry.reallocations.map((r, rIdx) => (
                                            <div key={r.id || rIdx} className="d-flex align-items-start gap-3 pb-2 border-bottom last-border-none" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                                                <div 
                                                    className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 mt-1"
                                                    style={{ width: '30px', height: '30px', background: '#eff6ff', color: '#2563eb' }}
                                                >
                                                    <i className="fa fa-exchange-alt" style={{ fontSize: '11px' }}></i>
                                                </div>
                                                <div className="flex-fill">
                                                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                                        <span className="fw-bold" style={{ fontSize: '13px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                                            {r.from_employee_name} &rarr; <span className="text-success">{r.to_employee_name}</span>
                                                            {r.status === 'pending' ? (
                                                                <span className="badge bg-warning text-dark ms-2" style={{ fontSize: '10px' }}>
                                                                    <i className="fa fa-clock me-1"></i>Pending Approval
                                                                </span>
                                                            ) : r.status === 'rejected' ? (
                                                                <span className="badge bg-danger text-white ms-2" style={{ fontSize: '10px' }}>
                                                                    <i className="fa fa-times me-1"></i>Rejected
                                                                </span>
                                                            ) : r.status === 'cancelled' ? (
                                                                <span className="badge bg-secondary text-white ms-2" style={{ fontSize: '10px' }}>
                                                                    Cancelled
                                                                </span>
                                                            ) : (
                                                                <span className="badge bg-success text-white ms-2" style={{ fontSize: '10px' }}>
                                                                    <i className="fa fa-check me-1"></i>Approved
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="text-muted small" style={{ fontSize: '11px' }}>
                                                            {formatDateDMY(r.created_at)} {formatTimeHM(r.created_at)}
                                                        </span>
                                                    </div>
                                                    {r.reason && (
                                                        <div className="small text-muted mt-1 fst-italic">
                                                            "{r.reason}"
                                                        </div>
                                                    )}
                                                    {r.response_notes && (
                                                        <div className="small text-danger mt-1">
                                                            Response Note: "{r.response_notes}"
                                                        </div>
                                                    )}
                                                    <div className="small text-secondary mt-1" style={{ fontSize: '11px' }}>
                                                        Transferred by: {r.reallocated_by_name}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-muted small mb-4 fst-italic">No prior transfers. Visitor remains with initial host.</p>
                            )}

                            {/* Movement Completion Details */}
                            {selectedDetailEntry.movement_completed_at && (
                                <div 
                                    className="p-3 border rounded-3 mb-2" 
                                    style={{ 
                                        background: isDark ? 'rgba(10, 80, 15, 0.08)' : '#f0fdf4', 
                                        borderColor: isDark ? '#059669' : '#a7f3d0' 
                                    }}
                                >
                                    <div className="d-flex align-items-center gap-2 text-success fw-bold">
                                        <i className="fa fa-check-circle fs-5"></i>
                                        <span>Campus Movement Completed</span>
                                    </div>
                                    <div className="small text-muted mt-1">
                                        Completed on {formatDateDMY(selectedDetailEntry.movement_completed_at)} at {formatTimeHM(selectedDetailEntry.movement_completed_at)}
                                        {selectedDetailEntry.movement_completed_by_name && ` by ${selectedDetailEntry.movement_completed_by_name}`}.
                                    </div>
                                    {selectedDetailEntry.movement_notes && (
                                        <div className="small mt-2 p-2 bg-white rounded border">
                                            Departure Notes: <em>{selectedDetailEntry.movement_notes}</em>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer with buttons matching template */}
                        <div className="modal-footer-custom">
                            <button 
                                type="button" 
                                className="btn btn-close-custom" 
                                onClick={() => setShowDetailModal(false)}
                            >
                                Close
                            </button>
                            {!selectedDetailEntry.exit_time && (() => {
                                const isHost = isLastAllocatedEmployee(selectedDetailEntry) || currentUser?.is_superuser;
                                const isDone = selectedDetailEntry.verification_status === 'completed' || !!selectedDetailEntry.movement_completed_at;
                                const canReallocate = isHost && !isDone;
                                const canComplete = isHost && !isDone;

                                return (
                                    <div className="d-flex align-items-center" style={{ gap: '12px' }}>
                                        {canReallocate && (
                                            <button 
                                                type="button" 
                                                className="btn btn-partial-custom"
                                                onClick={() => {
                                                    setShowDetailModal(false);
                                                    handleOpenReallocate(selectedDetailEntry);
                                                }}
                                            >
                                                <i className="fa fa-exchange-alt me-2"></i> Reallocate
                                            </button>
                                        )}
                                        {canComplete && (
                                            <button 
                                                type="button" 
                                                className="btn btn-all-exit-custom"
                                                onClick={() => {
                                                    setShowDetailModal(false);
                                                    handleOpenComplete(selectedDetailEntry);
                                                }}
                                            >
                                                <i className="fa fa-check-circle me-2"></i> Complete Movement
                                            </button>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </Modal>

            {/* REALLOCATE MODAL (CheckoutModal Style) */}
            <Modal 
                show={showReallocateModal} 
                onHide={() => !isReallocating && setShowReallocateModal(false)} 
                dialogClassName={`item-custom-modal ${isDark ? 'dark-mode-modal' : ''}`}
                backdrop="static"
                keyboard={false}
                size="lg"
                centered
            >
                {reallocateEntry && (
                    <Form onSubmit={handleConfirmReallocation}>
                        <div className="modal-header-custom">
                            <div className="d-flex align-items-center" style={{ gap: '18px' }}>
                                <div 
                                    className="modal-icon-circle" 
                                    style={{ 
                                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                        boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)',
                                        width: '52px',
                                        height: '52px'
                                    }}
                                >
                                    <i className="fa fa-exchange-alt text-white fs-4"></i>
                                </div>
                                <div>
                                    <h4 className="modal-title font-w700 mb-1" style={{ fontSize: '20px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                        Reallocate Visitor & Vehicles
                                    </h4>
                                    <p className="modal-subtitle-custom mb-0 text-muted" style={{ fontSize: '13.5px' }}>
                                        Transfer visitor assignment to another department and employee
                                    </p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                className="modal-close-x" 
                                onClick={() => !isReallocating && setShowReallocateModal(false)}
                                title="Close"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="modal-body-custom">
                            {/* Visitor Context Card */}
                            <div 
                                className="p-3 mb-4 rounded-4" 
                                style={{ 
                                    background: isDark ? 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)', 
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)'
                                }}
                            >
                                <div className="d-flex justify-content-between align-items-start">
                                    <div>
                                        <span className="small text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>Allocated Visitor</span>
                                        <div className="fw-bold fs-6 mt-0.5" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>{reallocateEntry.visitor_name}</div>
                                        <div className="small text-muted mt-1">
                                            Current Host: <strong>{reallocateEntry.employee_name}</strong> &bull; {reallocateEntry.department_name}
                                        </div>
                                    </div>
                                    {reallocateEntry.tag_code || reallocateEntry.tag_number ? (() => {
                                        const tagStyle = getSoftTagBadgeStyle(reallocateEntry.tag_colour, isDark);
                                        return (
                                            <span 
                                                className="badge d-inline-flex align-items-center gap-1.5"
                                                style={{ 
                                                    backgroundColor: tagStyle.backgroundColor,
                                                    color: tagStyle.color,
                                                    border: `1.5px solid ${tagStyle.borderColor}`,
                                                    fontSize: '11.5px',
                                                    fontWeight: 600,
                                                    padding: '5px 12px',
                                                    borderRadius: '20px'
                                                }}
                                            >
                                                <i className="fa fa-id-badge" style={{ color: tagStyle.dotColor, fontSize: '11px' }}></i>
                                                <span>Tag #{reallocateEntry.tag_code || reallocateEntry.tag_number}</span>
                                            </span>
                                        );
                                    })() : null}
                                </div>
                                {reallocateEntry.vehicles && reallocateEntry.vehicles.length > 0 && (
                                    <div className="small text-success mt-2 pt-2 border-top" style={{ borderColor: isDark ? '#334155' : '#f1f5f9' }}>
                                        <i className="fa fa-car me-1.5"></i> Accompanied Vehicles ({reallocateEntry.vehicles.length}) will also transfer to the new host.
                                    </div>
                                )}
                            </div>

                            {/* Step 1: Receiving Department FIRST */}
                            <Form.Group className="mb-3">
                                <Form.Label className="form-label-custom small fw-semibold">
                                    Receiving Department <span className="text-danger">*</span>
                                </Form.Label>
                                <Select
                                    options={departmentOptions}
                                    value={targetDepartment}
                                    onChange={(sel) => {
                                        setTargetDepartment(sel);
                                        setTargetEmployee(null);
                                    }}
                                    styles={selectStyles}
                                    placeholder="Select receiving department first..."
                                    isClearable
                                    required
                                    menuPortalTarget={document.body}
                                />
                                {!targetDepartment && (
                                    <Form.Text className="text-muted small">
                                        <i className="fa fa-info-circle me-1 text-info"></i>
                                        Choose a department first to load and view its employees.
                                    </Form.Text>
                                )}
                            </Form.Group>

                            {/* Step 2: Employee SECOND */}
                            <Form.Group className="mb-3">
                                <div className="d-flex align-items-center justify-content-between mb-1">
                                    <Form.Label className="form-label-custom small fw-semibold mb-0">
                                        Transfer To Employee <span className="text-danger">*</span>
                                    </Form.Label>
                                    {targetDepartment && (
                                        <span className="badge bg-light text-secondary border" style={{ fontSize: '11px' }}>
                                            {reallocateEmployeeOptions.length} employee{reallocateEmployeeOptions.length !== 1 ? 's' : ''} in {targetDepartment.label}
                                        </span>
                                    )}
                                </div>
                                <Select
                                    options={reallocateEmployeeOptions}
                                    value={targetEmployee}
                                    onChange={(sel) => setTargetEmployee(sel)}
                                    styles={selectStyles}
                                    placeholder={
                                        !targetDepartment
                                            ? "Select department first to view employees..."
                                            : reallocateEmployeeOptions.length === 0
                                                ? `No active employees found in ${targetDepartment.label}`
                                                : `Choose employee from ${targetDepartment.label}...`
                                    }
                                    isDisabled={!targetDepartment || reallocateEmployeeOptions.length === 0}
                                    isClearable
                                    required
                                    menuPortalTarget={document.body}
                                />
                                {targetDepartment && reallocateEmployeeOptions.length === 0 && (
                                    <div className="alert alert-warning py-2 px-3 small mt-2 mb-0 d-flex align-items-center gap-2">
                                        <i className="fa fa-exclamation-triangle flex-shrink-0"></i>
                                        <span>No other active employees found in <strong>{targetDepartment.label}</strong>. Please choose a different department.</span>
                                    </div>
                                )}
                            </Form.Group>

                            {/* Step 3: Handover Reason / Instructions */}
                            <Form.Group className="mb-2">
                                <Form.Label className="form-label-custom small fw-semibold">
                                    Handover Reason / Instructions
                                </Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={3}
                                    className="form-control-custom"
                                    placeholder="e.g. Initial discussion concluded, transferred to team for quotation review..."
                                    value={reallocateReason}
                                    onChange={(e) => setReallocateReason(e.target.value)}
                                />
                            </Form.Group>
                        </div>

                        {/* Modal Footer with buttons matching template */}
                        <div className="modal-footer-custom">
                            <button 
                                type="button" 
                                className="btn btn-close-custom" 
                                disabled={isReallocating}
                                onClick={() => setShowReallocateModal(false)}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="btn btn-partial-custom" 
                                disabled={isReallocating || !targetDepartment || !targetEmployee}
                            >
                                {isReallocating ? (
                                    <>
                                        <Spinner size="sm" animation="border" className="me-2" />
                                        Transferring...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa fa-exchange-alt me-2"></i> Confirm Reallocation
                                    </>
                                )}
                            </button>
                        </div>
                    </Form>
                )}
            </Modal>

            {/* COMPLETE CAMPUS MOVEMENT MODAL (CheckoutModal Style) */}
            <Modal 
                show={showCompleteModal} 
                onHide={() => !isCompleting && setShowCompleteModal(false)} 
                dialogClassName={`item-custom-modal ${isDark ? 'dark-mode-modal' : ''}`}
                backdrop="static"
                keyboard={false}
                size="md"
                centered
            >
                {completeEntry && (
                    <div>
                        <div className="modal-header-custom">
                            <div className="d-flex align-items-center" style={{ gap: '18px' }}>
                                <div 
                                    className="modal-icon-circle" 
                                    style={{ 
                                        background: 'linear-gradient(135deg, #0a500f 0%, #20b876 100%)',
                                        boxShadow: '0 4px 14px rgba(10, 80, 15, 0.3)',
                                        width: '52px',
                                        height: '52px'
                                    }}
                                >
                                    <i className="fa fa-check-circle text-white fs-4"></i>
                                </div>
                                <div>
                                    <h4 className="modal-title font-w700 mb-1" style={{ fontSize: '20px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                        Complete Campus Movement
                                    </h4>
                                    <p className="modal-subtitle-custom mb-0 text-muted" style={{ fontSize: '13.5px' }}>
                                        Conclude visit and release visitor for security gate exit
                                    </p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                className="modal-close-x" 
                                onClick={() => !isCompleting && setShowCompleteModal(false)}
                                title="Close"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="modal-body-custom">
                            <div 
                                className="p-3 mb-3 rounded-4" 
                                style={{ 
                                    background: isDark ? 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)', 
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)'
                                }}
                            >
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <span className="small text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>Visitor</span>
                                        <div className="fw-bold fs-6 mt-0.5" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                                            {completeEntry.visitor_name}
                                        </div>
                                        <div className="small text-muted mt-1">
                                            <i className="fa fa-phone-alt me-1 text-success"></i>{completeEntry.visitor_mobile || 'N/A'}
                                            {completeEntry.company_name && ` • ${completeEntry.company_name}`}
                                        </div>
                                    </div>
                                    {completeEntry.tag_code || completeEntry.tag_number ? (() => {
                                        const tagStyle = getSoftTagBadgeStyle(completeEntry.tag_colour, isDark);
                                        return (
                                            <span 
                                                className="badge d-inline-flex align-items-center gap-1.5"
                                                style={{ 
                                                    backgroundColor: tagStyle.backgroundColor,
                                                    color: tagStyle.color,
                                                    border: `1.5px solid ${tagStyle.borderColor}`,
                                                    fontSize: '11.5px',
                                                    fontWeight: 600,
                                                    padding: '5px 12px',
                                                    borderRadius: '20px'
                                                }}
                                            >
                                                <i className="fa fa-id-badge" style={{ color: tagStyle.dotColor, fontSize: '11px' }}></i>
                                                <span>Tag #{completeEntry.tag_code || completeEntry.tag_number}</span>
                                            </span>
                                        );
                                    })() : null}
                                </div>

                                <div className="row g-2 pt-2 border-top" style={{ borderColor: isDark ? '#334155' : '#f1f5f9' }}>
                                    <div className="col-6 small">
                                        <span className="text-muted d-block">Host Employee</span>
                                        <strong>{completeEntry.employee_name || 'N/A'}</strong>
                                    </div>
                                    <div className="col-6 small">
                                        <span className="text-muted d-block">Department</span>
                                        <strong>{completeEntry.department_name || 'N/A'}</strong>
                                    </div>
                                </div>
                            </div>

                            <div 
                                className="p-3 mb-3 rounded-4" 
                                style={{ 
                                    background: isDark ? 'rgba(10, 80, 15, 0.08)' : '#f0fdf4',
                                    border: `1.5px solid ${isDark ? '#059669' : '#a7f3d0'}`
                                }}
                            >
                                <div className="d-flex align-items-center gap-3">
                                    <div 
                                        style={{ 
                                            width: '44px', 
                                            height: '44px', 
                                            borderRadius: '12px', 
                                            background: '#d1fae5', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}
                                    >
                                        <i className="fa fa-info-circle text-success fs-5"></i>
                                    </div>
                                    <div className="small text-muted" style={{ fontSize: '13px', lineHeight: 1.5 }}>
                                        Are you sure you want to conclude movement for <strong>{completeEntry.visitor_name}</strong>? 
                                        This marks your meeting as complete and releases the visitor to proceed to the main gate for checkout.
                                    </div>
                                </div>
                            </div>

                            <Form.Group className="mb-1">
                                <Form.Label className="form-label-custom">
                                    Departure Remarks / Handover Notes <span className="text-muted fw-normal">(Optional)</span>
                                </Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={3}
                                    className="form-control-custom"
                                    placeholder="e.g. Meeting finished, visitor pass returned, escorted to main gate..."
                                    value={completeNotes}
                                    onChange={(e) => setCompleteNotes(e.target.value)}
                                />
                            </Form.Group>
                        </div>

                        {/* Modal Footer with buttons matching template */}
                        <div className="modal-footer-custom">
                            <button 
                                type="button" 
                                className="btn btn-close-custom" 
                                disabled={isCompleting}
                                onClick={() => setShowCompleteModal(false)}
                            >
                                Cancel
                            </button>
                            <button 
                                type="button" 
                                className="btn btn-all-exit-custom" 
                                disabled={isCompleting}
                                onClick={handleConfirmComplete}
                            >
                                {isCompleting ? (
                                    <>
                                        <Spinner size="sm" animation="border" className="me-2" />
                                        Completing...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa fa-check-circle me-2"></i> Complete Movement
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* DECLINE REALLOCATION MODAL (System Default Style) */}
            <Modal 
                show={showDeclineModal} 
                onHide={() => !isDeclining && setShowDeclineModal(false)} 
                dialogClassName={`item-custom-modal ${isDark ? 'dark-mode-modal' : ''}`}
                backdrop="static"
                keyboard={false}
                size="md"
                centered
            >
                {declineEntry && (
                    <Form onSubmit={handleConfirmDecline}>
                        <div className="modal-header-custom">
                            <div className="d-flex align-items-center" style={{ gap: '18px' }}>
                                <div 
                                    className="modal-icon-circle" 
                                    style={{ 
                                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                        boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)',
                                        width: '52px',
                                        height: '52px'
                                    }}
                                >
                                    <i className="fa fa-times-circle text-white fs-4"></i>
                                </div>
                                <div>
                                    <h4 className="modal-title font-w700 mb-1" style={{ fontSize: '20px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                        Decline Reallocation
                                    </h4>
                                    <p className="modal-subtitle-custom mb-0 text-muted" style={{ fontSize: '13.5px' }}>
                                        Return visitor responsibility to the current host
                                    </p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                className="modal-close-x" 
                                onClick={() => !isDeclining && setShowDeclineModal(false)}
                                title="Close"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="modal-body-custom">
                            {/* Visitor Context Card */}
                            <div 
                                className="p-3 mb-3 rounded-4" 
                                style={{ 
                                    background: isDark ? 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)', 
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)'
                                }}
                            >
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <span className="small text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>Visitor</span>
                                        <div className="fw-bold fs-6 mt-0.5" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                                            {declineEntry.visitor_name}
                                        </div>
                                        <div className="small text-muted mt-1">
                                            {declineEntry.visitor_mobile && <span><i className="fa fa-phone-alt me-1 text-success"></i>{declineEntry.visitor_mobile} &bull; </span>}
                                            {declineEntry.company_name || declineEntry.visitor_company || 'Visitor'}
                                        </div>
                                    </div>
                                    {declineEntry.tag_code || declineEntry.tag_number ? (() => {
                                        const tagStyle = getSoftTagBadgeStyle(declineEntry.tag_colour, isDark);
                                        return (
                                            <span 
                                                className="badge d-inline-flex align-items-center gap-1.5"
                                                style={{ 
                                                    backgroundColor: tagStyle.backgroundColor,
                                                    color: tagStyle.color,
                                                    border: `1.5px solid ${tagStyle.borderColor}`,
                                                    fontSize: '11.5px',
                                                    fontWeight: 600,
                                                    padding: '5px 12px',
                                                    borderRadius: '20px'
                                                }}
                                            >
                                                <i className="fa fa-id-badge" style={{ color: tagStyle.dotColor, fontSize: '11px' }}></i>
                                                <span>Tag #{declineEntry.tag_code || declineEntry.tag_number}</span>
                                            </span>
                                        );
                                    })() : null}
                                </div>
                                <div className="small text-muted pt-2 border-top" style={{ borderColor: isDark ? '#334155' : '#f1f5f9' }}>
                                    Current Host: <strong>{declineEntry.pending_reallocation?.from_employee_name || declineEntry.employee_name}</strong> &bull; {declineEntry.pending_reallocation?.from_department_name || declineEntry.department_name}
                                </div>
                            </div>

                            <div className="alert alert-warning py-2.5 px-3 small rounded-3 d-flex align-items-center gap-2.5 mb-3" style={{ fontSize: '12.5px' }}>
                                <i className="fa fa-info-circle fs-5 flex-shrink-0 text-warning"></i>
                                <div>
                                    If declined, this visitor will strictly remain under current host <strong>{declineEntry.pending_reallocation?.from_employee_name || declineEntry.employee_name}</strong>'s responsibility.
                                </div>
                            </div>

                            <Form.Group className="mb-1">
                                <Form.Label className="form-label-custom small fw-semibold">
                                    Reason for Declining (Optional)
                                </Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={3}
                                    className="form-control-custom"
                                    placeholder="e.g. In an urgent meeting / Out of office / Transferred by mistake..."
                                    value={declineReason}
                                    onChange={(e) => setDeclineReason(e.target.value)}
                                    autoFocus
                                />
                            </Form.Group>
                        </div>

                        <div className="modal-footer-custom">
                            <button 
                                type="button" 
                                className="btn btn-close-custom" 
                                disabled={isDeclining}
                                onClick={() => setShowDeclineModal(false)}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="btn btn-danger-custom" 
                                disabled={isDeclining}
                            >
                                {isDeclining ? (
                                    <>
                                        <Spinner size="sm" animation="border" className="me-2" />
                                        Declining...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa fa-times me-2"></i> Decline Transfer
                                    </>
                                )}
                            </button>
                        </div>
                    </Form>
                )}
            </Modal>

            {/* ACCEPT REALLOCATION MODAL (System Default Style) */}
            <Modal 
                show={showAcceptModal} 
                onHide={() => !isAccepting && setShowAcceptModal(false)} 
                dialogClassName={`item-custom-modal ${isDark ? 'dark-mode-modal' : ''}`}
                backdrop="static"
                keyboard={false}
                size="md"
                centered
            >
                {acceptEntry && (
                    <div>
                        <div className="modal-header-custom">
                            <div className="d-flex align-items-center" style={{ gap: '18px' }}>
                                <div 
                                    className="modal-icon-circle" 
                                    style={{ 
                                        background: 'linear-gradient(135deg, #0a500f 0%, #20b876 100%)',
                                        boxShadow: '0 4px 14px rgba(10, 80, 15, 0.3)',
                                        width: '52px',
                                        height: '52px'
                                    }}
                                >
                                    <i className="fa fa-user-check text-white fs-4"></i>
                                </div>
                                <div>
                                    <h4 className="modal-title font-w700 mb-1" style={{ fontSize: '20px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                        Accept Visitor Reallocation
                                    </h4>
                                    <p className="modal-subtitle-custom mb-0 text-muted" style={{ fontSize: '13.5px' }}>
                                        Take over hosting and campus movement responsibility
                                    </p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                className="modal-close-x" 
                                onClick={() => !isAccepting && setShowAcceptModal(false)}
                                title="Close"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="modal-body-custom">
                            {/* Visitor Context Card */}
                            <div 
                                className="p-3 mb-3 rounded-4" 
                                style={{ 
                                    background: isDark ? 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)', 
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)'
                                }}
                            >
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <span className="small text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>Visitor</span>
                                        <div className="fw-bold fs-6 mt-0.5" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                                            {acceptEntry.visitor_name}
                                        </div>
                                        <div className="small text-muted mt-1">
                                            {acceptEntry.visitor_mobile && <span><i className="fa fa-phone-alt me-1 text-success"></i>{acceptEntry.visitor_mobile} &bull; </span>}
                                            {acceptEntry.company_name || acceptEntry.visitor_company || 'Visitor'}
                                        </div>
                                    </div>
                                    {acceptEntry.tag_code || acceptEntry.tag_number ? (() => {
                                        const tagStyle = getSoftTagBadgeStyle(acceptEntry.tag_colour, isDark);
                                        return (
                                            <span 
                                                className="badge d-inline-flex align-items-center gap-1.5"
                                                style={{ 
                                                    backgroundColor: tagStyle.backgroundColor,
                                                    color: tagStyle.color,
                                                    border: `1.5px solid ${tagStyle.borderColor}`,
                                                    fontSize: '11.5px',
                                                    fontWeight: 600,
                                                    padding: '5px 12px',
                                                    borderRadius: '20px'
                                                }}
                                            >
                                                <i className="fa fa-id-badge" style={{ color: tagStyle.dotColor, fontSize: '11px' }}></i>
                                                <span>Tag #{acceptEntry.tag_code || acceptEntry.tag_number}</span>
                                            </span>
                                        );
                                    })() : null}
                                </div>
                                <div className="small text-muted pt-2 border-top" style={{ borderColor: isDark ? '#334155' : '#f1f5f9' }}>
                                    Transferred From: <strong>{acceptEntry.pending_reallocation?.from_employee_name || acceptEntry.employee_name}</strong> &bull; {acceptEntry.pending_reallocation?.from_department_name || acceptEntry.department_name}
                                </div>
                                {acceptEntry.pending_reallocation?.reason && (
                                    <div className="small text-info mt-1 pt-1 border-top fst-italic" style={{ borderColor: isDark ? '#334155' : '#f1f5f9' }}>
                                        Transfer Reason: "{acceptEntry.pending_reallocation.reason}"
                                    </div>
                                )}
                            </div>

                            <div className="alert alert-success py-2.5 px-3 small rounded-3 d-flex align-items-center gap-2.5 mb-1" style={{ fontSize: '12.5px' }}>
                                <i className="fa fa-check-circle fs-5 flex-shrink-0 text-success"></i>
                                <div>
                                    By accepting, you become the primary host official responsible for this visitor. Only you will be authorized to sign off and complete their campus movement.
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer-custom">
                            <button 
                                type="button" 
                                className="btn btn-close-custom" 
                                disabled={isAccepting}
                                onClick={() => setShowAcceptModal(false)}
                            >
                                Cancel
                            </button>
                            <button 
                                type="button" 
                                className="btn btn-all-exit-custom" 
                                disabled={isAccepting}
                                onClick={handleConfirmAccept}
                            >
                                {isAccepting ? (
                                    <>
                                        <Spinner size="sm" animation="border" className="me-2" />
                                        Accepting...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa fa-check me-2"></i> Accept & Take Over
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* CANCEL REALLOCATION REQUEST MODAL (System Default Style) */}
            <Modal 
                show={showCancelModal} 
                onHide={() => !isCancelling && setShowCancelModal(false)} 
                dialogClassName={`item-custom-modal ${isDark ? 'dark-mode-modal' : ''}`}
                backdrop="static"
                keyboard={false}
                size="md"
                centered
            >
                {cancelEntry && (
                    <div>
                        <div className="modal-header-custom">
                            <div className="d-flex align-items-center" style={{ gap: '18px' }}>
                                <div 
                                    className="modal-icon-circle" 
                                    style={{ 
                                        background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                                        boxShadow: '0 4px 14px rgba(100, 116, 139, 0.3)',
                                        width: '52px',
                                        height: '52px'
                                    }}
                                >
                                    <i className="fa fa-ban text-white fs-4"></i>
                                </div>
                                <div>
                                    <h4 className="modal-title font-w700 mb-1" style={{ fontSize: '20px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                        Cancel Reallocation Request
                                    </h4>
                                    <p className="modal-subtitle-custom mb-0 text-muted" style={{ fontSize: '13.5px' }}>
                                        Withdraw your pending transfer request
                                    </p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                className="modal-close-x" 
                                onClick={() => !isCancelling && setShowCancelModal(false)}
                                title="Close"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="modal-body-custom">
                            {/* Visitor Context Card */}
                            <div 
                                className="p-3 mb-3 rounded-4" 
                                style={{ 
                                    background: isDark ? 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)', 
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)'
                                }}
                            >
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <span className="small text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>Visitor</span>
                                        <div className="fw-bold fs-6 mt-0.5" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                                            {cancelEntry.visitor_name}
                                        </div>
                                        <div className="small text-muted mt-1">
                                            {cancelEntry.company_name || cancelEntry.visitor_company || 'Visitor'}
                                        </div>
                                    </div>
                                </div>
                                <div className="small text-muted pt-2 border-top" style={{ borderColor: isDark ? '#334155' : '#f1f5f9' }}>
                                    Requested Transfer To: <strong>{cancelEntry.pending_reallocation?.to_employee_name}</strong> &bull; {cancelEntry.pending_reallocation?.to_department_name}
                                </div>
                            </div>

                            <div className="alert alert-secondary py-2.5 px-3 small rounded-3 d-flex align-items-center gap-2.5 mb-1" style={{ fontSize: '12.5px' }}>
                                <i className="fa fa-info-circle fs-5 flex-shrink-0 text-secondary"></i>
                                <div>
                                    Withdrawing this request keeps the visitor under your active responsibility. The pending notification sent to {cancelEntry.pending_reallocation?.to_employee_name} will be removed.
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer-custom">
                            <button 
                                type="button" 
                                className="btn btn-close-custom" 
                                disabled={isCancelling}
                                onClick={() => setShowCancelModal(false)}
                            >
                                Keep Request
                            </button>
                            <button 
                                type="button" 
                                className="btn btn-danger-custom" 
                                disabled={isCancelling}
                                onClick={handleConfirmCancel}
                            >
                                {isCancelling ? (
                                    <>
                                        <Spinner size="sm" animation="border" className="me-2" />
                                        Cancelling...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa fa-ban me-2"></i> Withdraw Request
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* LIGHTBOX PHOTO PREVIEW MODAL */}
            <Modal 
                show={!!previewPhotoUrl} 
                onHide={() => setPreviewPhotoUrl(null)} 
                centered 
                size="md"
            >
                <Modal.Body className="p-1 text-center bg-dark rounded-3 overflow-hidden">
                    {previewPhotoUrl && (
                        <div className="position-relative">
                            <img 
                                src={previewPhotoUrl} 
                                alt="Preview" 
                                className="w-100 rounded-2" 
                                style={{ maxHeight: '80vh', objectFit: 'contain' }} 
                            />
                            <button
                                type="button"
                                className="btn btn-sm btn-dark position-absolute top-0 end-0 m-2 rounded-circle"
                                onClick={() => setPreviewPhotoUrl(null)}
                                style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                &times;
                            </button>
                        </div>
                    )}
                </Modal.Body>
            </Modal>

            <style dangerouslySetInnerHTML={{
                __html: `
                .visitor-reallocation-wrapper {
                    font-family: inherit;
                }
                .nav-pills-custom .nav-link {
                    color: #64748b;
                    transition: all 0.2s ease;
                }
                .nav-pills-custom .nav-link.active {
                    background-color: #0a500f !important;
                    color: #ffffff !important;
                    box-shadow: 0 2px 4px rgba(10, 80, 15, 0.25);
                }
                .last-border-none:last-child {
                    border-bottom: none !important;
                    padding-bottom: 0 !important;
                }

                /* ── Theme Modal Styles (item-custom-modal) matching CheckoutModal ── */
                .item-custom-modal .modal-content {
                    border-radius: 20px !important;
                    border: none !important;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.16) !important;
                    overflow: hidden !important;
                }
                .item-custom-modal .modal-header-custom {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    padding: 24px 32px 18px 32px !important;
                    border-bottom: 1px solid #f1f5f9 !important;
                    background-color: #ffffff !important;
                    width: 100% !important;
                }
                .item-custom-modal .modal-icon-circle {
                    width: 52px !important;
                    height: 52px !important;
                    border-radius: 50% !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    flex-shrink: 0 !important;
                }
                .item-custom-modal .modal-close-x {
                    border: none !important;
                    background: #f1f5f9 !important;
                    width: 36px !important;
                    height: 36px !important;
                    border-radius: 10px !important;
                    font-size: 24px !important;
                    color: #64748b !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    line-height: 1 !important;
                    padding: 0 !important;
                }
                .item-custom-modal .modal-close-x:hover {
                    background: #fee2e2 !important;
                    color: #ef4444 !important;
                }
                .item-custom-modal .modal-body-custom {
                    padding: 26px 32px !important;
                    background-color: #ffffff !important;
                }
                .item-custom-modal .form-label-custom {
                    font-size: 13.5px !important;
                    font-weight: 500 !important;
                    color: #4a5568 !important;
                    margin-bottom: 8px !important;
                }
                .item-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1 !important;
                    border-radius: 10px !important;
                    padding: 10px 16px !important;
                    font-size: 14px !important;
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
                    padding: 20px 32px 24px 32px !important;
                    border-top: 1px solid #f1f5f9 !important;
                    background-color: #fafbfc !important;
                    gap: 14px !important;
                }

                /* ── Theme Buttons matching CheckoutModal ── */
                .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    border: none !important;
                    color: #ffffff !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    min-height: 44px !important;
                    border-radius: 10px !important;
                    transition: all 0.2s ease !important;
                    cursor: pointer !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .btn-close-custom:disabled {
                    opacity: 0.65 !important;
                    cursor: not-allowed !important;
                }

                .btn-partial-custom {
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
                    border: none !important;
                    color: #ffffff !important;
                    font-weight: 600 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    min-height: 44px !important;
                    border-radius: 10px !important;
                    transition: all 0.2s ease !important;
                    cursor: pointer !important;
                    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25) !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                .btn-partial-custom:hover:not(:disabled) {
                    background: linear-gradient(135deg, #d97706 0%, #b45309 100%) !important;
                    color: #ffffff !important;
                    box-shadow: 0 6px 16px rgba(245, 158, 11, 0.35) !important;
                    transform: translateY(-1px) !important;
                }
                .btn-partial-custom:disabled {
                    opacity: 0.65 !important;
                    cursor: not-allowed !important;
                }

                .btn-all-exit-custom {
                    background: linear-gradient(135deg, #0a500f 0%, #20b876 100%) !important;
                    border: none !important;
                    color: #ffffff !important;
                    font-weight: 600 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    min-height: 44px !important;
                    border-radius: 10px !important;
                    transition: all 0.2s ease !important;
                    cursor: pointer !important;
                    box-shadow: 0 4px 12px rgba(10, 80, 15, 0.3) !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                .btn-all-exit-custom:hover:not(:disabled) {
                    background: linear-gradient(135deg, #20b876 0%, #179b61 100%) !important;
                    color: #ffffff !important;
                    box-shadow: 0 6px 16px rgba(10, 80, 15, 0.4) !important;
                    transform: translateY(-1px) !important;
                }
                .btn-all-exit-custom:disabled {
                    opacity: 0.65 !important;
                    cursor: not-allowed !important;
                }

                .btn-danger-custom {
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
                    border: none !important;
                    color: #ffffff !important;
                    font-weight: 600 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    min-height: 44px !important;
                    border-radius: 10px !important;
                    transition: all 0.2s ease !important;
                    cursor: pointer !important;
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25) !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                .btn-danger-custom:hover:not(:disabled) {
                    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%) !important;
                    color: #ffffff !important;
                    box-shadow: 0 6px 16px rgba(239, 68, 68, 0.35) !important;
                    transform: translateY(-1px) !important;
                }
                .btn-danger-custom:disabled {
                    opacity: 0.65 !important;
                    cursor: not-allowed !important;
                }

                .btn-back-custom {
                    background-color: #f1f5f9 !important;
                    border: 1px solid #cbd5e1 !important;
                    color: #475569 !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 20px !important;
                    min-height: 44px !important;
                    border-radius: 10px !important;
                    transition: all 0.2s ease !important;
                    cursor: pointer !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                .btn-back-custom:hover:not(:disabled) {
                    background-color: #e2e8f0 !important;
                    color: #1e293b !important;
                }

                /* Dark mode support */
                .dark-mode-modal .modal-content {
                    background-color: #1e293b !important;
                    color: #f8fafc !important;
                }
                .dark-mode-modal .modal-header-custom {
                    background-color: #1e293b !important;
                    border-bottom-color: #334155 !important;
                }
                .dark-mode-modal .modal-body-custom {
                    background-color: #1e293b !important;
                    color: #f8fafc !important;
                }
                .dark-mode-modal .modal-footer-custom {
                    background-color: #0f172a !important;
                    border-top-color: #334155 !important;
                }
                .dark-mode-modal .form-control-custom {
                    background-color: #0f172a !important;
                    border-color: #334155 !important;
                    color: #f8fafc !important;
                }
                .dark-mode-modal .modal-close-x {
                    background-color: #334155 !important;
                    color: #cbd5e1 !important;
                }
                .dark-mode-modal .modal-close-x:hover {
                    background-color: #ef4444 !important;
                    color: #ffffff !important;
                }
                `
            }} />
        </div>
    );
};

export default VisitorReallocation;
