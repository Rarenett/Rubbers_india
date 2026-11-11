import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import Swal from 'sweetalert2';
import { useFormConfig } from '../../../hooks/useFormConfig';

/* ══════════════════════════════════════════════════════════
   SEARCHABLE SELECT — identical to PurchaseOrderForm's version
   ══════════════════════════════════════════════════════════ */
const SearchableSelect = ({
    value, options = [], onChange, placeholder = 'Select...', disabled = false,
    className = '', onKeyDown, onCloseEmpty, autoOpen = true, style = {}, name,
    triggerRef,    // external ref so parent can .focus() the trigger
    onAfterSelect, // called after user picks an option — parent uses this to move to next field
    ...dataProps
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlightIdx, setHighlightIdx] = useState(-1);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const justSelectedRef = useRef(false);
    const internalTriggerRef = useRef(null);
    const resolvedTriggerRef = triggerRef || internalTriggerRef;
    const ignoreNextEnterRef = useRef(false);

    const foundOpt = options.find(o => String(o.value) === String(value));
    const selectedLabel = foundOpt && foundOpt.label != null ? String(foundOpt.label) : '';

    const filtered = query.trim()
        ? options.filter(o => {
            const labelStr = o && o.label != null ? String(o.label) : '';
            return labelStr.toLowerCase().includes(query.toLowerCase());
          })
        : options;

    useEffect(() => {
        if (open && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
                setQuery('');
                setHighlightIdx(-1);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const updateCoords = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setCoords({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
            }
        };
        updateCoords();
        window.addEventListener('scroll', updateCoords, true);
        window.addEventListener('resize', updateCoords);
        return () => {
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [open]);

    useEffect(() => {
        if (!listRef.current || highlightIdx < 0) return;
        const items = listRef.current.querySelectorAll('[data-ss-item]');
        if (items[highlightIdx]) items[highlightIdx].scrollIntoView({ block: 'nearest' });
    }, [highlightIdx]);

    const openDropdown = useCallback(() => {
        if (disabled) return;
        const initIdx = value ? options.findIndex(o => String(o.value) === String(value)) : -1;
        setHighlightIdx(initIdx >= 0 ? initIdx : 0);
        setQuery('');
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setCoords({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
        }
        setOpen(true);
        setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 10);
    }, [disabled, options, value]);

    const closeDropdown = useCallback((restoreFocus = true, selectedValue = undefined, fromSelection = false) => {
        setOpen(false);
        setQuery('');
        setHighlightIdx(-1);
        const effectiveValue = selectedValue !== undefined ? selectedValue : value;
        if (!effectiveValue && onCloseEmpty) {
            setTimeout(() => onCloseEmpty(), 20);
            return;
        }
        if (fromSelection && onAfterSelect) {
            setTimeout(() => onAfterSelect(), 10);
        } else if (restoreFocus) {
            setTimeout(() => resolvedTriggerRef.current?.focus(), 10);
        }
    }, [value, onCloseEmpty, onAfterSelect, resolvedTriggerRef]);

    const selectOption = useCallback((opt) => {
        onChange({ target: { value: opt.value } });
        justSelectedRef.current = false;
        ignoreNextEnterRef.current = true;
        closeDropdown(true, opt.value, true); // fromSelection=true → triggers onAfterSelect
    }, [onChange, closeDropdown]);

    const handleTriggerKeyDown = (e) => {
        if (disabled) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            openDropdown();
            return;
        }
        if (e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            openDropdown();
            return;
        }
        justSelectedRef.current = false;
        if (onKeyDown) onKeyDown(e);
    };

    const handleInputKeyDown = (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); closeDropdown(true); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, filtered.length - 1)); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); return; }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (ignoreNextEnterRef.current) { ignoreNextEnterRef.current = false; return; }
            const target = highlightIdx >= 0 && filtered[highlightIdx]
                ? filtered[highlightIdx]
                : filtered.length === 1 ? filtered[0] : null;
            if (target) selectOption(target);
            return;
        }
        if (e.key === 'Tab') { closeDropdown(false); }
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }} {...dataProps}>
            {open ? (
                <div style={{ position: 'relative', width: '100%' }}>
                    <input
                        ref={inputRef}
                        type="text"
                        data-ss-trigger
                        name={name}
                        className={className}
                        value={query}
                        onChange={e => { setQuery(e.target.value); setHighlightIdx(0); }}
                        onKeyDown={handleInputKeyDown}
                        placeholder={selectedLabel || placeholder}
                        style={{ width: '100%', display: 'block', boxSizing: 'border-box', fontFamily: 'inherit', margin: 0, outline: 'none' }}
                    />
                    {ReactDOM.createPortal(
                        <div ref={listRef} style={{
                            position: 'absolute',
                            top: `${coords.top + 1}px`,
                            left: `${coords.left}px`,
                            zIndex: 999999,
                            width: 'max-content',
                            minWidth: `${coords.width}px`,
                            maxWidth: '400px',
                            background: '#fff',
                            border: '1px solid #adb5bd',
                            boxShadow: '2px 4px 10px rgba(0,0,0,0.15)',
                            maxHeight: '240px',
                            overflowY: 'auto',
                        }}>
                            {filtered.length === 0 ? (
                                <div style={{ padding: '8px 10px', color: '#94a3b8', fontSize: '0.83rem' }}>No results</div>
                            ) : filtered.map((opt, i) => {
                                const isSelected = String(opt.value) === String(value);
                                const isHigh = i === highlightIdx;
                                return (
                                    <div key={opt.value} data-ss-item
                                        onMouseDown={e => { e.preventDefault(); selectOption(opt); }}
                                        onMouseEnter={() => setHighlightIdx(i)}
                                        style={{
                                            padding: '7px 10px', cursor: 'pointer', fontSize: '0.84rem',
                                            lineHeight: '1.35',
                                            background: isHigh ? '#0a500f' : 'transparent',
                                            color: isHigh ? '#fff' : '#212529',
                                            fontWeight: isSelected ? 600 : 400,
                                            userSelect: 'none', whiteSpace: 'nowrap',
                                        }}
                                    >{opt.label}</div>
                                );
                            })}
                        </div>,
                        document.body
                    )}
                </div>
            ) : (
                <button
                    type="button"
                    ref={resolvedTriggerRef}
                    data-ss-trigger
                    name={name}
                    className={className}
                    disabled={disabled}
                    onKeyDown={handleTriggerKeyDown}
                    onClick={openDropdown}
                    onFocus={openDropdown}
                    onBlur={() => { justSelectedRef.current = false; }}
                    style={{
                        width: '100%', textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: '4px', overflow: 'hidden', opacity: disabled ? 0.6 : 1, fontFamily: 'inherit',
                    }}
                    title={selectedLabel || placeholder}
                >
                    <span style={{
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: selectedLabel ? 'inherit' : '#94a3b8', fontSize: 'inherit',
                    }}>{selectedLabel || placeholder}</span>
                    <svg viewBox="0 0 10 6" fill="currentColor" style={{ width: '10px', height: '6px', flexShrink: 0, opacity: 0.45 }}>
                        <path d="M0 0l5 6 5-6z" />
                    </svg>
                </button>
            )}
        </div>
    );
};

