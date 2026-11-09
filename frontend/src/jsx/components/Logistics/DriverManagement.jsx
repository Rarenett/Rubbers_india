import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import swal from 'sweetalert';
import Swal from 'sweetalert2';
import { Modal } from 'react-bootstrap';
import { usePermission } from '../../../hooks/usePermission';

import LogisticsService from '../../../services/LogisticsService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';

import DriverList from './DriverList';
import DriverForm from './DriverForm';
import HRManagementService from '../../../services/HRManagementService';

const DriverManagement = ({ currentUser, embedded }) => {
    const navigate = useNavigate();
    const { can } = usePermission();

    const [managementData, setManagementData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [users, setUsers] = useState([]);
    const [formData, setFormData] = useState({
        user: '',
        name: '',
        mobile: '',
        email: '',
        license_number: '',
        license_expiry: '',
        aadhaar_number: '',
        upload_license: '',
        upload_license_preview: '',
        address: '',
        status: 'active'
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await LogisticsService.getDrivers();
            setManagementData(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await HRManagementService.getUsers();
            setUsers(Array.isArray(res) ? res : []);
        } catch (err) {
            console.error(err);
        }
    }, []);

    useEffect(() => {
        fetchData();
        fetchUsers();
    }, [fetchData, fetchUsers]);

    const filteredData = managementData.filter((item) => {
    const term = searchTerm.toLowerCase().trim();

    const statusText = (item.driver_status || '').toLowerCase();

    return (
        (item.name || '').toLowerCase().includes(term) ||
        (item.mobile || '').toLowerCase().includes(term) ||
        (item.email || '').toLowerCase().includes(term) ||
        (item.license_number || '').toLowerCase().includes(term) ||
        (item.license_expiry || '').toLowerCase().includes(term) ||
        (item.aadhaar_number || '').toLowerCase().includes(term) ||
        statusText.includes(term) ||
        String(item.id || '').includes(term)
    );
});

    const handleAdd = () => {
        setIsEditing(false);
        setSelectedId(null);
        setFormData({
            user: '',
            name: '',
            mobile: '',
            email: '',
            license_number: '',
            license_expiry: '',
            aadhaar_number: '',
            upload_license: '',
            upload_license_preview: '',
            address: '',
            status: 'active'
        });
        setShowModal(true);
    };

    const handleEdit = (item) => {
        setIsEditing(true);
        setSelectedId(item.id);
        setFormData({
            user: item.user || '',
            name: item.name || '',
            mobile: item.mobile || '',
            email: item.email || '',
            license_number: item.license_number || '',
            license_expiry: item.license_expiry ? String(item.license_expiry).split('T')[0] : '',
            aadhaar_number: item.aadhaar_number || '',
            upload_license: item.upload_license || '',
            upload_license_preview: item.upload_license || '',
            address: item.address || '',
            status: item.status || 'active'
        });
        setShowModal(true);
    };

    const buildFormData = () => {
        const fd = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') return;
            // Skip file URLs (only upload actual File objects)
            if (key === 'upload_license' && typeof value === 'string') return;
            // Skip frontend-only preview key
            if (key === 'upload_license_preview') return;
            fd.append(key, value);
        });
        return fd;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Indian phone number validation (10 digits, must start with 6/7/8/9)
        const mobile = (formData.mobile || '').replace(/\D/g, '');
        if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
            swal('Invalid Mobile', 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.', 'warning');
            return;
        }

        // License Expiry date validation
        if (formData.license_expiry) {
            const year = parseInt(formData.license_expiry.split('-')[0], 10);
            if (year < 1000 || year > 9999) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Invalid Date',
                    text: 'Please enter a valid 4-digit year (e.g. 2026).',
                    confirmButtonText: 'OK'
                });
                return;
            }
            const selectedDate = new Date(formData.license_expiry);
            const today = new Date();
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            if (selectedDate < todayStart) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Invalid Date',
                    text: 'License expiration date cannot be in the past.',
                    confirmButtonText: 'OK'
                });
                return;
            }
        }

        try {
            const payload = buildFormData();
            if (isEditing) {
                await LogisticsService.updateDriver(selectedId, payload);
            } else {
                await LogisticsService.createDriver(payload);
            }
            setShowModal(false);
            setFormData({
                user: '',
                name: '',
                mobile: '',
                email: '',
                license_number: '',
                license_expiry: '',
                aadhaar_number: '',
                upload_license: '',
                upload_license_preview: '',
                address: '',
                status: 'active'
            });
            setSelectedId(null);
            await fetchData();
            swal('Success', `Driver ${isEditing ? 'updated' : 'created'} successfully`, 'success');
        } catch (err) {
            swal('Error', 'Failed to save driver', 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await swal({
            title: 'Delete Driver?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            buttons: ['Cancel', 'Delete'],
            dangerMode: true,
        });
        if (!confirmed) return;
        try {
            await LogisticsService.deleteDriver(id);
            await fetchData();
            swal('Deleted', 'Driver deleted successfully', 'success');
        } catch (err) {
            swal('Record In Use', err.response?.data?.detail || 'Unable to delete this record because it is being used elsewhere in the system.', 'error');
        }
    };

    const handleExport = (format) => {
        const columns = [
            { header: '#',             dataKey: 'index' },
            { header: 'Name',          dataKey: 'name' },
            { header: 'Mobile',        dataKey: 'mobile' },
            { header: 'License',       dataKey: 'license_number' },
            { header: 'Status',        dataKey: 'driver_status' },
        ];
        const dataWithIndex = filteredData.map((item, index) => ({ ...item, index: index + 1 }));

        if (format === 'pdf')        exportToPDF(dataWithIndex, columns, 'drivers.pdf', 'Drivers');
        else if (format === 'excel') exportToExcel(dataWithIndex, columns, 'drivers.xlsx');
        else if (format === 'print') printData(dataWithIndex, columns, 'Drivers');
    };

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-lg-12">
                    <DriverList
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
            <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg" dialogClassName="scfm-modal-dialog" contentClassName="border-0 bg-transparent">
                <Modal.Body className="p-0 bg-white" style={{ borderRadius: '16px' }}>
                    <DriverForm
                        formData={formData}
                        setFormData={setFormData}
                        onSave={handleSubmit}
                        onCancel={() => setShowModal(false)}
                        isEditing={isEditing}
                        users={users.filter((u) => {
                            if (u.designation?.title?.toLowerCase() !== 'driver') return false;
                            // Get user IDs already assigned as drivers
                            const assignedUserIds = managementData
                                .filter((d) => d.user)
                                .map((d) => Number(d.user));
                            // If editing, keep the current driver's user in the list
                            if (isEditing && formData.user && Number(u.id) === Number(formData.user)) {
                                return true;
                            }
                            // Exclude users already assigned as drivers
                            return !assignedUserIds.includes(Number(u.id));
                        })}
                    />
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default DriverManagement;