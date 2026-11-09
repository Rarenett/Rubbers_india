import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, Row, Col, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
} from '../../../services/CategoryService';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

import { usePermission } from '../../../hooks/usePermission';

const CategoryMatrix = () => {
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({ 
        category_code: '', 
        category_name: '', 
        narration: '', 
        is_active: true 
    });
    const { can } = usePermission();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getCategories();
            setCategories(data.results || data);
        } catch (err) {
            console.error("Error fetching categories", err);
            Swal.fire('Error', 'Failed to fetch categories', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (cat = null) => {
        if (cat) {
            setEditId(cat.id);
            setFormData({
                category_code: cat.category_code || '',
                category_name: cat.category_name || '',
                narration: cat.narration || '',
                is_active: cat.is_active
            });
        } else {
            setEditId(null);
            
            // Auto-generate category code
            let nextNum = 1;
            if (categories && categories.length > 0) {
                const nums = categories.map(c => {
                    const match = (c.category_code || '').match(/CAT-(\d+)/i);
                    return match ? parseInt(match[1], 10) : 0;
                });
                const maxNum = Math.max(0, ...nums);
                nextNum = maxNum + 1;
            }
            const nextCode = `CAT-${String(nextNum).padStart(3, '0')}`;
            
            setFormData({ category_code: nextCode, category_name: '', narration: '', is_active: true });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editId) {
                await updateCategory(editId, formData);
                Swal.fire('Updated', 'Category updated successfully', 'success');
            } else {
                await createCategory(formData);
                Swal.fire('Created', 'Category initialized successfully', 'success');
            }
            fetchData();
            handleCloseModal();
        } catch (err) {
            console.error("Error saving category", err);
            Swal.fire('Error', 'Operation failed. Ensure code and name are unique.', 'error');
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete category?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteCategory(id);
                Swal.fire('Deleted', 'Category deleted successfully', 'success');
                fetchData();
            } catch (error) {
                Swal.fire('Error', 'Failed to delete category', 'error');
            }
        }
    };

    const filteredCategories = categories.filter(c => 
        (c.category_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.category_code || '').toLowerCase().includes(searchTerm.toLowerCase())
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
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
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
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .item-custom-modal .form-check-input:checked {
                    background-color: #2ece8a;
                    border-color: #2ece8a;
                }
                .item-custom-modal .btn-close-custom {
                    background-color: #7A70BA !important;
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
                    background-color: #6357a7 !important;
                }
                .item-custom-modal .btn-save-custom {
                    background-color: #2ece8a !important;
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
                    background-color: #26b277 !important;
                }
                .category-matrix-header-container {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    flex-wrap: wrap !important;
                    gap: 15px !important;
                }
                .category-matrix-controls-wrapper {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    flex-wrap: wrap !important;
                }
                .category-matrix-search-bar {
                    width: 300px !important;
                    position: relative !important;
                }
                .category-matrix-table th {
                    white-space: nowrap !important;
                }
                @media (max-width: 767px) {
                    .category-matrix-header-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 12px !important;
                    }
                    .category-matrix-controls-wrapper {
                        width: 100% !important;
                        justify-content: flex-start !important;
                        gap: 8px !important;
                    }
                    .category-matrix-search-bar {
                        width: 100% !important;
                        order: 2 !important;
                        margin-top: 4px !important;
                    }
                    .category-matrix-add-btn {
                        width: auto !important;
                        flex-grow: 0 !important;
                        order: 1 !important;
                        font-size: 12px !important;
                        padding: 0 12px !important;
                        justify-content: center !important;
                    }
                    .category-matrix-table {
                        min-width: 550px !important;
                    }
                    .item-custom-modal .modal-header-custom {
                        padding: 16px 18px 12px 18px !important;
                    }
                    .item-custom-modal .modal-body-custom {
                        padding: 16px 18px !important;
                    }
                    .item-custom-modal .modal-footer-custom {
                        padding: 14px 18px !important;
                    }
                }
                @media (max-width: 400px) {
                    .category-matrix-controls-wrapper {
                        gap: 6px !important;
                    }
                    .category-matrix-add-btn {
                        height: 34px !important;
                        font-size: 11.5px !important;
                        padding: 0 10px !important;
                    }
                    .item-custom-modal .modal-icon-circle {
                        width: 40px !important;
                        height: 40px !important;
                    }
                    .item-custom-modal .btn-close-custom,
                    .item-custom-modal .btn-save-custom {
                        padding: 8px 16px !important;
                        font-size: 13px !important;
                    }
                }
                @media (min-width: 768px) and (max-width: 850px) {
                    .category-matrix-search-bar {
                        width: 200px !important;
                    }
                }
                @media (min-width: 540px) and (max-width: 540px) {
                    .category-matrix-header-container {
                        flex-direction: row !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        gap: 8px !important;
                    }
                    .category-matrix-controls-wrapper {
                        width: auto !important;
                        flex-direction: row !important;
                        align-items: center !important;
                        gap: 6px !important;
                    }
                    .category-matrix-search-bar {
                        width: 170px !important;
                        order: unset !important;
                        margin-top: 0 !important;
                    }
                    .category-matrix-add-btn {
                        width: auto !important;
                        height: 34px !important;
                        order: unset !important;
                        font-size: 11px !important;
                        padding: 0 10px !important;
                    }
                }
                @media (min-width: 344px) and (max-width: 344px) {
                    .category-matrix-header-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 8px !important;
                    }
                    .category-matrix-controls-wrapper {
                        width: 100% !important;
                        gap: 4px !important;
                    }
                    .category-matrix-search-bar {
                        width: 100% !important;
                    }
                    .category-matrix-add-btn {
                        height: 30px !important;
                        font-size: 10.5px !important;
                        padding: 0 8px !important;
                    }
                }
            `}</style>
            <div className="container-fluid">
                <div className="page-titles">
                    <button 
                        onClick={() => navigate('/complaints')} 
                        className="btn btn-outline-primary btn-sm d-flex align-items-center"
                        style={{ gap: '6px', borderRadius: '6px' }}
                    >
                        <i className="fa fa-arrow-left"></i> Back
                    </button>
                </div>

                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center category-matrix-header-container">
                                <Card.Title className="mb-0">Category Matrix</Card.Title>
                                <div className="d-flex align-items-center gap-2 category-matrix-controls-wrapper">
                                    <div className="category-matrix-search-bar">
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search matrix..."
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
                                        className="d-flex align-items-center justify-content-center category-matrix-add-btn"
                                        style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px', backgroundColor: 'rgb(61, 53, 119)', borderColor: 'rgb(61, 53, 119)', color: 'white' }}
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
                                        <table className="table table-responsive-md category-matrix-table">
                                            <thead>
                                                <tr>
                                                    <th><strong>Sl.No</strong></th>
                                                    <th><strong>CODE</strong></th>
                                                    <th><strong>NAME</strong></th>
                                                    <th><strong>NARRATION</strong></th>
                                                    <th><strong>STATUS</strong></th>
                                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredCategories.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="6" className="text-center py-4 text-muted">
                                                            No entries
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentCategories.map((c, idx) => (
                                                        <tr key={c.id}>
                                                            <td>{indexOfFirstItem + idx + 1}</td>
                                                            <td><strong>{c.category_code}</strong></td>
                                                            <td>{c.category_name}</td>
                                                            <td className="text-truncate" style={{ maxWidth: '300px' }}>{c.narration || '—'}</td>
                                                            <td>
                                                                <span className={`badge light badge-${c.is_active ? 'success' : 'danger'}`}>
                                                                    {c.is_active ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </td>
                                                            <td className="text-end">
                                                                {can('complaints', 'edit') || can('complaints', 'delete') ? (
                                                                    <div className="d-flex justify-content-end">
                                                                        <EditButton
                                                                            module="feedback_categories"
                                                                            onClick={() => handleShowModal(c)}
                                                                            className="me-1"
                                                                        />
                                                                        <DeleteButton
                                                                            module="feedback_categories"
                                                                            onClick={() => handleDelete(c.id, c.category_name)}
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
                                        {filteredCategories.length > 0 && (
                                            <div className="d-flex justify-content-between align-items-center mt-3">
                                                <div className="dataTables_info">
                                                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredCategories.length)} of {filteredCategories.length} entries
                                                </div>
                                                {totalPages > 1 && (
                                                    <nav>
                                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                        <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-left" />
                                                            </button>
                                                        </li>
                                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNumber => {
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
            </div>

            {/* Category Modal */}
            <Modal 
                show={showModal} 
                onHide={handleCloseModal}
                dialogClassName="item-custom-modal"
                backdrop="static"
                keyboard={false}
                size="lg"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 10H9v-2h6v2zm3-4H6V8h12v2z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editId ? 'Edit Category Matrix' : 'Initialize New Category'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage category
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleCloseModal}>
                        &times;
                    </button>
                </div>

                <Form onSubmit={handleSubmit}>
                    <div className="modal-body-custom">
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-4">
                                    <Form.Label className="form-label-custom">Category Code <span className="text-danger">*</span></Form.Label>
                                    <Form.Control 
                                        required 
                                        type="text" 
                                        className="form-control-custom"
                                        value={formData.category_code} 
                                        onChange={e => setFormData({...formData, category_code: e.target.value})} 
                                        placeholder="e.g. CAT-001" 
                                        readOnly
                                        style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-4">
                                    <Form.Label className="form-label-custom">Category Name <span className="text-danger">*</span></Form.Label>
                                    <Form.Control 
                                        required 
                                        type="text" 
                                        className="form-control-custom"
                                        value={formData.category_name} 
                                        onChange={e => setFormData({...formData, category_name: e.target.value})} 
                                        placeholder="e.g. Technical Issues" 
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Form.Group className="mb-4">
                            <Form.Label className="form-label-custom">Narration / Description</Form.Label>
                            <Form.Control 
                                as="textarea" 
                                rows={3} 
                                className="form-control-custom"
                                value={formData.narration} 
                                onChange={e => setFormData({...formData, narration: e.target.value})} 
                                placeholder="Provide brief context for this category..." 
                            />
                        </Form.Group>

                        <div className="d-flex align-items-center mt-3 mb-2">
                            <Form.Check 
                                type="switch"
                                id="status-switch"
                                label={<span style={{ fontWeight: 600, color: formData.is_active ? '#10b981' : '#64748b', marginLeft: '8px' }}>Status: {formData.is_active ? 'Active' : 'Inactive'}</span>}
                                checked={formData.is_active}
                                onChange={e => setFormData({...formData, is_active: e.target.checked})}
                                style={{ transform: 'scale(1.05)' }}
                            />
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={handleCloseModal}>
                            Close
                        </Button>
                        <Button type="submit" className="btn-save-custom">
                            {editId ? 'Update' : 'Save'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </>
    );
};

export default CategoryMatrix;