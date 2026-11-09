import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import swal from 'sweetalert';
import { Modal } from 'react-bootstrap';
import { usePermission } from '../../../hooks/usePermission';
import LogisticsService from '../../../services/LogisticsService';
import axiosInstance from '../../../services/AxiosInstance';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import VehicleList from './Vehiclelist';
import VehicleForm from './Vehicleform';
import CreateButton from '../../../components/permissions/CreateButton';

/**
 * VehicleManagement
 * Follows the same architecture as VehicleCategoryManagement / AssetManagement.
 */
const VehicleManagement = ({ currentUser, embedded }) => {
    const navigate = useNavigate();
    const { can } = usePermission();

    // ── State ──────────────────────────────────────────────────────────────
    const [managementData, setManagementData] = useState([]);
    const [categories, setCategories]         = useState([]);
    const [drivers, setDrivers]               = useState([]);
    const [tyreSizes, setTyreSizes]           = useState([]);
    const [stockItems, setStockItems]         = useState([]);
    const [loading, setLoading]               = useState(false);
    const [showModal, setShowModal]           = useState(false);
    const [isEditing, setIsEditing]           = useState(false);
    const [formData, setFormData]             = useState({});
    const [selectedId, setSelectedId]         = useState(null);
    const [searchTerm, setSearchTerm]         = useState('');

    // ── Fetch ──────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await LogisticsService.getVehicles();
            setManagementData(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching vehicles:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchCategories = useCallback(async () => {
        try {
            const res = await LogisticsService.getVehicleCategories();
            setCategories(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    }, []);

    const fetchDrivers = useCallback(async () => {
        try {
            const res = await LogisticsService.getDrivers();
            setDrivers(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching drivers:', err);
        }
    }, []);

    const fetchTyreSizes = useCallback(async () => {
        try {
            const res = await axiosInstance.get('/api/logistics/tyre-sizes/');
            setTyreSizes(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching tyre sizes:', err);
        }
    }, []);

    const fetchStockItems = useCallback(async () => {
        try {
            const res = await axiosInstance.get('/api/inventory/stock-items/simple/');
            const items = Array.isArray(res.data) ? res.data : [];
            const vehicleItems = items.filter(item => {
                const group = (item.stock_group_name || item.stock_group?.name || '').trim().toLowerCase();
                return group === 'vehicle' || group === 'vehicles' || group === 'vechicle' || group.includes('vehicle');
            });
            setStockItems(vehicleItems.length > 0 ? vehicleItems : items.filter(item => {
                const group = (item.stock_group_name || item.stock_group?.name || '').trim().toLowerCase();
                return group.includes('vehicle');
            }));
        } catch (err) {
            console.error('Error fetching stock items:', err);
        }
    }, []);

    useEffect(() => {
        fetchData();
        fetchCategories();
        fetchDrivers();
        fetchTyreSizes();
        fetchStockItems();
    }, [fetchData, fetchCategories, fetchDrivers, fetchTyreSizes, fetchStockItems]);

    // ── Filtered list ──────────────────────────────────────────────────────
    const filteredData = managementData.filter((item) => {
    const term = searchTerm.toLowerCase().trim();

    const statusText = (item.vehicle_status || '').toLowerCase();

    return (
        (item.vehicle_name || '').toLowerCase().includes(term) ||
        (item.vehicle_number || '').toLowerCase().includes(term) ||
        (item.vehicle_code || '').toLowerCase().includes(term) ||
        (item.driver_name || '').toLowerCase().includes(term) ||
        (item.driver_full_name || '').toLowerCase().includes(term) ||
        (item.user_full_name || '').toLowerCase().includes(term) ||
        (item.category_name || '').toLowerCase().includes(term) ||
        statusText.includes(term) ||
        String(item.id || '').includes(term) ||
        String(item.rate || '').includes(term) ||
        String(item.capacity || '').includes(term) ||
        String(item.tonnage || '').includes(term) ||
        String(item.volume || '').includes(term) ||
        (item.fuel_type || '').toLowerCase().includes(term)
    );
});

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleEdit = (item) => {
        setIsEditing(true);
        setSelectedId(item.id);
        setFormData({
            vehicle_name: item.vehicle_name || '',
            vehicle_number: item.vehicle_number || '',
            category: item.category || '',
            driver: item.driver || '',
            vehicle_status: item.vehicle_status || 'available',
            vehicle_img: item.vehicle_img || '',
            vehicle_img_preview: item.vehicle_img || '',
            narration: item.narration || '',
            fuel_type: item.fuel_type || 'diesel',
            mileage: item.mileage || '',
            tonnage: item.tonnage || '',
            volume: item.volume || '',
            capacity: item.capacity || '',
            rate: item.rate || '',
            front_tyre_size: item.front_tyre_size || '',
            rear_tyre_size: item.rear_tyre_size || '',
            vehicle_fasttag: item.vehicle_fasttag || '',
            vehicle_insurance_date: item.vehicle_insurance_date || '',
            vehicle_taxes_date: item.vehicle_taxes_date || '',
            vehicle_pollution_date: item.vehicle_pollution_date || '',
            next_service_date: item.next_service_date || '',
            next_retest_date: item.next_retest_date || '',
        });
        setShowModal(true);
    };

    const buildFormData = () => {
        const fd = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') return;
            // Skip file URLs (only upload actual File objects)
            if (key === 'vehicle_img' && typeof value === 'string') return;
            // Skip frontend-only preview key
            if (key === 'vehicle_img_preview') return;
            fd.append(key, value);
        });
        return fd;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.vehicle_name || !String(formData.vehicle_name).trim()) {
            swal('Validation Error', 'Vehicle Name is required.', 'warning');
            return;
        }
        const isDuplicateName = managementData.some(
            (v) => (!isEditing || Number(v.id) !== Number(selectedId)) &&
                   (v.vehicle_name || '').toLowerCase().trim() === String(formData.vehicle_name).toLowerCase().trim()
        );
        if (isDuplicateName) {
            swal('Validation Error', `Vehicle "${formData.vehicle_name}" has already been added.`, 'warning');
            return;
        }
        if (!formData.vehicle_number || !String(formData.vehicle_number).trim()) {
            swal('Validation Error', 'Vehicle Number is required.', 'warning');
            return;
        }
        if (!formData.category) {
            swal('Validation Error', 'Category is required.', 'warning');
            return;
        }
        try {
            const payload = buildFormData();
            if (isEditing && selectedId) {
                await LogisticsService.updateVehicle(selectedId, payload);
            } else {
                await LogisticsService.createVehicle(payload);
            }
            setShowModal(false);
            setFormData({});
            setSelectedId(null);
            await fetchData();
            swal(
                'Success!',
                `Vehicle ${isEditing ? 'updated' : 'created'} successfully!`,
                'success'
            );
        } catch (err) {
            let errData = err.response?.data;
            let errorMsg = 'Please check all mandatory fields.';
            
            if (errData) {
                if (typeof errData === 'string') {
                    if (errData.includes('Internal Server Error') || errData.includes('{')) {
                        errorMsg = 'Please fill in all the mandatory fields properly before saving.';
                    } else {
                        errorMsg = errData;
                    }
                } else if (typeof errData === 'object' && errData !== null) {
                    if (errData.detail) {
                        errorMsg = errData.detail;
                    } else {
                        const firstKey = Object.keys(errData)[0];
                        if (firstKey) {
                            const val = Array.isArray(errData[firstKey]) ? errData[firstKey][0] : errData[firstKey];
                            errorMsg = `${firstKey.replace(/_/g, ' ')}: ${val}`;
                            errorMsg = errorMsg.charAt(0).toUpperCase() + errorMsg.slice(1);
                        }
                    }
                }
            }
            swal('Validation Error', errorMsg, 'warning');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await swal({
            title: 'Delete Vehicle?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            buttons: ['Cancel', 'Delete'],
            dangerMode: true,
        });
        if (!confirmed) return;
        try {
            await LogisticsService.deleteVehicle(id);
            await fetchData();
            swal('Deleted!', 'Vehicle has been removed.', 'success');
        } catch (err) {
            const msg =
                err.response?.data?.detail || 'Could not delete vehicle.';
            swal('Record In Use', msg, 'error');
        }
    };

    const handleExport = (format) => {
        const columns = [
            { header: '#',             dataKey: 'index' },
            { header: 'Code',         dataKey: 'vehicle_code' },
            { header: 'Vehicle Name', dataKey: 'vehicle_name' },
            { header: 'Number',       dataKey: 'vehicle_number' },
            { header: 'Category',     dataKey: 'category_name', formatter: (v) => v || '—' },
            { header: 'Status',       dataKey: 'vehicle_status' },
        ];
        const dataWithIndex = filteredData.map((d, i) => ({ ...d, index: i + 1 }));
        const title = 'Vehicles';

        if (format === 'pdf')        exportToPDF(dataWithIndex, columns, 'vehicles.pdf', title);
        else if (format === 'excel') exportToExcel(dataWithIndex, columns, 'vehicles.xlsx');
        else if (format === 'print') printData(dataWithIndex, columns, title);
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-lg-12">
                    <VehicleList
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
                            setFormData({});
                            setShowModal(true);
                        }}
                        currentUser={currentUser}
                        can={can}
                    />
                </div>
            </div>

            {/* ── Modal ────────────────────────────────────────────────── */}
            <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg" dialogClassName="scfm-modal-dialog" contentClassName="border-0 bg-transparent">
                <Modal.Body className="p-0 bg-white" style={{ borderRadius: '16px' }}>
                    <VehicleForm
                        formData={formData}
                        setFormData={setFormData}
                        onSave={handleSubmit}
                        onCancel={() => setShowModal(false)}
                        isEditing={isEditing}
                        categories={categories}
                        tyreSizes={tyreSizes}
                        stockItems={stockItems.filter((item) => {
                            // Exclude stock items whose name is already assigned to another vehicle
                            const assignedVehicleNames = managementData
                                .filter((v) => (!isEditing || Number(v.id) !== Number(selectedId)) && v.vehicle_name)
                                .map((v) => (v.vehicle_name || '').toLowerCase().trim());
                            const currentItemName = (item.name || '').toLowerCase().trim();
                            return !assignedVehicleNames.includes(currentItemName);
                        })}
                        drivers={drivers.filter((drv) => {
                            // Get all driver IDs that are already assigned to a vehicle
                            const assignedDriverIds = managementData
                                .filter((v) => v.driver)
                                .map((v) => Number(v.driver));
                            // If editing, allow the current vehicle's own driver to stay in the list
                            if (isEditing && formData.driver && Number(drv.id) === Number(formData.driver)) {
                                return true;
                            }
                            // Exclude drivers already assigned to other vehicles
                            return !assignedDriverIds.includes(Number(drv.id));
                        })}
                    />
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default VehicleManagement;