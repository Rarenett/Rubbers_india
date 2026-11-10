import React, { useState, useEffect } from 'react';
import { Form, Card, OverlayTrigger, Popover, ProgressBar } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
    getSubtasks,
    createSubtask,
    updateSubtask,
    deleteSubtask,
    deleteSubtaskAttachment
} from '../../../services/TaskService';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';
import { usePermission } from '../../../hooks/usePermission';
import SubtaskForm from './SubtaskForm';

const EMPTY_FORM = {
    subtask_name: '',
    description: '',
    task_type: 'individual',
    start_date: '',
    end_date: '',
    newAttachments: [],
    existingAttachments: []
};

const SubtaskListPage = () => {
    const navigate = useNavigate();
    const { can } = usePermission();

    const [subtasks, setSubtasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getSubtasks();
            setSubtasks(data.results || data);
        } catch (err) {
            console.error("Error fetching subtasks", err.response?.status, err.response?.data || err.message);
            Swal.fire('Error', 'Failed to fetch subtasks', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (subtask = null) => {
        if (subtask) {
            setEditId(subtask.id);
            setFormData({
                subtask_name: subtask.subtask_name || '',
                description: subtask.description || '',
                task_type: subtask.task_type || 'individual',
                start_date: subtask.start_date || '',
                end_date: subtask.end_date || '',
                newAttachments: [],
                existingAttachments: subtask.attachments || []
            });
        } else {
            setEditId(null);
            setFormData(EMPTY_FORM);
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditId(null);
    };

    // Building FormData (not a plain object) is what lets the browser send
    // the uploaded files alongside the regular fields in one multipart
    // request. axios auto-detects FormData and sets the right headers.
    const buildFormPayload = () => {
        const payload = new FormData();
        payload.append('subtask_name', formData.subtask_name || '');
        payload.append('description', formData.description || '');
        payload.append('task_type', formData.task_type || 'individual');
        if (formData.start_date) {
            payload.append('start_date', formData.start_date);
        } else if (editId) {
            payload.append('start_date', '');
        }
        if (formData.end_date) {
            payload.append('end_date', formData.end_date);
        } else if (editId) {
            payload.append('end_date', '');
        }
        (formData.newAttachments || []).forEach((file) => {
            payload.append('attachments', file);
        });
        return payload;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = buildFormPayload();
            if (editId) {
                await updateSubtask(editId, payload);
                Swal.fire('Updated', 'Subtask updated successfully', 'success');
            } else {
                await createSubtask(payload);
                Swal.fire('Created', 'Subtask created successfully', 'success');
            }
            fetchData();
            handleCloseModal();
        } catch (err) {
            console.error("Error saving subtask", err.response?.data || err.message);
            const apiError = err.response?.data?.subtask_name?.[0]
                || err.response?.data?.detail
                || 'Operation failed. Please check the form and try again.';
            Swal.fire('Error', apiError, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteExistingAttachment = async (attachmentId) => {
        try {
            await deleteSubtaskAttachment(attachmentId);
            setFormData(prev => ({
                ...prev,
                existingAttachments: (prev.existingAttachments || []).filter(a => a.id !== attachmentId)
            }));
        } catch (err) {
            console.error("Error deleting attachment", err.response?.data || err.message);
            Swal.fire('Error', 'Failed to remove attachment', 'error');
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete subtask?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteSubtask(id);
                Swal.fire('Deleted', 'Subtask deleted successfully', 'success');
                fetchData();
            } catch (error) {
                console.error("Error deleting subtask", error.response?.data || error.message);
                const apiError = error.response?.data?.error || 'Failed to delete subtask';
                Swal.fire('Error', apiError, 'error');
            }
        }
    };

    const filteredSubtasks = subtasks.filter(t =>
        (t.subtask_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentSubtasks = filteredSubtasks.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredSubtasks.length / itemsPerPage);

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
                .item-custom-modal .form-check-input:checked {
                    background-color: #0a500f;
                    border-color: #0a500f;
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
                .task-matrix-header-container {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    flex-wrap: wrap !important;
                    gap: 15px !important;
                }
                .task-matrix-controls-wrapper {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    flex-wrap: wrap !important;
                }
                .task-matrix-search-bar {
                    width: 300px !important;
                    position: relative !important;
                }
                .task-matrix-table th {
                    white-space: nowrap !important;
                }
                @media (max-width: 767px) {
                    .task-matrix-header-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 12px !important;
                    }
                    .task-matrix-controls-wrapper {
                        width: 100% !important;
                        justify-content: flex-start !important;
                        gap: 8px !important;
                    }
                    .task-matrix-search-bar {
                        width: 100% !important;
                        order: 2 !important;
                        margin-top: 4px !important;
                    }
                    .task-matrix-add-btn {
                        width: auto !important;
                        flex-grow: 0 !important;
                        order: 1 !important;
                        font-size: 12px !important;
                        padding: 0 12px !important;
                        justify-content: center !important;
                    }
                    .task-matrix-table {
                        min-width: 420px !important;
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
                    .task-matrix-controls-wrapper {
                        gap: 6px !important;
                    }
                    .task-matrix-add-btn {
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
                    .task-matrix-search-bar {
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
                            <Card.Header className="d-flex justify-content-between align-items-center task-matrix-header-container">
                                <Card.Title className="mb-0">Subtask Matrix</Card.Title>
                                <div className="d-flex align-items-center gap-2 task-matrix-controls-wrapper">
                                    <div className="task-matrix-search-bar">
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search subtasks..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>
                                    <CreateButton
                                        module="subtasks"
                                        onClick={() => handleShowModal()}
                                        className="task-matrix-add-btn"
                                        style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px' }}
                                        >
                                        SubTask
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
                                        <table className="table table-responsive-md task-matrix-table">
                                            <thead>
                                                 <tr>
                                                    <th><strong>Sl.No</strong></th>
                                                    <th><strong>SUBTASK NAME</strong></th>
                                                    <th><strong>TYPE</strong></th>
                                                    <th><strong>START DATE</strong></th>
                                                    <th><strong>END DATE</strong></th>
                                                    <th><strong>PROGRESS</strong></th>
                                                    <th><strong>ATTACHMENTS</strong></th>
                                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredSubtasks.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="8" className="text-center py-4 text-muted">
                                                            No entries
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentSubtasks.map((t, idx) => (
                                                        <tr key={t.id}>
                                                            <td>{indexOfFirstItem + idx + 1}</td>
                                                            <td><strong>{t.subtask_name}</strong></td>
                                                            <td>
                                                                <span className={`badge light badge-${t.task_type === 'group' ? 'info' : 'primary'}`}>
                                                                    {t.task_type_display || (t.task_type === 'group' ? 'Group' : 'Individual')}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {t.start_date ? new Date(t.start_date).toLocaleDateString() : <span className="text-muted">—</span>}
                                                            </td>
                                                            <td>
                                                                {t.end_date ? new Date(t.end_date).toLocaleDateString() : <span className="text-muted">—</span>}
                                                            </td>
                                                            <td>
                                                                <div style={{ minWidth: '100px' }}>
                                                                    <div className="d-flex justify-content-between mb-1" style={{ fontSize: '11px', fontWeight: 600 }}>
                                                                        <span>{Number(t.completed_percentage || 0).toFixed(0)}%</span>
                                                                    </div>
                                                                    <ProgressBar
                                                                        now={Number(t.completed_percentage || 0)}
                                                                        variant={Number(t.completed_percentage || 0) >= 100 ? 'success' : 'primary'}
                                                                        style={{ height: '6px' }}
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td>
                                                                {t.attachments && t.attachments.length > 0 ? (
                                                                    <OverlayTrigger
                                                                        trigger={['click', 'focus']}
                                                                        placement="bottom"
                                                                        rootClose
                                                                        overlay={
                                                                            <Popover id={`subtask-attachments-popover-${t.id}`}>
                                                                                <Popover.Header as="h3">Attachments</Popover.Header>
                                                                                <Popover.Body style={{ maxHeight: '220px', overflowY: 'auto', minWidth: '220px' }}>
                                                                                    <ul className="list-unstyled mb-0">
                                                                                        {t.attachments.map((att) => (
                                                                                            <li key={att.id} className="py-1">
                                                                                                <a
                                                                                                    href={att.file}
                                                                                                    target="_blank"
                                                                                                    rel="noopener noreferrer"
                                                                                                    style={{ fontSize: '13px', wordBreak: 'break-all' }}
                                                                                                >
                                                                                                    {att.original_filename || 'Attachment'}
                                                                                                </a>
                                                                                            </li>
                                                                                        ))}
                                                                                    </ul>
                                                                                </Popover.Body>
                                                                            </Popover>
                                                                        }
                                                                    >
                                                                        <span className="badge light badge-secondary" role="button" style={{ cursor: 'pointer' }}>
                                                                            {t.attachments.length} file{t.attachments.length > 1 ? 's' : ''}
                                                                        </span>
                                                                    </OverlayTrigger>
                                                                ) : (
                                                                    <span className="text-muted">—</span>
                                                                )}
                                                            </td>
                                                            <td className="text-end">
                                                                {can('subtasks', 'edit') || can('subtasks', 'delete') ? (
                                                                    <div className="d-flex justify-content-end">
                                                                        <EditButton
                                                                            module="subtasks"
                                                                            onClick={() => handleShowModal(t)}
                                                                            className="me-1"
                                                                        />
                                                                        <DeleteButton
                                                                            module="subtasks"
                                                                            onClick={() => handleDelete(t.id, t.subtask_name)}
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
                                        {filteredSubtasks.length > 0 && (
                                            <div className="d-flex justify-content-between align-items-center mt-3">
                                                <div className="dataTables_info">
                                                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredSubtasks.length)} of {filteredSubtasks.length} entries
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

            <SubtaskForm
                show={showModal}
                onHide={handleCloseModal}
                editId={editId}
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleSubmit}
                saving={saving}
                onDeleteExistingAttachment={handleDeleteExistingAttachment}
            />
        </>
    );
};

export default SubtaskListPage;