import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import swal from 'sweetalert';
import { Modal } from 'react-bootstrap';
import { usePermission } from '../../../hooks/usePermission';
import { useFormConfig } from '../../../hooks/useFormConfig';
import LogisticsService from '../../../services/LogisticsService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import ServiceTypeList from './Servicetypelist';
import ServiceTypeForm from './Servicetypeform';

const ServiceTypeManagement = ({ currentUser, embedded }) => {
    const navigate = useNavigate();
    const { can } = usePermission();
    const { stripHiddenFields } = useFormConfig('logistics_app_servicetype', 'Servicetypeform');

    // ── State ──────────────────────────────────────────────────────────────
    const [managementData, setManagementData] = useState([]);
    const [loading, setLoading]               = useState(false);
    const [showModal, setShowModal]           = useState(false);
    const [isEditing, setIsEditing]           = useState(false);
    const [selectedId, setSelectedId]         = useState(null);
    const [searchTerm, setSearchTerm]         = useState('');
    const [formData, setFormData]             = useState({ service_type: '', description: '' });

    // ── Fetch ──────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await LogisticsService.getServiceTypes();
            setManagementData(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching service types:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ── Filtered list (client-side search) ────────────────────────────────
    const filteredData = managementData.filter((item) =>
        (item.service_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.created_by_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleAdd = () => {
        setIsEditing(false);
        setSelectedId(null);
        setFormData({ service_type: '', description: '' });
        setShowModal(true);
    };

    const handleEdit = (item) => {
        setIsEditing(true);
        setSelectedId(item.id);
        setFormData({
            service_type: item.service_type || '',
            description:  item.description  || '',
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Strip hidden fields from payload so disabled fields don't cause
            // backend validation errors (e.g. "service_type is required")
            const payload = stripHiddenFields(formData);
            if (isEditing && selectedId) {
                await LogisticsService.updateServiceType(selectedId, payload);
            } else {
                await LogisticsService.createServiceType(payload);
            }
            setShowModal(false);
            setFormData({ service_type: '', description: '' });
            setSelectedId(null);
            await fetchData();
            swal(
                'Success!',
                `Service type ${isEditing ? 'updated' : 'created'} successfully!`,
                'success'
            );
        } catch (err) {
            const errData = err.response?.data;
            let errorMsg = 'Error saving service type.';
            if (errData) {
                if (typeof errData === 'string')    errorMsg = errData;
                else if (errData.detail)            errorMsg = errData.detail;
                else if (errData.service_type)      errorMsg = errData.service_type[0];
                else                                errorMsg = JSON.stringify(errData);
            }
            swal('Error', errorMsg, 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await swal({
            title: 'Delete Service Type?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            buttons: ['Cancel', 'Delete'],
            dangerMode: true,
        });
        if (!confirmed) return;
        try {
            await LogisticsService.deleteServiceType(id);
            await fetchData();
            swal('Deleted!', 'Service type has been removed.', 'success');
        } catch (err) {
            const msg = err.response?.data?.detail || 'Could not delete this service type.';
            swal('Record In Use', msg, 'error');
        }
    };

    const handleExport = (format) => {
        const columns = [
            { header: '#',            dataKey: 'index' },
            { header: 'Service Type', dataKey: 'service_type' },
            { header: 'Description',  dataKey: 'description', formatter: (v) => v || '—' },
            { header: 'Created By',   dataKey: 'created_by_name', formatter: (v) => v || '—' },
        ];
        const dataWithIndex = filteredData.map((d, i) => ({ ...d, index: i + 1 }));
        const title = 'Service Types';

        if (format === 'pdf')        exportToPDF(dataWithIndex, columns, 'service_types.pdf', title);
        else if (format === 'excel') exportToExcel(dataWithIndex, columns, 'service_types.xlsx');
        else if (format === 'print') printData(dataWithIndex, columns, title);
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-lg-12">
                    <ServiceTypeList
                        data={filteredData}
                        loading={loading}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onExport={handleExport}
                        onAdd={handleAdd}
                        currentUser={currentUser}
                        can={can}
                    />
                </div>
            </div>

            {/* ── Modal ────────────────────────────────────────────────── */}
            <Modal show={showModal} onHide={() => setShowModal(false)} centered dialogClassName="scfm-modal-dialog" contentClassName="border-0 bg-transparent">
                <Modal.Body className="p-0 bg-white" style={{ borderRadius: '16px' }}>
                    <ServiceTypeForm
                        formData={formData}
                        setFormData={setFormData}
                        onSave={handleSubmit}
                        onCancel={() => setShowModal(false)}
                        isEditing={isEditing}
                    />
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default ServiceTypeManagement;