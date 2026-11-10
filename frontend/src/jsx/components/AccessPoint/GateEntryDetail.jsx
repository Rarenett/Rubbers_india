import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Row, Col, Card, Badge, Spinner, Image, Button, Modal, Form, Tooltip, OverlayTrigger } from 'react-bootstrap';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
    getGateEntry, 
    getVehicleEntry, 
    completeVisitorMovement, 
    reallocateVisitor,
    respondReallocation,
    cancelReallocation
} from '../../../services/GateManagementService';
import { getUsers, getDepartments } from '../../../services/HRManagementService';
import swal from "sweetalert2";
import { usePermission } from '../../../hooks/usePermission';
import CheckoutModal from './CheckoutModal';

const GateEntryDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const entryTypeParam = searchParams.get('type'); // 'visitor' | 'vehicle'
    const { can } = usePermission();
    const currentUser = useSelector((state) => state.auth?.auth?.user || state.auth?.user || null);

    const [loading, setLoading] = useState(true);
    const [entry, setEntry] = useState(null);
    const [previewPhoto, setPreviewPhoto] = useState(null);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);

    // Host Completion Modal State
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [completeNotes, setCompleteNotes] = useState('');
    const [completeSubmitting, setCompleteSubmitting] = useState(false);

    // Host Reallocation Modal State
    const [showReallocModal, setShowReallocModal] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [reallocDepartment, setReallocDepartment] = useState('');
    const [reallocEmployee, setReallocEmployee] = useState('');
    const [reallocReason, setReallocReason] = useState('');
    const [reallocSubmitting, setReallocSubmitting] = useState(false);

    // Copy to clipboard helpers
    const [copiedPhone, setCopiedPhone] = useState(false);
    const [copiedPass, setCopiedPass] = useState(false);
    const [copiedContactPhone, setCopiedContactPhone] = useState(false);

    const getFullImageUrl = (path) => {
        if (!path) return null;
        if (typeof path === 'object' && path.url) path = path.url;
        if (typeof path !== 'string') return null;
        if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:') || path.startsWith('data:')) {
            return path;
        }
        const baseUrl = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${baseUrl}${cleanPath}`;
    };

    useEffect(() => {
        fetchEntryDetails();
        fetchMasterData();
    }, [id, entryTypeParam]);

    const fetchMasterData = async () => {
        try {
            const [usersData, deptsData] = await Promise.all([
                getUsers(),
                getDepartments()
            ]);
            setEmployees(Array.isArray(usersData) ? usersData : (usersData?.results || []));
            setDepartments(Array.isArray(deptsData) ? deptsData : (deptsData?.results || []));
        } catch (err) {
            console.error("Error loading master data in GateEntryDetail", err);
        }
    };

    const fetchEntryDetails = async () => {
        try {
            setLoading(true);
            let data = null;
            if (entryTypeParam === 'vehicle') {
                data = await getVehicleEntry(id);
            } else if (entryTypeParam === 'visitor') {
                data = await getGateEntry(id);
            } else {
                // Auto fallback: try getGateEntry first, if 404 or missing, fallback to getVehicleEntry
                try {
                    data = await getGateEntry(id);
                } catch (err) {
                    if (err.response?.status === 404 || err.response?.status === 400) {
                        data = await getVehicleEntry(id);
                    } else {
                        throw err;
                    }
                }
            }
            setEntry(data);
        } catch (error) {
            console.error("Error fetching gate entry details", error);
            // If explicit type failed or error occurred, attempt alternative as fallback
            try {
                const fallbackData = entryTypeParam === 'vehicle' 
                    ? await getGateEntry(id) 
                    : await getVehicleEntry(id);
                setEntry(fallbackData);
                return;
            } catch (fallbackErr) {
                // Ignore fallback error
            }
            setEntry(null);
        } finally {
            setLoading(false);
        }
    };

    const handleBackToList = () => {
        const isVehicle = entry?.entry_type === 'vehicle' || entryTypeParam === 'vehicle' || (entry && !entry.visitor);
        const targetTab = isVehicle ? 'vehicles' : (entryTypeParam === 'visitor' ? 'visitors' : (sessionStorage.getItem('gate_entry_list_tab') || 'visitors'));
        sessionStorage.setItem('gate_entry_list_tab', targetTab);
        navigate(`/access-point/gate-entries?tab=${targetTab}`);
    };

    const handleExit = () => {
        setShowCheckoutModal(true);
    };

    const handleCopyText = (text, type) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        if (type === 'phone') {
            setCopiedPhone(true);
            setTimeout(() => setCopiedPhone(false), 2000);
        } else if (type === 'pass') {
            setCopiedPass(true);
            setTimeout(() => setCopiedPass(false), 2000);
        } else if (type === 'contact_phone') {
            setCopiedContactPhone(true);
            setTimeout(() => setCopiedContactPhone(false), 2000);
        }
    };

    // Helper: Exact Date & Time formatting (DD Mon YYYY, hh:mm:ss A)
    const formatExactDateTime = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }) + ', ' + d.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };

    // Helper: Calculate duration
    const calculateDuration = (startStr, endStr) => {
        if (!startStr) return null;
        const start = new Date(startStr);
        const end = endStr ? new Date(endStr) : new Date();
        const diffMs = Math.max(0, end - start);
        const totalMinutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours === 0) return `${minutes} min${minutes !== 1 ? 's' : ''}`;
        return `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
    };

    // Soft tag badge style generator (light theme)
    const getSoftTagBadgeStyle = (tagColour) => {
        if (!tagColour) {
            return { backgroundColor: '#e8fdf4', color: '#047857', borderColor: '#a7f3d0', dotColor: '#0a500f' };
        }
        if (tagColour.startsWith('#') && (tagColour.length === 7 || tagColour.length === 9)) {
            const r = parseInt(tagColour.slice(1, 3), 16) || 0;
            const g = parseInt(tagColour.slice(3, 5), 16) || 0;
            const b = parseInt(tagColour.slice(5, 7), 16) || 0;
            return {
                backgroundColor: `rgba(${r}, ${g}, ${b}, 0.08)`,
                color: `rgb(${Math.round(r * 0.65)}, ${Math.round(g * 0.65)}, ${Math.round(b * 0.65)})`,
                borderColor: `rgba(${r}, ${g}, ${b}, 0.22)`,
                dotColor: tagColour
            };
        }
        return { backgroundColor: '#eef2ff', color: '#4338ca', borderColor: '#c7d2fe', dotColor: tagColour };
    };

    // Filter employees by selected department in Reallocate Modal
    const filteredEmployeesForRealloc = useMemo(() => {
        if (!reallocDepartment) return employees;
        return employees.filter(emp => {
            if (emp.department_id) return String(emp.department_id) === String(reallocDepartment);
            if (emp.department && typeof emp.department === 'object') return String(emp.department.id) === String(reallocDepartment);
            return false;
        });
    }, [employees, reallocDepartment]);

    // Handle Complete Movement submission
    const handleConfirmCompleteMovement = async () => {
        if (!entry) return;
        try {
            setCompleteSubmitting(true);
            const entryType = isVehicleMode ? 'vehicle' : 'visitor';
            await completeVisitorMovement(entry.id, { notes: completeNotes.trim() }, entryType);
            swal.fire({
                title: "Movement Completed",
                text: "Host verification confirmed. The visitor is now cleared for campus checkout at the gate.",
                icon: "success",
                confirmButtonColor: "#0a500f"
            });
            setShowCompleteModal(false);
            setCompleteNotes('');
            fetchEntryDetails();
        } catch (err) {
            console.error("Error completing movement", err);
            const errMsg = err.response?.data?.detail || err.response?.data?.message || "Failed to complete movement.";
            swal.fire("Action Restricted", errMsg, "error");
        } finally {
            setCompleteSubmitting(false);
        }
    };

    // Handle Reallocate Host submission
    const handleConfirmReallocation = async (e) => {
        e?.preventDefault();
        if (!reallocEmployee) {
            swal.fire("Required", "Please choose a host employee to transfer to.", "warning");
            return;
        }
        if (!reallocReason.trim()) {
            swal.fire("Required", "Please state a brief reason for host reallocation.", "warning");
            return;
        }
        try {
            setReallocSubmitting(true);
            const payload = {
                to_employee: reallocEmployee,
                to_department: reallocDepartment || null,
                reason: reallocReason.trim()
            };
            const entryType = isVehicleMode ? 'vehicle' : 'visitor';
            await reallocateVisitor(entry.id, payload, entryType);
            swal.fire({
                title: "Reallocation Request Sent",
                text: "Transfer request sent to the new host. Responsibility transfers once approved. If declined, the visitor remains your responsibility.",
                icon: "success",
                confirmButtonColor: "#0a500f"
            });
            setShowReallocModal(false);
            setReallocReason('');
            setReallocEmployee('');
            setReallocDepartment('');
            fetchEntryDetails();
        } catch (err) {
            console.error("Error reallocating host", err);
            const errMsg = err.response?.data?.detail || err.response?.data?.message || "Failed to reallocate host.";
            swal.fire("Transfer Failed", errMsg, "error");
        } finally {
            setReallocSubmitting(false);
        }
    };

    // Handle Quick Approve / Reject for Incoming Reallocation in Dossier
    const handleRespondReallocation = async (reallocId, action) => {
        let notes = '';
        if (action === 'reject') {
            const { value: text, isConfirmed } = await swal.fire({
                title: 'Decline Reallocation?',
                text: 'If declined, this visitor will remain the responsibility of the current host.',
                input: 'textarea',
                inputLabel: 'Reason for declining (optional)',
                inputPlaceholder: 'e.g. In a meeting / Wrong department / Out of office',
                showCancelButton: true,
                confirmButtonText: 'Decline Transfer',
                confirmButtonColor: '#dc2626',
                cancelButtonText: 'Cancel'
            });
            if (!isConfirmed) return;
            notes = text || '';
        } else {
            const confirm = await swal.fire({
                title: 'Accept Visitor Reallocation?',
                text: `You will take over responsibility for this visitor as the active host.`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Accept & Take Over',
                confirmButtonColor: '#0a500f',
                cancelButtonText: 'Cancel'
            });
            if (!confirm.isConfirmed) return;
        }

        try {
            await respondReallocation(reallocId, action, notes);
            swal.fire({
                icon: 'success',
                title: action === 'approve' ? 'Reallocation Accepted' : 'Reallocation Declined',
                text: action === 'approve' 
                    ? 'You are now the active host for this visitor.' 
                    : 'The visitor remains the responsibility of the current host employee.',
                timer: 2500,
                showConfirmButton: false
            });
            fetchEntryDetails();
        } catch (err) {
            console.error("Failed to respond to reallocation", err);
            const msg = err.response?.data?.detail || 'Action failed.';
            swal.fire('Error', msg, 'error');
        }
    };

    // Handle Cancel Reallocation Request by Current Host
    const handleCancelReallocation = async (reallocId) => {
        const confirm = await swal.fire({
            title: 'Cancel Reallocation Request?',
            text: 'The pending transfer request will be cancelled. The visitor remains your responsibility.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, Cancel Request',
            confirmButtonColor: '#dc2626',
            cancelButtonText: 'No, Keep Request'
        });
        if (!confirm.isConfirmed) return;

        try {
            await cancelReallocation(reallocId);
            swal.fire({
                icon: 'success',
                title: 'Request Cancelled',
                text: 'The reallocation request was cancelled. You remain the responsible host.',
                timer: 2000,
                showConfirmButton: false
            });
            fetchEntryDetails();
        } catch (err) {
            console.error("Failed to cancel reallocation", err);
            const msg = err.response?.data?.detail || 'Failed to cancel reallocation.';
            swal.fire('Error', msg, 'error');
        }
    };

    if (loading) {
        return (
            <div className="d-flex flex-column justify-content-center align-items-center" style={{ minHeight: '450px' }}>
                <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
                <span className="mt-3 fw-semibold text-muted">Retrieving Gate Entry Dossier...</span>
            </div>
        );
    }

    if (!entry) {
        return (
            <div className="container mt-5 text-center">
                <Card className="p-5 border-0 shadow-sm rounded-4 mx-auto" style={{ maxWidth: '540px' }}>
                    <div className="mb-3 text-muted">
                        <i className="fa fa-folder-open fa-3x text-secondary opacity-50"></i>
                    </div>
                    <h4 className="fw-bold mb-2">Gate Entry Not Found</h4>
                    <p className="text-muted mb-4 fs-14">
                        This entry record does not exist or may have been deleted.
                    </p>
                    <div>
                        <Button variant="primary" className="rounded-pill px-4 shadow-sm" onClick={handleBackToList}>
                            <i className="fa fa-arrow-left me-2"></i> Back to Gate Entries
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    const isVehicleMode = entry.entry_type === 'vehicle' || !entry.visitor;
    const isExited = !!entry.exit_time;
    const allLogs = entry.partial_exit_logs || [];
    const exitLogs = allLogs.filter(l => l.action !== 're_entered' && l.action !== 'reentry' && !l.entered_count);
    const reentryLogs = allLogs.filter(l => l.action === 're_entered' || l.action === 'reentry' || Boolean(l.entered_count));

    const isPartiallyExited = !isExited && (
        (entry.persons_inside != null && entry.number_of_persons && entry.persons_inside < entry.number_of_persons && entry.persons_inside > 0)
    );
    const isUnclosedCustody = !isExited && entry.persons_inside === 0;
    const hasHost = Boolean(entry.employee || entry.appointment || entry.employee_name);
    const isMovementDone = !hasHost || entry.verification_status === 'completed' || Boolean(entry.movement_completed_at);
    const vehiclesList = (entry.vehicles && entry.vehicles.length > 0)
        ? entry.vehicles
        : ((entry.vehicles_data && entry.vehicles_data.length > 0)
            ? entry.vehicles_data
            : (entry.vehicle_number && entry.vehicle_number.trim() && entry.vehicle_number !== '—'
                ? entry.vehicle_number.split(',').map((vn, i) => ({ id: i, vehicle_number: vn.trim(), driver_name: entry.driver || 'Visitor / self' }))
                : []));

    // Map of vehicle number to exit log
    const vehicleExitStatusMap = {};
    const equipmentExitStatusMap = {};
    if (entry?.partial_exit_logs && Array.isArray(entry.partial_exit_logs)) {
        entry.partial_exit_logs.forEach(log => {
            if (log.action === 're_entered' || log.action === 'reentry') return;
            if (log.vehicle_number) {
                log.vehicle_number.split(',').forEach(v => {
                    const trimmed = v.trim().toUpperCase();
                    if (trimmed) vehicleExitStatusMap[trimmed] = log;
                });
            }
            if (Array.isArray(log.vehicle_numbers)) {
                log.vehicle_numbers.forEach(v => {
                    const trimmed = String(v).trim().toUpperCase();
                    if (trimmed) vehicleExitStatusMap[trimmed] = log;
                });
            }
            if (Array.isArray(log.exiting_equipments)) {
                log.exiting_equipments.forEach(eqId => {
                    if (eqId != null && eqId !== '') {
                        equipmentExitStatusMap[String(eqId)] = log;
                    }
                });
            }
            if (Array.isArray(log.exiting_equipment_names)) {
                log.exiting_equipment_names.forEach(name => {
                    if (name && typeof name === 'string') {
                        equipmentExitStatusMap[name.trim().toLowerCase()] = log;
                    }
                });
            }
        });
    }

    const hasAnyVehicleExited = vehiclesList.some(v => isExited || !!vehicleExitStatusMap[(v.vehicle_number || '').trim().toUpperCase()]);
    const reallocationsList = entry.reallocations || [];
    const docList = (entry.documents && entry.documents.length > 0)
        ? entry.documents
        : (entry.document_photo ? [{ id: 0, document_photo: entry.document_photo, document_name: 'Supporting Document' }] : []);
    const hasDocs = entry.id_card_photo || entry.visiting_card_photo || entry.delivery_note_photo || docList.length > 0;

    const tagStyle = getSoftTagBadgeStyle(entry.tag_colour);
    const activeStayDuration = calculateDuration(entry.entry_time, entry.exit_time);
    const totalPersons = entry.number_of_persons || 1;
    const personsInside = isExited ? 0 : (entry.persons_inside != null ? entry.persons_inside : totalPersons);
    const personsOut = Math.max(0, totalPersons - personsInside);
    const status = isExited
        ? { tone: 'mute', icon: 'fa-door-closed', label: 'Exited campus' }
        : isUnclosedCustody
            ? { tone: 'warn', icon: 'fa-warehouse', label: '0 Inside • Custody on Campus' }
            : isMovementDone
                ? { tone: 'info', icon: 'fa-circle-check', label: 'Ready for gate exit' }
                : isPartiallyExited
                    ? { tone: 'warn', icon: 'fa-user-minus', label: 'Partially exited' }
                    : reentryLogs.length > 0
                        ? { tone: 'ok', icon: 'fa-rotate-left', label: 'Inside campus (Re-entered)' }
                        : { tone: 'ok', icon: 'fa-circle', label: 'Inside campus' };
    const signOffDone = !hasHost || !!entry.movement_completed_at || entry.verification_status === 'completed';
    const shortTime = (s) => {
        if (!s) return '';
        const d = new Date(s);
        return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    };
    const partialLogs = exitLogs;
    const steps = [
        { label: 'Checked in', time: entry.entry_time, state: 'done' },
        { label: 'Host sign-off', time: entry.movement_completed_at, state: signOffDone ? 'done' : 'current' },
        ...(exitLogs.length > 0 ? [{
            label: exitLogs.length > 1 
                ? `Partial exit (${exitLogs.length})` 
                : (exitLogs[0].is_vehicle_only || exitLogs[0].exited_count === 0 ? 'Vehicle exit' : 'Partial exit'),
            time: exitLogs[exitLogs.length - 1].timestamp,
            state: 'done'
        }] : []),
        ...(reentryLogs.length > 0 ? [{
            label: reentryLogs.length > 1
                ? `Re-entered (${reentryLogs.length})`
                : 'Re-entered campus',
            time: reentryLogs[reentryLogs.length - 1].timestamp,
            state: 'done'
        }] : []),
        { label: 'Checked out', time: entry.exit_time, state: isExited ? 'done' : (signOffDone ? 'current' : 'todo') }
    ];
    const expectedExit = entry.expected_time_of_exit
        ? (typeof entry.expected_time_of_exit === 'string' ? entry.expected_time_of_exit.slice(0, 8) : entry.expected_time_of_exit)
        : 'Standard';

    const displayName = entry.visitor_name || entry.driver || 'Driver';
    const displayMobile = entry.visitor_mobile || entry.driver_mobile;

    return (
        <div className="gate-entry-detail-container theme-light" style={{ padding: '24px 32px', minHeight: '100vh', backgroundColor: '#f6f8fb', color: '#1e293b' }}>
            
            {/* ── PRINT-ONLY OFFICIAL GATE PASS DOCUMENT (1-PAGE COMPLETE SECURITY PASS) ── */}
            <div className="print-only gate-pass-printable">
                <div className="gate-pass-card">
                    {/* Pass Top Branding & Security Header */}
                    <div className="pass-header">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <span className="pass-brand-title">GLENDA AQUA</span>
                                <span className="pass-brand-sub">PURE FOR CARE • CAMPUS ACCESS & VISITOR MOVEMENT</span>
                            </div>
                            <div className="text-center">
                                <div className="pass-type-pill">
                                    {isVehicleMode ? 'COMMERCIAL VEHICLE PASS' : 'SECURITY GATE PASS'}
                                </div>
                            </div>
                            <div className="text-end">
                                <div className="pass-id-num">PASS #{entry.id}</div>
                                <div className="pass-issue-date">Issued: {formatExactDateTime(entry.entry_time)}</div>
                            </div>
                        </div>
                    </div>

                    {/* Prominent Metadata Summary Strip */}
                    <div className="pass-meta-strip">
                        <div className="meta-strip-item">
                            <span className="meta-strip-label">Assigned Tag</span>
                            <span className="meta-strip-val font-monospace">
                                {isUnclosedCustody ? (
                                    <span style={{ color: '#d97706', fontWeight: 700 }}>Surrendered at Gate</span>
                                ) : (entry.tag_code === 'N/A' || entry.tag_number === 'N/A')
                                    ? 'Not Applicable'
                                    : (entry.generated_tags_details && entry.generated_tags_details.length > 0)
                                        ? entry.generated_tags_details.map(t => `#${t.tag_number}`).join(', ')
                                        : (entry.tag_code ? String(entry.tag_code).split(',').map(t => `#${t.trim()}`).join(', ') : 'Unassigned')}
                            </span>
                        </div>
                        <div className="meta-strip-item">
                            <span className="meta-strip-label">Entry Gate</span>
                            <span className="meta-strip-val">{entry.entry_gate_name || (entry.entry_gate_no ? `Gate #${entry.entry_gate_no}` : 'Main Gate')}</span>
                        </div>
                        <div className="meta-strip-item">
                            <span className="meta-strip-label">Persons</span>
                            <span className="meta-strip-val">{entry.number_of_persons || 1} Person{entry.number_of_persons > 1 ? 's' : ''}</span>
                        </div>
                        <div className="meta-strip-item">
                            <span className="meta-strip-label">Expected Exit</span>
                            <span className="meta-strip-val font-monospace">{entry.expected_time_of_exit ? (typeof entry.expected_time_of_exit === 'string' ? entry.expected_time_of_exit.slice(0, 5) : entry.expected_time_of_exit) : 'Standard'}</span>
                        </div>
                        <div className="meta-strip-item">
                            <span className="meta-strip-label">Status</span>
                            <span className={`meta-strip-val ${isExited ? 'text-danger' : isUnclosedCustody ? 'text-warning' : 'text-success'}`}>
                                {isExited ? 'EXITED' : isUnclosedCustody ? '0 INSIDE (CUSTODY)' : (isMovementDone ? 'CLEARED' : 'ACTIVE / INSIDE')}
                            </span>
                        </div>
                    </div>

                    {/* Core Two-Column Dossier: Visitor / Host */}
                    <div className="pass-grid">
                        {/* Visitor / Driver Box */}
                        <div className="pass-box">
                            <div className="pass-box-title">
                                <i className="fa fa-user me-1"></i> {isVehicleMode ? 'DRIVER / TRANSPORTER DETAILS' : 'VISITOR INFORMATION'}
                            </div>
                            <div className="pass-box-content">
                                <div className="d-flex gap-3 align-items-start">
                                    <div className="pass-photo-frame">
                                        {entry.visitor_photo ? (
                                            <img src={getFullImageUrl(entry.visitor_photo)} alt="Visitor" className="pass-photo" />
                                        ) : (
                                            <div className="pass-photo-placeholder">
                                                <i className="fa fa-user fa-2x text-secondary"></i>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-grow-1">
                                        <table className="pass-data-table">
                                            <tbody>
                                                <tr>
                                                    <td className="data-lbl">Full Name:</td>
                                                    <td className="data-val fw-bold">{displayName}</td>
                                                </tr>
                                                <tr>
                                                    <td className="data-lbl">Organization:</td>
                                                    <td className="data-val">{entry.company_name || entry.company || 'Private / Individual'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="data-lbl">Contact Phone:</td>
                                                    <td className="data-val font-monospace">{displayMobile || 'Not provided'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="data-lbl">ID Verification:</td>
                                                    <td className="data-val">
                                                        {entry.id_card_photo ? (
                                                            <span className="text-success fw-semibold">✓ Verified ID On File</span>
                                                        ) : (
                                                            <span className="text-muted">Standard Verified</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Host Official & Clearance Box */}
                        <div className="pass-box">
                            <div className="pass-box-title">
                                <i className="fa fa-building me-1"></i> HOST OFFICIAL & AUTHORIZATION
                            </div>
                            <div className="pass-box-content">
                                <table className="pass-data-table">
                                    <tbody>
                                        <tr>
                                            <td className="data-lbl">Host Official:</td>
                                            <td className="data-val fw-bold">{entry.employee_name || 'General Access'}</td>
                                        </tr>
                                        <tr>
                                            <td className="data-lbl">Department:</td>
                                            <td className="data-val">{entry.department_name || 'General'}</td>
                                        </tr>
                                        {(entry.contact_person_name || entry.contact_person_number) && (
                                            <tr>
                                                <td className="data-lbl">Contact Person:</td>
                                                <td className="data-val">
                                                    <span className="fw-semibold">{entry.contact_person_name || 'Staff'}</span>
                                                    {entry.contact_person_number && (
                                                        <span className="ms-1 font-monospace text-muted">({entry.contact_person_number})</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                        <tr>
                                            <td className="data-lbl">Check-In Time:</td>
                                            <td className="data-val font-monospace">{formatExactDateTime(entry.entry_time)}</td>
                                        </tr>
                                        {reentryLogs.length > 0 && (
                                            <tr>
                                                <td className="data-lbl">Last Re-Entry:</td>
                                                <td className="data-val font-monospace text-primary">
                                                    {formatExactDateTime(reentryLogs[reentryLogs.length - 1].timestamp)}
                                                    <span className="ms-1 badge bg-light text-primary border" style={{ fontSize: '7pt' }}>Re-entered ({reentryLogs.length})</span>
                                                </td>
                                            </tr>
                                        )}
                                        {entry.exit_time && (
                                            <tr>
                                                <td className="data-lbl">Check-Out Time:</td>
                                                <td className="data-val font-monospace text-danger">{formatExactDateTime(entry.exit_time)}</td>
                                            </tr>
                                        )}
                                        <tr>
                                            <td className="data-lbl">Exit Gate:</td>
                                            <td className="data-val">{entry.exit_gate_name || (entry.exit_time ? `Gate #${entry.exit_gate_no || '1'}` : 'Pending Checkout')}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Purpose & Accompanying Vehicles Box */}
                    <div className="pass-box pass-purpose-box">
                        <div className="pass-box-title">
                            <i className="fa fa-file-lines me-1"></i> PURPOSE OF VISIT & VEHICLE DETAILS
                        </div>
                        <div className="pass-box-content py-2">
                            <div className="d-flex justify-content-between align-items-start gap-4">
                                <div className="flex-grow-1">
                                    <span className="data-lbl d-block text-uppercase fw-semibold mb-1" style={{ fontSize: '7.5pt' }}>Purpose / Remarks:</span>
                                    <div className="pass-purpose-text">
                                        {entry.purpose_of_visit || entry.purpose || 'General Campus Visit'}
                                    </div>
                                    {entry.narration && (
                                        <div className="mt-1 pt-1 border-top text-muted" style={{ fontSize: '8pt' }}>
                                            <strong>Supervisor Notes:</strong> {entry.narration}
                                        </div>
                                    )}
                                    {entry.equipment_details && entry.equipment_details.length > 0 && (
                                        <div className="mt-2 pt-1 border-top">
                                            <span className="data-lbl d-block text-uppercase fw-semibold mb-1" style={{ fontSize: '7.5pt' }}>Carried Tools & Equipments:</span>
                                            <div className="d-flex flex-wrap gap-1">
                                                {entry.equipment_details.map((eq, idx) => {
                                                    const eqId = String(eq.id || eq.value || '');
                                                    const eqName = (eq.name || '').trim().toLowerCase();
                                                    const isEqExited = isExited || !!equipmentExitStatusMap[eqId] || !!equipmentExitStatusMap[eqName];
                                                    return (
                                                        <span key={idx} className="badge bg-light text-dark border" style={{ fontSize: '7.5pt' }}>
                                                            <i className="fa fa-wrench me-1 text-muted"></i>
                                                            <span style={isEqExited ? { textDecoration: 'line-through', color: '#64748b' } : {}}>{eq.name}</span>
                                                            {isEqExited && <span className="ms-1 text-danger" style={{ fontSize: '6.5pt' }}>(Exited)</span>}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {vehiclesList.length > 0 && (
                                    <div style={{ minWidth: '220px' }}>
                                        <span className="data-lbl d-block text-uppercase fw-semibold mb-1" style={{ fontSize: '7.5pt' }}>Authorized Vehicle(s):</span>
                                        {vehiclesList.map((v, idx) => {
                                            const vNum = (v.vehicle_number || '').trim().toUpperCase();
                                            const isVehExited = isExited || !!vehicleExitStatusMap[vNum];
                                            return (
                                                <div key={idx} className="pass-vehicle-badge">
                                                    <span className={`fw-bold font-monospace ${isVehExited ? 'text-decoration-line-through text-muted' : ''}`}>{v.vehicle_number}</span>
                                                    {v.driver_name && <span className="text-muted ms-1">({v.driver_name})</span>}
                                                    {isVehExited && <span className="ms-1 badge bg-light text-danger border border-danger-subtle" style={{ fontSize: '7pt' }}>Exited</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Campus Security & Safety Regulations */}
                    <div className="pass-guidelines">
                        <div className="guidelines-title">CAMPUS VISITOR & SECURITY REGULATIONS</div>
                        <div className="guidelines-list">
                            <span>1. This pass must be visibly worn at all times while inside the campus.</span>
                            <span>2. Visitors must be escorted or accompanied by the host official in work areas.</span>
                            <span>3. Unauthorized photography, recording, and access to restricted zones are strictly prohibited.</span>
                            <span>4. Surrender this pass and the physical visitor tag (#{entry.tag_code || 'N/A'}) at the gate upon departure.</span>
                        </div>
                    </div>

                    {/* Signatures Block */}
                    <div className="pass-signatures">
                        <div className="signature-col">
                            <div className="signature-line"></div>
                            <div className="signature-title">{isVehicleMode ? 'Driver / Transporter Signature' : 'Visitor Signature'}</div>
                            <div className="signature-sub">Date & Acknowledgment</div>
                        </div>
                        <div className="signature-col">
                            <div className="signature-line"></div>
                            <div className="signature-title">Host Official Sign-Off</div>
                            <div className="signature-sub">Visit / Meeting Completion</div>
                        </div>
                        <div className="signature-col">
                            <div className="signature-line"></div>
                            <div className="signature-title">Security Gate Officer</div>
                            <div className="signature-sub">Tag Surrendered & Gate Clearance</div>
                        </div>
                    </div>

                    {/* Pass Footer */}
                    <div className="pass-footer">
                        <span>Glenda Aqua Security Systems</span>
                        <span className="font-monospace">PASS VERIFICATION: *GLENDA-GP-{entry.id}-TAG{entry.tag_code || '00'}*</span>
                        <span>Printed: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                </div>
            </div>

            {/* ── SCREEN VIEW (REDESIGNED · LIGHT) ── */}
            <div className="no-print screen-dashboard-view ged">

                {/* Top bar */}
                <div className="ged-top">
                    <button onClick={handleBackToList} className="ged-back">
                        <i className="fa fa-arrow-left"></i>
                        <span>Back to {isVehicleMode ? 'vehicle entries' : 'gate entries'}</span>
                    </button>
                    <div className="ged-actions">
                        <Button variant="light" className="ged-btn" onClick={() => window.print()}>
                            <i className="fa fa-print"></i> Print pass
                        </Button>
                        {(entry.entry_card_id || vehiclesList.length > 0) && (
                            <Button variant="light" className="ged-btn text-info" onClick={() => navigate('/access-point/entry-card')}>
                                <i className="fa fa-id-card"></i> Entry Card
                            </Button>
                        )}
                        {(entry.exit_card_id || (isExited && vehiclesList.length > 0)) && (
                            <Button variant="light" className="ged-btn text-success" onClick={() => navigate('/access-point/exit-card')}>
                                <i className="fa fa-receipt"></i> Exit Card {entry.parking_fee ? `(₹${Number(entry.parking_fee).toFixed(0)})` : ''}
                            </Button>
                        )}
                        {!isExited && (
                            <Button
                                className="ged-btn ged-btn-primary"
                                onClick={handleExit}
                                disabled={!isMovementDone}
                                title={!isMovementDone ? `Host official (${entry.employee_name || 'concerned staff'}) must complete the movement before checkout.` : 'Check out and release gate tag'}
                            >
                                <i className={`fa ${isMovementDone ? 'fa-arrow-right-from-bracket' : 'fa-lock'}`}></i> Mark exit
                            </Button>
                        )}
                    </div>
                </div>

                {/* Pending reallocation banner */}
                {entry.has_pending_reallocation && entry.pending_reallocation && (
                    <div className="ged-alert">
                        <div className="ged-alert-icon"><i className="fa fa-clock"></i></div>
                        <div className="ged-alert-body">
                            <div className="ged-alert-title">Host handover waiting for approval</div>
                            <div>
                                <strong>{entry.pending_reallocation.from_employee_name}</strong> asked to hand this visitor to <strong>{entry.pending_reallocation.to_employee_name}</strong> ({entry.pending_reallocation.to_department_name || 'Dept'}).
                                {entry.pending_reallocation.reason && <span className="fst-italic ms-1">"{entry.pending_reallocation.reason}"</span>}
                            </div>
                            <div className="ged-alert-hint">If declined, <strong>{entry.employee_name}</strong> stays responsible for the visitor.</div>
                        </div>
                        <div className="ged-alert-actions">
                            {(currentUser?.id === entry.pending_reallocation.to_employee || currentUser?.is_superuser) && (
                                <>
                                    <Button size="sm" variant="success" className="ged-btn" onClick={() => handleRespondReallocation(entry.pending_reallocation.id, 'approve')}>
                                        <i className="fa fa-check"></i> Accept
                                    </Button>
                                    <Button size="sm" variant="outline-danger" className="ged-btn" onClick={() => handleRespondReallocation(entry.pending_reallocation.id, 'reject')}>
                                        <i className="fa fa-times"></i> Decline
                                    </Button>
                                </>
                            )}
                            {(currentUser?.id === entry.pending_reallocation.from_employee || currentUser?.is_superuser) && (
                                <Button size="sm" variant="outline-secondary" className="ged-btn" onClick={() => handleCancelReallocation(entry.pending_reallocation.id)}>
                                    <i className="fa fa-ban"></i> Cancel request
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Hero */}
                <section className="ged-card ged-hero">
                    <div className="ged-hero-main">
                        <div
                            className="ged-photo"
                            onClick={() => {
                                const photo = entry.visitor_photo || entry.driver_photo || (vehiclesList[0]?.vehicle_photo);
                                if (photo) setPreviewPhoto({ url: getFullImageUrl(photo), title: displayName });
                            }}
                            title="View photo"
                        >
                            {entry.visitor_photo || entry.driver_photo ? (
                                <img src={getFullImageUrl(entry.visitor_photo || entry.driver_photo)} alt={displayName} />
                            ) : vehiclesList[0]?.vehicle_photo ? (
                                <img src={getFullImageUrl(vehiclesList[0].vehicle_photo)} alt={vehiclesList[0].vehicle_number} />
                            ) : (
                                <i className={`fa ${isVehicleMode ? 'fa-truck' : 'fa-user'}`}></i>
                            )}
                        </div>

                        <div className="ged-hero-body">
                            <div className="ged-title-row">
                                <h1 className="ged-name">{displayName}</h1>
                                <span className={`ged-pill ged-tone-${status.tone}`}>
                                    <i className={`fa ${status.icon}`}></i> {status.label}
                                </span>
                                {reentryLogs.length > 0 && (
                                    <span className="ged-pill ged-tone-ok" title={`Visitor re-entered campus ${reentryLogs.length} time(s)`}>
                                        <i className="fa fa-rotate-left me-1"></i> Re-entered ({reentryLogs.length})
                                    </span>
                                )}
                                {isUnclosedCustody ? (
                                    <span className="ged-pill ged-tone-warn" title="Pass surrendered upon departure. New tag will be issued upon re-entry.">
                                        <i className="fa fa-id-badge me-1"></i> Pass Surrendered at Gate
                                    </span>
                                ) : (entry.generated_tags_details && entry.generated_tags_details.length > 0) ? (
                                    entry.generated_tags_details.map((t, idx) => {
                                        const pillStyle = t.colour ? getSoftTagBadgeStyle(t.colour) : tagStyle;
                                        return (
                                            <span key={idx} className="ged-pill" style={{ backgroundColor: pillStyle.backgroundColor, color: pillStyle.color, borderColor: pillStyle.borderColor }}>
                                                <span className="ged-dot" style={{ backgroundColor: pillStyle.dotColor }}></span>
                                                {isVehicleMode ? 'Tag' : 'Visitor tag'} #{t.tag_number}
                                            </span>
                                        );
                                    })
                                ) : (entry.tag_code || entry.tag_number) ? (
                                    String(entry.tag_code || entry.tag_number).split(',').map((tNum, idx) => (
                                        <span key={idx} className="ged-pill" style={{ backgroundColor: tagStyle.backgroundColor, color: tagStyle.color, borderColor: tagStyle.borderColor }}>
                                            <span className="ged-dot" style={{ backgroundColor: tagStyle.dotColor }}></span>
                                            {(tNum.trim() === 'N/A')
                                                ? 'Tag: Not Applicable'
                                                : `${isVehicleMode ? 'Tag' : 'Visitor tag'} #${tNum.trim()}`}
                                        </span>
                                    ))
                                ) : null}
                            </div>

                            <div className="ged-meta">
                                <span className="ged-id">
                                    {isVehicleMode ? 'Vehicle entry' : 'Gate entry'} #{entry.id}
                                    <button onClick={() => handleCopyText(String(entry.id), 'pass')} title={copiedPass ? 'Copied!' : 'Copy pass ID'}>
                                        <i className={`fa ${copiedPass ? 'fa-check text-success' : 'fa-copy'}`}></i>
                                    </button>
                                </span>
                                {displayMobile && (
                                    <span className="ged-chip">
                                        <i className="fa fa-phone-alt" style={{ color: '#0f9d63' }}></i>
                                        <a href={`tel:${displayMobile}`}>{displayMobile}</a>
                                        <button onClick={() => handleCopyText(displayMobile, 'phone')} title={copiedPhone ? 'Copied!' : 'Copy'}>
                                            <i className={`fa ${copiedPhone ? 'fa-check text-success' : 'fa-copy'}`}></i>
                                        </button>
                                    </span>
                                )}
                                {(entry.company_name || entry.company || entry.visitor_company) && (
                                    <span className="ged-chip"><i className="fa fa-building" style={{ color: '#0a500f' }}></i>{entry.company_name || entry.company || entry.visitor_company}</span>
                                )}
                                {entry.email && (
                                    <span className="ged-chip"><i className="fa fa-envelope" style={{ color: '#d97706' }}></i>{entry.email}</span>
                                )}
                                {vehiclesList.length > 0 && vehiclesList.map((v, idx) => {
                                    const vNum = (v.vehicle_number || '').trim().toUpperCase();
                                    const isVehExited = isExited || !!vehicleExitStatusMap[vNum];
                                    return (
                                        <span key={idx} className="ged-chip" style={{ opacity: isVehExited ? 0.75 : 1 }}>
                                            <i className="fa fa-car" style={{ color: isVehExited ? '#dc2626' : '#0a500f' }}></i>
                                            <span style={{ textDecoration: isVehExited ? 'line-through' : 'none' }}>{v.vehicle_number}</span>
                                            {isVehExited ? (
                                                <span className="ged-pill ged-tone-bad" style={{ fontSize: '10px', padding: '1px 6px', marginLeft: '4px' }}>Exited</span>
                                            ) : (
                                                <span className="ged-pill ged-tone-ok" style={{ fontSize: '10px', padding: '1px 6px', marginLeft: '4px' }}>Inside</span>
                                            )}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        {(entry.id_card_photo || entry.driver_license_photo) && (
                            <button
                                className="ged-idproof"
                                onClick={() => setPreviewPhoto({ url: getFullImageUrl(entry.id_card_photo || entry.driver_license_photo), title: 'ID Proof' })}
                            >
                                <img src={getFullImageUrl(entry.id_card_photo || entry.driver_license_photo)} alt="ID Proof" />
                                <span><i className="fa fa-external-link-alt"></i> View ID proof</span>
                            </button>
                        )}
                    </div>

                    {/* Progress */}
                    <ol className="ged-steps">
                        {steps.map((s, i) => (
                            <li key={i} className={`ged-step is-${s.state}`}>
                                <span className="ged-step-dot">{s.state === 'done' ? <i className="fa fa-check"></i> : i + 1}</span>
                                <span className="ged-step-text">
                                    <strong>{s.label}</strong>
                                    <small>{s.time ? shortTime(s.time) : (s.state === 'current' ? 'Waiting' : '—')}</small>
                                </span>
                            </li>
                        ))}
                    </ol>
                </section>

                {/* Key figures */}
                <section className="ged-card ged-stats">
                    <div className="ged-stat">
                        <span className="ged-lbl"><i className="fa fa-stopwatch"></i> Campus stay</span>
                        <strong>{activeStayDuration || 'Just arrived'}</strong>
                        <small>{isExited ? 'Completed' : 'Still running'}</small>
                    </div>
                    <div className="ged-stat">
                        <span className="ged-lbl"><i className="fa fa-users"></i> Persons</span>
                        <strong>
                            {totalPersons > 1
                                ? (isExited ? `All ${totalPersons} exited` : `${personsInside} of ${totalPersons} inside`)
                                : (isExited ? '1 person exited' : `${personsInside} person inside`)}
                        </strong>
                        {reentryLogs.length > 0 && !isExited && (
                            <small style={{ color: '#0284c7', fontWeight: 600, display: 'block' }}>
                                <i className="fa fa-undo me-1"></i> Resumed visit
                            </small>
                        )}
                        {vehiclesList.length > 0 && (() => {
                            const exitedCount = vehiclesList.filter(v => isExited || !!vehicleExitStatusMap[(v.vehicle_number || '').trim().toUpperCase()]).length;
                            return (
                                <small style={{ color: exitedCount > 0 ? '#d97706' : undefined, fontWeight: 600 }}>
                                    {exitedCount === vehiclesList.length 
                                        ? (vehiclesList.length === 1 ? 'Vehicle exited' : 'All vehicles exited')
                                        : (exitedCount > 0 ? `${exitedCount} of ${vehiclesList.length} vehicles exited` : 'Vehicle inside')}
                                </small>
                            );
                        })()}
                    </div>
                    <div className="ged-stat">
                        <span className="ged-lbl"><i className="fa fa-clock"></i> Entered</span>
                        <strong className="ged-mono">{formatExactDateTime(entry.entry_time)}</strong>
                        {reentryLogs.length > 0 ? (
                            <small style={{ color: '#0284c7', fontWeight: 600, display: 'block' }}>
                                <i className="fa fa-rotate-left me-1"></i> Re-entered {formatExactDateTime(reentryLogs[reentryLogs.length - 1].timestamp)}
                            </small>
                        ) : (
                            <small>Initial check-in</small>
                        )}
                    </div>
                    <div className="ged-stat">
                        <span className="ged-lbl"><i className="fa fa-hourglass-half"></i> Expected exit</span>
                        <strong className="ged-mono">{expectedExit}</strong>
                        {isExited && <small>Left {formatExactDateTime(entry.exit_time)}</small>}
                    </div>
                </section>

                {/* Unclosed Entry Campus Custody Alert */}
                {isUnclosedCustody && (
                    <div 
                        className="p-3 mb-3" 
                        style={{ 
                            background: '#fffbeb', 
                            border: '1.5px solid #fde68a', 
                            borderRadius: '12px',
                            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.08)'
                        }}
                    >
                        <div className="d-flex align-items-start gap-3">
                            <div 
                                style={{ 
                                    width: '38px', 
                                    height: '38px', 
                                    borderRadius: '10px', 
                                    background: '#fef3c7', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    color: '#d97706',
                                    fontSize: '1.1rem',
                                    flexShrink: 0
                                }}
                            >
                                <i className="fa fa-warehouse"></i>
                            </div>
                            <div className="flex-grow-1">
                                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
                                    <h5 className="mb-0" style={{ fontSize: '0.95rem', fontWeight: 700, color: '#92400e' }}>
                                        0 Persons Inside • Campus Custody (Unclosed Entry)
                                    </h5>
                                    <span className="badge font-monospace" style={{ background: '#fde68a', color: '#92400e', fontSize: '0.72rem' }}>
                                        Physical Pass Surrendered at Gate
                                    </span>
                                </div>
                                <p className="mb-2" style={{ fontSize: '0.82rem', color: '#78350f', lineHeight: 1.5 }}>
                                    All visitors associated with this entry have exited the premises. The physical access pass was surrendered to gate security upon departure and released back to available gate inventory.
                                    {vehiclesList.length > 0 && ' Vehicle(s) remain parked on campus.'}
                                    {entry.equipment_details && entry.equipment_details.length > 0 && ' Tools/equipment remain logged in custody.'}
                                </p>
                                <div className="d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: '0.75rem', color: '#92400e' }}>
                                    <span className="badge bg-white text-dark border">
                                        <i className="fa fa-info-circle text-primary me-1"></i> When returning: Create Gate Entry will record re-entry and issue a <strong>new tag</strong>
                                    </span>
                                    <span className="badge bg-white text-dark border">
                                        <i className="fa fa-check-circle text-success me-1"></i> Physical pass surrendered to gate pool: Released
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <Row className="g-3 main-content-row">
                    {/* ═════ LEFT: TIMELINE ═════ */}
                    <Col lg={7} className="detail-col-left">
                        <section className="ged-card">
                            <h2 className="ged-h">Movement and journey</h2>
                            <ol className="ged-tl">

                                {/* Check-in */}
                                <li className="ged-tl-item is-ok">
                                    <span className="ged-tl-mark"></span>
                                    <div className="ged-tl-head">
                                        <h3>Gate check-in</h3>
                                        <time>{formatExactDateTime(entry.entry_time)}</time>
                                    </div>
                                    <p>
                                        Checked in at <strong>{entry.entry_gate_name || `Gate #${entry.entry_gate_no || '1'}`}</strong> with tag <strong>#{entry.tag_code || 'N/A'}</strong>. Assigned host: <strong>{reallocationsList.length > 0 ? (reallocationsList[0].from_employee_name || entry.employee_name) : entry.employee_name}</strong> ({reallocationsList.length > 0 ? (reallocationsList[0].from_department_name || entry.department_name) : entry.department_name}).
                                        {entry.contact_person_name && (
                                            <> Contact: <strong>{entry.contact_person_name}</strong>{entry.contact_person_number ? ` (${entry.contact_person_number})` : ''}.</>
                                        )}
                                    </p>
                                </li>

                                {/* Handovers */}
                                {reallocationsList.map((realloc, idx) => {
                                    const isPending = realloc.status === 'pending';
                                    const isRejected = realloc.status === 'rejected';
                                    const isCancelled = realloc.status === 'cancelled';
                                    const tone = isPending ? 'warn' : (isRejected ? 'bad' : (isCancelled ? 'mute' : 'info'));
                                    return (
                                        <li key={realloc.id || idx} className={`ged-tl-item is-${tone}`}>
                                            <span className="ged-tl-mark"></span>
                                            <div className="ged-tl-head">
                                                <h3>
                                                    Host handover #{idx + 1}
                                                    {isPending && <span className="ged-pill ged-tone-warn">Pending approval</span>}
                                                    {isRejected && <span className="ged-pill ged-tone-bad">Declined</span>}
                                                    {isCancelled && <span className="ged-pill ged-tone-mute">Cancelled</span>}
                                                    {!isPending && !isRejected && !isCancelled && <span className="ged-pill ged-tone-ok">Approved</span>}
                                                </h3>
                                                <time>{formatExactDateTime(realloc.created_at)}</time>
                                            </div>
                                            <div className="ged-flow">
                                                <span className="ged-chip">{realloc.from_employee_name} ({realloc.from_department_name})</span>
                                                <i className="fa fa-arrow-right"></i>
                                                <span className="ged-chip ged-chip-strong">{realloc.to_employee_name} ({realloc.to_department_name})</span>
                                            </div>
                                            {realloc.reason && <p><strong>Reason:</strong> {realloc.reason}</p>}
                                            {isRejected && (
                                                <div className="ged-note is-bad">
                                                    <i className="fa fa-info-circle"></i>
                                                    <div>
                                                        Declined by <strong>{realloc.to_employee_name}</strong>. <strong>{realloc.from_employee_name}</strong> stays responsible.
                                                        {realloc.response_notes && <div className="fst-italic">Note: "{realloc.response_notes}"</div>}
                                                    </div>
                                                </div>
                                            )}
                                            {isPending && (currentUser?.id === realloc.to_employee || currentUser?.is_superuser) && (
                                                <div className="ged-inline-actions">
                                                    <Button size="sm" variant="success" className="ged-btn" onClick={() => handleRespondReallocation(realloc.id, 'approve')}>
                                                        <i className="fa fa-check"></i> Accept
                                                    </Button>
                                                    <Button size="sm" variant="outline-danger" className="ged-btn" onClick={() => handleRespondReallocation(realloc.id, 'reject')}>
                                                        <i className="fa fa-times"></i> Decline
                                                    </Button>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}

                                {/* Host sign-off */}
                                <li className={`ged-tl-item ${entry.movement_completed_at ? 'is-ok' : 'is-warn'}`}>
                                    <span className="ged-tl-mark"></span>
                                    <div className="ged-tl-head">
                                        <h3>Campus visit and host sign-off</h3>
                                        <time>{entry.movement_completed_at ? formatExactDateTime(entry.movement_completed_at) : 'In progress'}</time>
                                    </div>
                                    {entry.movement_completed_at ? (
                                        <>
                                            <p>Host <strong>{entry.movement_completed_by_name || entry.employee_name}</strong> confirmed the visit is complete. Cleared for exit.</p>
                                            {entry.movement_notes && <div className="ged-note is-quote">"{entry.movement_notes}"</div>}
                                        </>
                                    ) : (
                                        <p>Visit is in progress with <strong>{entry.employee_name || 'the assigned host'}</strong>. Waiting for host sign-off.</p>
                                    )}
                                </li>

                                {/* Partial departures, Vehicle exits, and Campus Re-entries */}
                                {entry.partial_exit_logs && entry.partial_exit_logs.map((log, pIdx) => {
                                    const isReentry = log.action === 're_entered' || log.action === 'reentry' || Boolean(log.entered_count);

                                    if (isReentry) {
                                        const isLatestReentry = pIdx === partialLogs.length - 1;
                                        const enteredPersons = isLatestReentry && entry.persons_inside != null
                                            ? Math.max(log.entered_count || 1, entry.persons_inside)
                                            : (log.entered_count || log.number_of_persons || 1);
                                        const insideNow = isLatestReentry && entry.persons_inside != null
                                            ? entry.persons_inside
                                            : (log.persons_inside != null ? log.persons_inside : enteredPersons);
                                        const rawTag = log.new_tag_issued || log.tag_number;
                                        let tagList = rawTag && rawTag !== 'N/A'
                                            ? String(rawTag).split(',').map(t => t.trim()).filter(Boolean)
                                            : [];
                                        if (tagList.length <= 1 && entry.generated_tags_details && entry.generated_tags_details.length > 1) {
                                            tagList = entry.generated_tags_details.map(t => String(t.tag_number));
                                        }
                                        const vehDisplay = log.vehicle_number || (Array.isArray(log.vehicle_numbers) && log.vehicle_numbers.length > 0 ? log.vehicle_numbers.join(', ') : (isLatestReentry && vehiclesList.length > 0 ? vehiclesList.map(v => v.vehicle_number).filter(Boolean).join(', ') : null));
                                        return (
                                            <li key={pIdx} className="ged-tl-item is-reentry">
                                                <span className="ged-tl-mark" style={{ background: '#0284c7', borderColor: '#0369a1' }}></span>
                                                <div className="ged-tl-head">
                                                    <h3>
                                                        <i className="fa fa-rotate-left me-1.5" style={{ color: '#0284c7' }}></i>
                                                        Campus re-entry ({enteredPersons} {enteredPersons === 1 ? 'person' : 'persons'} returned)
                                                        <span className="ged-pill ged-tone-ok ms-2">
                                                            <i className="fa fa-door-open me-1"></i>Re-entered
                                                        </span>
                                                        {tagList.length > 0 && (
                                                            <span className="ged-pill ged-tone-info ms-1.5">
                                                                <i className="fa fa-id-badge me-1"></i>
                                                                {tagList.length > 1
                                                                    ? `New Passes Issued: ${tagList.map(t => `#${t}`).join(', ')}`
                                                                    : `New Pass Issued: Tag #${tagList[0]}`}
                                                            </span>
                                                        )}
                                                        {vehDisplay && (
                                                            <span className="ged-pill ged-tone-warn ms-1.5">
                                                                <i className="fa fa-car me-1"></i>Vehicle: {vehDisplay}
                                                            </span>
                                                        )}
                                                    </h3>
                                                    <time>{formatExactDateTime(log.timestamp)}</time>
                                                </div>
                                                <p>
                                                    <strong>{enteredPersons}</strong> {enteredPersons === 1 ? 'person' : 'persons'} re-entered campus through <strong>{log.entry_gate || entry.entry_gate_name || 'Main Gate'}</strong>
                                                    {insideNow != null ? <> (now <strong>{insideNow}</strong> person(s) inside campus)</> : ''}
                                                    {vehDisplay && (
                                                        <> accompanied by vehicle <strong className="ged-plate">{vehDisplay}</strong></>
                                                    )}
                                                    {tagList.length > 0 && (
                                                        <> with newly issued pass{tagList.length > 1 ? 'es' : ''} <strong>{tagList.map(t => `Tag #${t}`).join(', ')}</strong></>
                                                    )}
                                                    {log.recorded_by ? <> • Recorded by <strong>{log.recorded_by}</strong></> : ''}.
                                                    {log.employee_name && <> Assigned host: <strong>{log.employee_name}</strong>{log.department_name ? ` (${log.department_name})` : ''}.</>}
                                                </p>
                                                {log.notes && log.notes !== 'Visitor re-entered campus (resumed unclosed entry)' && (
                                                    <div className="ged-note is-quote mt-1">"{log.notes}"</div>
                                                )}
                                            </li>
                                        );
                                    }

                                    const isVehicleOnlyExit = log.is_vehicle_only || log.exited_count === 0;
                                    const hasVehicle = Boolean(log.vehicle_number || (Array.isArray(log.vehicle_numbers) && log.vehicle_numbers.length > 0));
                                    const vehDisplay = log.vehicle_number || (Array.isArray(log.vehicle_numbers) ? log.vehicle_numbers.join(', ') : '');
                                    const surrenderedTags = log.surrendered_tags || [];
                                    const remainingInside = log.remaining_count != null ? log.remaining_count : (entry.persons_inside != null ? entry.persons_inside : 0);
                                    const isAllExitedAtStep = remainingInside === 0 && !isVehicleOnlyExit;

                                    return (
                                        <li key={pIdx} className="ged-tl-item is-warn">
                                            <span className="ged-tl-mark" style={isVehicleOnlyExit ? { background: '#f59e0b', borderColor: '#d97706' } : {}}></span>
                                            <div className="ged-tl-head">
                                                <h3>
                                                    {isVehicleOnlyExit ? (
                                                        <>
                                                            <i className="fa fa-car me-1.5" style={{ color: '#d97706' }}></i>
                                                            Vehicle departure {vehDisplay ? `(${vehDisplay})` : ''}
                                                            <span className="ged-pill ged-tone-warn ms-2">Vehicle Exited</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {isAllExitedAtStep ? 'Campus departure (0 inside)' : `Partial departure (${log.exited_count} ${log.exited_count === 1 ? 'person' : 'persons'} exited)`}
                                                            {hasVehicle && <span className="ged-pill ged-tone-info ms-2"><i className="fa fa-car me-1"></i>With Vehicle</span>}
                                                            {log.exiting_equipment_names && log.exiting_equipment_names.length > 0 && (
                                                                <span className="ged-pill ged-tone-warn ms-2"><i className="fa fa-tools me-1"></i>With Tools ({log.exiting_equipment_names.length})</span>
                                                            )}
                                                            {isAllExitedAtStep && (
                                                                <span className="ged-pill ged-tone-mute ms-2">
                                                                    <i className="fa fa-hand-holding me-1"></i>Pass(es) Surrendered at Gate
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </h3>
                                                <time>{formatExactDateTime(log.timestamp)}</time>
                                            </div>
                                            {isVehicleOnlyExit ? (
                                                <p>
                                                    Vehicle {vehDisplay ? <strong className="ged-plate me-1">{vehDisplay}</strong> : 'accompanied vehicle'} marked as departed
                                                    {log.exit_gate ? <> through <strong>{log.exit_gate}</strong></> : ''}
                                                    {log.recorded_by ? <> by <strong>{log.recorded_by}</strong></> : ''}. All <strong>{log.remaining_count != null ? log.remaining_count : entry.persons_inside}</strong> visitor(s) remain inside campus.
                                                    {log.exiting_equipment_names && log.exiting_equipment_names.length > 0 && (
                                                        <> Accompanied tool(s) departed: <strong>{log.exiting_equipment_names.join(', ')}</strong>.</>
                                                    )}
                                                </p>
                                            ) : (
                                                <p>
                                                    <strong>{log.exited_count}</strong> {log.exited_count === 1 ? 'person' : 'persons'} departed campus, <strong>{remainingInside}</strong> remaining inside.
                                                    {surrenderedTags.length > 0 ? (
                                                        <> Physical pass(es): <strong>{surrenderedTags.map(t => `#${t.tag_code || t.tag_number || t}`).join(', ')}</strong> surrendered at gate and released to available inventory.</>
                                                    ) : (isAllExitedAtStep ? (
                                                         <> Physical access pass surrendered at gate and released to available inventory.</>
                                                    ) : null)}
                                                    {hasVehicle && <> Accompanied vehicle departed: <strong className="ged-plate">{vehDisplay}</strong>.</>}
                                                    {log.exiting_equipment_names && log.exiting_equipment_names.length > 0 && (
                                                        <> Accompanied tool(s) departed: <strong>{log.exiting_equipment_names.join(', ')}</strong>.</>
                                                    )}
                                                    {log.remaining_vehicles && log.remaining_vehicles.length > 0 && (
                                                        <> Vehicle(s) remaining parked on campus: <strong className="ged-plate">{log.remaining_vehicles.join(', ')}</strong>.</>
                                                    )}
                                                    {log.remaining_equipments && log.remaining_equipments.length > 0 && (
                                                        <> Tool(s) remaining on campus: <strong>{log.remaining_equipments.join(', ')}</strong>.</>
                                                    )}
                                                    {log.exit_gate && <> Exited through <strong>{log.exit_gate}</strong>.</>}
                                                </p>
                                            )}
                                            {log.notes && (
                                                <div className="ged-note is-quote mt-1">"{log.notes}"</div>
                                            )}
                                        </li>
                                    );
                                })}

                                {/* Checkout */}
                                <li className={`ged-tl-item ${isExited ? 'is-done' : 'is-todo'}`}>
                                    <span className="ged-tl-mark"></span>
                                    <div className="ged-tl-head">
                                        <h3>
                                            {entry.partial_exit_logs && entry.partial_exit_logs.some(l => l.remaining_count === 0)
                                                ? 'Final campus checkout (All assets departed)'
                                                : 'Gate exit and checkout'}
                                            {isExited && hasAnyVehicleExited && <span className="ged-pill ged-tone-info ms-2"><i className="fa fa-car me-1"></i>Vehicle Exited</span>}
                                        </h3>
                                        <time>{isExited ? formatExactDateTime(entry.exit_time) : 'Not yet'}</time>
                                    </div>
                                    {isExited ? (
                                        <p>
                                            {entry.partial_exit_logs && entry.partial_exit_logs.some(l => l.remaining_count === 0) ? (
                                                <>Exited through <strong>{entry.exit_gate_name || (entry.exit_gate_no ? `Gate #${entry.exit_gate_no}` : 'Exit gate')}</strong>. All visitors had previously departed campus. Final checkout recorded and all assets departed. Total stay <strong>{activeStayDuration}</strong>.</>
                                            ) : (
                                                <>Exited through <strong>{entry.exit_gate_name || (entry.exit_gate_no ? `Gate #${entry.exit_gate_no}` : 'Exit gate')}</strong>. Tag returned. Total stay <strong>{activeStayDuration}</strong>.</>
                                            )}
                                            {entry.checkout_purpose && (
                                                <span className="d-block mt-1">
                                                    Departure Purpose: <strong className="text-capitalize">{entry.checkout_purpose === 'other' ? 'Other Purpose' : entry.checkout_purpose}</strong>
                                                    {entry.purpose_note && (
                                                        <> • Purpose Note: <strong>{entry.purpose_note}</strong></>
                                                    )}
                                                    {entry.delivery_note_number && (
                                                        <> • Delivery Note: <strong>#{entry.delivery_note_number}</strong></>
                                                    )}
                                                    {entry.delivery_note_photo && (
                                                        <button 
                                                            type="button" 
                                                            className="btn btn-xs btn-outline-primary ms-2 py-0 px-2"
                                                            style={{ fontSize: '11px', verticalAlign: 'baseline' }}
                                                            onClick={() => setPreviewPhoto({ url: getFullImageUrl(entry.delivery_note_photo), title: `Delivery Note ${entry.delivery_note_number ? '#' + entry.delivery_note_number : ''}` })}
                                                        >
                                                            <i className="fa fa-image me-1"></i>View Doc
                                                        </button>
                                                    )}
                                                </span>
                                            )}
                                        </p>
                                    ) : (
                                        <p>{isMovementDone ? 'Cleared for checkout. The visitor can return the tag and leave at the gate.' : 'The visitor is inside campus.'}</p>
                                    )}
                                </li>
                            </ol>
                        </section>
                    </Col>

                    {/* ═════ RIGHT: DETAILS ═════ */}
                    <Col lg={5} className="detail-col-right">
                        <section className="ged-card">
                            <div className="ged-h-row">
                                <h2 className="ged-h">Host and visit</h2>
                                {reentryLogs.length > 0 && (
                                    <span className="ged-chip" style={{ color: '#0284c7', borderColor: '#bae6fd', backgroundColor: '#f0f9ff' }}>
                                        <i className="fa fa-rotate-left"></i> Resumed ({reentryLogs.length} re-entr{reentryLogs.length === 1 ? 'y' : 'ies'})
                                    </span>
                                )}
                            </div>
                            <dl className="ged-dl">
                                <dt>Current host</dt><dd>{entry.employee_name || 'N/A'}</dd>
                                <dt>Department</dt><dd>{entry.department_name || 'N/A'}</dd>
                                <dt>Contact person</dt>
                                <dd>
                                    {entry.contact_person_name || 'Assigned staff'}
                                    {entry.contact_person_number && (
                                        <a className="ged-sub-link" href={`tel:${entry.contact_person_number}`}>{entry.contact_person_number}</a>
                                    )}
                                </dd>
                                <dt>Entry gate</dt><dd>{entry.entry_gate_name || `Gate #${entry.entry_gate_no || '1'}`}</dd>
                                <dt>Assigned pass(es)</dt>
                                <dd>
                                    {(entry.generated_tags_details && entry.generated_tags_details.length > 0) ? (
                                        <div className="d-flex flex-wrap gap-1 align-items-center">
                                            {entry.generated_tags_details.map((t, idx) => (
                                                <span key={idx} className="badge bg-light text-dark border font-monospace" style={{ fontSize: '11.5px', padding: '3px 8px' }}>
                                                    <i className="fa fa-id-badge text-primary me-1"></i>Tag #{t.tag_number}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (entry.tag_code || entry.tag_number) ? (
                                        <span className="fw-semibold">
                                            {String(entry.tag_code || entry.tag_number).split(',').map(t => `#${t.trim()}`).join(', ')}
                                        </span>
                                    ) : (
                                        <span className="text-muted">Unassigned</span>
                                    )}
                                </dd>
                                {reentryLogs.length > 0 && (
                                    <>
                                        <dt>Last re-entry</dt>
                                        <dd>
                                            <span className="text-primary fw-semibold">{formatExactDateTime(reentryLogs[reentryLogs.length - 1].timestamp)}</span>
                                            {reentryLogs[reentryLogs.length - 1].entry_gate && (
                                                <small className="text-muted d-block">via {reentryLogs[reentryLogs.length - 1].entry_gate}</small>
                                            )}
                                        </dd>
                                    </>
                                )}
                            </dl>
                        </section>

                        <section className="ged-card">
                            <h2 className="ged-h">Purpose of visit</h2>
                            <p className="ged-body">{entry.purpose_of_visit || entry.purpose || 'No specific purpose recorded.'}</p>
                            {entry.narration && (
                                <div className="ged-note is-quote mt-2"><strong>Supervisor remarks:</strong> "{entry.narration}"</div>
                            )}
                        </section>

                        <section className="ged-card">
                            <div className="ged-h-row">
                                <h2 className="ged-h">Accompanied vehicles ({vehiclesList.length})</h2>
                                <div className="d-flex align-items-center gap-2">
                                    {(entry.park_area_name || entry.parking_location_display || entry.parking_location) && (
                                        <span className="ged-chip">
                                            <i className="fa fa-square-parking" style={{ color: '#0a500f' }}></i> {entry.park_area_name || entry.parking_location_display || entry.parking_location}
                                        </span>
                                    )}
                                    {entry.parking_fee !== undefined && (
                                        <span className="ged-chip" style={{ color: '#16a34a', borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }}>
                                            <i className="fa fa-receipt"></i> Parking Fee: ₹{Number(entry.parking_fee || 0).toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {vehiclesList.length > 0 ? (
                                <div className="ged-list">
                                    {vehiclesList.map((v, idx) => {
                                        const vNum = (v.vehicle_number || '').trim().toUpperCase();
                                        const vehExitLog = vehicleExitStatusMap[vNum];
                                        const isVehExited = isExited || !!vehExitLog;
                                        return (
                                            <div 
                                                key={v.id || idx} 
                                                className={`ged-vehicle ${isVehExited ? 'is-exited' : ''}`}
                                                style={isVehExited ? { opacity: 0.85, background: 'rgba(241, 245, 249, 0.6)', borderColor: '#cbd5e1' } : {}}
                                            >
                                                {v.vehicle_photo ? (
                                                    <img
                                                        src={getFullImageUrl(v.vehicle_photo)}
                                                        alt={v.vehicle_number}
                                                        onClick={() => setPreviewPhoto({ url: getFullImageUrl(v.vehicle_photo), title: v.vehicle_number })}
                                                    />
                                                ) : (
                                                    <span className="ged-vehicle-ph" style={isVehExited ? { background: '#e2e8f0', color: '#64748b' } : {}}>
                                                        <i className="fa fa-car"></i>
                                                    </span>
                                                )}
                                                <div className="ged-vehicle-txt">
                                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                                        <strong className="ged-plate" style={isVehExited ? { textDecoration: 'line-through', color: '#64748b' } : {}}>
                                                            {v.vehicle_number}
                                                        </strong>
                                                        {isVehExited ? (
                                                            <span className="badge bg-danger-subtle text-danger border border-danger-subtle" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px' }}>
                                                                <i className="fa fa-arrow-right-from-bracket me-1"></i> Exited
                                                            </span>
                                                        ) : (
                                                            <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px' }}>
                                                                <i className="fa fa-circle text-success me-1" style={{ fontSize: '7px' }}></i> Inside Campus
                                                            </span>
                                                        )}
                                                    </div>
                                                    <small className="d-block mt-0.5">
                                                        Driver: {v.driver_name || entry.driver || 'Visitor / self'}
                                                    </small>
                                                    {vehExitLog ? (
                                                        <>
                                                            <small className="d-block text-muted" style={{ fontSize: '11.5px' }}>
                                                                Departed {formatExactDateTime(vehExitLog.timestamp)} {vehExitLog.exit_gate ? `via ${vehExitLog.exit_gate}` : ''}
                                                            </small>
                                                            {vehExitLog.notes && (
                                                                <small className="d-block text-muted fst-italic" style={{ fontSize: '11px' }}>
                                                                    "{vehExitLog.notes}"
                                                                </small>
                                                            )}
                                                        </>
                                                    ) : (isExited ? (
                                                        <small className="d-block text-muted" style={{ fontSize: '11.5px' }}>
                                                            Departed on full checkout ({formatExactDateTime(entry.exit_time)}) {entry.exit_gate_name ? `via ${entry.exit_gate_name}` : ''}
                                                        </small>
                                                    ) : (
                                                        <small className="d-block text-muted" style={{ fontSize: '11.5px' }}>
                                                            Currently parked on campus grounds
                                                        </small>
                                                    ))}
                                                </div>
                                                <span className="ged-chip">Vehicle #{idx + 1}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="ged-empty">Pedestrian visitor. No vehicles registered.</p>
                            )}
                        </section>

                        {entry.equipment_details && entry.equipment_details.length > 0 && (() => {
                            const totalTools = entry.equipment_details.length;
                            const exitedToolsCount = entry.equipment_details.filter(eq => {
                                const eqId = String(eq.id || eq.value || '');
                                const eqName = (eq.name || '').trim().toLowerCase();
                                return isExited || !!equipmentExitStatusMap[eqId] || !!equipmentExitStatusMap[eqName];
                            }).length;
                            const allToolsExited = exitedToolsCount === totalTools;
                            const someToolsExited = exitedToolsCount > 0 && exitedToolsCount < totalTools;

                            return (
                                <section className="ged-card">
                                    <div className="ged-h-row">
                                        <h2 className="ged-h">Carried tools and equipment ({totalTools})</h2>
                                        {allToolsExited ? (
                                            <span className="ged-chip" style={{ color: '#dc2626', borderColor: '#fca5a5', backgroundColor: '#fef2f2' }}>
                                                <i className="fa fa-arrow-right-from-bracket me-1"></i> All Departed ({exitedToolsCount}/{totalTools})
                                            </span>
                                        ) : someToolsExited ? (
                                            <span className="ged-chip" style={{ color: '#d97706', borderColor: '#fde68a', backgroundColor: '#fffbeb' }}>
                                                <i className="fa fa-tools me-1"></i> Partial Inside ({totalTools - exitedToolsCount} inside)
                                            </span>
                                        ) : (
                                            <span className="ged-chip" style={{ color: '#16a34a', borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }}>
                                                <i className="fa fa-warehouse me-1"></i> Inside Campus ({totalTools})
                                            </span>
                                        )}
                                    </div>
                                    <div className="ged-list">
                                        {entry.equipment_details.map((eq, idx) => {
                                            const eqId = String(eq.id || eq.value || '');
                                            const eqName = (eq.name || '').trim().toLowerCase();
                                            const eqExitLog = equipmentExitStatusMap[eqId] || (eqName ? equipmentExitStatusMap[eqName] : null);
                                            const isEqExited = isExited || !!eqExitLog;

                                            return (
                                                <div 
                                                    key={eq.id || idx} 
                                                    className={`ged-vehicle ${isEqExited ? 'is-exited' : ''}`}
                                                    style={isEqExited ? { opacity: 0.85, background: 'rgba(241, 245, 249, 0.6)', borderColor: '#cbd5e1' } : {}}
                                                >
                                                    {eq.image ? (
                                                        <img
                                                            src={getFullImageUrl(eq.image)}
                                                            alt={eq.name}
                                                            onClick={() => setPreviewPhoto({ url: getFullImageUrl(eq.image), title: eq.name })}
                                                            style={{ cursor: 'pointer' }}
                                                        />
                                                    ) : (
                                                        <span className="ged-vehicle-ph" style={isEqExited ? { background: '#e2e8f0', color: '#64748b' } : { background: '#e8fdf4', color: '#16a34a' }}>
                                                            <i className="fa fa-wrench"></i>
                                                        </span>
                                                    )}
                                                    <div className="ged-vehicle-txt">
                                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                                            <strong style={isEqExited ? { fontSize: '13px', textDecoration: 'line-through', color: '#64748b' } : { fontSize: '13px', color: '#1b2430' }}>
                                                                {eq.name}
                                                            </strong>
                                                            {isEqExited ? (
                                                                <span className="badge bg-danger-subtle text-danger border border-danger-subtle" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px' }}>
                                                                    <i className="fa fa-arrow-right-from-bracket me-1"></i> Exited
                                                                </span>
                                                            ) : (
                                                                <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px' }}>
                                                                    <i className="fa fa-circle text-success me-1" style={{ fontSize: '7px' }}></i> Inside Campus
                                                                </span>
                                                            )}
                                                        </div>
                                                        {eq.description && (
                                                            <small className="d-block text-muted mt-0.5">
                                                                {eq.description}
                                                            </small>
                                                        )}
                                                        {eqExitLog ? (
                                                            <>
                                                                <small className="d-block text-muted" style={{ fontSize: '11.5px' }}>
                                                                    Departed {formatExactDateTime(eqExitLog.timestamp)} {eqExitLog.exit_gate ? `via ${eqExitLog.exit_gate}` : ''}
                                                                </small>
                                                                {eqExitLog.notes && (
                                                                    <small className="d-block text-muted fst-italic" style={{ fontSize: '11px' }}>
                                                                        "{eqExitLog.notes}"
                                                                    </small>
                                                                )}
                                                            </>
                                                        ) : (isExited ? (
                                                            <small className="d-block text-muted" style={{ fontSize: '11.5px' }}>
                                                                Departed on full checkout ({formatExactDateTime(entry.exit_time)}) {entry.exit_gate_name ? `via ${entry.exit_gate_name}` : ''}
                                                            </small>
                                                        ) : (
                                                            <small className="d-block text-muted" style={{ fontSize: '11.5px' }}>
                                                                Currently logged inside campus
                                                            </small>
                                                        ))}
                                                    </div>
                                                    <span className="ged-chip">Tool #{idx + 1}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        })()}

                        {hasDocs && (
                            <section className="ged-card">
                                <h2 className="ged-h">Documents and photos</h2>
                                <div className="ged-docs">
                                    {entry.id_card_photo && (
                                        <button onClick={() => setPreviewPhoto({ url: getFullImageUrl(entry.id_card_photo), title: 'ID Card' })}>
                                            <Image src={getFullImageUrl(entry.id_card_photo)} alt="ID" /><span>ID card</span>
                                        </button>
                                    )}
                                    {entry.visiting_card_photo && (
                                        <button onClick={() => setPreviewPhoto({ url: getFullImageUrl(entry.visiting_card_photo), title: 'Visiting Card' })}>
                                            <Image src={getFullImageUrl(entry.visiting_card_photo)} alt="Visiting Card" /><span>Visiting card</span>
                                        </button>
                                    )}
                                    {entry.delivery_note_photo && (
                                        <button onClick={() => setPreviewPhoto({ url: getFullImageUrl(entry.delivery_note_photo), title: `Delivery Note ${entry.delivery_note_number ? '#' + entry.delivery_note_number : ''}` })}>
                                            <Image src={getFullImageUrl(entry.delivery_note_photo)} alt="Delivery Note" /><span>Delivery Note {entry.delivery_note_number ? `#${entry.delivery_note_number}` : ''}</span>
                                        </button>
                                    )}
                                    {docList.map((doc, idx) => (
                                        <button key={doc.id || idx} onClick={() => setPreviewPhoto({ url: getFullImageUrl(doc.document_photo), title: doc.document_name || `Doc #${idx + 1}` })}>
                                            <Image src={getFullImageUrl(doc.document_photo)} alt={doc.document_name || 'Doc'} /><span>{doc.document_name || `Doc ${idx + 1}`}</span>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}

                        {(entry.material_details || entry.address) && (
                            <section className="ged-card">
                                <dl className="ged-dl">
                                    {entry.material_details && (<><dt>Material / cargo</dt><dd>{entry.material_details}</dd></>)}
                                    {entry.address && (<><dt>Address</dt><dd>{entry.address}</dd></>)}
                                </dl>
                            </section>
                        )}
                    </Col>
                </Row>
            </div>

            {/* ── HOST MOVEMENT COMPLETION MODAL ── */}
            <Modal
                show={showCompleteModal}
                onHide={() => setShowCompleteModal(false)}
                centered
            >
                <Modal.Header closeButton className="py-3">
                    <Modal.Title className="fs-16 fw-bold d-flex align-items-center gap-2">
                        <i className="fa fa-circle-check text-success"></i> Complete Campus Movement
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    <p className="text-muted fs-14 mb-3">
                        Confirm that the meeting or operations with <strong>{displayName}</strong> have concluded. Once completed, the visitor will be released to return to the security gate for checkout.
                    </p>

                    <Form.Group className="mb-3">
                        <Form.Label className="fw-semibold small">Host Remarks / Notes (Optional)</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            placeholder="e.g. Meeting finished, materials unloaded in Bay 3, visitor heading to gate."
                            value={completeNotes}
                            onChange={(e) => setCompleteNotes(e.target.value)}
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer className="py-2">
                    <Button variant="secondary" size="sm" onClick={() => setShowCompleteModal(false)} disabled={completeSubmitting}>
                        Cancel
                    </Button>
                    <Button variant="success" size="sm" onClick={handleConfirmCompleteMovement} disabled={completeSubmitting}>
                        {completeSubmitting ? (
                            <>
                                <Spinner animation="border" size="sm" className="me-1" />
                                Confirming...
                            </>
                        ) : (
                            <>
                                <i className="fa fa-check me-1"></i> Confirm & Release for Exit
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* ── REALLOCATE HOST MODAL ── */}
            <Modal
                show={showReallocModal}
                onHide={() => setShowReallocModal(false)}
                centered
            >
                <Modal.Header closeButton className="py-3">
                    <Modal.Title className="fs-16 fw-bold d-flex align-items-center gap-2">
                        <i className="fa fa-people-arrows text-primary"></i> Reallocate / Transfer Host Official
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleConfirmReallocation}>
                    <Modal.Body className="p-4">
                        <p className="text-muted small mb-3">
                            Current Host: <strong>{entry.employee_name || 'Unassigned'}</strong> ({entry.department_name || 'General'}). Select the employee to take over the visitor.
                        </p>

                        <Form.Group className="mb-3">
                            <Form.Label className="fw-semibold small">Filter by Department (Optional)</Form.Label>
                            <Form.Select 
                                value={reallocDepartment} 
                                onChange={(e) => {
                                    setReallocDepartment(e.target.value);
                                    setReallocEmployee('');
                                }}
                            >
                                <option value="">-- All Departments --</option>
                                {departments.map(dept => (
                                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="fw-semibold small">New Host Employee <span className="text-danger">*</span></Form.Label>
                            <Form.Select 
                                value={reallocEmployee} 
                                onChange={(e) => setReallocEmployee(e.target.value)}
                                required
                            >
                                <option value="">-- Select Employee --</option>
                                {filteredEmployeesForRealloc.map(emp => {
                                    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.username;
                                    const dept = emp.department_name || emp.department?.name || 'Staff';
                                    return (
                                        <option key={emp.id} value={emp.id}>{fullName} ({dept})</option>
                                    );
                                })}
                            </Form.Select>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="fw-semibold small">Reason for Handover <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                placeholder="e.g. Transferred for technical discussion with IT supervisor."
                                value={reallocReason}
                                onChange={(e) => setReallocReason(e.target.value)}
                                required
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer className="py-2">
                        <Button variant="secondary" size="sm" onClick={() => setShowReallocModal(false)} disabled={reallocSubmitting}>
                            Cancel
                        </Button>
                        <Button variant="primary" size="sm" type="submit" disabled={reallocSubmitting}>
                            {reallocSubmitting ? (
                                <>
                                    <Spinner animation="border" size="sm" className="me-1" />
                                    Reallocating...
                                </>
                            ) : (
                                <>
                                    <i className="fa fa-check me-1"></i> Confirm Transfer
                                </>
                            )}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* ── PHOTO LIGHTBOX MODAL ── */}
            <Modal 
                show={!!previewPhoto} 
                onHide={() => setPreviewPhoto(null)} 
                centered 
                size="md"
            >
                <Modal.Header closeButton className="py-2">
                    <Modal.Title className="fs-15 fw-bold">{previewPhoto?.title || 'Preview Image'}</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-0 text-center bg-black d-flex align-items-center justify-content-center" style={{ minHeight: '300px' }}>
                    {previewPhoto?.url && (
                        <Image 
                            src={previewPhoto.url} 
                            alt={previewPhoto.title} 
                            style={{ maxHeight: '72vh', maxWidth: '100%', objectFit: 'contain' }} 
                        />
                    )}
                </Modal.Body>
                <Modal.Footer className="py-1 px-3 d-flex justify-content-between">
                    <small className="text-muted">{previewPhoto?.title}</small>
                    <Button variant="outline-primary" size="sm" onClick={() => window.open(previewPhoto?.url, '_blank')}>
                        <i className="fa fa-external-link-alt me-1"></i> Open Full Resolution
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* ── CHECKOUT POPUP MODAL ── */}
            <CheckoutModal
                show={showCheckoutModal}
                onHide={() => setShowCheckoutModal(false)}
                entry={entry}
                activeTab={isVehicleMode ? 'vehicles' : 'visitors'}
                onSuccess={fetchEntryDetails}
            />

            {/* ── STYLESHEET (SCREEN & PRINT) ── */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .ged { font-size:15px; --ink:#1b2430; --mute:#66727f; --line:#e6eaf0; --soft:#f3f5f9; --brand:#0a500f; --brand-ink:#0f9d63; --primary:#0a500f; --warn:#d97706; --bad:#dc2626; --info:#0284c7; color: var(--ink); }
                .ged * { box-sizing: border-box; }
                .ged button { font-family: inherit; }
                .ged-top { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
                .ged-back { background:none; border:0; padding:0; color:var(--mute); font-size:14.5px; font-weight:600; display:inline-flex; gap:8px; align-items:center; }
                .ged-back:hover { color: var(--primary); }
                .ged-actions, .ged-alert-actions, .ged-inline-actions { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
                .ged-inline-actions { margin-top:10px; }
                .ged-btn { height:36px; font-size:14px; font-weight:600; border-radius:10px; display:inline-flex; align-items:center; gap:8px; }
                .ged-btn.btn-light { background:#fff; border:1px solid var(--line); color:var(--ink); }
                .ged-btn-primary, .ged-btn-primary:disabled { background:var(--primary); border-color:var(--primary); color:#fff; padding:0 20px; }
                .ged-btn-primary:disabled { background:#eceef3; border-color:#e0e4ea; color:#8a94a0; cursor:not-allowed; opacity:1; }
                .ged-card { background:#fff; border:1px solid var(--line); border-radius:14px; padding:18px 20px; margin-bottom:16px; }
                .ged-h { font-size:15.5px; font-weight:700; margin:0 0 12px; color:var(--ink); }
                .ged-h-row { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:12px; }
                .ged-h-row .ged-h { margin:0; }
                .ged-hero { padding:22px 24px 20px; border-radius:18px; }
                .ged-hero-main { display:flex; gap:20px; align-items:center; flex-wrap:wrap; }
                .ged-photo { width:84px; height:84px; border-radius:20px; overflow:hidden; flex-shrink:0; border:3px solid var(--brand); background:var(--soft); display:grid; place-items:center; cursor:pointer; font-size:32px; color:var(--mute); }
                .ged-photo img { width:100%; height:100%; object-fit:cover; }
                .ged-hero-body { flex:1; min-width:240px; }
                .ged-title-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
                .ged-name { font-size:28px; font-weight:700; margin:0; line-height:1.2; color:#0f172a; }
                .ged-pill { display:inline-flex; align-items:center; gap:6px; padding:3px 11px; border-radius:999px; font-size:13.5px; font-weight:600; border:1px solid transparent; }
                .ged-dot { width:7px; height:7px; border-radius:50%; }
                .ged-tone-ok { background:#e8fbf2; color:#0b7a4c; border-color:#b8efd5; }
                .ged-tone-info { background:#e6f4fb; color:#0369a1; border-color:#bde3f5; }
                .ged-tone-warn { background:#fef4dc; color:#a05a04; border-color:#f7dc9c; }
                .ged-tone-bad { background:#fdeceb; color:#b42318; border-color:#f6c4c0; }
                .ged-tone-mute { background:#f1f3f7; color:#4b5665; border-color:#e0e4ea; }
                .ged-meta { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:10px; }
                .ged-id { font-size:14.5px; color:var(--mute); font-weight:600; margin-right:6px; }
                .ged-id button, .ged-chip button { background:none; border:0; padding:0 0 0 6px; color:var(--mute); font-size:13px; }
                .ged-chip { display:inline-flex; align-items:center; gap:7px; padding:5px 11px; border:1px solid var(--line); border-radius:8px; font-size:13.5px; font-weight:500; color:#3d4855; background:#fff; }
                .ged-chip a { color:inherit; text-decoration:none; }
                .ged-chip-strong { background:#f1effa; border-color:#dcd8f0; color:#4d4390; font-weight:700; }
                .ged-idproof { border:1px solid var(--line); background:#fff; border-radius:12px; padding:6px; display:flex; flex-direction:column; align-items:center; gap:4px; }
                .ged-idproof img { width:84px; height:52px; object-fit:cover; border-radius:8px; }
                .ged-idproof span { font-size:12.5px; color:var(--mute); font-weight:600; }
                .ged-steps { list-style:none; margin:22px 0 0; padding:18px 0 0; border-top:1px solid var(--line); display:flex; gap:0; }
                .ged-step { flex:1; display:flex; align-items:center; gap:10px; position:relative; min-width:0; }
                .ged-step:not(:last-child)::after { content:""; flex:1; height:2px; margin:0 14px; background:var(--line); }
                .ged-step.is-done:not(:last-child)::after { background:var(--brand); }
                .ged-step-dot { width:26px; height:26px; border-radius:50%; flex-shrink:0; display:grid; place-items:center; font-size:13.5px; font-weight:700; background:var(--soft); color:var(--mute); border:2px solid var(--line); }
                .ged-step.is-done .ged-step-dot { background:var(--brand); border-color:var(--brand); color:#fff; }
                .ged-step.is-current .ged-step-dot { background:#fff; border-color:var(--warn); color:var(--warn); }
                .ged-step-text { display:flex; flex-direction:column; line-height:1.25; white-space:nowrap; }
                .ged-step-text strong { font-size:14.5px; }
                .ged-step-text small { font-size:13.5px; color:var(--mute); }
                .ged-stats { display:grid; grid-template-columns:repeat(4,1fr); padding:0; overflow:hidden; }
                .ged-stat { padding:16px 20px; display:flex; flex-direction:column; gap:3px; border-right:1px solid var(--line); min-width:0; }
                .ged-stat:last-child { border-right:0; }
                .ged-lbl { font-size:13.5px; color:var(--mute); display:flex; gap:7px; align-items:center; }
                .ged-stat strong { font-size:17.5px; line-height:1.3; }
                .ged-stat small { font-size:13.5px; color:var(--mute); }
                .ged-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:15px !important; }
                .ged-tl { list-style:none; margin:0; padding:0; position:relative; }
                .ged-tl::before { content:""; position:absolute; left:8px; top:6px; bottom:6px; width:2px; background:var(--line); }
                .ged-tl-item { position:relative; padding:0 0 22px 32px; --c:var(--brand); }
                .ged-tl-item:last-child { padding-bottom:0; }
                .ged-tl-item.is-bad { --c:var(--bad); } .ged-tl-item.is-warn { --c:var(--warn); } .ged-tl-item.is-info { --c:var(--primary); } .ged-tl-item.is-reentry { --c:#0284c7; }
                .ged-tl-item.is-mute, .ged-tl-item.is-todo { --c:#b6bfca; } .ged-tl-item.is-done { --c:var(--ink); }
                .ged-tl-mark { position:absolute; left:3px; top:6px; width:12px; height:12px; border-radius:50%; background:var(--c); border:2px solid #fff; box-shadow:0 0 0 1.5px var(--c); }
                .ged-tl-item.is-todo .ged-tl-mark { background:#fff; }
                .ged-tl-head { display:flex; justify-content:space-between; align-items:baseline; gap:8px; flex-wrap:wrap; }
                .ged-tl-head h3 { font-size:16px; font-weight:700; margin:0; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
                .ged-tl-head time { font-size:13.5px; color:var(--mute); font-variant-numeric:tabular-nums; }
                .ged-tl-item p { margin:4px 0 0; font-size:14.5px; color:var(--mute); line-height:1.55; }
                .ged-tl-item p strong { color:var(--ink); }
                .ged-flow { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:8px; font-size:13px; color:var(--mute); }
                .ged-note { display:flex; gap:8px; margin-top:8px; padding:9px 12px; border-radius:10px; font-size:14px; background:var(--soft); color:#4b5665; }
                .ged-note.is-bad { background:#fdeceb; color:#b42318; }
                .ged-note.is-quote { font-style:italic; }
                .ged-alert { display:flex; gap:14px; align-items:center; flex-wrap:wrap; padding:14px 18px; margin-bottom:16px; border-radius:14px; background:#fff8e1; border:1px solid #f6d774; color:#7a4b06; font-size:14.5px; }
                .ged-alert-icon { width:40px; height:40px; border-radius:50%; background:#eab308; color:#fff; display:grid; place-items:center; flex-shrink:0; }
                .ged-alert-body { flex:1; min-width:240px; }
                .ged-alert-title { font-weight:700; font-size:15.5px; }
                .ged-alert-hint { font-size:13.5px; opacity:.85; margin-top:2px; }
                .ged-dl { display:grid; grid-template-columns:auto 1fr; gap:11px 18px; margin:0; font-size:14.5px; }
                .ged-dl dt { color:var(--mute); font-weight:500; }
                .ged-dl dd { margin:0; text-align:right; font-weight:600; }
                .ged-sub-link { display:block; font-size:13.5px; color:var(--mute); font-weight:500; text-decoration:none; }
                .ged-body { margin:0; font-size:15px; line-height:1.55; }
                .ged-empty { margin:0; font-size:14px; color:var(--mute); font-style:italic; }
                .ged-list { display:flex; flex-direction:column; gap:10px; }
                .ged-vehicle { display:flex; align-items:center; gap:12px; padding:10px 12px; border:1px solid var(--line); border-radius:12px; }
                .ged-vehicle img, .ged-vehicle-ph { width:56px; height:40px; border-radius:8px; object-fit:cover; cursor:pointer; flex-shrink:0; }
                .ged-vehicle-ph { display:grid; place-items:center; background:var(--soft); color:var(--mute); cursor:default; }
                .ged-vehicle-txt { flex:1; display:flex; flex-direction:column; min-width:0; }
                .ged-vehicle-txt small { color:var(--mute); font-size:13.5px; }
                .ged-plate { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing:.5px; color:var(--info); font-size:15.5px; }
                .ged-docs { display:flex; gap:10px; flex-wrap:wrap; }
                .ged-docs button { border:1px solid var(--line); background:#fff; border-radius:10px; padding:5px; display:flex; flex-direction:column; align-items:center; gap:4px; }
                .ged-docs img { width:72px; height:54px; object-fit:cover; border-radius:6px; }
                .ged-docs span { font-size:12.5px; color:var(--mute); max-width:72px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .ged .main-content-row > .detail-col-left, .ged .main-content-row > .detail-col-right { display:flex; flex-direction:column; }
                .ged .detail-col-left > .ged-card { flex:1; margin-bottom:0; }
                .ged .detail-col-right > .ged-card:last-child { flex:1; margin-bottom:0; }
                @media (max-width: 991px) { .ged-stats { grid-template-columns:repeat(2,1fr); } .ged-stat:nth-child(2) { border-right:0; } .ged-stat:nth-child(-n+2) { border-bottom:1px solid var(--line); } }
                @media (max-width: 575px) { .ged-step-text small { display:none; } .ged-step:not(:last-child)::after { margin:0 6px; } .ged-name { font-size:24px; } }
                .hover-primary:hover {
                    color: var(--primary, #0a500f) !important;
                    cursor: pointer;
                }
                .shadow-xs {
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                .kpi-card {
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .kpi-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.06);
                }

                @media screen {
                    .print-only {
                        display: none !important;
                    }
                }

                /* ── PRINT MEDIA RULES ── */
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 8mm 10mm;
                    }

                    .no-print,
                    header,
                    nav,
                    .dlabnav,
                    .deznav,
                    .header,
                    .nav-header,
                    .chatbox,
                    .footer,
                    button {
                        display: none !important;
                    }

                    .print-only {
                        display: block !important;
                    }

                    html, body {
                        background: #ffffff !important;
                        color: #0f172a !important;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                        font-size: 9pt !important;
                        line-height: 1.35 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .gate-entry-detail-container {
                        padding: 0 !important;
                        margin: 0 !important;
                        background: #ffffff !important;
                        color: #0f172a !important;
                        min-height: auto !important;
                        width: 100% !important;
                    }

                    .gate-pass-printable {
                        width: 100% !important;
                        box-sizing: border-box !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }

                    .gate-pass-card {
                        border: 2px solid #1e293b !important;
                        border-radius: 8px !important;
                        padding: 14px 18px !important;
                        background: #ffffff !important;
                        box-sizing: border-box !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }

                    .pass-header {
                        border-bottom: 2px solid #0f172a !important;
                        padding-bottom: 8px !important;
                        margin-bottom: 10px !important;
                    }

                    .pass-brand-title {
                        font-size: 16pt !important;
                        font-weight: 800 !important;
                        color: #0f172a !important;
                        letter-spacing: 1.5px !important;
                        line-height: 1.1 !important;
                        display: block !important;
                    }

                    .pass-brand-sub {
                        font-size: 7.5pt !important;
                        font-weight: 600 !important;
                        color: #64748b !important;
                        letter-spacing: 0.8px !important;
                        text-transform: uppercase !important;
                        display: block !important;
                        margin-top: 2px !important;
                    }

                    .pass-type-pill {
                        display: inline-block !important;
                        background: #0f172a !important;
                        color: #ffffff !important;
                        font-size: 9.5pt !important;
                        font-weight: 700 !important;
                        padding: 4px 12px !important;
                        border-radius: 4px !important;
                        letter-spacing: 1px !important;
                        text-transform: uppercase !important;
                        text-align: center !important;
                    }

                    .pass-id-num {
                        font-size: 15pt !important;
                        font-weight: 800 !important;
                        color: #0f172a !important;
                        font-family: monospace !important;
                        line-height: 1.1 !important;
                    }

                    .pass-issue-date {
                        font-size: 7.5pt !important;
                        color: #64748b !important;
                        margin-top: 2px !important;
                    }

                    .pass-meta-strip {
                        display: flex !important;
                        justify-content: space-between !important;
                        align-items: center !important;
                        background: #f1f5f9 !important;
                        border: 1px solid #cbd5e1 !important;
                        border-radius: 6px !important;
                        padding: 5px 12px !important;
                        margin-bottom: 10px !important;
                    }

                    .meta-strip-item {
                        display: flex !important;
                        flex-direction: column !important;
                    }

                    .meta-strip-label {
                        font-size: 6.5pt !important;
                        font-weight: 700 !important;
                        color: #64748b !important;
                        letter-spacing: 0.5px !important;
                        text-transform: uppercase !important;
                    }

                    .meta-strip-val {
                        font-size: 9.5pt !important;
                        font-weight: 700 !important;
                        color: #0f172a !important;
                    }

                    .pass-grid {
                        display: flex !important;
                        gap: 12px !important;
                        margin-bottom: 10px !important;
                    }

                    .pass-box {
                        flex: 1 !important;
                        border: 1px solid #cbd5e1 !important;
                        border-radius: 6px !important;
                        overflow: hidden !important;
                        background: #ffffff !important;
                    }

                    .pass-box-title {
                        background: #f8fafc !important;
                        border-bottom: 1px solid #e2e8f0 !important;
                        padding: 4px 10px !important;
                        font-size: 7.5pt !important;
                        font-weight: 700 !important;
                        color: #334155 !important;
                        letter-spacing: 0.5px !important;
                        text-transform: uppercase !important;
                    }

                    .pass-box-content {
                        padding: 8px 10px !important;
                    }

                    .pass-photo-frame {
                        width: 78px !important;
                        height: 78px !important;
                        border: 1px solid #cbd5e1 !important;
                        border-radius: 6px !important;
                        overflow: hidden !important;
                        flex-shrink: 0 !important;
                        background: #f8fafc !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                    }

                    .pass-photo {
                        width: 100% !important;
                        height: 100% !important;
                        object-fit: cover !important;
                    }

                    .pass-photo-placeholder {
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        width: 100% !important;
                        height: 100% !important;
                    }

                    .pass-data-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        font-size: 8.5pt !important;
                    }

                    .pass-data-table td {
                        padding: 2px 0 !important;
                        vertical-align: top !important;
                    }

                    .data-lbl {
                        color: #64748b !important;
                        width: 33% !important;
                        font-weight: 500 !important;
                    }

                    .data-val {
                        color: #0f172a !important;
                    }

                    .pass-purpose-box {
                        margin-bottom: 10px !important;
                    }

                    .pass-purpose-text {
                        font-size: 8.5pt !important;
                        color: #1e293b !important;
                        font-weight: 500 !important;
                        line-height: 1.3 !important;
                    }

                    .pass-vehicle-badge {
                        display: inline-block !important;
                        background: #f1f5f9 !important;
                        border: 1px solid #cbd5e1 !important;
                        padding: 2px 8px !important;
                        border-radius: 4px !important;
                        font-size: 8pt !important;
                        margin-bottom: 2px !important;
                    }

                    .pass-guidelines {
                        background: #f8fafc !important;
                        border: 1px dashed #cbd5e1 !important;
                        border-radius: 6px !important;
                        padding: 6px 10px !important;
                        margin-bottom: 10px !important;
                    }

                    .guidelines-title {
                        font-size: 7pt !important;
                        font-weight: 700 !important;
                        color: #475569 !important;
                        letter-spacing: 0.5px !important;
                        margin-bottom: 3px !important;
                    }

                    .guidelines-list {
                        display: grid !important;
                        grid-template-columns: 1fr 1fr !important;
                        gap: 2px 10px !important;
                        font-size: 7.2pt !important;
                        color: #64748b !important;
                        line-height: 1.25 !important;
                    }

                    .pass-signatures {
                        display: flex !important;
                        justify-content: space-between !important;
                        gap: 16px !important;
                        margin-top: 10px !important;
                        padding-top: 4px !important;
                    }

                    .signature-col {
                        flex: 1 !important;
                        text-align: center !important;
                    }

                    .signature-line {
                        border-top: 1px solid #475569 !important;
                        margin-bottom: 4px !important;
                        height: 25px !important;
                    }

                    .signature-title {
                        font-size: 7.5pt !important;
                        font-weight: 700 !important;
                        color: #0f172a !important;
                    }

                    .signature-sub {
                        font-size: 6.5pt !important;
                        color: #64748b !important;
                    }

                    .pass-footer {
                        display: flex !important;
                        justify-content: space-between !important;
                        align-items: center !important;
                        border-top: 1px solid #e2e8f0 !important;
                        padding-top: 5px !important;
                        margin-top: 8px !important;
                        font-size: 6.8pt !important;
                        color: #94a3b8 !important;
                    }
                }
                `
            }} />
        </div>
    );
};

export default GateEntryDetail;