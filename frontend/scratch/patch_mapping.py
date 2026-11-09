import os
import re

jsx_path = r'c:\Archana\glenda_vite\frontend\src\jsx\components\CommonMaster\AreaLocationMapping.jsx'
with open(jsx_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add Axios if not imported
if 'import axios ' not in content:
    content = content.replace("import LogisticsService from '../../../services/LogisticsService';", "import LogisticsService from '../../../services/LogisticsService';\nimport axios from 'axios';")

# Find the useEffect block handling selectedArea
# It starts at: useEffect(() => {\n        if (!selectedArea) {
# Ends at: setManualLocations('');\n    }, [selectedArea, editMode, mappings, routeStops, areas]);

use_effect_pattern = re.compile(
    r'useEffect\(\(\) => \{\s*if \(\!selectedArea\).*?setManualLocations\(\'\'\);\s*\}, \[selectedArea, editMode, mappings, routeStops, areas\]\);', 
    re.DOTALL
)

new_use_effect = """
    // Custom state to track auto-detected locations
    const [autoDetectedLocations, setAutoDetectedLocations] = useState([]);
    const [nearestLocations, setNearestLocations] = useState([]);
    const [loadingNearest, setLoadingNearest] = useState(false);

    useEffect(() => {
        if (!selectedArea) {
            setSelectedRouteStops([]);
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
                    if (loc.route_stop) {
                        const routeStopMatch = routeStops.find(s => String(s.id) === String(loc.route_stop));
                        return routeStopMatch 
                            ? { value: routeStopMatch.id, label: routeStopMatch.stop_name } 
                            : { value: loc.route_stop, label: loc.route_stop_name };
                    } else {
                        return { value: `custom_${loc.custom_location_name}`, label: loc.custom_location_name };
                    }
                });

                // 2. Fetch detected locations from the new API
                const token = JSON.parse(localStorage.getItem('userDetails'))?.token;
                const config = { headers: { Authorization: `Bearer ${token}` } };
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/areas/${selectedArea}/detected_locations/`, config);
                const detectedIds = res.data || [];
                
                // 3. Match those IDs with Area's Delivery Locations and create auto tags
                const areaObj = areas.find(a => String(a.id) === String(selectedArea));
                const newAutoTags = [];
                const matchedDlNames = [];

                if (areaObj && areaObj.delivery_locations) {
                    areaObj.delivery_locations.forEach(dl => {
                        if (detectedIds.includes(dl.id)) {
                            // Find corresponding route stop or make custom
                            const dlName = dl.location_name.toLowerCase().trim();
                            const matchedStop = routeStops.find(rs => rs.stop_name.toLowerCase().trim() === dlName);
                            
                            if (matchedStop) {
                                if (!existingTags.find(ms => String(ms.value) === String(matchedStop.id))) {
                                    newAutoTags.push({ value: matchedStop.id, label: matchedStop.stop_name });
                                    matchedDlNames.push(dl.location_name);
                                }
                            } else {
                                const customValue = `custom_${dl.location_name}`;
                                if (!existingTags.find(ms => ms.value === customValue)) {
                                    newAutoTags.push({ value: customValue, label: dl.location_name });
                                    matchedDlNames.push(dl.location_name);
                                }
                            }
                        }
                    });
                }

                setAutoDetectedLocations(matchedDlNames);
                setSelectedRouteStops([...existingTags, ...newAutoTags]);
                setManualLocations('');
            } catch (err) {
                console.error("Error fetching detected locations:", err);
                // On error, just show existing tags
                const areaMappings = mappings
                    .filter(m => String(m.area) === String(selectedArea))
                    .sort((a, b) => a.id - b.id);
                const existingTags = areaMappings.map(loc => {
                    if (loc.route_stop) {
                        const routeStopMatch = routeStops.find(s => String(s.id) === String(loc.route_stop));
                        return routeStopMatch 
                            ? { value: routeStopMatch.id, label: routeStopMatch.stop_name } 
                            : { value: loc.route_stop, label: loc.route_stop_name };
                    } else {
                        return { value: `custom_${loc.custom_location_name}`, label: loc.custom_location_name };
                    }
                });
                setSelectedRouteStops(existingTags);
                setManualLocations('');
            }
        };

        fetchDetectedLocations();
    }, [selectedArea, editMode, mappings, routeStops, areas]);

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
"""

content = use_effect_pattern.sub(new_use_effect.strip(), content)

# Inject nearest location UI in the modal body, near the bottom of the form
form_injection = """
                                </div>
                                
                                {selectedRouteStops.length > 0 && (
                                    <div className="col-12 mt-4">
                                        <label className="form-label-custom d-flex align-items-center gap-2">
                                            Nearest Locations Check <i className="fa fa-map-marker text-primary"></i>
                                        </label>
                                        <div className="d-flex gap-2 mb-3 flex-wrap">
                                            {selectedRouteStops.map((stop, i) => (
                                                <button 
                                                    key={i} 
                                                    type="button" 
                                                    className="btn btn-outline-info btn-xs"
                                                    onClick={() => fetchNearestLocations(stop)}
                                                    disabled={loadingNearest}
                                                >
                                                    Find near {stop.label}
                                                </button>
                                            ))}
                                        </div>
                                        {nearestLocations.length > 0 && (
                                            <div className="alert alert-secondary p-3 rounded" style={{ fontSize: '13px' }}>
                                                <h6 className="mb-2 fw-bold text-dark"><i className="fa fa-compass me-2"></i>Nearest Locations:</h6>
                                                <ul className="mb-0 ps-3">
                                                    {nearestLocations.map((loc, i) => (
                                                        <li key={i} className="mb-1">
                                                            <strong>{loc.location_name}</strong> <span className="text-muted ms-2">{loc.distance_km} km away</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
"""

content = content.replace('                                </div>\n                            </div>\n                        </div>\n                        <div className="modal-footer-custom">', form_injection + '\n                        </div>\n                        <div className="modal-footer-custom">')


with open(jsx_path, 'w', encoding='utf-8') as f:
    f.write(content)
