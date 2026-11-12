import React, { useState, useEffect, useRef } from 'react';
import { Button, Modal, Form, Nav, Tab } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { useFormConfig } from '../../../hooks/useFormConfig';
import {
    createStockGroup,
    updateStockGroup,
} from '../../../services/InventoryService';

const EMPTY_GROUP = {
    id: null,
    name: '',
    parent_group: null,
    is_parent_group: false,
    include_in_definition: false,
    hsn_number: '',
    hsn_applicable_date: new Date().toISOString().split('T')[0],
    tax_gst_type: 'goods',
    igst_percent: 0,
    cgst_percent: 0,
    sgst_percent: 0,
    cess_percent: 0,
    gst_applicable_date: new Date().toISOString().split('T')[0]
};

/**
 * StockGroupFormModal
 *
 * Props:
 *  - show         {boolean}   - controls modal visibility
 *  - onHide       {function}  - called when modal should close
 *  - onSaved      {function}  - called with the API-returned group object after a successful save
 *  - existingGroups {array}   - list of groups for the "Parent Group" dropdown
 *  - editGroup    {object|null} - pass a group object to edit; null/undefined for create mode
 */
const toTitleCase = (str) => {
    if (!str) return '';
    return str.replace(/\b\w/g, char => char.toUpperCase());
};

