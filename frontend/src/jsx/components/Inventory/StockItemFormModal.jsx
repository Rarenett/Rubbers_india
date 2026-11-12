import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Modal, Form, Nav, Tab, Button } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { createStockItem, updateStockItem } from '../../../services/InventoryService';
import StockGroupFormModal from './StockGroupFormModal';
import StockCategoryFormModal from './StockCategoryFormModal';
import BatchEntryModal from './BatchEntryModal';

const NOT_APPLICABLE_OPTION = { value: '', label: 'Not Applicable' };
const TAX_TYPE_OPTIONS = [
    { value: 'goods', label: 'Goods' },
    { value: 'services', label: 'Services' },
    { value: 'exempt', label: 'Exempt' },
    { value: 'nil_rated', label: 'Nil Rated' },
    { value: 'non_gst', label: 'Non GST' },
];

const EMPTY_ITEM = {
    id: null,
    name: '',
    item_code: '',
    stock_group: '',
    stock_category: '',
    base_unit: '',
    alternate_unit: '',
    conversion_value: 1,
    maintain_batch: false,
    maintain_manufacture_date: false,
    maintain_expiry_date: false,
    has_bom: false,
    opening_stock: 0,
    opening_rate: 0,
    opening_value: 0,
    mrp: 0,
    sb_rate: 0,
    ss_rate: 0,
    hsn_number: '',
    hsn_applicable_date: new Date().toISOString().split('T')[0],
    tax_gst_type: 'goods',
    igst_percent: 0,
    cgst_percent: 0,
    sgst_percent: 0,
    cess_percent: 0,
    gst_applicable_date: new Date().toISOString().split('T')[0],
    image: null,
    image_url: null,
};

const getValId = (val) => {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'object' && val !== null && val.id !== undefined) return val.id;
    return val;
};

