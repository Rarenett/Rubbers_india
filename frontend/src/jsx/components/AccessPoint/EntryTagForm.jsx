import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Card, Modal, Form } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { HuePicker } from 'react-color';
import {
    getGateCategories,
    getGateSubCategories,
    getEntryTags,
    createGateCategory,
    createGateSubCategory,
    createEntryTag,
    updateEntryTag,
    deleteEntryTag
} from '../../../services/GateManagementService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

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

const EntryTagForm = () => {
    const { can } = usePermission();
    const [loading, setLoading] = useState(false);
    const [categoryLoading, setCategoryLoading] = useState(false);
    const [subCategoryLoading, setSubCategoryLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [entryTags, setEntryTags] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const [editId, setEditId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showSubCategoryModal, setShowSubCategoryModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        tag_type: '',
        tag_code: '',
        category: '',
        subcategory: '',
        sl_no_from: '',
        sl_no_to: ''
    });

    const [newCategoryData, setNewCategoryData] = useState({
        name: '',
        category_no: '',
        colour_code: '#9400D3',
        narration: ''
    });

    const [newSubCategoryData, setNewSubCategoryData] = useState({
        category: '',
        name: '',
        subcategory_no: '',
        narration: ''
    });

    const currentSelectControlRef = useRef(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [cats, tags] = await Promise.all([
                getGateCategories(),
                getEntryTags()
            ]);
            setCategories(cats);
            setEntryTags(tags);
        } catch (error) {
            console.error("Error fetching data", error);
        }
    };

    // Auto-focus first column (Tag Type) when Tag Modal opens
    useEffect(() => {
        if (showModal && !showCategoryModal && !showSubCategoryModal) {
            const timer = setTimeout(() => {
                const modal = document.querySelector('.tag-book-modal');
                if (modal) {
                    const firstInput = modal.querySelector('input:not([disabled]):not([readonly])');
                    if (firstInput) {
                        firstInput.focus();
                    }
                }
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [showModal, showCategoryModal, showSubCategoryModal]);

    // Auto-focus first column (Category Name) when Create Category Spot Modal opens
    useEffect(() => {
        if (showCategoryModal) {
            const timer = setTimeout(() => {
                const modal = document.querySelector('.category-popup-modal');
                if (modal) {
                    const firstInput = modal.querySelector('input[name="name"]:not([disabled]):not([readonly])');
                    if (firstInput) {
                        firstInput.focus();
                    }
                }
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [showCategoryModal]);

    // Auto-focus first column when Create Sub-Category Spot Modal opens
    useEffect(() => {
        if (showSubCategoryModal) {
            const timer = setTimeout(() => {
                const modal = document.querySelector('.subcategory-popup-modal');
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
    }, [showSubCategoryModal]);

    const handleCategorySelectChange = async (opt) => {
        const catId = opt ? opt.value : '';
        setFormData(prev => ({ ...prev, category: catId, subcategory: '' }));
        if (catId) {
            try {
                const subs = await getGateSubCategories(catId);
                setSubcategories(subs);
            } catch (error) {
                console.error("Error loading subcategories", error);
                setSubcategories([]);
            }
        } else {
            setSubcategories([]);
        }
        if (opt !== null) {
            const control = currentSelectControlRef.current;
            setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
        }
    };

    const handleSubCategorySelectChange = (opt) => {
        const subId = opt ? opt.value : '';
        setFormData(prev => ({ ...prev, subcategory: subId }));
        if (opt !== null) {
            const control = currentSelectControlRef.current;
            setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCategoryChange = (e) => {
        setNewCategoryData({ ...newCategoryData, [e.target.name]: e.target.value });
    };

    const handleSubCategoryChange = (e) => {
        setNewSubCategoryData({ ...newSubCategoryData, [e.target.name]: e.target.value });
    };

    const handleSpotSubCategoryParentChange = async (opt) => {
        const catId = opt ? opt.value : '';
        setNewSubCategoryData(prev => ({ ...prev, category: catId }));
        if (opt !== null) {
            const control = currentSelectControlRef.current;
            setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
        }
    };

    const handleEdit = async (tag) => {
        setEditMode(true);
        setEditId(tag.id);

        if (tag.category) {
            const subs = await getGateSubCategories(tag.category);
            setSubcategories(subs);
        } else {
            setSubcategories([]);
        }

        setFormData({
            tag_type: tag.tag_type || '',
            tag_code: tag.tag_code || '',
            category: tag.category || '',
            subcategory: tag.subcategory || '',
            sl_no_from: tag.sl_no_from || '',
            sl_no_to: tag.sl_no_to || ''
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setEditMode(false);
        setEditId(null);
        setFormData({
            tag_type: '',
            tag_code: '',
            category: '',
            subcategory: '',
            sl_no_from: '',
            sl_no_to: ''
        });
        setShowModal(false);
    };

    const resetCategoryForm = () => {
        setNewCategoryData({ name: '', category_no: '', colour_code: '#9400D3', narration: '' });
        setShowCategoryModal(false);
    };

    const resetSubCategoryForm = () => {
        setNewSubCategoryData({ category: '', name: '', subcategory_no: '', narration: '' });
        setShowSubCategoryModal(false);
    };

    // Helper for warning popups with automatic Enter dismissal and refocusing
    const showWarningAndRefocus = (title, text, focusTargetSelector) => {
        Swal.fire({
            icon: 'warning',
            title,
            text,
            confirmButtonColor: '#0a500f',
            focusConfirm: true,
            returnFocus: false,
            didOpen: (popup) => {
                const btn = popup.querySelector('.swal2-confirm');
                if (btn) btn.focus();
                const keyHandler = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (btn) btn.click();
                        document.removeEventListener('keydown', keyHandler, true);
                    }
                };
                document.addEventListener('keydown', keyHandler, true);
            }
        }).then(() => {
            setTimeout(() => {
                if (!focusTargetSelector) return;
                const el = document.querySelector(focusTargetSelector);
                if (el) {
                    if (el.classList && el.classList.contains('react-select__control')) {
                        const inp = el.querySelector('input');
                        if (inp) inp.focus();
                    } else {
                        el.focus();
                        if (el.select) el.select();
                    }
                }
            }, 100);
        });
    };

    // Keyboard navigation helpers
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
        if (document.querySelector('.swal2-container')) return;
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

    const focusNextFromControl = (control) => {
        const modal = control.closest('.modal-content');
        if (!modal) return;
        let modalSelector = '.tag-book-modal';
        if (modal.closest('.category-popup-modal')) modalSelector = '.category-popup-modal';
        else if (modal.closest('.subcategory-popup-modal')) modalSelector = '.subcategory-popup-modal';

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

    const handleSelectFocus = (e) => {
        const control = e.target.closest('.react-select__control');
        if (control) currentSelectControlRef.current = control;
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

    const handleFocus = (e) => {
        if (e.target.tagName.toLowerCase() === 'input' && e.target.type !== 'checkbox' && e.target.type !== 'radio') {
            e.target.select();
        }
    };

    const handleCategorySubmit = async (e) => {
        e.preventDefault();
        if (!newCategoryData.name.trim()) {
            return showWarningAndRefocus(
                'Validation Error',
                'Category Name is required.',
                '.category-popup-modal input[name="name"]'
            );
        }

        // Validate duplicate Category name / code
        const isDuplicate = categories.some(cat =>
            (cat.name || '').trim().toLowerCase() === newCategoryData.name.trim().toLowerCase() ||
            (newCategoryData.category_no && (cat.category_no || '').trim().toLowerCase() === newCategoryData.category_no.trim().toLowerCase())
        );

        if (isDuplicate) {
            return showWarningAndRefocus(
                'Duplicate Entry',
                'A category with this Name or Category No already exists!',
                '.category-popup-modal input[name="name"]'
            );
        }

        try {
            setCategoryLoading(true);
            const res = await createGateCategory(newCategoryData);
            const updatedCategories = await getGateCategories();
            setCategories(updatedCategories);

            // Automatically select newly created category in Tag  form
            const newCatId = res.id || (updatedCategories.find(c => c.name.toLowerCase() === newCategoryData.name.trim().toLowerCase())?.id);
            if (newCatId) {
                setFormData(prev => ({ ...prev, category: newCatId, subcategory: '' }));
                const subs = await getGateSubCategories(newCatId);
                setSubcategories(subs);
            }

            Swal.fire({
                icon: 'success',
                title: 'Category Created',
                text: 'New Category has been added and selected.',
                timer: 1500,
                showConfirmButton: false
            });
            resetCategoryForm();
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.response?.data?.detail || 'Failed to create category'
            });
        } finally {
            setCategoryLoading(false);
        }
    };

    const handleSubCategorySubmit = async (e) => {
        e.preventDefault();
        if (!newSubCategoryData.category || !newSubCategoryData.name.trim()) {
            return showWarningAndRefocus(
                'Validation Error',
                'Parent Category and Sub-Category Name are required.',
                '.subcategory-popup-modal input[name="name"]'
            );
        }

        try {
            setSubCategoryLoading(true);
            const res = await createGateSubCategory(newSubCategoryData);
            if (formData.category && String(formData.category) === String(newSubCategoryData.category)) {
                const updatedSubs = await getGateSubCategories(formData.category);
                setSubcategories(updatedSubs);
                const newSubId = res.id || (updatedSubs.find(s => s.name.toLowerCase() === newSubCategoryData.name.trim().toLowerCase())?.id);
                if (newSubId) {
                    setFormData(prev => ({ ...prev, subcategory: newSubId }));
                }
            }

            Swal.fire({
                icon: 'success',
                title: 'Sub-Category Created',
                text: 'New Sub-Category has been added and selected.',
                timer: 1500,
                showConfirmButton: false
            });
            resetSubCategoryForm();
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.response?.data?.detail || 'Failed to create sub-category'
            });
        } finally {
            setSubCategoryLoading(false);
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "All generated individual tags will be deleted!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteEntryTag(id);
                Swal.fire('Deleted!', 'Tag has been deleted.', 'success');
                const updatedTags = await getEntryTags();
                setEntryTags(updatedTags);
            } catch (error) {
                Swal.fire('Error!', 'Failed to delete tag.', 'error');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Check required fields
        if (!formData.tag_type.trim() || !formData.category || !formData.sl_no_from || !formData.sl_no_to) {
            let target = 'input[name="tag_type"]';
            if (!formData.tag_type.trim()) target = 'input[name="tag_type"]';
            else if (!formData.category) target = '.tag-book-modal .react-select__control';
            else if (!formData.sl_no_from) target = 'input[name="sl_no_from"]';
            else if (!formData.sl_no_to) target = 'input[name="sl_no_to"]';

            return showWarningAndRefocus(
                'Validation Error',
                'Please fill out all required fields!',
                target
            );
        }

        // Check for duplicate Book Type + Code combination
        const isDuplicateType = entryTags.some(tag => {
            if (editMode && tag.id === editId) return false;
            const sameType = (tag.tag_type || '').trim().toLowerCase() === (formData.tag_type || '').trim().toLowerCase();
            const sameCode = (tag.tag_code || '').trim().toLowerCase() === (formData.tag_code || '').trim().toLowerCase();
            return sameType && sameCode;
        });

        if (isDuplicateType) {
            return showWarningAndRefocus(
                'Duplicate Tag',
                'A tag with this Book Type and Code already exists!',
                'input[name="tag_code"]'
            );
        }

        const fromVal = Number(formData.sl_no_from);
        const toVal = Number(formData.sl_no_to);

        if (isNaN(fromVal) || isNaN(toVal) || fromVal <= 0 || toVal <= 0) {
            return showWarningAndRefocus(
                'Invalid Serial Numbers',
                'Serial numbers must be positive numbers!',
                'input[name="sl_no_from"]'
            );
        }

        if (fromVal > toVal) {
            return showWarningAndRefocus(
                'Invalid Range',
                'Serial No To must be greater than or equal to Serial No From!',
                'input[name="sl_no_to"]'
            );
        }

        // Check for overlapping serial number range in the same category
        const overlappingTag = entryTags.find(tag => {
            if (editMode && tag.id === editId) return false;
            if (String(tag.category) !== String(formData.category)) return false;
            const existingFrom = Number(tag.sl_no_from);
            const existingTo = Number(tag.sl_no_to);
            return fromVal <= existingTo && toVal >= existingFrom;
        });

        if (overlappingTag) {
            return showWarningAndRefocus(
                'Range Overlap',
                `Serial range (${fromVal} - ${toVal}) overlaps with existing tag'${overlappingTag.tag_type}' (${overlappingTag.sl_no_from} - ${overlappingTag.sl_no_to}) in the same category!`,
                'input[name="sl_no_from"]'
            );
        }

        try {
            setLoading(true);
            if (editMode) {
                await updateEntryTag(editId, formData);
                Swal.fire({
                    icon: 'success',
                    title: 'Updated',
                    text: 'Tag updated successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                await createEntryTag(formData);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Tag created and serial tags generated!',
                    timer: 2500,
                    showConfirmButton: false
                });
            }
            resetForm();
            const updatedTags = await getEntryTags();
            setEntryTags(updatedTags);
        } catch (error) {
            const errorMsg = error.response?.data?.tag_type?.[0] ||
                error.response?.data?.tag_code?.[0] ||
                error.response?.data?.sl_no_from?.[0] ||
                error.response?.data?.sl_no_to?.[0] ||
                error.response?.data?.detail ||
                `Failed to ${editMode ? 'update' : 'create'} tag.`;
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorMsg,
            });
        } finally {
            setLoading(false);
        }
    };

    const toOptions = (list) => list.map(item => ({
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
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15, 0.15)' : 'none',
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

    const filteredTags = entryTags.filter(tag =>
        (tag.tag_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tag.tag_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tag.category_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (String(tag.sl_no_from || '')).includes(searchTerm) ||
        (String(tag.sl_no_to || '')).includes(searchTerm)
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
                            <Card.Title className="mb-0 text-nowrap">Registered Tags</Card.Title>
                            <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                                <div className="search-bar-container w-100 m-0" style={{ maxWidth: '250px' }}>
                                    <span className="search-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Search Tag..."
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
                                        module="entry_tag"
                                        onClick={() => {
                                            resetForm();
                                            setShowModal(true);
                                        }}
                                    >
                                        Tag
                                    </CreateButton>
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading && entryTags.length === 0 ? (
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
                                                <th><strong>TAG TYPE</strong></th>
                                                <th><strong>CODE</strong></th>
                                                <th><strong>CATEGORY</strong></th>
                                                <th><strong>RANGE</strong></th>
                                                <th><strong>TOTAL TAGS</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredTags.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="text-center py-4 text-muted">
                                                        No tags registered
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredTags.map((tag) => (
                                                    <tr key={tag.id}>
                                                        <td><strong>{tag.tag_type || '-'}</strong></td>
                                                        <td>{tag.tag_code || '-'}</td>
                                                        <td>
                                                            <span className="d-flex align-items-center gap-2">
                                                                {tag.category_colour && (
                                                                    <i className="fa fa-stop" style={{ color: tag.category_colour, fontSize: '1.2rem', filter: `drop-shadow(0 0 5px ${tag.category_colour})` }}></i>
                                                                )}
                                                                <span>{tag.category_name || '-'}</span>
                                                                {tag.subcategory_name && (
                                                                    <small className="text-muted"> / {tag.subcategory_name}</small>
                                                                )}
                                                            </span>
                                                        </td>
                                                        <td><span className="font-monospace">{tag.sl_no_from} - {tag.sl_no_to}</span></td>
                                                        <td><span className="badge bg-light text-dark font-monospace">{Number(tag.sl_no_to) - Number(tag.sl_no_from) + 1}</span></td>
                                                        <td className="text-end">
                                                            {can('entry-tags', 'edit') || can('entry-tags', 'delete') || can('access-point-entry-tags', 'edit') || can('access-point-entry-tags', 'delete') ? (
                                                                <div className="d-flex justify-content-end">
                                                                    <EditButton
                                                                        module="entry_tag"
                                                                        onClick={() => handleEdit(tag)}
                                                                        className="me-1"
                                                                    />
                                                                    <DeleteButton
                                                                        module="entry_tag"
                                                                        onClick={() => handleDelete(tag.id)}
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

            {/* Main Tag Form Modal - Stock Item Form Style */}
            <Modal
                show={showModal}
                onHide={resetForm}
                dialogClassName="item-custom-modal tag-book-modal"
                backdrop="static"
                keyboard={false}
                restoreFocus={false}
                enforceFocus={false}
                size="md"
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
                                {editMode ? 'Edit Tag' : 'Register Tag'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage entry tag
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={resetForm}>
                        &times;
                    </button>
                </div>

                <Form onSubmit={handleSubmit} onKeyDown={(e) => handleKeyDown(e, '.tag-book-modal')} onFocus={handleFocus}>
                    <div className="modal-body-custom">
                        <div className="row mb-3">
                            <div className="col-md-6">
                                <Form.Label className="form-label-custom">Tag Type <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    name="tag_type"
                                    className="form-control-custom"
                                    value={formData.tag_type}
                                    onChange={handleChange}
                                    placeholder="e.g. Visitor Tag, Contractor Tag"
                                    autoFocus={true}
                                    required
                                />
                            </div>
                            <div className="col-md-6">
                                <Form.Label className="form-label-custom">Tag Code</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="tag_code"
                                    className="form-control-custom"
                                    value={formData.tag_code}
                                    onChange={handleChange}
                                    placeholder="e.g. VISTAG"
                                />
                            </div>
                        </div>

                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Visitor Category <span className="text-danger">*</span></Form.Label>
                            <div className="d-flex align-items-end gap-2">
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={toOptions(categories)}
                                        value={findOption(toOptions(categories), formData.category)}
                                        onChange={handleCategorySelectChange}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        formatOptionLabel={formatOptionLabel}
                                        placeholder="Select Category..."
                                        isClearable
                                        openMenuOnFocus={true}
                                        styles={selectStyles}
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="quick-add-btn"
                                    title="Add new Visitor Category"
                                    onClick={() => {
                                        setNewCategoryData({ name: '', category_no: '', colour_code: '#9400D3', narration: '' });
                                        setShowCategoryModal(true);
                                    }}
                                >+</button>
                            </div>
                        </div>

                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Sub-Category (Optional)</Form.Label>
                            <div className="d-flex align-items-end gap-2">
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={toOptions(subcategories)}
                                        value={findOption(toOptions(subcategories), formData.subcategory)}
                                        onChange={handleSubCategorySelectChange}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        formatOptionLabel={formatOptionLabel}
                                        placeholder="Select Sub-Category..."
                                        isClearable
                                        openMenuOnFocus={true}
                                        styles={selectStyles}
                                        isDisabled={!formData.category}
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="quick-add-btn"
                                    title="Add new Sub-Category"
                                    onClick={() => {
                                        setNewSubCategoryData({
                                            category: formData.category || '',
                                            name: '',
                                            subcategory_no: '',
                                            narration: ''
                                        });
                                        setShowSubCategoryModal(true);
                                    }}
                                >+</button>
                            </div>
                        </div>

                        <div className="row mb-3">
                            <div className="col-md-6">
                                <Form.Label className="form-label-custom">Serial No From <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="number"
                                    name="sl_no_from"
                                    className="form-control-custom"
                                    value={formData.sl_no_from}
                                    onChange={handleChange}
                                    placeholder="e.g. 100"
                                    required
                                />
                            </div>

                            <div className="col-md-6">
                                <Form.Label className="form-label-custom">Serial No To <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="number"
                                    name="sl_no_to"
                                    className="form-control-custom"
                                    value={formData.sl_no_to}
                                    onChange={handleChange}
                                    placeholder="e.g. 200"
                                    required
                                />
                            </div>
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
                                'Save'
                            )}
                        </button>
                    </div>
                </Form>
            </Modal>

            {/* Create Category Spot Add Modal - Stock Item Form Style */}
            <Modal
                show={showCategoryModal}
                onHide={resetCategoryForm}
                dialogClassName="item-custom-modal category-popup-modal"
                backdrop="static"
                keyboard={false}
                restoreFocus={false}
                enforceFocus={false}
                size="md"
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
                                autoFocus={true}
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
                                'Save'
                            )}
                        </button>
                    </div>
                </Form>
            </Modal>

            {/* Create Sub-Category Spot Add Modal - Stock Item Form Style */}
            <Modal
                show={showSubCategoryModal}
                onHide={resetSubCategoryForm}
                dialogClassName="item-custom-modal subcategory-popup-modal"
                backdrop="static"
                keyboard={false}
                restoreFocus={false}
                enforceFocus={false}
                size="md"
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
                                Create Sub-Category
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage visitor sub-category
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={resetSubCategoryForm}>
                        &times;
                    </button>
                </div>

                <Form onSubmit={handleSubCategorySubmit} onKeyDown={(e) => handleKeyDown(e, '.subcategory-popup-modal')} onFocus={handleFocus}>
                    <div className="modal-body-custom">
                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Parent Category <span className="text-danger">*</span></Form.Label>
                            <Select
                                classNamePrefix="react-select"
                                options={toOptions(categories)}
                                value={findOption(toOptions(categories), newSubCategoryData.category)}
                                onChange={handleSpotSubCategoryParentChange}
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

                        <div className="mb-3">
                            <Form.Label className="form-label-custom">Sub-Category Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                name="name"
                                className="form-control-custom"
                                value={newSubCategoryData.name}
                                onChange={handleSubCategoryChange}
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
                                value={newSubCategoryData.subcategory_no}
                                onChange={handleSubCategoryChange}
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
                                value={newSubCategoryData.narration}
                                onChange={handleSubCategoryChange}
                                placeholder="Enter narration or description"
                            />
                        </div>
                    </div>

                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={resetSubCategoryForm}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom" disabled={subCategoryLoading}>
                            {subCategoryLoading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Saving...
                                </>
                            ) : (
                                'Save'
                            )}
                        </button>
                    </div>
                </Form>
            </Modal>

            <style dangerouslySetInnerHTML={{
                __html: `
                .item-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .item-custom-modal.category-popup-modal {
                    z-index: 1065 !important;
                }
                .item-custom-modal.subcategory-popup-modal {
                    z-index: 1065 !important;
                }
                .item-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                    background-color: #ffffff;
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
                    padding: 24px 28px;
                    background-color: #ffffff;
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
                    height: 38px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .item-custom-modal textarea.form-control-custom {
                    height: auto;
                }
                .item-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .item-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
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
                .item-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .item-custom-modal .btn-close-custom {
                    background-color: #dc3545 !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .item-custom-modal .btn-close-custom:hover {
                    background-color: #bb2d3b !important;
                }
                .item-custom-modal .btn-save-custom {
                    background-color: #0a500f !important;
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
                .item-custom-modal .btn-save-custom:hover:not(:disabled) {
                    background-color: #25a870 !important;
                }
                .item-custom-modal .btn-save-custom:disabled {
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

export default EntryTagForm;