/**
 * VehicleForm
 * Props:
 *  - formData        : state object containing vehicle fields
 *  - setFormData     : setter function
 *  - onSave          : (e) => void
 *  - onCancel        : () => void
 *  - isEditing       : bool
 *  - categories      : array of vehicle category objects
 *  - drivers         : array of driver objects
 *  - tyreSizes       : array of tyre size objects
 *  - stockItems      : array of stock item objects (stock group: vehicle)
 */
const VehicleForm = ({
    formData,
    setFormData,
    onSave,
    onCancel,
    isEditing,
    categories = [],
    drivers = [],
    tyreSizes = [],
    stockItems = []
}) => {
    const { isFieldVisible } = useFormConfig('logistics_app_vehicle', 'VehicleForm');
    const [activeTab, setActiveTab] = useState('basic');
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // ── Refs for Basic tab fields ──────────────────────────────────────────
    const basicRefs = {
        vehicle_name:   useRef(null),
        vehicle_number: useRef(null),
        category:       useRef(null),   // points to SearchableSelect trigger button
        vehicle_status: useRef(null),   // points to SearchableSelect trigger button
        driver:         useRef(null),   // points to SearchableSelect trigger button
        vehicle_img:    useRef(null),
        narration:      useRef(null),
    };

    const basicFieldOrder = [
        'vehicle_name', 'vehicle_number', 'category',
        'vehicle_status', 'driver', 'vehicle_img', 'narration',
    ];

    // ── Refs for Specification tab fields ──────────────────────────────────
    const specRefs = {
        fuel_type:              useRef(null), // points to SearchableSelect trigger button
        mileage:                useRef(null),
        tonnage:                useRef(null),
        volume:                 useRef(null),
        capacity:               useRef(null),
        rate:                   useRef(null),
        front_tyre_size:        useRef(null),
        rear_tyre_size:         useRef(null),
        vehicle_fasttag:        useRef(null),
        vehicle_insurance_date: useRef(null),
        vehicle_taxes_date:     useRef(null),
        vehicle_pollution_date: useRef(null),
        next_service_date:      useRef(null),
        next_retest_date:       useRef(null),
    };

    const specFieldOrder = [
        'fuel_type', 'mileage', 'tonnage', 'volume', 'capacity', 'rate',
        'front_tyre_size', 'rear_tyre_size', 'vehicle_fasttag',
        'vehicle_insurance_date', 'vehicle_taxes_date',
        'vehicle_pollution_date', 'next_service_date', 'next_retest_date',
    ];

    // ── Track open/closed state for date pickers (per field) ──────────────
    const dateOpen = useRef({
        vehicle_insurance_date: false,
        vehicle_taxes_date: false,
        vehicle_pollution_date: false,
        next_service_date: false,
        next_retest_date: false,
    });

    // ── Focus next field within the active tab ─────────────────────────────
    const focusNext = (currentField) => {
        const isBasic = basicFieldOrder.includes(currentField);
        const order   = isBasic ? basicFieldOrder : specFieldOrder;
        const refsMap = isBasic ? basicRefs       : specRefs;
        const idx     = order.indexOf(currentField);
        for (let i = idx + 1; i < order.length; i++) {
            const next = refsMap[order[i]]?.current;
            if (next) { next.focus(); break; }
        }
    };

    // ── Focus previous field within the active tab ─────────────────────────
    const focusPrev = (currentField) => {
        const isBasic = basicFieldOrder.includes(currentField);
        const order   = isBasic ? basicFieldOrder : specFieldOrder;
        const refsMap = isBasic ? basicRefs       : specRefs;
        const idx     = order.indexOf(currentField);
        for (let i = idx - 1; i >= 0; i--) {
            const prev = refsMap[order[i]]?.current;
            if (prev) { prev.focus(); break; }
        }
    };

    // ── Enter / Arrow handler for plain inputs ─────────────────────────────
    const handleEnter = (e, currentField) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            focusNext(currentField);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusPrev(currentField);
        }
    };

    // ── Enter / Arrow handler for date inputs ─────────────────────────────
    const handleDateEnter = (e, currentField) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.target.value) {
                const year = parseInt(e.target.value.split('-')[0], 10);
                if (year < 1000 || year > 9999) {
                    Swal.fire({ icon: 'warning', title: 'Invalid Date', text: 'Please enter a valid 4-digit year (e.g. 2026).', confirmButtonText: 'OK' });
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

    const handleDateBlur = (currentField) => {
        dateOpen.current[currentField] = false;
    };

    // ── Original handlers ──────────────────────────────────────────────────
    const handleInputChange = (field, value) => {
        setFormData({ ...formData, [field]: value });
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const previewUrl = URL.createObjectURL(file);
            setFormData({ ...formData, vehicle_img: file, vehicle_img_preview: previewUrl });
        }
    };

    // ── Options arrays ────────────────────────────────────────────────────
    const vehicleNameOptions = useMemo(() => {
        const opts = (stockItems || []).map(item => ({
            value: item.name,
            label: item.name,
        }));
        if (isEditing && formData.vehicle_name && !opts.some(o => (o.value || '').toLowerCase().trim() === (formData.vehicle_name || '').toLowerCase().trim())) {
            opts.unshift({
                value: formData.vehicle_name,
                label: formData.vehicle_name,
            });
        }
        return opts;
    }, [stockItems, formData.vehicle_name, isEditing]);

    const categoryOptions = categories.map(cat => ({ value: String(cat.id), label: cat.category_name }));
    const statusOptions = [
        { value: 'available',   label: 'Available' },
        { value: 'in_use',      label: 'In Use' },
        { value: 'maintenance', label: 'Maintenance' },
        { value: 'inactive',    label: 'Inactive' },
    ];
    const driverOptions = [
        ...drivers.map(drv => ({ value: String(drv.id), label: drv.user_full_name || `Driver #${drv.id}` })),
    ];
    const fuelOptions = [
        { value: 'diesel',   label: 'Diesel' },
        { value: 'petrol',   label: 'Petrol' },
        { value: 'cng',      label: 'CNG' },
        { value: 'electric', label: 'Electric' },
        { value: 'hybrid',   label: 'Hybrid' },
    ];

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
                            {isEditing ? 'Edit Vehicle' : 'Create Vehicle'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Enter details to manage vehicle
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onCancel}>&times;</button>
            </div>
            <form onSubmit={onSave} className="d-flex flex-column flex-grow-1">
                <div className="modal-body-custom flex-grow-1">

                {/* Underline Tabs */}
                <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
                    <button type="button" onClick={() => setActiveTab('basic')} style={{
                        background: 'none', border: 'none', padding: '10px 4px', marginRight: '24px',
                        cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px',
                        color: activeTab === 'basic' ? '#4f46e5' : '#64748b',
                        borderBottom: activeTab === 'basic' ? '2px solid #4f46e5' : '2px solid transparent',
                        marginBottom: '-1px', transition: 'color 0.2s',
                    }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                            <polyline points="10 9 9 9 8 9"/>
                        </svg>
                        Basic Details
                    </button>
                    <button type="button" onClick={() => setActiveTab('specification')} style={{
                        background: 'none', border: 'none', padding: '10px 4px',
                        cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px',
                        color: activeTab === 'specification' ? '#4f46e5' : '#64748b',
                        borderBottom: activeTab === 'specification' ? '2px solid #4f46e5' : '2px solid transparent',
                        marginBottom: '-1px', transition: 'color 0.2s',
                    }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                        Specifications
                    </button>
                </div>

            {/* ── Form Body ─────────────────────────────────────────── */}
            <div style={{ minHeight: '340px' }}>
                {activeTab === 'basic' && (
                    <div className="fade-in">
                        <div className="row">
                            {/* Vehicle Name — SearchableSelect */}
                            {isFieldVisible('vehicle_name') && (
                                <div className="form-group col-md-6 mb-3">
                                    <label className="fw-semibold mb-1">
                                        Vehicle Name <span className="text-danger">*</span>
                                    </label>
                                    <SearchableSelect
                                        triggerRef={basicRefs.vehicle_name}
                                        className="form-control"
                                        value={formData.vehicle_name || ''}
                                        options={vehicleNameOptions}
                                        placeholder="Select Vehicle Name"
                                        onChange={(e) => handleInputChange('vehicle_name', e.target.value)}
                                        onAfterSelect={() => focusNext('vehicle_name')}
                                        onKeyDown={(e) => {
                                            if (e.key === 'ArrowUp') { e.preventDefault(); focusPrev('vehicle_name'); }
                                            else if (e.key === 'ArrowDown') { e.preventDefault(); focusNext('vehicle_name'); }
                                        }}
                                    />
                                </div>
                            )}

                            {/* Vehicle Number */}
                            {isFieldVisible('vehicle_number') && (
                                <div className="form-group col-md-6 mb-3">
                                    <label className="fw-semibold mb-1">
                                        Vehicle Number <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        ref={basicRefs.vehicle_number}
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. MH12AB1234"
                                        required
                                        value={formData.vehicle_number || ''}
                                        onChange={(e) => handleInputChange('vehicle_number', e.target.value)}
                                        onKeyDown={(e) => handleEnter(e, 'vehicle_number')}
                                    />
                                </div>
                            )}

                            {/* Category — SearchableSelect */}
                            {isFieldVisible('category') && (
                                <div className="form-group col-md-6 mb-3">
                                    <label className="fw-semibold mb-1">
                                        Category <span className="text-danger">*</span>
                                    </label>
                                    <SearchableSelect
                                        triggerRef={basicRefs.category}
                                        className="form-control"
                                        value={formData.category ? String(formData.category) : ''}
                                        options={categoryOptions}
                                        placeholder="Select Category"
                                        onChange={(e) => handleInputChange('category', e.target.value)}
                                        onAfterSelect={() => focusNext('category')}
                                        onKeyDown={(e) => {
                                            if (e.key === 'ArrowUp') { e.preventDefault(); focusPrev('category'); }
                                            else if (e.key === 'ArrowDown') { e.preventDefault(); focusNext('category'); }
                                        }}
                                    />
                                </div>
                            )}

                            {/* Status — SearchableSelect */}
                            {isFieldVisible('vehicle_status') && (
                                <div className="form-group col-md-6 mb-3">
                                    <label className="fw-semibold mb-1">Status</label>
                                    <SearchableSelect
                                        triggerRef={basicRefs.vehicle_status}
                                        className="form-control"
                                        value={formData.vehicle_status || 'available'}
                                        options={statusOptions}
                                        placeholder="Select Status"
                                        onChange={(e) => handleInputChange('vehicle_status', e.target.value)}
                                        onAfterSelect={() => focusNext('vehicle_status')}
                                        onKeyDown={(e) => {
                                            if (e.key === 'ArrowUp') { e.preventDefault(); focusPrev('vehicle_status'); }
                                            else if (e.key === 'ArrowDown') { e.preventDefault(); focusNext('vehicle_status'); }
                                        }}
                                    />
                                </div>
                            )}

                            {/* Driver — SearchableSelect */}
                            {isFieldVisible('driver') && (
                                <div className="form-group col-md-6 mb-3">
                                    <label className="fw-semibold mb-1">Driver</label>
                                    <SearchableSelect
                                        triggerRef={basicRefs.driver}
                                        className="form-control"
                                        value={formData.driver ? String(formData.driver) : ''}
                                        options={driverOptions}
                                        placeholder="Select Driver"
                                        onChange={(e) => handleInputChange('driver', e.target.value)}
                                        onAfterSelect={() => focusNext('driver')}
                                        onKeyDown={(e) => {
                                            if (e.key === 'ArrowUp') { e.preventDefault(); focusPrev('driver'); }
                                            else if (e.key === 'ArrowDown') { e.preventDefault(); focusNext('driver'); }
                                        }}
                                    />
                                </div>
                            )}

                            {/* Image */}
                            {isFieldVisible('vehicle_img') && (
                                <div className="form-group col-12 mb-3">
                                    <label className="fw-semibold mb-1">Vehicle Image</label>
                                    <input
                                        ref={basicRefs.vehicle_img}
                                        type="file"
                                        className="form-control"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (formData.vehicle_img || formData.vehicle_img_preview) {
                                                    basicRefs.narration?.current?.focus();
                                                } else {
                                                    e.target.click();
                                                }
                                            } else if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                focusNext('vehicle_img');
                                            } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                focusPrev('vehicle_img');
                                            }
                                        }}
                                    />
                                    {(formData.vehicle_img_preview || formData.vehicle_img) && (
                                        <div className="mt-2">
                                            <img
                                                src={formData.vehicle_img_preview || formData.vehicle_img}
                                                alt="Vehicle Preview"
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                style={{ width: '120px', height: '90px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #ddd' }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Narration */}
                            {isFieldVisible('narration') && (
                                <div className="form-group col-12 mb-3">
                                    <label className="fw-semibold mb-1">Narration / Notes</label>
                                    <textarea
                                        ref={basicRefs.narration}
                                        className="form-control"
                                        rows="3"
                                        placeholder="Enter any notes..."
                                        value={formData.narration || ''}
                                        onChange={(e) => handleInputChange('narration', e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                setActiveTab('specification');
                                                setTimeout(() => { specRefs.fuel_type?.current?.focus(); }, 100);
                                            }
                                        }}
                                    />
                                    <small className="text-muted">Press Enter to move to Specifications tab.</small>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'specification' && (
                    <div className="fade-in">
                        <div className="row">
                            {/* Fuel Type — SearchableSelect */}
                            {isFieldVisible('fuel_type') && (
                                <div className="form-group col-md-4 mb-3">
                                    <label className="fw-semibold mb-1">Fuel Type</label>
                                    <SearchableSelect
                                        triggerRef={specRefs.fuel_type}
                                        className="form-control"
                                        value={formData.fuel_type || 'diesel'}
                                        options={fuelOptions}
                                        placeholder="Select Fuel Type"
                                        onChange={(e) => handleInputChange('fuel_type', e.target.value)}
                                        onAfterSelect={() => focusNext('fuel_type')}
                                        onKeyDown={(e) => {
                                            if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                                                e.preventDefault();
                                                setActiveTab('basic');
                                                setTimeout(() => { basicRefs.narration?.current?.focus(); }, 100);
                                            } else if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                focusNext('fuel_type');
                                            }
                                        }}
                                    />
                                </div>
                            )}

                            {/* Mileage */}
                            {isFieldVisible('mileage') && (
                                <div className="form-group col-md-4 mb-3">
                                    <label className="fw-semibold mb-1">Mileage (km/l or km/charge)</label>
                                    <input
                                        ref={specRefs.mileage}
                                        type="number" step="0.01"
                                        className="form-control"
                                        placeholder="e.g. 15.5"
                                        value={formData.mileage || ''}
                                        onChange={(e) => handleInputChange('mileage', e.target.value)}
                                        onKeyDown={(e) => handleEnter(e, 'mileage')}
                                    />
                                </div>
                            )}

                            {/* Tonnage */}
                            {isFieldVisible('tonnage') && (
                                <div className="form-group col-md-4 mb-3">
                                    <label className="fw-semibold mb-1">Tonnage (tons)</label>
                                    <input
                                        ref={specRefs.tonnage}
                                        type="number" step="0.01"
                                        className="form-control"
                                        placeholder="e.g. 2.5"
                                        value={formData.tonnage || ''}
                                        onChange={(e) => handleInputChange('tonnage', e.target.value)}
                                        onKeyDown={(e) => handleEnter(e, 'tonnage')}
                                    />
                                </div>
                            )}

                            {/* Volume */}
                            {isFieldVisible('volume') && (
                                <div className="form-group col-md-4 mb-3">
                                    <label className="fw-semibold mb-1">Volume (m³)</label>
                                    <input
                                        ref={specRefs.volume}
                                        type="number" step="0.01"
                                        className="form-control"
                                        placeholder="e.g. 12.0"
                                        value={formData.volume || ''}
                                        onChange={(e) => handleInputChange('volume', e.target.value)}
                                        onKeyDown={(e) => handleEnter(e, 'volume')}
                                    />
                                </div>
                            )}

                            {/* Capacity */}
                            {isFieldVisible('capacity') && (
                                <div className="form-group col-md-4 mb-3">
                                    <label className="fw-semibold mb-1">Capacity (kg)</label>
                                    <input
                                        ref={specRefs.capacity}
                                        type="number" step="0.01"
                                        className="form-control"
                                        placeholder="e.g. 1500"
                                        value={formData.capacity || ''}
                                        onChange={(e) => handleInputChange('capacity', e.target.value)}
                                        onKeyDown={(e) => handleEnter(e, 'capacity')}
                                    />
                                </div>
                            )}

                            {/* Rate */}
                            {isFieldVisible('rate') && (
                                <div className="form-group col-md-4 mb-3">
                                    <label className="fw-semibold mb-1">Rate / standard cost</label>
                                    <input
                                        ref={specRefs.rate}
                                        type="number" step="0.01"
                                        className="form-control"
                                        placeholder="Rate"
                                        value={formData.rate || ''}
                                        onChange={(e) => handleInputChange('rate', e.target.value)}
                                        onKeyDown={(e) => handleEnter(e, 'rate')}
                                    />
                                </div>
                            )}

                            {/* Front Tyre Size — SearchableSelect */}
                            {isFieldVisible('front_tyre_size') && (
                                <div className="form-group col-md-6 mb-3">
                                    <label className="fw-semibold mb-1">Front Tyre Size</label>
                                    <SearchableSelect
                                        triggerRef={specRefs.front_tyre_size}
                                        name="front_tyre_size"
                                        className="form-control"
                                        placeholder="Select Front Tyre Size"
                                        value={formData.front_tyre_size || ''}
                                        onChange={(e) => handleInputChange('front_tyre_size', e.target.value)}
                                        onKeyDown={(e) => handleEnter(e, 'front_tyre_size')}
                                        options={tyreSizes.filter(t => t.tyre_type === 'front' || t.tyre_type === 'both').map(t => ({ value: t.size, label: t.size }))}
                                        onAfterSelect={() => {
                                            if (isFieldVisible('rear_tyre_size')) {
                                                specRefs.rear_tyre_size.current?.focus();
                                            }
                                        }}
                                    />
                                </div>
                            )}

                            {/* Rear Tyre Size — SearchableSelect */}
                            {isFieldVisible('rear_tyre_size') && (
                                <div className="form-group col-md-6 mb-3">
                                    <label className="fw-semibold mb-1">Rear Tyre Size</label>
                                    <SearchableSelect
                                        triggerRef={specRefs.rear_tyre_size}
                                        name="rear_tyre_size"
                                        className="form-control"
                                        placeholder="Select Rear Tyre Size"
                                        value={formData.rear_tyre_size || ''}
                                        onChange={(e) => handleInputChange('rear_tyre_size', e.target.value)}
                                        onKeyDown={(e) => handleEnter(e, 'rear_tyre_size')}
                                        options={tyreSizes.filter(t => t.tyre_type === 'rear' || t.tyre_type === 'both').map(t => ({ value: t.size, label: t.size }))}
                                        onAfterSelect={() => {
                                            if (isFieldVisible('vehicle_fasttag')) {
                                                specRefs.vehicle_fasttag.current?.focus();
                                            }
                                        }}
                                    />
                                </div>
                            )}

                            {/* Fasttag */}
                            {isFieldVisible('vehicle_fasttag') && (
                                <div className="form-group col-md-6 mb-3">
                                    <label className="fw-semibold mb-1">Vehicle Fasttag ID</label>
                                    <input
                                        ref={specRefs.vehicle_fasttag}
                                        type="text"
                                        className="form-control"
                                        placeholder="Fasttag code"
                                        value={formData.vehicle_fasttag || ''}
                                        onChange={(e) => handleInputChange('vehicle_fasttag', e.target.value)}
                                        onKeyDown={(e) => handleEnter(e, 'vehicle_fasttag')}
                                    />
                                </div>
                            )}

                            {/* Insurance Expiry Date */}
                            {isFieldVisible('vehicle_insurance_date') && (
                                <div className="form-group col-md-6 mb-3">
                                    <label className="fw-semibold mb-1">Insurance Expiry Date</label>
                                    <input
                                        ref={specRefs.vehicle_insurance_date}
                                        type="date"
                                        className="form-control"
                                        min={todayStr}
                                        value={formData.vehicle_insurance_date || ''}
                                        onChange={(e) => handleInputChange('vehicle_insurance_date', e.target.value)}
                                        onKeyDown={(e) => handleDateEnter(e, 'vehicle_insurance_date')}
                                        onBlur={() => handleDateBlur('vehicle_insurance_date')}
                                    />
                                </div>
                            )}

                            {/* Taxes Expiry Date */}
                            {isFieldVisible('vehicle_taxes_date') && (
                                <div className="form-group col-md-4 mb-3">
                                    <label className="fw-semibold mb-1">Taxes Expiry Date</label>
                                    <input
                                        ref={specRefs.vehicle_taxes_date}
                                        type="date"
                                        className="form-control"
                                        min={todayStr}
                                        value={formData.vehicle_taxes_date || ''}
                                        onChange={(e) => handleInputChange('vehicle_taxes_date', e.target.value)}
                                        onKeyDown={(e) => handleDateEnter(e, 'vehicle_taxes_date')}
                                        onBlur={() => handleDateBlur('vehicle_taxes_date')}
                                    />
                                </div>
                            )}

                            {/* Pollution Expiry Date */}
                            {isFieldVisible('vehicle_pollution_date') && (
                                <div className="form-group col-md-4 mb-3">
                                    <label className="fw-semibold mb-1">Pollution Expiry Date</label>
                                    <input
                                        ref={specRefs.vehicle_pollution_date}
                                        type="date"
                                        className="form-control"
                                        min={todayStr}
                                        value={formData.vehicle_pollution_date || ''}
                                        onChange={(e) => handleInputChange('vehicle_pollution_date', e.target.value)}
                                        onKeyDown={(e) => handleDateEnter(e, 'vehicle_pollution_date')}
                                        onBlur={() => handleDateBlur('vehicle_pollution_date')}
                                    />
                                </div>
                            )}

                            {/* Next Service Date */}
                            {isFieldVisible('next_service_date') && (
                                <div className="form-group col-md-4 mb-3">
                                    <label className="fw-semibold mb-1">Next Service Date</label>
                                    <input
                                        ref={specRefs.next_service_date}
                                        type="date"
                                        className="form-control"
                                        min={todayStr}
                                        value={formData.next_service_date || ''}
                                        onChange={(e) => handleInputChange('next_service_date', e.target.value)}
                                        onKeyDown={(e) => handleDateEnter(e, 'next_service_date')}
                                        onBlur={() => handleDateBlur('next_service_date')}
                                    />
                                </div>
                            )}

                            {/* Next Retest Date */}
                            {isFieldVisible('next_retest_date') && (
                                <div className="form-group col-md-4 mb-3">
                                    <label className="fw-semibold mb-1">Next Retest Date</label>
                                    <input
                                        ref={specRefs.next_retest_date}
                                        type="date"
                                        className="form-control"
                                        min={todayStr}
                                        value={formData.next_retest_date || ''}
                                        onChange={(e) => handleInputChange('next_retest_date', e.target.value)}
                                        onKeyDown={(e) => handleDateEnter(e, 'next_retest_date')}
                                        onBlur={() => handleDateBlur('next_retest_date')}
                                    />
                                </div>
                            )}
                        </div>
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

export default VehicleForm;