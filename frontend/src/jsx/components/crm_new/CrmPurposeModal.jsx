import React, { useState, useEffect } from 'react';
import { Modal, Form, Table, Spinner } from 'react-bootstrap';
import Swal from 'sweetalert2';
import axiosInstance from '../../../services/AxiosInstance';

const CrmPurposeModal = ({ show, onHide }) => {
    const [purposes, setPurposes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editId, setEditId] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });

    useEffect(() => {
        if (show) {
            fetchPurposes();
            resetForm();
        }
    }, [show]);

    const fetchPurposes = async () => {
        setLoading(true);
        try {
            let res;
            try {
                res = await axiosInstance.get('/api/crm_new/purposes/');
            } catch {
                res = await axiosInstance.get('/api/crm/purposes/');
            }
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setPurposes(data);
        } catch (err) {
            console.error('Error fetching purposes:', err);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setEditId(null);
        setFormData({
            name: '',
            description: ''
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmedName = (formData.name || '').trim();
        if (!trimmedName) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please enter a Purpose Name.',
                confirmButtonColor: '#0a500f'
            });
            return;
        }

        // Prevent duplicate purpose names
        const duplicate = purposes.find(
            p => p.name.toLowerCase() === trimmedName.toLowerCase() && p.id !== editId
        );
        if (duplicate) {
            Swal.fire({
                icon: 'warning',
                title: 'Duplicate Purpose',
                text: `Purpose "${trimmedName}" already exists. Please choose a different purpose or edit the existing one.`,
                confirmButtonColor: '#0a500f'
            });
            return;
        }

        setSaving(true);
        const payload = {
            name: trimmedName,
            description: (formData.description || '').trim()
        };

        try {
            if (editId) {
                try {
                    await axiosInstance.put(`/api/crm_new/purposes/${editId}/`, payload);
                } catch {
                    await axiosInstance.put(`/api/crm/purposes/${editId}/`, payload);
                }
                Swal.fire({
                    icon: 'success',
                    title: 'Updated',
                    text: 'Purpose updated successfully.',
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                try {
                    await axiosInstance.post('/api/crm_new/purposes/', payload);
                } catch {
                    await axiosInstance.post('/api/crm/purposes/', payload);
                }
                Swal.fire({
                    icon: 'success',
                    title: 'Created',
                    text: 'Purpose saved successfully.',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
            resetForm();
            fetchPurposes();
        } catch (err) {
            console.error('Error saving purpose:', err);
            const errMsg = err.response?.data?.name
                ? err.response.data.name[0]
                : (err.response?.data?.detail || 'Failed to save purpose. Duplicate names are not allowed.');
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errMsg,
                confirmButtonColor: '#0a500f'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (item) => {
        setEditId(item.id);
        setFormData({
            name: item.name || '',
            description: item.description || ''
        });
    };

    const handleDelete = async (itemOrId, nameArg) => {
        const isObj = typeof itemOrId === 'object' && itemOrId !== null;
        const id = isObj ? itemOrId.id : itemOrId;
        const name = isObj ? itemOrId.name : (nameArg || 'this purpose');
        const count = isObj ? (itemOrId.usage_count || itemOrId.followup_count || 0) : 0;

        if (count > 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Cannot Delete Purpose',
                html: `The Purpose <b>"${name}"</b> is already associated with <b>${count}</b> CRM follow-up ${count === 1 ? 'record' : 'records'}.<br/><br/><span class="text-muted small">Purposes associated with existing follow-ups cannot be deleted to preserve activity and audit history. Please deactivate it instead if no longer needed.</span>`,
                confirmButtonColor: '#0a500f',
                confirmButtonText: 'Understood'
            });
            return;
        }

        const result = await Swal.fire({
            title: 'Delete Purpose?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, delete',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            try {
                try {
                    await axiosInstance.delete(`/api/crm_new/purposes/${id}/`);
                } catch {
                    await axiosInstance.delete(`/api/crm/purposes/${id}/`);
                }
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted',
                    text: 'Purpose deleted successfully.',
                    timer: 1500,
                    showConfirmButton: false
                });
                if (editId === id) resetForm();
                fetchPurposes();
            } catch (err) {
                console.error('Error deleting purpose:', err);
                const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to delete purpose.';
                Swal.fire({
                    icon: 'warning',
                    title: 'Cannot Delete',
                    text: msg,
                    confirmButtonColor: '#0a500f'
                });
            }
        }
    };

    return (
        <Modal
            show={show}
            onHide={onHide}
            centered
            dialogClassName="purpose-custom-modal"
            backdrop="static"
            keyboard={true}
        >
            <style>{`
                .purpose-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15) !important;
                    overflow: hidden;
                    max-width: 620px;
                    margin: auto;
                }
                .purpose-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 18px 24px;
                    border-bottom: 1px solid #f1f5f9;
                    background: #ffffff;
                }
                .purpose-custom-modal .modal-icon-circle {
                    width: 42px;
                    height: 42px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.25);
                }
                .purpose-custom-modal .modal-close-x {
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    color: #94a3b8;
                    cursor: pointer;
                    transition: color 0.2s;
                    line-height: 1;
                    padding: 4px;
                }
                .purpose-custom-modal .modal-close-x:hover {
                    color: #1e293b;
                }
                .purpose-custom-modal .modal-body-custom {
                    padding: 22px 24px;
                    background: #ffffff;
                }
                .purpose-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 600;
                    color: #475569;
                    margin-bottom: 6px;
                }
                .purpose-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    padding: 9px 14px;
                    font-size: 13.5px;
                    color: #1e293b;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .purpose-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .purpose-custom-modal .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    color: #fff !important;
                    border-radius: 8px !important;
                    font-weight: 600 !important;
                    font-size: 13px !important;
                    padding: 8px 18px !important;
                    border: none !important;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    transition: background-color 0.2s;
                }
                .purpose-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                .purpose-custom-modal .btn-cancel-custom {
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
                .purpose-custom-modal .btn-cancel-custom:hover, .btn-cancel-custom:active, .btn-cancel-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .purpose-custom-modal .purpose-table-wrapper {
                    max-height: 240px;
                    overflow-y: auto;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    background: #ffffff;
                }
                .purpose-custom-modal .purpose-table {
                    margin-bottom: 0;
                    font-size: 12.5px;
                }
                .purpose-custom-modal .purpose-table th {
                    background: #f8fafc;
                    color: #475569;
                    font-weight: 600;
                    padding: 8px 12px;
                    border-bottom: 1px solid #e2e8f0;
                    position: sticky;
                    top: 0;
                    z-index: 2;
                }
                .purpose-custom-modal .purpose-table td {
                    padding: 8px 12px;
                    vertical-align: middle;
                    border-bottom: 1px solid #f1f5f9;
                }
                .purpose-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 14px 24px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 10px;
                }
            `}</style>

            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <i className="fa fa-flag text-white" style={{ fontSize: '1.1rem' }}></i>
                    </div>
                    <div>
                        <h5 className="modal-title font-w600 mb-0" style={{ fontSize: '17px', color: '#1e293b' }}>
                            Purpose Master
                        </h5>
                        <small className="text-muted" style={{ fontSize: '11.5px' }}>
                            CRM &bull; Master &bull; Purpose
                        </small>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide} aria-label="Close">
                    &times;
                </button>
            </div>

            <div className="modal-body-custom">
                {/* Form Section */}
                <Form onSubmit={handleSubmit} className="mb-3 p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div className="row g-2 align-items-end">
                        <div className="col-md-5">
                            <label className="form-label-custom">
                                Name <span className="text-danger">*</span>
                            </label>
                            <input
                                type="text"
                                className="form-control-custom"
                                placeholder="Enter purpose name..."
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="col-md-7">
                            <label className="form-label-custom">Description</label>
                            <input
                                type="text"
                                className="form-control-custom"
                                placeholder="Enter description..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                        <div className="col-12 d-flex justify-content-end gap-2 mt-2 pt-1">
                            {editId && (
                                <button
                                    type="button"
                                    className="btn-cancel-custom"
                                    onClick={resetForm}
                                    disabled={saving}
                                >
                                    Cancel Edit
                                </button>
                            )}
                            <button
                                type="submit"
                                className="btn-save-custom"
                                disabled={saving}
                            >
                                {saving ? (
                                    <>
                                        <Spinner animation="border" size="sm" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa fa-check"></i>
                                        <span>{editId ? 'Update' : 'Save'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </Form>

                {/* Table of Saved Records */}
                <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                        Saved Purposes
                    </span>
                    <span className="badge rounded-pill bg-light text-muted border" style={{ fontSize: '11px', padding: '3px 8px' }}>
                        {purposes.length} record{purposes.length === 1 ? '' : 's'}
                    </span>
                </div>

                <div className="purpose-table-wrapper">
                    {loading ? (
                        <div className="text-center py-4">
                            <Spinner animation="border" size="sm" variant="success" />
                            <div className="text-muted mt-2" style={{ fontSize: '12px' }}>Loading purposes...</div>
                        </div>
                    ) : (
                        <Table responsive className="purpose-table align-middle">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>#</th>
                                    <th style={{ width: '160px' }}>Name</th>
                                    <th>Description</th>
                                    <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {purposes.length > 0 ? (
                                    purposes.map((item, idx) => (
                                        <tr key={item.id} style={{ background: editId === item.id ? '#f0fdf4' : 'transparent' }}>
                                            <td className="text-muted">{idx + 1}</td>
                                            <td>
                                                <span
                                                    className="badge"
                                                    style={{
                                                        background: '#e8fdf4',
                                                        color: '#16a34a',
                                                        border: '1px solid #bbf7d0',
                                                        fontWeight: 600,
                                                        fontSize: '11.5px',
                                                        padding: '4px 8px'
                                                    }}
                                                >
                                                    {item.name}
                                                </span>
                                            </td>
                                            <td className="text-muted" style={{ maxWidth: '220px' }}>
                                                {item.description || <span className="text-light-muted italic">-</span>}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div className="d-flex justify-content-center gap-1">
                                                    <button
                                                        type="button"
                                                        className="btn btn-xs btn-outline-primary p-1"
                                                        style={{ width: '24px', height: '24px', borderRadius: '6px' }}
                                                        onClick={() => handleEdit(item)}
                                                        title="Edit Purpose"
                                                    >
                                                        <i className="fa fa-pencil" style={{ fontSize: '11px' }}></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-xs btn-outline-danger p-1"
                                                        style={{ width: '24px', height: '24px', borderRadius: '6px' }}
                                                        onClick={() => handleDelete(item)}
                                                        title={
                                                            (item.usage_count > 0 || item.followup_count > 0)
                                                                ? `Cannot delete: used in ${item.usage_count || item.followup_count} follow-up record(s)`
                                                                : 'Delete Purpose'
                                                        }
                                                    >
                                                        <i className="fa fa-trash" style={{ fontSize: '11px' }}></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="text-center text-muted py-4" style={{ fontSize: '12px' }}>
                                            No purposes created yet. Enter a name above and click Save.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </Table>
                    )}
                </div>
            </div>

            <div className="modal-footer-custom">
                <button
                    type="button"
                    className="btn-cancel-custom"
                    onClick={onHide}
                >
                    Cancel
                </button>
            </div>
        </Modal>
    );
};

export default CrmPurposeModal;
