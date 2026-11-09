import React, { useState, useEffect } from 'react';
import { Form, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
    getTaskCategories,
    getTaskSubCategories,
    createTaskSubCategory,
    updateTaskSubCategory,
    deleteTaskSubCategory
} from '../../../services/TaskService';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';
import { usePermission } from '../../../hooks/usePermission';
import TaskSubCategoryForm from './TaskSubCategoryForm';

const TaskSubCategoryList = () => {
    const navigate = useNavigate();
    const { can } = usePermission();

    const [subcategories, setSubcategories] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({
        category: '',
        subcategory_name: '',
        description: '',
        is_active: true
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [subcatData, catData] = await Promise.all([
                getTaskSubCategories(),
                getTaskCategories()
            ]);
            setSubcategories(subcatData.results || subcatData);
            setCategories(catData.results || catData);
        } catch (err) {
            console.error("Error fetching task sub-categories", err.response?.status, err.response?.data || err.message);
            Swal.fire('Error', 'Failed to fetch task sub-categories', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (sub = null) => {
        if (sub) {
            setEditId(sub.id);
            setFormData({
                category: sub.category || '',
                subcategory_name: sub.subcategory_name || '',
                description: sub.description || '',
                is_active: sub.is_active
            });
        } else {
            setEditId(null);
            setFormData({ category: '', subcategory_name: '', description: '', is_active: true });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editId) {
                await updateTaskSubCategory(editId, formData);
                Swal.fire('Updated', 'Task sub-category updated successfully', 'success');
            } else {
                await createTaskSubCategory(formData);
                Swal.fire('Created', 'Task sub-category created successfully', 'success');
            }
            fetchData();
            handleCloseModal();
        } catch (err) {
            console.error("Error saving task sub-category", err);
            const apiError = err.response?.data?.subcategory_name?.[0]
                || err.response?.data?.category?.[0]
                || err.response?.data?.detail
                || 'Operation failed. Ensure the name is unique within the selected category.';
            Swal.fire('Error', apiError, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete sub-category?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteTaskSubCategory(id);
                Swal.fire('Deleted', 'Task sub-category deleted successfully', 'success');
                fetchData();
            } catch (error) {
                console.error("Error deleting task sub-category", error.response?.data || error.message || error);
                const apiError = error.response?.data?.error || 'Failed to delete task sub-category';
                Swal.fire('Error', apiError, 'error');
            }
        }
    };

    const filteredSubcategories = subcategories.filter(s =>
        (s.subcategory_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.category_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentSubcategories = filteredSubcategories.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredSubcategories.length / itemsPerPage);

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
                .task-subcategory-matrix-header-container {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    flex-wrap: wrap !important;
                    gap: 15px !important;
                }
                .task-subcategory-matrix-controls-wrapper {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    flex-wrap: wrap !important;
                }
                .task-subcategory-matrix-search-bar {
                    width: 300px !important;
                    position: relative !important;
                }
                .task-subcategory-matrix-table th {
                    white-space: nowrap !important;
                }
                @media (max-width: 767px) {
                    .task-subcategory-matrix-header-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 12px !important;
                    }
                    .task-subcategory-matrix-controls-wrapper {
                        width: 100% !important;
                        justify-content: flex-start !important;
                        gap: 8px !important;
                    }
                    .task-subcategory-matrix-search-bar {
                        width: 100% !important;
                        order: 2 !important;
                        margin-top: 4px !important;
                    }
                    .task-subcategory-matrix-add-btn {
                        width: auto !important;
                        flex-grow: 0 !important;
                        order: 1 !important;
                        font-size: 12px !important;
                        padding: 0 12px !important;
                        justify-content: center !important;
                    }
                    .task-subcategory-matrix-table {
                        min-width: 450px !important;
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
                    .task-subcategory-matrix-controls-wrapper {
                        gap: 6px !important;
                    }
                    .task-subcategory-matrix-add-btn {
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
                    .task-subcategory-matrix-search-bar {
                        width: 200px !important;
                    }
                }
            `}</style>

            <div className="container-fluid">
                <div className="page-titles">
                    <button
                        onClick={() => navigate('/task')}
                        className="btn btn-outline-primary btn-sm d-flex align-items-center"
                        style={{ gap: '6px', borderRadius: '6px' }}
                    >
                        <i className="fa fa-arrow-left"></i> Back
                    </button>
                </div>

                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center task-subcategory-matrix-header-container">
                                <Card.Title className="mb-0">Task Sub-Category Matrix</Card.Title>
                                <div className="d-flex align-items-center gap-2 task-subcategory-matrix-controls-wrapper">
                                    <div className="task-subcategory-matrix-search-bar">
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search sub-categories..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>
                                    <CreateButton
                                        module="subcategories"
                                        onClick={() => handleShowModal()}
                                        className="task-subcategory-matrix-add-btn"
                                        style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px' }}
                                    >
                                        Sub-Category
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
                                    <div className="table-responsive pb-4">
                                        <table className="table table-responsive-md task-subcategory-matrix-table">
                                            <thead>
                                                <tr>
                                                    <th><strong>Sl.No</strong></th>
                                                    <th><strong>CATEGORY</strong></th>
                                                    <th><strong>SUB-CATEGORY NAME</strong></th>
                                                    
                                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredSubcategories.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="4" className="text-center py-4 text-muted">
                                                            No entries
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentSubcategories.map((s, idx) => (
                                                        <tr key={s.id}>
                                                            <td>{indexOfFirstItem + idx + 1}</td>
                                                            <td>{s.category_name || '-'}</td>
                                                            <td><strong>{s.subcategory_name}</strong></td>
                                                            
                                                            <td className="text-end">
                                                                {can('subcategories', 'edit') || can('subcategories', 'delete') ? (
                                                                    <div className="d-flex justify-content-end">
                                                                        <EditButton
                                                                            module="subcategories"
                                                                            onClick={() => handleShowModal(s)}
                                                                            className="me-1"
                                                                        />
                                                                        <DeleteButton
                                                                            module="subcategories"
                                                                            onClick={() => handleDelete(s.id, s.subcategory_name)}
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
                                        {filteredSubcategories.length > 0 && (
                                            <div className="d-flex justify-content-between align-items-center mt-3">
                                                <div className="dataTables_info">
                                                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredSubcategories.length)} of {filteredSubcategories.length} entries
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

            <TaskSubCategoryForm
                show={showModal}
                onHide={handleCloseModal}
                editId={editId}
                formData={formData}
                setFormData={setFormData}
                categories={categories.filter(c => c.is_active)}
                onSubmit={handleSubmit}
                saving={saving}
            />
        </>
    );
};

export default TaskSubCategoryList;