import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import swal from 'sweetalert';
import { usePermission } from '../../../hooks/usePermission';
import { useFormConfig } from '../../../hooks/useFormConfig';
import * as FinanceService from '../../../services/FinanceService';
import VoucherTypeList from './VoucherTypeList';
import VoucherTypeForm from './VoucherTypeForm';
import CreateButton from '../../../components/permissions/CreateButton';
import { Card, Button, Form } from 'react-bootstrap';

const makeEmptyForm = () => ({
    id: null,
    name: '',
    code: '',
    is_active: true,
});

const VoucherTypeManagement = ({ currentUser }) => {
    const navigate = useNavigate();
    const { can } = usePermission();
    const { isFieldVisible, stripHiddenFields } = useFormConfig('finance_app_vouchertype', 'VoucherTypeForm');

    const [voucherTypes, setVoucherTypes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState(makeEmptyForm());
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await FinanceService.getVoucherTypes();
            const data = res?.results ? res.results : res;
            setVoucherTypes(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error fetching voucher types:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filteredData = voucherTypes.filter((vt) => {
        const term = searchTerm.toLowerCase();
        return (vt.name || '').toLowerCase().includes(term);
    });

    const handleAddClick = () => {
        setIsEditing(false);
        setFormData(makeEmptyForm());
        setModalOpen(true);
    };

    const handleEdit = (item) => {
        setIsEditing(true);
        setFormData({
            id: item.id,
            name: item.name || '',
            code: item.code || '',
            is_active: item.is_active,
        });
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (isFieldVisible('name') && !formData.name) {
            swal('Validation Error', 'Name is required.', 'warning');
            return;
        }
        if (isFieldVisible('code') && !formData.code) {
            swal('Validation Error', 'Code is required.', 'warning');
            return;
        }

        try {
            const payload = stripHiddenFields(formData);
            if (isEditing && formData.id) {
                await FinanceService.updateVoucherType(formData.id, payload);
            } else {
                await FinanceService.createVoucherType(payload);
            }
            setModalOpen(false);
            setFormData(makeEmptyForm());
            await fetchData();
            swal(
                'Success!',
                `Voucher Type ${isEditing ? 'updated' : 'created'} successfully!`,
                'success'
            );
        } catch (err) {
            console.error('Error saving voucher type:', err);
            const msg = err.response?.data?.detail || err.response?.data?.name?.[0] || err.response?.data?.code?.[0] || 'Error saving voucher type.';
            swal('Error', msg, 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await swal({
            title: 'Delete Voucher Type?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            buttons: ['Cancel', 'Delete'],
            dangerMode: true,
        });
        if (!confirmed) return;
        try {
            await FinanceService.deleteVoucherType(id);
            await fetchData();
            swal('Deleted!', 'Voucher Type has been deleted successfully.', 'success');
        } catch (err) {
            console.error('Error deleting voucher type:', err);
            const msg = err.response?.data?.detail || 'Could not delete voucher type.';
            swal('Error', msg, 'error');
        }
    };

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
                <div className="col-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Voucher Types</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search by name..."
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
                                        backgroundColor: '#0a500f', borderColor: '#0a500f', fontSize: '13px'
                                    }}
                                >
                                    <i className="fa fa-plus me-2"></i> Add Voucher Type
                                </Button>
                            </div>
                        </Card.Header>

                        <Card.Body>
                            <VoucherTypeList
                                data={filteredData}
                                loading={loading}
                                searchTerm={searchTerm}
                                onSearchChange={setSearchTerm}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                can={can}
                            />
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {modalOpen && (
                <VoucherTypeForm
                    formData={formData}
                    setFormData={setFormData}
                    onSave={handleSubmit}
                    onCancel={() => setModalOpen(false)}
                    isEditing={isEditing}
                />
            )}
        </div>
    );
};

export default VoucherTypeManagement;
