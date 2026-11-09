import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Form } from 'react-bootstrap';
import swal from 'sweetalert';
import { usePageTitle } from '../../../context/TitleContext';
import InventoryService from '../../../services/InventoryService';
import ProductConfigurationList from './ProductConfigurationList';
import ProductConfigurationForm from './ProductConfigurationForm';

/* ── Empty form state ───────────────────────────────────────────────────────── */
const makeEmptyForm = () => ({
    voucher_type: '',
    maintain_batch: false,
    maintain_manufacture_date: false,
    maintain_expiry_date: false,
    maintain_warehouse: false,
    maintain_narration: false,
});

/* ── Main Component ─────────────────────────────────────────────────────────── */
const ProductConfigurationManagement = ({ currentUser }) => {
    usePageTitle("Voucher Mapping");
    const navigate = useNavigate();

    const [configs, setConfigs]       = useState([]);
    const [loading, setLoading]       = useState(false);
    const [modalOpen, setModalOpen]   = useState(false);
    const [isEditing, setIsEditing]   = useState(false);
    const [formData, setFormData]     = useState(makeEmptyForm());
    const [searchTerm, setSearchTerm] = useState('');

    /* ── Fetch ── */
    const fetchConfigs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await InventoryService.getProductConfigurations();
            setConfigs(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching voucher mappings:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

    /* ── Filtered list ── */
    const filteredConfigs = configs.filter((c) => {
        const term = searchTerm.toLowerCase();
        return (
            (c.voucher_type_name || '').toLowerCase().includes(term) ||
            (c.voucher_type_code || '').toLowerCase().includes(term)
        );
    });

    /* ── Handlers ── */
    const handleAddClick = () => {
        setIsEditing(false);
        setFormData(makeEmptyForm());
        setModalOpen(true);
    };

    const handleEdit = (config) => {
        setIsEditing(true);
        setFormData({
            id: config.id,
            voucher_type: config.voucher_type,
            maintain_batch: config.maintain_batch,
            maintain_manufacture_date: config.maintain_manufacture_date,
            maintain_expiry_date: config.maintain_expiry_date,
            maintain_warehouse: config.maintain_warehouse,
            maintain_narration: config.maintain_narration,
        });
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setFormData(makeEmptyForm());
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.voucher_type) {
            swal('Validation', 'Please select a voucher type.', 'warning');
            return;
        }

        try {
            if (isEditing && formData.id) {
                await InventoryService.updateProductConfiguration(formData.id, formData);
            } else {
                await InventoryService.createProductConfiguration(formData);
            }
            handleCloseModal();
            await fetchConfigs();
            swal(
                'Success!',
                `Mapping ${isEditing ? 'updated' : 'created'} successfully!`,
                'success'
            );
        } catch (err) {
            console.error('Error saving mapping:', err);
            const errData = err.response?.data;
            let msg = 'Error saving mapping.';
            if (errData) {
                if (typeof errData === 'string')       msg = errData;
                else if (errData.detail)               msg = errData.detail;
                else if (errData.voucher_type)         msg = `Voucher Type: ${errData.voucher_type[0]}`;
                else                                   msg = JSON.stringify(errData);
            }
            swal('Error', msg, 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await swal({
            title: 'Delete Mapping?',
            text: 'This will remove the mapping for this voucher type.',
            icon: 'warning',
            buttons: ['Cancel', 'Delete'],
            dangerMode: true,
        });
        if (!confirmed) return;

        try {
            await InventoryService.deleteProductConfiguration(id);
            await fetchConfigs();
            swal('Deleted!', 'Mapping deleted successfully.', 'success');
        } catch (err) {
            const msg = err.response?.data?.detail || 'Could not delete mapping.';
            swal('Error', msg, 'error');
        }
    };

    /* ── Render ── */
    return (
        <div className="container-fluid">
            <div className="page-titles">
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
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Voucher Mappings</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search by voucher type..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={handleAddClick}
                                    className="d-flex align-items-center justify-content-center"
                                    style={{
                                        height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px',
                                        backgroundColor: 'rgb(61, 53, 119)', borderColor: 'rgb(61, 53, 119)', fontSize: '13px'
                                    }}
                                >
                                    <i className="fa fa-plus me-2"></i> Add Mapping
                                </Button>
                            </div>
                        </Card.Header>

                        <Card.Body>
                            {/* ── List ── */}
                            <ProductConfigurationList
                                data={filteredConfigs}
                                loading={loading}
                                searchTerm={searchTerm}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* ── Modal Popup ── */}
            <ProductConfigurationForm
                open={modalOpen}
                formData={formData}
                setFormData={setFormData}
                onSave={handleSubmit}
                onCancel={handleCloseModal}
                isEditing={isEditing}
            />
        </div>
    );
};

export default ProductConfigurationManagement;
