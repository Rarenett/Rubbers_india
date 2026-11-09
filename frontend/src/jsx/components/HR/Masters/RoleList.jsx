import React, { useState, useEffect, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getRoles,
    createRole,
    updateRole,
    deleteRole,
    formatFriendlyError,
    getDashboards
} from '../../../../services/HRManagementService';
import { usePermission } from '../../../../hooks/usePermission';
import CreateButton from '../../../../components/permissions/CreateButton';
import EditButton from '../../../../components/permissions/EditButton';
import DeleteButton from '../../../../components/permissions/DeleteButton';

const RoleList = () => {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const { can } = usePermission();

    // Role modal
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentRole, setCurrentRole] = useState({ id: null, name: '', description: '', dashboard_name: '', dashboards: [] });
    const [availableDashboards, setAvailableDashboards] = useState([]);

    // Get current company from user details
    const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
    const companyId = userDetails.user?.company_id || 1; // Default to 1 if not found for now

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [roleData, dashboardsData] = await Promise.all([
                getRoles(),
                getDashboards()
            ]);
            setRoles(roleData);
            if (Array.isArray(dashboardsData)) {
                setAvailableDashboards(dashboardsData);
            } else if (dashboardsData && dashboardsData.results) {
                setAvailableDashboards(dashboardsData.results);
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch roles or dashboards',
            });
        } finally {
            setLoading(false);
        }
    };

    // Autofocus effect
    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                const inputs = Array.from(
                    document.querySelectorAll('.role-custom-modal input:not([disabled]):not([readonly]), .role-custom-modal textarea:not([disabled]):not([readonly])')
                ).filter(el => el.offsetParent !== null && el.type !== 'hidden');
                if (inputs.length > 0) inputs[0].focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showModal]);

    // Keyboard navigation
    const getFocusable = () => {
        const modal = document.querySelector('.role-custom-modal');
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.form-control-custom, button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        if (document.activeElement.tagName === 'TEXTAREA') return;

        const activeEl = document.activeElement;
        const all = getFocusable();
        const index = all.indexOf(activeEl);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else {
                all[index + 1].focus();
            }
        }
    };

    const handleShowModal = (role = null) => {
        if (role) {
            const roleDashboards = role.assigned_dashboards ? role.assigned_dashboards.map(d => ({
                dashboard_id: d.dashboard_id,
                is_default: d.is_default
            })) : [];
            setCurrentRole({ ...role, dashboards: roleDashboards });
            setEditMode(true);
        } else {
            setCurrentRole({ id: null, name: '', description: '', dashboard_name: '', dashboards: [] });
            setEditMode(false);
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentRole.name.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Role name is required' });
            return;
        }

        try {
            const payload = {
                name: (currentRole.name || '').trim().replace(/\b\w/g, c => c.toUpperCase()),
                description: currentRole.description,
                dashboard_name: currentRole.dashboard_name,
                company: companyId,
                dashboards: currentRole.dashboards
            };

            if (editMode) {
                await updateRole(currentRole.id, payload);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Role updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                await createRole(payload);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Role created successfully', timer: 2000, showConfirmButton: false });
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            const errorMsg = formatFriendlyError(error, `Failed to ${editMode ? 'update' : 'create'} role`);
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Role?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteRole(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Role deleted successfully', timer: 2000, showConfirmButton: false });
                fetchData();
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete role' });
            }
        }
    };

    const filteredRoles = roles
        .filter(role =>
            (role.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (role.description || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentRoles = filteredRoles.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredRoles.length / itemsPerPage);

    return (
        <div className="container-fluid">
            <style>{`
                .role-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .role-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .role-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
                .role-custom-modal .modal-close-x {
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
                .role-custom-modal .modal-close-x:hover { color: #555; }
                .role-custom-modal .modal-body-custom { padding: 28px; }
                .role-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .role-custom-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .role-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .role-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .role-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
                .role-custom-modal .btn-close-custom {
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
                .role-custom-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .role-custom-modal .btn-save-custom {
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
                .role-custom-modal .btn-save-custom:hover { background-color: #26b277 !important; }
                .search-input-custom {
                    height: 38px !important;
                    border-radius: 6px !important;
                    padding-left: 35px !important;
                    font-size: 13px !important;
                }
            `}</style>

            

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title className="mb-0">Roles Management</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Role..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="search-input-custom"
                                    />
                                </div>
                                <CreateButton
                                    module="roles"
                                    onClick={() => handleShowModal()}
                                >
                                    Role
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
                                <div>
                                    <div className="table-responsive">
                                        <table className="table table-responsive-md">
                                            <thead>
                                                <tr>
                                                    <th><strong>SL NO</strong></th>
                                                    <th><strong>NAME</strong></th>
                                                    <th><strong>DESCRIPTION</strong></th>
                                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredRoles.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="4" className="text-center py-4 text-muted">
                                                            No entries
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentRoles.map((role, index) => (
                                                        <tr key={role.id}>
                                                            <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                            <td><strong>{role.name}</strong></td>
                                                            <td>{role.description || '-'}</td>
                                                            <td className="text-end">
                                                                {can('permissions', 'view') || can('roles', 'edit') || can('roles', 'delete') ? (
                                                                    <div className="d-flex justify-content-end gap-1">
                                                                        <EditButton
                                                                            module="roles"
                                                                            action="view"
                                                                            to={`/manage-permissions?roleId=${role.id}`}
                                                                            variant="primary"
                                                                            className="btn-xs sharp"
                                                                            title="Permissions"
                                                                            icon="fa fa-list"
                                                                        />
                                                                        <EditButton
                                                                            module="roles"
                                                                            onClick={() => handleShowModal(role)}
                                                                        />
                                                                        <DeleteButton
                                                                            module="roles"
                                                                            onClick={() => handleDelete(role.id, role.name)}
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <span className="badge badge-danger light mt-1">No Access</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {filteredRoles.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredRoles.length)} of {filteredRoles.length} entries
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
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Role Modal */}
            <Modal show={showModal} onHide={() => setShowModal(false)} dialogClassName="role-custom-modal modal-md" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 15l-4-4 1.41-1.41L10 13.17l6.59-6.59L18 8l-8 8z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Role' : 'Add Role'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Manage user role designations and dashboards
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                    <div className="modal-body-custom">
                        <Form.Group className="mb-3">
                            <Form.Label className="form-label-custom">Role Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                className="form-control-custom"
                                value={currentRole.name}
                                onChange={(e) => setCurrentRole({ ...currentRole, name: e.target.value })}
                                placeholder="Enter role name"
                                required
                            />
                        </Form.Group>
                    
                        <Form.Group className="mb-3">
                            <Form.Label className="form-label-custom">Description</Form.Label>
                            <Form.Control
                                as="textarea"
                                className="form-control-custom"
                                rows={3}
                                value={currentRole.description || ''}
                                onChange={(e) => setCurrentRole({ ...currentRole, description: e.target.value })}
                                placeholder="Enter role description"
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label className="form-label-custom">Assign Dashboards</Form.Label>
                            {availableDashboards.length > 0 ? (
                                <div className="border rounded p-3 bg-light">
                                    <div className="row fw-bold text-muted mb-2 border-bottom pb-2">
                                        <div className="col-8">Dashboard</div>
                                        <div className="col-4 text-center">Default</div>
                                    </div>
                                    {availableDashboards.map(dashboard => {
                                        const isAssigned = currentRole.dashboards.some(d => d.dashboard_id === dashboard.id);
                                        const isDefault = currentRole.dashboards.some(d => d.dashboard_id === dashboard.id && d.is_default);
                                        return (
                                            <div key={dashboard.id} className="row align-items-center mb-2">
                                                <div className="col-8">
                                                    <Form.Check 
                                                        type="checkbox"
                                                        id={`dash-${dashboard.id}`}
                                                        label={dashboard.name}
                                                        checked={isAssigned}
                                                        onChange={(e) => {
                                                            let newDashboards = [...currentRole.dashboards];
                                                            if (e.target.checked) {
                                                                newDashboards.push({ dashboard_id: dashboard.id, is_default: false });
                                                                if (newDashboards.length === 1) {
                                                                    newDashboards[0].is_default = true;
                                                                }
                                                            } else {
                                                                newDashboards = newDashboards.filter(d => d.dashboard_id !== dashboard.id);
                                                                if (isDefault && newDashboards.length > 0) {
                                                                    newDashboards[0].is_default = true;
                                                                }
                                                            }
                                                            setCurrentRole({ ...currentRole, dashboards: newDashboards });
                                                        }}
                                                    />
                                                </div>
                                                <div className="col-4 text-center">
                                                    <Form.Check 
                                                        type="radio"
                                                        name="default_dashboard"
                                                        id={`default-dash-${dashboard.id}`}
                                                        disabled={!isAssigned}
                                                        checked={isDefault}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                const newDashboards = currentRole.dashboards.map(d => ({
                                                                    ...d,
                                                                    is_default: d.dashboard_id === dashboard.id
                                                                }));
                                                                setCurrentRole({ ...currentRole, dashboards: newDashboards });
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-muted small">No dashboards available.</div>
                            )}
                        </Form.Group>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowModal(false)}>Cancel</Button>
                        <Button type="submit" className="btn-save-custom">Save</Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default RoleList;
