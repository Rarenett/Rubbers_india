import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getDashboards,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    formatFriendlyError
} from '../../../../services/HRManagementService';
import { usePermission } from '../../../../hooks/usePermission';
import CreateButton from '../../../../components/permissions/CreateButton';
import EditButton from '../../../../components/permissions/EditButton';
import DeleteButton from '../../../../components/permissions/DeleteButton';

const DashboardList = () => {
    const [dashboards, setDashboards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const { can } = usePermission();

    // Dashboard modal
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentDashboard, setCurrentDashboard] = useState({ id: null, name: '', code: '', route: '', is_active: true });

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getDashboards();
            setDashboards(Array.isArray(data) ? data : (data.results || []));
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch dashboards',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (dashboard = null) => {
        if (dashboard) {
            setCurrentDashboard(dashboard);
            setEditMode(true);
        } else {
            setCurrentDashboard({ id: null, name: '', code: '', route: '', is_active: true });
            setEditMode(false);
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentDashboard.name.trim() || !currentDashboard.code.trim() || !currentDashboard.route.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Name, Code, and URL are required.' });
            return;
        }

        try {
            const payload = {
                name: currentDashboard.name.trim(),
                code: currentDashboard.code.trim(),
                route: currentDashboard.route.trim(),
                is_active: currentDashboard.is_active
            };

            if (editMode) {
                await updateDashboard(currentDashboard.id, payload);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Dashboard updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                await createDashboard(payload);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Dashboard created successfully', timer: 2000, showConfirmButton: false });
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            const errorMsg = formatFriendlyError(error, `Failed to ${editMode ? 'update' : 'create'} dashboard`);
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Dashboard?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteDashboard(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Dashboard deleted successfully', timer: 2000, showConfirmButton: false });
                fetchData();
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete dashboard' });
            }
        }
    };

    const filteredDashboards = dashboards
        .filter(d =>
            (d.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (d.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (d.route || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentDashboards = filteredDashboards.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredDashboards.length / itemsPerPage);

    return (
        <div className="container-fluid">
            <style>{`
                .dashboard-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .dashboard-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .dashboard-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
                .dashboard-custom-modal .modal-close-x {
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
                .dashboard-custom-modal .modal-close-x:hover { color: #555; }
                .dashboard-custom-modal .modal-body-custom { padding: 28px; }
                .dashboard-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .dashboard-custom-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .dashboard-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .dashboard-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .dashboard-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
                .dashboard-custom-modal .btn-close-custom {
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
                .dashboard-custom-modal .btn-save-custom {
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
                            <Card.Title className="mb-0">Dashboards Management</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Dashboards..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="search-input-custom"
                                    />
                                </div>
                                <CreateButton
                                    module="roles" // Assuming you want 'roles' permission for this, or change it
                                    onClick={() => handleShowModal()}
                                >
                                    Dashboard
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
                                                    <th><strong>CODE</strong></th>
                                                    <th><strong>URL</strong></th>
                                                    <th><strong>STATUS</strong></th>
                                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredDashboards.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="6" className="text-center py-4 text-muted">
                                                            No entries
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentDashboards.map((dashboard, index) => (
                                                        <tr key={dashboard.id}>
                                                            <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                            <td><strong>{dashboard.name}</strong></td>
                                                            <td>{dashboard.code}</td>
                                                            <td><code>{dashboard.route}</code></td>
                                                            <td>
                                                                <span className={`badge ${dashboard.is_active ? 'badge-success' : 'badge-danger'} light`}>
                                                                    {dashboard.is_active ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </td>
                                                            <td className="text-end">
                                                                {can('roles', 'edit') || can('roles', 'delete') ? (
                                                                    <div className="d-flex justify-content-end gap-1">
                                                                        <EditButton
                                                                            module="roles"
                                                                            onClick={() => handleShowModal(dashboard)}
                                                                        />
                                                                        <DeleteButton
                                                                            module="roles"
                                                                            onClick={() => handleDelete(dashboard.id, dashboard.name)}
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

                                    {filteredDashboards.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredDashboards.length)} of {filteredDashboards.length} entries
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

            {/* Dashboard Modal */}
            <Modal show={showModal} onHide={() => setShowModal(false)} dialogClassName="dashboard-custom-modal modal-md" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-tachometer text-white fs-4"></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Dashboard' : 'Add Dashboard'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Manage dashboard options for user roles
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleSubmit}>
                    <div className="modal-body-custom">
                        <Form.Group className="mb-3">
                            <Form.Label className="form-label-custom">Dashboard Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                className="form-control-custom"
                                value={currentDashboard.name}
                                onChange={(e) => setCurrentDashboard({ ...currentDashboard, name: e.target.value })}
                                placeholder="e.g. Sales Dashboard"
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label className="form-label-custom">Code <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                className="form-control-custom"
                                value={currentDashboard.code}
                                onChange={(e) => setCurrentDashboard({ ...currentDashboard, code: e.target.value })}
                                placeholder="e.g. sales_dashboard"
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label className="form-label-custom">URL <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                className="form-control-custom"
                                value={currentDashboard.route}
                                onChange={(e) => setCurrentDashboard({ ...currentDashboard, route: e.target.value })}
                                placeholder="e.g. /sales/dashboard"
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3 d-flex align-items-center gap-2">
                            <Form.Check
                                type="switch"
                                id="dashboard-active-switch"
                                checked={currentDashboard.is_active}
                                onChange={(e) => setCurrentDashboard({ ...currentDashboard, is_active: e.target.checked })}
                            />
                            <Form.Label htmlFor="dashboard-active-switch" className="mb-0 form-label-custom" style={{ cursor: 'pointer' }}>Active</Form.Label>
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

export default DashboardList;
