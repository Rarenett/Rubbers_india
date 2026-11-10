import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { navtoggle } from '../../../store/actions/AuthActions';
import swal from 'sweetalert';
import { Card, Button, Form, Modal } from 'react-bootstrap';
import Select from 'react-select';
import { AreaService } from '../../../services/AreaService';
import LogisticsService from '../../../services/LogisticsService';
import axios from 'axios';
import { usePageTitle } from '../../../context/TitleContext';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import { useGoogleMaps } from '../../../context/GoogleMapsProvider';

const AreaLocationMapping = () => {
    usePageTitle("Area Location Mapping");
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
    const [mappings, setMappings] = useState([]);
    const [areas, setAreas] = useState([]);
    const [deliveryLocations, setDeliveryLocations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    
    const { isLoaded } = useGoogleMaps();
    
    const [selectedArea, setSelectedArea] = useState('');
    const [selectedDeliveryLocations, setSelectedDeliveryLocations] = useState([]);
    const [manualLocations, setManualLocations] = useState('');
    
    const [editMode, setEditMode] = useState(false);
    const [currentMappingId, setCurrentMappingId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [mappingsRes, areasRes, dlRes] = await Promise.all([
                AreaService.getAreaLocationMappings(),
                AreaService.getAreas(),
                AreaService.getDeliveryLocations({ limit: 10000, page_size: 10000 })
            ]);
            
            let mData = mappingsRes.results ?? mappingsRes;
            setMappings(Array.isArray(mData) ? mData : []);
            
            let aData = areasRes.results ?? areasRes;
            setAreas(Array.isArray(aData) ? aData : []);
            
            let dlData = dlRes.results ?? dlRes;
            if (!Array.isArray(dlData) && dlRes.data) {
                dlData = dlRes.data;
            }
            setDeliveryLocations(Array.isArray(dlData) ? dlData : []);
            
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const uniqueMappings = [];
    const seenAreas = new Set();
    
    mappings.forEach(mapping => {
        if (!seenAreas.has(mapping.area)) {
            seenAreas.add(mapping.area);
            uniqueMappings.push({
                area: mapping.area,
                area_name: mapping.area_name,
            });
        }
    });

    const filteredMappings = uniqueMappings.filter(mapping => {
        const areaName = mapping.area_name || '';
        const search = searchTerm.toLowerCase();
        return areaName.toLowerCase().includes(search);
    });

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);



    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentMappings = filteredMappings.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredMappings.length / itemsPerPage);

    const resetForm = () => {
        setSelectedArea('');
        setSelectedDeliveryLocations([]);
        setManualLocations('');
        setEditMode(false);
        setCurrentMappingId(null);
    };

    const handleEdit = (mapping) => {
        setSelectedArea(mapping.area);
        const areaMappings = mappings
            .filter(m => String(m.area) === String(mapping.area))
            .sort((a, b) => a.id - b.id);
            
        const locs = areaMappings.map(loc => {
            if (loc.delivery_location) {
                const dlMatch = deliveryLocations.find(s => String(s.id) === String(loc.delivery_location));
                return dlMatch 
                    ? { value: dlMatch.id, label: dlMatch.location_name } 
                    : { value: loc.delivery_location, label: loc.delivery_location_name };
            } else {
                return { value: `custom_${loc.custom_location_name}`, label: loc.custom_location_name };
            }
        });
        
        setSelectedDeliveryLocations(locs);
        setManualLocations('');
        setEditMode(true);
        setCurrentMappingId(mapping.area);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        resetForm();
    };

    // Haversine formula to calculate distance between two coordinates in meters
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3; // Earth radius in meters
        const rad = Math.PI / 180;
        const dLat = (lat2 - lat1) * rad;
        const dLon = (lon2 - lon1) * rad;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Custom state to track auto-detected locations
    const [autoDetectedLocations, setAutoDetectedLocations] = useState([]);
    const [nearestLocations, setNearestLocations] = useState([]);
    const [loadingNearest, setLoadingNearest] = useState(false);

    useEffect(() => {
        if (!selectedArea) {
            setSelectedDeliveryLocations([]);
            setAutoDetectedLocations([]);
            return;
        }

        const fetchDetectedLocations = async () => {
            try {
                // 1. Get existing mapped locations
                const areaMappings = mappings
                    .filter(m => String(m.area) === String(selectedArea))
                    .sort((a, b) => a.id - b.id);
                
                const existingTags = areaMappings.map(loc => {
                    if (loc.delivery_location) {
                        const dlMatch = deliveryLocations.find(s => String(s.id) === String(loc.delivery_location));
                        return dlMatch 
                            ? { value: dlMatch.id, label: dlMatch.location_name } 
                            : { value: loc.delivery_location, label: loc.delivery_location_name };
                    } else {
                        return { value: `custom_${loc.custom_location_name}`, label: loc.custom_location_name };
                    }
                });

                // 2. Fetch detected locations from the new API
                const detectedLocations = await AreaService.getDetectedLocations(selectedArea);
                
                // 3. Match those locations and create auto tags
                const areaObj = areas.find(a => String(a.id) === String(selectedArea));
                const newAutoTags = [];
                const matchedDlNames = [];

                if (detectedLocations && detectedLocations.length > 0) {
                    // Make sure the API didn't return an array of integers (legacy fallback)
                    const isLegacy = typeof detectedLocations[0] !== 'object';
                    
                    detectedLocations.forEach(dl => {
                        let dlId, dlName;
                        
                        if (isLegacy) {
                            dlId = dl;
                            const dlMatch = deliveryLocations.find(loc => String(loc.id) === String(dlId));
                            if (dlMatch) {
                                dlName = dlMatch.location_name;
                            }
                        } else {
                            dlId = dl.id;
                            dlName = dl.location_name;
                        }
                        
                        if (dlId && dlName) {
                            if (!existingTags.find(ms => String(ms.value) === String(dlId))) {
                                newAutoTags.push({ value: dlId, label: dlName });
                                matchedDlNames.push(dlName);
                            }
                        }
                    });
                }

                const finalSelected = [...existingTags, ...newAutoTags];

                setAutoDetectedLocations(matchedDlNames);
                setSelectedDeliveryLocations(finalSelected);
                setManualLocations('');
            } catch (err) {
                console.error("Error fetching detected locations:", err);
                // On error, just show existing tags
                const areaMappings = mappings
                    .filter(m => String(m.area) === String(selectedArea))
                    .sort((a, b) => a.id - b.id);
                const existingTags = areaMappings.map(loc => {
                    if (loc.delivery_location) {
                        const dlMatch = deliveryLocations.find(s => String(s.id) === String(loc.delivery_location));
                        return dlMatch 
                            ? { value: dlMatch.id, label: dlMatch.location_name } 
                            : { value: loc.delivery_location, label: loc.delivery_location_name };
                    } else {
                        return { value: `custom_${loc.custom_location_name}`, label: loc.custom_location_name };
                    }
                });
                setSelectedDeliveryLocations(existingTags);
                setManualLocations('');
            }
        };

        fetchDetectedLocations();
    }, [selectedArea, editMode, mappings, deliveryLocations, areas]);

    // Nearest Locations functionality
    const fetchNearestLocations = async (location) => {
        setLoadingNearest(true);
        try {
            const token = JSON.parse(localStorage.getItem('userDetails'))?.token;
            const config = { headers: { Authorization: `Bearer ${token}` } };
            
            // First we need to find the lat/lng of this location from coordinate API
            const coordsRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/delivery-location-coordinates/`, config);
            const myCoord = coordsRes.data.find(c => c.delivery_location.location_name.toLowerCase() === location.label.toLowerCase());
            
            if (myCoord) {
                const nearestRes = await axios.post(`${import.meta.env.VITE_API_URL}/api/delivery-location-coordinates/nearest/`, {
                    latitude: myCoord.latitude,
                    longitude: myCoord.longitude
                }, config);
                
                // Exclude self and set
                setNearestLocations(nearestRes.data.filter(n => n.id !== myCoord.delivery_location.id));
            } else {
                swal('Not Found', 'This location does not have coordinates in the system.', 'info');
                setNearestLocations([]);
            }
        } catch (error) {
            console.error("Error fetching nearest locations:", error);
            swal('Error', 'Could not fetch nearest locations.', 'error');
        } finally {
            setLoadingNearest(false);
        }
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const textManuals = manualLocations.split(',').map(l => l.trim()).filter(l => l);
        const customTagManuals = selectedDeliveryLocations.filter(s => String(s.value).startsWith('custom_')).map(s => s.label);
        const manualLocsList = [...new Set([...textManuals, ...customTagManuals])];
        
        const standardTags = selectedDeliveryLocations.filter(s => !String(s.value).startsWith('custom_'));
        const allLabels = [...new Set([...standardTags.map(s => s.label), ...manualLocsList])];
        
        if (!selectedArea || allLabels.length === 0) {
            swal('Error', 'Area and at least one Delivery Location are required.', 'error');
            return;
        }

        try {
            const existingLocations = mappings.filter(m => String(m.area) === String(selectedArea));
            
            const newDeliveryLocationIds = standardTags.map(s => String(s.value));
            
            // Delete mappings that are NO LONGER in the route stop selection OR manual text
            const toDelete = existingLocations.filter(e => {
                if (e.delivery_location) return !newDeliveryLocationIds.includes(String(e.delivery_location));
                if (e.custom_location_name) return !manualLocsList.includes(e.custom_location_name);
                return true;
            });
            
            const existingDeliveryLocationIds = existingLocations.filter(e => e.delivery_location).map(e => String(e.delivery_location));
            const existingCustomNames = existingLocations.filter(e => e.custom_location_name).map(e => e.custom_location_name);
            
            // Build an ordered list of items to add, preserving the user's sequence
            const orderedAdditions = [];
            
            selectedDeliveryLocations.forEach(s => {
                const isCustom = String(s.value).startsWith('custom_');
                if (isCustom) {
                    if (!existingCustomNames.includes(s.label)) {
                        orderedAdditions.push({ type: 'manual', value: s.label });
                    }
                } else {
                    if (!existingDeliveryLocationIds.includes(String(s.value))) {
                        orderedAdditions.push({ type: 'stop', value: s.value, label: s.label });
                    }
                }
            });
            
            textManuals.forEach(text => {
                if (!existingCustomNames.includes(text) && !orderedAdditions.find(a => a.type === 'manual' && a.value === text)) {
                    orderedAdditions.push({ type: 'manual', value: text });
                }
            });
            
            for (const d of toDelete) {
                await AreaService.deleteAreaLocationMapping(d.id);
            }
            
            // Save in the exact ordered sequence (first come first save)
            for (const addition of orderedAdditions) {
                if (addition.type === 'stop') {
                    try {
                        await AreaService.createAreaLocationMapping({ area: selectedArea, delivery_location: addition.value, source: 'MANUAL' });
                    } catch (mapErr) {
                        if (mapErr.response?.data?.non_field_errors?.[0]?.includes('unique set')) {
                            console.warn('Mapping already exists, skipping:', addition.label);
                        } else {
                            throw mapErr;
                        }
                    }
                } else if (addition.type === 'manual') {
                    try {
                        const newLoc = await AreaService.createDeliveryLocation({ area: selectedArea, location_name: addition.value, status: 'Active', route_stop: rsId });
                        await AreaService.createAreaLocationMapping({ area: selectedArea, delivery_location: newLoc.id, source: 'MANUAL' });
                    } catch (mapErr) {
                        if (mapErr.response?.data?.non_field_errors?.[0]?.includes('unique set')) {
                            console.warn('Mapping already exists, skipping:', addition.value);
                        } else {
                            try {
                                await AreaService.createAreaLocationMapping({ area: selectedArea, delivery_location: null, custom_location_name: addition.value, source: 'MANUAL' });
                            } catch (fallbackErr) {
                                throw fallbackErr;
                            }
                        }
                    }
                }
            }
            swal('Success!', 'Mapping saved successfully.', 'success');
            handleCloseModal();
            fetchData();
        } catch (err) {
            const errData = err.response?.data;
            let errorMsg = 'An error occurred while saving.';
            if (errData) {
                if (typeof errData === 'string') errorMsg = errData;
                else if (errData.detail) errorMsg = errData.detail;
                else if (errData.non_field_errors) errorMsg = errData.non_field_errors[0];
                else errorMsg = JSON.stringify(errData);
            }
            swal('Error', errorMsg, 'error');
            console.error('API Error:', err);
        }
    };

    const handleDelete = async (areaId) => {
        const confirmed = await swal({
            title: 'Delete All Mappings?',
            text: 'This will remove ALL delivery locations mapped to this area. This action cannot be undone.',
            icon: 'warning',
            buttons: ['Cancel', 'Delete All'],
            dangerMode: true,
        });
        if (!confirmed) return;
        try {
            const areaMappings = mappings.filter(m => String(m.area) === String(areaId));
            for (const m of areaMappings) {
                await AreaService.deleteAreaLocationMapping(m.id);
            }
            setMappings(mappings.filter(m => String(m.area) !== String(areaId)));
            swal('Deleted!', 'All mappings for this area have been removed.', 'success');
        } catch (err) {
            swal('Error', 'Could not delete mappings.', 'error');
        }
    };

    const customSelectStyles = {
        control: (base, state) => ({
            ...base,
            border: state.isFocused ? '1px solid #0a500f' : '1px solid #cbd5e1',
            borderRadius: '10px',
            fontSize: '13px',
            color: '#334155',
            backgroundColor: '#fff',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15, 0.15)' : 'none',
            minHeight: '43px',
            '&:hover': {
                border: state.isFocused ? '1px solid #0a500f' : '1px solid #cbd5e1'
            }
        }),
        valueContainer: (base) => ({
            ...base,
            padding: '2px 8px',
        }),
        dropdownIndicator: (base) => ({
            ...base,
            padding: '4px 8px',
            color: '#6e7e8f'
        }),
        clearIndicator: (base) => ({
            ...base,
            padding: '4px'
        }),
        multiValue: (base) => ({
            ...base,
            backgroundColor: '#f1f5f9',
            borderRadius: '6px'
        }),
        multiValueLabel: (base) => ({
            ...base,
            color: '#334155',
            fontSize: '12px',
            padding: '3px 6px'
        }),
        multiValueRemove: (base) => ({
            ...base,
            color: '#64748b',
            ':hover': {
                backgroundColor: '#cbd5e1',
                color: '#334155'
            }
        }),
        menu: (base) => ({
            ...base,
            borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            marginTop: '4px'
        }),
        option: (base, state) => ({
            ...base,
            fontSize: '13px',
            padding: '10px 14px',
            backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? '#f8fafc' : 'white',
            color: state.isSelected ? 'white' : '#334155',
            cursor: 'pointer',
            '&:active': {
                backgroundColor: '#073d0b'
            }
        })
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

            <Card className="w-100 overflow-hidden">
                <Card.Header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 flex-wrap">
                    <Card.Title className="mb-0 text-nowrap">Area Location Mapping</Card.Title>
                    <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                        <div className="search-bar-container w-100" style={{ margin: 0, maxWidth: '250px' }}>
                            <span className="search-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </span>
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search area..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                            <CreateButton 
                                module="area_location_mapping" 
                                onClick={() => { resetForm(); setShowModal(true); }}
                                className="d-flex align-items-center justify-content-center btn btn-primary"
                                style={{ height: '38px', borderRadius: '6px', padding: '0 16px', whiteSpace: 'nowrap' }}
                            >
                                Add Mapping
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
                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="3" className="text-center py-4">Loading...</td></tr>
                                ) : filteredMappings.length === 0 ? (
                                    <tr><td colSpan="3" className="text-center py-4 text-muted">No mappings created yet.</td></tr>
                                ) : (
                                    currentMappings.map((mapping, index) => (
                                        <tr key={mapping.area}>
                                            <td className="fw-bold text-primary">{indexOfFirstItem + index + 1}</td>
                                            <td className="fw-bold">{mapping.area_name}</td>
                                            <td className="text-end">
                                                <div className="d-flex justify-content-end gap-2">
                                                    <EditButton
                                                        module="area_location_mapping"
                                                        onClick={() => handleEdit(mapping)}
                                                    />
                                                    <DeleteButton
                                                        module="area_location_mapping"
                                                        onClick={() => handleDelete(mapping.area)}
                                                        className="sharp btn-xs"
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {filteredMappings.length > 0 && (
                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredMappings.length)} of {filteredMappings.length} entries
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
                                        <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                            <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
                                                <i className="la la-angle-right" />
                                            </button>
                                        </li>
                                    </ul>
                                </nav>
                            )}
                        </div>
                    )}
                </Card.Body>
            </Card>

            <Modal show={showModal} onHide={() => setShowModal(false)} centered dialogClassName="pkg-custom-modal" backdrop="static">
                <style>{`
                    .pkg-custom-modal .modal-content { border-radius: 16px !important; border: none !important; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important; overflow: visible; }
                    .pkg-custom-modal .modal-header-custom { display: flex; align-items: center; justify-content: space-between; padding: 24px 28px 16px 28px; border-bottom: 1px solid #f1f5f9; }
                    .pkg-custom-modal .modal-icon-circle { width: 48px; height: 48px; background-color: #0a500f; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2); }
                    .pkg-custom-modal .modal-close-x { border: none; background: transparent; font-size: 24px; color: #aaa; cursor: pointer; transition: color 0.2s; display: flex; align-items: center; justify-content: center; padding: 4px; }
                    .pkg-custom-modal .modal-close-x:hover { color: #555; }
                    .pkg-custom-modal .modal-body-custom { padding: 24px 28px; overflow: visible; }
                    .pkg-custom-modal .modal-footer-custom { display: flex; align-items: center; justify-content: flex-end; padding: 20px 28px 24px 28px; border-top: 1px solid #f1f5f9; background-color: #fafbfc; gap: 12px; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px; }
                    .pkg-custom-modal .form-label-custom { font-size: 13px; font-weight: 500; color: #4a5568; margin-bottom: 6px; }
                    .pkg-custom-modal .form-control-custom { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #334155; background-color: #fff; transition: border-color 0.2s, box-shadow 0.2s; width: 100%; }
                    .pkg-custom-modal .form-control-custom:focus { outline: none; border-color: #0a500f; box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15); }
                    .pkg-custom-modal .btn-close-custom { background-color: #dc3545 !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; transition: background-color 0.2s, transform 0.1s; }
                    .pkg-custom-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
                    .pkg-custom-modal .btn-save-custom { background-color: #0a500f !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; transition: background-color 0.2s, transform 0.1s; }
                    .pkg-custom-modal .btn-save-custom:hover { background-color: #073d0b !important; }
                `}</style>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                <line x1="12" y1="22.08" x2="12" y2="12"></line>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Mapping' : 'Add New Mapping'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Select an Area and a Delivery Location
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleCloseModal}>
                        &times;
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body-custom">
                        <div className="row mb-3">
                            <div className="col-12 col-md-12 mb-3">
                                <label className="form-label-custom">Area Name <span className="text-danger">*</span></label>
                                <Form.Select
                                    className="form-control-custom"
                                    value={selectedArea}
                                    onChange={(e) => setSelectedArea(e.target.value)}
                                    disabled={editMode}
                                >
                                    <option value="">Select Area</option>
                                    {areas.map(area => (
                                        <option key={area.id} value={area.id}>{area.name}</option>
                                    ))}
                                </Form.Select>
                            </div>
                            <div className="col-12 col-md-12">
                                <label className="form-label-custom">Select Delivery Location <span className="text-danger">*</span></label>
                                <Select
                                    isMulti
                                    classNamePrefix="react-select"
                                    value={selectedDeliveryLocations}
                                    onChange={(selectedOptions) => setSelectedDeliveryLocations(selectedOptions || [])}
                                    options={[
                                        ...deliveryLocations
                                            .filter(stop => {
                                                if (!stop) return false;
                                                const stopAreaId = stop.area && typeof stop.area === 'object' ? stop.area.id : stop.area;
                                                return String(stopAreaId) === String(selectedArea);
                                            })
                                            .map(stop => ({ 
                                                value: stop.id, 
                                                label: stop.location_name ? stop.location_name.replace(/\u200B/g, '').trim() : `Location ${stop.id}` 
                                            })),
                                        ...selectedDeliveryLocations.filter(s => 
                                            String(s.value).startsWith('custom_') || 
                                            !deliveryLocations.find(dl => {
                                                const dlAreaId = dl.area && typeof dl.area === 'object' ? dl.area.id : dl.area;
                                                return String(dl.id) === String(s.value) && String(dlAreaId) === String(selectedArea);
                                            })
                                        )
                                    ]}
                                    placeholder="Select existing Delivery Locations..."
                                    styles={customSelectStyles}
                                />
                            </div>
                            <div className="col-12 col-md-12 mt-3">
                                <label className="form-label-custom">Or Type Manually (Comma Separated)</label>
                                <textarea
                                    className="form-control-custom"
                                    rows="2"
                                    value={manualLocations}
                                    onChange={(e) => setManualLocations(e.target.value)}
                                    placeholder="e.g. Muvattupuzha Town, Kothamangalam, Perumbavoor"
                                ></textarea>
                                <small className="text-muted mt-1 d-block">
                                    You can enter multiple locations separated by commas.
                                </small>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={handleCloseModal}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom">
                            Save
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default AreaLocationMapping;
