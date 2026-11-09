import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import swal from 'sweetalert';
import { Modal } from 'react-bootstrap';
import { usePermission } from '../../../hooks/usePermission';
import SalesService from '../../../services/SalesService';
import LogisticsService from '../../../services/LogisticsService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import DeliveryLocationList from './DeliveryLocationList';
import DeliveryLocationForm from './DeliveryLocationForm';

const DeliveryLocationManagement = ({ currentUser, embedded }) => {
    const navigate = useNavigate();
    const { can } = usePermission();

    const [managementData, setManagementData] = useState([]);
    const [ledgers, setLedgers]               = useState([]);
    const [stops, setStops]                   = useState([]);
    
    const [loading, setLoading]               = useState(false);
    const [showModal, setShowModal]           = useState(false);
    const [isEditing, setIsEditing]           = useState(false);
    const [selectedId, setSelectedId]         = useState(null);
    const [searchTerm, setSearchTerm]         = useState('');
    const [formData, setFormData]             = useState({ 
        delivery_location: [], 
        customer: ''
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch delivery locations
            const res = await SalesService.getDeliveryLocations();
            setManagementData(Array.isArray(res.data) ? res.data : []);
            
            // Fetch ledgers for customer dropdown
            const ledgersRes = await SalesService.getLedgers();
            if (ledgersRes.data && ledgersRes.data.results) {
                // Usually ledger responses have .results
                setLedgers(ledgersRes.data.results);
            } else if (Array.isArray(ledgersRes.data)) {
                setLedgers(ledgersRes.data);
            }

            // Fetch Route stops for location dropdown
            const stopsRes = await LogisticsService.getRouteStopMasters();
            if (Array.isArray(stopsRes.data)) {
                setStops(stopsRes.data);
            }
        } catch (err) {
            console.error('Error fetching delivery locations data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const groupedData = Object.values(
        managementData.reduce((acc, item) => {
            const term = searchTerm.toLowerCase();
            const locName = (item.location_name || '').toLowerCase();
            const custName = (item.customer_name || '').toLowerCase();
            
            if (locName.includes(term) || custName.includes(term)) {
                const customerId = item.customer && typeof item.customer === 'object' ? item.customer.id : item.customer;
                if (!acc[customerId]) {
                    acc[customerId] = {
                        id: customerId, // Use customer ID as the group ID
                        customer: item.customer,
                        customer_name: item.customer_name,
                        locations: [],
                        original_mappings: []
                    };
                }
                acc[customerId].locations.push(item.location_name);
                acc[customerId].original_mappings.push(item);
            }
            return acc;
        }, {})
    );

    const handleEdit = (groupedItem) => {
        setIsEditing(true);
        setSelectedId(groupedItem.id); // customer ID
        setFormData({
            delivery_location: groupedItem.original_mappings.map(m => String(m.delivery_location)),
            customer: groupedItem.id
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing && selectedId) {
                const originalMappings = managementData.filter(m => {
                    const cid = m.customer && typeof m.customer === 'object' ? m.customer.id : m.customer;
                    return String(cid) === String(selectedId);
                });
                
                const newLocationIds = formData.delivery_location.map(id => String(id));
                const originalLocationIds = originalMappings.map(m => String(m.delivery_location));
                
                const toDelete = originalMappings.filter(m => !newLocationIds.includes(String(m.delivery_location)));
                const toCreate = newLocationIds.filter(id => !originalLocationIds.includes(id));
                
                // Delete removed mappings
                for (let mapping of toDelete) {
                    await SalesService.deleteDeliveryLocation(mapping.id);
                }
                
                // Create new mappings
                for (let locId of toCreate) {
                    await SalesService.createDeliveryLocation({
                        customer: selectedId,
                        delivery_location: locId
                    });
                }
            } else {
                if (Array.isArray(formData.delivery_location)) {
                    for (const locId of formData.delivery_location) {
                        await SalesService.createDeliveryLocation({
                            customer: formData.customer,
                            delivery_location: locId
                        });
                    }
                } else {
                    await SalesService.createDeliveryLocation(formData);
                }
            }
            setShowModal(false);
            setFormData({ delivery_location: [], customer: '' });
            setSelectedId(null);
            await fetchData();
            swal(
                'Success!',
                `Delivery location ${isEditing ? 'updated' : 'created'} successfully!`,
                'success'
            );
        } catch (err) {
            const errData = err.response?.data;
            let errorMsg = 'Error saving delivery location.';
            if (errData) {
                if (typeof errData === 'string')    errorMsg = errData;
                else if (errData.detail)            errorMsg = errData.detail;
                else                                errorMsg = JSON.stringify(errData);
            }
            swal('Error', errorMsg, 'error');
        }
    };

    const handleDelete = async (customerId) => {
        const confirmed = await swal({
            title: 'Delete Delivery Location?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            buttons: ['Cancel', 'Delete'],
            dangerMode: true,
        });
        if (!confirmed) return;
        try {
            const originalMappings = managementData.filter(m => {
                const cid = m.customer && typeof m.customer === 'object' ? m.customer.id : m.customer;
                return String(cid) === String(customerId);
            });
            for (let mapping of originalMappings) {
                await SalesService.deleteDeliveryLocation(mapping.id);
            }
            await fetchData();
            swal('Deleted!', 'Delivery locations have been removed.', 'success');
        } catch (err) {
            const msg = err.response?.data?.detail || 'Could not delete this delivery location.';
            swal('Error', msg, 'error');
        }
    };

    const handleExport = (format) => {
        const columns = [
            { header: '#',            dataKey: 'index' },
            { header: 'Customer',     dataKey: 'customer_name' },
            { header: 'Locations',    dataKey: 'location_name' },
        ];
        const dataWithIndex = groupedData.map((d, i) => ({ ...d, index: i + 1, location_name: d.locations.join(', ') }));
        const title = 'Delivery Locations';

        if (format === 'pdf')        exportToPDF(dataWithIndex, columns, 'delivery_locations.pdf', title);
        else if (format === 'excel') exportToExcel(dataWithIndex, columns, 'delivery_locations.xlsx');
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
                    <DeliveryLocationList
                        data={groupedData}
                        loading={loading}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onExport={handleExport}
                        onAdd={() => {
                            setIsEditing(false);
                            setSelectedId(null);
                            setFormData({ delivery_location: [], customer: '' });
                            setShowModal(true);
                        }}
                        currentUser={currentUser}
                        can={can}
                        ledgers={ledgers}
                    />
                </div>
            </div>

            <Modal 
                show={showModal} 
                onHide={() => setShowModal(false)} 
                dialogClassName="pkg-custom-modal"
                centered 
                size="md"
                backdrop="static"
                keyboard={false}
            >
                <DeliveryLocationForm
                    formData={formData}
                    setFormData={setFormData}
                    onSave={handleSubmit}
                    onCancel={() => setShowModal(false)}
                    isEditing={isEditing}
                    ledgers={ledgers}
                    stops={stops}
                    existingMappings={managementData}
                />
            </Modal>
        </div>
    );
};

export default DeliveryLocationManagement;