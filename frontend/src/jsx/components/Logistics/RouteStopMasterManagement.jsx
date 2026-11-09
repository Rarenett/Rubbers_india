import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import swal from 'sweetalert';
import { Modal } from 'react-bootstrap';
import { usePermission } from '../../../hooks/usePermission';
import LogisticsService from '../../../services/LogisticsService';
import { AreaService } from '../../../services/AreaService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import RouteStopMasterList from './RouteStopMasterList';
import RouteStopMasterForm from './RouteStopMasterForm';

import { useGoogleMaps } from '../../../context/GoogleMapsProvider';

const RouteStopMasterManagement = ({ currentUser, embedded }) => {
    const navigate = useNavigate();
    const { can } = usePermission();
    
    const { isLoaded } = useGoogleMaps();

    const [managementData, setManagementData] = useState([]);
    const [loading, setLoading]               = useState(false);
    const [showModal, setShowModal]           = useState(false);
    const [isEditing, setIsEditing]           = useState(false);
    const [selectedId, setSelectedId]         = useState(null);
    const [searchTerm, setSearchTerm]         = useState('');
    const [formData, setFormData]             = useState({ 
        stop_name: '', 
        distance_km: 0,
        delivery_location_ids: []
    });
    const [deliveryLocations, setDeliveryLocations] = useState([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [res, dlRes] = await Promise.all([
                LogisticsService.getRouteStopMasters(),
                AreaService.getDeliveryLocations()
            ]);
            setManagementData(Array.isArray(res.data) ? res.data : []);
            setDeliveryLocations(Array.isArray(dlRes.data) ? dlRes.data : Array.isArray(dlRes.data?.results) ? dlRes.data.results : []);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredData = managementData.filter((item) =>
        (item.stop_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleEdit = (item) => {
        setIsEditing(true);
        setSelectedId(item.id);
        setFormData({
            stop_name: item.stop_name || '',
            distance_km: item.distance_km || 0,
            delivery_location_ids: item.assigned_delivery_location_ids || []
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        let payload = { ...formData };
        if (isLoaded) {
            try {
                const geocoder = new window.google.maps.Geocoder();
                const results = await new Promise((resolve, reject) => {
                    geocoder.geocode({ address: formData.stop_name.trim() }, (res, status) => {
                        if (status === 'OK') resolve(res);
                        else reject(status);
                    });
                });
                
                if (results && results.length > 0) {
                    const place = results[0];
                    payload.latitude = place.geometry.location.lat();
                    payload.longitude = place.geometry.location.lng();
                    payload.formatted_address = place.formatted_address;
                    payload.google_place_id = place.place_id;
                }
            } catch (err) {
                console.warn('Google Geocoding failed, trying OSM fallback:', err);
                try {
                    const osmRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.stop_name.trim())}`);
                    const osmData = await osmRes.json();
                    if (osmData && osmData.length > 0) {
                        payload.latitude = parseFloat(osmData[0].lat);
                        payload.longitude = parseFloat(osmData[0].lon);
                        payload.formatted_address = osmData[0].display_name;
                        payload.google_place_id = '';
                    } else {
                        throw new Error("No results found in OSM fallback");
                    }
                } catch (osmErr) {
                    swal(
                        'Location Fetch Failed', 
                        'Automatic geocoding is currently unavailable (Google Maps API restricted and OSM fallback failed). This route stop will be saved without GPS coordinates.', 
                        'warning'
                    );
                }
            }
        }

        if (payload.latitude !== undefined) {
            payload.latitude = Number(parseFloat(payload.latitude).toFixed(6));
        }
        if (payload.longitude !== undefined) {
            payload.longitude = Number(parseFloat(payload.longitude).toFixed(6));
        }

        try {
            if (isEditing && selectedId) {
                await LogisticsService.updateRouteStopMaster(selectedId, payload);
            } else {
                await LogisticsService.createRouteStopMaster(payload);
            }
            setShowModal(false);
            setFormData({ stop_name: '', distance_km: 0, delivery_location_ids: [] });
            setSelectedId(null);
            await fetchData();
            swal(
                'Success!',
                `Route stop ${isEditing ? 'updated' : 'created'} successfully!`,
                'success'
            );
        } catch (err) {
            const errData = err.response?.data;
            let errorMsg = 'Error saving route stop.';
            if (errData) {
                if (typeof errData === 'string')    errorMsg = errData;
                else if (errData.detail)            errorMsg = errData.detail;
                else if (errData.stop_name)         errorMsg = errData.stop_name[0];
                else                                errorMsg = JSON.stringify(errData);
            }
            swal('Error', errorMsg, 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await swal({
            title: 'Delete Route Stop?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            buttons: ['Cancel', 'Delete'],
            dangerMode: true,
        });
        if (!confirmed) return;
        try {
            await LogisticsService.deleteRouteStopMaster(id);
            await fetchData();
            swal('Deleted!', 'Route stop has been removed.', 'success');
        } catch (err) {
            const msg = err.response?.data?.detail || 'Could not delete this route stop.';
            swal('Record In Use', msg, 'error');
        }
    };

    const handleExport = (format) => {
        const columns = [
            { header: '#',            dataKey: 'index' },
            { header: 'Stop Name',    dataKey: 'stop_name' },
            { header: 'Distance (Km)',dataKey: 'distance_km' },
        ];
        const dataWithIndex = filteredData.map((d, i) => ({ ...d, index: i + 1 }));
        const title = 'Route Stops';

        if (format === 'pdf')        exportToPDF(dataWithIndex, columns, 'route_stops.pdf', title);
        else if (format === 'excel') exportToExcel(dataWithIndex, columns, 'route_stops.xlsx');
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
                    <RouteStopMasterList
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
                            setFormData({ stop_name: '', distance_km: 0, delivery_location_ids: [] });
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
                size="md"
                backdrop="static"
                keyboard={false}
            >
                <RouteStopMasterForm
                    formData={formData}
                    setFormData={setFormData}
                    onSave={handleSubmit}
                    onCancel={() => setShowModal(false)}
                    isEditing={isEditing}
                    deliveryLocations={deliveryLocations}
                />
            </Modal>
        </div>
    );
};

export default RouteStopMasterManagement;