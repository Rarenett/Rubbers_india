import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Card, Modal, Form } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import {
    getGateCategories,
    getGateSubCategories,
    createGateCategory,
    createGateSubCategory,
    updateGateSubCategory,
    deleteGateSubCategory
} from '../../../services/GateManagementService.js';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import { HuePicker } from 'react-color';

// Helper to generate a harmony of colors (2 tints, pure, 2 shades)
const generateHarmony = (hex) => {
    const h = hexToHsl(hex);
    return [
        hslToHex(h[0], h[1], Math.min(h[2] + 40, 95)), // Tint 2
        hslToHex(h[0], h[1], Math.min(h[2] + 20, 85)), // Tint 1
        hex, // Pure
        hslToHex(h[0], h[1], Math.max(h[2] - 20, 15)), // Shade 1
        hslToHex(h[0], h[1], Math.max(h[2] - 40, 5))  // Shade 2
    ];
};

// Color conversion utilities
function hexToHsl(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) h = s = 0;
    else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
            default: break;
        }
        h /= 6;
    }
    return [h * 360, s * 100, l * 100];
}

function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

const SubCategoryForm = () => {
    const { can } = usePermission();
    const [loading, setLoading] = useState(false);
    const [categoryLoading, setCategoryLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const [editId, setEditId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        category: '',
        name: '',
        subcategory_no: '',
        narration: ''
    });

    const [newCategoryData, setNewCategoryData] = useState({
        name: '',
        category_no: '',
        colour_code: '#9400D3',
        narration: ''
    });

    const currentSelectControlRef = useRef(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [cats, subcats] = await Promise.all([
                getGateCategories(),
                getGateSubCategories()
            ]);
            setCategories(cats || []);
            setSubcategories(subcats || []);
        } catch (error) {
            console.error("Error fetching data", error);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCategoryChange = (e) => {
        setNewCategoryData({ ...newCategoryData, [e.target.name]: e.target.value });
    };

    const handleEdit = (sub) => {
        setEditMode(true);
        setEditId(sub.id);
        setFormData({
            category: sub.category || '',
            name: sub.name || '',
            subcategory_no: sub.subcategory_no || '',
            narration: sub.narration || ''
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setEditMode(false);
        setEditId(null);
        setFormData({ category: '', name: '', subcategory_no: '', narration: '' });
        setShowModal(false);
        setTimeout(() => {
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
        }, 100);
    };

    const resetCategoryForm = () => {
        setNewCategoryData({ name: '', category_no: '', colour_code: '#9400D3', narration: '' });
        setShowCategoryModal(false);
    };

    // Auto-focus first column (Parent Category Select) when Sub-Category Modal opens
    useEffect(() => {
        if (showModal && !showCategoryModal) {
            const timer = setTimeout(() => {
                const modal = document.querySelector('.sub-category-modal');
                if (modal) {
                    const selectEl = modal.querySelector('.react-select input') ||
                        modal.querySelector('input:not([disabled]):not([readonly])');
                    if (selectEl) {
                        selectEl.focus();
                    }
                }
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [showModal, showCategoryModal]);

    // Auto-focus first column (Category Name) when Create Category Spot Modal opens
    useEffect(() => {
        if (showCategoryModal) {
            const timer = setTimeout(() => {
                const modal = document.querySelector('.category-popup-modal');
                if (modal) {
                    const nameInput = modal.querySelector('input[name="name"]');
                    if (nameInput) {
                        nameInput.focus();
                    }
                }
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [showCategoryModal]);

    // Helper for react-select options
    const toOptions = (arr) => arr.map(item => ({
        value: item.id,
        label: item.name,
        colour_code: item.colour_code
    }));

    const findOption = (options, value) => options.find(o => String(o.value) === String(value)) || null;

    const formatOptionLabel = ({ label, colour_code }) => (
        <div className="d-flex align-items-center">
            {colour_code && (
                <i className="fa fa-stop me-2" style={{ color: colour_code, filter: `drop-shadow(0 0 4px ${colour_code})` }}></i>
            )}
            <span>{label}</span>
        </div>
    );

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 2px rgba(10, 80, 15, 0.15)' : 'none',
            '&:hover': { borderColor: '#0a500f' },
            borderRadius: '10px',
            fontSize: '13px',
        }),
        menu: base => ({ ...base, zIndex: 9999, fontSize: '0.875rem' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? '#e8fcf3' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    const handleSelectFocus = (e) => {
        currentSelectControlRef.current = e.target.closest('.react-select__control');
    };

    const focusNextFromControl = (control) => {
        const modal = control.closest('.modal-content');
        if (!modal) return;
        let modalSelector = '.sub-category-modal';
        if (modal.closest('.category-popup-modal')) modalSelector = '.category-popup-modal';

        const all = getFocusable(modalSelector);
        const index = all.indexOf(control);
        if (index > -1 && index < all.length - 1) {
            const next = all[index + 1];
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else if (next.classList && next.classList.contains('react-select__control')) {
                const inputEl = next.querySelector('input');
                if (inputEl) inputEl.focus();
            } else {
                next.focus();
            }
        }
    };

    const handleSelectKeyDown = (e) => {
        if (e.key === 'Enter') {
            const menuOpen = !!document.querySelector('.react-select__menu');
            if (!menuOpen) {
                e.preventDefault();
                const control = e.target.closest('.react-select__control');
                if (control) focusNextFromControl(control);
            }
        }
    };

    const makeSelectChange = (field) => (opt) => {
        setFormData(prev => ({ ...prev, [field]: opt ? opt.value : '' }));
        if (opt !== null) {
            const control = currentSelectControlRef.current;
            setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
        }
    };

    const getFocusable = (modalSelector) => {
        const modal = document.querySelector(modalSelector);
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                'input.form-control-custom:not([disabled]):not([readonly]), textarea.form-control-custom:not([disabled]):not([readonly]), .react-select__control, button[type="submit"]:not([disabled])'
            )
        ).filter(el => {
            if (el.offsetParent === null) return false;
            if (el.disabled) return false;
            if (el.classList && el.classList.contains('react-select__control--is-disabled')) return false;
            if (el.classList && el.classList.contains('react-select__control')) {
                const inputEl = el.querySelector('input');
                if (inputEl && inputEl.disabled) return false;
            }
            return true;
        });
    };

    const handleKeyDown = (e, modalSelector) => {
        if (e.key !== 'Enter') return;
        if (e.target.tagName.toLowerCase() === 'textarea' && e.shiftKey) return;
        if (e.target.closest('.react-select')) return;

        const all = getFocusable(modalSelector);
        const index = all.indexOf(document.activeElement);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            const next = all[index + 1];
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else if (next.classList && next.classList.contains('react-select__control')) {
                const inputEl = next.querySelector('input');
                if (inputEl) inputEl.focus();
            } else {
                next.focus();
            }
        }
    };

    const handleFocus = (e) => {
        if (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.type === 'text')) {
            e.target.select();
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Sub-Category?',
            text: `Are you sure you want to delete "${name || 'this sub-category'}"? All linked tags will be affected!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteGateSubCategory(id);
                Swal.fire({
                    title: 'Deleted!',
                    text: 'Sub-Category has been deleted.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false,
                    returnFocus: false
                });
                const updatedSubcats = await getGateSubCategories();
                setSubcategories(updatedSubcats || []);
            } catch (error) {
                Swal.fire({
                    title: 'Error!',
                    text: 'Failed to delete sub-category.',
                    icon: 'error',
                    returnFocus: false
                });
            }
        }
    };

    // Save Spot-Add Gate Category
    const handleCategorySubmit = async (e) => {
        e.preventDefault();
        const trimmedName = (newCategoryData.name || '').trim().toLowerCase();
        const trimmedNo = (newCategoryData.category_no || '').trim().toLowerCase();
        const trimmedColor = (newCategoryData.colour_code || '').trim().toLowerCase();

        const duplicateName = categories.some(cat => (cat.name || '').trim().toLowerCase() === trimmedName);
        if (duplicateName) {
            Swal.fire({
                icon: 'warning',
                title: 'Duplicate Name',
                text: 'A category with this name already exists!',
                returnFocus: false
            });
            return;
        }

        if (trimmedNo) {
            const duplicateNo = categories.some(cat => (cat.category_no || '').trim().toLowerCase() === trimmedNo);
            if (duplicateNo) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Duplicate Code',
                    text: 'A category with this Category No / Code already exists!',
                    returnFocus: false
                });
                return;
            }
        }

        if (trimmedColor) {
            const duplicateColor = categories.some(cat => (cat.colour_code || '').trim().toLowerCase() === trimmedColor);
            if (duplicateColor) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Duplicate Color',
                    text: 'A category with this color code already exists! Please select a different color.',
                    returnFocus: false
                });
                return;
            }
        }

        try {
            setCategoryLoading(true);
            const createdCat = await createGateCategory(newCategoryData);
            const updatedCats = await getGateCategories();
            setCategories(updatedCats || []);
            setFormData(prev => ({ ...prev, category: createdCat.id || createdCat.pk }));
            setShowCategoryModal(false);
            Swal.fire({
                icon: 'success',
                title: 'Category Created',
                text: 'Parent category added and selected automatically.',
                timer: 1500,
                showConfirmButton: false,
                returnFocus: false
            });
            setTimeout(() => {
                const modal = document.querySelector('.sub-category-modal');
                if (modal) {
                    const nextInput = modal.querySelector('input[name="name"]');
                    if (nextInput) nextInput.focus();
                }
            }, 200);
        } catch (error) {
            console.error("Error saving parent category:", error);
            const errorMsg = error.response?.data?.name?.[0] ||
                error.response?.data?.category_no?.[0] ||
                error.response?.data?.colour_code?.[0] ||
                error.response?.data?.detail ||
                'Failed to create parent category.';
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorMsg,
                returnFocus: false
            });
        } finally {
            setCategoryLoading(false);
        }
    };

    // Save Sub-Category
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.category) {
            Swal.fire({
                icon: 'error',
                title: 'Validation Error',
                text: 'Please select a Parent Category',
                returnFocus: false
            });
            return;
        }

        const trimmedName = (formData.name || '').trim().toLowerCase();
        const trimmedNo = (formData.subcategory_no || '').trim().toLowerCase();

        const duplicateName = subcategories.some(sub => {
            if (editMode && sub.id === editId) return false;
            return (sub.name || '').trim().toLowerCase() === trimmedName;
        });

        if (duplicateName) {
            Swal.fire({
                icon: 'warning',
                title: 'Duplicate Name',
                text: 'A sub-category with this name already exists!',
                returnFocus: false
            });
            return;
        }

        if (trimmedNo) {
            const duplicateCode = subcategories.some(sub => {
                if (editMode && sub.id === editId) return false;
                return (sub.subcategory_no || '').trim().toLowerCase() === trimmedNo;
            });

            if (duplicateCode) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Duplicate Code',
                    text: 'A sub-category with this Sub-Category No / Code already exists!',
                    returnFocus: false
                });
                return;
            }
        }

        try {
            setLoading(true);
            if (editMode) {
                await updateGateSubCategory(editId, formData);
                Swal.fire({
                    icon: 'success',
                    title: 'Updated',
                    text: 'Sub-Category updated successfully',
                    timer: 2000,
                    showConfirmButton: false,
                    returnFocus: false
                });
            } else {
                await createGateSubCategory(formData);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Sub-Category created successfully',
                    timer: 2000,
                    showConfirmButton: false,
                    returnFocus: false
                });
            }
            resetForm();
            const updatedSubcats = await getGateSubCategories();
            setSubcategories(updatedSubcats || []);
        } catch (error) {
            console.error("Error saving sub-category:", error);
            const errorMsg = error.response?.data?.name?.[0] ||
                error.response?.data?.subcategory_no?.[0] ||
                error.response?.data?.detail ||
                `Failed to ${editMode ? 'update' : 'create'} sub-category.`;
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorMsg,
                returnFocus: false
            });
        } finally {
            setLoading(false);
            setTimeout(() => {
                if (document.activeElement && typeof document.activeElement.blur === 'function') {
                    document.activeElement.blur();
                }
            }, 100);
        }
    };

    const filteredSubcategories = subcategories.filter(sub =>
        (sub.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sub.category_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sub.subcategory_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sub.narration || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="container-fluid">
            <div className="page-titles">
                <button
                    onClick={() => window.history.back()}
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>

            <div className="row">
                <div className="col-xl-12">
                    <Card>
                        <Card.Header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 border-0 pb-0">
                            <Card.Title className="mb-0 text-nowrap">Visitor Sub-Categories</Card.Title>
                            <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                                <div className="search-bar-container w-100 m-0" style={{ maxWidth: '250px' }}>
                                    <span className="search-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Search Sub-Category..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                            }
                                        }}
                                    />
                                </div>
                                <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                                    <CreateButton
                                        module="access_sub_categories"
                                        onClick={() => {
                                            resetForm();
                                            setShowModal(true);
                                        }}
                                    >
                                        Sub-Category
                                    </CreateButton>
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading && subcategories.length === 0 ? (
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
                                                <th><strong>SUB-CATEGORY NAME</strong></th>
                                                <th><strong>PARENT CATEGORY</strong></th>
                                                <th><strong>CODE</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSubcategories.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="text-center py-4 text-muted">
                                                        No entries
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredSubcategories.map((sub) => (
                                                    <tr key={sub.id}>
                                                        <td><strong>{sub.name || '-'}</strong></td>
                                                        <td>
                                                            <span className="d-flex align-items-center gap-2">
                                                                <i className="fa fa-stop" style={{ color: sub.category_colour, filter: `drop-shadow(0 0 5px ${sub.category_colour})` }}></i>
                                                                <span className="text-muted">{sub.category_name || '-'}</span>
                                                            </span>
                                                        </td>
                                                        <td>{sub.subcategory_no || '-'}</td>
                                                        <td className="text-end">
                                                            {can('access-point-subcategories', 'edit') || can('access-point-subcategories', 'delete') ? (
                                                                <div className="d-flex justify-content-end">
                                                                    <EditButton
                                                                        module="access_sub_categories"
                                                                        onClick={() => handleEdit(sub)}
                                                                        className="me-1"
                                                                    />
                                                                    <DeleteButton
                                                                        module="access_sub_categories"
                                                                        onClick={() => handleDelete(sub.id, sub.name)}
                                                                    />
                                                                </div>
                                                            ) : null}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Custom Styled Sub-Category Modal matching StockItem and Gate modal style */}
            <Modal
                show={showModal}
                onHide={resetForm}
                dialogClassName="gate-custom-modal sub-category-modal"
                backdrop="static"
                keyboard={false}
                restoreFocus={false}
                size="md"
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
                                {editMode ? 'Edit Sub-Category' : 'Save'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage visitor sub-category
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={resetForm}>
                        &times;
                    </button>
                </div>

                <Form onSubmit={handleSubmit} onKeyDown={(e) => handleKeyDown(e, '.sub-category-modal')} onFocus={handleFocus}>
                    <div className="modal-body-custom">
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Parent Category <span className="text-danger">*</span></Form.Label>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={toOptions(categories)}
                                        value={findOption(toOptions(categories), formData.category)}
                                        onChange={makeSelectChange('category')}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        formatOptionLabel={formatOptionLabel}
                                        placeholder="Select Parent Category..."
                                        isClearable
                                        autoFocus={true}
                                        openMenuOnFocus={true}
                                        styles={selectStyles}
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="quick-add-btn"
                                    title="Add new Parent Category"
                                    onClick={() => {
                                        setNewCategoryData({ name: '', category_no: '', colour_code: '#9400D3', narration: '' });
                                        setShowCategoryModal(true);
                                    }}
                                >+</button>
                            </div>
                        </div>

                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Sub-Category Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                name="name"
                                className="form-control-custom"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g. Regular Vendor, VIP Client"
                                required
                            />
                        </div>

                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Sub-Category No</Form.Label>
                            <Form.Control
                                type="text"
                                name="subcategory_no"
                                className="form-control-custom"
                                value={formData.subcategory_no}
                                onChange={handleChange}
                                placeholder="e.g. SCAT-01"
                            />
                        </div>

                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Narration</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                name="narration"
                                className="form-control-custom"
                                value={formData.narration}
                                onChange={handleChange}
                                placeholder="Enter narration or description"
                            />
                        </div>
                    </div>

                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={resetForm}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom" disabled={loading}>
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Saving...
                                </>
                            ) : (
                                editMode ? 'Update Sub-Category' : 'Save'
                            )}
                        </button>
                    </div>
                </Form>
            </Modal>

            {/* Spot-Add Gate Category Modal (Appears ABOVE Sub-Category Modal) */}
            <Modal
                show={showCategoryModal}
                onHide={resetCategoryForm}
                dialogClassName="gate-custom-modal category-popup-modal"
                backdrop="static"
                keyboard={false}
                restoreFocus={false}
                size="md"
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
                                Create Category
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage visitor category
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={resetCategoryForm}>
                        &times;
                    </button>
                </div>

                <Form onSubmit={handleCategorySubmit} onKeyDown={(e) => handleKeyDown(e, '.category-popup-modal')} onFocus={handleFocus}>
                    <div className="modal-body-custom">
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Category Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                name="name"
                                className="form-control-custom"
                                value={newCategoryData.name}
                                onChange={handleCategoryChange}
                                placeholder="e.g. Vendor, Client"
                                required
                            />
                        </div>

                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Category No</Form.Label>
                            <Form.Control
                                type="text"
                                name="category_no"
                                className="form-control-custom"
                                value={newCategoryData.category_no}
                                onChange={handleCategoryChange}
                                placeholder="e.g. CAT-01"
                            />
                        </div>

                        <div className="mb-3">
                            <div className="prism-harmony-outer p-3 rounded-3 position-relative overflow-hidden" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <span className="text-uppercase fw-bold" style={{ fontSize: '11px', color: '#64748b' }}>Color Harmony</span>
                                    <div className="font-monospace fw-bold" style={{ color: newCategoryData.colour_code, fontSize: '12px' }}>
                                        {newCategoryData.colour_code.toUpperCase()}
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <HuePicker
                                        color={newCategoryData.colour_code}
                                        onChange={(color) => setNewCategoryData({ ...newCategoryData, colour_code: color.hex })}
                                        width="100%"
                                    />
                                </div>

                                <div className="d-flex justify-content-between align-items-center px-2">
                                    {generateHarmony(newCategoryData.colour_code).map((hex, i) => (
                                        <div key={i} className="harmony-column text-center">
                                            <div
                                                onClick={() => setNewCategoryData({ ...newCategoryData, colour_code: hex })}
                                                className={`gem-node ${newCategoryData.colour_code.toLowerCase() === hex.toLowerCase() ? 'active' : ''}`}
                                                style={{ '--gem-color': hex }}
                                            >
                                                <div className="gem-inner"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Narration</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                name="narration"
                                className="form-control-custom"
                                value={newCategoryData.narration}
                                onChange={handleCategoryChange}
                                placeholder="Enter narration or description"
                            />
                        </div>
                    </div>

                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={resetCategoryForm}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom" disabled={categoryLoading}>
                            {categoryLoading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Saving...
                                </>
                            ) : (
                                'Create Category'
                            )}
                        </button>
                    </div>
                </Form>
            </Modal>

            <style dangerouslySetInnerHTML={{
                __html: `
                .gate-custom-modal .modal-content {
                    border: none;
                    border-radius: 16px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
                    overflow: hidden;
                }
                .category-popup-modal {
                    z-index: 1065 !important;
                }
                .category-popup-modal ~ .modal-backdrop {
                    z-index: 1060 !important;
                }
                .gate-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .gate-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .gate-custom-modal .modal-close-x {
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
                .gate-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .gate-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .gate-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .gate-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .gate-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .gate-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .gate-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .quick-add-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 38px;
                    height: 38px;
                    border-radius: 10px;
                    background: linear-gradient(135deg, #0a500f, #073d0b);
                    border: none;
                    color: white;
                    font-size: 18px;
                    font-weight: 500;
                    line-height: 1;
                    cursor: pointer;
                    flex-shrink: 0;
                    transition: opacity 0.2s, transform 0.15s;
                    box-shadow: 0 2px 6px rgba(10, 80, 15,0.35);
                }
                .quick-add-btn:hover {
                    opacity: 0.88;
                    transform: scale(1.05);
                }
                .quick-add-btn:active { transform: scale(0.96); }
                .gate-custom-modal .btn-close-custom {
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
                .gate-custom-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .gate-custom-modal .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                    display: inline-flex;
                    align-items: center;
                }
                .gate-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                .gate-custom-modal .btn-save-custom:disabled {
                    opacity: 0.65;
                    cursor: not-allowed;
                }
                .gem-node {
                    width: 28px; height: 28px; border-radius: 50%; cursor: pointer; position: relative;
                    transition: all 0.3s ease;
                    background: var(--gem-color);
                    border: 2px solid rgba(0,0,0,0.15);
                }
                .gem-inner {
                    position: absolute; top: 15%; left: 15%; width: 70%; height: 70%;
                    background: linear-gradient(135deg, rgba(255,255,255,0.6) 0%, transparent 100%);
                    border-radius: 50%;
                }
                .gem-node.active { transform: scale(1.2); border: 2px solid #0a500f; box-shadow: 0 0 8px var(--gem-color); }
                `
            }} />
        </div>
    );
};

export default SubCategoryForm;
