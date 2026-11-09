import React, { useState, useEffect } from 'react';
import { Modal, Form, Table, Spinner, Row, Col } from 'react-bootstrap';
import Swal from 'sweetalert2';
import axiosInstance from '../../../services/AxiosInstance';

const OFFER_TYPES = [
    'Percentage',
    'Flat amount',
    'Buy one Get one',
    'Free gift',
    'Free service',
    'Bundle/combo'
];

const STATUS_CHOICES = ['Active', 'Draft', 'Expired', 'Cancelled'];

const initialForm = {
    title: '',
    code: '',
    description: '',
    terms_and_conditions: '',
    offer_type: 'Percentage',
    discount_percent: '',
    discount_amount: '',
    max_discount_amount: '',
    min_purchase_amount: '',
    start_date: '',
    end_date: '',
    status: 'Active',
    is_active: true
};

const CrmOfferModal = ({ show, onHide }) => {
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState(initialForm);

    useEffect(() => {
        if (show) {
            fetchOffers();
            resetForm();
        }
    }, [show]);

    const fetchOffers = async () => {
        setLoading(true);
        try {
            let res;
            try {
                res = await axiosInstance.get('/api/crm_new/offers/');
            } catch {
                res = await axiosInstance.get('/api/crm/offers/');
            }
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setOffers(data);
        } catch (err) {
            console.error('Error fetching offers:', err);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setEditId(null);
        setFormData(initialForm);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleEdit = (offer) => {
        setEditId(offer.id);
        setFormData({
            title: offer.title || '',
            code: offer.code || '',
            description: offer.description || '',
            terms_and_conditions: offer.terms_and_conditions || '',
            offer_type: offer.offer_type || 'Percentage',
            discount_percent: offer.discount_percent ?? '',
            discount_amount: offer.discount_amount ?? '',
            max_discount_amount: offer.max_discount_amount ?? '',
            min_purchase_amount: offer.min_purchase_amount ?? '',
            start_date: offer.start_date || '',
            end_date: offer.end_date || '',
            status: offer.status || 'Active',
            is_active: offer.is_active !== undefined ? offer.is_active : true
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmedTitle = (formData.title || '').trim();
        if (!trimmedTitle) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please enter an Offer Name / Title.',
                confirmButtonColor: '#2ece8a'
            });
            return;
        }

        const payload = {
            title: trimmedTitle,
            code: (formData.code || '').trim() || null,
            description: (formData.description || '').trim() || null,
            terms_and_conditions: (formData.terms_and_conditions || '').trim() || null,
            offer_type: formData.offer_type,
            discount_percent: formData.discount_percent !== '' ? formData.discount_percent : null,
            discount_amount: formData.discount_amount !== '' ? formData.discount_amount : null,
            max_discount_amount: formData.max_discount_amount !== '' ? formData.max_discount_amount : null,
            min_purchase_amount: formData.min_purchase_amount !== '' ? formData.min_purchase_amount : null,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
            status: formData.status,
            is_active: !!formData.is_active
        };

        setSaving(true);
        try {
            if (editId) {
                try {
                    await axiosInstance.put(`/api/crm_new/offers/${editId}/`, payload);
                } catch {
                    await axiosInstance.put(`/api/crm/offers/${editId}/`, payload);
                }
                Swal.fire({
                    icon: 'success',
                    title: 'Updated',
                    text: 'Offer updated successfully.',
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                try {
                    await axiosInstance.post('/api/crm_new/offers/', payload);
                } catch {
                    await axiosInstance.post('/api/crm/offers/', payload);
                }
                Swal.fire({
                    icon: 'success',
                    title: 'Created',
                    text: 'Offer created successfully.',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
            resetForm();
            fetchOffers();
        } catch (err) {
            console.error('Error saving offer:', err);
            const msg = err.response?.data?.code
                ? (Array.isArray(err.response.data.code) ? err.response.data.code[0] : err.response.data.code)
                : 'Failed to save offer. Please check your inputs.';
            Swal.fire({
                icon: 'error',
                title: 'Save Failed',
                text: msg,
                confirmButtonColor: '#2ece8a'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (offer) => {
        const result = await Swal.fire({
            title: 'Delete Offer?',
            text: `Are you sure you want to delete "${offer.title}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                try {
                    await axiosInstance.delete(`/api/crm_new/offers/${offer.id}/`);
                } catch {
                    await axiosInstance.delete(`/api/crm/offers/${offer.id}/`);
                }
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted',
                    text: 'Offer deleted successfully.',
                    timer: 1500,
                    showConfirmButton: false
                });
                if (editId === offer.id) resetForm();
                fetchOffers();
            } catch (err) {
                console.error('Error deleting offer:', err);
                Swal.fire('Error', 'Failed to delete offer.', 'error');
            }
        }
    };

    return (
        <Modal show={show} onHide={onHide} centered size="lg" className="offer-quick-modal">
            <style>{`
                .offer-quick-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .offer-quick-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px 24px 14px 24px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .offer-quick-modal .modal-icon-circle {
                    width: 44px;
                    height: 44px;
                    background: linear-gradient(135deg, #2ece8a 0%, #20b073 100%);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 12px rgba(46, 206, 138, 0.25);
                }
                .offer-quick-modal .modal-close-x {
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    color: #94a3b8;
                    cursor: pointer;
                }
                .offer-quick-modal .modal-body-custom {
                    padding: 20px 24px;
                    max-height: 80vh;
                    overflow-y: auto;
                }
                .offer-quick-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    padding: 8px 12px;
                    font-size: 13px;
                    color: #1e293b;
                    width: 100%;
                }
                .offer-quick-modal .form-label-custom {
                    font-size: 12px;
                    font-weight: 600;
                    color: #475569;
                    margin-bottom: 4px;
                }
                .offer-quick-modal .table th {
                    background: #f8fafc;
                    font-size: 12px;
                    color: #475569;
                    font-weight: 600;
                }
                .offer-quick-modal .table td {
                    font-size: 12.5px;
                    vertical-align: middle;
                }
            `}</style>

            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <i className="fa fa-gift text-white" style={{ fontSize: '1.1rem' }}></i>
                    </div>
                    <div>
                        <h5 className="modal-title font-w600 mb-0" style={{ fontSize: '16px', color: '#1e293b' }}>
                            Offers Master
                        </h5>
                        <small className="text-muted" style={{ fontSize: '11.5px' }}>
                            CRM &bull; Master &bull; Offers
                        </small>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide} aria-label="Close">
                    &times;
                </button>
            </div>

            <div className="modal-body-custom">
                {/* Form Section */}
                <Form onSubmit={handleSubmit} className="mb-4 p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <h6 className="font-w600 text-primary mb-3" style={{ fontSize: '13.5px' }}>
                        <i className="fa fa-plus-circle me-1"></i> {editId ? 'Edit Offer' : 'Add New Offer'}
                    </h6>
                    <Row className="g-2">
                        <Col md={7}>
                            <label className="form-label-custom">
                                Title <span className="text-danger">*</span>
                            </label>
                            <input
                                type="text"
                                name="title"
                                className="form-control-custom"
                                placeholder='e.g. "Diwali 20% Off"'
                                value={formData.title}
                                onChange={handleChange}
                                required
                            />
                        </Col>
                        <Col md={5}>
                            <label className="form-label-custom">Coupon Code</label>
                            <input
                                type="text"
                                name="code"
                                className="form-control-custom text-uppercase"
                                placeholder="e.g. DIWALI20"
                                value={formData.code}
                                onChange={handleChange}
                            />
                        </Col>

                        <Col md={4}>
                            <label className="form-label-custom">Offer Type</label>
                            <Form.Select
                                name="offer_type"
                                className="form-control-custom"
                                value={formData.offer_type}
                                onChange={handleChange}
                            >
                                {OFFER_TYPES.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </Form.Select>
                        </Col>

                        {formData.offer_type === 'Percentage' ? (
                            <Col md={4}>
                                <label className="form-label-custom">Discount (%)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="discount_percent"
                                    className="form-control-custom"
                                    placeholder="e.g. 20"
                                    value={formData.discount_percent}
                                    onChange={handleChange}
                                />
                            </Col>
                        ) : (
                            <Col md={4}>
                                <label className="form-label-custom">Discount (₹ Flat)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="discount_amount"
                                    className="form-control-custom"
                                    placeholder="e.g. 500"
                                    value={formData.discount_amount}
                                    onChange={handleChange}
                                />
                            </Col>
                        )}

                        <Col md={4}>
                            <label className="form-label-custom">Status</label>
                            <Form.Select
                                name="status"
                                className="form-control-custom"
                                value={formData.status}
                                onChange={handleChange}
                            >
                                {STATUS_CHOICES.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </Form.Select>
                        </Col>

                        <Col md={6}>
                            <label className="form-label-custom">Start Date</label>
                            <input
                                type="date"
                                name="start_date"
                                className="form-control-custom"
                                value={formData.start_date}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={6}>
                            <label className="form-label-custom">End Date</label>
                            <input
                                type="date"
                                name="end_date"
                                className="form-control-custom"
                                value={formData.end_date}
                                onChange={handleChange}
                            />
                        </Col>

                        <Col md={12}>
                            <label className="form-label-custom">Caller Pitch Description</label>
                            <textarea
                                name="description"
                                rows="2"
                                className="form-control-custom"
                                placeholder="Short pitch for callers to read out..."
                                value={formData.description}
                                onChange={handleChange}
                            />
                        </Col>
                        <Col md={12}>
                            <label className="form-label-custom">Terms and Conditions</label>
                            <textarea
                                name="terms_and_conditions"
                                rows="1"
                                className="form-control-custom"
                                placeholder="Conditions and exclusions..."
                                value={formData.terms_and_conditions}
                                onChange={handleChange}
                            />
                        </Col>
                    </Row>
                    <div className="d-flex justify-content-end gap-2 mt-3">
                        {editId && (
                            <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                onClick={resetForm}
                                style={{ borderRadius: '6px' }}
                            >
                                Cancel Edit
                            </button>
                        )}
                        <button
                            type="submit"
                            className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                            disabled={saving}
                            style={{ borderRadius: '6px', fontWeight: '600' }}
                        >
                            {saving ? <Spinner animation="border" size="sm" /> : <i className="fa fa-save"></i>}
                            {editId ? 'Update Offer' : 'Save Offer'}
                        </button>
                    </div>
                </Form>

                {/* Existing Offers Table */}
                <h6 className="font-w600 text-dark mb-2" style={{ fontSize: '13px' }}>
                    Existing Offers ({offers.length})
                </h6>
                {loading ? (
                    <div className="text-center py-4">
                        <Spinner animation="border" variant="primary" size="sm" />
                    </div>
                ) : (
                    <div className="table-responsive border rounded" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                        <Table hover className="mb-0">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Title</th>
                                    <th>Code</th>
                                    <th>Type</th>
                                    <th>Discount</th>
                                    <th>Status</th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {offers.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="text-center py-4 text-muted">
                                            No offers found. Create your first offer above.
                                        </td>
                                    </tr>
                                ) : (
                                    offers.map((o, idx) => (
                                        <tr key={o.id}>
                                            <td>{idx + 1}</td>
                                            <td><strong>{o.title}</strong></td>
                                            <td><code>{o.code || '—'}</code></td>
                                            <td><span className="badge badge-light">{o.offer_type}</span></td>
                                            <td className="text-success font-w600">
                                                {o.offer_type === 'Percentage'
                                                    ? (o.discount_percent ? `${parseFloat(o.discount_percent)}%` : '—')
                                                    : (o.discount_amount ? `₹${parseFloat(o.discount_amount)}` : '—')}
                                            </td>
                                            <td>
                                                <span className={`badge badge-sm badge-${o.status === 'Active' ? 'success' : o.status === 'Draft' ? 'secondary' : 'warning'} light`}>
                                                    {o.status}
                                                </span>
                                            </td>
                                            <td className="text-end">
                                                <div className="d-flex justify-content-end gap-1">
                                                    <button
                                                        type="button"
                                                        className="btn btn-xs btn-outline-primary"
                                                        onClick={() => handleEdit(o)}
                                                        title="Edit"
                                                    >
                                                        <i className="fa fa-pencil"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-xs btn-outline-danger"
                                                        onClick={() => handleDelete(o)}
                                                        title="Delete"
                                                    >
                                                        <i className="fa fa-trash"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </Table>
                    </div>
                )}
            </div>
            <div className="modal-footer p-2 bg-light d-flex justify-content-end">
                <button type="button" className="btn btn-secondary btn-sm" onClick={onHide} style={{ borderRadius: '6px' }}>
                    Close
                </button>
            </div>
        </Modal>
    );
};

export default CrmOfferModal;
