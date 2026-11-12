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
    fetchSubSubMenus,
    createSubSubMenu,
    updateSubSubMenu,
    deleteSubSubMenu,
    formatError
} from '../../services/MenuManagementService';
import CreateButton from '../../components/permissions/CreateButton';
import EditButton from '../../components/permissions/EditButton';
import DeleteButton from '../../components/permissions/DeleteButton';

const EMPTY_SUBSUBMENU = {
    submenu: '',
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

const ManageSubSubMenus = () => {
    const dispatch = useDispatch();
    const [subsubmenus, setSubSubMenus] = useState([]);
    const [menus, setMenus] = useState([]);
    const [submenus, setSubmenus] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [filterMenuId, setFilterMenuId] = useState('');
    const [filterSubMenuId, setFilterSubMenuId] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editSubSubMenuId, setEditSubSubMenuId] = useState(null);
    const [formData, setFormData] = useState({ ...EMPTY_SUBSUBMENU });
    const [selectedMenu, setSelectedMenu] = useState('');
    const [filteredSubmenusForModal, setFilteredSubmenusForModal] = useState([]);

    const currentSelectControlRef = useRef(null);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // Load data on component mount
    useEffect(() => {
        loadMenus();
        loadAllSubMenus();
        loadSubSubMenus();
    }, []);

    // Autofocus the first field (Parent Menu react-select dropdown) when modal opens
    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                const modal = document.querySelector('.subsubmenu-custom-modal');
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

    // Fetch parent menus
    const loadMenus = async () => {
        try {
            const response = await fetchMenus();
            setMenus(Array.isArray(response.data) ? response.data : (response.data.results ?? []));
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: formatError(error) });
        }
    };

    // Fetch all submenus
    const loadAllSubMenus = async () => {
        try {
            const response = await fetchSubMenus();
            setSubmenus(Array.isArray(response.data) ? response.data : (response.data.results ?? []));
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: formatError(error) });
        }
    };

    // Fetch subsubmenus from API
    const loadSubSubMenus = async () => {
        try {
            setLoading(true);
            const response = await fetchSubSubMenus();
            setSubSubMenus(Array.isArray(response.data) ? response.data : (response.data.results ?? []));
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: formatError(error) });
        } finally {
            setLoading(false);
        }
    };

    const handleMenuChangeInModal = (menuIdOrEvent) => {
        // Support both raw menuId value and standard event object
        const menuId = (menuIdOrEvent && typeof menuIdOrEvent === 'object' && 'target' in menuIdOrEvent)
            ? menuIdOrEvent.target.value
            : menuIdOrEvent;

        const idVal = menuId ? menuId.toString() : '';
        setSelectedMenu(idVal);
        const filtered = submenus.filter(sm => String(sm.menu) === idVal);
        setFilteredSubmenusForModal(filtered);
        setFormData(prev => ({ ...prev, submenu: '' }));
    };

    const handleShowModal = (subsubmenu = null) => {
        if (subsubmenu) {
            setEditSubSubMenuId(subsubmenu.id);
            const parentSubmenu = submenus.find(sm => sm.id === subsubmenu.submenu);
            if (parentSubmenu) {
                setSelectedMenu(parentSubmenu.menu.toString());
                const filtered = submenus.filter(sm => sm.menu === parentSubmenu.menu);
                setFilteredSubmenusForModal(filtered);
            } else {
                setSelectedMenu('');
                setFilteredSubmenusForModal([]);
            }

            setFormData({
                submenu: subsubmenu.submenu,
                name: subsubmenu.name,
                description: subsubmenu.description || '',
                code: subsubmenu.code || '',
                icon: subsubmenu.icon || '',
                url: subsubmenu.url || '',
                order: subsubmenu.order,
                is_active: subsubmenu.is_active,
                has_create: subsubmenu.has_create,
                has_edit: subsubmenu.has_edit,
                has_delete: subsubmenu.has_delete,
                has_approve: subsubmenu.has_approve || false,
                has_reject: subsubmenu.has_reject || false,
                has_details: subsubmenu.has_details || false,
                has_allocate: subsubmenu.has_allocate || false,
                has_history: subsubmenu.has_history || false,
            });
            setEditMode(true);
        } else {
            setFormData({ ...EMPTY_SUBSUBMENU });
            setSelectedMenu('');
            setFilteredSubmenusForModal([]);
            setEditSubSubMenuId(null);
            setEditMode(false);
        }
        setShowModal(true);
    };

    const toTitleCase = (str) => {
        if (!str) return '';
        return str.replace(/\b\w/g, c => c.toUpperCase());
    };

    const handleFormChange = (event) => {
        const { name, value, type, checked } = event.target;
        let formattedValue = value;
        if (name === 'name' && typeof value === 'string') {
            formattedValue = toTitleCase(value);
        } else if ((name === 'url' || name === 'code') && typeof value === 'string') {
            formattedValue = value.toLowerCase();
        }
        setFormData(prev => {
            const newData = {
                ...prev,
                [name]: type === 'checkbox' ? checked : formattedValue
            };
            if (name === 'url' && !value) {
                newData.code = '';
            }
            return newData;
        });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!formData.name.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'SubSubMenu name is required.' });
            return;
        }
        if (!formData.submenu) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Parent SubMenu selection is required.' });
            return;
        }
        const payload = {
            ...formData,
            name: toTitleCase(formData.name.trim()),
            url: formData.url ? formData.url.trim().toLowerCase() : '',
            code: formData.code ? formData.code.trim().toLowerCase() : ''
        };
        const parentSubmenu = submenus.find(sm => String(sm.id) === String(formData.submenu));
        const parentMenu = parentSubmenu ? menus.find(m => String(m.id) === String(parentSubmenu.menu)) : null;

        if (formData.is_active && parentSubmenu && !parentSubmenu.is_active) {
            Swal.fire({
                icon: 'warning',
                title: 'Parent SubMenu Inactive',
                text: `Cannot set "${formData.name || 'SubSubMenu'}" as active because parent submenu "${parentSubmenu.name}" is inactive.`,
            });
            return;
        }
        if (formData.is_active && parentMenu && !parentMenu.is_active) {
            Swal.fire({
                icon: 'warning',
                title: 'Parent Menu Inactive',
                text: `Cannot set "${formData.name || 'SubSubMenu'}" as active because parent menu "${parentMenu.name}" is inactive.`,
            });
            return;
        }
        try {
            if (editMode) {
                await updateSubSubMenu(editSubSubMenuId, payload);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'SubSubMenu updated successfully.', timer: 2000, showConfirmButton: false });
            } else {
                await createSubSubMenu(payload);
                Swal.fire({ icon: 'success', title: 'Created', text: 'SubSubMenu created successfully.', timer: 2000, showConfirmButton: false });
            }
            setShowModal(false);
            loadSubSubMenus();
            dispatch(fetchUserMenusAction());
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: formatError(error) });
        }
    };

    const handleDelete = async (ssm) => {
        const result = await Swal.fire({
            title: 'Deactivate SubSubMenu?',
            text: `Are you sure you want to deactivate "${ssm.name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, deactivate it',
        });
        if (result.isConfirmed) {
            try {
                await updateSubSubMenu(ssm.id, { ...ssm, is_active: false });
                Swal.fire({ icon: 'success', title: 'Deactivated', text: 'SubSubMenu has been deactivated.', timer: 2000, showConfirmButton: false });
                loadSubSubMenus();
                dispatch(fetchUserMenusAction());
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: formatError(error) });
            }
        }
    };

    const handleActivate = async (ssm) => {
        const parentSubmenu = submenus.find(sm => String(sm.id) === String(ssm.submenu));
        const parentMenu = parentSubmenu ? menus.find(m => String(m.id) === String(parentSubmenu.menu)) : null;

        if (parentSubmenu && !parentSubmenu.is_active) {
            Swal.fire({
                icon: 'warning',
                title: 'Parent SubMenu Inactive',
                text: `Cannot activate "${ssm.name}" because its parent submenu "${parentSubmenu.name}" is inactive. Please activate the parent submenu first.`,
            });
            return;
        }
        if (parentMenu && !parentMenu.is_active) {
            Swal.fire({
                icon: 'warning',
                title: 'Parent Menu Inactive',
                text: `Cannot activate "${ssm.name}" because its parent menu "${parentMenu.name}" is inactive. Please activate the parent menu first.`,
            });
            return;
        }

        const result = await Swal.fire({
            title: 'Activate SubSubMenu?',
            text: `Are you sure you want to activate "${ssm.name}"?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#0a500f',
            confirmButtonText: 'Yes, activate it',
        });
        if (result.isConfirmed) {
            try {
                await updateSubSubMenu(ssm.id, { ...ssm, is_active: true });
                Swal.fire({ icon: 'success', title: 'Activated', text: 'SubSubMenu has been activated.', timer: 2000, showConfirmButton: false });
                loadSubSubMenus();
                dispatch(fetchUserMenusAction());
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: formatError(error) });
            }
        }
    };

    const getSubmenuInfo = (submenuId) => {
        const submenu = submenus.find(sm => sm.id === submenuId);
        if (!submenu) return { menu: 'Unknown', submenu: 'Unknown' };
        const menu = menus.find(m => m.id === submenu.menu);
        return {
            menu: menu ? menu.name : 'Unknown',
            submenu: submenu.name
        };
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

    // Filter subsubmenus based on search term and dropdown filters
    const filteredSubsubmenus = subsubmenus
        .filter(ssm => {
            const info = getSubmenuInfo(ssm.submenu);
            const matchesSearch = 
                (ssm.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (ssm.url || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (info.menu || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (info.submenu || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            const submenu = submenus.find(sm => sm.id === ssm.submenu);
            const matchesMenuFilter = !filterMenuId || (submenu && String(submenu.menu) === String(filterMenuId));
            const matchesSubMenuFilter = !filterSubMenuId || String(ssm.submenu) === String(filterSubMenuId);
            
            return matchesSearch && matchesMenuFilter && matchesSubMenuFilter;
        })
        .sort((a, b) => {
            const infoA = getSubmenuInfo(a.submenu);
            const infoB = getSubmenuInfo(b.submenu);
            const menuA = (infoA.menu || '').toLowerCase();
            const menuB = (infoB.menu || '').toLowerCase();
            if (menuA < menuB) return -1;
            if (menuA > menuB) return 1;
            
            const subMenuA = (infoA.submenu || '').toLowerCase();
            const subMenuB = (infoB.submenu || '').toLowerCase();
            if (subMenuA < subMenuB) return -1;
            if (subMenuA > subMenuB) return 1;

            return (a.order || 0) - (b.order || 0);
        });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentSubsubmenus = filteredSubsubmenus.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredSubsubmenus.length / itemsPerPage);

    const activeSubmenusForFilter = filterMenuId 
        ? submenus.filter(sm => String(sm.menu) === String(filterMenuId))
        : submenus;

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15,0.15)' : 'none',
            '&:hover': { borderColor: '#0a500f' },
            borderRadius: '10px',
            fontSize: '13px',
        }),
        menu: base => ({ ...base, zIndex: 9999, fontSize: '13px' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? '#eefdf6' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    const menuOptions = menus.map(m => ({ value: m.id, label: m.name }));
    const menuValue = menuOptions.find(opt => String(opt.value) === String(selectedMenu)) || null;

    const submenuOptions = filteredSubmenusForModal.map(sm => ({ value: sm.id, label: sm.name }));
    const submenuValue = submenuOptions.find(opt => String(opt.value) === String(formData.submenu)) || null;

    return (
        <div className="container-fluid">
            <style>{`
                .subsubmenu-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .subsubmenu-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .subsubmenu-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .subsubmenu-custom-modal .modal-close-x {
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
                .subsubmenu-custom-modal .modal-close-x:hover { color: #555; }
                .subsubmenu-custom-modal .modal-body-custom {
                    padding: 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .subsubmenu-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .subsubmenu-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .subsubmenu-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .subsubmenu-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .subsubmenu-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
                .subsubmenu-custom-modal .form-check-input:checked {
                    background-color: #0a500f;
                    border-color: #0a500f;
                }
                .subsubmenu-custom-modal .btn-close-custom {
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
                .subsubmenu-custom-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .subsubmenu-custom-modal .btn-save-custom {
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
                .subsubmenu-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
            `}</style>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <Card.Title className="mb-0">SubSubMenu Management</Card.Title>
                            <div className="d-flex flex-wrap gap-2 align-items-center">
                                <div style={{ flex: '1 1 auto', minWidth: '150px' }}>
                                    <Form.Select
                                        className="form-control"
                                        value={filterMenuId}
                                        onChange={(e) => {
                                            setFilterMenuId(e.target.value);
                                            setFilterSubMenuId('');
                                        }}
                                        style={{ height: '38px', borderRadius: '6px', fontSize: '13px' }}
                                    >
                                        <option value="">All Menus</option>
                                        {menus.map(menu => (
                                            <option key={menu.id} value={menu.id}>{menu.name}</option>
                                        ))}
                                    </Form.Select>
                                </div>
                                <div style={{ flex: '1 1 auto', minWidth: '150px' }}>
                                    <Form.Select
                                        className="form-control"
                                        value={filterSubMenuId}
                                        onChange={(e) => setFilterSubMenuId(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', fontSize: '13px' }}
                                    >
                                        <option value="">All SubMenus</option>
                                        {activeSubmenusForFilter.map(submenu => (
                                            <option key={submenu.id} value={submenu.id}>{submenu.name}</option>
                                        ))}
                                    </Form.Select>
                                </div>
                                <div style={{ flex: '1 1 auto', minWidth: '200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search subsubmenus..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <CreateButton module="subsubmenus" onClick={() => handleShowModal()}>
                                    SubSubMenu
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
                                                <th><strong>MENU</strong></th>
                                                <th><strong>SUBMENU</strong></th>
                                                <th><strong>NAME</strong></th>
                                                <th><strong>CODE</strong></th>
                                                <th><strong>URL</strong></th>
                                                <th><strong>ORDER</strong></th>
                                                <th><strong>STATUS</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSubsubmenus.length === 0 ? (
                                                <tr>
                                                    <td colSpan="8" className="text-center py-4 text-muted">No entries</td>
                                                </tr>
                                            ) : (
                                                Object.entries(
                                                    currentSubsubmenus.reduce((acc, ssm) => {
                                                        const info = getSubmenuInfo(ssm.submenu);
                                                        const groupKey = `${info.menu} > ${info.submenu}`;
                                                        if (!acc[groupKey]) acc[groupKey] = [];
                                                        acc[groupKey].push(ssm);
                                                        return acc;
                                                    }, {})
                                                ).map(([groupKey, items]) => (
                                                    <Fragment key={groupKey}>
                                                        <tr className="bg-light">
                                                            <td colSpan="8"><strong><i className="fa fa-folder-open text-primary me-2"></i>{groupKey}</strong></td>
                                                        </tr>
                                                        {items.map(ssm => (
                                                            <tr key={ssm.id}>
                                                                <td></td>
                                                                <td></td>
                                                                <td>
                                                                    <i className="fa fa-level-up-alt fa-rotate-90 text-muted me-2 ms-2"></i>
                                                                    {ssm.name}
                                                                </td>
                                                                <td>{ssm.code || '-'}</td>
                                                                <td>{ssm.url || '-'}</td>
                                                                <td>{ssm.order}</td>
                                                                <td>
                                                                    {ssm.is_active
                                                                        ? <span className="badge light badge-success">Active</span>
                                                                        : <span className="badge light badge-danger">Inactive</span>
                                                                    }
                                                                </td>
                                                                <td className="text-end">
                                                                    <div className="d-flex justify-content-end gap-1">
                                                                        <EditButton module="subsubmenus" onClick={() => handleShowModal(ssm)} />
                                                                        {ssm.is_active
                                                                            ? <DeleteButton module="subsubmenus" onClick={() => handleDelete(ssm)} iconClass="fa fa-ban" title="Deactivate" />
                                                                            : <Button
                                                                                variant="outline-success"
                                                                                size="sm"
                                                                                className="shadow"
                                                                                title="Activate"
                                                                                onClick={() => handleActivate(ssm)}
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

                            {filteredSubsubmenus.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredSubsubmenus.length)} of {filteredSubsubmenus.length} entries
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
            <Modal show={showModal} onHide={() => setShowModal(false)} dialogClassName="subsubmenu-custom-modal modal-lg" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit SubSubMenu' : 'Create SubSubMenu'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage subsubmenu configuration
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
                                        handleMenuChangeInModal(opt ? opt.value : '');
                                        if (opt) {
                                            const control = currentSelectControlRef.current;
                                            setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
                                        }
                                    }}
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleSelectKeyDown}
                                    openMenuOnFocus={true}
                                    placeholder="Search Menu..."
                                    isClearable
                                    styles={selectStyles}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Parent SubMenu <span className="text-danger">*</span></Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    options={submenuOptions}
                                    value={submenuValue}
                                    onChange={(opt) => {
                                        setFormData(prev => ({ ...prev, submenu: opt ? opt.value : '' }));
                                        if (opt) {
                                            const control = currentSelectControlRef.current;
                                            setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
                                        }
                                    }}
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleSelectKeyDown}
                                    openMenuOnFocus={true}
                                    placeholder="Search SubMenu..."
                                    isDisabled={!selectedMenu}
                                    isClearable
                                    styles={selectStyles}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">SubSubMenu Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    name="name"
                                    required
                                    placeholder="e.g., Compose"
                                    value={formData.name}
                                    onChange={handleFormChange}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">URL <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    style={{ textTransform: 'none' }}
                                    name="url"
                                    required
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    placeholder="e.g., /email-compose"
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
                                    placeholder={formData.url ? "e.g., compose" : "Please enter URL first"}
                                    disabled={!formData.url}
                                    required={!!formData.url}
                                />
                                <small className="text-muted d-block mt-1">
                                    {formData.url ? "Unique code used for permission checks." : "Enter a URL to enable this field."}
                                </small>
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Icon Class</Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    name="icon"
                                    placeholder="e.g., flaticon-381-notepad"
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
                                    id="is_active_subsubmenu"
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

export default ManageSubSubMenus;
