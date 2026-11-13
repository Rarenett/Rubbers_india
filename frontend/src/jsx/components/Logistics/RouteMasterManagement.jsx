import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { Card, Form, Button } from 'react-bootstrap';
import swal from 'sweetalert';
import LogisticsService from '../../../services/LogisticsService';
import PageTitle from '../../layouts/PageTitle';
import { usePermission } from '../../../hooks/usePermission';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';
import { useContext } from 'react';
import { ThemeContext } from '../../../context/ThemeContext';



const defaultCenter = {
    lat: 10.0242,
    lng: 76.3155
};

import { useGoogleMaps } from '../../../context/GoogleMapsProvider';

const RouteMasterManagement = () => {
    const { isLoaded, loadError } = useGoogleMaps();
    const { saveBtnColor, cancelBtnColor, customPrimaryColor } = useContext(ThemeContext) || {};
    
    const { can } = usePermission();

    const [isFormView, setIsFormView] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(true);

    const [routeName, setRouteName] = useState('');
    const [startPoint, setStartPoint] = useState('');
    const [startLatLng, setStartLatLng] = useState(null);
    const [endPoint, setEndPoint] = useState('');
    const [endLatLng, setEndLatLng] = useState(null);
    const [distance, setDistance] = useState('');
    const [directionsResponse, setDirectionsResponse] = useState(null);
    const [activeInput, setActiveInput] = useState('start'); // 'start' or 'end'
    const [editId, setEditId] = useState(null);

    const geocoderRef = useRef(null);
    const directionsServiceRef = useRef(null);

    useEffect(() => {
        fetchRoutes();
    }, []);

    const fetchRoutes = async () => {
        try {
            const res = await LogisticsService.getRouteMasters();
            setRoutes(res.data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching routes:', error);
            setLoading(false);
        }
    };

    const handleMapClick = useCallback((e) => {
        if (!isLoaded) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        if (!geocoderRef.current) {
            geocoderRef.current = new window.google.maps.Geocoder();
        }

        geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
            let placeName = `Unknown Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
            if (status === 'OK' && results[0]) {
                const locality = results[0].address_components.find(c => c.types.includes('locality'));
                const sublocality = results[0].address_components.find(c => c.types.includes('sublocality'));
                if (locality) {
                    placeName = locality.long_name;
                } else if (sublocality) {
                    placeName = sublocality.long_name;
                } else {
                    placeName = results[0].formatted_address.split(',')[0];
                }
            }

            if (activeInput === 'start') {
                setStartPoint(placeName);
                setStartLatLng({ lat, lng });
                setActiveInput('end');
            } else {
                setEndPoint(placeName);
                setEndLatLng({ lat, lng });
                setActiveInput('start');
            }
        });
    }, [isLoaded, activeInput]);

    useEffect(() => {
        if (!isLoaded || !startLatLng || !endLatLng) {
            if (!startLatLng || !endLatLng) {
                setDirectionsResponse(null);
                setDistance('');
            }
            return;
        }

        if (!directionsServiceRef.current) {
            directionsServiceRef.current = new window.google.maps.DirectionsService();
        }

        directionsServiceRef.current.route(
            {
                origin: startLatLng,
                destination: endLatLng,
                travelMode: window.google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
                if (status === window.google.maps.DirectionsStatus.OK) {
                    setDirectionsResponse(result);
                    const distText = result.routes[0].legs[0].distance.text;
                    const distVal = distText.replace(/[^\d.]/g, '');
                    setDistance(distVal);
                } else {
                    console.error('Directions request failed due to ' + status);
                    setDirectionsResponse(null);
                    setDistance('');
                }
            }
        );
    }, [startLatLng, endLatLng, isLoaded]);

    const resetForm = () => {
        setRouteName('');
        setStartPoint('');
        setEndPoint('');
        setStartLatLng(null);
        setEndLatLng(null);
        setDistance('');
        setDirectionsResponse(null);
        setActiveInput('start');
        setEditId(null);
        setIsFormView(false);
    };

    const handleSubmit = async () => {
        if (!routeName.trim() || !startPoint || !endPoint || !distance) {
            swal('Error', 'Please fill all required fields and select points on the map.', 'error');
            return;
        }

        const payload = {
            route_name: routeName,
            start_point: startPoint,
            end_point: endPoint,
            total_distance: parseFloat(distance),
            start_lat: startLatLng?.lat || null,
            start_lng: startLatLng?.lng || null,
            end_lat: endLatLng?.lat || null,
            end_lng: endLatLng?.lng || null,
        };

        try {
            if (editId) {
                await LogisticsService.patchRouteMaster(editId, payload);
                swal('Success', 'Route updated successfully', 'success');
            } else {
                await LogisticsService.createRouteMaster(payload);
                swal('Success', 'Route created successfully', 'success');
            }
            resetForm();
            fetchRoutes();
        } catch (error) {
            console.error('Error saving route:', error);
            swal('Error', 'Failed to save route', 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirm = await swal({
            title: "Are you sure?",
            text: "Once deleted, you will not be able to recover this route!",
            icon: "warning",
            buttons: true,
            dangerMode: true,
        });

        if (confirm) {
            try {
                await LogisticsService.deleteRouteMaster(id);
                swal("Poof! Your route has been deleted!", { icon: "success" });
                fetchRoutes();
            } catch (error) {
                swal("Error deleting route", { icon: "error" });
            }
        }
    };

    const handleEdit = (route) => {
        setEditId(route.id);
        setRouteName(route.route_name || '');
        setStartPoint(route.start_point || '');
        setEndPoint(route.end_point || '');
        setDistance(route.total_distance?.toString() || '');
        setStartLatLng({ lat: route.start_lat, lng: route.start_lng });
        setEndLatLng({ lat: route.end_lat, lng: route.end_lng });
        setIsFormView(true);
    };

    const filteredRoutes = routes.filter(r => 
        r.route_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.start_point?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.end_point?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, routes.length]);

    const totalPages = Math.ceil(filteredRoutes.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredRoutes.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <>
            <PageTitle activeMenu="Routes" motherMenu="Logistics" />
            
            <style>{`
                .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #475569;
                    margin-bottom: 6px;
                }
                .form-control-custom {
                    font-size: 13px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                    padding: 8px 12px;
                    transition: all 0.2s;
                }
                .form-control-custom:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                .input-group-custom {
                    position: relative;
                    display: flex;
                    flex-wrap: wrap;
                    align-items: stretch;
                    width: 100%;
                }
                .input-group-custom .form-control-custom {
                    border-top-right-radius: 0;
                    border-bottom-right-radius: 0;
                }
                .input-group-custom .btn-addon {
                    border-top-left-radius: 0;
                    border-bottom-left-radius: 0;
                    background: #f8f9fa;
                    border: 1px solid #e2e8f0;
                    border-left: 0;
                    padding: 8px 12px;
                    cursor: pointer;
                }
                .input-group-custom .btn-addon:hover {
                    background: #e2e8f0;
                }
                .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    border-color: var(--cancel-btn-color, #dc3545) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    border-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                .btn-add-icon {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border: none !important;
                    border-radius: 6px !important;
                    width: 36px !important;
                    height: 36px !important;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background-color 0.2s;
                }
                .btn-add-icon:hover { background-color: var(--save-btn-color, #073d0b) !important; opacity: 0.9; }
            `}</style>

            <div className="container-fluid">
            {!isFormView ? (
                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center">
                                <Card.Title className="mb-0">Route Master Management</Card.Title>
                                <div className="d-flex align-items-center gap-2">
                                    <div style={{ width: '300px', position: 'relative' }}>
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search Route..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            style={{ height: '35px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>
                                    <CreateButton module="route_master" onClick={() => setIsFormView(true)}>
                                        Route
                                    </CreateButton>
                                </div>
                            </Card.Header>
                            <Card.Body>
                                {loading ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="table-responsive">
                                        <table className="table table-responsive-md">
                                            <thead>
                                                <tr>
                                                    <th><strong>SI NO</strong></th>
                                                    <th><strong>ROUTE NAME</strong></th>
                                                    <th><strong>START POINT</strong></th>
                                                    <th><strong>END POINT</strong></th>
                                                    <th><strong>DISTANCE</strong></th>
                                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredRoutes.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="6" className="text-center py-4 text-muted">No routes found.</td>
                                                    </tr>
                                                ) : (
                                                    currentItems.map((r, idx) => (
                                                        <tr key={r.id}>
                                                            <td><strong>{indexOfFirstItem + idx + 1}</strong></td>
                                                            <td>{r.route_name}</td>
                                                            <td>
                                                                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#40c057', marginRight: '6px' }}></span>
                                                                {r.start_point}
                                                            </td>
                                                            <td>
                                                                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ff6b6b', marginRight: '6px' }}></span>
                                                                {r.end_point}
                                                            </td>
                                                            <td><strong>{r.total_distance} km</strong></td>
                                                            <td className="text-end">
                                                                {can('routes', 'edit') || can('routes', 'delete') ? (
                                                                    <div className="d-flex justify-content-end gap-2">
                                                                        <EditButton
                                                                            module="route_master"
                                                                            onClick={() => handleEdit(r)}
                                                                        />
                                                                        <DeleteButton
                                                                            module="route_master"
                                                                            onClick={() => handleDelete(r.id)}
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <span className="badge badge-danger light mt-1">No Access</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                        </div>
                                        {filteredRoutes.length > 0 && (
                                            <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-3">
                                                <div className="text-muted" style={{ fontSize: '13px' }}>
                                                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredRoutes.length)} of {filteredRoutes.length} entries
                                                </div>
                                                {totalPages > 1 && (
                                                    <nav>
                                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                            <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                                    <i className="la la-angle-left" />
                                                                </button>
                                                            </li>
                                                            {Array.from({ length: totalPages }, (_, index) => {
                                                                const pageNumber = index + 1;
                                                                if (
                                                                    pageNumber === 1 ||
                                                                    pageNumber === totalPages ||
                                                                    (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                                                ) {
                                                                    return (
                                                                        <li key={pageNumber} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}>
                                                                            <button type="button" className="page-link" onClick={() => setCurrentPage(pageNumber)} style={{ border: 'none' }}>
                                                                                {pageNumber}
                                                                            </button>
                                                                        </li>
                                                                    );
                                                                } else if (
                                                                    pageNumber === currentPage - 2 ||
                                                                    pageNumber === currentPage + 2
                                                                ) {
                                                                    return (
                                                                        <li key={pageNumber} className="page-item disabled">
                                                                            <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                                        </li>
                                                                    );
                                                                }
                                                                return null;
                                                            })}
                                                            <li className={`page-item page-indicator ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}`}>
                                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} style={{ border: 'none', background: 'none' }}>
                                                                    <i className="la la-angle-right" />
                                                                </button>
                                                            </li>
                                                        </ul>
                                                    </nav>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </Card.Body>
                        </Card>
                    </div>
                </div>
            ) : (
                <>
                    <div className="page-titles">
                        <button 
                            onClick={() => setIsFormView(false)} 
                            className="btn btn-sm d-flex align-items-center"
                            style={{ 
                                gap: '6px', 
                                borderRadius: '6px', 
                                color: cancelBtnColor || 'var(--cancel-btn-color, #dc3545)', 
                                borderColor: cancelBtnColor || 'var(--cancel-btn-color, #dc3545)',
                                backgroundColor: 'transparent'
                            }}
                        >
                            <i className="fa fa-arrow-left"></i> Back
                        </button>
                    </div>

                    <div className="row">
                        <div className="col-lg-12">
                            <Card>
                                <Card.Header>
                                    <Card.Title className="mb-0">{editId ? 'Edit Route Master' : 'Create Route Master'}</Card.Title>
                                </Card.Header>
                                <Card.Body>
                                    <div className="row">
                                        <div className="col-lg-5 col-md-6">
                                            <div className="mb-3">
                                                <Form.Label className="form-label-custom">Route Name <span className="text-danger">*</span></Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    className="form-control-custom"
                                                    value={routeName}
                                                    onChange={(e) => setRouteName(e.target.value)}
                                                    placeholder="e.g. Kothamangalam - Alappuzha"
                                                />
                                            </div>

                                            <div className="mb-3">
                                                <Form.Label className="form-label-custom">Starting Point <span className="text-success">(Green)</span> <span className="text-danger">*</span></Form.Label>
                                                <div className="input-group-custom">
                                                    <Form.Control
                                                        type="text"
                                                        className="form-control-custom"
                                                        value={startPoint}
                                                        onChange={(e) => setStartPoint(e.target.value)}
                                                        onClick={() => setActiveInput('start')}
                                                        style={{ flex: 1, borderColor: activeInput === 'start' ? '#3b5bdb' : '#e2e8f0' }}
                                                        placeholder="Click map to select..."
                                                    />
                                                    <div 
                                                        className="btn-addon" 
                                                        onClick={() => setActiveInput('start')}
                                                    >
                                                        <i className="fa fa-search text-muted"></i>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <Form.Label className="form-label-custom">Ending Point <span className="text-danger">(Red)</span> <span className="text-danger">*</span></Form.Label>
                                                <div className="input-group-custom">
                                                    <Form.Control
                                                        type="text"
                                                        className="form-control-custom"
                                                        value={endPoint}
                                                        onChange={(e) => setEndPoint(e.target.value)}
                                                        onClick={() => setActiveInput('end')}
                                                        style={{ flex: 1, borderColor: activeInput === 'end' ? '#ff6b6b' : '#e2e8f0' }}
                                                        placeholder="Click map to select..."
                                                    />
                                                    <div 
                                                        className="btn-addon" 
                                                        onClick={() => setActiveInput('end')}
                                                    >
                                                        <i className="fa fa-search text-muted"></i>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <Form.Label className="form-label-custom">Total Distance (km) <span className="text-danger">*</span></Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    className="form-control-custom bg-light"
                                                    value={distance}
                                                    onChange={(e) => setDistance(e.target.value)}
                                                    placeholder="Autofilled"
                                                />
                                            </div>

                                            <div className="d-flex gap-2 mt-4 pt-3" style={{ borderTop: '1px solid #f1f5f9' }}>
                                                <button 
                                                    type="button" 
                                                    className="btn-close-custom btn-universal-close" 
                                                    style={{ 
                                                        backgroundColor: cancelBtnColor || 'var(--cancel-btn-color, #dc3545)', 
                                                        borderColor: cancelBtnColor || 'var(--cancel-btn-color, #dc3545)', 
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        fontWeight: 500,
                                                        fontSize: '14px',
                                                        padding: '10px 24px',
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => setIsFormView(false)}
                                                >
                                                    Close
                                                </button>
                                                <button 
                                                    type="button" 
                                                    className="btn-save-custom btn-universal-save" 
                                                    style={{ 
                                                        backgroundColor: saveBtnColor || 'var(--save-btn-color, #0a500f)', 
                                                        borderColor: saveBtnColor || 'var(--save-btn-color, #0a500f)', 
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        fontWeight: 500,
                                                        fontSize: '14px',
                                                        padding: '10px 24px',
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={handleSubmit}
                                                >
                                                    Save & Next
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="col-lg-7 col-md-6">
                                            <Form.Label className="form-label-custom">
                                                Route Map <span className="ms-2 badge bg-light text-dark border">Mode: Set {activeInput === 'start' ? 'Start' : 'End'} Point</span>
                                            </Form.Label>
                                            <div className="border rounded overflow-hidden" style={{ height: 'calc(100% - 28px)', minHeight: '450px' }}>
                                                {loadError && <div>Error loading maps</div>}
                                                {!isLoaded && <div>Loading Maps...</div>}
                                                {isLoaded && (
                                                    <GoogleMap
                                                        mapContainerStyle={{ width: '100%', height: '100%' }}
                                                        center={startLatLng || defaultCenter}
                                                        zoom={8}
                                                        onClick={handleMapClick}
                                                        options={{ streetViewControl: false, mapTypeControl: false }}
                                                    >
                                                        {!directionsResponse && startLatLng && (
                                                            <Marker position={startLatLng} icon={"http://maps.google.com/mapfiles/ms/icons/green-dot.png"} />
                                                        )}
                                                        {!directionsResponse && endLatLng && (
                                                            <Marker position={endLatLng} icon={"http://maps.google.com/mapfiles/ms/icons/red-dot.png"} />
                                                        )}
                                                        {directionsResponse && (
                                                            <DirectionsRenderer 
                                                                directions={directionsResponse} 
                                                                options={{
                                                                    polylineOptions: {
                                                                        strokeColor: '#3b5bdb',
                                                                        strokeWeight: 4,
                                                                        strokeOpacity: 0.8
                                                                    }
                                                                }}
                                                            />
                                                        )}
                                                    </GoogleMap>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </div>
                    </div>
                </>
            )}
            </div>
        </>
    );
};

export default RouteMasterManagement;
