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
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const GeomanControl = ({ polygonPath, setPolygonPath, geofenceType }) => {
    const map = useMap();
    useEffect(() => {
        if (geofenceType !== 'polygon') {
            map.pm.removeControls();
            return;
        }
        map.pm.addControls({
            position: 'topleft',
            drawCircle: false,
            drawMarker: false,
            drawCircleMarker: false,
            drawPolyline: false,
            drawRectangle: false,
            drawPolygon: true,
            editMode: true,
            dragMode: false,
            cutPolygon: false,
            removalMode: true,
        });

        const updatePolygonState = () => {
            const layers = map.pm.getGeomanLayers();
            if (layers.length > 0) {
                const layer = layers[layers.length - 1]; // get latest
                if (layer.getLatLngs) {
                    const latlngs = layer.getLatLngs()[0];
                    if (Array.isArray(latlngs)) {
                        setPolygonPath(latlngs.map(ll => ({ lat: ll.lat, lng: ll.lng })));
                    }
                }
            } else {
                setPolygonPath([]);
            }
        };

        map.on('pm:create', (e) => {
            // clear old layers
            map.pm.getGeomanLayers().forEach(l => {
                if (l !== e.layer) map.removeLayer(l);
            });
            updatePolygonState();
            e.layer.on('pm:edit', updatePolygonState);
            e.layer.on('pm:vertexadded', updatePolygonState);
            e.layer.on('pm:vertexremoved', updatePolygonState);
        });

        map.on('pm:remove', (e) => {
            updatePolygonState();
        });

        return () => {
            map.pm.removeControls();
            map.off('pm:create');
            map.off('pm:remove');
        };
    }, [map, geofenceType, setPolygonPath]);

    // Render existing polygon if not currently drawn by user
    useEffect(() => {
        if (polygonPath && polygonPath.length >= 3 && map.pm.getGeomanLayers().length === 0 && geofenceType === 'polygon') {
            const polyLayer = L.polygon(polygonPath).addTo(map);
            polyLayer.on('pm:edit', () => {
                const latlngs = polyLayer.getLatLngs()[0];
                setPolygonPath(latlngs.map(ll => ({ lat: ll.lat, lng: ll.lng })));
            });
        }
    }, [map, polygonPath, geofenceType]);

    return null;
};

const MapController = ({ location }) => {
    const map = useMap();
    useEffect(() => {
        if (
            location &&
            Number.isFinite(location.lat) &&
            Number.isFinite(location.lng)
        ) {
            map.flyTo(
                [location.lat, location.lng],
                13,
                { animate: true, duration: 1 }
            );
        }
    }, [location, map]);
    return null;
};