const StockItemFormModal = ({ 
    show, 
    onHide, 
    itemToEdit, 
    existingItems, 
    groups, 
    categories, 
    units, 
    warehouses, 
    onSave, 
    refreshDropdowns 
}) => {
    const [editMode, setEditMode] = useState(false);
    const [animateTrigger, setAnimateTrigger] = useState(false);
    const [currentItem, setCurrentItem] = useState({ ...EMPTY_ITEM });
    const [activeTab, setActiveTab] = useState('general');
    const [nameDuplicate, setNameDuplicate] = useState(false);

    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchRows, setBatchRows] = useState([]);

    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);

    const currentSelectControlRef = useRef(null);
    const submitButtonRef = useRef(null);
    const imageUploadRef = useRef(null);

    useEffect(() => {
        if (show) {
            setActiveTab('general');
            setNameDuplicate(false);
            if (itemToEdit) {
                const hsn = itemToEdit.hsn_codes && itemToEdit.hsn_codes.length > 0 ? itemToEdit.hsn_codes[0] : {};
                const gst = itemToEdit.item_gst_rates && itemToEdit.item_gst_rates.length > 0 ? itemToEdit.item_gst_rates[0] : {};
                setCurrentItem({
                    ...itemToEdit,
                    stock_group: getValId(itemToEdit.stock_group) || getValId(itemToEdit.group) || getValId(itemToEdit.stock_group_id) || '',
                    stock_category: getValId(itemToEdit.stock_category) || getValId(itemToEdit.category) || getValId(itemToEdit.stock_category_id) || '',
                    base_unit: getValId(itemToEdit.base_unit) || getValId(itemToEdit.unit) || getValId(itemToEdit.base_unit_id) || '',
                    alternate_unit: getValId(itemToEdit.alternate_unit) || getValId(itemToEdit.alternate_unit_id) || '',
                    hsn_number: hsn.hsn_number || '',
                    hsn_applicable_date: hsn.applicable_date || '',
                    tax_gst_type: gst.tax_gst_type || 'goods',
                    has_bom: itemToEdit.has_bom || false,
                    igst_percent: gst.igst_percent || 0,
                    cgst_percent: gst.cgst_percent || 0,
                    sgst_percent: gst.sgst_percent || 0,
                    cess_percent: gst.cess_percent || 0,
                    gst_applicable_date: gst.applicable_date || '',
                    image: null,
                    image_url: itemToEdit.image_url || null
                });
                setBatchRows(
                    (itemToEdit.existing_batch_entries || []).map(e => ({
                        warehouse: e.warehouse ?? '',
                        batch_number: e.batch_number ?? '',
                        manufacture_date: e.manufacture_date ?? '',
                        expiry_date: e.expiry_date ?? '',
                        quantity: e.quantity !== undefined ? String(e.quantity) : '',
                    }))
                );
                setImageFile(null);
                setImagePreview(itemToEdit.image_url || null);
                setEditMode(true);
            } else {
                setCurrentItem({ ...EMPTY_ITEM });
                setBatchRows([]);
                setImageFile(null);
                setImagePreview(null);
                setEditMode(false);
            }
        }
    }, [show, itemToEdit]);

    useEffect(() => {
        const handleKeyDownEscape = (e) => {
            if (e.key === 'Escape' && show) {
                setAnimateTrigger(true);
                setTimeout(() => setAnimateTrigger(false), 300);
            }
        };
        window.addEventListener('keydown', handleKeyDownEscape);
        return () => window.removeEventListener('keydown', handleKeyDownEscape);
    }, [show]);

    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                const inputs = Array.from(
                    document.querySelectorAll('.item-custom-modal input:not([disabled]):not([readonly])')
                ).filter(el => el.offsetParent !== null && el.type !== 'hidden');
                if (inputs.length > 0) {
                    inputs[0].focus();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [show, activeTab]);

    const handleCloseModal = () => {
        setCurrentItem({ ...EMPTY_ITEM });
        setBatchRows([]);
        setImageFile(null);
        setImagePreview(null);
        setActiveTab('general');
        setNameDuplicate(false);
        onHide();
    };

    const getFocusable = () => {
        const modal = document.querySelector('.item-custom-modal');
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.form-control-custom, input[type="checkbox"]:not([disabled]), .react-select__control, .image-upload-btn, button[type="submit"]:not([disabled])'
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

        // If Enter originated from within a react-select, let handleSelectKeyDown handle it
        if (e.target.closest('.react-select') || e.target.closest('.react-select__control')) {
            return;
        }

        const all = getFocusable();
        const active = document.activeElement?.closest?.('.react-select__control') || document.activeElement;
        const index = all.indexOf(active);
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
                // Menu is open: let react-select select the option, but stop bubbling
                // so parent form's handleKeyDown does not advance focus prematurely
                e.stopPropagation();
            }
        }
    };

    const makeSelectChange = (field) => (opt) => {
        setCurrentItem(prev => ({ ...prev, [field]: opt ? opt.value : '' }));
        if (opt !== null) {
            const control = currentSelectControlRef.current;
            setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
        }
    };

    const handleGroupSaved = async (savedGroup) => {
        if (refreshDropdowns) {
            await refreshDropdowns();
        }
        if (savedGroup && savedGroup.id) {
            setCurrentItem(prev => ({ ...prev, stock_group: savedGroup.id }));
        }
    };

    const handleCategorySaved = async (savedCategory) => {
        if (refreshDropdowns) {
            await refreshDropdowns();
        }
        if (savedCategory && savedCategory.id) {
            setCurrentItem(prev => ({ ...prev, stock_category: savedCategory.id }));
        }
    };

    const handleFocus = (e) => {
        if (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.type === 'text')) {
            e.target.select();
        }
    };

    const toOptions = (arr, labelFn) => (arr || []).map(item => ({ value: item.id, label: labelFn(item) }));
    const findOption = (options, value) => {
        const targetId = getValId(value);
        return options.find(o => String(o.value) === String(targetId)) || null;
    };

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#6d4aff' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 2px rgba(109,74,255,0.15)' : 'none',
            '&:hover': { borderColor: '#6d4aff' },
            borderRadius: '10px',
            fontSize: '14px',
        }),
        menu: base => ({ ...base, zIndex: 9999, fontSize: '0.875rem' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#6d4aff' : state.isFocused ? '#f0ecff' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    const handleNumericChange = (field, val) => {
        const numericVal = parseFloat(val) || 0;
        setCurrentItem(prev => {
            const updated = { ...prev, [field]: numericVal };
            if (field === 'opening_stock' || field === 'opening_rate') {
                const stock = field === 'opening_stock' ? numericVal : prev.opening_stock;
                const rate = field === 'opening_rate' ? numericVal : prev.opening_rate;
                updated.opening_value = parseFloat((stock * rate).toFixed(2));
            } else if (field === 'opening_value') {
                const stock = prev.opening_stock;
                if (stock > 0) {
                    updated.opening_rate = parseFloat((numericVal / stock).toFixed(2));
                }
            }
            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const groupId = getValId(currentItem.stock_group);
        const categoryId = getValId(currentItem.stock_category);
        const baseUnitId = getValId(currentItem.base_unit);
        const altUnitId = getValId(currentItem.alternate_unit);

        if (!currentItem.name || !currentItem.name.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Stock item name is required' });
            return;
        }
        if (nameDuplicate) {
            Swal.fire({ icon: 'warning', title: 'Duplicate Name', text: `A stock item named "${currentItem.name.trim()}" already exists.` });
            return;
        }
        if (!groupId) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Stock group selection is required' });
            return;
        }
        if (!baseUnitId) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Base unit selection is required' });
            return;
        }

        if (!editMode && activeTab === 'general') {
            setActiveTab('hsn');
            return;
        }

        if (currentItem.hsn_number && !currentItem.hsn_applicable_date) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'HSN Applicable Date is required when HSN Number is specified' });
            return;
        }
        if (currentItem.hsn_applicable_date) {
            const year = parseInt(currentItem.hsn_applicable_date.split('-')[0], 10);
            if (year < 1000) {
                Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please enter a valid 4-digit year for HSN Applicable Date' });
                return;
            }
        }

        if (!editMode && activeTab === 'hsn') {
            setActiveTab('gst');
            return;
        }

        if (parseFloat(currentItem.igst_percent) > 0 && !currentItem.gst_applicable_date) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'GST Applicable Date is required when IGST is specified' });
            return;
        }
        if (currentItem.gst_applicable_date) {
            const year = parseInt(currentItem.gst_applicable_date.split('-')[0], 10);
            if (year < 1000) {
                Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please enter a valid 4-digit year for GST Applicable Date' });
                return;
            }
        }

        try {
            const formData = new FormData();
            formData.append('name', currentItem.name.trim());
            if (currentItem.item_code && currentItem.item_code.trim()) formData.append('item_code', currentItem.item_code.trim());
            if (groupId) formData.append('stock_group', parseInt(groupId, 10));
            if (categoryId) formData.append('stock_category', parseInt(categoryId, 10));
            if (baseUnitId) formData.append('base_unit', parseInt(baseUnitId, 10));
            if (altUnitId) formData.append('alternate_unit', parseInt(altUnitId, 10));
            formData.append('conversion_value', parseFloat(currentItem.conversion_value) || 1);
            formData.append('maintain_batch', currentItem.maintain_batch);
            formData.append('maintain_manufacture_date', currentItem.maintain_manufacture_date);
            formData.append('maintain_expiry_date', currentItem.maintain_expiry_date);
            formData.append('has_bom', currentItem.has_bom);
            formData.append('opening_stock', parseFloat(currentItem.opening_stock) || 0);
            formData.append('opening_rate', parseFloat(currentItem.opening_rate) || 0);
            formData.append('opening_value', parseFloat(currentItem.opening_value) || 0);
            formData.append('mrp', parseFloat(currentItem.mrp) || 0);
            formData.append('sb_rate', parseFloat(currentItem.sb_rate) || 0);
            formData.append('ss_rate', parseFloat(currentItem.ss_rate) || 0);

            const hsnCodes = [];
            const gstRates = [];
            const batchEntries = batchRows;

            if (currentItem.hsn_number && currentItem.hsn_applicable_date) {
                hsnCodes.push({
                    hsn_number: currentItem.hsn_number,
                    applicable_date: currentItem.hsn_applicable_date
                });
            }
            if (currentItem.gst_applicable_date) {
                gstRates.push({
                    tax_gst_type: currentItem.tax_gst_type,
                    igst_percent: parseFloat(currentItem.igst_percent) || 0,
                    cgst_percent: parseFloat(currentItem.cgst_percent) || 0,
                    sgst_percent: parseFloat(currentItem.sgst_percent) || 0,
                    cess_percent: parseFloat(currentItem.cess_percent) || 0,
                    applicable_date: currentItem.gst_applicable_date
                });
            }
            formData.append('hsn_codes', JSON.stringify(hsnCodes));
            formData.append('item_gst_rates', JSON.stringify(gstRates));
            formData.append('batch_entries', JSON.stringify(batchEntries));
            
            if (imageFile) formData.append('image', imageFile);

            if (editMode) {
                await updateStockItem(currentItem.id, formData);
                await Swal.fire({ icon: 'success', title: 'Updated', text: 'Stock item updated successfully', timer: 1500, showConfirmButton: false });
            } else {
                await createStockItem(formData);
                await Swal.fire({ icon: 'success', title: 'Created', text: 'Stock item created successfully', timer: 1500, showConfirmButton: false });
            }
            handleCloseModal();
            if (onSave) onSave();
        } catch (error) {
            let errorMsg = `Failed to ${editMode ? 'update' : 'create'} stock item`;
            if (error.response && error.response.data) {
                const data = error.response.data;
                const flattenErrors = (obj, prefix = '') => {
                    if (typeof obj === 'string') return [obj];
                    if (Array.isArray(obj)) {
                        return obj.flatMap((item, i) =>
                            typeof item === 'object' && item !== null
                                ? flattenErrors(item, prefix ? `${prefix}[${i + 1}]` : `row ${i + 1}`)
                                : [String(item)]
                        );
                    }
                    if (typeof obj === 'object' && obj !== null) {
                        return Object.keys(obj).flatMap(key => {
                            const label = prefix
                                ? `${prefix} → ${key.replace(/_/g, ' ')}`
                                : key.replace(/_/g, ' ').toUpperCase();
                            return flattenErrors(obj[key], label).map(msg => `${label}: ${msg}`);
                        });
                    }
                    return [String(obj)];
                };
                if (typeof data === 'object') {
                    const msgs = flattenErrors(data);
                    errorMsg = msgs.join('\n');
                } else if (typeof data === 'string') {
                    errorMsg = data;
                }
            }
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        }
    };

    return (
        <Fragment>
            <style>{`
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
                    background-color: var(--form-icon-color, #0a500f);
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
                    padding: 0;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .item-custom-tabs {
                    border-bottom: 1px solid #e2e8f0;
                    padding: 0 28px;
                    background: #fff;
                }
                .item-custom-tabs .nav-link {
                    color: #64748b;
                    font-weight: 500;
                    padding: 16px 20px;
                    border: none;
                    border-bottom: 2px solid transparent;
                    margin-bottom: -1px;
                    transition: all 0.2s;
                }
                .item-custom-tabs .nav-link:hover { color: #475569; border-bottom-color: #cbd5e1; }
                .item-custom-tabs .nav-link.active {
                    color: var(--cc-primary, #0a500f);
                    background: transparent;
                    border-bottom-color: var(--cc-primary, #0a500f);
                }
                .item-tab-content { padding: 24px 28px; }
                .item-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .item-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .item-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .item-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .item-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .item-custom-modal .form-check-input:checked {
                    background-color: #0a500f;
                    border-color: #0a500f;
                }
                .item-custom-modal .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .item-custom-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .item-custom-modal .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .item-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                .item-custom-modal .dropzone-upload {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    text-align: center;
                    border: 2px dashed #cbd5e1;
                    border-radius: 12px;
                    background-color: #fafbfc;
                    padding: 28px 20px;
                    cursor: pointer;
                    transition: border-color 0.2s, background-color 0.2s, transform 0.15s;
                    outline: none;
                }
                .item-custom-modal .dropzone-upload:hover {
                    border-color: #0a500f;
                    background-color: #f0fdf6;
                }
                .item-custom-modal .dropzone-upload:focus-visible {
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .item-custom-modal .dropzone-upload.dragging {
                    border-color: #16a34a;
                    border-style: solid;
                    background-color: #ecfdf5;
                    transform: scale(1.01);
                }
                .item-custom-modal .dropzone-upload .dz-icon {
                    width: 36px;
                    height: 36px;
                    color: #0a500f;
                }
                .item-custom-modal .dropzone-upload .dz-title {
                    font-size: 13.5px;
                    font-weight: 600;
                    color: #475569;
                }
                .item-custom-modal .dropzone-upload .dz-title span {
                    color: #16a34a;
                    text-decoration: underline;
                }
                .item-custom-modal .dropzone-upload .dz-subtitle {
                    font-size: 11.5px;
                    color: #94a3b8;
                }
                .item-custom-modal .dropzone-upload.has-image {
                    flex-direction: row;
                    justify-content: flex-start;
                    text-align: left;
                }
                .item-custom-modal .dropzone-upload.has-image .dz-thumb {
                    width: 48px;
                    height: 48px;
                    border-radius: 8px;
                    object-fit: cover;
                    border: 1px solid #e2e8f0;
                }
                .item-custom-modal .dropzone-upload.has-image .dz-file-info {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                }
                .item-custom-modal .dropzone-upload.has-image .dz-file-name {
                    font-size: 13px;
                    font-weight: 600;
                    color: #1e293b;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 200px;
                }
                .item-custom-modal .dropzone-upload.has-image .dz-file-hint {
                    font-size: 11px;
                    color: #94a3b8;
                }
                .item-custom-modal .dz-remove-btn {
                    background: #f1f5f9;
                    color: #64748b;
                    border: none;
                    border-radius: 50%;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .item-custom-modal .dz-remove-btn:hover {
                    background: #fee2e2;
                    color: #ef4444;
                }
                
                @keyframes modalFeedback {
                    0%, 100% { transform: scale(1); }
                    20%, 60% { transform: scale(0.99) translateX(-4px); }
                    40%, 80% { transform: scale(1.01) translateX(4px); }
                }
                .modal-feedback {
                    animation: modalFeedback 0.25s ease-in-out !important;
                }
                .swal2-container {
                    z-index: 10000 !important;
                }
            `}</style>
            
            <Modal
                show={show}
                onHide={handleCloseModal}
                dialogClassName={`item-custom-modal ${animateTrigger ? 'modal-feedback' : ''}`}
                backdrop="static"
                keyboard={false}
                size="lg"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 10H9v-2h6v2zm3-4H6V8h12v2z" fill="white" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Stock Item' : 'Create Stock Item'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage stock item
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleCloseModal}>
                        &times;
                    </button>
                </div>

                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown} onFocus={handleFocus}>
                    <div className="modal-body-custom">
                        <Tab.Container activeKey={activeTab} onSelect={(key) => setActiveTab(key)}>
                            <Nav className="item-custom-tabs">
                                <Nav.Item><Nav.Link eventKey="general">General Info</Nav.Link></Nav.Item>
                                <Nav.Item><Nav.Link eventKey="hsn">HSN Details</Nav.Link></Nav.Item>
                                <Nav.Item><Nav.Link eventKey="gst">GST Details</Nav.Link></Nav.Item>
                            </Nav>

                            <Tab.Content className="item-tab-content">
                                {/* ── General Tab ── */}
                                <Tab.Pane eventKey="general">
                                    <div className="row mb-3">
                                        <div className="col-md-6">
                                            <Form.Label className="form-label-custom">Item Name <span className="text-danger">*</span></Form.Label>
                                            <Form.Control
                                                type="text"
                                                className={`form-control-custom${nameDuplicate ? ' is-invalid' : ''}`}
                                                value={currentItem.name}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setCurrentItem({ ...currentItem, name: val });
                                                    const trimmed = val.trim().toLowerCase();
                                                    const isDup = trimmed.length > 0 && (existingItems || []).some(
                                                        item => item.name.toLowerCase() === trimmed && (!editMode || item.id !== currentItem.id)
                                                    );
                                                    setNameDuplicate(isDup);
                                                }}
                                                placeholder="Enter stock item name"
                                                required
                                            />
                                            {nameDuplicate && (
                                                <div className="invalid-feedback d-block" style={{ fontSize: '0.8rem' }}>
                                                    ⚠ A stock item with this name already exists.
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-md-6">
                                            <Form.Label className="form-label-custom">Item Code</Form.Label>
                                            <Form.Control
                                                type="text"
                                                className="form-control-custom"
                                                value={currentItem.item_code}
                                                onChange={(e) => setCurrentItem({ ...currentItem, item_code: e.target.value })}
                                                placeholder="Enter item code / SKU"
                                            />
                                        </div>
                                    </div>

                                    <div className="row mb-3">
                                        <div className="col-md-6">
                                            <Form.Label className="form-label-custom">Stock Group <span className="text-danger">*</span></Form.Label>
                                            <div className="d-flex align-items-end gap-2">
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <Select
                                                        classNamePrefix="react-select"
                                                        options={toOptions(groups, g => g.name)}
                                                        value={findOption(toOptions(groups, g => g.name), currentItem.stock_group)}
                                                        onChange={makeSelectChange('stock_group')}
                                                        onFocus={handleSelectFocus}
                                                        onKeyDown={handleSelectKeyDown}
                                                        placeholder="Search Stock Group..."
                                                        isClearable
                                                        tabSelectsValue={false}
                                                        styles={selectStyles}
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    className="quick-add-btn"
                                                    title="Add new Stock Group"
                                                    onClick={() => setShowGroupModal(true)}
                                                >+</button>
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <Form.Label className="form-label-custom">Stock Category</Form.Label>
                                            <div className="d-flex align-items-end gap-2">
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <Select
                                                        classNamePrefix="react-select"
                                                        options={toOptions(categories, c => c.name)}
                                                        value={findOption(toOptions(categories, c => c.name), currentItem.stock_category)}
                                                        onChange={makeSelectChange('stock_category')}
                                                        onFocus={handleSelectFocus}
                                                        onKeyDown={handleSelectKeyDown}
                                                        placeholder="Search Category..."
                                                        isClearable
                                                        tabSelectsValue={false}
                                                        styles={selectStyles}
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    className="quick-add-btn"
                                                    title="Add new Stock Category"
                                                    onClick={() => setShowCategoryModal(true)}
                                                >+</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="row mb-3">
                                        <div className="col-md-4">
                                            <Form.Label className="form-label-custom">Base Unit(1) <span className="text-danger">*</span></Form.Label>
                                            <Select
                                                classNamePrefix="react-select"
                                                options={toOptions(units, u => `${u.name} (${u.uqc_code})`)}
                                                value={findOption(toOptions(units, u => `${u.name} (${u.uqc_code})`), currentItem.base_unit)}
                                                onChange={makeSelectChange('base_unit')}
                                                onFocus={handleSelectFocus}
                                                onKeyDown={handleSelectKeyDown}
                                                placeholder="Search Base Unit..."
                                                isClearable
                                                tabSelectsValue={false}
                                                styles={selectStyles}
                                            />
                                        </div>
                                        
                                        <div className="col-md-4">
                                            <Form.Label className="form-label-custom">Alternate Unit</Form.Label>
                                            <Select
                                                classNamePrefix="react-select"
                                                options={[NOT_APPLICABLE_OPTION, ...toOptions(units, u => `${u.name} (${u.uqc_code})`)]}
                                                value={findOption([NOT_APPLICABLE_OPTION, ...toOptions(units, u => `${u.name} (${u.uqc_code})`)], currentItem.alternate_unit) || NOT_APPLICABLE_OPTION}
                                                onChange={makeSelectChange('alternate_unit')}
                                                onFocus={handleSelectFocus}
                                                onKeyDown={handleSelectKeyDown}
                                                placeholder="Select Alternate Unit..."
                                                tabSelectsValue={false}
                                                styles={selectStyles}
                                            />
                                        </div>

                                        <div className="col-md-4">
                                            <Form.Label className="form-label-custom">Conversion Unit</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.000001"
                                                className="form-control-custom"
                                                value={currentItem.conversion_value}
                                                onChange={(e) => setCurrentItem({ ...currentItem, conversion_value: parseFloat(e.target.value) || 1 })}
                                                placeholder="Enter conversion multiplier"
                                            />
                                        </div>
                                        
                                    </div>

                                    <div className="row mb-3">
                                        <div className="col-md-4">
                                            <Form.Label className="form-label-custom">MRP ()</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                className="form-control-custom"
                                                value={currentItem.mrp}
                                                onChange={(e) => handleNumericChange('mrp', e.target.value)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="col-md-4">
                                            <Form.Label className="form-label-custom">Standard Buying Rate ()</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                className="form-control-custom"
                                                value={currentItem.sb_rate}
                                                onChange={(e) => handleNumericChange('sb_rate', e.target.value)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="col-md-4">
                                            <Form.Label className="form-label-custom">Standard Selling Rate ()</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                className="form-control-custom"
                                                value={currentItem.ss_rate}
                                                onChange={(e) => handleNumericChange('ss_rate', e.target.value)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    <div className="row border-top pt-3 mt-1">
                                        <div className="col-md-3 mb-2">
                                            <Form.Check
                                                type="checkbox"
                                                id="maintain-mfg"
                                                label="Maintain Mfg. Date"
                                                checked={currentItem.maintain_manufacture_date}
                                                onChange={(e) => setCurrentItem({ ...currentItem, maintain_manufacture_date: e.target.checked })}
                                            />
                                        </div>
                                        <div className="col-md-3 mb-2">
                                            <Form.Check
                                                type="checkbox"
                                                id="maintain-expiry"
                                                label="Maintain Expiry Date"
                                                checked={currentItem.maintain_expiry_date}
                                                onChange={(e) => setCurrentItem({ ...currentItem, maintain_expiry_date: e.target.checked })}
                                            />
                                        </div>
                                        <div className="col-md-3 mb-2">
                                            <Form.Check
                                                type="checkbox"
                                                id="has-bom"
                                                label="Has BOM"
                                                checked={currentItem.has_bom}
                                                onChange={(e) => setCurrentItem({ ...currentItem, has_bom: e.target.checked })}
                                            />
                                        </div>
                                        <div className="col-md-3 mb-2">
                                            <Form.Check
                                                type="checkbox"
                                                id="maintain-batch"
                                                label="Maintain Batch"
                                                checked={currentItem.maintain_batch}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setCurrentItem({ ...currentItem, maintain_batch: checked });
                                                    if (checked) {
                                                        const stock = parseFloat(currentItem.opening_stock) || 0;
                                                        if (stock > 0) {
                                                            setShowBatchModal(true);
                                                        }
                                                    } else {
                                                        setBatchRows([]);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="row mb-3">
                                        <div className="col-md-4">
                                            <Form.Label className="form-label-custom">Opening Stock</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.001"
                                                className="form-control-custom"
                                                value={currentItem.opening_stock}
                                                onChange={(e) => handleNumericChange('opening_stock', e.target.value)}
                                                onBlur={(e) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    if (val > 0) {
                                                        setShowBatchModal(true);
                                                    }
                                                }}
                                                placeholder="0.000"
                                            />
                                            {parseFloat(currentItem.opening_stock) > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowBatchModal(true)}
                                                    style={{
                                                        marginTop: 6,
                                                        background: 'none',
                                                        border: '1px solid #0a500f',
                                                        borderRadius: 6,
                                                        color: '#16a34a',
                                                        fontSize: 12,
                                                        fontWeight: 500,
                                                        padding: '3px 10px',
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    {currentItem.maintain_batch
                                                        ? (batchRows.length > 0 ? `✎ Edit Batches (${batchRows.length} row${batchRows.length !== 1 ? 's' : ''})` : '+ Enter Batches')
                                                        : (batchRows.length > 0 ? `✎ Edit Allocation (${batchRows.length} row${batchRows.length !== 1 ? 's' : ''})` : '+ Enter Allocation')
                                                    }
                                                </button>
                                            )}
                                        </div>
                                        <div className="col-md-4">
                                            <Form.Label className="form-label-custom">Opening Rate ()</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                className="form-control-custom"
                                                value={currentItem.opening_rate}
                                                onChange={(e) => handleNumericChange('opening_rate', e.target.value)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="col-md-4">
                                            <Form.Label className="form-label-custom">Opening Value ()</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                className="form-control-custom"
                                                value={currentItem.opening_value}
                                                onChange={(e) => handleNumericChange('opening_value', e.target.value)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    {/* Image Upload */}
                                    <div className="row mb-3">
                                        <div className="col-12">
                                            <Form.Label className="form-label-custom">Product Image</Form.Label>
                                            <div
                                                ref={imageUploadRef}
                                                className={`image-upload-btn dropzone-upload${isDragging ? ' dragging' : ''}${imagePreview ? ' has-image' : ''}`}
                                                role="button"
                                                tabIndex={0}
                                                aria-label={imagePreview ? 'Replace product image' : 'Upload product image'}
                                                onClick={() => imageUploadRef.current?._fileInput?.click()}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        submitButtonRef.current?.focus();
                                                    }
                                                }}
                                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                                onDragLeave={() => setIsDragging(false)}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    setIsDragging(false);
                                                    const file = e.dataTransfer.files && e.dataTransfer.files[0];
                                                    if (file && file.type.startsWith('image/')) {
                                                        setImageFile(file);
                                                        setImagePreview(URL.createObjectURL(file));
                                                        setTimeout(() => submitButtonRef.current?.focus(), 50);
                                                    }
                                                }}
                                            >
                                                {imagePreview ? (
                                                    <Fragment>
                                                        <img src={imagePreview} alt="preview" className="dz-thumb" />
                                                        <div className="dz-file-info">
                                                            <span className="dz-file-name">{imageFile ? imageFile.name : 'Current image'}</span>
                                                            <span className="dz-file-hint">Drop a new file or click to replace</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="dz-remove-btn"
                                                            title="Remove image"
                                                            onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(null); }}
                                                        >×</button>
                                                    </Fragment>
                                                ) : (
                                                    <Fragment>
                                                        <svg className="dz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M7 17a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 8.96" />
                                                            <path d="M12 12v7" />
                                                            <path d="M9.5 14.5 12 12l2.5 2.5" />
                                                        </svg>
                                                        <span className="dz-title">Drag &amp; drop an image, or <span>browse</span></span>
                                                        <span className="dz-subtitle">PNG or JPG, up to 5MB</span>
                                                    </Fragment>
                                                )}
                                                <input
                                                    ref={(el) => { if (imageUploadRef.current) imageUploadRef.current._fileInput = el; }}
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            setImageFile(file);
                                                            setImagePreview(URL.createObjectURL(file));
                                                            setTimeout(() => submitButtonRef.current?.focus(), 50);
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </Tab.Pane>

                                {/* ── HSN Tab ── */}
                                <Tab.Pane eventKey="hsn">
                                    <div className="row">
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">HSN Number</Form.Label>
                                            <Form.Control
                                                type="text"
                                                className="form-control-custom"
                                                value={currentItem.hsn_number}
                                                onChange={(e) => setCurrentItem({ ...currentItem, hsn_number: e.target.value })}
                                                placeholder="Enter HSN Code"
                                            />
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">Applicable Date</Form.Label>
                                            <Form.Control
                                                type="date"
                                                className="form-control-custom"
                                                value={currentItem.hsn_applicable_date}
                                                onChange={(e) => setCurrentItem({ ...currentItem, hsn_applicable_date: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </Tab.Pane>

                                {/* ── GST Tab ── */}
                                <Tab.Pane eventKey="gst">
                                    <div className="row">
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">Taxability Type</Form.Label>
                                            <Select
                                                classNamePrefix="react-select"
                                                options={TAX_TYPE_OPTIONS}
                                                value={TAX_TYPE_OPTIONS.find(o => o.value === (currentItem.tax_gst_type || 'goods')) || TAX_TYPE_OPTIONS[0]}
                                                onChange={(opt) => {
                                                    setCurrentItem({ ...currentItem, tax_gst_type: opt ? opt.value : 'goods' });
                                                    if (opt) {
                                                        const control = currentSelectControlRef.current;
                                                        setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
                                                    }
                                                }}
                                                onFocus={handleSelectFocus}
                                                onKeyDown={handleSelectKeyDown}
                                                tabSelectsValue={false}
                                                styles={selectStyles}
                                            />
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">Applicable Date</Form.Label>
                                            <Form.Control
                                                type="date"
                                                className="form-control-custom"
                                                value={currentItem.gst_applicable_date}
                                                onChange={(e) => setCurrentItem({ ...currentItem, gst_applicable_date: e.target.value })}
                                            />
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">IGST (%)</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                className="form-control-custom"
                                                value={currentItem.igst_percent}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const half = val ? (parseFloat(val) / 2).toFixed(2) : 0;
                                                    setCurrentItem({ ...currentItem, igst_percent: val, cgst_percent: half, sgst_percent: half });
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
                                                value={currentItem.cess_percent}
                                                onChange={(e) => setCurrentItem({ ...currentItem, cess_percent: e.target.value })}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">CGST (%)</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                className="form-control-custom"
                                                value={currentItem.cgst_percent}
                                                readOnly disabled
                                            />
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <Form.Label className="form-label-custom">SGST (%)</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                className="form-control-custom"
                                                value={currentItem.sgst_percent}
                                                readOnly disabled
                                            />
                                        </div>
                                    </div>
                                </Tab.Pane>
                            </Tab.Content>
                        </Tab.Container>
                    </div>

                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={handleCloseModal}>
                            Close
                        </Button>
                        <Button ref={submitButtonRef} type="submit" className="btn-save-custom">
                            {editMode ? 'Save' : (activeTab === 'gst' ? 'Save' : 'Save & Next')}
                        </Button>
                    </div>
                </Form>
            </Modal>

            <StockGroupFormModal
                show={showGroupModal}
                onHide={() => setShowGroupModal(false)}
                onSaved={handleGroupSaved}
                existingGroups={groups}
            />

            <StockCategoryFormModal
                show={showCategoryModal}
                onHide={() => setShowCategoryModal(false)}
                onSaved={handleCategorySaved}
                existingCategories={categories}
            />

            <BatchEntryModal
                show={showBatchModal}
                onHide={() => { setShowBatchModal(false); setTimeout(() => submitButtonRef.current?.focus(), 350); }}
                openingStock={parseFloat(currentItem.opening_stock) || 0}
                maintainBatch={currentItem.maintain_batch}
                maintainMfgDate={currentItem.maintain_manufacture_date}
                maintainExpiry={currentItem.maintain_expiry_date}
                warehouses={warehouses}
                initialBatches={batchRows}
                onConfirm={(rows) => {
                    setBatchRows(rows);
                    setShowBatchModal(false);
                    setTimeout(() => submitButtonRef.current?.focus(), 350);
                }}
            />
        </Fragment>
    );
};

export default StockItemFormModal;
