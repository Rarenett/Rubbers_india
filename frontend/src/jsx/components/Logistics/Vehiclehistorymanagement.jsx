import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import swal from 'sweetalert';
import Swal from 'sweetalert2';
import { Modal } from 'react-bootstrap';
import { usePermission } from '../../../hooks/usePermission';
import { useFormConfig } from '../../../hooks/useFormConfig';
import LogisticsService from '../../../services/LogisticsService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import VehicleHistoryList from './Vehiclehistorylist';
import VehicleHistoryForm from './Vehiclehistoryform';
import { fetchCompanyFinancialYears } from '../../../services/CompanyService';

const emptyForm = {
    trans_no:            '',
    trans_date:          '',
    vehicle:             '',
    vehicle_name:        '',
    default_driver:      '',
    default_driver_name: '',
    actual_km:           '',
    service_type:        '',
    cost:                '',
    attachment:          null,
    attachment_url:      '',
    narration:           '',
    fuel_liters:         '',
};

const VehicleHistoryManagement = ({ currentUser, embedded }) => {
    const navigate = useNavigate();
    const { can } = usePermission();
    const { isFieldVisible } = useFormConfig('logistics_app_vehiclehistory', 'Vehiclehistoryform');

    // ── State ──────────────────────────────────────────────────────────────
    const [managementData, setManagementData] = useState([]);
    const [loading, setLoading]               = useState(false);
    const [showModal, setShowModal]           = useState(false);
    const [isEditing, setIsEditing]           = useState(false);
    const [selectedId, setSelectedId]         = useState(null);
    const [searchTerm, setSearchTerm]         = useState('');
    const [vehicleFilter, setVehicleFilter] = useState('');
    const [serviceTypeFilter, setServiceTypeFilter] = useState('');
    
    // Default to current month
    const currentDate = new Date();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const [fromDate, setFromDate] = useState(
        localStorage.getItem('active_fy_start') || `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`
    );
    const [toDate, setToDate] = useState(
        localStorage.getItem('active_fy_end') || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
    );
    const [formData, setFormData]             = useState({ ...emptyForm });

    useEffect(() => {
        const fetchFy = async () => {
            try {
                const companyId = localStorage.getItem('companyId') || 1;
                const res = await fetchCompanyFinancialYears(companyId);
                if (res.data && Array.isArray(res.data)) {
                    const activeFy = res.data.find(fy => fy.is_active);
                    if (activeFy) {
                        setFromDate(activeFy.start_date);
                        setToDate(activeFy.end_date);
                        localStorage.setItem('active_fy_start', activeFy.start_date);
                        localStorage.setItem('active_fy_end', activeFy.end_date);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch financial years", error);
            }
        };
        fetchFy();
    }, []);

    // Dropdown source data
    const [vehicles,     setVehicles]     = useState([]);
    const [drivers,      setDrivers]      = useState([]);
    const [serviceTypes, setServiceTypes] = useState([]);

    // ── Fetch history list ─────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await LogisticsService.getVehicleHistories();
            setManagementData(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching vehicle histories:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Fetch dropdown data once ───────────────────────────────────────────
    const fetchDropdowns = useCallback(async () => {
        try {
            const [vRes, dRes, sRes] = await Promise.all([
                LogisticsService.getVehicles(),
                LogisticsService.getDrivers(),
                LogisticsService.getServiceTypes(),
            ]);
            setVehicles(Array.isArray(vRes.data)     ? vRes.data : []);
            setDrivers(Array.isArray(dRes.data)      ? dRes.data : []);
            setServiceTypes(Array.isArray(sRes.data) ? sRes.data : []);
        } catch (err) {
            console.error('Error fetching dropdowns:', err);
        }
    }, []);

    useEffect(() => {
        fetchData();
        fetchDropdowns();
    }, [fetchData, fetchDropdowns]);

    // ── Auto-fill: vehicle name + default driver when vehicle is selected ──
    const handleVehicleChange = useCallback(async (vehicleId) => {
        if (!vehicleId) {
            setFormData((prev) => ({
                ...prev,
                vehicle_name:        '',
                default_driver:      '',
                default_driver_name: '',
            }));
            return;
        }
        try {
            const res = await LogisticsService.getVehicleLookup(vehicleId);
            const { vehicle_name, default_driver_id, default_driver_name } = res.data;
            setFormData((prev) => ({
                ...prev,
                vehicle_name:        vehicle_name        || '',
                default_driver:      default_driver_id   ? String(default_driver_id) : '',
                default_driver_name: default_driver_name || '',
            }));
        } catch (err) {
            console.error('Vehicle lookup failed:', err);
        }
    }, []);

    // ── Client-side search filter ──────────────────────────────────────────
    const filteredData = managementData.filter((item) => {

    const term = searchTerm.toLowerCase();

    const searchMatch =
        (item.trans_no || '').toLowerCase().includes(term) ||
        (item.vehicle_name || '').toLowerCase().includes(term) ||
        (item.vehicle_number_display || '').toLowerCase().includes(term) ||
        (item.driver_name || '').toLowerCase().includes(term) ||
        (item.service_type_name || '').toLowerCase().includes(term);

    const vehicleMatch =
        !vehicleFilter ||
        String(item.vehicle) === String(vehicleFilter);

    const serviceMatch =
        !serviceTypeFilter ||
        String(item.service_type) === String(serviceTypeFilter);

    const dateMatch = (() => {
        if (!fromDate && !toDate) return true;
        const itemDate = item.trans_date ? new Date(item.trans_date) : null;
        if (!itemDate) return false;
        if (fromDate && itemDate < new Date(fromDate)) return false;
        if (toDate   && itemDate > new Date(toDate))   return false;
        return true;
    })();

    return searchMatch && vehicleMatch && serviceMatch && dateMatch;
});

    // ── Edit handler ───────────────────────────────────────────────────────
    const handleEdit = (item) => {
        setIsEditing(true);
        setSelectedId(item.id);
        setFormData({
            trans_no:            item.trans_no      || '',
            trans_date:          item.trans_date     || '',
            vehicle:             item.vehicle        ? String(item.vehicle)      : '',
            vehicle_name:        item.vehicle_name   || '',
            default_driver:      item.default_driver ? String(item.default_driver) : '',
            default_driver_name: item.driver_name    || '',
            actual_km:           item.actual_km      || '',
            service_type:        item.service_type   ? String(item.service_type)   : '',
            cost:                item.cost           || '',
            fuel_liters:         item.fuel_liters    || '',
            attachment:          null,
            attachment_url:      item.attachment_url || '',
            narration:           item.narration      || '',
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Trans Date year length validation
        if (formData.trans_date) {
            const year = parseInt(formData.trans_date.split('-')[0], 10);
            if (year < 1000 || year > 9999) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Invalid Date',
                    text: 'Please enter a valid 4-digit year (e.g. 2026).',
                    confirmButtonText: 'OK'
                });
                return;
            }
        }

        try {
            const fd = new FormData();
            // Only append visible fields (or fields with existing values in edit mode)
            if (isFieldVisible('trans_date') || formData.trans_date) fd.append('trans_date', formData.trans_date);
            if (isFieldVisible('vehicle') || formData.vehicle)       fd.append('vehicle',    formData.vehicle);
            if (formData.default_driver)           fd.append('default_driver', formData.default_driver);
            if (formData.actual_km)                fd.append('actual_km',      formData.actual_km);
            if (formData.service_type)             fd.append('service_type',   formData.service_type);
            if (formData.cost)                     fd.append('cost',           formData.cost);
            if (formData.fuel_liters)              fd.append('fuel_liters',    formData.fuel_liters);
            if (formData.narration)                fd.append('narration',      formData.narration);
            if (formData.attachment instanceof File) fd.append('attachment',  formData.attachment);

            if (isEditing && selectedId) {
                await LogisticsService.updateVehicleHistory(selectedId, fd);
            } else {
                await LogisticsService.createVehicleHistory(fd);
            }

            setShowModal(false);
            setFormData({ ...emptyForm });
            setSelectedId(null);
            await fetchData();
            swal('Success!', `Vehicle history record ${isEditing ? 'updated' : 'created'} successfully!`, 'success');
        } catch (err) {
            const errData = err.response?.data;
            let errorMsg = 'Error saving record.';
            if (errData) {
                if (typeof errData === 'string') errorMsg = errData;
                else if (errData.detail)         errorMsg = errData.detail;
                else if (errData.trans_date)     errorMsg = errData.trans_date[0];
                else if (errData.vehicle)        errorMsg = errData.vehicle[0];
                else                             errorMsg = JSON.stringify(errData);
            }
            swal('Error', errorMsg, 'error');
        }
    };

    // ── Delete handler ─────────────────────────────────────────────────────
    const handleDelete = async (id) => {
        const confirmed = await swal({
            title: 'Delete Record?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            buttons: ['Cancel', 'Delete'],
            dangerMode: true,
        });
        if (!confirmed) return;
        try {
            await LogisticsService.deleteVehicleHistory(id);
            await fetchData();
            swal('Deleted!', 'Record has been removed.', 'success');
        } catch (err) {
            swal('Error', err.response?.data?.detail || 'Could not delete this record.', 'error');
        }
    };

    // ── Export handler ─────────────────────────────────────────────────────
    const handleExport = (format) => {
        const columns = [
            { header: '#',            dataKey: 'index' },
            { header: 'Trans No',     dataKey: 'trans_no' },
            { header: 'Trans Date',   dataKey: 'trans_date' },
            { header: 'Vehicle No',   dataKey: 'vehicle_number_display' },
            { header: 'Vehicle Name', dataKey: 'vehicle_name' },
            { header: 'Driver',       dataKey: 'driver_name',       formatter: (v) => v || '—' },
            { header: 'Actual KM',    dataKey: 'actual_km',         formatter: (v) => v || '—' },
            { header: 'Service Type', dataKey: 'service_type_name', formatter: (v) => v || '—' },
            { header: 'Cost',         dataKey: 'cost',              formatter: (v) => v || '—' },
        ];
        const dataWithIndex = filteredData.map((d, i) => ({ ...d, index: i + 1 }));
        const title = 'Vehicle History';

        if (format === 'pdf')        exportToPDF(dataWithIndex, columns, 'vehicle_history.pdf', title);
        else if (format === 'excel') exportToExcel(dataWithIndex, columns, 'vehicle_history.xlsx');
        else if (format === 'print') printData(dataWithIndex, columns, title);
    };

    const loadNextTransNo = async () => {
    try {

        const res = await LogisticsService.getVehicleHistoryNextNo();

        setFormData(prev => ({
            ...prev,
            trans_no: res.data.trans_no
        }));

    } catch (err) {
        console.error(err);
    }
};

const openAddModal = async () => {

    setIsEditing(false);
    setSelectedId(null);

    setFormData({
        ...emptyForm
    });

    try {

        const res = await LogisticsService.getVehicleHistoryNextNo();

        setFormData({
            ...emptyForm,
            trans_no: res.data.trans_no
        });

    } catch (err) {

        console.error(
            'Failed to load next transaction number',
            err
        );

    }

    setShowModal(true);
};

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="container-fluid">

            {/* ── List ─────────────────────────────────────────────────── */}
            <VehicleHistoryList
                data={filteredData}
                loading={loading}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onExport={handleExport}
                onAdd={can('vehicle_history', 'create') ? openAddModal : undefined}
                can={can}

                vehicles={vehicles}
                serviceTypes={serviceTypes}

                vehicleFilter={vehicleFilter}
                setVehicleFilter={setVehicleFilter}

                serviceTypeFilter={serviceTypeFilter}
                setServiceTypeFilter={setServiceTypeFilter}

                fromDate={fromDate}
                setFromDate={setFromDate}
                toDate={toDate}
                setToDate={setToDate}
            />

            {/* ── Modal ────────────────────────────────────────────────── */}
            <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
                <Modal.Body>
                    <VehicleHistoryForm
                        formData={formData}
                        setFormData={setFormData}
                        onSave={handleSubmit}
                        onCancel={() => setShowModal(false)}
                        isEditing={isEditing}
                        vehicles={vehicles}
                        drivers={drivers}
                        serviceTypes={serviceTypes}
                        onVehicleChange={handleVehicleChange}
                    />
                </Modal.Body>
            </Modal>

        </div>
    );
};

export default VehicleHistoryManagement;