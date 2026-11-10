import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, Row, Col, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import axiosInstance from '../../../services/AxiosInstance';
import { usePageTitle } from '../../../context/TitleContext';
import { usePermission } from '../../../hooks/usePermission';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const IndustryList = () => {
    usePageTitle('Industries');
    const navigate = useNavigate();
    const { can } = usePermission();

    const [industries, setIndustries] = useState([]);
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
            const res = await axiosInstance.get('/api/crm_new/industries/');
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setIndustries(data);
        } catch (err) {
            console.error('Error fetching industries:', err);
            Swal.fire('Error', 'Failed to fetch industries', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (item = null) => {
        if (item) {
            setEditId(item.id);
            setFormData({
                name: item.name || '',
                description: item.description || '',
                is_active: item.is_active !== undefined ? item.is_active : true
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
            Swal.fire('Warning', 'Industry Name is required', 'warning');
            return;
        }

        try {
            if (editId) {
                await axiosInstance.put(`/api/crm_new/industries/${editId}/`, formData);
                Swal.fire('Updated', 'Industry updated successfully', 'success');
            } else {
                await axiosInstance.post('/api/crm_new/industries/', formData);
                Swal.fire('Created', 'Industry created successfully', 'success');
            }
            fetchData();
            handleCloseModal();
        } catch (err) {
            console.error('Error saving industry:', err);
            const msg = err.response?.data?.name ? err.response.data.name[0] : 'Operation failed. Ensure industry name is unique.';
            Swal.fire('Error', msg, 'error');
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Industry?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await axiosInstance.delete(`/api/crm_new/industries/${id}/`);
                Swal.fire('Deleted', 'Industry deleted successfully', 'success');
                fetchData();
            } catch (err) {
                console.error('Error deleting industry:', err);
                Swal.fire('Error', 'Failed to delete industry', 'error');
            }
        }
    };

    const filteredIndustries = industries.filter(ind =>
        (ind.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ind.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentIndustries = filteredIndustries.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredIndustries.length / itemsPerPage);

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
                .lead-industry-header-container {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    flex-wrap: wrap !important;
                    gap: 15px !important;
                }
                .lead-industry-controls-wrapper {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    flex-wrap: wrap !important;
                }
                .lead-industry-search-bar {
                    width: 300px !important;
                    position: relative !important;
                }
                .lead-industry-table th {
                    white-space: nowrap !important;
                }
                @media (max-width: 767px) {
                    .lead-industry-header-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 12px !important;
                    }
                    .lead-industry-controls-wrapper {
                        width: 100% !important;
                        justify-content: flex-start !important;
                        gap: 8px !important;
                    }
                    .lead-industry-search-bar {
                        width: 100% !important;
                        order: 2 !important;
                        margin-top: 4px !important;
                    }
                    .lead-industry-add-btn {
                        width: auto !important;
                        flex-grow: 0 !important;
                        order: 1 !important;
                        font-size: 12px !important;
                        padding: 0 12px !important;
                        justify-content: center !important;
                    }
                    .lead-industry-table {
                        min-width: 550px !important;
                    }
                }
            `}</style>

            <div className="container-fluid">
                <div className="page-titles mb-3">
                    <button
                        onClick={() => navigate('/crm/leads')}
                        className="btn btn-outline-primary btn-sm d-flex align-items-center"
                        style={{ gap: '6px', borderRadius: '6px' }}
                    >
                        <i className="fa fa-arrow-left"></i> Back to Leads
                    </button>
                </div>

                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center lead-industry-header-container">
                                <Card.Title className="mb-0">Industries</Card.Title>
                                <div className="d-flex align-items-center gap-2 lead-industry-controls-wrapper">
                                    <div className="lead-industry-search-bar">
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search industries..."
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
                                        className="d-flex align-items-center justify-content-center lead-industry-add-btn"
                                        style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px', backgroundColor: '#0a500f', borderColor: '#0a500f', color: 'white' }}
                                    >
                                        <i className="fa fa-plus me-2"></i>
                                        ADD INDUSTRY
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
                                        <table className="table table-responsive-md lead-industry-table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '80px' }}><strong>SL.NO</strong></th>
                                                    <th><strong>NAME</strong></th>
                                                    <th><strong>DESCRIPTION</strong></th>
                                                    <th><strong>STATUS</strong></th>
                                                    <th><strong>CREATED AT</strong></th>
                                                    <th className="text-end"><strong>ACTION</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentIndustries.length > 0 ? (
                                                    currentIndustries.map((item, index) => (
                                                        <tr key={item.id}>
                                                            <td>{indexOfFirstItem + index + 1}</td>
                                                            <td>
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <span className="fw-semibold text-dark">{item.name}</span>
                                                                </div>
                                                            </td>
                                                            <td style={{ maxWidth: '300px' }}>
                                                                <span className="text-muted text-truncate d-inline-block" style={{ maxWidth: '100%' }}>
                                                                    {item.description || '—'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {item.is_active ? (
                                                                    <span className="badge badge-success light" style={{ backgroundColor: '#d1fae5', color: '#065f46' }}>
                                                                        Active
                                                                    </span>
                                                                ) : (
                                                                    <span className="badge badge-danger light" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                                                                        Inactive
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end gap-1">
                                                                    <EditButton
                                                                        onClick={() => handleShowModal(item)}
                                                                    />
                                                                    <DeleteButton
                                                                        onClick={() => handleDelete(item.id, item.name)}
                                                                    />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="6" className="text-center py-4 text-muted">
                                                            No industries found.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                        {filteredIndustries.length > 0 && (
                                            <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                                <div className="text-muted" style={{ fontSize: '13px' }}>
                                                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredIndustries.length)} of {filteredIndustries.length} entries
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

            {/* Create/Edit Modal */}
            <Modal
                show={showModal}
                onHide={handleCloseModal}
                centered
                className="item-custom-modal"
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-industry text-white fs-5"></i>
                        </div>
                        <div>
                            <h5 className="modal-title mb-0 fw-bold" style={{ color: '#1e293b' }}>
                                {editId ? 'Edit Industry' : 'Create Industry'}
                            </h5>
                            <span className="text-muted" style={{ fontSize: '13px' }}>
                                {editId ? 'Update details of this industry' : 'Add a new industry for lead classification'}
                            </span>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleCloseModal}>
                        &times;
                    </button>
                </div>
                <Form onSubmit={handleSubmit}>
                    <div className="modal-body-custom">
                        <Row className="g-3">
                            <Col md={12}>
                                <Form.Label className="form-label-custom">
                                    Industry Name <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    placeholder="e.g. Healthcare, Manufacturing, ERP"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </Col>

                            <Col md={12}>
                                <Form.Label className="form-label-custom">Description</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={3}
                                    className="form-control-custom"
                                    placeholder="Enter brief description or scope of this industry..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </Col>

                            <Col md={12}>
                                <div className="d-flex align-items-center justify-content-between p-3 rounded" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                    <div>
                                        <div className="fw-semibold text-dark" style={{ fontSize: '13.5px' }}>Active Status</div>
                                        <small className="text-muted">Available in lead creation and filtering</small>
                                    </div>
                                    <div className="form-check form-switch mb-0">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="industryActiveSwitch"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                            style={{ cursor: 'pointer', width: '2.4em', height: '1.25em' }}
                                        />
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </div>
                    <div className="modal-footer-custom">
                        <Button
                            type="button"
                            className="btn-close-custom"
                            onClick={handleCloseModal}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="btn-save-custom"
                        >
                            {editId ? 'Save Changes' : 'Create Industry'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </>
    );
};

export default IndustryList;