import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, Row, Col, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import axiosInstance from '../../../services/AxiosInstance';
import { usePageTitle } from '../../../context/TitleContext';
import { usePermission } from '../../../hooks/usePermission';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const CrmServiceList = () => {
    usePageTitle('CRM Services');
    const navigate = useNavigate();
    const { can } = usePermission();

    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        is_active: true
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            let res;
            try {
                res = await axiosInstance.get('/api/crm_new/services/');
            } catch (fallbackErr) {
                res = await axiosInstance.get('/api/crm/services/');
            }
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setServices(data);
        } catch (err) {
            console.error('Error fetching CRM services:', err);
            Swal.fire('Error', 'Failed to fetch services', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (service = null) => {
        if (service) {
            setEditId(service.id);
            setFormData({
                name: service.name || '',
                description: service.description || '',
                is_active: service.is_active !== undefined ? service.is_active : true
            });
        } else {
            setEditId(null);
            setFormData({
                name: '',
                description: '',
                is_active: true
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            Swal.fire('Warning', 'Service Name is required', 'warning');
            return;
        }

        try {
            if (editId) {
                try {
                    await axiosInstance.put(`/api/crm_new/services/${editId}/`, formData);
                } catch {
                    await axiosInstance.put(`/api/crm/services/${editId}/`, formData);
                }
                Swal.fire('Updated', 'Service updated successfully', 'success');
            } else {
                try {
                    await axiosInstance.post('/api/crm_new/services/', formData);
                } catch {
                    await axiosInstance.post('/api/crm/services/', formData);
                }
                Swal.fire('Created', 'Service created successfully', 'success');
            }
            fetchData();
            handleCloseModal();
        } catch (err) {
            console.error('Error saving service:', err);
            const msg = err.response?.data?.name ? err.response.data.name[0] : 'Operation failed. Ensure the name is unique.';
            Swal.fire('Error', msg, 'error');
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Service?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                try {
                    await axiosInstance.delete(`/api/crm_new/services/${id}/`);
                } catch {
                    await axiosInstance.delete(`/api/crm/services/${id}/`);
                }
                Swal.fire('Deleted', 'Service deleted successfully', 'success');
                fetchData();
            } catch (err) {
                console.error('Error deleting service:', err);
                Swal.fire('Error', 'Failed to delete service', 'error');
            }
        }
    };

    const filteredServices = services.filter(s =>
        (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentServices = filteredServices.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredServices.length / itemsPerPage);

    return (
        <>
            <style>{`
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
                    max-height: 70vh;
                    overflow-y: auto;
                }
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
                }
                .item-custom-modal .btn-save-custom:hover {
                    background-color: #073d0b !important;
                }
                .service-header-container {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    flex-wrap: wrap !important;
                    gap: 15px !important;
                }
                .service-controls-wrapper {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    flex-wrap: wrap !important;
                }
                .service-search-bar {
                    width: 300px !important;
                    position: relative !important;
                }
                .service-table th {
                    white-space: nowrap !important;
                }
                @media (max-width: 767px) {
                    .service-header-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 12px !important;
                    }
                    .service-controls-wrapper {
                        width: 100% !important;
                        justify-content: flex-start !important;
                        gap: 8px !important;
                    }
                    .service-search-bar {
                        width: 100% !important;
                        order: 2 !important;
                        margin-top: 4px !important;
                    }
                    .service-add-btn {
                        width: auto !important;
                        flex-grow: 0 !important;
                        order: 1 !important;
                        font-size: 12px !important;
                        padding: 0 12px !important;
                        justify-content: center !important;
                    }
                    .service-table {
                        min-width: 550px !important;
                    }
                }
            `}</style>

            <div className="container-fluid">
                <div className="page-titles mb-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="btn btn-outline-primary btn-sm d-flex align-items-center"
                        style={{ gap: '6px', borderRadius: '6px' }}
                    >
                        <i className="fa fa-arrow-left"></i> Back
                    </button>
                </div>

                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center service-header-container">
                                <Card.Title className="mb-0">CRM Services</Card.Title>
                                <div className="d-flex align-items-center gap-2 service-controls-wrapper">
                                    <div className="service-search-bar">
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search services..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>
                                    <Button
                                        variant="primary"
                                        onClick={() => handleShowModal()}
                                        className="d-flex align-items-center justify-content-center service-add-btn"
                                        style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px', backgroundColor: '#0a500f', borderColor: '#0a500f', color: 'white' }}
                                    >
                                        <i className="fa fa-plus me-2"></i>
                                        ADD SERVICE
                                    </Button>
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
                                    <div className="table-responsive pb-4">
                                        <table className="table table-responsive-md service-table">
                                            <thead>
                                                <tr>
                                                    <th><strong>Sl.No</strong></th>
                                                    <th><strong>SERVICE NAME</strong></th>
                                                    <th><strong>DESCRIPTION</strong></th>
                                                    <th><strong>STATUS</strong></th>
                                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredServices.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="5" className="text-center py-4 text-muted">
                                                            No services found
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentServices.map((s, idx) => (
                                                        <tr key={s.id}>
                                                            <td>{indexOfFirstItem + idx + 1}</td>
                                                            <td><strong>{s.name}</strong></td>
                                                            <td className="text-truncate" style={{ maxWidth: '350px' }}>
                                                                {s.description || '—'}
                                                            </td>
                                                            <td>
                                                                <span className={`badge light badge-${s.is_active ? 'success' : 'danger'}`}>
                                                                    {s.is_active ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end gap-1">
                                                                    <EditButton
                                                                        onClick={() => handleShowModal(s)}
                                                                    />
                                                                    <DeleteButton
                                                                        onClick={() => handleDelete(s.id, s.name)}
                                                                    />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                        {filteredServices.length > 0 && (
                                            <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                                <div className="text-muted" style={{ fontSize: '13px' }}>
                                                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredServices.length)} of {filteredServices.length} entries
                                                </div>
                                                {totalPages > 1 && (
                                                    <nav>
                                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                            <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                                <button
                                                                    type="button"
                                                                    className="page-link"
                                                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                                    disabled={currentPage === 1}
                                                                    style={{ border: 'none', background: 'none' }}
                                                                >
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
                                                                            <button
                                                                                type="button"
                                                                                className="page-link"
                                                                                onClick={() => setCurrentPage(pageNumber)}
                                                                                style={{ border: 'none' }}
                                                                            >
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
                                                                <button
                                                                    type="button"
                                                                    className="page-link"
                                                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                                                    disabled={currentPage === totalPages}
                                                                    style={{ border: 'none', background: 'none' }}
                                                                >
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
            </div>

            {/* Service Modal */}
            <Modal
                show={showModal}
                onHide={handleCloseModal}
                dialogClassName="item-custom-modal"
                backdrop="static"
                keyboard={false}
                size="md"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-cogs text-white" style={{ fontSize: '18px' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editId ? 'Edit CRM Service' : 'Initialize New CRM Service'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage CRM service offerings
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleCloseModal}>
                        &times;
                    </button>
                </div>

                <Form onSubmit={handleSubmit}>
                    <div className="modal-body-custom">
                        <Form.Group className="mb-4">
                            <Form.Label className="form-label-custom">Service Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                required
                                type="text"
                                className="form-control-custom"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Consulting, AMC, Cloud Deployment"
                                autoFocus
                            />
                        </Form.Group>

                        <Form.Group className="mb-4">
                            <Form.Label className="form-label-custom">Description</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                className="form-control-custom"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Provide brief context for this service..."
                            />
                        </Form.Group>

                        <Form.Group className="mb-2">
                            <Form.Check
                                type="switch"
                                id="service-active-switch"
                                label="Active Status"
                                checked={formData.is_active}
                                onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                            />
                        </Form.Group>
                    </div>

                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={handleCloseModal}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom">
                            {editId ? 'Update Service' : 'Save Service'}
                        </button>
                    </div>
                </Form>
            </Modal>
        </>
    );
};

export default CrmServiceList;
