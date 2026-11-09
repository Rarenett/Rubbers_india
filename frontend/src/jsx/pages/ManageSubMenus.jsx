import React, { useState, useEffect, Fragment, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Card, Modal, Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { fetchUserMenusAction } from '../../store/actions/MenuActions';
import {
    fetchMenus,
    fetchSubMenus,
    createSubMenu,
    updateSubMenu,
    deleteSubMenu,
    formatError
} from '../../services/MenuManagementService';
import CreateButton from '../../components/permissions/CreateButton';
import EditButton from '../../components/permissions/EditButton';
import DeleteButton from '../../components/permissions/DeleteButton';

const EMPTY_SUBMENU = {
    menu: '',
    name: '',
    description: '',
    code: '',
    icon: '',
    url: '',
    order: 1,
    is_active: true,
    has_create: false,
    has_edit: false,
    has_delete: false,
    has_approve: false,
    has_reject: false,
    has_details: false,
    has_allocate: false,
    has_history: false,
};

const ManageSubMenus = () => {
    const dispatch = useDispatch();
    const [submenus, setSubmenus] = useState([]);
    const [menus, setMenus] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [filterMenuId, setFilterMenuId] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editSubmenuId, setEditSubmenuId] = useState(null);
    const [formData, setFormData] = useState({ ...EMPTY_SUBMENU });

    const currentSelectControlRef = useRef(null);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        loadMenus();
        loadSubMenus();
    }, []);

    // Autofocus the first field (Parent Menu react-select dropdown) when modal opens
    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                const modal = document.querySelector('.submenu-custom-modal');
                if (modal) {
                    const firstInput = modal.querySelector('.react-select__control input');
                    if (firstInput) {
                        firstInput.focus();
                    }
                }
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [showModal]);

    const loadMenus = async () => {
        try {
            const response = await fetchMenus();
            setMenus(response.data);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: formatError(error) });
        }
    };

    const loadSubMenus = async (menuId = null) => {
        try {
            setLoading(true);
            const response = await fetchSubMenus(menuId);
            setSubmenus(response.data);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: formatError(error) });
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (e) => {
        const menuId = e.target.value;
        setFilterMenuId(menuId);
        loadSubMenus(menuId || null);
    };

    const handleShowModal = (submenu = null) => {
        if (submenu) {
            setFormData({
                menu: submenu.menu,
                name: submenu.name,
                description: submenu.description || '',
                code: submenu.code || '',
                icon: submenu.icon || '',
                url: submenu.url || '',
                order: submenu.order,
                is_active: submenu.is_active,
                has_create: submenu.has_create,
                has_edit: submenu.has_edit,
                has_delete: submenu.has_delete,
                has_approve: submenu.has_approve || false,
                has_reject: submenu.has_reject || false,
                has_details: submenu.has_details || false,
                has_allocate: submenu.has_allocate || false,
                has_history: submenu.has_history || false,
            });
            setEditSubmenuId(submenu.id);
            setEditMode(true);
        } else {
            setFormData({ ...EMPTY_SUBMENU });
            setEditSubmenuId(null);
            setEditMode(false);
        }
        setShowModal(true);
    };

    const toTitleCase = (str) => {
        if (!str) return '';
        return str.replace(/\b\w/g, c => c.toUpperCase());
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        let formattedValue = value;
        if (name === 'name' && typeof value === 'string') {
            formattedValue = toTitleCase(value);
        } else if ((name === 'url' || name === 'code') && typeof value === 'string') {
            formattedValue = value.toLowerCase();
        }
        setFormData(prev => {
            const updated = { ...prev, [name]: type === 'checkbox' ? checked : formattedValue };
            if (name === 'url' && !value) updated.code = '';
            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'SubMenu name is required.' });
            return;
        }
        const payload = {
            ...formData,
            name: toTitleCase(formData.name.trim()),
            url: formData.url ? formData.url.trim().toLowerCase() : '',
            code: formData.code ? formData.code.trim().toLowerCase() : ''
        };
        const parentMenu = menus.find(m => String(m.id) === String(formData.menu));
        if (formData.is_active && parentMenu && !parentMenu.is_active) {
            Swal.fire({
                icon: 'warning',
                title: 'Parent Menu Inactive',
                text: `Cannot set "${formData.name || 'SubMenu'}" as active because parent menu "${parentMenu.name}" is inactive.`,
            });
            return;
        }
        try {
            if (editMode) {
                await updateSubMenu(editSubmenuId, payload);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'SubMenu updated successfully.', timer: 2000, showConfirmButton: false });
            } else {
                await createSubMenu(payload);
                Swal.fire({ icon: 'success', title: 'Created', text: 'SubMenu created successfully.', timer: 2000, showConfirmButton: false });
            }
            setShowModal(false);
            loadSubMenus(filterMenuId || null);
            dispatch(fetchUserMenusAction());
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: formatError(error) });
        }
    };

    const handleDelete = async (submenu) => {
        const result = await Swal.fire({
            title: 'Deactivate SubMenu?',
            text: `Are you sure you want to deactivate "${submenu.name}"? All its subsubmenus will also be deactivated.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, deactivate it',
        });
        if (result.isConfirmed) {
            try {
                await updateSubMenu(submenu.id, { ...submenu, is_active: false });
                Swal.fire({ icon: 'success', title: 'Deactivated', text: 'SubMenu and its subsubmenus deactivated successfully.', timer: 2000, showConfirmButton: false });
                loadSubMenus(filterMenuId || null);
                dispatch(fetchUserMenusAction());
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: formatError(error) });
            }
        }
    };

    const handleActivate = async (submenu) => {
        const parentMenu = menus.find(m => String(m.id) === String(submenu.menu));
        if (parentMenu && !parentMenu.is_active) {
            Swal.fire({
                icon: 'warning',
                title: 'Parent Menu Inactive',
                text: `Cannot activate "${submenu.name}" because its parent menu "${parentMenu.name}" is inactive. Please activate the parent menu first.`,
            });
            return;
        }

        const result = await Swal.fire({
            title: 'Activate SubMenu?',
            text: `Are you sure you want to activate "${submenu.name}"?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#2ece8a',
            confirmButtonText: 'Yes, activate it',
        });
        if (result.isConfirmed) {
            try {
                await updateSubMenu(submenu.id, { ...submenu, is_active: true });
                Swal.fire({ icon: 'success', title: 'Activated', text: 'SubMenu activated successfully.', timer: 2000, showConfirmButton: false });
                loadSubMenus(filterMenuId || null);
                dispatch(fetchUserMenusAction());
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: formatError(error) });
            }
        }
    };

    const getMenuName = (menuId) => {
        const menu = menus.find(m => m.id === menuId);
        return menu ? menu.name : '-';
    };

    // Enter key navigation
    const getFocusable = () =>
        Array.from(
            document.querySelectorAll('.form-control-custom, .react-select__control, input[type="checkbox"]:not([disabled]), button[type="submit"]:not([disabled])')
        ).filter(el => el.offsetParent !== null && !el.disabled);

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
        const activeEl = document.activeElement;
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
                const control = e.target.closest('.react-select__control');
                if (control) focusNextFromControl(control);
            }
        }
    };

    const filteredSubmenus = submenus
        .filter(sm =>
            (sm.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (sm.url || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (getMenuName(sm.menu) || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            const menuA = getMenuName(a.menu).toLowerCase();
            const menuB = getMenuName(b.menu).toLowerCase();
            if (menuA < menuB) return -1;
            if (menuA > menuB) return 1;
            return (a.order || 0) - (b.order || 0);
        });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentSubmenus = filteredSubmenus.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredSubmenus.length / itemsPerPage);

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#2ece8a' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(46,206,138,0.15)' : 'none',
            '&:hover': { borderColor: '#2ece8a' },
            borderRadius: '10px',
            fontSize: '13px',
        }),
        menu: base => ({ ...base, zIndex: 9999, fontSize: '13px' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#2ece8a' : state.isFocused ? '#eefdf6' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    const menuOptions = menus.map(m => ({ value: m.id, label: m.name }));
    const menuValue = menuOptions.find(opt => String(opt.value) === String(formData.menu)) || null;

    return (
        <div className="container-fluid">
            <style>{`
                .submenu-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .submenu-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .submenu-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
                .submenu-custom-modal .modal-close-x {
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
                .submenu-custom-modal .modal-close-x:hover { color: #555; }
                .submenu-custom-modal .modal-body-custom {
                    padding: 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .submenu-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .submenu-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .submenu-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .submenu-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .submenu-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
                .submenu-custom-modal .form-check-input:checked {
                    background-color: #2ece8a;
                    border-color: #2ece8a;
                }
                .submenu-custom-modal .btn-close-custom {
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
                .submenu-custom-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .submenu-custom-modal .btn-save-custom {
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
                .submenu-custom-modal .btn-save-custom:hover { background-color: #26b277 !important; }
            `}</style>

            

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <Card.Title className="mb-0">SubMenu Management</Card.Title>
                            <div className="d-flex flex-wrap gap-2 align-items-center">
                                <div style={{ flex: '1 1 auto', minWidth: '180px' }}>
                                    <Form.Select
                                        className="form-control"
                                        value={filterMenuId}
                                        onChange={handleFilterChange}
                                        style={{ height: '38px', borderRadius: '6px', fontSize: '13px' }}
                                    >
                                        <option value="">All Menus</option>
                                        {menus.map(menu => (
                                            <option key={menu.id} value={menu.id}>{menu.name}</option>
                                        ))}
                                    </Form.Select>
                                </div>
                                <div style={{ flex: '1 1 auto', minWidth: '200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search submenus..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <CreateButton module="submenus" onClick={() => handleShowModal()}>
                                    SubMenu
                                </CreateButton>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading ? (
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
                                                <th><strong>PARENT MENU</strong></th>
                                                <th><strong>NAME</strong></th>
                                                <th><strong>CODE</strong></th>
                                                <th><strong>URL</strong></th>
                                                <th><strong>ORDER</strong></th>
                                                <th><strong>STATUS</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSubmenus.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" className="text-center py-4 text-muted">No entries</td>
                                                </tr>
                                            ) : (
                                                Object.entries(
                                                    currentSubmenus.reduce((acc, submenu) => {
                                                        const mName = getMenuName(submenu.menu);
                                                        if (!acc[mName]) acc[mName] = [];
                                                        acc[mName].push(submenu);
                                                        return acc;
                                                    }, {})
                                                ).map(([menuName, items]) => (
                                                    <Fragment key={menuName}>
                                                        <tr className="bg-light">
                                                            <td colSpan="7"><strong><i className="fa fa-folder-open text-primary me-2"></i>{menuName}</strong></td>
                                                        </tr>
                                                        {items.map(submenu => (
                                                            <tr key={submenu.id}>
                                                                <td></td>
                                                                <td>
                                                                    <i className="fa fa-level-up-alt fa-rotate-90 text-muted me-2 ms-2"></i>
                                                                    {submenu.name}
                                                                </td>
                                                                <td>{submenu.code || '-'}</td>
                                                                <td>{submenu.url || '-'}</td>
                                                                <td>{submenu.order}</td>
                                                                <td>
                                                                    {submenu.is_active
                                                                        ? <span className="badge light badge-success">Active</span>
                                                                        : <span className="badge light badge-danger">Inactive</span>
                                                                    }
                                                                </td>
                                                                <td className="text-end">
                                                                    <div className="d-flex justify-content-end gap-1">
                                                                        <EditButton module="submenus" onClick={() => handleShowModal(submenu)} />
                                                                        {submenu.is_active
                                                                            ? <DeleteButton module="submenus" onClick={() => handleDelete(submenu)} iconClass="fa fa-ban" title="Deactivate" />
                                                                            : <Button
                                                                                variant="outline-success"
                                                                                size="sm"
                                                                                className="shadow"
                                                                                title="Activate"
                                                                                onClick={() => handleActivate(submenu)}
                                                                                style={{
                                                                                    width: '28px',
                                                                                    height: '28px',
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'center',
                                                                                    padding: '0',
                                                                                    fontSize: '12px',
                                                                                    borderRadius: '6px',
                                                                                }}
                                                                            >
                                                                                <i className="fa fa-check-circle" />
                                                                            </Button>
                                                                        }
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </Fragment>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {filteredSubmenus.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredSubmenus.length)} of {filteredSubmenus.length} entries
                                    </div>
                                            {totalPages > 1 && (
                                                <nav>
                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                            <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-left" />
                                                </button>
                                            </li>
                                            {Array.from({ length: totalPages }, (_, index) => {
                                                const pageNumber = index + 1;
                                                if (
                                                    pageNumber === 1 ||
                                                    pageNumber === totalPages ||
                                                    (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                                ) {
                                                    return (
                                                        <li key={pageNumber} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setCurrentPage(pageNumber)} style={{ border: 'none' }}>
                                                                {pageNumber}
                                                            </button>
                                                        </li>
                                                    );
                                                } else if (
                                                    pageNumber === currentPage - 2 ||
                                                    pageNumber === currentPage + 2
                                                ) {
                                                    return (
                                                        <li key={pageNumber} className="page-item disabled">
                                                            <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                        </li>
                                                    );
                                                }
                                                return null;
                                            })}
                                            <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-right" />
                                                </button>
                                            </li>
                                        </ul>
                                    </nav>
                                            )}
                                        </div>
                                    )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Add / Edit Modal */}
            <Modal show={showModal} onHide={() => setShowModal(false)} dialogClassName="submenu-custom-modal modal-lg" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 15v4H5v-4h14m1-2H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zM7 18.5c-.82 0-1.5-.68-1.5-1.5s.68-1.5 1.5-1.5 1.5.68 1.5 1.5-.68 1.5-1.5 1.5zM19 5v4H5V5h14m1-2H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zM7 8.5C6.18 8.5 5.5 7.82 5.5 7S6.18 5.5 7 5.5s1.5.68 1.5 1.5S7.82 8.5 7 8.5z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit SubMenu' : 'Create SubMenu'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage submenu configuration
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Parent Menu <span className="text-danger">*</span></Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    options={menuOptions}
                                    value={menuValue}
                                    onChange={(opt) => {
                                        setFormData(prev => ({ ...prev, menu: opt ? opt.value : '' }));
                                        if (opt) {
                                            const control = currentSelectControlRef.current;
                                            setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
                                        }
                                    }}
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleSelectKeyDown}
                                    openMenuOnFocus={true}
                                    placeholder="Search and select Menu..."
                                    isClearable
                                    styles={selectStyles}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">SubMenu Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    name="name"
                                    required
                                    placeholder="e.g., Email"
                                    value={formData.name}
                                    onChange={handleFormChange}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">URL</Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    style={{ textTransform: 'none' }}
                                    name="url"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    placeholder="e.g., /email"
                                    value={formData.url}
                                    onChange={handleFormChange}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Permission Code</Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    style={{ textTransform: 'none' }}
                                    name="code"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    value={formData.code}
                                    onChange={handleFormChange}
                                    placeholder={formData.url ? 'e.g., email' : 'Please enter URL first'}
                                    disabled={!formData.url}
                                    required={!!formData.url}
                                />
                                <small className="text-muted d-block mt-1">
                                    {formData.url ? 'Unique code used for permission checks.' : 'Enter a URL to enable this field.'}
                                </small>
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Icon Class</Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    name="icon"
                                    placeholder="e.g., flaticon-381-layer"
                                    value={formData.icon}
                                    onChange={handleFormChange}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Order</Form.Label>
                                <Form.Control
                                    type="number"
                                    className="form-control-custom"
                                    name="order"
                                    required
                                    min="1"
                                    value={formData.order}
                                    onChange={handleFormChange}
                                />
                            </div>
                            <div className="col-md-6 mb-3 d-flex align-items-center">
                                <Form.Check
                                    type="checkbox"
                                    className="form-check-input-custom mt-4"
                                    id="is_active_submenu"
                                    name="is_active"
                                    label="Active"
                                    checked={formData.is_active}
                                    onChange={handleFormChange}
                                />
                            </div>
                            <div className="col-md-12 mb-3">
                                <Form.Label className="form-label-custom">Description</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    className="form-control-custom"
                                    name="description"
                                    placeholder="Enter description here..."
                                    rows="2"
                                    value={formData.description}
                                    onChange={handleFormChange}
                                />
                            </div>
                            <div className="col-md-12 mb-2">
                                <Form.Label className="form-label-custom mb-2">Form Capabilities</Form.Label>
                                <div className="d-flex flex-wrap gap-3 p-3 border rounded" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                                    {['has_create', 'has_edit', 'has_delete', 'has_approve', 'has_reject', 'has_details', 'has_allocate', 'has_history'].map(cap => (
                                        <Form.Check
                                            key={cap}
                                            type="checkbox"
                                            id={`cap_${cap}`}
                                            name={cap}
                                            label={cap.replace('has_', '').charAt(0).toUpperCase() + cap.replace('has_', '').slice(1)}
                                            checked={formData[cap]}
                                            onChange={handleFormChange}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowModal(false)}>Cancel</Button>
                        <Button type="submit" className="btn-save-custom">{editMode ? 'Save Changes' : 'Save'}</Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default ManageSubMenus;