const StockGroupFormModal = ({ show, onHide, onSaved, existingGroups = [], editGroup = null }) => {
    const { isFieldVisible } = useFormConfig('inventory_app_stockgroup', 'StockGroupFormModal');
    const [currentGroup, setCurrentGroup] = useState({ ...EMPTY_GROUP });
    const [editMode, setEditMode] = useState(false);
    const [activeTab, setActiveTab] = useState('general');
    const [nameDuplicate, setNameDuplicate] = useState(false);
    const currentSelectControlRef = useRef(null);

    // Populate form when editGroup changes or modal opens
    useEffect(() => {
        if (show) {
            setActiveTab('general');
            if (editGroup) {
                const hsn = editGroup.hsn_codes && editGroup.hsn_codes.length > 0 ? editGroup.hsn_codes[0] : {};
                const gst = editGroup.gst_rates && editGroup.gst_rates.length > 0 ? editGroup.gst_rates[0] : {};
                setCurrentGroup({
                    id: editGroup.id,
                    name: toTitleCase(editGroup.name || ''),
                    parent_group: editGroup.parent_group || null,
                    is_parent_group: Boolean(editGroup.is_parent_group),
                    include_in_definition: Boolean(editGroup.include_in_definition),
                    hsn_number: hsn.hsn_number || '',
                    hsn_applicable_date: hsn.applicable_date || '',
                    tax_gst_type: gst.tax_gst_type || 'goods',
                    igst_percent: gst.igst_percent || 0,
                    cgst_percent: gst.cgst_percent || 0,
                    sgst_percent: gst.sgst_percent || 0,
                    cess_percent: gst.cess_percent || 0,
                    gst_applicable_date: gst.applicable_date || ''
                });
                setEditMode(true);
            } else {
                setCurrentGroup({ ...EMPTY_GROUP, include_in_definition: false });
                setEditMode(false);
            }
        }
    }, [show, editGroup]);

    // Auto-focus first input when modal/tab changes
    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                const inputs = Array.from(
                    document.querySelectorAll('.sgfm-modal input:not([disabled]):not([readonly])')
                ).filter(el => el.offsetParent !== null && el.type !== 'hidden');
                if (inputs.length > 0) inputs[0].focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [show, activeTab]);

    // ── Keyboard navigation ──────────────────────────────────────────────
    const getFocusable = () => {
        const modal = document.querySelector('.sgfm-modal');
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.form-control-custom, .react-select__control, button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const focusNextFromControl = (control) => {
        const all = getFocusable();
        const index = all.indexOf(control);
        if (index > -1 && index < all.length - 1) {
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else {
                const next = all[index + 1];
                if (next.classList.contains('react-select__control')) {
                    next.querySelector('input')?.focus();
                } else {
                    next.focus();
                }
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;

        if (e.target.closest('.react-select') || e.target.closest('.react-select__control')) {
            return;
        }

        const activeEl = document.activeElement;
        if (activeEl && activeEl.type === 'date' && activeEl.value) {
            const year = parseInt(activeEl.value.split('-')[0], 10);
            if (year < 1000) {
                e.preventDefault();
                Swal.fire({ icon: 'warning', title: 'Invalid Date', text: 'Please enter a valid 4-digit year (e.g. 2026).' });
                return;
            }
        }
        const all = getFocusable();
        const index = all.indexOf(activeEl);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            const next = all[index + 1];
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else if (next.classList.contains('react-select__control')) {
                next.querySelector('input')?.focus();
            } else {
                next.focus();
            }
        }
    };

    const handleSelectFocus = (e) => {
        currentSelectControlRef.current = e.target.closest('.react-select__control');
    };

    const handleSelectKeyDown = (e) => {
        if (e.key === 'Enter') {
            const menuOpen = !!document.querySelector('.react-select__menu');
            if (!menuOpen) {
                e.preventDefault();
                e.stopPropagation();
                const control = e.target.closest('.react-select__control');
                if (control) focusNextFromControl(control);
            } else {
                e.stopPropagation();
            }
        }
    };

    const handleFocus = (e) => {
        if (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.type === 'text')) {
            e.target.select();
        }
    };
    // ─────────────────────────────────────────────────────────────────────

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#6d4aff' : '#e0e0e0',
            boxShadow: state.isFocused ? '0 0 0 2px rgba(109,74,255,0.15)' : 'none',
            '&:hover': { borderColor: '#6d4aff' },
            borderRadius: '6px',
            fontSize: '0.875rem',
        }),
        menu: base => ({ ...base, zIndex: 99999, fontSize: '0.875rem' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#6d4aff' : state.isFocused ? '#f0ecff' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    const handleClose = () => {
        setCurrentGroup({ ...EMPTY_GROUP, include_in_definition: false });
        setActiveTab('general');
        onHide();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (activeTab === 'general') {
            if (!currentGroup.name.trim()) {
                Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Group name is required' });
                return;
            }
            if (nameDuplicate) {
                Swal.fire({ icon: 'warning', title: 'Duplicate Name', text: `A stock group named "${currentGroup.name.trim()}" already exists.` });
                return;
            }
            setActiveTab('hsn');
            return;
        }

        if (activeTab === 'hsn') {
            if (currentGroup.hsn_number && !currentGroup.hsn_applicable_date) {
                Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'HSN Applicable Date is required when HSN Number is specified' });
                return;
            }
            if (currentGroup.hsn_applicable_date) {
                const year = parseInt(currentGroup.hsn_applicable_date.split('-')[0], 10);
                if (year < 1000) {
                    Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please enter a valid 4-digit year for HSN Applicable Date' });
                    return;
                }
            }
            setActiveTab('gst');
            return;
        }

        if (activeTab === 'gst') {
            if (parseFloat(currentGroup.igst_percent) > 0 && !currentGroup.gst_applicable_date) {
                Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'GST Applicable Date is required when IGST is specified' });
                return;
            }
            if (currentGroup.gst_applicable_date) {
                const year = parseInt(currentGroup.gst_applicable_date.split('-')[0], 10);
                if (year < 1000) {
                    Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please enter a valid 4-digit year for GST Applicable Date' });
                    return;
                }
            }

            try {
                const payload = {
                    name: currentGroup.name.trim().toLowerCase(),
                    parent_group: currentGroup.is_parent_group ? null : (currentGroup.parent_group || null),
                    is_parent_group: !!currentGroup.is_parent_group,
                    include_in_definition: !!currentGroup.include_in_definition,
                    hsn_codes: [],
                    gst_rates: []
                };

                if (currentGroup.hsn_number && currentGroup.hsn_applicable_date) {
                    payload.hsn_codes.push({
                        hsn_number: currentGroup.hsn_number,
                        applicable_date: currentGroup.hsn_applicable_date
                    });
                }

                if (currentGroup.gst_applicable_date) {
                    payload.gst_rates.push({
                        tax_gst_type: currentGroup.tax_gst_type,
                        igst_percent: parseFloat(currentGroup.igst_percent) || 0,
                        cgst_percent: parseFloat(currentGroup.cgst_percent) || 0,
                        sgst_percent: parseFloat(currentGroup.sgst_percent) || 0,
                        cess_percent: parseFloat(currentGroup.cess_percent) || 0,
                        applicable_date: currentGroup.gst_applicable_date
                    });
                }

                let savedGroup;
                if (editMode) {
                    savedGroup = await updateStockGroup(currentGroup.id, payload);
                    Swal.fire({ icon: 'success', title: 'Updated', text: 'Stock group updated successfully', timer: 2000, showConfirmButton: false });
                } else {
                    savedGroup = await createStockGroup(payload);
                    Swal.fire({ icon: 'success', title: 'Created', text: 'Stock group created successfully', timer: 2000, showConfirmButton: false });
                }
                handleClose();
                if (onSaved) onSaved(savedGroup);
            } catch (error) {
                let errorMsg = `Failed to ${editMode ? 'update' : 'create'} stock group`;
                if (error.response && error.response.data) {
                    const data = error.response.data;
                    if (typeof data === 'object') {
                        errorMsg = Object.keys(data)
                            .map(key => `${key.replace('_', ' ').toUpperCase()}: ${data[key]}`)
                            .join('\n');
                    } else if (typeof data === 'string') {
                        errorMsg = data;
                    }
                }
                Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
            }
        }
    };

    const parentGroupOptions = existingGroups
        .filter(g => !editMode || g.id !== currentGroup.id)
        .map(g => ({ value: g.id, label: toTitleCase(g.name) }));

    const parentGroupValue = parentGroupOptions.find(opt => opt.value === currentGroup.parent_group) || null;

    return (
        <>
            <style>{`
                .sgfm-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .sgfm-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .sgfm-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .sgfm-modal .modal-close-x {
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
                .sgfm-modal .modal-close-x:hover { color: #555; }
                .sgfm-modal .modal-body-custom { padding: 0; }
                .sgfm-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .sgfm-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .sgfm-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .sgfm-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .sgfm-modal .form-control-custom::placeholder { color: #94a3b8; }
                .sgfm-modal .btn-close-custom {
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
                .sgfm-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .sgfm-modal .btn-save-custom {
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
                .sgfm-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                .sgfm-custom-tabs {
                    border-bottom: 1px solid #e2e8f0;
                    padding: 0 28px;
                    background: #fff;
                }
                .sgfm-custom-tabs .nav-link {
                    color: #64748b;
                    font-weight: 500;
                    padding: 16px 20px;
                    border: none;
                    border-bottom: 2px solid transparent;
                    margin-bottom: -1px;
                    transition: all 0.2s;
                }
                .sgfm-custom-tabs .nav-link:hover { color: #475569; border-bottom-color: #cbd5e1; }
                .sgfm-custom-tabs .nav-link.active {
                    color: var(--cc-primary, #0a500f);
                    background: transparent;
                    border-bottom-color: var(--cc-primary, #0a500f);
                }
                .sgfm-tab-content { padding: 24px 28px; }
            `}</style>

            <Modal
                show={show}
                onHide={handleClose}
                dialogClassName="sgfm-modal modal-lg"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Stock Group' : 'Create Stock Group'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage stock group
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleClose}>&times;</button>
                </div>

                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown} onFocus={handleFocus}>
                    <div className="modal-body-custom">
                        <Tab.Container activeKey={activeTab} onSelect={(key) => setActiveTab(key)}>
                            <Nav className="sgfm-custom-tabs">
                                <Nav.Item><Nav.Link eventKey="general">General Info</Nav.Link></Nav.Item>
                                <Nav.Item><Nav.Link eventKey="hsn">HSN Details</Nav.Link></Nav.Item>
                                <Nav.Item><Nav.Link eventKey="gst">GST Details</Nav.Link></Nav.Item>
                            </Nav>

                            <Tab.Content className="sgfm-tab-content">
                                <Tab.Pane eventKey="general">
                                    <div className="row">
                                        {isFieldVisible('name') && (
                                            <div className="col-md-12 mb-3">
                                                <Form.Label className="form-label-custom">Group Name <span className="text-danger">*</span></Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    className="form-control-custom"
                                                    value={currentGroup.name}
                                                    onChange={(e) => setCurrentGroup({ ...currentGroup, name: toTitleCase(e.target.value) })}
                                                    placeholder="Enter stock group name"
                                                    required
                                                />
                                            </div>
                                        )}
                                        <div className="col-md-12 mb-3 mt-2">
                                            <Form.Check
                                                type="checkbox"
                                                id="is_parent_group"
                                                label={
                                                    <span style={{ fontSize: '14px', color: '#1e293b', fontWeight: 600 }}>
                                                        Is Parent Group
                                                        <span
                                                            className="ms-2"
                                                            style={{
                                                                fontSize: '12px',
                                                                fontWeight: 400,
                                                                color: '#64748b',
                                                            }}
                                                        >
                                                            — If checked, this group acts as a top-level parent and cannot be edited or deleted
                                                        </span>
                                                    </span>
                                                }
                                                checked={!!currentGroup.is_parent_group}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setCurrentGroup(prev => ({
                                                        ...prev,
                                                        is_parent_group: checked,
                                                        // Clear parent_group when marked as parent
                                                        parent_group: checked ? null : prev.parent_group,
                                                    }));
                                                }}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            {currentGroup.is_parent_group && (
                                                <div
                                                    className="mt-2 d-flex align-items-center gap-2 px-3 py-2 rounded"
                                                    style={{
                                                        background: '#fff8e1',
                                                        border: '1px solid #fbbf24',
                                                        fontSize: '12.5px',
                                                        color: '#92400e',
                                                    }}
                                                >
                                                    <i className="fa fa-shield-alt" style={{ color: '#f59e0b' }}></i>
                                                    <span>This group will be locked after saving. Edit and Delete will be disabled.</span>
                                                </div>
                                            )}
                                        </div>
                                        {isFieldVisible('parent_group') && !currentGroup.is_parent_group && (
                                            <div className="col-md-12 mb-3">
                                                <Form.Label className="form-label-custom">Parent Group</Form.Label>
                                                <Select
                                                    classNamePrefix="react-select"
                                                    isClearable
                                                    options={parentGroupOptions}
                                                    value={parentGroupValue}
                                                    onChange={(opt) => {
                                                        setCurrentGroup({ ...currentGroup, parent_group: opt ? opt.value : null });
                                                        if (opt) {
                                                            const control = currentSelectControlRef.current;
                                                            setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
                                                        }
                                                    }}
                                                    onFocus={handleSelectFocus}
                                                    onKeyDown={handleSelectKeyDown}
                                                    openMenuOnFocus={true}
                                                    placeholder="Select parent group (optional)"
                                                    styles={selectStyles}
                                                />
                                            </div>
                                        )}
                                        <div className="col-md-12 mb-3 mt-2">
                                            <Form.Check
                                                type="checkbox"
                                                id="include_in_definition"
                                                label="Include in Definition"
                                                checked={!!currentGroup.include_in_definition}
                                                onChange={(e) => setCurrentGroup({ ...currentGroup, include_in_definition: e.target.checked })}
                                                style={{ fontSize: '14px', color: '#4a5568', fontWeight: 500, cursor: 'pointer' }}
                                            />
                                        </div>
                                    </div>
                                </Tab.Pane>

                                <Tab.Pane eventKey="hsn">
                                    <div className="row">
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">HSN Number</Form.Label>
                                            <Form.Control
                                                type="text"
                                                className="form-control-custom"
                                                value={currentGroup.hsn_number}
                                                onChange={(e) => setCurrentGroup({ ...currentGroup, hsn_number: e.target.value })}
                                                placeholder="Enter HSN Code"
                                            />
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">Applicable Date</Form.Label>
                                            <Form.Control
                                                type="date"
                                                className="form-control-custom"
                                                value={currentGroup.hsn_applicable_date}
                                                onChange={(e) => setCurrentGroup({ ...currentGroup, hsn_applicable_date: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </Tab.Pane>

                                <Tab.Pane eventKey="gst">
                                    <div className="row">
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">Taxability Type</Form.Label>
                                            <Select
                                                classNamePrefix="react-select"
                                                options={[
                                                    { value: 'goods', label: 'Goods' },
                                                    { value: 'services', label: 'Services' },
                                                    { value: 'exempt', label: 'Exempt' },
                                                    { value: 'nil_rated', label: 'Nil Rated' },
                                                    { value: 'non_gst', label: 'Non GST' },
                                                ]}
                                                value={{ value: currentGroup.tax_gst_type, label: currentGroup.tax_gst_type ? currentGroup.tax_gst_type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Goods' }}
                                                onChange={(opt) => {
                                                    setCurrentGroup({ ...currentGroup, tax_gst_type: opt ? opt.value : 'goods' });
                                                    if (opt) {
                                                        const control = currentSelectControlRef.current;
                                                        setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
                                                    }
                                                }}
                                                onFocus={handleSelectFocus}
                                                onKeyDown={handleSelectKeyDown}
                                                openMenuOnFocus={true}
                                                styles={selectStyles}
                                            />
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">Applicable Date</Form.Label>
                                            <Form.Control
                                                type="date"
                                                className="form-control-custom"
                                                value={currentGroup.gst_applicable_date}
                                                onChange={(e) => setCurrentGroup({ ...currentGroup, gst_applicable_date: e.target.value })}
                                            />
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">IGST (%)</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                className="form-control-custom"
                                                value={currentGroup.igst_percent}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const half = val ? (parseFloat(val) / 2).toFixed(2) : 0;
                                                    setCurrentGroup({ ...currentGroup, igst_percent: val, cgst_percent: half, sgst_percent: half });
                                                }}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">CESS (%)</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                className="form-control-custom"
                                                value={currentGroup.cess_percent}
                                                onChange={(e) => setCurrentGroup({ ...currentGroup, cess_percent: e.target.value })}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">CGST (%)</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                className="form-control-custom"
                                                value={currentGroup.cgst_percent}
                                                readOnly disabled
                                            />
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">SGST (%)</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                className="form-control-custom"
                                                value={currentGroup.sgst_percent}
                                                readOnly disabled
                                            />
                                        </div>
                                    </div>
                                </Tab.Pane>
                            </Tab.Content>
                        </Tab.Container>
                    </div>

                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={handleClose}>Close</Button>
                        <Button type="submit" className="btn-save-custom">
                            {activeTab === 'gst' ? 'Save' : 'Save & Next'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </>
    );
};

export default StockGroupFormModal;
