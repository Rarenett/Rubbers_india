import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Card, Button, Modal, Form } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getSubcategories,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory
} from '../../../../services/MeetingManagementService';
import { usePermission } from '../../../../hooks/usePermission';
import CreateButton from '../../../../components/permissions/CreateButton';
import EditButton from '../../../../components/permissions/EditButton';
import DeleteButton from '../../../../components/permissions/DeleteButton';
import { usePageTitle } from '../../../../context/TitleContext';

const MeetingCategoryList = () => {
    usePageTitle("Meeting Category List");
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCats, setExpandedCats] = useState({});

    // Category modal
    const [showCatModal, setShowCatModal] = useState(false);
    const [editCatMode, setEditCatMode] = useState(false);
    const [currentCat, setCurrentCat] = useState({ id: null, category_name: '', narration: '', prefix_code: '' });

    // Subcategory modal
    const [showSubcatModal, setShowSubcatModal] = useState(false);
    const [editSubcatMode, setEditSubcatMode] = useState(false);
    const [currentSubcat, setCurrentSubcat] = useState({
        id: null,
        subcategory_name: '',
        category: '',
        narration: '',
        prefix_code: ''
    });
    const { can } = usePermission();
    const currentSelectControlRef = useRef(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [catData, subcatData] = await Promise.all([
                getCategories(),
                getSubcategories()
            ]);
            setCategories(catData);
            setSubcategories(subcatData);
            // Expand all by default or keep previous state
            const initialExpanded = {};
            catData.forEach(cat => {
                initialExpanded[cat.id] = true;
            });
            setExpandedCats(initialExpanded);
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch data',
            });
        } finally {
            setLoading(false);
        }
    };

    const toggleCategory = (catId) => {
        setExpandedCats(prev => ({
            ...prev,
            [catId]: !prev[catId]
        }));
    };

    // Category handlers
    const handleShowCatModal = (cat = null) => {
        if (cat) {
            setCurrentCat(cat);
            setEditCatMode(true);
        } else {
            setCurrentCat({ id: null, category_name: '', narration: '', prefix_code: '' });
            setEditCatMode(false);
        }
        setShowCatModal(true);
    };

    const handleCatSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editCatMode) {
                await updateCategory(currentCat.id, currentCat);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Category updated successfully', timer: 1500 });
            } else {
                await createCategory(currentCat);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Category created successfully', timer: 1500 });
            }
            setShowCatModal(false);
            fetchData();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.category_name || error.response?.data?.prefix_code || 'Failed to save category' });
        }
    };

    const handleDeleteCat = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Category?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteCategory(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Category deleted successfully', timer: 1500 });
                fetchData();
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete category' });
            }
        }
    };

    // Subcategory handlers
    const handleShowSubcatModal = (subcat = null, catId = null) => {
        if (subcat) {
            setCurrentSubcat(subcat);
            setEditSubcatMode(true);
        } else {
            setCurrentSubcat({
                id: null,
                subcategory_name: '',
                category: catId || '',
                narration: '',
                prefix_code: ''
            });
            setEditSubcatMode(false);
        }
        setShowSubcatModal(true);
    };

    const handleSubcatSubmit = async (e) => {
        e.preventDefault();
        if (!currentSubcat.category) {
            Swal.fire({ icon: 'warning', title: 'Required', text: 'Please select a Category' });
            return;
        }
        try {
            if (editSubcatMode) {
                await updateSubcategory(currentSubcat.id, currentSubcat);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Subcategory updated successfully', timer: 1500 });
            } else {
                await createSubcategory(currentSubcat);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Subcategory created successfully', timer: 1500 });
            }
            setShowSubcatModal(false);
            fetchData();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save subcategory' });
        }
    };

    const handleDeleteSubcat = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Subcategory?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteSubcategory(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Subcategory deleted successfully', timer: 1500 });
                fetchData();
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete subcategory' });
            }
        }
    };

    const filteredCategories = categories.filter(cat => {
        const term = searchTerm.toLowerCase();
        const catNameMatch = (cat.category_name || '').toLowerCase().includes(term);
        const subcatMatch = subcategories.some(sub =>
            sub.category === cat.id && (sub.subcategory_name || '').toLowerCase().includes(term)
        );
        return catNameMatch || subcatMatch;
    });

    const getCatSubcategories = (catId) => {
        return subcategories.filter(s => s.category === catId);
    };

    // Auto-focus first input when Category modal opens
    useEffect(() => {
        if (showCatModal) {
            const timer = setTimeout(() => {
                const modal = document.querySelector('.cat-modal');
                if (modal) {
                    const firstInput = modal.querySelector('.form-control-custom');
                    if (firstInput) firstInput.focus();
                }
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [showCatModal]);

    // Auto-focus first control when Subcategory modal opens
    useEffect(() => {
        if (showSubcatModal) {
            const timer = setTimeout(() => {
                const modal = document.querySelector('.subcat-modal');
                if (modal) {
                    const firstControlInput = modal.querySelector('.react-select__control input, .form-control-custom');
                    if (firstControlInput) firstControlInput.focus();
                }
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [showSubcatModal]);

    // ── Keyboard & Enter Navigation ──────────────────────────────────────
    const getFocusable = (modalSelector) => {
        const modal = document.querySelector(modalSelector);
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.form-control-custom, .react-select__control, button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled && el.type !== 'hidden');
    };

    const focusNextFromControl = (control, modalSelector = '.subcat-modal') => {
        const all = getFocusable(modalSelector);
        const index = all.indexOf(control);
        if (index > -1 && index < all.length - 1) {
            if (index === all.length - 2) {
                const submitBtn = all[all.length - 1];
                if (submitBtn) submitBtn.click();
            } else {
                const next = all[index + 1];
                if (next.classList && next.classList.contains('react-select__control')) {
                    next.querySelector('input')?.focus();
                } else {
                    next.focus();
                }
            }
        }
    };

    const handleKeyDown = (e, modalSelector) => {
        if (e.key !== 'Enter') return;
        // Don't intercept Enter if a react-select dropdown menu is open
        if (document.querySelector('.react-select__menu')) {
            return;
        }
        const activeEl = document.activeElement;
        if (activeEl && activeEl.tagName === 'TEXTAREA' && e.shiftKey) {
            return; // Allow Shift+Enter for new line in textarea
        }
        const all = getFocusable(modalSelector);
        const currentItem = activeEl?.closest('.react-select__control') || activeEl;
        const index = all.indexOf(currentItem);
        if (index > -1) {
            e.preventDefault();
            if (index === all.length - 1 || index === all.length - 2) {
                const submitBtn = all[all.length - 1];
                if (submitBtn) submitBtn.click();
            } else {
                const next = all[index + 1];
                if (next.classList && next.classList.contains('react-select__control')) {
                    next.querySelector('input')?.focus();
                } else {
                    next.focus();
                }
            }
        }
    };

    const handleFocus = (e) => {
        if (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.type === 'text')) {
            e.target.select();
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
                const control = e.target.closest('.react-select__control');
                if (control) focusNextFromControl(control, '.subcat-modal');
            }
        }
    };

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '42px',
            borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15, 0.15)' : 'none',
            '&:hover': { borderColor: state.isFocused ? '#0a500f' : '#94a3b8' },
            borderRadius: '10px',
            fontSize: '14px',
            backgroundColor: '#fff',
        }),
        menu: base => ({
            ...base,
            zIndex: 99999,
            fontSize: '14px',
            borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
            overflow: 'hidden',
        }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected
                ? '#0a500f'
                : state.isFocused
                ? '#f0fdf4'
                : 'white',
            color: state.isSelected ? 'white' : '#334155',
            cursor: 'pointer',
            padding: '10px 14px',
        }),
        placeholder: base => ({
            ...base,
            color: '#94a3b8',
        }),
        singleValue: base => ({
            ...base,
            color: '#334155',
        }),
    };

    const categoryOptions = categories.map(cat => ({
        value: cat.id,
        label: cat.category_name
    }));

    const categoryValue = categoryOptions.find(opt => 
        String(opt.value) === String(currentSubcat.category)
    ) || null;

    return (
        <div className="container-fluid">
            <style>{`
                /* ── StockItem Modal Styling ── */
                .mc-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .mc-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .mc-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .mc-modal .modal-close-x {
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
                .mc-modal .modal-close-x:hover {
                    color: #555;
                }
                .mc-modal .modal-body-custom {
                    padding: 24px 28px;
                }
                .mc-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .mc-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .mc-modal .form-control-custom,
                .mc-modal .form-select-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .mc-modal .form-control-custom:focus,
                .mc-modal .form-select-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .mc-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .mc-modal .btn-close-custom {
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
                .mc-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .mc-modal .btn-save-custom {
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
                .mc-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }

                /* ── StockItem Matched Category Box Styling ── */
                .card-category-box {
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    background: #ffffff;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04);
                    transition: box-shadow 0.25s ease, transform 0.2s ease, border-color 0.25s ease;
                    overflow: hidden;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }
                .card-category-box:hover {
                    box-shadow: 0 10px 28px rgba(10, 80, 15, 0.12);
                    border-color: #99f6e4;
                    transform: translateY(-2px);
                }
                .category-box-header {
                    background-color: #fafbfc;
                    border-bottom: 1px solid #f1f5f9;
                    padding: 16px 18px;
                    transition: background-color 0.2s;
                }
                .card-category-box:hover .category-box-header {
                    background-color: #f0fdf4;
                }
                .category-icon-box {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    background-color: #e6fcf5;
                    color: #0a500f;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 12px;
                    flex-shrink: 0;
                    font-size: 17px;
                    box-shadow: 0 2px 8px rgba(10, 80, 15, 0.18);
                }
                .subcategory-item {
                    padding: 10px 14px;
                    border-radius: 10px;
                    background-color: #f8fafc;
                    border: 1px solid #f1f5f9;
                    transition: background-color 0.2s, border-color 0.2s;
                }
                .subcategory-item:hover {
                    background-color: #f0fdf4;
                    border-color: #bbf7d0;
                }
                .subcategory-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background-color: #0a500f;
                    flex-shrink: 0;
                }
                .btn-add-subcat-box {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    padding: 8px 14px;
                    background-color: #f0fdf4;
                    border: 1px dashed #0a500f;
                    color: #16a34a;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-add-subcat-box:hover {
                    background-color: #dcfce7;
                    border-style: solid;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(10, 80, 15, 0.2);
                }
            `}</style>

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
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 border-0 pb-0">
                            <Card.Title className="mb-0 text-nowrap">
                                Meeting Categories & Subcategories
                            </Card.Title>
                            <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                                <div className="search-bar-container w-100 m-0" style={{ maxWidth: '250px' }}>
                                    <span className="search-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Search Categories..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                                    {can('meeting-categories', 'create') && (
                                        <>
                                            <CreateButton
                                                module="meeting-categories"
                                                onClick={() => handleShowCatModal()}
                                            >
                                                Category
                                            </CreateButton>
                                            <CreateButton
                                                module="meeting-categories"
                                                onClick={() => handleShowSubcatModal()}
                                            >
                                                Subcategory
                                            </CreateButton>
                                        </>
                                    )}
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body className="p-4">
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="row">
                                    {filteredCategories.length === 0 ? (
                                        <div className="col-12 text-center py-5">
                                            <div className="py-4">
                                                <i className="fa fa-layer-group text-muted mb-3" style={{ fontSize: '48px', opacity: 0.3 }}></i>
                                                <h5 className="text-muted">No meeting categories found</h5>
                                                <p className="text-muted small">Try adjusting your search query or add a new category.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        filteredCategories.map((cat) => {
                                            const catSubcats = getCatSubcategories(cat.id);
                                            const isExpanded = expandedCats[cat.id];

                                            return (
                                                <div key={cat.id} className="col-xl-3 col-md-6 col-sm-12 mb-4">
                                                    <div className="card-category-box">
                                                        <div
                                                            className="category-box-header d-flex align-items-center justify-content-between"
                                                            onClick={() => toggleCategory(cat.id)}
                                                            style={{ cursor: 'pointer' }}
                                                        >
                                                            <div className="d-flex align-items-center flex-grow-1 overflow-hidden">
                                                                <div className="category-icon-box">
                                                                    <i className="fa fa-layer-group"></i>
                                                                </div>
                                                                <div className="overflow-hidden me-2">
                                                                    <div className="d-flex align-items-center">
                                                                        <h5 className="mb-0 text-dark font-w600 text-truncate" style={{ fontSize: '15.5px' }}>
                                                                            {cat.category_name}
                                                                        </h5>
                                                                    </div>
                                                                    {cat.prefix_code && (
                                                                        <span className="badge badge-success light mt-1" style={{ fontSize: '10.5px', padding: '3px 8px' }}>
                                                                            {cat.prefix_code}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div
                                                                className="d-flex align-items-center gap-1 flex-shrink-0"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                {can('meeting-categories', 'edit') && (
                                                                    <EditButton
                                                                        module="meeting-categories"
                                                                        onClick={() => handleShowCatModal(cat)}
                                                                        style={{ width: '28px', height: '28px' }}
                                                                    />
                                                                )}
                                                                {can('meeting-categories', 'delete') && (
                                                                    <DeleteButton
                                                                        module="meeting-categories"
                                                                        onClick={() => handleDeleteCat(cat.id, cat.category_name)}
                                                                        style={{ width: '28px', height: '28px' }}
                                                                    />
                                                                )}
                                                                <div
                                                                    className="ms-1 d-flex align-items-center justify-content-center text-muted"
                                                                    style={{ cursor: 'pointer', width: '24px', height: '24px' }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleCategory(cat.id);
                                                                    }}
                                                                >
                                                                    <i className={`fa ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ fontSize: '13px' }}></i>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="p-3 d-flex flex-column flex-grow-1">
                                                            {isExpanded ? (
                                                                <div className="sub-list d-flex flex-column flex-grow-1">
                                                                    {catSubcats.length === 0 ? (
                                                                        <div className="text-center text-muted small py-3 my-2" style={{ background: '#f8fafc', borderRadius: '10px', border: '1px dashed #e2e8f0' }}>
                                                                            No subcategories
                                                                        </div>
                                                                    ) : (
                                                                        <div className="d-flex flex-column gap-2 mb-3">
                                                                            {catSubcats.map((sub) => (
                                                                                <div
                                                                                    key={sub.id}
                                                                                    className="subcategory-item d-flex align-items-center justify-content-between"
                                                                                >
                                                                                    <div className="d-flex align-items-center overflow-hidden me-2">
                                                                                        <div className="subcategory-dot me-2"></div>
                                                                                        <span className="text-dark small font-w500 text-truncate" style={{ fontSize: '13.5px' }}>
                                                                                            {sub.subcategory_name}
                                                                                        </span>
                                                                                        {sub.prefix_code && (
                                                                                            <span className="badge badge-success light ms-2 flex-shrink-0" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                                                                                {sub.prefix_code}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="d-flex align-items-center gap-1 flex-shrink-0">
                                                                                        {can('meeting-categories', 'edit') && (
                                                                                            <EditButton
                                                                                                module="meeting-categories"
                                                                                                onClick={() => handleShowSubcatModal(sub)}
                                                                                                style={{ width: '26px', height: '26px' }}
                                                                                            />
                                                                                        )}
                                                                                        {can('meeting-categories', 'delete') && (
                                                                                            <DeleteButton
                                                                                                module="meeting-categories"
                                                                                                onClick={() => handleDeleteSubcat(sub.id, sub.subcategory_name)}
                                                                                                style={{ width: '26px', height: '26px' }}
                                                                                            />
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    {can('meeting-categories', 'create') && (
                                                                        <div className="mt-auto pt-1">
                                                                            <button
                                                                                type="button"
                                                                                className="btn-add-subcat-box"
                                                                                onClick={() => handleShowSubcatModal(null, cat.id)}
                                                                            >
                                                                                <i className="fa fa-plus me-1"></i> Add Subcategory
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div
                                                                    className="text-muted small py-2 text-center"
                                                                    style={{ cursor: 'pointer', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0' }}
                                                                    onClick={() => toggleCategory(cat.id)}
                                                                >
                                                                    <i className="fa fa-folder me-1 text-primary"></i>
                                                                    {catSubcats.length} {catSubcats.length === 1 ? 'Subcategory' : 'Subcategories'} (Click to expand)
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Category Modal - StockItem Style */}
            <Modal
                show={showCatModal}
                onHide={() => setShowCatModal(false)}
                dialogClassName="mc-modal cat-modal"
                backdrop="static"
                keyboard={false}
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editCatMode ? 'Edit Meeting Category' : 'Create Meeting Category'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage meeting category
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowCatModal(false)}>
                        &times;
                    </button>
                </div>
                <Form onSubmit={handleCatSubmit} onKeyDown={(e) => handleKeyDown(e, '.cat-modal')} onFocus={handleFocus}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-7 mb-3">
                                <Form.Label className="form-label-custom">
                                    Category Name <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    value={currentCat.category_name}
                                    onChange={(e) => setCurrentCat({ ...currentCat, category_name: e.target.value })}
                                    placeholder="e.g. Annual Meeting"
                                    required
                                />
                            </div>
                            <div className="col-md-5 mb-3">
                                <Form.Label className="form-label-custom">
                                    Prefix Code <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    value={currentCat.prefix_code}
                                    onChange={(e) => setCurrentCat({ ...currentCat, prefix_code: e.target.value.toUpperCase() })}
                                    placeholder="e.g. AM"
                                    maxLength={5}
                                    required
                                />
                                <small className="text-muted" style={{ fontSize: '11px' }}>2-5 uppercase letters</small>
                            </div>
                            <div className="col-12 mb-2">
                                <Form.Label className="form-label-custom">
                                    Narration
                                </Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={3}
                                    className="form-control-custom"
                                    value={currentCat.narration || ''}
                                    onChange={(e) => setCurrentCat({ ...currentCat, narration: e.target.value })}
                                    placeholder="Enter any additional details or description..."
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowCatModal(false)}>
                            Close
                        </Button>
                        <Button type="submit" className="btn-save-custom">
                            {editCatMode ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* Subcategory Modal - StockItem Style */}
            <Modal
                show={showSubcatModal}
                onHide={() => setShowSubcatModal(false)}
                dialogClassName="mc-modal subcat-modal"
                backdrop="static"
                keyboard={false}
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 6H20M4 12H20M4 18H12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editSubcatMode ? 'Edit Meeting Subcategory' : 'Create Meeting Subcategory'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage meeting subcategory
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowSubcatModal(false)}>
                        &times;
                    </button>
                </div>
                <Form onSubmit={handleSubcatSubmit} onKeyDown={(e) => handleKeyDown(e, '.subcat-modal')} onFocus={handleFocus}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-12 mb-3">
                                <Form.Label className="form-label-custom">
                                    Category <span className="text-danger">*</span>
                                </Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    options={categoryOptions}
                                    value={categoryValue}
                                    onChange={(opt) => {
                                        setCurrentSubcat({ ...currentSubcat, category: opt ? opt.value : '' });
                                        if (opt) {
                                            const control = currentSelectControlRef.current;
                                            setTimeout(() => {
                                                if (control) focusNextFromControl(control, '.subcat-modal');
                                            }, 50);
                                        }
                                    }}
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleSelectKeyDown}
                                    openMenuOnFocus={true}
                                    placeholder="Select Category..."
                                    styles={selectStyles}
                                    isClearable
                                />
                            </div>
                            <div className="col-md-7 mb-3">
                                <Form.Label className="form-label-custom">
                                    Subcategory Name <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    value={currentSubcat.subcategory_name}
                                    onChange={(e) => setCurrentSubcat({ ...currentSubcat, subcategory_name: e.target.value })}
                                    placeholder="e.g. Board Meeting"
                                    required
                                />
                            </div>
                            <div className="col-md-5 mb-3">
                                <Form.Label className="form-label-custom">
                                    Prefix Code <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    value={currentSubcat.prefix_code}
                                    onChange={(e) => setCurrentSubcat({ ...currentSubcat, prefix_code: e.target.value.toUpperCase() })}
                                    placeholder="e.g. BM"
                                    maxLength={5}
                                    required
                                />
                                <small className="text-muted" style={{ fontSize: '11px' }}>2-5 uppercase letters</small>
                            </div>
                            <div className="col-12 mb-2">
                                <Form.Label className="form-label-custom">
                                    Narration
                                </Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={3}
                                    className="form-control-custom"
                                    value={currentSubcat.narration || ''}
                                    onChange={(e) => setCurrentSubcat({ ...currentSubcat, narration: e.target.value })}
                                    placeholder="Enter any additional details or description..."
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowSubcatModal(false)}>
                            Close
                        </Button>
                        <Button type="submit" className="btn-save-custom">
                            {editSubcatMode ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default MeetingCategoryList;
