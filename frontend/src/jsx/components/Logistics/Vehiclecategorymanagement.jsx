import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import swal from 'sweetalert';
import { Modal } from 'react-bootstrap';
import { usePermission } from '../../../hooks/usePermission';
import { useFormConfig } from '../../../hooks/useFormConfig';
import LogisticsService from '../../../services/LogisticsService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import VehicleCategoryList from './Vehiclecategorylist';
import VehicleCategoryForm from './Vehiclecategoryform';

/**
 * VehicleCategoryManagement
 * Follows the exact same architecture as AssetManagement.jsx:
 *  - fetchData()        loads list from API
 *  - handleEdit()       populates formData + opens modal
 *  - handleSubmit()     create or update via API
 *  - handleDelete()     delete with confirm
 *  - handleExport()     pdf / excel / print via exportUtils
 *  - showModal          controls the fd-modal-overlay
 */
const VehicleCategoryManagement = ({ currentUser, embedded }) => {
    const navigate = useNavigate();
    const { can } = usePermission();
    const { isFieldVisible, stripHiddenFields } = useFormConfig('logistics_app_vehicle_category', 'Vehiclecategoryform');

    // ── State ──────────────────────────────────────────────────────────────
    const [managementData, setManagementData] = useState([]);
    const [loading, setLoading]               = useState(false);
    const [showModal, setShowModal]           = useState(false);
    const [isEditing, setIsEditing]           = useState(false);
    const [formData, setFormData]             = useState({ category_name: '' });
    const [selectedId, setSelectedId]         = useState(null);
    const [searchTerm, setSearchTerm]         = useState('');

    // ── Fetch ──────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await LogisticsService.getVehicleCategories();
            setManagementData(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching vehicle categories:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ── Filtered list (client-side search) ─────────────────────────────────
    const filteredData = managementData.filter((item) => {
    const term = searchTerm.toLowerCase().trim();

    return (
        (item.category_name || '').toLowerCase().includes(term) ||
        (item.created_by_name || '').toLowerCase().includes(term) ||
        String(item.id || '').includes(term)
    );
});

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleEdit = (item) => {
        setIsEditing(true);
        setSelectedId(item.id);
        setFormData({ category_name: item.category_name });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (/^\d+$/.test(formData.category_name.trim())) {
            swal('Validation Error', 'Category name cannot consist only of numbers.', 'warning');
            return;
        }

        try {
            const payload = stripHiddenFields(formData);
            if (isEditing && selectedId) {
                await LogisticsService.updateVehicleCategory(selectedId, payload);
            } else {
                await LogisticsService.createVehicleCategory(payload);
            }
            setShowModal(false);
            setFormData({ category_name: '' });
            setSelectedId(null);
            await fetchData();
            swal(
                'Success!',
                `Vehicle category ${isEditing ? 'updated' : 'created'} successfully!`,
                'success'
            );
        } catch (err) {
            const errData = err.response?.data;
            let errorMsg = 'Error saving vehicle category.';
            if (errData) {
                if (typeof errData === 'string') errorMsg = errData;
                else if (errData.detail) errorMsg = errData.detail;
                else if (errData.category_name) errorMsg = errData.category_name[0];
                else errorMsg = JSON.stringify(errData);
            }
            swal('Error', errorMsg, 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await swal({
            title: 'Delete Vehicle Category?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            buttons: ['Cancel', 'Delete'],
            dangerMode: true,
        });
        if (!confirmed) return;
        try {
            await LogisticsService.deleteVehicleCategory(id);
            await fetchData();
            swal('Deleted!', 'Vehicle category has been removed.', 'success');
        } catch (err) {
            const msg =
                err.response?.data?.detail ||
                'Could not delete. This category may have vehicles assigned to it.';
            swal('Error', msg, 'error');
        }
    };

    const handleExport = (format) => {
        const columns = [
            { header: '#',             dataKey: 'index' },
            { header: 'Category Name', dataKey: 'category_name' },
            { header: 'Created By',    dataKey: 'created_by_name', formatter: (v) => v || '—' },
        ];
        // Inject index for export
        const dataWithIndex = filteredData.map((d, i) => ({ ...d, index: i + 1 }));
        const title = 'Vehicle Categories';

        if (format === 'pdf')   exportToPDF(dataWithIndex, columns, 'vehicle_categories.pdf', title);
        else if (format === 'excel') exportToExcel(dataWithIndex, columns, 'vehicle_categories.xlsx');
        else if (format === 'print') printData(dataWithIndex, columns, title);
    };

    // ── Render ─────────────────────────────────────────────────────────────
 
    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-lg-12">
                    <VehicleCategoryList
                        data={filteredData}
                        loading={loading}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onExport={handleExport}
                        onAdd={() => {
                            setIsEditing(false);
                            setSelectedId(null);
                            setFormData({ category_name: '' });
                            setShowModal(true);
                        }}
                        currentUser={currentUser}
                        can={can}
                    />
                </div>
            </div>

            {/* ── Modal ────────────────────────────────────────────────── */}
            <Modal show={showModal} onHide={() => setShowModal(false)} centered dialogClassName="scfm-modal-dialog" contentClassName="border-0 bg-transparent">
                <Modal.Body className="p-0 bg-white" style={{ borderRadius: '16px' }}>
                    <VehicleCategoryForm
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

export default VehicleCategoryManagement;