const MapEventsComponent = ({ geofenceType, setGeofenceLocation, setPolygonPath, setTempMapPlaceId }) => {
    useMapEvents({
        click(e) {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            
            if (geofenceType === 'circle') {
                const token = JSON.parse(localStorage.getItem('userDetails'))?.token;
                axiosInstance.get(`/api/area/geocode_reverse/`, {
                    params: { lat, lon: lng },
                    headers: { 
                        'Authorization': `Bearer ${token}` 
                    }
                }).then(response => {
                    const address = response.data && response.data.display_name 
                        ? response.data.display_name 
                        : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                    setGeofenceLocation({ lat, lng, address });
                    setTempMapPlaceId('');
                }).catch(err => {
                    console.error("Reverse geocoding error", err);
                    setGeofenceLocation({ lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
                    setTempMapPlaceId('');
                });
            } else if (geofenceType === 'polygon') {
                setPolygonPath(prev => [...prev, { lat, lng }]);
            }
        }
    });
    return null;
};

import axios from 'axios';
import axiosInstance from '../../../services/axiosInstance';

const haversineDistance = (coords1, coords2) => {
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371; // Earth radius in km

    const dLat = toRad(coords2.lat - coords1.lat);
    const dLon = toRad(coords2.lng - coords1.lng);
    const lat1 = toRad(coords1.lat);
    const lat2 = toRad(coords2.lat);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

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
    
    const isLoaded = true;
    
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
    const [geofenceLocation, setGeofenceLocation] = useState(null);
    const [tempMapRadius, setTempMapRadius] = useState(5000);
    const [tempMapPlaceId, setTempMapPlaceId] = useState('');
    
    const [searchInputValue, setSearchInputValue] = useState('');
    const searchInputRef = useRef(null);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeoutRef = useRef(null);
    
    const [geofenceType, setGeofenceType] = useState('circle');
    const [polygonPath, setPolygonPath] = useState([]);
    const [polygonPointNames, setPolygonPointNames] = useState({});
    const polygonPointNamesRef = useRef({});
    const polygonRef = useRef(null);
    const [mapInstance, setMapInstance] = useState(null);
    
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [heatmapData, setHeatmapData] = useState([]);
    
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [geofenceHistory, setGeofenceHistory] = useState([]);
    const [activeHistoryAreaId, setActiveHistoryAreaId] = useState(null);
    useEffect(() => {
        polygonPointNamesRef.current = polygonPointNames;
    }, [polygonPointNames]);

    useEffect(() => {
        if (geofenceType === 'polygon' && polygonPath.length > 0) {
            let isCancelled = false;
            
            const fetchNames = async () => {
                const token = JSON.parse(localStorage.getItem('userDetails'))?.token;
                
                for (const pt of polygonPath) {
                    if (isCancelled) break;
                    
                    if (Number.isFinite(Number(pt.lat)) && Number.isFinite(Number(pt.lng))) {
                        const key = `${Number(pt.lat).toFixed(6)},${Number(pt.lng).toFixed(6)}`;
                        
                        if (!polygonPointNamesRef.current[key]) {
                            try {
                                const response = await axiosInstance.get(`/api/area/geocode_reverse/`, {
                                    params: { lat: pt.lat, lon: pt.lng },
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                
                                let name = null;
                                if (response.data) {
                                    if (response.data.address) {
                                        const addr = response.data.address;
                                        name = addr.locality || addr.neighbourhood || addr.suburb || addr.village || addr.town || addr.municipality || addr.city || addr.road || addr.county || addr.state_district || (response.data.display_name ? response.data.display_name.split(',')[0].trim() : null);
                                    } else if (response.data.display_name) {
                                        name = response.data.display_name.split(',')[0].trim();
                                    }
                                }
                                
                                if (name) {
                                    setPolygonPointNames(prev => ({ ...prev, [key]: name }));
                                    polygonPointNamesRef.current[key] = name;
                                } else {
                                    setPolygonPointNames(prev => ({ ...prev, [key]: 'Unnamed Location' }));
                                    polygonPointNamesRef.current[key] = 'Unnamed Location';
                                }
                            } catch (err) {
                                console.error("Geocoding failed for point", pt, err);
                                setPolygonPointNames(prev => ({ ...prev, [key]: 'Unnamed Location' }));
                                polygonPointNamesRef.current[key] = 'Unnamed Location';
                            }
                            
                            // Sleep slightly to prevent backend/Nominatim rate limiting
                            await new Promise(r => setTimeout(r, 600));
                        }
                    }
                }
            };
            fetchNames();
            
            return () => {
                isCancelled = true;
            };
        }
    }, [polygonPath, geofenceType]);


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
            const pts = res.data.map(c => [Number(c.latitude), Number(c.longitude)]);
            setHeatmapData(pts);
        } catch (e) {
            console.error("Heatmap fetch error:", e);
        }
    };

    const getValidCoordinates = (location) => {
        if (!location) return null;
        let lat = typeof location.lat === 'function' ? location.lat() : location.lat;
        let lng = typeof location.lng === 'function' ? location.lng() : location.lng;
        lat = Number(lat);
        lng = Number(lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng };
    };

    const fetchSuggestions = async (query) => {
        if (!query || query.trim().length < 3) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        
        setIsSearching(true);
        try {
            const token = JSON.parse(localStorage.getItem('userDetails'))?.token;
            const response = await axiosInstance.get(`/api/area/geocode/`, {
                params: { q: query.trim() },
                headers: { Authorization: `Bearer ${token}` }
            });
            
            let responseData = response.data;
            
            if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
                if (Array.isArray(responseData.results)) {
                    responseData = responseData.results;
                } else if (Array.isArray(responseData.data)) {
                    responseData = responseData.data;
                }
            }
            
            if (Array.isArray(responseData) && responseData.length > 0) {
                setSuggestions(responseData);
                setShowSuggestions(true);
            } else {
                setSuggestions([]);
                setShowSuggestions(true);
            }
        } catch (e) {
            console.error("Geocoding suggestions error", e);
            setSuggestions([]);
            setShowSuggestions(true);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearchInputValue(val);
        
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        
        if (val.trim().length >= 3) {
            searchTimeoutRef.current = setTimeout(() => {
                fetchSuggestions(val);
            }, 500);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        const lat = Number(suggestion.latitude);
        const lng = Number(suggestion.longitude);
        
        if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0 && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            const address = suggestion.display_name || '';
            setSearchInputValue(address);
            if (searchInputRef.current) searchInputRef.current.value = address;
            setGeofenceLocation({ lat, lng, address });
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const resolveSearchLocation = async (query) => {
        const cleanedQuery = query?.trim();
        if (!cleanedQuery) return;
        
        try {
            const token = JSON.parse(localStorage.getItem('userDetails'))?.token;
            console.log("Search query:", cleanedQuery);
            const response = await axiosInstance.get(`/api/area/geocode/`, {
                params: { q: cleanedQuery },
                headers: { Authorization: `Bearer ${token}` }
            });
            
            console.log("Backend response:", response.data);
            
            let bestResult = null;
            let responseData = response.data;
            
            // Handle cases where the backend wraps the response in a paginated or standard DRF format
            if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
                if (Array.isArray(responseData.results)) {
                    responseData = responseData.results;
                } else if (Array.isArray(responseData.data)) {
                    responseData = responseData.data;
                }
            }
            
            if (Array.isArray(responseData) && responseData.length > 0) {
                const lowerQuery = cleanedQuery.toLowerCase();
                
                const scoreResult = (res) => {
                    let score = 0;
                    const name = (res.name || '').toLowerCase();
                    const addr = res.address || {};
                    
                    const exactMatchIn = (field) => {
                        return addr[field] && addr[field].toLowerCase() === lowerQuery;
                    };
                    
                    // Priority 1: Exact match in specific high-precision fields
                    if (exactMatchIn('city') || exactMatchIn('town') || exactMatchIn('municipality') || exactMatchIn('village') || exactMatchIn('locality') || name === lowerQuery) {
                        score += 100;
                    }
                    
                    // Priority 2: Exact match in other meaningful address fields
                    if (exactMatchIn('suburb') || exactMatchIn('neighbourhood') || exactMatchIn('hamlet')) {
                        score += 80;
                    }

                    // Priority 3: The class is a place (e.g. city/town/village) instead of a boundary
                    if (res.class === 'place') {
                        score += 50;
                    } else if (res.class === 'boundary') {
                        score -= 50; // Penalize boundaries/administrative areas
                    }

                    // Priority 4: If it matches district/county, it gets a lower score
                    if (exactMatchIn('county') || exactMatchIn('state_district') || exactMatchIn('district')) {
                        score += 20;
                    }

                    // Priority 5: The display name starts with the query
                    if ((res.display_name || '').toLowerCase().startsWith(lowerQuery)) {
                        score += 10;
                    }
                    
                    // Priority 6: Place rank and importance as tie-breakers
                    score += (res.importance || 0) * 10;
                    // Lower place_rank is usually more important/larger feature in Nominatim, but let's stick to importance for positive scoring.
                    
                    return score;
                };

                const scoredResults = responseData.map(res => ({
                    ...res,
                    _score: scoreResult(res)
                })).sort((a, b) => b._score - a._score);
                
                console.log("Scored geocoding results:", scoredResults);
                
                bestResult = scoredResults[0];
            } else if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
                bestResult = responseData;
            }
            
            if (bestResult) {
                console.log("Raw bestResult object:", bestResult);
                
                const lat = Number(bestResult.latitude);
                const lng = Number(bestResult.longitude);

                console.log("Final Parsed latitude:", lat, "longitude:", lng);

                if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0 && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    const address = bestResult.display_name || cleanedQuery;
                    setGeofenceLocation({ lat, lng, address });
                    setSearchInputValue(address);
                    if (searchInputRef.current) searchInputRef.current.value = address;
                    setSuggestions([]);
                    setShowSuggestions(false);
                    return;
                } else {
                    swal('Invalid Data', 'Invalid location coordinates.', 'warning');
                    return;
                }
            }
            swal('Not Found', 'Location not found.', 'warning');
        } catch (e) {
            if (e.response && e.response.status === 404) {
                swal('Not Found', 'Location not found.', 'warning');
            } else {
                console.error("Geocoding error", e);
                swal('Error', 'Unable to fetch location.', 'error');
            }
        }
    };

    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = e.target.value;
            
            // If there are existing suggestions, pick the first one
            if (suggestions && suggestions.length > 0) {
                handleSuggestionClick(suggestions[0]);
                return;
            }
            
            if (val && val.trim().length > 2) {
                resolveSearchLocation(val.trim());
            }
        }
    };

    // handleMapClick removed and replaced by MapEventsComponent

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
        setPolygonPointNames({});
        if (polygonPointNamesRef) polygonPointNamesRef.current = {};
    };

    const saveManualLocation = () => {
        if (!geofenceLocation && geofenceType === 'circle') {
            swal('Invalid', 'Please search and select a location or click on the map to define the center.', 'warning');
            return;
        }
        if (geofenceType === 'polygon' && polygonPath.length < 3) {
            swal('Invalid', 'A polygon must have at least 3 points.', 'warning');
            return;
        }
        setManualLocationData({
            latitude: geofenceLocation ? geofenceLocation.lat : null,
            longitude: geofenceLocation ? geofenceLocation.lng : null,
            geofence_radius: tempMapRadius,
            formatted_address: geofenceLocation ? geofenceLocation.address : '',
            google_place_id: tempMapPlaceId,
            geofence_type: geofenceType,
            polygon_coordinates: geofenceType === 'polygon' ? polygonPath : null
        });

        // Trigger history save immediately upon Apply Geofence
        if (currentAreaId && currentAreaId !== 'new') {
            const token = JSON.parse(localStorage.getItem('userDetails'))?.token;
            
            let calculatedDistances = [];
            if (geofenceType === 'polygon' && polygonPath.length >= 3) {
                for (let i = 0; i < polygonPath.length; i++) {
                    const p1 = polygonPath[i];
                    const p2 = polygonPath[(i + 1) % polygonPath.length];
                    if (Number.isFinite(Number(p1.lat)) && Number.isFinite(Number(p1.lng)) && Number.isFinite(Number(p2.lat)) && Number.isFinite(Number(p2.lng))) {
                        const dist = haversineDistance(p1, p2);
                        const key1 = `${Number(p1.lat).toFixed(6)},${Number(p1.lng).toFixed(6)}`;
                        const key2 = `${Number(p2.lat).toFixed(6)},${Number(p2.lng).toFixed(6)}`;
                        const name1 = polygonPointNames[key1] || `Boundary ${i+1}`;
                        const name2 = polygonPointNames[key2] || `Boundary ${(i+1)%polygonPath.length + 1}`;
                        calculatedDistances.push({
                            from_location: name1.replace(/[\u200B]/g, ''),
                            to_location: name2.replace(/[\u200B]/g, ''),
                            distance_km: Number(dist.toFixed(2))
                        });
                    }
                }
            }
            
            axios.post(`${import.meta.env.VITE_API_URL}/api/geofence-history/`, {
                area: currentAreaId,
                version_number: Date.now() % 100000,
                geofence_type: geofenceType,
                geofence_radius: tempMapRadius || 5000,
                polygon_coordinates: geofenceType === 'polygon' ? polygonPath : null,
                latitude: geofenceLocation ? geofenceLocation.lat : null,
                longitude: geofenceLocation ? geofenceLocation.lng : null,
                change_type: 'Edited',
                polygon_distances: calculatedDistances
            }, { headers: { Authorization: `Bearer ${token}` } }).catch(()=>null);
        }
        
        swal('Saved', `Geofence (${geofenceType === 'polygon' ? 'Polygon' : 'Circle'}) applied successfully!`, 'success').then(() => {
            setShowMapModal(false);
        });
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
        setPolygonPointNames({});
        if (polygonPointNamesRef) polygonPointNamesRef.current = {};
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
            setGeofenceHistory(res.data.results || res.data);
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
            payload.polygon_distances = manualLocationData.polygon_distances;
            if (manualLocationData.formatted_address) payload.formatted_address = manualLocationData.formatted_address;
            if (manualLocationData.google_place_id) payload.google_place_id = manualLocationData.google_place_id;
        } else if (geofenceLocation) {
            payload.latitude = geofenceLocation.lat;
            payload.longitude = geofenceLocation.lng;
            payload.geofence_radius = tempMapRadius || 5000;
            payload.geofence_type = geofenceType || 'circle';
            payload.polygon_coordinates = geofenceType === 'polygon' ? polygonPath : null;
            if (geofenceLocation.address) payload.formatted_address = geofenceLocation.address;
        }

        if (payload.latitude !== undefined && payload.latitude !== null) {
            payload.latitude = Number(parseFloat(payload.latitude).toFixed(6));
        }
        if (payload.longitude !== undefined && payload.longitude !== null) {
            payload.longitude = Number(parseFloat(payload.longitude).toFixed(6));
        }

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
                    change_type: 'Edited',
                    polygon_distances: payload.polygon_distances
                }, { headers: { Authorization: `Bearer ${token}` } }).catch(()=>null);
                
                swal('Success!', 'Area updated successfully.', 'success');
                handleCloseModal();
            } else {
                const created = await AreaService.createArea(payload);
                swal('Success!', 'Area created successfully.', 'success');
                handleCloseModal();
            }
            fetchAreas();
        } catch (err) {
            console.error("Save Area Error:", err);
            let msg = 'Error saving area.';
            if (err.response && err.response.data) {
                msg = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data);
            }
            swal('Error', msg, 'error');
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
        if (manualLocationData && manualLocationData.latitude !== null && manualLocationData.longitude !== null) {
            const validCoords = getValidCoordinates({ lat: manualLocationData.latitude, lng: manualLocationData.longitude });
            const addr = manualLocationData.formatted_address || areaName.trim() || '';
            setGeofenceLocation({ lat: validCoords.lat, lng: validCoords.lng, address: addr });
            setTempMapRadius(manualLocationData.geofence_radius || 5000);
            setTempMapPlaceId(manualLocationData.google_place_id || '');
            setGeofenceType(manualLocationData.geofence_type || 'circle');
            setPolygonPath(manualLocationData.polygon_coordinates || []);
            setSearchInputValue(addr);
            if (searchInputRef.current) searchInputRef.current.value = addr;
        } else {
            setGeofenceLocation(null);
            setTempMapRadius(5000);
            setTempMapPlaceId('');
            setGeofenceType('circle');
            setPolygonPath([]);
            setPolygonPointNames({});
            if (polygonPointNamesRef) polygonPointNamesRef.current = {};
            
            const initialSearch = areaName.trim();
            setSearchInputValue(initialSearch);
            if (searchInputRef.current) searchInputRef.current.value = initialSearch;
            if (initialSearch && isLoaded) {
                resolveSearchLocation(initialSearch);
            }
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

                                                    <EditButton module="area_creation" onClick={() => handleEdit(area)} />
                                                    <DeleteButton module="area_creation" onClick={() => handleDelete(area.id)} className="sharp btn-xs" />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        {filteredAreasPage.length > 0 && (
                            <div className="d-flex justify-content-between align-items-center mt-3">
                                <div className="dataTables_info">
                                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAreasPage.length)} of {filteredAreasPage.length} entries
                                </div>
                                {Math.ceil(filteredAreasPage.length / itemsPerPage) > 1 && (
                                    <nav>
                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                            <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-left" />
                                                </button>
                                            </li>
                                            {Array.from({ length: Math.ceil(filteredAreasPage.length / itemsPerPage) }, (_, i) => i + 1).map(pageNumber => {
                                                if (
                                                    pageNumber === 1 ||
                                                    pageNumber === Math.ceil(filteredAreasPage.length / itemsPerPage) ||
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
                                            <li className={`page-item page-indicator ${currentPage === Math.ceil(filteredAreasPage.length / itemsPerPage) ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredAreasPage.length / itemsPerPage)))} disabled={currentPage === Math.ceil(filteredAreasPage.length / itemsPerPage)} style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-right" />
                                                </button>
                                            </li>
                                        </ul>
                                    </nav>
                                )}
                            </div>
                        )}
                    </div>
                </Card.Body>
            </Card>

            <Modal show={showModal} onHide={handleCloseModal} centered dialogClassName="pkg-custom-modal" backdrop="static">
                <style>{`
                    .pkg-custom-modal .modal-content { border-radius: 16px !important; border: none !important; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important; overflow: hidden; }
                    .pkg-custom-modal .modal-header-custom { display: flex; align-items: center; justify-content: space-between; padding: 24px 28px 16px 28px; border-bottom: 1px solid #f1f5f9; }
                    .pkg-custom-modal .modal-icon-circle { width: 48px; height: 48px; background-color: #0a500f; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2); }
                    .pkg-custom-modal .modal-close-x { border: none; background: transparent; font-size: 24px; color: #aaa; cursor: pointer; transition: color 0.2s; display: flex; align-items: center; justify-content: center; padding: 4px; }
                    .pkg-custom-modal .modal-body-custom { padding: 24px 28px; max-height: 70vh; overflow-y: auto; }
                    .pkg-custom-modal .modal-footer-custom { display: flex; align-items: center; justify-content: flex-end; padding: 20px 28px 24px 28px; border-top: 1px solid #f1f5f9; background-color: #fafbfc; gap: 12px; }
                    .pkg-custom-modal .form-label-custom { font-size: 13px; font-weight: 500; color: #4a5568; margin-bottom: 6px; }
                    .pkg-custom-modal .form-control-custom { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #334155; width: 100%; }
                    .pkg-custom-modal .btn-close-custom { background-color: #dc3545 !important; color: white !important; border-radius: 8px !important; padding: 10px 24px !important; border: none !important; }
                    .pkg-custom-modal .btn-save-custom { background-color: #0a500f !important; color: white !important; border-radius: 8px !important; padding: 10px 24px !important; border: none !important; }
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
                                <div className={`col-12 ${editMode ? "col-md-6 mb-3" : "col-md-12 mb-3"}`}>
                                    <label className="form-label-custom">Area Name <span className="text-danger">*</span></label>
                                    <input type="text" className="form-control-custom" value={areaName} onChange={(e) => setAreaName(e.target.value)} />
                                </div>
                                {editMode && (
                                    <div className="col-12 col-md-6 mb-3">
                                        <label className="form-label-custom">Status</label>
                                        <Form.Select value={status} onChange={(e) => setStatus(e.target.value)} className="form-control-custom">
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                        </Form.Select>
                                    </div>
                                )}
                                <div className="col-12 col-md-12">
                                    <label className="form-label-custom">Geofence / Location Settings</label>
                                    <div className="d-flex flex-column gap-2">
                                        <button type="button" className="btn btn-outline-primary btn-sm w-100" onClick={openMapModal}>
                                            <i className="fa fa-map-marker"></i> {manualLocationData ? 'Edit Geofence on Map' : 'Set Geofence on Map'}
                                        </button>
                                        {manualLocationData && (
                                            <div className="alert alert-success mt-2 mb-0">
                                                <strong>Mode: </strong>{manualLocationData.geofence_type.toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                </div>
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
                <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)', overflow: 'hidden' }}>
                <div className="modal-header-custom" style={{ flexShrink: 0 }}>
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle" style={{ backgroundColor: '#3b82f6' }}><i className="fa fa-map-marker text-white fs-4"></i></div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px' }}>Define Geofence</h4>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowMapModal(false)}>&times;</button>
                </div>
                <div className="modal-body-custom" style={{ padding: '20px', flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
                    {isLoaded && (
                        <>
                            <div className="row mb-3">
                                <div className="col-12 col-md-4 mb-3 mb-md-0">
                                    <label className="form-label-custom">Geofence Mode</label>
                                    <Form.Select className="form-control-custom" value={geofenceType} onChange={(e) => {
                                        setGeofenceType(e.target.value);
                                        if (e.target.value === 'circle') clearPolygon();
                                    }}>
                                        <option value="circle">Circle (Radius)</option>
                                        <option value="polygon">Polygon (Custom Shape)</option>
                                    </Form.Select>
                                </div>
                                <div className="col-12 col-md-4 mb-3 mb-md-0">
                                    <label className="form-label-custom">Search Location</label>
                                    <div className="flex-grow-1" style={{ position: 'relative' }}>
                                        <input 
                                            ref={searchInputRef}
                                            type="text" 
                                            className="form-control-custom" 
                                            placeholder="Search map and hit Enter..." 
                                            value={searchInputValue}
                                            onKeyDown={handleSearchKeyDown}
                                            onChange={handleSearchChange}
                                        />
                                        {showSuggestions && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', marginTop: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', maxHeight: '250px', overflowY: 'auto' }}>
                                                {isSearching ? (
                                                    <div style={{ padding: '10px 14px', color: '#64748b', fontSize: '13px' }}>Loading suggestions...</div>
                                                ) : suggestions.length > 0 ? (
                                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                                        {suggestions.map((s, idx) => (
                                                            <li key={idx} onClick={() => handleSuggestionClick(s)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: idx < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: '13px', color: '#334155' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                                {s.display_name}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <div style={{ padding: '10px 14px', color: '#64748b', fontSize: '13px' }}>No locations found</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="col-12 col-md-4 mb-3 mb-md-0">
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
                            <div style={{ position: 'relative', height: '60vh', minHeight: '300px', maxHeight: '500px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                <MapContainer
                                    style={{ width: '100%', height: '100%' }}
                                    center={geofenceLocation ? [geofenceLocation.lat, geofenceLocation.lng] : [10.0889, 76.8837]}
                                    zoom={12}
                                >
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                    <MapController location={geofenceLocation} />
                                    <MapEventsComponent 
                                        geofenceType={geofenceType} 
                                        setGeofenceLocation={setGeofenceLocation}
                                        setPolygonPath={setPolygonPath}
                                        setTempMapPlaceId={setTempMapPlaceId}
                                    />
                                    <GeomanControl polygonPath={polygonPath} setPolygonPath={setPolygonPath} geofenceType={geofenceType} />
                                    
                                    {geofenceType === 'circle' && geofenceLocation && (
                                        <>
                                            <Marker position={[geofenceLocation.lat, geofenceLocation.lng]} />
                                            <Circle center={[geofenceLocation.lat, geofenceLocation.lng]} radius={tempMapRadius} pathOptions={{ fillColor: '#3b82f6', fillOpacity: 0.2, color: '#3b82f6' }} />
                                        </>
                                    )}
                                </MapContainer>
                            </div>
                            {geofenceType === 'polygon' && polygonPath.length >= 3 && (
                                <div className="mt-3 p-3" style={{ backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <label className="form-label-custom mb-2">Distance Between Locations</label>
                                    <div className="d-flex flex-column gap-1" style={{ fontSize: '13px', color: '#334155' }}>
                                        {(() => {
                                            let totalDistance = 0;
                                            const segments = [];
                                            for (let i = 0; i < polygonPath.length; i++) {
                                                const p1 = polygonPath[i];
                                                const p2 = polygonPath[(i + 1) % polygonPath.length];
                                                if (Number.isFinite(Number(p1.lat)) && Number.isFinite(Number(p1.lng)) && Number.isFinite(Number(p2.lat)) && Number.isFinite(Number(p2.lng))) {
                                                    const dist = haversineDistance(p1, p2);
                                                    totalDistance += dist;
                                                    const key1 = `${Number(p1.lat).toFixed(6)},${Number(p1.lng).toFixed(6)}`;
                                                    const key2 = `${Number(p2.lat).toFixed(6)},${Number(p2.lng).toFixed(6)}`;
                                                    const name1 = polygonPointNames[key1] || 'Loading...';
                                                    const name2 = polygonPointNames[key2] || 'Loading...';
                                                    segments.push({
                                                        label: `${name1} → ${name2}`,
                                                        dist: dist.toFixed(2)
                                                    });
                                                }
                                            }
                                            if (segments.length < 3) return null;
                                            return (
                                                <>
                                                    {segments.map((seg, idx) => (
                                                        <div key={idx} className="d-flex justify-content-between" style={{ maxWidth: '300px' }}>
                                                            <span>{seg.label}</span>
                                                            <span className="fw-bold">{seg.dist} km</span>
                                                        </div>
                                                    ))}
                                                    <div className="d-flex justify-content-between mt-2 pt-2" style={{ borderTop: '1px dashed #cbd5e1', maxWidth: '300px' }}>
                                                        <span className="fw-bold">Total Distance:</span>
                                                        <span className="fw-bold">{totalDistance.toFixed(2)} km</span>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
                <div className="modal-footer-custom" style={{ flexShrink: 0 }}>
                    <button type="button" className="btn-close-custom" onClick={() => setShowMapModal(false)}>Cancel</button>
                    <button type="button" className="btn-save-custom" onClick={saveManualLocation}>Apply Geofence</button>
                </div>
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {geofenceHistory.map(h => (
                                        <tr key={h.id}>
                                            <td>v{h.version_number}</td>
                                            <td>{h.geofence_type.toUpperCase()}</td>
                                            <td>{new Date(h.created_at).toLocaleString()}</td>
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