import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import swal from 'sweetalert';
import { Modal } from 'react-bootstrap';
import { usePermission } from '../../../hooks/usePermission';
import LogisticsService from '../../../services/LogisticsService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import PackageTypeList from './PackageTypeList';
import PackageTypeForm from './PackageTypeForm';
import { usePageTitle } from '../../../context/TitleContext';


const PackageTypeManagement = ({ currentUser, embedded }) => {
    usePageTitle('Package Dimensions');
    const navigate = useNavigate();
    const { can } = usePermission();

    const [managementData, setManagementData] = useState([]);
    const [loading, setLoading]               = useState(false);
    const [showModal, setShowModal]           = useState(false);
    const [isEditing, setIsEditing]           = useState(false);
    const [selectedId, setSelectedId]         = useState(null);
    const [searchTerm, setSearchTerm]         = useState('');
    const [formData, setFormData]             = useState({ 
        pack_name: '', 
        length: 0, 
        width: 0, 
        height: 0, 
        weight: 0, 
        volume: 0, 
        narration: '' 
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await LogisticsService.getPackageTypes();
            setManagementData(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching package types:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredData = managementData.filter((item) =>
        (item.pack_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.pack_id || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleEdit = (item) => {
        setIsEditing(true);
        setSelectedId(item.id);
        setFormData({
            pack_name: item.pack_name || '',
            length: item.length || 0,
            width: item.width || 0,
            height: item.height || 0,
            weight: item.weight || 0,
            volume: item.volume || 0,
            narration: item.narration || ''
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing && selectedId) {
                await LogisticsService.putPackageType(selectedId, formData);
            } else {
                await LogisticsService.createPackageType(formData);
            }
            setShowModal(false);
            setFormData({ pack_name: '', length: 0, width: 0, height: 0, weight: 0, volume: 0, narration: '' });
            setSelectedId(null);
            await fetchData();
            swal(
                'Success!',
                `Package type ${isEditing ? 'updated' : 'created'} successfully!`,
                'success'
            );
        } catch (err) {
            const errData = err.response?.data;
            let errorMsg = 'Error saving package type.';
            if (errData) {
                if (typeof errData === 'string')    errorMsg = errData;
                else if (errData.detail)            errorMsg = errData.detail;
                else if (errData.pack_name)         errorMsg = errData.pack_name[0];
                else                                errorMsg = JSON.stringify(errData);
            }
            swal('Error', errorMsg, 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await swal({
            title: 'Delete Package Type?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            buttons: ['Cancel', 'Delete'],
            dangerMode: true,
        });
        if (!confirmed) return;
        try {
            await LogisticsService.deletePackageType(id);
            await fetchData();
            swal('Deleted!', 'Package type has been removed.', 'success');
        } catch (err) {
            const msg = err.response?.data?.detail || 'Could not delete this package type.';
            swal('Record In Use', msg, 'error');
        }
    };

    const handleExport = (format) => {
        const columns = [
            { header: '#',            dataKey: 'index' },
            { header: 'PackID',       dataKey: 'pack_id' },
            { header: 'Name',         dataKey: 'pack_name' },
            { header: 'Length',       dataKey: 'length' },
            { header: 'Width',        dataKey: 'width' },
            { header: 'Height',       dataKey: 'height' },
            { header: 'Weight',       dataKey: 'weight' },
            { header: 'Volume',       dataKey: 'volume' },
            { header: 'Narration',    dataKey: 'narration', formatter: (v) => v || '—' },
        ];
        const dataWithIndex = filteredData.map((d, i) => ({ ...d, index: i + 1 }));
        const title = 'Package Dimensions';

        if (format === 'pdf')        exportToPDF(dataWithIndex, columns, 'package_dimensions.pdf', title);
        else if (format === 'excel') exportToExcel(dataWithIndex, columns, 'package_dimensions.xlsx');
        else if (format === 'print') printData(dataWithIndex, columns, title);
    };

    return (
        <div className="container-fluid">
            <div className="page-titles">
                <button
                    onClick={() => window.history.back()}
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>
            
            <div className="row">
                <div className="col-lg-12">
                    <PackageTypeList
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
                            setFormData({ pack_name: '', length: 0, width: 0, height: 0, weight: 0, volume: 0, narration: '' });
                            setShowModal(true);
                        }}
                        currentUser={currentUser}
                        can={can}
                    />
                </div>
            </div>

            <Modal 
                show={showModal} 
                onHide={() => setShowModal(false)} 
                dialogClassName="pkg-custom-modal"
                centered 
                size="lg"
                backdrop="static"
                keyboard={false}
            >
                <PackageTypeForm
                    formData={formData}
                    setFormData={setFormData}
                    onSave={handleSubmit}
                    onCancel={() => setShowModal(false)}
                    isEditing={isEditing}
                />
            </Modal>
        </div>
    );
};

export default PackageTypeManagement;
