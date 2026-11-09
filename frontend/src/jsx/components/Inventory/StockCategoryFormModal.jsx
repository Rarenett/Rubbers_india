import React, { useState, useEffect, useRef } from 'react';
import { Button, Modal, Form, Nav, Tab } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { useFormConfig } from '../../../hooks/useFormConfig';
import {
    createStockCategory,
    updateStockCategory,
} from '../../../services/InventoryService';

const EMPTY_CATEGORY = {
    id: null,
    name: '',
    parent_category: null,
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
 * StockCategoryFormModal
 *
 * Props:
 *  - show               {boolean}      - controls modal visibility
 *  - onHide             {function}     - called when modal should close
 *  - onSaved            {function}     - called with the API-returned category object after a successful save
 *  - existingCategories {array}        - list of categories for the "Parent Category" dropdown
 *  - editCategory       {object|null}  - pass a category object to edit; null/undefined for create mode
 */
const StockCategoryFormModal = ({ show, onHide, onSaved, existingCategories = [], editCategory = null }) => {
    const { isFieldVisible } = useFormConfig('inventory_app_stockcategory', 'StockCategoryFormModal');
    const [currentCategory, setCurrentCategory] = useState({ ...EMPTY_CATEGORY });
    const [editMode, setEditMode] = useState(false);
    const [activeTab, setActiveTab] = useState('general');
    const [nameDuplicate, setNameDuplicate] = useState(false);
    const currentSelectControlRef = useRef(null);

    // Populate form when editCategory changes or modal opens
    useEffect(() => {
        if (show) {
            setActiveTab('general');
            setNameDuplicate(false);
            if (editCategory) {
                const hsn = editCategory.hsn_codes && editCategory.hsn_codes.length > 0 ? editCategory.hsn_codes[0] : {};
                const gst = editCategory.gst_rates && editCategory.gst_rates.length > 0 ? editCategory.gst_rates[0] : {};
                setCurrentCategory({
                    id: editCategory.id,
                    name: editCategory.name || '',
                    parent_category: editCategory.parent_category || null,
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
                setCurrentCategory({ ...EMPTY_CATEGORY });
                setEditMode(false);
            }
        }
    }, [show, editCategory]);

    // Auto-focus first input when modal/tab changes
    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                const inputs = Array.from(
                    document.querySelectorAll('.scfm-modal input:not([disabled]):not([readonly])')
                ).filter(el => el.offsetParent !== null && el.type !== 'hidden');
                if (inputs.length > 0) inputs[0].focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [show, activeTab]);

    // ── Keyboard navigation ──────────────────────────────────────────────
    const getFocusable = () => {
        const modal = document.querySelector('.scfm-modal');
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
        setCurrentCategory({ ...EMPTY_CATEGORY });
        setActiveTab('general');
        setNameDuplicate(false);
        onHide();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (activeTab === 'general') {
            if (!currentCategory.name.trim()) {
                Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Category name is required' });
                return;
            }
            if (nameDuplicate) {
                Swal.fire({ icon: 'warning', title: 'Duplicate Name', text: `A stock category named "${currentCategory.name.trim()}" already exists.` });
                return;
            }
            setActiveTab('hsn');
            return;
        }

        if (activeTab === 'hsn') {
            if (currentCategory.hsn_number && !currentCategory.hsn_applicable_date) {
                Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'HSN Applicable Date is required when HSN Number is specified' });
                return;
            }
            if (currentCategory.hsn_applicable_date) {
                const year = parseInt(currentCategory.hsn_applicable_date.split('-')[0], 10);
                if (year < 1000) {
                    Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please enter a valid 4-digit year for HSN Applicable Date' });
                    return;
                }
            }
            setActiveTab('gst');
            return;
        }

        if (activeTab === 'gst') {
            if (parseFloat(currentCategory.igst_percent) > 0 && !currentCategory.gst_applicable_date) {
                Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'GST Applicable Date is required when IGST is specified' });
                return;
            }
            if (currentCategory.gst_applicable_date) {
                const year = parseInt(currentCategory.gst_applicable_date.split('-')[0], 10);
                if (year < 1000) {
                    Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please enter a valid 4-digit year for GST Applicable Date' });
                    return;
                }
            }

            try {
                const payload = {
                    name: currentCategory.name.trim(),
                    parent_category: currentCategory.parent_category || null,
                    hsn_codes: [],
                    gst_rates: []
                };

                if (currentCategory.hsn_number && currentCategory.hsn_applicable_date) {
                    payload.hsn_codes.push({
                        hsn_number: currentCategory.hsn_number,
                        applicable_date: currentCategory.hsn_applicable_date
                    });
                }

                if (currentCategory.gst_applicable_date) {
                    payload.gst_rates.push({
                        tax_gst_type: currentCategory.tax_gst_type,
                        igst_percent: parseFloat(currentCategory.igst_percent) || 0,
                        cgst_percent: parseFloat(currentCategory.cgst_percent) || 0,
                        sgst_percent: parseFloat(currentCategory.sgst_percent) || 0,
                        cess_percent: parseFloat(currentCategory.cess_percent) || 0,
                        applicable_date: currentCategory.gst_applicable_date
                    });
                }

                let savedCategory;
                if (editMode) {
                    savedCategory = await updateStockCategory(currentCategory.id, payload);
                    Swal.fire({ icon: 'success', title: 'Updated', text: 'Stock category updated successfully', timer: 2000, showConfirmButton: false });
                } else {
                    savedCategory = await createStockCategory(payload);
                    Swal.fire({ icon: 'success', title: 'Created', text: 'Stock category created successfully', timer: 2000, showConfirmButton: false });
                }
                handleClose();
                if (onSaved) onSaved(savedCategory);
            } catch (error) {
                let errorMsg = `Failed to ${editMode ? 'update' : 'create'} stock category`;
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

    const parentCategoryOptions = existingCategories
        .filter(c => !editMode || c.id !== currentCategory.id)
        .map(c => ({ value: c.id, label: c.name }));

    const parentCategoryValue = parentCategoryOptions.find(opt => opt.value === currentCategory.parent_category) || null;

    return (
        <>
            <style>{`
                .scfm-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
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
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
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
                .scfm-modal .modal-body-custom { padding: 0; }
                .scfm-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .scfm-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .scfm-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .scfm-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .scfm-modal .form-control-custom::placeholder { color: #94a3b8; }
                .scfm-modal .btn-close-custom {
                    background-color: #7A70BA !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .scfm-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .scfm-modal .btn-save-custom {
                    background-color: #2ece8a !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .scfm-modal .btn-save-custom:hover { background-color: #26b277 !important; }
                .scfm-custom-tabs {
                    border-bottom: 1px solid #e2e8f0;
                    padding: 0 28px;
                    background: #fff;
                }
                .scfm-custom-tabs .nav-link {
                    color: #64748b;
                    font-weight: 500;
                    padding: 16px 20px;
                    border: none;
                    border-bottom: 2px solid transparent;
                    margin-bottom: -1px;
                    transition: all 0.2s;
                }
                .scfm-custom-tabs .nav-link:hover { color: #475569; border-bottom-color: #cbd5e1; }
                .scfm-custom-tabs .nav-link.active {
                    color: #2ece8a;
                    background: transparent;
                    border-bottom-color: #2ece8a;
                }
                .scfm-tab-content { padding: 24px 28px; }
            `}</style>

            <Modal
                show={show}
                onHide={handleClose}
                dialogClassName="scfm-modal modal-lg"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Stock Category' : 'Create Stock Category'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage stock category
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleClose}>&times;</button>
                </div>

                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown} onFocus={handleFocus}>
                    <div className="modal-body-custom">
                        <Tab.Container activeKey={activeTab} onSelect={(key) => setActiveTab(key)}>
                            <Nav className="scfm-custom-tabs">
                                <Nav.Item><Nav.Link eventKey="general">General Info</Nav.Link></Nav.Item>
                                <Nav.Item><Nav.Link eventKey="hsn">HSN Details</Nav.Link></Nav.Item>
                                <Nav.Item><Nav.Link eventKey="gst">GST Details</Nav.Link></Nav.Item>
                            </Nav>

                            <Tab.Content className="scfm-tab-content">
                                <Tab.Pane eventKey="general">
                                    <div className="row">
                                        {isFieldVisible('name') && (
                                            <div className="col-md-12 mb-3">
                                                <Form.Label className="form-label-custom">Category Name <span className="text-danger">*</span></Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    className="form-control-custom"
                                                    value={currentCategory.name}
                                                    onChange={(e) => setCurrentCategory({ ...currentCategory, name: e.target.value })}
                                                    placeholder="Enter stock category name"
                                                />
                                            </div>
                                        )}
                                        {isFieldVisible('parent_category') && (
                                            <div className="col-md-12 mb-3">
                                                <Form.Label className="form-label-custom">Parent Category</Form.Label>
                                                <Select
                                                    classNamePrefix="react-select"
                                                    isClearable
                                                    options={parentCategoryOptions}
                                                    value={parentCategoryValue}
                                                    onChange={(opt) => {
                                                        setCurrentCategory({ ...currentCategory, parent_category: opt ? opt.value : null });
                                                        if (opt) {
                                                            const control = currentSelectControlRef.current;
                                                            setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
                                                        }
                                                    }}
                                                    onFocus={handleSelectFocus}
                                                    onKeyDown={handleSelectKeyDown}
                                                    openMenuOnFocus={true}
                                                    placeholder="Select parent category (optional)"
                                                    styles={selectStyles}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </Tab.Pane>

                                <Tab.Pane eventKey="hsn">
                                    <div className="row">
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">HSN Number</Form.Label>
                                            <Form.Control
                                                type="text"
                                                className="form-control-custom"
                                                value={currentCategory.hsn_number}
                                                onChange={(e) => setCurrentCategory({ ...currentCategory, hsn_number: e.target.value })}
                                                placeholder="Enter HSN Code"
                                            />
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">Applicable Date</Form.Label>
                                            <Form.Control
                                                type="date"
                                                className="form-control-custom"
                                                value={currentCategory.hsn_applicable_date}
                                                onChange={(e) => setCurrentCategory({ ...currentCategory, hsn_applicable_date: e.target.value })}
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
                                                value={{ value: currentCategory.tax_gst_type, label: currentCategory.tax_gst_type ? currentCategory.tax_gst_type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Goods' }}
                                                onChange={(opt) => {
                                                    setCurrentCategory({ ...currentCategory, tax_gst_type: opt ? opt.value : 'goods' });
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
                                                value={currentCategory.gst_applicable_date}
                                                onChange={(e) => setCurrentCategory({ ...currentCategory, gst_applicable_date: e.target.value })}
                                            />
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">IGST (%)</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                className="form-control-custom"
                                                value={currentCategory.igst_percent}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const half = val ? (parseFloat(val) / 2).toFixed(2) : 0;
                                                    setCurrentCategory({ ...currentCategory, igst_percent: val, cgst_percent: half, sgst_percent: half });
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
                                                value={currentCategory.cess_percent}
                                                onChange={(e) => setCurrentCategory({ ...currentCategory, cess_percent: e.target.value })}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">CGST (%)</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                className="form-control-custom"
                                                value={currentCategory.cgst_percent}
                                                readOnly disabled
                                            />
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">SGST (%)</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                className="form-control-custom"
                                                value={currentCategory.sgst_percent}
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

export default StockCategoryFormModal;
