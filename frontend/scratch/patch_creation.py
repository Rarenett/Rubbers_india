import os
import re

jsx_path = r'c:\Archana\glenda_vite\frontend\src\jsx\components\CommonMaster\AreaCreation.jsx'

content = """
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { navtoggle } from '../../../store/actions/AuthActions';
import swal from 'sweetalert';
import { Card, Button, Form, Modal } from 'react-bootstrap';
import { AreaService } from '../../../services/AreaService';
import { usePageTitle } from '../../../context/TitleContext';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import { useJsApiLoader, GoogleMap, Circle, Marker, Autocomplete, DrawingManager, Polygon, HeatmapLayer } from '@react-google-maps/api';
import axios from 'axios';

const libraries = ['places', 'geometry', 'drawing', 'visualization'];

const AreaCreation = () => {
    usePageTitle("Area Creation");
    
    const dispatch = useDispatch();
    const sideMenu = useSelector(state => state.sideMenu);
    const sideMenuRef = useRef(sideMenu);
    const prevWidthRef = useRef(window.innerWidth);
    
    useEffect(() => {
        sideMenuRef.current = sideMenu;
    }, [sideMenu]);

    useEffect(() => {
        const handleResize = () => {
            const currentWidth = window.innerWidth;
            if (prevWidthRef.current > 1199 && currentWidth <= 1199) {
                if (sideMenuRef.current) {
                    dispatch(navtoggle());
                }
            }
            prevWidthRef.current = currentWidth;
        };
        if (window.innerWidth <= 1199 && sideMenuRef.current) {
            dispatch(navtoggle());
        }
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [dispatch]);
    
    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        libraries,
    });
    
    const [areas, setAreas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [areaName, setAreaName] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [currentAreaId, setCurrentAreaId] = useState(null);
    const [status, setStatus] = useState('Active');
    const [currentPage, setCurrentPage] = useState(1);
    const [createdGeofenceData, setCreatedGeofenceData] = useState(null);
    const itemsPerPage = 10;

    // Manual Map Location States
    const [showMapModal, setShowMapModal] = useState(false);
    const [manualLocationData, setManualLocationData] = useState(null);
    const [tempMapCenter, setTempMapCenter] = useState({ lat: 10.0889, lng: 76.8837 });
    const [tempMapRadius, setTempMapRadius] = useState(5000);
    const [tempMapAddress, setTempMapAddress] = useState('');
    const [tempMapPlaceId, setTempMapPlaceId] = useState('');
    const [autocomplete, setAutocomplete] = useState(null);
    
    const [geofenceType, setGeofenceType] = useState('circle');
    const [polygonPath, setPolygonPath] = useState([]);
    const polygonRef = useRef(null);
    
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [heatmapData, setHeatmapData] = useState([]);
    
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [geofenceHistory, setGeofenceHistory] = useState([]);
    const [activeHistoryAreaId, setActiveHistoryAreaId] = useState(null);

    const fetchAreas = useCallback(async () => {
        setLoading(true);
        try {
            const res = await AreaService.getAreas();
            let rawData = res.results ?? res;
            setAreas(Array.isArray(rawData) ? rawData : []);
        } catch (err) {
            console.error('Error fetching areas:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAreas();
    }, [fetchAreas]);

    useEffect(() => {
        if (showHeatmap && isLoaded && heatmapData.length === 0) {
            fetchHeatmapData();
        }
    }, [showHeatmap, isLoaded]);

    const fetchHeatmapData = async () => {
        try {
            const token = JSON.parse(localStorage.getItem('userDetails'))?.token;
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/delivery-location-coordinates/`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const pts = res.data.map(c => new window.google.maps.LatLng(c.latitude, c.longitude));
            setHeatmapData(pts);
        } catch (e) {
            console.error("Heatmap fetch error:", e);
        }
    };

    const onLoadAutocomplete = (ac) => { setAutocomplete(ac); };
    const onPlaceChanged = () => {
        if (autocomplete) {
            const place = autocomplete.getPlace();
            if (place.geometry) {
                setTempMapCenter({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
                setTempMapAddress(place.formatted_address);
                setTempMapPlaceId(place.place_id);
            }
        }
    };

    const handleMapClick = (e) => {
        if (geofenceType === 'circle') {
            setTempMapCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat: e.latLng.lat(), lng: e.latLng.lng() } }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    setTempMapAddress(results[0].formatted_address);
                    setTempMapPlaceId(results[0].place_id);
                } else {
                    setTempMapAddress(`${e.latLng.lat().toFixed(4)}, ${e.latLng.lng().toFixed(4)}`);
                    setTempMapPlaceId('');
                }
            });
        }
    };

    const onPolygonComplete = (poly) => {
        const path = poly.getPath();
        const coords = [];
        for (let i = 0; i < path.getLength(); i++) {
            coords.push({ lat: path.getAt(i).lat(), lng: path.getAt(i).lng() });
        }
        setPolygonPath(coords);
        poly.setMap(null); // remove the drawn shape to replace with our controlled Polygon
    };

    const onEditPolygon = useCallback(() => {
        if (polygonRef.current) {
            const path = polygonRef.current.getPath();
            const coords = [];
            for (let i = 0; i < path.getLength(); i++) {
                coords.push({ lat: path.getAt(i).lat(), lng: path.getAt(i).lng() });
            }
            setPolygonPath(coords);
        }
    }, []);

    const clearPolygon = () => {
        setPolygonPath([]);
    };

    const saveManualLocation = () => {
        if (geofenceType === 'polygon' && polygonPath.length < 3) {
            swal('Invalid', 'A polygon must have at least 3 points.', 'warning');
            return;
        }
        setManualLocationData({
            latitude: tempMapCenter.lat,
            longitude: tempMapCenter.lng,
            geofence_radius: tempMapRadius,
            formatted_address: tempMapAddress,
            google_place_id: tempMapPlaceId,
            geofence_type: geofenceType,
            polygon_coordinates: geofenceType === 'polygon' ? polygonPath : null
        });
        setShowMapModal(false);
    };

    const resetForm = () => {
        setAreaName('');
        setStatus('Active');
        setEditMode(false);
        setCurrentAreaId(null);
        setCreatedGeofenceData(null);
        setManualLocationData(null);
        setGeofenceType('circle');
        setPolygonPath([]);
    };

    const handleEdit = (area) => {
        setAreaName(area.name);
        setStatus(area.status || 'Active');
        setEditMode(true);
        setCurrentAreaId(area.id);
        if (area.geofence_type) setGeofenceType(area.geofence_type);
        if (area.polygon_coordinates) setPolygonPath(area.polygon_coordinates);
        setManualLocationData({
            latitude: area.latitude,
            longitude: area.longitude,
            geofence_radius: area.geofence_radius,
            formatted_address: area.formatted_address,
            google_place_id: area.google_place_id,
            geofence_type: area.geofence_type,
            polygon_coordinates: area.polygon_coordinates
        });
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        resetForm();
    };

    const fetchHistory = async (areaId) => {
        try {
            const token = JSON.parse(localStorage.getItem('userDetails'))?.token;
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/geofence-history/?area=${areaId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGeofenceHistory(res.data);
            setActiveHistoryAreaId(areaId);
            setShowHistoryModal(true);
        } catch (e) {
            console.error("History fetch error", e);
            swal('Error', 'Could not fetch history.', 'error');
        }
    };

    const restoreVersion = async (version) => {
        try {
            const payload = {
                geofence_type: version.geofence_type,
                geofence_radius: version.geofence_radius,
                latitude: version.latitude,
                longitude: version.longitude,
                polygon_coordinates: version.polygon_coordinates
            };
            await AreaService.updateArea(activeHistoryAreaId, payload);
            swal('Restored', 'Geofence restored to version ' + version.version_number, 'success');
            setShowHistoryModal(false);
            fetchAreas();
        } catch (e) {
            swal('Error', 'Restore failed.', 'error');
        }
    };

    const checkOverlap = async (polyCoords) => {
        try {
            const token = JSON.parse(localStorage.getItem('userDetails'))?.token;
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/areas/${currentAreaId || 'new'}/check_overlap/`, { polygon: polyCoords }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data.overlap;
        } catch (e) { return false; }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!areaName || !areaName.trim()) {
            swal('Error', 'Area Name is required.', 'error');
            return;
        }

        let payload = { name: areaName.trim(), status: status };

        if (manualLocationData) {
            payload.latitude = manualLocationData.latitude;
            payload.longitude = manualLocationData.longitude;
            payload.geofence_radius = manualLocationData.geofence_radius;
            payload.geofence_type = manualLocationData.geofence_type || 'circle';
            payload.polygon_coordinates = manualLocationData.polygon_coordinates;
            if (manualLocationData.formatted_address) payload.formatted_address = manualLocationData.formatted_address;
            if (manualLocationData.google_place_id) payload.google_place_id = manualLocationData.google_place_id;
        } else if (isLoaded && !editMode) {
            try {
                const geocoder = new window.google.maps.Geocoder();
                const results = await new Promise((resolve, reject) => {
                    geocoder.geocode({ address: areaName.trim() }, (res, status) => {
                        if (status === 'OK') resolve(res); else reject(status);
                    });
                });
                if (results && results.length > 0) {
                    const place = results[0];
                    payload.latitude = place.geometry.location.lat();
                    payload.longitude = place.geometry.location.lng();
                    payload.formatted_address = place.formatted_address;
                    payload.google_place_id = place.place_id;
                    payload.geofence_type = 'circle';
                    payload.geofence_radius = 5000;
                }
            } catch (err) {
                swal('Location Fetch Failed', 'Automatic geocoding is unavailable. Please define geofence manually.', 'warning');
                return;
            }
        }

        if (payload.latitude !== undefined) payload.latitude = Number(parseFloat(payload.latitude).toFixed(6));
        if (payload.longitude !== undefined) payload.longitude = Number(parseFloat(payload.longitude).toFixed(6));

        // Coverage/Overlap checks
        if (payload.geofence_type === 'polygon' && payload.polygon_coordinates) {
            const isOverlap = await checkOverlap(payload.polygon_coordinates);
            if (isOverlap) {
                const conf = await swal({
                    title: 'Overlap Detected', text: 'This polygon overlaps another Area. Proceed?',
                    icon: 'warning', buttons: ['Cancel', 'Save Anyway'], dangerMode: true
                });
                if (!conf) return;
            }
        }

        try {
            if (editMode && currentAreaId) {
                await AreaService.updateArea(currentAreaId, payload);
                // Simple history save (handled by backend or we trigger it)
                const token = JSON.parse(localStorage.getItem('userDetails'))?.token;
                await axios.post(`${import.meta.env.VITE_API_URL}/api/geofence-history/`, {
                    area: currentAreaId,
                    version_number: Date.now() % 100000,
                    geofence_type: payload.geofence_type,
                    geofence_radius: payload.geofence_radius || 5000,
                    polygon_coordinates: payload.polygon_coordinates,
                    latitude: payload.latitude,
                    longitude: payload.longitude,
                    change_type: 'Edited'
                }, { headers: { Authorization: `Bearer ${token}` } }).catch(()=>null);
                
                swal('Success!', 'Area updated successfully.', 'success');
                handleCloseModal();
            } else {
                const created = await AreaService.createArea(payload);
                if (payload.latitude && payload.longitude) {
                    setCreatedGeofenceData(payload);
                } else {
                    swal('Success!', 'Area created successfully.', 'success');
                    handleCloseModal();
                }
            }
            fetchAreas();
        } catch (err) {
            swal('Error', 'Error saving area.', 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await swal({
            title: 'Delete Area?', text: 'This action cannot be undone.',
            icon: 'warning', buttons: ['Cancel', 'Delete'], dangerMode: true,
        });
        if (!confirmed) return;
        try {
            await AreaService.deleteArea(id);
            swal('Deleted!', 'Area has been removed.', 'success');
            fetchAreas();
        } catch (err) {
            swal('Error', 'Could not delete.', 'error');
        }
    };

    const openMapModal = () => {
        if (manualLocationData) {
            setTempMapCenter({ lat: manualLocationData.latitude, lng: manualLocationData.longitude });
            setTempMapRadius(manualLocationData.geofence_radius || 5000);
            setTempMapAddress(manualLocationData.formatted_address || '');
            setTempMapPlaceId(manualLocationData.google_place_id || '');
            setGeofenceType(manualLocationData.geofence_type || 'circle');
            setPolygonPath(manualLocationData.polygon_coordinates || []);
        } else if (areaName.trim()) {
            setTempMapCenter({ lat: 10.0889, lng: 76.8837 });
        }
        setShowMapModal(true);
    };

    const filteredAreasPage = areas.filter(area => (area.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
    const currentAreas = filteredAreasPage.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="container-fluid">
            <div className="page-titles">
                <button onClick={() => window.history.back()} className="btn btn-outline-primary btn-sm d-flex align-items-center" style={{ gap: '6px', borderRadius: '6px' }}>
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>

            <Card className="w-100 overflow-hidden">
                <Card.Header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 flex-wrap">
                    <Card.Title className="mb-0 text-nowrap">Area Creation</Card.Title>
                    <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                        <div className="search-bar-container w-100" style={{ margin: 0, maxWidth: '250px' }}>
                            <input type="text" className="form-control" placeholder="Search area..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                            <CreateButton module="area_creation" onClick={() => { resetForm(); setShowModal(true); }} className="d-flex align-items-center justify-content-center btn btn-primary">
                                Add Area
                            </CreateButton>
                        </div>
                    </div>
                </Card.Header>
                <Card.Body style={{ minWidth: 0 }}>
                    <div className="table-responsive w-100">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th><strong>SL NO</strong></th>
                                    <th><strong>AREA NAME</strong></th>
                                    <th><strong>STATUS</strong></th>
                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="4" className="text-center py-4">Loading...</td></tr>
                                ) : currentAreas.length === 0 ? (
                                    <tr><td colSpan="4" className="text-center py-4 text-muted">No areas created yet.</td></tr>
                                ) : (
                                    currentAreas.map((area, index) => (
                                        <tr key={area.id}>
                                            <td className="fw-bold text-primary">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                                            <td className="fw-bold">{area.name}</td>
                                            <td>
                                                <span className={`badge badge-${area.status === 'Active' ? 'success' : 'danger'} light`}>
                                                    {area.status || 'Active'}
                                                </span>
                                            </td>
                                            <td className="text-end">
                                                <div className="d-flex justify-content-end gap-2">
                                                    <button className="btn btn-info shadow btn-xs sharp" onClick={() => fetchHistory(area.id)}>
                                                        <i className="fa fa-history"></i>
                                                    </button>
                                                    <EditButton module="area_creation" onClick={() => handleEdit(area)} />
                                                    <DeleteButton module="area_creation" onClick={() => handleDelete(area.id)} className="sharp btn-xs" />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card.Body>
            </Card>

            <Modal show={showModal} onHide={handleCloseModal} centered dialogClassName="pkg-custom-modal" backdrop="static">
                <style>{`
                    .pkg-custom-modal .modal-content { border-radius: 16px !important; border: none !important; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important; overflow: hidden; }
                    .pkg-custom-modal .modal-header-custom { display: flex; align-items: center; justify-content: space-between; padding: 24px 28px 16px 28px; border-bottom: 1px solid #f1f5f9; }
                    .pkg-custom-modal .modal-icon-circle { width: 48px; height: 48px; background-color: #2ece8a; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2); }
                    .pkg-custom-modal .modal-close-x { border: none; background: transparent; font-size: 24px; color: #aaa; cursor: pointer; transition: color 0.2s; display: flex; align-items: center; justify-content: center; padding: 4px; }
                    .pkg-custom-modal .modal-body-custom { padding: 24px 28px; max-height: 70vh; overflow-y: auto; }
                    .pkg-custom-modal .modal-footer-custom { display: flex; align-items: center; justify-content: flex-end; padding: 20px 28px 24px 28px; border-top: 1px solid #f1f5f9; background-color: #fafbfc; gap: 12px; }
                    .pkg-custom-modal .form-label-custom { font-size: 13px; font-weight: 500; color: #4a5568; margin-bottom: 6px; }
                    .pkg-custom-modal .form-control-custom { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #334155; width: 100%; }
                    .pkg-custom-modal .btn-close-custom { background-color: #7A70BA !important; color: white !important; border-radius: 8px !important; padding: 10px 24px !important; border: none !important; }
                    .pkg-custom-modal .btn-save-custom { background-color: #2ece8a !important; color: white !important; border-radius: 8px !important; padding: 10px 24px !important; border: none !important; }
                `}</style>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle"><i className="fa fa-map text-white fs-4"></i></div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {createdGeofenceData ? 'Area Created with Geofence' : (editMode ? 'Edit Area' : 'Add New Area')}
                            </h4>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleCloseModal}>&times;</button>
                </div>
                {createdGeofenceData ? (
                    <div className="modal-body-custom">
                        <div className="alert alert-success">Area saved successfully.</div>
                        <div className="d-flex justify-content-end mt-4">
                            <button type="button" className="btn-save-custom" onClick={handleCloseModal}>Close</button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="modal-body-custom">
                            <div className="row mb-3">
                                <div className={`col-12 ${editMode ? "col-md-6" : "col-md-12"}`}>
                                    <label className="form-label-custom">Area Name <span className="text-danger">*</span></label>
                                    <input type="text" className="form-control-custom" value={areaName} onChange={(e) => setAreaName(e.target.value)} />
                                </div>
                                <div className="col-12 col-md-12 mt-3">
                                    <label className="form-label-custom">Geofence / Location Settings</label>
                                    <div className="d-flex flex-column gap-2">
                                        <button type="button" className="btn btn-outline-primary btn-sm w-100" onClick={openMapModal}>
                                            <i className="fa fa-map-marker"></i> {manualLocationData ? 'Edit Geofence on Map' : 'Set Geofence on Map'}
                                        </button>
                                        {manualLocationData && (
                                            <div className="alert alert-success mt-2">
                                                <strong>Mode: </strong>{manualLocationData.geofence_type.toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {editMode && (
                                    <div className="col-12 col-md-6 mt-3 mt-md-0">
                                        <label className="form-label-custom">Status</label>
                                        <Form.Select value={status} onChange={(e) => setStatus(e.target.value)} className="form-control-custom">
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                        </Form.Select>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer-custom">
                            <button type="button" className="btn-close-custom" onClick={handleCloseModal}>Cancel</button>
                            <button type="submit" className="btn-save-custom">Save</button>
                        </div>
                    </form>
                )}
            </Modal>

            <Modal show={showMapModal} onHide={() => setShowMapModal(false)} centered dialogClassName="pkg-custom-modal" backdrop="static" size="xl">
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle" style={{ backgroundColor: '#3b82f6' }}><i className="fa fa-map-marker text-white fs-4"></i></div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px' }}>Define Geofence</h4>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowMapModal(false)}>&times;</button>
                </div>
                <div className="modal-body-custom" style={{ padding: '20px' }}>
                    {isLoaded && (
                        <>
                            <div className="row mb-3">
                                <div className="col-12 col-md-4">
                                    <label className="form-label-custom">Geofence Mode</label>
                                    <Form.Select className="form-control-custom" value={geofenceType} onChange={(e) => {
                                        setGeofenceType(e.target.value);
                                        if (e.target.value === 'circle') clearPolygon();
                                    }}>
                                        <option value="circle">Circle (Radius)</option>
                                        <option value="polygon">Polygon (Custom Shape)</option>
                                    </Form.Select>
                                </div>
                                <div className="col-12 col-md-4">
                                    <label className="form-label-custom">Search Location</label>
                                    <Autocomplete onLoad={onLoadAutocomplete} onPlaceChanged={onPlaceChanged}>
                                        <input type="text" className="form-control-custom" placeholder="Search map..." />
                                    </Autocomplete>
                                </div>
                                <div className="col-12 col-md-4">
                                    {geofenceType === 'circle' ? (
                                        <>
                                            <label className="form-label-custom">Radius (km)</label>
                                            <input type="number" className="form-control-custom" value={tempMapRadius / 1000} onChange={(e) => setTempMapRadius((parseFloat(e.target.value) || 1) * 1000)} />
                                        </>
                                    ) : (
                                        <>
                                            <label className="form-label-custom">Polygon Tools</label>
                                            <div className="d-flex gap-2">
                                                <button className="btn btn-warning btn-sm w-100" onClick={clearPolygon}>Clear Polygon</button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="d-flex justify-content-end mb-2">
                                <Form.Check type="switch" id="heatmap-switch" label="Toggle Delivery Locations Heatmap" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} />
                            </div>
                            <div style={{ position: 'relative', height: '500px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                <GoogleMap
                                    mapContainerStyle={{ width: '100%', height: '100%' }}
                                    center={tempMapCenter}
                                    zoom={12}
                                    onClick={handleMapClick}
                                    options={{ disableDefaultUI: true, zoomControl: true }}
                                >
                                    {showHeatmap && heatmapData.length > 0 && (
                                        <HeatmapLayer data={heatmapData} options={{ radius: 20, opacity: 0.6 }} />
                                    )}

                                    {geofenceType === 'circle' && (
                                        <>
                                            <Marker position={tempMapCenter} draggable={true} onDragEnd={(e) => handleMapClick({ latLng: { lat: () => e.latLng.lat(), lng: () => e.latLng.lng() } })} />
                                            <Circle center={tempMapCenter} radius={tempMapRadius} options={{ fillColor: '#3b82f6', fillOpacity: 0.2, strokeColor: '#3b82f6' }} />
                                        </>
                                    )}

                                    {geofenceType === 'polygon' && (
                                        <>
                                            {polygonPath.length === 0 ? (
                                                <DrawingManager
                                                    onPolygonComplete={onPolygonComplete}
                                                    options={{
                                                        drawingControl: true,
                                                        drawingControlOptions: {
                                                            position: window.google.maps.ControlPosition.TOP_CENTER,
                                                            drawingModes: ['polygon']
                                                        },
                                                        polygonOptions: { fillColor: '#3b82f6', fillOpacity: 0.2, strokeColor: '#3b82f6', editable: true }
                                                    }}
                                                />
                                            ) : (
                                                <Polygon
                                                    paths={polygonPath}
                                                    options={{ fillColor: '#3b82f6', fillOpacity: 0.2, strokeColor: '#3b82f6', editable: true }}
                                                    onMouseUp={onEditPolygon}
                                                    onDragEnd={onEditPolygon}
                                                    onLoad={(polygon) => polygonRef.current = polygon}
                                                />
                                            )}
                                        </>
                                    )}
                                </GoogleMap>
                            </div>
                        </>
                    )}
                </div>
                <div className="modal-footer-custom">
                    <button type="button" className="btn-close-custom" onClick={() => setShowMapModal(false)}>Cancel</button>
                    <button type="button" className="btn-save-custom" onClick={saveManualLocation}>Apply Geofence</button>
                </div>
            </Modal>

            {/* History Modal */}
            <Modal show={showHistoryModal} onHide={() => setShowHistoryModal(false)} centered dialogClassName="pkg-custom-modal" backdrop="static" size="lg">
                <div className="modal-header-custom">
                    <h4 className="modal-title font-w600 mb-0">Geofence History</h4>
                    <button type="button" className="modal-close-x" onClick={() => setShowHistoryModal(false)}>&times;</button>
                </div>
                <div className="modal-body-custom">
                    {geofenceHistory.length === 0 ? (
                        <p className="text-muted">No history found for this area.</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Version</th>
                                        <th>Type</th>
                                        <th>Date</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {geofenceHistory.map(h => (
                                        <tr key={h.id}>
                                            <td>v{h.version_number}</td>
                                            <td>{h.geofence_type.toUpperCase()}</td>
                                            <td>{new Date(h.created_at).toLocaleString()}</td>
                                            <td>
                                                <button className="btn btn-sm btn-warning" onClick={() => restoreVersion(h)}>Restore</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="modal-footer-custom">
                    <button type="button" className="btn-close-custom" onClick={() => setShowHistoryModal(false)}>Close</button>
                </div>
            </Modal>
        </div>
    );
};

export default AreaCreation;
"""

with open(jsx_path, 'w', encoding='utf-8') as f:
    f.write(content.strip())
