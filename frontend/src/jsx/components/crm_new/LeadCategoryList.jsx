import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, Row, Col, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import axiosInstance from '../../../services/AxiosInstance';
import { usePageTitle } from '../../../context/TitleContext';
import { usePermission } from '../../../hooks/usePermission';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const LeadCategoryList = () => {
    usePageTitle('Lead Categories');
    const navigate = useNavigate();
    const { can } = usePermission();

    const [categories, setCategories] = useState([]);
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
                res = await axiosInstance.get('/api/crm_new/categories/');
            } catch (fallbackErr) {
                res = await axiosInstance.get('/api/crm/categories/');
            }
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setCategories(data);
        } catch (err) {
            console.error('Error fetching lead categories:', err);
            Swal.fire('Error', 'Failed to fetch lead categories', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (cat = null) => {
        if (cat) {
            setEditId(cat.id);
            setFormData({
                name: cat.name || '',
                description: cat.description || '',
                is_active: cat.is_active !== undefined ? cat.is_active : true
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
            Swal.fire('Warning', 'Category Name is required', 'warning');
            return;
        }

        try {
            if (editId) {
                try {
                    await axiosInstance.put(`/api/crm_new/categories/${editId}/`, formData);
                } catch {
                    await axiosInstance.put(`/api/crm/categories/${editId}/`, formData);
                }
                Swal.fire('Updated', 'Lead category updated successfully', 'success');
            } else {
                try {
                    await axiosInstance.post('/api/crm_new/categories/', formData);
                } catch {
                    await axiosInstance.post('/api/crm/categories/', formData);
                }
                Swal.fire('Created', 'Lead category created successfully', 'success');
            }
            fetchData();
            handleCloseModal();
        } catch (err) {
            console.error('Error saving lead category:', err);
            const msg = err.response?.data?.name ? err.response.data.name[0] : 'Operation failed. Ensure category name is unique.';
            Swal.fire('Error', msg, 'error');
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Lead Category?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                try {
                    await axiosInstance.delete(`/api/crm_new/categories/${id}/`);
                } catch {
                    await axiosInstance.delete(`/api/crm/categories/${id}/`);
                }
                Swal.fire('Deleted', 'Lead category deleted successfully', 'success');
                fetchData();
            } catch (err) {
                console.error('Error deleting lead category:', err);
                Swal.fire('Error', 'Failed to delete lead category', 'error');
            }
        }
    };

    const filteredCategories = categories.filter(c =>
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentCategories = filteredCategories.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);

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
                .lead-category-header-container {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    flex-wrap: wrap !important;
                    gap: 15px !important;
                }
                .lead-category-controls-wrapper {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    flex-wrap: wrap !important;
                }
                .lead-category-search-bar {
                    width: 300px !important;
                    position: relative !important;
                }
                .lead-category-table th {
                    white-space: nowrap !important;
                }
                @media (max-width: 767px) {
                    .lead-category-header-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 12px !important;
                    }
                    .lead-category-controls-wrapper {
                        width: 100% !important;
                        justify-content: flex-start !important;
                        gap: 8px !important;
                    }
                    .lead-category-search-bar {
                        width: 100% !important;
                        order: 2 !important;
                        margin-top: 4px !important;
                    }
                    .lead-category-add-btn {
                        width: auto !important;
                        flex-grow: 0 !important;
                        order: 1 !important;
                        font-size: 12px !important;
                        padding: 0 12px !important;
                        justify-content: center !important;
                    }
                    .lead-category-table {
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
                            <Card.Header className="d-flex justify-content-between align-items-center lead-category-header-container">
                                <Card.Title className="mb-0">Lead Categories</Card.Title>
                                <div className="d-flex align-items-center gap-2 lead-category-controls-wrapper">
                                    <div className="lead-category-search-bar">
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search lead categories..."
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
                                        className="d-flex align-items-center justify-content-center lead-category-add-btn"
                                        style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px', backgroundColor: '#0a500f', borderColor: '#0a500f', color: 'white' }}
                                    >
                                        <i className="fa fa-plus me-2"></i>
                                        ADD CATEGORY
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
                                        <table className="table table-responsive-md lead-category-table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '80px' }}><strong>SL.NO</strong></th>
                                                    <th><strong>CATEGORY NAME</strong></th>
                                                    <th><strong>DESCRIPTION</strong></th>
                                                    <th><strong>STATUS</strong></th>
                                                    <th><strong>CREATED AT</strong></th>
                                                    <th className="text-end" style={{ width: '120px' }}><strong>ACTION</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentCategories.length > 0 ? (
                                                    currentCategories.map((cat, index) => (
                                                        <tr key={cat.id || index}>
                                                            <td>{indexOfFirstItem + index + 1}</td>
                                                            <td>
                                                                <strong className="text-dark">{cat.name}</strong>
                                                            </td>
                                                            <td>
                                                                <span className="text-muted">{cat.description || '—'}</span>
                                                            </td>
                                                            <td>
                                                                <span className={`badge ${cat.is_active ? 'badge-success light' : 'badge-danger light'}`}>
                                                                    {cat.is_active ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <small className="text-muted">
                                                                    {cat.created_at ? new Date(cat.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                                </small>
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end gap-1">
                                                                    <EditButton
                                                                        onClick={() => handleShowModal(cat)}
                                                                    />
                                                                    <DeleteButton
                                                                        onClick={() => handleDelete(cat.id, cat.name)}
                                                                    />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="6" className="text-center py-5 text-muted">
                                                            <i className="fa fa-tags mb-3 fa-2x d-block text-secondary opacity-50"></i>
                                                            No lead categories found.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap">
                                        <small className="text-muted">
                                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredCategories.length)} of {filteredCategories.length} categories
                                        </small>
                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                            <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                <button className="page-link" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                                                    <i className="la la-angle-double-left"></i>
                                                </button>
                                            </li>
                                            <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                <button className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
                                                    <i className="la la-angle-left"></i>
                                                </button>
                                            </li>
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                                                <li key={num} className={`page-item ${currentPage === num ? 'active' : ''}`}>
                                                    <button className="page-link" onClick={() => setCurrentPage(num)}>
                                                        {num}
                                                    </button>
                                                </li>
                                            ))}
                                            <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                <button className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
                                                    <i className="la la-angle-right"></i>
                                                </button>
                                            </li>
                                            <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                <button className="page-link" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
                                                    <i className="la la-angle-double-right"></i>
                                                </button>
                                            </li>
                                        </ul>
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Custom Modal for Add/Edit Category */}
            <Modal show={showModal} onHide={handleCloseModal} centered className="item-custom-modal">
                <Form onSubmit={handleSubmit}>
                    <div className="modal-header-custom">
                        <div className="d-flex align-items-center gap-3">
                            <div className="modal-icon-circle">
                                <i className="fa fa-tags text-white fs-4"></i>
                            </div>
                            <div>
                                <h5 className="modal-title fw-bold text-dark mb-0">
                                    {editId ? 'Edit Lead Category' : 'Add New Category'}
                                </h5>
                                <p className="text-muted small mb-0">Define lead categorization segment</p>
                            </div>
                        </div>
                        <button type="button" className="modal-close-x" onClick={handleCloseModal}>
                            &times;
                        </button>
                    </div>

                    <div className="modal-body-custom">
                        <Row>
                            <Col md={12} className="mb-3">
                                <label className="form-label-custom">
                                    Category Name <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="form-control-custom"
                                    placeholder="e.g. Inbound Marketing, Vendor, Partner"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    autoFocus
                                />
                            </Col>
                            <Col md={12} className="mb-3">
                                <label className="form-label-custom">Description</label>
                                <textarea
                                    className="form-control-custom"
                                    rows="3"
                                    placeholder="Brief details or scope of this category..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </Col>
                            <Col md={12}>
                                <div className="d-flex align-items-center justify-content-between p-3 rounded" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                    <div>
                                        <div className="fw-semibold text-dark" style={{ fontSize: '13px' }}>Active Status</div>
                                        <div className="text-muted" style={{ fontSize: '12px' }}>Enable this category for lead allocation</div>
                                    </div>
                                    <div className="form-check form-switch mb-0">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="catActiveSwitch"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                            style={{ cursor: 'pointer', width: '2.5em', height: '1.25em' }}
                                        />
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </div>

                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={handleCloseModal}>
                            Close
                        </button>
                        <button type="submit" className="btn-save-custom">
                            {editId ? 'Update Category' : 'Save Category'}
                        </button>
                    </div>
                </Form>
            </Modal>
        </>
    );
};

export default LeadCategoryList;
