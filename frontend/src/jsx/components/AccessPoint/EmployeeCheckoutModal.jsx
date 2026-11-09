import React, { useState, useEffect } from 'react';
import { Modal, Form, Spinner } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { getGates, checkoutEmployeeGateEntry } from '../../../services/GateManagementService';

const getFullImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const baseUrl = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000').replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    return `${baseUrl}/${cleanPath}`;
};

const EmployeeCheckoutModal = ({
    show,
    onHide,
    entry,
    onSuccess
}) => {
    const [isDark, setIsDark] = useState(false);
    const [gates, setGates] = useState([]);
    const [selectedGateId, setSelectedGateId] = useState('');
    const [exitMode, setExitMode] = useState('employee_only'); // 'employee_only' | 'with_vehicle'
    const [remarks, setRemarks] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [imgError, setImgError] = useState(false);

    // Dark mode observer
    useEffect(() => {
        const checkDarkMode = () => {
            setIsDark(document.body.getAttribute('data-theme-version') === 'dark');
        };
        checkDarkMode();
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme-version'] });
        return () => observer.disconnect();
    }, []);

    // Load available gates
    useEffect(() => {
        let isMounted = true;
        getGates()
            .then(data => {
                if (isMounted && Array.isArray(data)) {
                    setGates(data);
                }
            })
            .catch(err => {
                console.error('Failed to load gates in EmployeeCheckoutModal:', err);
            });
        return () => { isMounted = false; };
    }, []);

    // Sync state when entry opens
    useEffect(() => {
        if (entry && show) {
            setExitMode('employee_only');
            setRemarks('');
            setImgError(false);
            setSelectedGateId(entry.entry_gate || (gates.length > 0 ? gates[0].id : ''));
        }
    }, [entry, show, gates]);

    if (!entry) return null;

    const hasVehicle = Boolean(entry.vehicle_number || entry.vehicle || entry.vehicle_entry);
    const vehicleNumber = entry.vehicle_number || (entry.vehicle?.vehicle_number) || 'Vehicle';
    const parkingSlotInfo = entry.parking_slot_number 
        ? `Slot #${entry.parking_slot_number}`
        : (entry.park_area_name || null);

    const handleSubmitCheckout = async (e) => {
        if (e) e.preventDefault();
        if (!entry?.id) return;

        try {
            setIsSubmitting(true);
            const isEmployeeOnly = !hasVehicle || exitMode === 'employee_only';
            const payload = {
                employee_only: isEmployeeOnly,
                exit_mode: isEmployeeOnly ? 'employee_only' : 'with_vehicle',
                include_vehicle: !isEmployeeOnly,
                gate_id: selectedGateId ? parseInt(selectedGateId, 10) : undefined,
                remarks: remarks.trim() || undefined
            };

            const response = await checkoutEmployeeGateEntry(entry.id, payload);
            const updated = response?.entry || entry;

            // Audio notification
            try {
                const audio = new Audio('/audio/checkout.mp3');
                audio.play().catch(() => {});
            } catch {}

            Swal.fire({
                icon: 'success',
                title: isEmployeeOnly && hasVehicle ? '🚶‍♂️ Employee Only Exit Recorded' : '🔵 Employee Checked OUT',
                html: `
                    <div style="text-align: center; padding: 4px 0;">
                        <h5 style="margin: 0 0 6px 0; font-weight: 700; color: #2ece8a;">
                            ${updated.employee_name || entry.employee_name || 'Employee'}
                        </h5>
                        <div style="font-size: 13px; color: #64748b; margin-bottom: 8px;">
                            ID: <strong>${updated.employment_no || entry.employment_no}</strong> &bull; ${updated.department_name || entry.department_name || 'Staff'}
                        </div>
                        ${hasVehicle ? (
                            isEmployeeOnly ? `
                                <div style="display: inline-flex; align-items: center; gap: 6px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 5px 12px; font-size: 12px; color: #065f46; margin-bottom: 8px;">
                                    <i class="fa fa-parking text-success"></i> Vehicle <strong>${vehicleNumber}</strong> remains parked inside campus (${parkingSlotInfo || 'Employee Park Area'})
                                </div>
                            ` : `
                                <div style="display: inline-flex; align-items: center; gap: 6px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 5px 12px; font-size: 12px; color: #1e40af; margin-bottom: 8px;">
                                    <i class="fa fa-car text-primary"></i> Vehicle <strong>${vehicleNumber}</strong> checked out & slot released
                                </div>
                            `
                        ) : ''}
                        ${updated.stay_duration ? `
                            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                                ⏱️ Stay Duration: <strong>${updated.stay_duration}</strong>
                            </div>
                        ` : ''}
                    </div>
                `,
                confirmButtonColor: '#2ece8a',
                confirmButtonText: 'OK',
                timer: 2600
            });

            onHide();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Failed to checkout employee:', error);
            const errorMsg = error?.response?.data?.error || error?.response?.data?.detail || error?.message || 'Failed to complete employee checkout.';
            Swal.fire({
                icon: 'error',
                title: 'Checkout Failed',
                text: typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg),
                confirmButtonColor: '#7A70BA'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getInitials = (name) => {
        if (!name) return 'EMP';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    return (
        <Modal
            show={show}
            onHide={() => !isSubmitting && onHide()}
            centered
            backdrop="static"
            keyboard={!isSubmitting}
            className="pkg-modal-fines"
            contentClassName="border-0 shadow-lg"
            dialogClassName="employee-checkout-modal-dialog"
            style={{ zIndex: 1060 }}
        >
            <div
                style={{
                    backgroundColor: isDark ? '#1e1e2d' : '#ffffff',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    color: isDark ? '#f8fafc' : '#0f172a'
                }}
            >
                {/* ── Modal Header ── */}
                <div
                    style={{
                        padding: '20px 28px 18px 28px',
                        borderBottom: `1px solid ${isDark ? '#2d2d3f' : '#f1f5f9'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isDark ? '#1e1e2d' : '#ffffff'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div
                            style={{
                                width: '46px',
                                height: '46px',
                                borderRadius: '50%',
                                backgroundColor: isDark ? 'rgba(46, 206, 138, 0.18)' : '#ecfdf5',
                                border: '1.5px solid rgba(46, 206, 138, 0.35)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}
                        >
                            <i className="fa fa-sign-out-alt" style={{ color: '#2ece8a', fontSize: '20px' }}></i>
                        </div>
                        <div>
                            <h5
                                style={{
                                    margin: 0,
                                    fontWeight: 700,
                                    fontSize: '18px',
                                    color: isDark ? '#ffffff' : '#0f172a'
                                }}
                            >
                                Employee Checkout
                            </h5>
                            <span
                                style={{
                                    fontSize: '13px',
                                    color: isDark ? '#94a3b8' : '#64748b'
                                }}
                            >
                                Exit clearance for <strong>{entry.employee_name || entry.employment_no}</strong>
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => !isSubmitting && onHide()}
                        disabled={isSubmitting}
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: isDark ? '#2d2d3f' : '#f1f5f9',
                            color: isDark ? '#cbd5e1' : '#64748b',
                            fontSize: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            lineHeight: 1,
                            transition: 'all 0.2s ease'
                        }}
                    >
                        &times;
                    </button>
                </div>

                {/* ── Modal Body ── */}
                <div style={{ padding: '20px 28px' }}>
                    {/* Employee & Vehicle Information Strip */}
                    <div
                        style={{
                            backgroundColor: isDark ? '#151521' : '#f8fafc',
                            border: `1px solid ${isDark ? '#2d2d3f' : '#e2e8f0'}`,
                            borderRadius: '12px',
                            padding: '12px 18px',
                            marginBottom: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '12px'
                        }}
                    >
                        {/* Employee Details */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {entry.profile_photo && !imgError ? (
                                <img
                                    src={getFullImageUrl(entry.profile_photo)}
                                    alt={entry.employee_name || 'Employee'}
                                    onError={() => setImgError(true)}
                                    style={{
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: '2px solid #2ece8a',
                                        flexShrink: 0
                                    }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: '50%',
                                        backgroundColor: '#2ece8a',
                                        color: '#ffffff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 700,
                                        fontSize: '15px',
                                        letterSpacing: '0.5px',
                                        flexShrink: 0
                                    }}
                                >
                                    {getInitials(entry.employee_name)}
                                </div>
                            )}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <strong style={{ fontSize: '15px', color: isDark ? '#f8fafc' : '#0f172a' }}>
                                        {entry.employee_name || 'Employee'}
                                    </strong>
                                    <span
                                        className="badge"
                                        style={{
                                            backgroundColor: isDark ? '#2d2d3f' : '#e2e8f0',
                                            color: isDark ? '#cbd5e1' : '#334155',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            padding: '3px 8px',
                                            borderRadius: '6px'
                                        }}
                                    >
                                        {entry.employment_no || 'EMP'}
                                    </span>
                                </div>
                                <div style={{ fontSize: '12.5px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '2px' }}>
                                    {entry.department_name || entry.designation_name || 'Staff Member'}
                                </div>
                            </div>
                        </div>

                        {/* Vehicle & Stay Badges */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            {hasVehicle && (
                                <span
                                    style={{
                                        backgroundColor: isDark ? 'rgba(46, 206, 138, 0.14)' : '#ecfdf5',
                                        color: '#059669',
                                        border: '1px solid #a7f3d0',
                                        fontSize: '12.5px',
                                        fontWeight: 600,
                                        padding: '5px 12px',
                                        borderRadius: '8px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <i className="fa fa-car"></i>
                                    <span>{vehicleNumber}</span>
                                    {parkingSlotInfo && (
                                        <span style={{ opacity: 0.85, fontWeight: 500 }}>
                                            • {parkingSlotInfo}
                                        </span>
                                    )}
                                </span>
                            )}

                            {entry.stay_duration && (
                                <span
                                    style={{
                                        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.14)' : '#eff6ff',
                                        color: '#2563eb',
                                        border: '1px solid #bfdbfe',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        padding: '5px 12px',
                                        borderRadius: '8px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                >
                                    <span>⏱️</span>
                                    <span>{entry.stay_duration}</span>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Departure Mode (Side-by-side 2 Columns) */}
                    {hasVehicle ? (
                        <div style={{ marginBottom: '18px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: isDark ? '#e2e8f0' : '#334155', marginBottom: '8px' }}>
                                Departure Mode <span className="text-danger">*</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                {/* Option 1: Employee Only Exit (Pedestrian) */}
                                <div
                                    onClick={() => !isSubmitting && setExitMode('employee_only')}
                                    role="button"
                                    tabIndex={0}
                                    style={{
                                        padding: '14px 16px',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        border: exitMode === 'employee_only'
                                            ? '2px solid #2ece8a'
                                            : `1.5px solid ${isDark ? '#2d2d3f' : '#e2e8f0'}`,
                                        backgroundColor: exitMode === 'employee_only'
                                            ? (isDark ? 'rgba(46, 206, 138, 0.12)' : '#f0fdf4')
                                            : (isDark ? '#151521' : '#ffffff'),
                                        boxShadow: exitMode === 'employee_only' ? '0 4px 14px rgba(46, 206, 138, 0.18)' : 'none',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '12px'
                                    }}
                                >
                                    <div
                                        style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            border: exitMode === 'employee_only' ? '6px solid #2ece8a' : `2px solid ${isDark ? '#64748b' : '#cbd5e1'}`,
                                            backgroundColor: '#ffffff',
                                            marginTop: '2px',
                                            flexShrink: 0,
                                            transition: 'border 0.2s ease'
                                        }}
                                    />
                                    <div style={{ minWidth: 0, flexGrow: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                            <strong style={{ fontSize: '13.5px', color: isDark ? '#ffffff' : '#0f172a' }}>
                                                🚶‍♂️ Employee Only
                                            </strong>
                                            <span
                                                className="badge"
                                                style={{
                                                    backgroundColor: exitMode === 'employee_only' ? '#2ece8a' : (isDark ? '#2d2d3f' : '#e2e8f0'),
                                                    color: exitMode === 'employee_only' ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                                                    fontSize: '10.5px',
                                                    fontWeight: 600,
                                                    padding: '3px 7px',
                                                    borderRadius: '5px'
                                                }}
                                            >
                                                Vehicle Stays
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '4px', lineHeight: '1.35' }}>
                                            On foot exit. Vehicle ({vehicleNumber}) remains parked in slot.
                                        </div>
                                    </div>
                                </div>

                                {/* Option 2: Full Exit with Vehicle */}
                                <div
                                    onClick={() => !isSubmitting && setExitMode('with_vehicle')}
                                    role="button"
                                    tabIndex={0}
                                    style={{
                                        padding: '14px 16px',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        border: exitMode === 'with_vehicle'
                                            ? '2px solid #3b82f6'
                                            : `1.5px solid ${isDark ? '#2d2d3f' : '#e2e8f0'}`,
                                        backgroundColor: exitMode === 'with_vehicle'
                                            ? (isDark ? 'rgba(59, 130, 246, 0.12)' : '#eff6ff')
                                            : (isDark ? '#151521' : '#ffffff'),
                                        boxShadow: exitMode === 'with_vehicle' ? '0 4px 14px rgba(59, 130, 246, 0.18)' : 'none',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '12px'
                                    }}
                                >
                                    <div
                                        style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            border: exitMode === 'with_vehicle' ? '6px solid #3b82f6' : `2px solid ${isDark ? '#64748b' : '#cbd5e1'}`,
                                            backgroundColor: '#ffffff',
                                            marginTop: '2px',
                                            flexShrink: 0,
                                            transition: 'border 0.2s ease'
                                        }}
                                    />
                                    <div style={{ minWidth: 0, flexGrow: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                            <strong style={{ fontSize: '13.5px', color: isDark ? '#ffffff' : '#0f172a' }}>
                                                🚗 With Vehicle
                                            </strong>
                                            <span
                                                className="badge"
                                                style={{
                                                    backgroundColor: exitMode === 'with_vehicle' ? '#3b82f6' : (isDark ? '#2d2d3f' : '#e2e8f0'),
                                                    color: exitMode === 'with_vehicle' ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                                                    fontSize: '10.5px',
                                                    fontWeight: 600,
                                                    padding: '3px 7px',
                                                    borderRadius: '5px'
                                                }}
                                            >
                                                Full Exit
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '4px', lineHeight: '1.35' }}>
                                            Departs with vehicle. Parking slot will be released.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div
                            style={{
                                padding: '12px 16px',
                                borderRadius: '10px',
                                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : '#eff6ff',
                                border: `1px solid ${isDark ? '#1e3a8a' : '#bfdbfe'}`,
                                marginBottom: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontSize: '13px',
                                color: isDark ? '#bfdbfe' : '#1e40af'
                            }}
                        >
                            <i className="fa fa-walking text-primary fs-5"></i>
                            <span><strong>Pedestrian Exit:</strong> Employee entered on foot without vehicle.</span>
                        </div>
                    )}

                    {/* Exiting Gate & Notes in a 2-Column Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div>
                            <label
                                style={{
                                    display: 'block',
                                    fontSize: '12.5px',
                                    fontWeight: 600,
                                    color: isDark ? '#e2e8f0' : '#334155',
                                    marginBottom: '6px'
                                }}
                            >
                                Exiting Gate
                            </label>
                            <Form.Select
                                value={selectedGateId}
                                onChange={(e) => setSelectedGateId(e.target.value)}
                                disabled={isSubmitting}
                                style={{
                                    backgroundColor: isDark ? '#151521' : '#ffffff',
                                    color: isDark ? '#f8fafc' : '#0f172a',
                                    borderColor: isDark ? '#2d2d3f' : '#cbd5e1',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    height: '42px'
                                }}
                            >
                                {gates.map(g => (
                                    <option key={g.id} value={g.id}>
                                        {g.name} {g.code ? `(${g.code})` : ''}
                                    </option>
                                ))}
                            </Form.Select>
                        </div>

                        <div>
                            <label
                                style={{
                                    display: 'block',
                                    fontSize: '12.5px',
                                    fontWeight: 600,
                                    color: isDark ? '#e2e8f0' : '#334155',
                                    marginBottom: '6px'
                                }}
                            >
                                Notes / Purpose <span className="text-muted fw-normal">(Optional)</span>
                            </label>
                            <Form.Control
                                type="text"
                                placeholder="e.g. Lunch break, errand..."
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                disabled={isSubmitting}
                                style={{
                                    backgroundColor: isDark ? '#151521' : '#ffffff',
                                    color: isDark ? '#f8fafc' : '#0f172a',
                                    borderColor: isDark ? '#2d2d3f' : '#cbd5e1',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    height: '42px'
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* ── Modal Footer ── */}
                <div
                    style={{
                        padding: '16px 28px',
                        borderTop: `1px solid ${isDark ? '#2d2d3f' : '#f1f5f9'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '12px',
                        backgroundColor: isDark ? '#1e1e2d' : '#ffffff'
                    }}
                >
                    <button
                        type="button"
                        className="pkg-close-btn"
                        onClick={() => !isSubmitting && onHide()}
                        disabled={isSubmitting}
                        style={{
                            backgroundColor: '#7A70BA',
                            border: 'none',
                            color: '#ffffff',
                            fontWeight: 500,
                            fontSize: '14px',
                            padding: '10px 24px',
                            minHeight: '42px',
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        className="pkg-submit-btn"
                        onClick={handleSubmitCheckout}
                        disabled={isSubmitting}
                        style={{
                            backgroundColor: hasVehicle && exitMode === 'with_vehicle' ? '#3b82f6' : '#2ece8a',
                            border: 'none',
                            color: '#ffffff',
                            fontWeight: 600,
                            fontSize: '14px',
                            padding: '10px 26px',
                            minHeight: '42px',
                            borderRadius: '8px',
                            boxShadow: hasVehicle && exitMode === 'with_vehicle'
                                ? '0 3px 12px rgba(59, 130, 246, 0.3)'
                                : '0 3px 12px rgba(46, 206, 138, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {isSubmitting ? (
                            <>
                                <Spinner animation="border" size="sm" className="me-2" />
                                <span>Recording Exit...</span>
                            </>
                        ) : (
                            <>
                                {hasVehicle ? (
                                    exitMode === 'employee_only' ? (
                                        <>
                                            <i className="fa fa-walking me-2"></i>
                                            <span>Employee Only Exit</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa fa-car me-2"></i>
                                            <span>Exit with Vehicle</span>
                                        </>
                                    )
                                ) : (
                                    <>
                                        <i className="fa fa-sign-out-alt me-2"></i>
                                        <span>Confirm Check Out</span>
                                    </>
                                )}
                            </>
                        )}
                    </button>
                </div>
            </div>

            <style>{`
                .employee-checkout-modal-dialog {
                    max-width: 720px !important;
                    margin: 1.75rem auto !important;
                }
                @media (max-width: 768px) {
                    .employee-checkout-modal-dialog {
                        max-width: 95% !important;
                        margin: 1rem auto !important;
                    }
                }
            `}</style>
        </Modal>
    );
};

export default EmployeeCheckoutModal;

