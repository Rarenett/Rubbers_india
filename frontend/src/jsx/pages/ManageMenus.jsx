import React, { useState, useEffect, Fragment } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Card, Modal, Form, Button } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { fetchUserMenusAction } from '../../store/actions/MenuActions';
import {
    fetchMenus,
    restoreDefaultMenus,
    createMenu,
    updateMenu,
    deleteMenu,
    formatError
} from '../../services/MenuManagementService';
import CreateButton from '../../components/permissions/CreateButton';
import EditButton from '../../components/permissions/EditButton';
import DeleteButton from '../../components/permissions/DeleteButton';
import CustomTextField from '../components/Common/CustomTextField';

const EMPTY_MENU = {
    name: '',
    code: '',
    description: '',
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

const ManageMenus = () => {
    const dispatch = useDispatch();
    const [menus, setMenus] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editMenuId, setEditMenuId] = useState(null);
    const [formData, setFormData] = useState({ ...EMPTY_MENU });

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        loadMenus();
    }, []);

    const loadMenus = async () => {
        try {
            setLoading(true);
            const response = await fetchMenus();
            setMenus(response.data);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: formatError(error) });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (menu = null) => {
        if (menu) {
            setFormData({
                name: menu.name,
                code: menu.code || '',
                description: menu.description || '',
                icon: menu.icon || '',
                url: menu.url || '',
                order: menu.order,
                is_active: menu.is_active,
                has_create: menu.has_create,
                has_edit: menu.has_edit,
                has_delete: menu.has_delete,
                has_approve: menu.has_approve || false,
                has_reject: menu.has_reject || false,
                has_details: menu.has_details || false,
                has_allocate: menu.has_allocate || false,
                has_history: menu.has_history || false,
            });
            setEditMenuId(menu.id);
            setEditMode(true);
        } else {
            setFormData({ ...EMPTY_MENU });
            setEditMenuId(null);
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
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Menu name is required.' });
            return;
        }
        const payload = {
            ...formData,
            name: toTitleCase(formData.name.trim()),
            url: formData.url ? formData.url.trim().toLowerCase() : '',
            code: formData.code ? formData.code.trim().toLowerCase() : ''
        };
        try {
            if (editMode) {
                await updateMenu(editMenuId, payload);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Menu updated successfully.', timer: 2000, showConfirmButton: false });
            } else {
                await createMenu(payload);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Menu created successfully.', timer: 2000, showConfirmButton: false });
            }
            setShowModal(false);
            loadMenus();
            dispatch(fetchUserMenusAction());
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: formatError(error) });
        }
    };

    const handleDelete = async (menu) => {
        const result = await Swal.fire({
            title: 'Deactivate Menu?',
            text: `Are you sure you want to deactivate "${menu.name}"? All its submenus and subsubmenus will also be deactivated.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, deactivate it',
        });
        if (result.isConfirmed) {
            try {
                await updateMenu(menu.id, { ...menu, is_active: false });
                Swal.fire({ icon: 'success', title: 'Deactivated', text: 'Menu and its submenus deactivated successfully.', timer: 2000, showConfirmButton: false });
                loadMenus();
                dispatch(fetchUserMenusAction());
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: formatError(error) });
            }
        }
    };

    const handleActivate = async (menu) => {
        const result = await Swal.fire({
            title: 'Activate Menu?',
            text: `Are you sure you want to activate "${menu.name}"?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#0a500f',
            confirmButtonText: 'Yes, activate it',
        });
        if (result.isConfirmed) {
            try {
                await updateMenu(menu.id, { ...menu, is_active: true });
                Swal.fire({ icon: 'success', title: 'Activated', text: 'Menu activated successfully.', timer: 2000, showConfirmButton: false });
                loadMenus();
                dispatch(fetchUserMenusAction());
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: formatError(error) });
            }
        }
    };

    const handleRestoreDefaults = async () => {
        const result = await Swal.fire({
            title: 'Restore Default Menus?',
            text: 'This will re-seed any missing system default menus into the database while preserving existing custom menus.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, Restore Defaults',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            try {
                await restoreDefaultMenus();
                Swal.fire({ icon: 'success', title: 'Restored', text: 'Default menus restored successfully.', timer: 2000, showConfirmButton: false });
                loadMenus();
                dispatch(fetchUserMenusAction());
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: formatError(error) });
            }
        }
    };

    // Enter key navigation — move focus to next focusable field; last field submits
    const getFocusable = () =>
        Array.from(
            document.querySelectorAll('.form-control-custom, input[type="checkbox"]:not([disabled]), button[type="submit"]:not([disabled])')
        ).filter(el => el.offsetParent !== null && !el.disabled);

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        const all = getFocusable();
        const index = all.indexOf(document.activeElement);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else {
                all[index + 1].focus();
            }
        }
    };

    const filteredMenus = menus
        .filter(m =>
            (m.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (m.url || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentMenus = filteredMenus.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredMenus.length / itemsPerPage);

    return (
        <div className="container-fluid">
            <style>{`
                .menu-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .menu-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .menu-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #0a500f;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .menu-custom-modal .modal-close-x {
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
                .menu-custom-modal .modal-close-x:hover { color: #555; }
                .menu-custom-modal .modal-body-custom {
                    padding: 28px;
                    max-height: 70vh;
                    overflow-y: auto;
                }
                .menu-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .menu-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .menu-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .menu-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .menu-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
                .menu-custom-modal .form-check-input:checked {
                    background-color: #0a500f;
                    border-color: #0a500f;
                }
                .menu-custom-modal .btn-close-custom {
                    background-color: #dc3545 !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .menu-custom-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
                .menu-custom-modal .btn-save-custom {
                    background-color: #0a500f !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .menu-custom-modal .btn-save-custom:hover { background-color: #073d0b !important; }
            `}</style>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <Card.Title className="mb-0">Menu Management</Card.Title>
                            <div className="d-flex flex-wrap gap-2 align-items-center">
                                <div style={{ flex: '1 1 auto', minWidth: '200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search menus..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    onClick={handleRestoreDefaults}
                                    style={{ height: '38px', borderRadius: '6px', fontWeight: '500' }}
                                    title="Re-seed missing system default menus"
                                >
                                    <i className="fa fa-sync-alt me-1"></i> Restore Defaults
                                </Button>
                                <CreateButton module="menus" onClick={() => handleShowModal()}>
                                    Menu
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
                                                <th><strong>NAME</strong></th>
                                                <th><strong>ICON</strong></th>
                                                <th><strong>URL</strong></th>
                                                <th><strong>ORDER</strong></th>
                                                <th><strong>STATUS</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredMenus.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="text-center py-4 text-muted">No entries</td>
                                                </tr>
                                            ) : (
                                                currentMenus.map((menu) => (
                                                    <tr key={menu.id}>
                                                        <td><strong>{menu.name}</strong></td>
                                                        <td>{menu.icon ? <span className="badge badge-info light"><i className={`${menu.icon} me-1`}></i> {menu.icon}</span> : '-'}</td>
                                                        <td>{menu.url || '-'}</td>
                                                        <td>{menu.order}</td>
                                                        <td>
                                                            {menu.is_active
                                                                ? <span className="badge light badge-success">Active</span>
                                                                : <span className="badge light badge-danger">Inactive</span>
                                                            }
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end gap-1">
                                                                <EditButton module="menus" onClick={() => handleShowModal(menu)} />
                                                                {menu.is_active
                                                                    ? <DeleteButton module="menus" onClick={() => handleDelete(menu)} iconClass="fa fa-ban" title="Deactivate" />
                                                                    : <Button
                                                                        variant="outline-success"
                                                                        size="sm"
                                                                        className="shadow"
                                                                        title="Activate"
                                                                        onClick={() => handleActivate(menu)}
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
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {filteredMenus.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredMenus.length)} of {filteredMenus.length} entries
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
            <Modal show={showModal} onHide={() => setShowModal(false)} dialogClassName="menu-custom-modal modal-lg" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Menu' : 'Create Menu'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage menu configuration
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <CustomTextField
                                containerClass="col-md-6 mb-3"
                                label="Menu Name"
                                name="name"
                                required
                                casing="title"
                                placeholder="e.g., Dashboard"
                                value={formData.name}
                                onChange={handleFormChange}
                                autoFocus
                            />
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
                                    placeholder="Leave blank if menu has submenus"
                                    value={formData.url}
                                    onChange={handleFormChange}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">Menu Code</Form.Label>
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
                                    placeholder={formData.url ? 'e.g., company, hr, billing' : 'Please enter URL first'}
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
                                    placeholder="e.g., flaticon-381-networking"
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
                                    min="0"
                                    value={formData.order}
                                    onChange={handleFormChange}
                                />
                            </div>
                            <div className="col-md-6 mb-3 d-flex align-items-center">
                                <Form.Check
                                    type="checkbox"
                                    className="form-check-input-custom mt-4"
                                    id="is_active_menu"
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

export default ManageMenus;
