import React, { useRef } from 'react';
import Swal from 'sweetalert2';
import { useFormConfig } from '../../../hooks/useFormConfig';

/**
 * VehicleHistoryForm
 * Props:
 *  - formData        : state object
 *  - setFormData     : setter
 *  - onSave          : (e) => void
 *  - onCancel        : () => void
 *  - isEditing       : bool
 *  - vehicles        : [{ id, vehicle_number, vehicle_name }]
 *  - drivers         : [{ id, full_name, phone_number }]
 *  - serviceTypes    : [{ id, service_type }]
 *  - onVehicleChange : (vehicleId) => void
 *
 * Enter-key behaviour:
 *  - Regular inputs  : Enter → jump to next field.
 *  - Select/dropdowns: First Enter opens the dropdown (native).
 *                      While dropdown is open, ↑/↓ navigate items.
 *                      Second Enter (or clicking) confirms selection → jump to next field.
 *  - Textarea        : Ctrl+Enter advances to next field (Enter = newline).
 *  Only the Save button submits the form.
 */
const VehicleHistoryForm = ({
    formData,
    setFormData,
    onSave,
    onCancel,
    isEditing,
    vehicles     = [],
    drivers      = [],
    serviceTypes = [],
    onVehicleChange,
}) => {
    const { isFieldVisible } = useFormConfig('logistics_app_vehiclehistory', 'Vehiclehistoryform');

    // ── Ordered refs for Enter-key navigation ─────────────────────────────
    const refs = {
        trans_date:     useRef(null),
        vehicle:        useRef(null),
        default_driver: useRef(null),
        actual_km:      useRef(null),
        service_type:   useRef(null),
        fuel_liters:    useRef(null),
        cost:           useRef(null),
        attachment:     useRef(null),
        narration:      useRef(null),
    };

    const fieldOrder = [
        'trans_date', 'vehicle', 'default_driver',
        'actual_km', 'service_type', 'fuel_liters', 'cost', 'attachment', 'narration',
    ];

    // ── Detect fuel-filling service type ──────────────────────────────────────
    const selectedServiceType = serviceTypes.find(
        (s) => String(s.id) === String(formData.service_type)
    );
    const isFuelFilling = selectedServiceType
        ? /fuel\s*filling/i.test(selectedServiceType.service_type)
        : false;

    // ── Track which selects are currently open ────────────────────────────
    // A select is "open" between mousedown-on-itself and its change/blur.
    // We use a ref (not state) to avoid re-renders.
    const selectOpen = useRef({
        vehicle:        false,
        default_driver: false,
        service_type:   false,
    });

    // ── Focus the next focusable field ────────────────────────────────────
    const focusNext = (currentField) => {
        const idx = fieldOrder.indexOf(currentField);
        for (let i = idx + 1; i < fieldOrder.length; i++) {
            const next = refs[fieldOrder[i]]?.current;
            if (next) { next.focus(); break; }
        }
    };

    const focusPrev = (currentField) => {
    const idx = fieldOrder.indexOf(currentField);

    for (let i = idx - 1; i >= 0; i--) {
        const prev = refs[fieldOrder[i]]?.current;
        if (prev) {
            prev.focus();
            break;
        }
    }
};
    // ── Enter handler for plain inputs ────────────────────────────────────
    const handleEnter = (e, currentField) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        focusNext(currentField);
    }
    else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusPrev(currentField);
    }
};

    // ── Enter / Arrow handler for date inputs ───────────────────────────────
    //  Enter (empty value) → open native date picker
    //  Enter (value set)   → move to next field
    //  ArrowDown/ArrowUp   → navigate fields
    const handleDateEnter = (e, currentField) => {
        if (e.key === 'Enter') {
            e.preventDefault();

            // validate year if date entered
            if (e.target.value) {
                const year = parseInt(e.target.value.split('-')[0], 10);
                if (year < 1000 || year > 9999) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Invalid Date',
                        text: 'Please enter a valid 4-digit year (e.g. 2026).',
                        confirmButtonText: 'OK'
                    });
                    return;
                }
            }

            focusNext(currentField);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            focusNext(currentField);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusPrev(currentField);
        }
    };

    // ── Enter handler for <select> elements ──────────────────────────────
    /**
     * How native <select> works across browsers:
     *  • First Enter (dropdown closed) → opens the dropdown.
     *    At this point selectOpen[field] = false still, so we do NOT navigate.
     *    We mark it open so the next Enter knows what's happening.
     *  • Arrow keys while open → browser moves the highlighted option.
     *    We never intercept these.
     *  • Second Enter (dropdown open, option highlighted) → browser fires
     *    a `change` event then closes the dropdown.
     *    In our onKeyDown the dropdown is still technically "open", so we
     *    let the browser handle the selection; navigation happens in onChange.
     *
     * Edge-case: user presses Escape to close without selecting → we reset
     * the open flag in onBlur.
     */
    const handleSelectKeyDown = (e, fieldName) => {
        if (e.key === 'Enter') {
            if (!selectOpen.current[fieldName]) {
                selectOpen.current[fieldName] = true;
                if (typeof e.target.showPicker === 'function') {
                    try {
                        e.target.showPicker();
                    } catch (err) {
                        console.error(err);
                    }
                }
            } else {
                e.preventDefault();
                selectOpen.current[fieldName] = false;
                focusNext(fieldName);
            }
        } else if (!selectOpen.current[fieldName]) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                focusNext(fieldName);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                focusPrev(fieldName);
            }
        }
    };

    // ── Called when a <select> value actually changes ─────────────────────
    const handleSelectChange = (fieldName, value, extraUpdater) => {
        selectOpen.current[fieldName] = false; // dropdown is now closed

        if (extraUpdater) {
            extraUpdater(value);
        } else {
            setFormData((prev) => ({ ...prev, [fieldName]: value }));
        }

        // Move to next field after a tiny delay so the select finishes closing
        setTimeout(() => focusNext(fieldName), 0);
    };

    // ── Reset open flag if user dismisses without selecting (Escape/click away)
    const handleSelectBlur = (fieldName) => {
        selectOpen.current[fieldName] = false;
    };

    // ── Generic field change ──────────────────────────────────────────────
    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    // ── Vehicle select: also triggers onVehicleChange ─────────────────────
    const handleVehicleSelect = (value) => {
        setFormData((prev) => ({
            ...prev,
            vehicle:             value,
            vehicle_name:        '',
            default_driver:      '',
            default_driver_name: '',
        }));
        if (onVehicleChange && value) onVehicleChange(value);
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleChange('attachment', e.target.files[0]);
        }
    };

    // Build a readable label for each driver option
    const driverLabel = (d) => {
        if (d.user_full_name) return d.user_full_name;
        if (d.name)           return d.name;
        if (d.phone_number)   return d.phone_number;
        return `Driver #${d.id}`;
    };

    return (
        <div className="scfm-modal w-100 h-100 d-flex flex-column" style={{ borderRadius: '16px', overflow: 'hidden' }}>
            <style>{`
                .scfm-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .scfm-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .scfm-modal .modal-close-x {
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
                .scfm-modal .modal-close-x:hover { color: #555; }
                .scfm-modal .modal-body-custom { padding: 24px 28px; }
                .scfm-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .scfm-modal label.fw-semibold {
                    font-size: 14px;
                    font-weight: 500 !important;
                    color: #4a5568;
                    margin-bottom: 8px;
                    display: block;
                }
                .scfm-modal .form-control {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .scfm-modal .form-control:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .scfm-modal .form-control::placeholder { color: #94a3b8; }
                .scfm-modal .form-control.bg-light { background-color: #f8fafc !important; }
                .scfm-modal .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .scfm-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .scfm-modal .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .scfm-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
            `}</style>

            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" fill="white"/>
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            {isEditing ? 'Edit Service Record' : 'Add New Service Record'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Enter details to manage vehicle history
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onCancel}>&times;</button>
            </div>

            <form onSubmit={onSave} className="d-flex flex-column flex-grow-1">
                <div className="modal-body-custom flex-grow-1">
                    <div className="row">

                {/* ── Trans No — read-only, auto-generated on backend ── */}
                {isFieldVisible('trans_no') && (
                    <div className="form-group col-md-6 mb-3">
                        <label className="fw-semibold mb-1">Trans No</label>
                        <input
                            type="text"
                            className="form-control bg-light"
                            value={formData.trans_no || ''}
                            readOnly
                            tabIndex={-1}
                        />
                    </div>
                )}

                {/* ── Trans Date ── */}
                {isFieldVisible('trans_date') && (
                    <div className="form-group col-md-6 mb-3">
                        <label className="fw-semibold mb-1">
                            Trans Date <span className="text-danger">*</span>
                        </label>
                        <input
                            ref={refs.trans_date}
                            type="date"
                            className="form-control"
                            value={formData.trans_date || ''}
                            onChange={(e) => handleChange('trans_date', e.target.value)}
                            onKeyDown={(e) => handleDateEnter(e, 'trans_date')}
                            autoFocus
                        />
                    </div>
                )}
                {/* ── Vehicle No — dropdown ── */}
                {isFieldVisible('vehicle') && (
                    <div className="form-group col-md-6 mb-3">
                        <label className="fw-semibold mb-1">
                            Vehicle No <span className="text-danger">*</span>
                        </label>
                        <select
                            ref={refs.vehicle}
                            className="form-control"
                            value={formData.vehicle || ''}
                            onChange={(e) =>
                                handleSelectChange('vehicle', e.target.value, handleVehicleSelect)
                            }
                            onKeyDown={(e) => handleSelectKeyDown(e, 'vehicle')}
                            onBlur={() => handleSelectBlur('vehicle')}
                        >
                            <option value="">— Select Vehicle —</option>
                            {vehicles.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {v.vehicle_number}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* ── Vehicle Name — auto-filled read-only ── */}
                {isFieldVisible('vehicle_name') && (
                    <div className="form-group col-md-6 mb-3">
                        <label className="fw-semibold mb-1">Vehicle Name</label>
                        <input
                            type="text"
                            className="form-control bg-light"
                            readOnly
                            tabIndex={-1}
                            placeholder="Auto-filled on vehicle selection"
                            value={formData.vehicle_name || ''}
                        />
                    </div>
                )}

                {/* ── Default Driver — auto-filled dropdown, editable ── */}
                {isFieldVisible('default_driver') && (
                    <div className="form-group col-md-6 mb-3">
                        <label className="fw-semibold mb-1">Default Driver</label>
                        <select
                            ref={refs.default_driver}
                            className="form-control"
                            value={formData.default_driver || ''}
                            onChange={(e) =>
                                handleSelectChange('default_driver', e.target.value, (val) => {
                                    setFormData((prev) => ({
                                        ...prev,
                                        default_driver:      val,
                                        default_driver_name: '',
                                    }));
                                })
                            }
                            onKeyDown={(e) => handleSelectKeyDown(e, 'default_driver')}
                            onBlur={() => handleSelectBlur('default_driver')}
                        >
                            <option value="">— None / Select Driver —</option>
                            {drivers.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {driverLabel(d)}
                                </option>
                            ))}
                        </select>

                        {/* Auto-fill confirmation badge */}
                        {formData.default_driver_name && (
                            <small>
                                <span
                                    className="badge mt-1"
                                    style={{
                                        background:   '#dcfce7',
                                        color:        '#166534',
                                        fontWeight:   600,
                                        fontSize:     '0.75rem',
                                        padding:      '3px 8px',
                                        borderRadius: '6px',
                                    }}
                                >
                                    {/* {formData.default_driver_name} */}
                                </span>
                            </small>
                        )}
                    </div>
                )}

                {/* ── Actual KM ── */}
                {isFieldVisible('actual_km') && (
                    <div className="form-group col-md-6 mb-3">
                        <label className="fw-semibold mb-1">Actual KM</label>
                        <input
                            ref={refs.actual_km}
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control"
                            placeholder="e.g. 12500.50"
                            value={formData.actual_km || ''}
                            onChange={(e) => handleChange('actual_km', e.target.value)}
                            onKeyDown={(e) => handleEnter(e, 'actual_km')}
                        />
                    </div>
                )}

                {/* ── Service Type — dropdown ── */}
                {isFieldVisible('service_type') && (
                    <div className="form-group col-md-6 mb-3">
                        <label className="fw-semibold mb-1">Service Type</label>
                        <select
                            ref={refs.service_type}
                            className="form-control"
                            value={formData.service_type || ''}
                            onChange={(e) =>
                                handleSelectChange('service_type', e.target.value, (val) => {
                                    setFormData((prev) => ({ ...prev, service_type: val }));
                                })
                            }
                            onKeyDown={(e) => handleSelectKeyDown(e, 'service_type')}
                            onBlur={() => handleSelectBlur('service_type')}
                        >
                            <option value="">— Select Service Type —</option>
                            {serviceTypes.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.service_type}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* ── Fuel Liters — only for Fuel Filling service types ── */}
                {isFuelFilling && (
                    <div className="form-group col-md-6 mb-3">
                        <label className="fw-semibold mb-1">
                            Fuel Filled (Liters) <span className="text-danger">*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                ref={refs.fuel_liters}
                                type="number"
                                step="0.01"
                                min="0"
                                className="form-control"
                                placeholder="e.g. 45.50"
                                required={isFuelFilling}
                                value={formData.fuel_liters || ''}
                                onChange={(e) => handleChange('fuel_liters', e.target.value)}
                                onKeyDown={(e) => handleEnter(e, 'fuel_liters')}
                                style={{ paddingRight: '52px' }}
                            />
                            <span style={{
                                position: 'absolute', right: '12px', top: '50%',
                                transform: 'translateY(-50%)',
                                color: '#64748b', fontSize: '0.82rem', fontWeight: 600,
                                pointerEvents: 'none',
                            }}>L</span>
                        </div>
                        <small className="text-muted">Enter the quantity of fuel filled in litres.</small>
                    </div>
                )}

                {/* ── Cost ── */}
                {isFieldVisible('cost') && (
                    <div className="form-group col-md-6 mb-3">
                        <label className="fw-semibold mb-1">Cost</label>
                        <input
                            ref={refs.cost}
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control"
                            placeholder="e.g. 2500.00"
                            value={formData.cost || ''}
                            onChange={(e) => handleChange('cost', e.target.value)}
                            onKeyDown={(e) => handleEnter(e, 'cost')}
                        />
                    </div>
                )}

                {/* ── Attachment ── */}
                {isFieldVisible('attachment') && (
                    <div className="form-group col-md-12 mb-3">
                        <label className="fw-semibold mb-1">Attachment</label>
                        <input
                            ref={refs.attachment}
                            type="file"
                            className="form-control"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                            onChange={handleFileChange}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.target.click();
                                } else if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    focusNext('attachment');
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    focusPrev('attachment');
                                }
                            }}
                        />
                        {isEditing && formData.attachment_url && (
                            <div className="mt-1">
                                <a
                                    href={formData.attachment_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary small"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                    </svg>
                                    View current attachment
                                </a>
                            </div>
                        )}
                        <small className="text-muted">PDF, image, or Office document.</small>
                    </div>
                )}

                {/* ── Narration ── */}
                {isFieldVisible('narration') && (
                    <div className="form-group col-12 mb-3">
                        <label className="fw-semibold mb-1">Narration</label>
                        <textarea
                            ref={refs.narration}
                            className="form-control"
                            rows={3}
                            placeholder="Optional notes about this service / history entry…"
                            value={formData.narration || ''}
                            onChange={(e) => handleChange('narration', e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.ctrlKey) handleEnter(e, 'narration');
                            }}
                        />
                        <small className="text-muted">Press Ctrl+Enter to move to next field.</small>
                    </div>
                )}

                    </div>
                </div>

                <div className="modal-footer-custom mt-auto">
                    <button type="button" onClick={onCancel} className="btn-close-custom">Close</button>
                    <button type="submit" className="btn-save-custom">{isEditing ? 'Update' : 'Save'}</button>
                </div>
            </form>
        </div>
    );
};

export default VehicleHistoryForm;