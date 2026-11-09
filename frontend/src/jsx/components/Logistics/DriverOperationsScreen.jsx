import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import LogisticsService from '../../../services/LogisticsService';
import swal from 'sweetalert';
import SalesService from '../../../services/SalesService';
import Select from 'react-select';
import CameraCapture from '../AccessPoint/CameraCapture';

/* ─── Design tokens ──────────────────────────────────────────────────────────
   Palette: deep navy header, clean white cards, royal-blue accent,
   gold detail. "DM Sans" body, "DM Serif Display" for the hero headline.
─────────────────────────────────────────────────────────────────────────── */
const T = {
    ink: '#0f1624',
    inkMuted: '#3d4a5c',
    slate: '#6b7a90',
    steel: '#a0aec0',
    cloud: '#eef1f6',
    white: '#ffffff',
    surface: '#f5f7fa',

    accent: '#3b5bdb',
    accentSoft: '#e8edfd',
    accentGlow: 'rgba(59,91,219,0.18)',

    gold: '#c9a84c',
    
    success: '#10b981',
    successSoft: '#d1fae5',

    danger: '#dc2626',

    rSm: '8px',
    rMd: '14px',
    rLg: '20px',
    rXl: '28px',

    shSm: '0 1px 3px rgba(15,22,36,0.06), 0 1px 2px rgba(15,22,36,0.04)',
    shMd: '0 4px 16px rgba(15,22,36,0.07), 0 1px 4px rgba(15,22,36,0.05)',
    shAccent: '0 6px 20px rgba(59,91,219,0.30)',
    shSuccess: '0 6px 20px rgba(16,185,129,0.30)',
};

const customSelectStyles = {
    control: (provided, state) => ({
        ...provided,
        border: `1.5px solid ${T.cloud}`,
        borderRadius: T.rMd,
        background: T.white,
        boxShadow: state.isFocused ? '0 0 0 3px rgba(59,91,219,0.1)' : 'none',
        minHeight: '42px',
        height: '42px',
        fontSize: '0.9rem',
        fontWeight: '500',
        color: T.ink,
        padding: '0px 2px',
        '&:hover': {
            border: `1.5px solid ${T.steel}`
        }
    }),
    valueContainer: (provided) => ({
        ...provided,
        padding: '0px 8px',
        flexWrap: 'nowrap'
    }),
    singleValue: (provided) => ({
        ...provided,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    }),
    placeholder: (provided) => ({
        ...provided,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    }),
    input: (provided) => ({
        ...provided,
        margin: '0px',
        padding: '0px'
    }),
    indicatorSeparator: state => ({
        display: 'none'
    }),
    indicatorsContainer: (provided, state) => ({
        ...provided,
        height: '42px'
    }),
    menu: (provided) => ({
        ...provided,
        borderRadius: T.rMd,
        boxShadow: T.shMd,
        zIndex: 9999
    }),
    option: (provided, state) => ({
        ...provided,
        fontSize: '0.9rem',
        color: state.isSelected ? '#fff' : T.ink,
        background: state.isSelected ? T.accent : state.isFocused ? T.accentSoft : '#fff',
        cursor: 'pointer',
        padding: '10px 16px',
        fontWeight: '500'
    })
};

const fieldLabel = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: T.slate,
    marginBottom: '6px',
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
};

const fieldBase = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: T.rMd,
    border: `1.5px solid ${T.cloud}`,
    background: T.white,
    fontSize: '0.9rem',
    color: T.ink,
    fontWeight: '600',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.18s, box-shadow 0.18s',
    boxSizing: 'border-box',
};

const DriverOperationsScreen = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Auth
    const currentUser = useSelector(state => state.auth.auth.user);
    const loggedInName = currentUser ? (currentUser.first_name && currentUser.last_name ? `${currentUser.first_name} ${currentUser.last_name}` : currentUser.username || currentUser.email || 'Unknown') : 'Unknown';

    // ── Apply body background styles on mount ───────────────────────────────
    useEffect(() => {
        const containerFluid = document.querySelector('.container-fluid');
        const contentBody = document.querySelector('.content-body');
        let ogCBg = '', ogCPad = '', ogBBg = '';
        if (containerFluid) {
            ogCBg = containerFluid.style.background || containerFluid.style.backgroundColor;
            ogCPad = containerFluid.style.padding;
            containerFluid.style.setProperty('background', T.surface, 'important');
            containerFluid.style.setProperty('background-color', T.surface, 'important');
            containerFluid.style.setProperty('padding', '0', 'important');
        }
        if (contentBody) {
            ogBBg = contentBody.style.background || contentBody.style.backgroundColor;
            contentBody.style.setProperty('background', T.surface, 'important');
            contentBody.style.setProperty('background-color', T.surface, 'important');
        }
        return () => {
            if (containerFluid) { containerFluid.style.background = ogCBg; containerFluid.style.padding = ogCPad; }
            if (contentBody) { contentBody.style.background = ogBBg; }
        };
    }, []);

    // ── State ───────────────────────────────────────────────────────────────
    const [ledgers, setLedgers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Tabs and Orders
    const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'operations'
    const [orders, setOrders] = useState([]);
    const [viewingOrder, setViewingOrder] = useState(null);
    
    // Form fields
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [selectedLedgerId, setSelectedLedgerId] = useState('');
    const [startingKM, setStartingKM] = useState('');

    const [selectedDeliveryLocation, setSelectedDeliveryLocation] = useState('');
    
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [cash, setCash] = useState('');
    const [returnQuantity, setReturnQuantity] = useState('');
    const [narration, setNarration] = useState('');

    const [completedOrders, setCompletedOrders] = useState([]);
    
    // Fines Modal State
    const [showTransactionsModal, setShowTransactionsModal] = useState(false);
    const [showVehicleDetailsModal, setShowVehicleDetailsModal] = useState(false);
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [vehicleSearch, setVehicleSearch] = useState('');
    const [vehicles, setVehicles] = useState([]);
    const [transactionsFromDate, setTransactionsFromDate] = useState('');
    const [transactionsToDate, setTransactionsToDate] = useState('');
    const [showFinesModal, setShowFinesModal] = useState(false);
    const [driverFines, setDriverFines] = useState([]);
    const [finesFromDate, setFinesFromDate] = useState('');
    const [finesToDate, setFinesToDate] = useState('');
    
    // Status (false = not started, true = started/waiting for delivery, or handled as "Delivered" state)
    // The requirement says: "a button 'start'. this start button should be change its name to 'delivered' to click it after the delivery of the order."
    const [tripStatus, setTripStatus] = useState('PENDING'); // PENDING -> STARTED -> DELIVERED

    const [isJourneyStarted, setIsJourneyStarted] = useState(false);
    const [isJourneyCompleted, setIsJourneyCompleted] = useState(false);
    const [journeyId, setJourneyId] = useState(null);
    const [driverInfo, setDriverInfo] = useState(null);
    
    // Fuel Filling Modal State
    const [showFuelModal, setShowFuelModal] = useState(false);
    const [showFuelCameraModal, setShowFuelCameraModal] = useState(false);
    const [fuelDate, setFuelDate] = useState(new Date().toISOString().split('T')[0]);
    const [fuelServiceType, setFuelServiceType] = useState('');
    const [fuelKM, setFuelKM] = useState('');
    const [fuelLitres, setFuelLitres] = useState('');
    const [fuelAttachment, setFuelAttachment] = useState(null);
    const [existingFuelAttachment, setExistingFuelAttachment] = useState(null);
    const [serviceTypes, setServiceTypes] = useState([]);
    const [fuelLoading, setFuelLoading] = useState(false);
    const [previousFuelFillings, setPreviousFuelFillings] = useState([]);
    const [editingFuelId, setEditingFuelId] = useState(null);

    // Service Request Modal State
    const [showServiceRequestModal, setShowServiceRequestModal] = useState(false);
    const [srServiceType, setSrServiceType] = useState('');
    const [srExpiryDate, setSrExpiryDate] = useState('');
    const [srNarration, setSrNarration] = useState('');
    const [srLoading, setSrLoading] = useState(false);
    const [allServiceTypes, setAllServiceTypes] = useState([]);
    const [previousServiceRequests, setPreviousServiceRequests] = useState([]);
    const [editingSrId, setEditingSrId] = useState(null);

    const [showEndJourneyModal, setShowEndJourneyModal] = useState(false);
    const [endJourneyKM, setEndJourneyKM] = useState('');
    const [showStartJourneyModal, setShowStartJourneyModal] = useState(false);
    const [startJourneyKM, setStartJourneyKM] = useState('');
    const [showChangeRouteModal, setShowChangeRouteModal] = useState(false);
    const [routeLegs, setRouteLegs] = useState([{ from: '', to: '' }]);
    const [previousRoutes, setPreviousRoutes] = useState([]);
    const [editingRouteId, setEditingRouteId] = useState(null);

    // Sync tabs and modals with browser history hash
    useEffect(() => {
        const hash = location.hash;
        if (hash === '#operations') {
            setActiveTab('operations');
            setShowFinesModal(false);
        } else if (hash === '#fines') {
            setShowFinesModal(true);
        } else {
            setActiveTab('orders');
            setShowFinesModal(false);
        }
    }, [location.hash]);

    // Fetch master data
    useEffect(() => {
        const fetchMasterData = async () => {
            setLoading(true);
            try {
                const [ledgersRes, ordersRes, driversRes, finesRes, vehiclesRes, serviceTypesRes] = await Promise.all([
                    SalesService.getLedgers(),
                    SalesService.getSalesOrders(),
                    LogisticsService.getDrivers(),
                    LogisticsService.getFines().catch(() => ({ data: [] })),
                    LogisticsService.getVehicles().catch(() => ({ data: [] })),
                    LogisticsService.getServiceTypes().catch(() => ({ data: [] }))
                ]);
                
                const fetchedServiceTypes = Array.isArray(serviceTypesRes.data) ? serviceTypesRes.data : [];
                setAllServiceTypes(fetchedServiceTypes);
                setServiceTypes(fetchedServiceTypes.filter(s => 
                    s.service_type && (s.service_type.toLowerCase().includes('petrol') || s.service_type.toLowerCase().includes('diesel'))
                ));
                
                const fetchedLedgers = Array.isArray(ledgersRes.data) ? ledgersRes.data : [];
                setLedgers(fetchedLedgers);
                
                setVehicles(Array.isArray(vehiclesRes.data) ? vehiclesRes.data : []);
                
                const allOrders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
                const todayStrForOrders = new Date().toISOString().split('T')[0];
                const driverOrders = allOrders.filter(order => {
                    if (!order.driver_name || !loggedInName) return false;
                    const isSameDriver = order.driver_name.toLowerCase() === loggedInName.toLowerCase();
                    const isToday = order.preferred_delivery_date && order.preferred_delivery_date.startsWith(todayStrForOrders);
                    return isSameDriver && isToday;
                });
                setOrders(driverOrders);
                
                const alreadyCompleted = driverOrders.filter(o => o.status === 'Delivered').map(o => o.id);
                setCompletedOrders(alreadyCompleted);
                
                const allFines = Array.isArray(finesRes.data) ? finesRes.data : [];
                const myFines = allFines.filter(f => {
                    if (!f.driver_name || !loggedInName) return false;
                    const dName = f.driver_name.toLowerCase().trim();
                    const lName = loggedInName.toLowerCase().trim();
                    return dName === lName || dName.includes(lName) || lName.includes(dName);
                });
                setDriverFines(myFines);
                
                // Auto-fill party if passed from navigation state
                if (location.state && location.state.partyId) {
                    setSelectedLedgerId(String(location.state.partyId));
                    navigate('#operations');
                }

                const drivers = Array.isArray(driversRes.data) ? driversRes.data : [];
                const currentDriver = drivers.find(d => d.name && d.name.toLowerCase() === loggedInName.toLowerCase());
                
                if (currentDriver) {
                    setDriverInfo(currentDriver);
                    const todayStr = new Date().toISOString().split('T')[0];
                    const journeysRes = await LogisticsService.getJourneys({
                        driver_id: currentDriver.id,
                        date: todayStr
                    });
                    const todayJourneys = Array.isArray(journeysRes.data) ? journeysRes.data : [];
                    
                    const completedJourney = todayJourneys.find(j => j.status === 'COMPLETED');
                    const startedJourney = todayJourneys.find(j => j.status === 'STARTED');
                    const hasActiveOrders = driverOrders.some(o => ['Pending', 'Loaded', 'In Transit'].includes(o.status));

                    if (startedJourney) {
                        setIsJourneyStarted(true);
                        setIsJourneyCompleted(false);
                        setJourneyId(startedJourney.id);
                    } else if (hasActiveOrders) {
                        setIsJourneyStarted(false);
                        setIsJourneyCompleted(false);
                        setJourneyId(null);
                    } else if (completedJourney) {
                        setIsJourneyCompleted(true);
                        setIsJourneyStarted(false);
                    } else if (alreadyCompleted.length > 0) {
                        setIsJourneyStarted(true);
                        setIsJourneyCompleted(false);
                    }
                }
            } catch (err) {
                console.error('Error fetching master data:', err);
                swal('Error', 'Failed to load master data.', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchMasterData();
    }, [location.state, loggedInName, navigate]);

    // Fetch delivery locations when ledger changes
    useEffect(() => {
        if (!selectedLedgerId) { 
            setSelectedDeliveryLocation('');
            setTripStatus('PENDING');
            setStartingKM('');
            return; 
        }
        
        const order = orders.find(o => String(o.customer_ledger) === String(selectedLedgerId));

        SalesService.getDeliveryLocations(selectedLedgerId)
            .then(res => {
                const locations = Array.isArray(res.data) ? res.data : [];
                
                if (order && (order.status === 'Shipped' || order.status === 'Delivered')) {
                    setTripStatus(order.status === 'Delivered' ? 'DELIVERED' : 'STARTED');
                    if (order.delivery_location) {
                        setSelectedDeliveryLocation(order.delivery_location);
                    } else {
                        setSelectedDeliveryLocation(locations.length > 0 ? locations[0].location_name : '');
                    }
                    if (order.narration) {
                        const match = order.narration.match(/Starting KM: (\d+(\.\d+)?)/);
                        if (match) {
                            setStartingKM(match[1]);
                        }
                    }
                } else {
                    setTripStatus('PENDING');
                    setStartingKM('');
                    setSelectedDeliveryLocation(locations.length > 0 ? locations[0].location_name : '');
                }
            })
            .catch(() => { 
                setSelectedDeliveryLocation(''); 
                setTripStatus('PENDING');
                setStartingKM('');
            });
    }, [selectedLedgerId, orders]);



    const parseNarrationForEdit = (narrationString) => {
        if (!narrationString) return { cash: '', returnQuantity: '', notes: '' };
        const lines = narrationString.split('\n');
        const lastLine = lines[lines.length - 1] || '';
        
        let c = '', rq = '', n = '';
        if (lastLine.includes('Cash Collected:') || lastLine.includes('Returned Qty:') || lastLine.includes('Notes:')) {
            const parts = lastLine.split(' | ');
            parts.forEach(part => {
                if (part.startsWith('Cash Collected: ')) c = part.replace('Cash Collected: ', '');
                else if (part.startsWith('Returned Qty: ')) rq = part.replace('Returned Qty: ', '');
                else if (part.startsWith('Notes: ')) n = part.replace('Notes: ', '');
            });
        }
        return { cash: c, returnQuantity: rq, notes: n };
    };

    const stripAppendedNotes = (narrationString) => {
        if (!narrationString) return '';
        const lines = narrationString.split('\n');
        const lastLine = lines[lines.length - 1] || '';
        if (lastLine.includes('Cash Collected:') || lastLine.includes('Returned Qty:') || lastLine.includes('Notes:')) {
            lines.pop();
            return lines.join('\n');
        }
        return narrationString;
    };

    const handleCompleteDelivery = async () => {
        if (!selectedOrderId) return;
        
        const order = orders.find(o => o.id === selectedOrderId);
        if (!order) return;

        try {
            let updatedNarration = order.narration || '';
            
            if (completedOrders.includes(order.id)) {
                updatedNarration = stripAppendedNotes(updatedNarration);
            }

            let newNotes = [];
            if (cash) newNotes.push(`Cash Collected: ${cash}`);
            if (returnQuantity) newNotes.push(`Returned Qty: ${returnQuantity}`);
            if (narration) newNotes.push(`Notes: ${narration}`);
            
            if (newNotes.length > 0) {
                updatedNarration = updatedNarration ? `${updatedNarration}\n${newNotes.join(' | ')}` : newNotes.join(' | ');
            }

            await SalesService.patchSalesOrder(order.id, {
                status: 'Delivered',
                narration: updatedNarration
            });

            if (!completedOrders.includes(order.id)) {
                setCompletedOrders([...completedOrders, order.id]);
            }
            
            const updatedOrders = orders.map(o => {
                if (o.id === order.id) {
                    return { ...o, status: 'Delivered', narration: updatedNarration };
                }
                return o;
            });
            setOrders(updatedOrders);

            setShowDeliveryModal(false);
            navigate('#'); // redirect to orders tab
            swal('Success', 'Order completed successfully.', 'success');
            // Clear modal fields
            setCash('');
            setReturnQuantity('');
            setNarration('');
        } catch (error) {
            console.error('Error completing delivery:', error);
            swal('Error', 'Failed to save delivery status.', 'error');
        }
    };

    const handleRevertDelivery = async (orderId) => {
        try {
            await SalesService.patchSalesOrder(orderId, {
                status: 'Pending'
            });

            const newCompletedOrders = completedOrders.filter(id => id !== orderId);
            setCompletedOrders(newCompletedOrders);
            
            const updatedOrders = orders.map(o => {
                if (o.id === orderId) {
                    return { ...o, status: 'Pending' };
                }
                return o;
            });
            setOrders(updatedOrders);
            swal('Success', 'Order reverted to Pending status.', 'success');
        } catch (error) {
            console.error('Error reverting delivery:', error);
            swal('Error', 'Failed to revert delivery status.', 'error');
        }
    };

    const handleOpenMap = (destination) => {
        const destStr = destination ? String(destination) : '';
        if (!destStr || destStr.trim() === '') {
            swal('Warning', 'Delivery location is not specified.', 'warning');
            return;
        }
        const encodedDest = encodeURIComponent(destStr);
        const url = `https://www.google.com/maps/dir/?api=1&destination=${encodedDest}&travelmode=two-wheeler`;
        window.open(url, '_blank');
    };

    const handleOpenFines = async () => {
        try {
            let allFines = [];
            const res = await LogisticsService.getFines();
            if (res.data && Array.isArray(res.data)) {
                allFines = res.data;
            }

            // Filter by logged in user (Driver) or ledger
            const myFines = allFines.filter(f => {
                if (!f.driver_name || !loggedInName) return false;
                // Try exact match or partial match just in case of formatting issues
                const dName = f.driver_name.toLowerCase().trim();
                const lName = loggedInName.toLowerCase().trim();
                return dName === lName || dName.includes(lName) || lName.includes(dName);
            });
            
            setDriverFines(myFines);
            navigate('#fines');
        } catch (e) {
            console.error("Error opening fines modal:", e);
            swal("Error", "Could not open fines modal: " + e.message, "error");
        }
    };

    const handleFuelSubmit = async () => {
        if (!fuelServiceType || !fuelKM || !fuelLitres) {
            swal('Missing Fields', 'Please fill all required fields (Service Type, KM, Litres).', 'warning');
            return;
        }

        let assignedVehicle = null;
        if (driverInfo) {
            assignedVehicle = vehicles.find(v => v.driver === driverInfo.id || (v.driver_name && v.driver_name.toLowerCase() === loggedInName.toLowerCase()));
        }

        if (!assignedVehicle) {
            swal('Error', 'No vehicle assigned to you.', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('trans_date', fuelDate);
        formData.append('vehicle', assignedVehicle.id);
        if (driverInfo) {
            formData.append('default_driver', driverInfo.id);
        }
        formData.append('actual_km', fuelKM);
        formData.append('service_type', fuelServiceType);
        formData.append('fuel_liters', fuelLitres);
        if (fuelAttachment) {
            formData.append('attachment', fuelAttachment);
        }

        setFuelLoading(true);
        try {
            if (editingFuelId) {
                await LogisticsService.patchVehicleHistory(editingFuelId, formData);
                swal('Success', 'Fuel filling details updated successfully.', 'success');
            } else {
                await LogisticsService.createVehicleHistory(formData);
                swal('Success', 'Fuel filling details saved successfully.', 'success');
            }
            setShowFuelModal(false);
            setFuelKM('');
            setFuelLitres('');
            setFuelAttachment(null);
            setExistingFuelAttachment(null);
            setFuelServiceType('');
            setEditingFuelId(null);
        } catch (error) {
            console.error('Error saving fuel details:', error);
            swal('Error', 'Failed to save fuel filling details.', 'error');
        } finally {
            setFuelLoading(false);
        }
    };

    const fetchPreviousFuelFillings = async () => {
        try {
            const res = await LogisticsService.getVehicleHistories();
            if (res.data && Array.isArray(res.data)) {
                let filtered = res.data;
                if (driverInfo) {
                    filtered = res.data.filter(r => r.default_driver === driverInfo.id || (r.driver_name && r.driver_name.toLowerCase() === loggedInName.toLowerCase()));
                }
                filtered = filtered.filter(r => r.fuel_liters);
                setPreviousFuelFillings(filtered);
            }
        } catch (error) {
            console.error('Error fetching fuel fillings', error);
        }
    };

    const handleOpenFuelModal = () => {
        setFuelDate(new Date().toISOString().split('T')[0]);
        setFuelKM('');
        setFuelLitres('');
        setFuelAttachment(null);
        setExistingFuelAttachment(null);
        setFuelServiceType('');
        setEditingFuelId(null);
        setShowFuelModal(true);
        fetchPreviousFuelFillings();
    };

    const handleEditFuelFilling = (req) => {
        setFuelDate(req.trans_date || new Date().toISOString().split('T')[0]);
        setFuelKM(req.actual_km || '');
        setFuelLitres(req.fuel_liters || '');
        setFuelServiceType(String(req.service_type) || '');
        setFuelAttachment(null); 
        setExistingFuelAttachment(req.attachment || null);
        setEditingFuelId(req.id);
    };

    const handleServiceRequestSubmit = async () => {
        if (!srServiceType || !srExpiryDate) {
            swal('Missing Fields', 'Please fill Service Type and Expiry Date.', 'warning');
            return;
        }
        if (!allServiceTypes.some(st => String(st.id) === String(srServiceType))) {
            swal('Invalid Field', 'Please select a valid Service Type from the list.', 'warning');
            return;
        }

        let assignedVehicle = null;
        if (driverInfo) {
            assignedVehicle = vehicles.find(v => v.driver === driverInfo.id || (v.driver_name && v.driver_name.toLowerCase() === loggedInName.toLowerCase()));
        }

        if (!assignedVehicle) {
            swal('Error', 'No vehicle assigned to you.', 'error');
            return;
        }

        const data = {
            date: new Date().toISOString().split('T')[0],
            vehicle: assignedVehicle.id,
            service_type: srServiceType,
            expiry_date: srExpiryDate,
            narration: srNarration
        };
        if (driverInfo) {
            data.driver = driverInfo.id;
        }

        setSrLoading(true);
        try {
            if (editingSrId) {
                await LogisticsService.patchServiceRequest(editingSrId, data);
                swal('Success', 'Service request updated successfully.', 'success');
            } else {
                await LogisticsService.createServiceRequest(data);
                swal('Success', 'Service request saved successfully.', 'success');
            }
            setShowServiceRequestModal(false);
            setSrServiceType('');
            setSrExpiryDate('');
            setSrNarration('');
            setEditingSrId(null);
        } catch (error) {
            console.error('Error saving service request:', error);
            swal('Error', 'Failed to save service request.', 'error');
        } finally {
            setSrLoading(false);
        }
    };

    const fetchPreviousServiceRequests = async () => {
        try {
            const res = await LogisticsService.getServiceRequests();
            if (res.data && Array.isArray(res.data)) {
                let filtered = res.data;
                if (driverInfo) {
                    filtered = res.data.filter(r => r.driver === driverInfo.id || (r.driver_name && r.driver_name.toLowerCase() === loggedInName.toLowerCase()));
                }
                setPreviousServiceRequests(filtered);
            }
        } catch (error) {
            console.error('Error fetching service requests', error);
        }
    };

    const handleOpenServiceRequest = () => {
        setSrServiceType('');
        setSrExpiryDate('');
        setSrNarration('');
        setEditingSrId(null);
        setShowServiceRequestModal(true);
        fetchPreviousServiceRequests();
    };

    const handleEditServiceRequest = (req) => {
        setSrServiceType(req.service_type);
        setSrExpiryDate(req.expiry_date || '');
        setSrNarration(req.narration || '');
        setEditingSrId(req.id);
    };

    const fetchPreviousRoutes = async () => {
        try {
            const res = await LogisticsService.getRoutes();
            if (res.data && Array.isArray(res.data)) {
                let filtered = res.data;
                if (driverInfo) {
                    filtered = res.data.filter(r => r.driver === driverInfo.id);
                }
                setPreviousRoutes(filtered);
            }
        } catch (error) {
            console.error('Error fetching routes', error);
        }
    };

    const handleOpenChangeRouteModal = () => {
        setRouteLegs([{ from: '', to: '' }]);
        setEditingRouteId(null);
        setShowChangeRouteModal(true);
        fetchPreviousRoutes();
    };

    const handleEditRoute = (req) => {
        if (req.logs && req.logs.length > 0) {
            const sortedLogs = [...req.logs].sort((a, b) => a.order_index - b.order_index);
            const formattedLegs = sortedLogs.map(l => ({ from: l.from_location, to: l.to_location }));
            setRouteLegs(formattedLegs);
        } else {
            setRouteLegs([{ from: '', to: '' }]);
        }
        setEditingRouteId(req.id);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: T.surface, gap: '20px' }}>
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap');
                    @keyframes spin    { to { transform:rotate(360deg) } }
                    @keyframes pulse   { 0%,100%{ opacity:1 } 50%{ opacity:.45 } }
                `}</style>
                <div style={{ width: '48px', height: '48px', border: `3px solid ${T.cloud}`, borderTopColor: T.accent, borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
                <div style={{ textAlign: 'center' }}>
                    <p style={{ color: T.ink, fontWeight: '700', fontSize: '0.95rem', margin: '0 0 4px', fontFamily: "'DM Sans',sans-serif" }}>Preparing Driver Dashboard</p>
                </div>
            </div>
        );
    }

    return (
        <div className="driver-wrapper" style={{ maxWidth: '600px', margin: '0 auto', background: T.surface, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans','Inter',sans-serif", overflow: 'hidden' }}>
            {/* Global CSS */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Serif+Display&display=swap');
                @keyframes slideUp { from { transform:translateY(8px);opacity:0 } to { transform:translateY(0);opacity:1 } }
                .driver-input:focus { border-color:${T.accent}!important; box-shadow:0 0 0 3px ${T.accentGlow}!important; }
                .driver-card  { animation:slideUp 0.22s ease both; }
                .driver-card2 { animation:slideUp 0.3s ease both; }
                
                .action-btn { transition:all 0.18s ease; }
                .action-btn:hover { opacity:0.92; transform:translateY(-1px); }
                .action-btn:active { transform:translateY(0); }
                
                .split-btn-container {
                    display: flex;
                    flex-direction: row;
                    gap: 10px;
                    align-items: center;
                }
                
                .bottom-card {
                    background: ${T.white};
                    border-radius: ${T.rMd};
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    box-shadow: ${T.shSm};
                    border: 1px solid ${T.cloud};
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .bottom-card:hover {
                    box-shadow: ${T.shMd};
                    border-color: #d2dce8;
                    transform: translateY(-2px);
                }
                .bottom-card .icon-wrapper {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.4rem;
                }
                
                /* Layout */
                @media (max-width: 600px) {
                    .order-card-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 12px !important;
                        padding: 16px !important;
                    }
                    .order-card-info {
                        width: 100% !important;
                        align-items: flex-start !important;
                        gap: 12px !important;
                    }
                    .order-card-icon {
                        width: 40px !important;
                        height: 40px !important;
                        font-size: 1.2rem !important;
                        border-radius: 12px !important;
                    }
                    .order-card-badge {
                        margin-bottom: 4px !important;
                    }
                    .order-card-badge > div {
                        font-size: 0.7rem !important;
                        padding: 2px 6px !important;
                    }
                    .order-customer-name {
                        font-size: 1.05rem !important;
                        margin-bottom: 4px !important;
                        line-height: 1.3 !important;
                    }
                    .order-customer-phone {
                        font-size: 0.75rem !important;
                    }
                    .order-card-actions {
                        width: 100% !important;
                        flex-direction: row !important;
                        align-items: stretch !important;
                        gap: 8px !important;
                    }
                    .order-card-actions button {
                        justify-content: center !important;
                        padding: 6px 12px !important;
                        font-size: 0.75rem !important;
                    }
                    .btn-map {
                        flex: 1 !important;
                        width: auto !important;
                    }
                    .order-card-actions > *:not(.btn-map) {
                        flex: 3 !important;
                        width: auto !important;
                    }
                    .split-btn-container {
                        display: flex !important;
                        flex-direction: row !important;
                        gap: 8px !important;
                        width: 100% !important;
                    }
                    .split-btn-container button {
                        width: auto !important;
                        flex: 1 !important;
                    }
                    .mobile-date-location {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 4px !important;
                        font-size: 0.8rem !important;
                    }
                }

                @media (min-width: 900px) {
                    .driver-wrapper { max-width: 100% !important; height: 100vh !important; }
                    .driver-body { 
                        display: flex !important;
                        flex-direction: column;
                        padding: 40px !important;
                    }
                    .driver-content {
                        width: 100%;
                        max-width: 100%;
                        display: grid;
                        gap: 40px;
                        align-items: start;
                    }
                    .driver-content.operations-layout {
                        grid-template-columns: 1fr;
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    .driver-content.orders-layout {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div style={{
                background: 'linear-gradient(160deg, #0f1e45 0%, #1a2f6b 55%, #243580 100%)',
                padding: '18px 20px 22px',
                borderBottomLeftRadius: '32px',
                borderBottomRightRadius: '32px',
                color: T.white,
                boxShadow: '0 12px 36px rgba(15,30,69,0.22)',
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0,
            }}>
                <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '280px', height: '280px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '180px', height: '180px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                    <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.28)', borderRadius: '20px', padding: '3px 10px', marginBottom: '10px' }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: T.gold, display: 'inline-block' }} />
                            <span style={{ fontSize: '0.63rem', fontWeight: '700', letterSpacing: '0.09em', color: T.gold, textTransform: 'uppercase' }}>Driver Connect</span>
                        </div>
                        <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: '1.7rem', fontWeight: '400', margin: '0', letterSpacing: '-0.01em', lineHeight: 1.15, color: T.white }}>
                            Load Details
                        </h1>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.48)', fontWeight: '400', whiteSpace: 'nowrap' }}>
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        <button
                            onClick={() => navigate(-1)}
                            style={{
                                background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.15)',
                                color: 'rgba(255,255,255,0.82)', padding: '7px 14px', borderRadius: '12px',
                                fontSize: '0.77rem', fontWeight: '600', cursor: 'pointer',
                                backdropFilter: 'blur(6px)', whiteSpace: 'nowrap',
                                fontFamily: 'inherit', letterSpacing: '0.01em', transition: 'background 0.18s',
                            }}
                        >← Back</button>
                    </div>
                </div>
            </div>

            {/* ── Body ────────────────────────────────────────────────────────── */}
            <div className="driver-body" style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
                <div style={{ maxWidth: '100%', marginBottom: '20px' }}>
                    {/* Pill toggle tabs */}
                    <div style={{ display: 'flex', background: T.cloud, borderRadius: T.rMd, padding: '4px', gap: '4px' }}>
                        {[
                            { key: 'orders', icon: '📦', label: 'My Orders', count: orders.length },
                            { key: 'operations', icon: '🚚', label: 'Load Details', count: null },
                        ].map(({ key, icon, label, count }) => {
                            const active = activeTab === key;
                            return (
                                <button key={key} type="button" onClick={() => navigate('#' + key)}
                                    style={{
                                        flex: 1, padding: '10px 16px', borderRadius: '10px', border: 'none',
                                        background: active ? T.white : 'transparent',
                                        color: active ? T.accent : T.slate,
                                        fontSize: '0.9rem', fontWeight: active ? '700' : '500',
                                        cursor: 'pointer', boxShadow: active ? '0 1px 3px rgba(15,22,36,0.06)' : 'none',
                                        fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        transition: 'all 0.18s ease'
                                    }}>
                                    <span>{icon} {label}</span>
                                    {count !== null && (
                                        <span style={{ background: active ? T.accentSoft : 'rgba(0,0,0,0.07)', color: active ? T.accent : T.slate, borderRadius: '8px', fontSize: '0.75rem', padding: '2px 8px', fontWeight: '700' }}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className={`driver-content ${activeTab === 'operations' ? 'operations-layout' : 'orders-layout'}`}>
                    
                    {activeTab === 'orders' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'slideUp 0.3s ease both' }}>
                            {orders.length > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        disabled={isJourneyCompleted}
                                        onClick={() => {
                                            if (isJourneyCompleted) return;
                                            if (isJourneyStarted) {
                                                setShowEndJourneyModal(true);
                                            } else {
                                                setShowStartJourneyModal(true);
                                            }
                                        }}
                                        style={{
                                            background: isJourneyCompleted ? T.slate : (isJourneyStarted ? T.success : `linear-gradient(135deg, ${T.accent} 0%, #2f49c5 100%)`),
                                            color: T.white, border: 'none', padding: '10px 18px', borderRadius: T.rMd,
                                            fontSize: '0.85rem', fontWeight: '700', cursor: isJourneyCompleted ? 'not-allowed' : 'pointer',
                                            boxShadow: isJourneyCompleted ? 'none' : (isJourneyStarted ? T.shSuccess : T.shAccent),
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            transition: 'all 0.2s ease',
                                            opacity: isJourneyCompleted ? 0.7 : 1
                                        }}
                                    >
                                        {isJourneyCompleted ? '✅ Shift Ended' : (isJourneyStarted ? '🏁 Finish' : '▶️ Start')}
                                    </button>
                                </div>
                            )}
                            {orders.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px 20px', background: T.white, borderRadius: T.rLg, border: `1px solid ${T.cloud}` }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📦</div>
                                    <h3 style={{ color: T.ink, fontFamily: "'DM Serif Display',serif" }}>No Assigned Orders</h3>
                                    <p style={{ color: T.slate, fontSize: '0.95rem' }}>You currently have no orders assigned to you.</p>
                                </div>
                            ) : (
                                [...orders].sort((a, b) => completedOrders.includes(a.id) - completedOrders.includes(b.id)).map((order, idx) => (
                                    <div key={order.id || idx} className="driver-card order-card-container" style={{
                                        background: T.white, borderRadius: T.rLg, padding: '24px',
                                        boxShadow: T.shSm, border: `1px solid ${T.cloud}`,
                                        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px',
                                        position: 'relative', overflow: 'hidden'
                                    }}>
                                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: order.status === 'Pending' ? '#f59e0b' : T.success }} />
                                        
                                        <div className="order-card-info" style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: '1 1 auto', paddingLeft: '8px' }}>
                                            <div className="order-card-icon" style={{
                                                width: '56px', height: '56px', borderRadius: '16px',
                                                background: T.accentSoft, color: T.accent,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '1.6rem', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5)',
                                                flexShrink: 0
                                            }}>
                                                📦
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div className="order-card-badge" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: '800', color: T.accent, letterSpacing: '0.05em', textTransform: 'uppercase', background: 'rgba(59,91,219,0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                                                        {order.so_no}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: T.slate, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                        {(() => {
                                                            const dt = order.preferred_delivery_date || order.delivery_date || order.entry_date || '';
                                                            if (!dt) return '';
                                                            let str = dt.replace('T', ' ');
                                                            let [datePart, timePart] = str.split(' ');
                                                            if (datePart) {
                                                                const dp = datePart.split('-');
                                                                if (dp.length === 3) datePart = `${dp[2]}-${dp[1]}-${dp[0]}`;
                                                            }
                                                            if (timePart) {
                                                                const tp = timePart.split(':');
                                                                if (tp.length >= 2) {
                                                                    let h = parseInt(tp[0], 10);
                                                                    const ampm = h >= 12 ? 'PM' : 'AM';
                                                                    h = h % 12 || 12;
                                                                    const hh = h < 10 ? '0' + h : h;
                                                                    timePart = `${hh}:${tp[1]} ${ampm}`;
                                                                }
                                                                return `${datePart} ${timePart}`;
                                                            }
                                                            return datePart;
                                                        })()}
                                                    </div>
                                                </div>
                                                <div className="order-customer-name" style={{ fontSize: '1.25rem', fontWeight: '700', color: T.ink, marginBottom: '6px', fontFamily: "'DM Serif Display',serif", display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.customer_ledger_name || 'Unknown Party'}</span>
                                                    <span className="order-customer-phone" style={{ fontSize: '0.85rem', color: T.slate, fontWeight: '500', fontFamily: "'DM Sans',sans-serif" }}>
                                                        {ledgers.find(l => String(l.id) === String(order.customer_ledger))?.phone ? ledgers.find(l => String(l.id) === String(order.customer_ledger)).phone : ''}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: T.slate, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', width: '100%' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                                        {order.delivery_location_name || order.delivery_location || 'Standard Location'}
                                                    </span>
                                                    <span 
                                                        onClick={() => setViewingOrder(order)}
                                                        style={{ color: T.accent, fontWeight: '700', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
                                                    >
                                                        View Details
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="order-card-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'nowrap', width: '100%', maxWidth: '280px', marginLeft: 'auto' }}>
                                            {completedOrders.includes(order.id) ? (
                                                <div className="split-btn-container" style={{ flex: 3, margin: 0, width: 'auto' }}>
                                                    <button 
                                                        disabled={!isJourneyStarted}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRevertDelivery(order.id);
                                                        }}
                                                        style={{
                                                            background: !isJourneyStarted ? T.cloud : '#f59e0b', 
                                                            color: !isJourneyStarted ? T.slate : T.white, border: 'none',
                                                            padding: '8px 16px', borderRadius: T.rMd,
                                                            fontSize: '0.8rem', fontWeight: '700', 
                                                            cursor: !isJourneyStarted ? 'not-allowed' : 'pointer',
                                                            display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
                                                            boxShadow: !isJourneyStarted ? 'none' : '0 8px 16px rgba(245, 158, 11, 0.25)',
                                                            transition: 'all 0.2s ease',
                                                            opacity: !isJourneyStarted ? 0.6 : 1
                                                        }}
                                                        onMouseEnter={(e) => { if (isJourneyStarted) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(245, 158, 11, 0.35)'; } }}
                                                        onMouseLeave={(e) => { if (isJourneyStarted) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(245, 158, 11, 0.25)'; } }}
                                                    >
                                                        <span style={{ fontSize: '0.9rem' }}>↩️</span> Revert
                                                    </button>
                                                    <button 
                                                        disabled={!isJourneyStarted}
                                                        style={{
                                                            background: !isJourneyStarted ? T.cloud : T.success, 
                                                            color: !isJourneyStarted ? T.slate : T.white, border: 'none',
                                                            padding: '8px 16px', borderRadius: T.rMd,
                                                            fontSize: '0.8rem', fontWeight: '700', 
                                                            cursor: 'default',
                                                            display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
                                                            boxShadow: !isJourneyStarted ? 'none' : T.shSuccess,
                                                            opacity: !isJourneyStarted ? 0.6 : 1
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '0.9rem' }}>✅</span> Done
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    disabled={!isJourneyStarted}
                                                    style={{
                                                        flex: 3,
                                                        background: !isJourneyStarted ? T.cloud : `linear-gradient(160deg, #0f1e45 0%, #1a2f6b 55%, #243580 100%)`, 
                                                        color: !isJourneyStarted ? T.slate : T.white, border: 'none',
                                                        padding: '8px 16px', borderRadius: T.rMd,
                                                        fontSize: '0.8rem', fontWeight: '700', 
                                                        cursor: !isJourneyStarted ? 'not-allowed' : 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                        boxShadow: !isJourneyStarted ? 'none' : '0 8px 16px rgba(15,30,69,0.25)',
                                                        transition: 'all 0.2s ease',
                                                        opacity: !isJourneyStarted ? 0.6 : 1
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedOrderId(order.id);
                                                        setSelectedLedgerId(String(order.customer_ledger));
                                                        setCash('');
                                                        setReturnQuantity('');
                                                        setNarration('');
                                                        setShowDeliveryModal(true);
                                                    }}
                                                    onMouseEnter={(e) => { if (isJourneyStarted) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(15,30,69,0.35)'; } }}
                                                    onMouseLeave={(e) => { if (isJourneyStarted) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(15,30,69,0.25)'; } }}
                                                >
                                                    <span style={{ fontSize: '0.9rem' }}>🚚</span> Deliver
                                                </button>
                                            )}
                                            <button
                                                className="btn-map"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenMap(order.delivery_location_name);
                                                }}
                                                style={{
                                                    background: T.surface, 
                                                    border: `1px solid ${T.cloud}`,
                                                    borderRadius: T.rMd,
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'all 0.2s ease', flex: 1, minHeight: '38px'
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = T.cloud; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = T.surface; }}
                                                title="View on Map"
                                            >
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="url(#mapPinGradient)">
                                                    <defs>
                                                        <linearGradient id="mapPinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                                            <stop offset="0%" stopColor="#ea4335" />
                                                            <stop offset="33%" stopColor="#fbbc04" />
                                                            <stop offset="66%" stopColor="#34a853" />
                                                            <stop offset="100%" stopColor="#4285f4" />
                                                        </linearGradient>
                                                    </defs>
                                                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <>


                    {/* ── 4 Cards Grid ────────────────────────────────────────────── */}
                    <div className="driver-card2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        
                        <button 
                            className="bottom-card" 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenChangeRouteModal(); }} 
                            style={{ cursor: 'pointer', zIndex: 10, width: '100%', border: '1px solid #eef1f6', background: '#fff' }}
                        >
                            <div className="icon-wrapper" style={{ background: '#fff0f0', color: '#ff6b6b' }}>🗺️</div>
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: T.ink, textAlign: 'center' }}>Change Route</span>
                        </button>
                        
                        <button 
                            className="bottom-card" 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTransactionsModal(true); }} 
                            style={{ cursor: 'pointer', zIndex: 10, width: '100%', border: '1px solid #eef1f6', background: '#fff' }}
                        >
                            <div className="icon-wrapper" style={{ background: '#f0f4ff', color: '#3b5bdb' }}>💳</div>
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: T.ink, textAlign: 'center' }}>Transactions</span>
                        </button>
                        
                        <button 
                            className="bottom-card" 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowVehicleDetailsModal(true); }} 
                            style={{ cursor: 'pointer', zIndex: 10, width: '100%', border: '1px solid #eef1f6', background: '#fff' }}
                        >
                            <div className="icon-wrapper" style={{ background: '#fdf4e7', color: '#f59f00' }}>🚚</div>
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: T.ink, textAlign: 'center' }}>Vehicle Details</span>
                        </button> 
                        
                        <button 
                            className="bottom-card" 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenFines(); }} 
                            style={{ cursor: 'pointer', zIndex: 10, width: '100%', border: '1px solid #eef1f6', background: '#fff' }}
                        >
                            <div className="icon-wrapper" style={{ background: '#f3f0ff', color: '#845ef7' }}>🎫</div>
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: T.ink, textAlign: 'center' }}>Fines & Tokens</span>
                        </button>

                        <button 
                            className="bottom-card" 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenFuelModal(); }} 
                            style={{ cursor: 'pointer', zIndex: 10, width: '100%', border: '1px solid #eef1f6', background: '#fff' }}
                        >
                            <div className="icon-wrapper" style={{ background: '#e6fcf5', color: '#0ca678' }}>⛽</div>
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: T.ink, textAlign: 'center' }}>Fuel Filling</span>
                        </button>

                        <button 
                            className="bottom-card" 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenServiceRequest(); }} 
                            style={{ cursor: 'pointer', zIndex: 10, width: '100%', border: '1px solid #eef1f6', background: '#fff' }}
                        >
                            <div className="icon-wrapper" style={{ background: '#fff4e6', color: '#d9480f' }}>🔧</div>
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: T.ink, textAlign: 'center' }}>Service Request</span>
                        </button>

                    </div>
                        </>
                    )}

                </div>
            </div>

            {/* ── Delivery Modal ────────────────────────────────────────────── */}
            {showDeliveryModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                    backgroundColor: 'rgba(15, 22, 36, 0.6)', backdropFilter: 'blur(4px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div className="driver-card" style={{
                        background: T.white, borderRadius: T.rXl, padding: '24px',
                        width: '100%', maxWidth: '450px', boxShadow: T.shMd,
                        display: 'flex', flexDirection: 'column', gap: '16px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', color: T.ink, fontFamily: "'DM Serif Display',serif" }}>Complete Delivery</h2>
                            <button onClick={() => setShowDeliveryModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: T.slate }}>✖</button>
                        </div>
                        
                        <div>
                            <label style={fieldLabel}>Cash (Optional)</label>
                            <input 
                                type="number" className="driver-input" style={fieldBase}
                                placeholder="E.g. 500"
                                value={cash} onChange={(e) => setCash(e.target.value)}
                            />
                        </div>

                        <div>
                            <label style={fieldLabel}>Return Quantity</label>
                            <input 
                                type="number" className="driver-input" style={fieldBase}
                                placeholder="E.g. 0"
                                value={returnQuantity} onChange={(e) => setReturnQuantity(e.target.value)}
                            />
                        </div>

                        <div>
                            <label style={fieldLabel}>Narration</label>
                            <textarea 
                                className="driver-input" style={{ ...fieldBase, minHeight: '80px', resize: 'vertical' }}
                                placeholder="Any additional notes..."
                                value={narration} onChange={(e) => setNarration(e.target.value)}
                            />
                        </div>

                        <div style={{ marginTop: '10px' }}>
                            <button 
                                onClick={handleCompleteDelivery}
                                style={{
                                    width: '100%', padding: '12px',
                                    borderRadius: T.rMd, border: 'none',
                                    background: `linear-gradient(135deg, #059669 0%, ${T.success} 100%)`,
                                    color: '#fff', fontSize: '1rem', fontWeight: '700', cursor: 'pointer',
                                    boxShadow: T.shSuccess, display: 'flex', justifyContent: 'center', gap: '8px'
                                }}
                            >
                                ✅ SUBMIT
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Transactions Modal ────────────────────────────────────────────── */}
            {showTransactionsModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 22, 36, 0.6)', backdropFilter: 'blur(4px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div className="driver-card" style={{
                        background: T.white, borderRadius: T.rXl, padding: '24px',
                        width: '100%', maxWidth: '500px', boxShadow: T.shMd,
                        display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '85vh', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f0f4ff', color: '#3b5bdb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>💳</div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: T.ink, fontFamily: "'DM Serif Display',serif" }}>Transactions</h2>
                                    <span style={{ fontSize: '0.85rem', color: T.slate }}>Your Completed and Pending Orders</span>
                                </div>
                            </div>
                            <button onClick={() => setShowTransactionsModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: T.slate }}>✖</button>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '600', color: T.slate }}>From Date</label>
                                <input type="date" value={transactionsFromDate} onChange={(e) => setTransactionsFromDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: T.rMd, border: '1px solid #eef1f6', outline: 'none', fontSize: '0.9rem', color: T.ink, fontFamily: 'inherit' }} />
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '600', color: T.slate }}>To Date</label>
                                <input type="date" value={transactionsToDate} onChange={(e) => setTransactionsToDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: T.rMd, border: '1px solid #eef1f6', outline: 'none', fontSize: '0.9rem', color: T.ink, fontFamily: 'inherit' }} />
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
                            {(() => {
                                const filteredOrders = orders.filter(order => {
                                    const orderDate = order.entry_date || (order.created_at ? order.created_at.split('T')[0] : null);
                                    if (transactionsFromDate && orderDate && orderDate < transactionsFromDate) return false;
                                    if (transactionsToDate && orderDate && orderDate > transactionsToDate) return false;
                                    return true;
                                });
                                const pendingFiltered = filteredOrders.filter(o => !completedOrders.includes(o.id));
                                const completedFiltered = filteredOrders.filter(o => completedOrders.includes(o.id));
                                
                                return (
                                    <>
                                        <div>
                                            <h3 style={{ fontSize: '1rem', color: T.ink, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #eef1f6', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Pending Orders</span>
                                                <span style={{ background: '#fff0f0', color: '#ff6b6b', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>{pendingFiltered.length}</span>
                                            </h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {pendingFiltered.length === 0 ? (
                                                    <div style={{ fontSize: '0.85rem', color: T.slate, fontStyle: 'italic' }}>No pending orders.</div>
                                                ) : (
                                                    pendingFiltered.map(order => (
                                                        <div key={order.id} style={{ padding: '12px', borderRadius: T.rMd, border: '1px solid #eef1f6', background: T.surface }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                                <span style={{ fontWeight: '600', color: T.ink, fontSize: '0.9rem' }}>{order.customer_ledger_name}</span>
                                                                <span style={{ fontSize: '0.8rem', color: T.slate }}>{order.so_no}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: T.slate }}>
                                                                <span>Status: <span style={{ color: '#f59f00', fontWeight: '600' }}>{order.status}</span></span>
                                                                <span>{order.entry_date || (order.created_at ? order.created_at.split('T')[0] : '')}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <h3 style={{ fontSize: '1rem', color: T.ink, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #eef1f6', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Completed Orders</span>
                                                <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: T.success, padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>{completedFiltered.length}</span>
                                            </h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {completedFiltered.length === 0 ? (
                                                    <div style={{ fontSize: '0.85rem', color: T.slate, fontStyle: 'italic' }}>No completed orders yet.</div>
                                                ) : (
                                                    completedFiltered.map(order => (
                                                        <div key={order.id} style={{ padding: '12px', borderRadius: T.rMd, border: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.02)' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                                <span style={{ fontWeight: '600', color: T.ink, fontSize: '0.9rem' }}>{order.customer_ledger_name}</span>
                                                                <span style={{ fontSize: '0.8rem', color: T.slate }}>{order.so_no}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: T.slate }}>
                                                                <span style={{ color: T.success, fontWeight: '600' }}>✓ Completed</span>
                                                                <span>{order.entry_date || (order.created_at ? order.created_at.split('T')[0] : '')}</span>
                                                            </div>
                                                            {(() => {
                                                                if (!order.narration) return null;
                                                                const parsed = parseNarrationForEdit(order.narration);
                                                                if (!parsed.cash && !parsed.returnQuantity && !parsed.notes) return null;
                                                                
                                                                return (
                                                                    <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px', fontSize: '0.75rem', color: T.slate }}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                            {parsed.cash && <div><strong>Cash Collected:</strong> {parsed.cash}</div>}
                                                                            {parsed.returnQuantity && <div><strong>Returned Qty:</strong> {parsed.returnQuantity}</div>}
                                                                            {parsed.notes && <div><strong>Notes:</strong> {parsed.notes}</div>}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Fuel Filling Modal ────────────────────────────────────────────── */}
            {showFuelModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 22, 36, 0.6)', backdropFilter: 'blur(4px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div className="driver-card" style={{
                        background: T.white, borderRadius: T.rXl, padding: '24px',
                        width: '100%', maxWidth: '450px', boxShadow: T.shMd,
                        display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#e6fcf5', color: '#0ca678', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>⛽</div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: T.ink, fontFamily: "'DM Serif Display',serif" }}>Fuel Filling</h2>
                                    <span style={{ fontSize: '0.85rem', color: T.slate }}>Enter fuel details below</span>
                                </div>
                            </div>
                            <button onClick={() => setShowFuelModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: T.slate }}>✖</button>
                        </div>

                        {(() => {
                            let assignedVehicle = null;
                            if (driverInfo) {
                                assignedVehicle = vehicles.find(v => v.driver === driverInfo.id || (v.driver_name && v.driver_name.toLowerCase() === loggedInName.toLowerCase()));
                            }
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                                    <div style={{ 
                                        padding: '16px', 
                                        background: '#f8f9fa', 
                                        borderRadius: T.rLg, 
                                        textAlign: 'center',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }}>
                                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#111827' }}>
                                            {driverInfo ? driverInfo.name : loggedInName}
                                        </div>
                                        <div style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: '500' }}>
                                            {assignedVehicle ? `${assignedVehicle.vehicle_name} • ${assignedVehicle.vehicle_number}` : 'No vehicle assigned'}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>
                                            {(() => {
                                                const d = new Date(fuelDate);
                                                return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
                                            })()}
                                        </div>
                                    </div>

                                    <div>
                                        <label style={fieldLabel}>Service Type</label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            {serviceTypes.map(st => {
                                                const isSelected = fuelServiceType === String(st.id);
                                                return (
                                                    <button
                                                        key={st.id}
                                                        type="button"
                                                        onClick={() => setFuelServiceType(String(st.id))}
                                                        style={{
                                                            flex: 1,
                                                            padding: '10px',
                                                            borderRadius: T.rMd,
                                                            border: `1.5px solid ${isSelected ? T.accent : T.cloud}`,
                                                            background: isSelected ? 'rgba(59,91,219,0.08)' : T.white,
                                                            color: isSelected ? T.accent : T.slate,
                                                            fontWeight: '700',
                                                            fontSize: '0.9rem',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s ease',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '6px'
                                                        }}
                                                    >
                                                        {st.service_type.toLowerCase().includes('petrol') ? 'Petrol' : 'Diesel'}
                                                    </button>
                                                );
                                            })}
                                            {serviceTypes.length === 0 && (
                                                <div style={{ padding: '10px', fontSize: '0.85rem', color: T.danger, fontStyle: 'italic', background: '#fff0f0', borderRadius: T.rMd, border: '1px solid #ffe3e3', width: '100%' }}>
                                                    ⚠️ Please create 'Petrol' or 'Diesel' in the Service Types master first.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={fieldLabel}>KM Reading</label>
                                            <input 
                                                type="number" className="driver-input" style={fieldBase}
                                                placeholder="e.g., 45000"
                                                value={fuelKM} onChange={(e) => setFuelKM(e.target.value)}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={fieldLabel}>Litres</label>
                                            <input 
                                                type="number" className="driver-input" style={fieldBase}
                                                placeholder="e.g., 20" step="0.01"
                                                value={fuelLitres} onChange={(e) => setFuelLitres(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={fieldLabel}>Attachment (Optional)</label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button
                                                type="button"
                                                className="driver-input action-btn"
                                                onClick={() => setShowFuelCameraModal(true)}
                                                style={{ ...fieldBase, padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', flex: 1, background: T.accentSoft, color: T.accent, border: `1px dashed ${T.accent}`, margin: 0 }}
                                            >
                                                📷 Camera
                                            </button>

                                            <input 
                                                type="file" id="fuel-file" style={{ display: 'none' }}
                                                onChange={(e) => setFuelAttachment(e.target.files[0])}
                                                accept="image/*,.pdf"
                                            />
                                            <label htmlFor="fuel-file" className="driver-input action-btn" style={{ ...fieldBase, padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', flex: 1, margin: 0 }}>
                                                📁 Upload File
                                            </label>
                                        </div>
                                        {fuelAttachment && (
                                            <div style={{ fontSize: '0.85rem', color: T.success, marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                ✅ <span>{fuelAttachment.name}</span>
                                            </div>
                                        )}
                                        {existingFuelAttachment && !fuelAttachment && (
                                            <div style={{ fontSize: '0.8rem', color: T.slate, marginTop: '6px' }}>
                                                Current: <a href={existingFuelAttachment} target="_blank" rel="noreferrer" style={{ color: T.accent, textDecoration: 'underline' }}>View Attachment</a>
                                                <br/>
                                                <span style={{ fontSize: '0.75rem', color: T.slate, fontStyle: 'italic' }}>(Select a new file to replace)</span>
                                            </div>
                                        )}
                                    </div>

                                    <button 
                                        onClick={handleFuelSubmit}
                                        disabled={fuelLoading || !assignedVehicle}
                                        style={{
                                            width: '100%', padding: '12px', marginTop: '10px',
                                            borderRadius: T.rMd, border: 'none',
                                            background: (fuelLoading || !assignedVehicle) ? T.slate : 'linear-gradient(135deg, #0f1e45 0%, #243580 100%)',
                                            color: '#fff', fontSize: '1rem', fontWeight: '700', cursor: (fuelLoading || !assignedVehicle) ? 'not-allowed' : 'pointer',
                                            boxShadow: (fuelLoading || !assignedVehicle) ? 'none' : '0 6px 16px rgba(15, 30, 69, 0.3)',
                                            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                                        }}
                                    >
                                        {fuelLoading ? 'Saving...' : (editingFuelId ? '✅ Save Fuel Details' : '✅ Submit Fuel Details')}
                                    </button>
                                </div>
                            );
                        })()}

                        {/* ── Previous Fuel Fillings ── */}
                        {previousFuelFillings.length > 0 && (
                            <div style={{ marginTop: '20px' }}>
                                <h3 style={{ fontSize: '1.05rem', color: T.ink, fontFamily: "'DM Serif Display',serif", marginBottom: '12px' }}>Previous Fillings</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {previousFuelFillings.map(req => {
                                        const sType = serviceTypes.find(st => String(st.id) === String(req.service_type))?.service_type || 'Unknown';
                                        return (
                                            <div key={req.id} style={{
                                                padding: '12px', borderRadius: T.rMd, border: `1px solid ${T.cloud}`,
                                                background: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                            }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ fontWeight: '700', color: T.ink, fontSize: '0.9rem' }}>{sType} - {req.fuel_liters}L</span>
                                                    <span style={{ fontSize: '0.75rem', color: T.slate }}>
                                                        Date: {req.trans_date ? req.trans_date.split('-').reverse().join('-') : 'N/A'} | KM: {req.actual_km}
                                                    </span>
                                                </div>
                                                <button 
                                                    onClick={() => handleEditFuelFilling(req)}
                                                    style={{
                                                        padding: '8px', borderRadius: T.rSm, border: 'none',
                                                        background: T.accentSoft, color: T.accent,
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                    title="Edit Filling"
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 20h9"></path>
                                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                                    </svg>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Service Request Modal ────────────────────────────────────────────── */}
            {showServiceRequestModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 22, 36, 0.6)', backdropFilter: 'blur(4px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div className="driver-card" style={{
                        background: T.white, borderRadius: T.rXl, padding: '24px',
                        width: '100%', maxWidth: '450px', boxShadow: T.shMd,
                        display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fff4e6', color: '#d9480f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🔧</div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: T.ink, fontFamily: "'DM Serif Display',serif" }}>Service Request</h2>
                                    <span style={{ fontSize: '0.85rem', color: T.slate }}>Enter service details below</span>
                                </div>
                            </div>
                            <button onClick={() => setShowServiceRequestModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: T.slate }}>✖</button>
                        </div>

                        {(() => {
                            let assignedVehicle = null;
                            if (driverInfo) {
                                assignedVehicle = vehicles.find(v => v.driver === driverInfo.id || (v.driver_name && v.driver_name.toLowerCase() === loggedInName.toLowerCase()));
                            }
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                                    <div style={{ 
                                        padding: '16px', 
                                        background: '#f8f9fa', 
                                        borderRadius: T.rLg, 
                                        textAlign: 'center',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }}>
                                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#111827' }}>
                                            {driverInfo ? driverInfo.name : loggedInName}
                                        </div>
                                        <div style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: '500' }}>
                                            {assignedVehicle ? `${assignedVehicle.vehicle_name} • ${assignedVehicle.vehicle_number}` : 'No vehicle assigned'}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>
                                            {(() => {
                                                const d = new Date();
                                                return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
                                            })()}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <label style={fieldLabel}>Service Type</label>
                                            <Select
                                                styles={customSelectStyles}
                                                placeholder="-- Select --"
                                                isSearchable
                                                options={allServiceTypes.map(st => ({ value: st.id, label: st.service_type }))}
                                                value={
                                                    allServiceTypes.find(st => String(st.id) === String(srServiceType))
                                                        ? { value: srServiceType, label: allServiceTypes.find(st => String(st.id) === String(srServiceType)).service_type }
                                                        : null
                                                }
                                                onChange={(selectedOption) => {
                                                    setSrServiceType(selectedOption ? selectedOption.value : '');
                                                }}
                                            />
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <label style={fieldLabel}>Expiry Date</label>
                                            <input 
                                                type="date" className="driver-input" style={fieldBase}
                                                value={srExpiryDate} onChange={(e) => setSrExpiryDate(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label style={fieldLabel}>Narration</label>
                                        <textarea 
                                            className="driver-input" style={{...fieldBase, minHeight: '80px', resize: 'vertical'}}
                                            placeholder="Any additional details..."
                                            value={srNarration} onChange={(e) => setSrNarration(e.target.value)}
                                        />
                                    </div>

                                    <button 
                                        onClick={handleServiceRequestSubmit}
                                        disabled={srLoading || !assignedVehicle}
                                        style={{
                                            width: '100%', padding: '12px', marginTop: '10px',
                                            borderRadius: T.rMd, border: 'none',
                                            background: (srLoading || !assignedVehicle) ? T.slate : 'linear-gradient(135deg, #0f1e45 0%, #243580 100%)',
                                            color: '#fff', fontSize: '1rem', fontWeight: '700', cursor: (srLoading || !assignedVehicle) ? 'not-allowed' : 'pointer',
                                            boxShadow: (srLoading || !assignedVehicle) ? 'none' : '0 6px 16px rgba(15, 30, 69, 0.3)',
                                            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                                        }}
                                    >
                                        {srLoading ? 'Saving...' : (editingSrId ? '✅ Save Service Request' : '✅ Submit Service Request')}
                                    </button>
                                </div>
                            );
                        })()}

                        {/* ── Previous Service Requests ── */}
                        {previousServiceRequests.length > 0 && (
                            <div style={{ marginTop: '20px' }}>
                                <h3 style={{ fontSize: '1.05rem', color: T.ink, fontFamily: "'DM Serif Display',serif", marginBottom: '12px' }}>Previous Requests</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {previousServiceRequests.map(req => {
                                        const sType = allServiceTypes.find(st => st.id === req.service_type)?.service_type || 'Unknown';
                                        return (
                                            <div key={req.id} style={{
                                                padding: '12px', borderRadius: T.rMd, border: `1px solid ${T.cloud}`,
                                                background: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                            }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ fontWeight: '700', color: T.ink, fontSize: '0.9rem' }}>{sType}</span>
                                                    <span style={{ fontSize: '0.75rem', color: T.slate }}>
                                                        Exp: {req.expiry_date ? req.expiry_date.split('-').reverse().join('-') : 'N/A'}
                                                    </span>
                                                </div>
                                                <button 
                                                    onClick={() => handleEditServiceRequest(req)}
                                                    style={{
                                                        padding: '8px', borderRadius: T.rSm, border: 'none',
                                                        background: T.accentSoft, color: T.accent,
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                    title="Edit Request"
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 20h9"></path>
                                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                                    </svg>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Fines & Tokens Modal ────────────────────────────────────────────── */}
            {showFinesModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 22, 36, 0.6)', backdropFilter: 'blur(4px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div className="driver-card" style={{
                        background: T.white, borderRadius: T.rXl, padding: '24px 24px 24px 18px',
                        width: '100%', maxWidth: '550px', boxShadow: T.shMd,
                        display: 'flex', flexDirection: 'column', gap: '16px', height: '70vh', minHeight: '400px', maxHeight: '800px', overflow: 'hidden'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', paddingLeft: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f3f0ff', color: '#845ef7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🎫</div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: T.ink, fontFamily: "'DM Serif Display',serif" }}>Fines & Tokens</h2>
                                    <span style={{ fontSize: '0.85rem', color: T.slate }}>Your registered fines and tokens</span>
                                </div>
                            </div>
                            <button onClick={() => navigate('#operations')} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: T.slate, paddingRight: '6px' }}>✖</button>
                        </div>
                        
                        {(() => {
                            const filteredFines = driverFines.filter(fine => {
                                if (finesFromDate && fine.fine_date < finesFromDate) return false;
                                if (finesToDate && fine.fine_date > finesToDate) return false;
                                return true;
                            }).sort((a, b) => {
                                const aIsPaid = a.status === 'Paid';
                                const bIsPaid = b.status === 'Paid';
                                if (aIsPaid && !bIsPaid) return 1;
                                if (!aIsPaid && bIsPaid) return -1;
                                return new Date(b.fine_date || 0) - new Date(a.fine_date || 0);
                            });
                            
                            return (
                                <>
                                    <div style={{ display: 'flex', gap: '12px', paddingLeft: '6px', paddingRight: '6px' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ ...fieldLabel, fontSize: '0.75rem', marginBottom: '4px' }}>From Date</label>
                                            <input type="date" value={finesFromDate} onChange={e => setFinesFromDate(e.target.value)} style={{ ...fieldBase, padding: '8px 12px', minHeight: '38px', fontSize: '0.85rem' }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ ...fieldLabel, fontSize: '0.75rem', marginBottom: '4px' }}>To Date</label>
                                            <input type="date" value={finesToDate} onChange={e => setFinesToDate(e.target.value)} style={{ ...fieldBase, padding: '8px 12px', minHeight: '38px', fontSize: '0.85rem' }} />
                                        </div>
                                    </div>
                                    
                                    <div style={{ flex: 1, overflowY: 'auto', paddingLeft: '6px', paddingRight: '6px', paddingBottom: '12px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        {(() => {
                                            const pendingFines = filteredFines.filter(fine => fine.status !== 'Paid');
                                            const paidFines = filteredFines.filter(fine => fine.status === 'Paid');
                                            
                                            if (filteredFines.length === 0) {
                                                return (
                                                    <div style={{ textAlign: 'center', padding: '40px 20px', background: T.surface, borderRadius: T.rMd, border: '1px dashed #d2dce8' }}>
                                                        <span style={{ fontSize: '2rem', display: 'block', marginBottom: '10px' }}>🎉</span>
                                                        <h4 style={{ margin: 0, fontSize: '1rem', color: T.ink, fontWeight: '700' }}>No Fines Found</h4>
                                                        <p style={{ margin: 0, fontSize: '0.85rem', color: T.slate }}>You currently have no fines or tokens assigned to you.</p>
                                                    </div>
                                                );
                                            }

                                            const renderFineCard = (fine, isPaid) => (
                                                <div key={fine.id} style={{ 
                                                    padding: '14px', 
                                                    background: isPaid ? 'rgba(16, 185, 129, 0.02)' : '#fff', 
                                                    borderRadius: '12px', 
                                                    border: isPaid ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #eef1f6', 
                                                    display: 'flex', flexDirection: 'column', gap: '10px', 
                                                    boxShadow: isPaid ? 'none' : '0 2px 4px rgba(0,0,0,0.02)' 
                                                }}>
                                                    {/* Header */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontWeight: '600', color: T.ink, fontSize: '0.9rem' }}>{fine.fine_no}</span>
                                                            <span style={{ fontSize: '0.75rem', color: '#c4c8d0' }}>•</span>
                                                            <span style={{ fontSize: '0.8rem', color: T.slate }}>{fine.fine_date ? fine.fine_date.split('-').reverse().join('-') : ''}</span>
                                                        </div>
                                                        <span style={{ 
                                                            color: isPaid ? '#10b981' : '#f59f00', 
                                                            fontWeight: '700', 
                                                            fontSize: '0.8rem',
                                                        }}>
                                                            {isPaid ? '✓ Paid' : (fine.status || 'Pending')}
                                                        </span>
                                                    </div>

                                                    {/* Body */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                                        <div>
                                                            <div style={{ fontSize: '0.95rem', fontWeight: '700', color: T.ink }}>{fine.vehicle_name}</div>
                                                            {fine.vehicle_number && <div style={{ fontSize: '0.75rem', color: T.slate, marginTop: '2px', fontWeight: '600' }}>{fine.vehicle_number}</div>}
                                                        </div>
                                                        <div style={{ fontSize: '1.2rem', fontWeight: '800', color: T.danger }}>
                                                            {fine.amount}
                                                        </div>
                                                    </div>

                                                    {/* Footer */}
                                                    {(fine.narration || fine.attachment || fine.attachment_name) && (
                                                        <div style={{ borderTop: isPaid ? '1px dashed rgba(16, 185, 129, 0.2)' : '1px dashed #eef1f6', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            {fine.narration && (
                                                                <div style={{ fontSize: '0.8rem', color: T.slate, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                                                    <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>📝</span>
                                                                    <span style={{ fontStyle: fine.narration ? 'normal' : 'italic' }}>
                                                                        {fine.narration}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            
                                                            {(fine.attachment || fine.attachment_name) && (
                                                                <a href={fine.attachment} style={{ textDecoration: 'none', maxWidth: '100%' }}>
                                                                    <div style={{ fontSize: '0.75rem', color: T.accent, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', width: 'fit-content', overflow: 'hidden' }}>
                                                                        <span>📎</span>
                                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                            {fine.attachment_name || 'View Attachment'}
                                                                        </span>
                                                                    </div>
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                            
                                            return (
                                                <>
                                                    {/* Pending Fines */}
                                                    <div>
                                                        <h3 style={{ fontSize: '1rem', color: T.ink, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #eef1f6', display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>Pending Fines</span>
                                                            <span style={{ background: '#fff0f0', color: '#ff6b6b', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>{pendingFines.length}</span>
                                                        </h3>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                            {pendingFines.length === 0 ? (
                                                                <div style={{ fontSize: '0.85rem', color: T.slate, fontStyle: 'italic' }}>No pending fines.</div>
                                                            ) : (
                                                                pendingFines.map(fine => renderFineCard(fine, false))
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Paid Fines */}
                                                    <div>
                                                        <h3 style={{ fontSize: '1rem', color: T.ink, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #eef1f6', display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>Paid Fines</span>
                                                            <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: T.success, padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>{paidFines.length}</span>
                                                        </h3>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                            {paidFines.length === 0 ? (
                                                                <div style={{ fontSize: '0.85rem', color: T.slate, fontStyle: 'italic' }}>No paid fines yet.</div>
                                                            ) : (
                                                                paidFines.map(fine => renderFineCard(fine, true))
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                        </>
                    );
                })()}
            </div>
        </div>
    )}

            {/* ── Change Route Modal ─────────────────────────────────────────── */}
            {showChangeRouteModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                    backgroundColor: 'rgba(15, 22, 36, 0.6)', backdropFilter: 'blur(4px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div className="driver-card" style={{
                        background: T.white, borderRadius: T.rXl, padding: '24px',
                        width: '100%', maxWidth: '450px', boxShadow: T.shMd,
                        display: 'flex', flexDirection: 'column', gap: '16px',
                        maxHeight: '85vh', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fff0f0', color: '#ff6b6b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🗺️</div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: T.ink, fontFamily: "'DM Serif Display',serif" }}>Change Route</h2>
                                    <span style={{ fontSize: '0.85rem', color: T.slate }}>Add or modify trip legs</span>
                                </div>
                            </div>
                            <button onClick={() => setShowChangeRouteModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: T.slate }}>✖</button>
                        </div>
                        
                        {(() => {
                            const currentVehicle = vehicles.find(v => v.id.toString() === String(selectedVehicleId)) 
                                || vehicles.find(v => String(v.driver) === String(driverInfo?.id))
                                || vehicles[0] || {};
                            return (
                                <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'center' }}>
                                    <span style={{ fontWeight: '800', color: T.ink, fontSize: '1.1rem' }}>{driverInfo?.name || 'Unknown Driver'}</span>
                                    <span style={{ color: T.slate, fontSize: '0.9rem', fontWeight: '500' }}>
                                        {currentVehicle.vehicle_name || 'No Vehicle'} • {currentVehicle.vehicle_number || 'N/A'}
                                    </span>
                                    <span style={{ color: T.slate, fontSize: '0.8rem' }}>{new Date().toLocaleDateString()}</span>
                                </div>
                            );
                        })()}

                        <h3 style={{ fontSize: '1.05rem', color: T.ink, fontFamily: "'DM Serif Display',serif", margin: '4px 0 -4px 0' }}>Route Details</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {routeLegs.map((leg, index) => (
                                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', padding: '10px 12px', border: '1px solid #eef1f6', borderRadius: '12px' }}>
                                    <input
                                        type="text"
                                        value={leg.from}
                                        onChange={(e) => {
                                            const newLegs = [...routeLegs];
                                            newLegs[index].from = e.target.value;
                                            setRouteLegs(newLegs);
                                        }}
                                        className="driver-input"
                                        style={{ ...fieldBase, flex: 1, margin: 0, padding: '8px 12px', fontSize: '0.9rem' }}
                                        placeholder="From"
                                    />
                                    <input
                                        type="text"
                                        value={leg.to}
                                        onChange={(e) => {
                                            const newLegs = [...routeLegs];
                                            newLegs[index].to = e.target.value;
                                            setRouteLegs(newLegs);
                                        }}
                                        className="driver-input"
                                        style={{ ...fieldBase, flex: 1, margin: 0, padding: '8px 12px', fontSize: '0.9rem' }}
                                        placeholder="To"
                                    />
                                    <div style={{ width: '32px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                                        {index === routeLegs.length - 1 && (
                                            <button 
                                                onClick={() => {
                                                    const newLegs = [...routeLegs, { from: leg.to, to: '' }];
                                                    setRouteLegs(newLegs);
                                                }}
                                                style={{
                                                    background: '#e6fcf5', color: '#0ca678', border: 'none', borderRadius: '50%',
                                                    width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold'
                                                }}
                                                title="Add another leg"
                                            >
                                                +
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <button 
                            onClick={async () => {
                                const currentVehicle = vehicles.find(v => v.id.toString() === String(selectedVehicleId)) 
                                    || vehicles.find(v => String(v.driver) === String(driverInfo?.id))
                                    || vehicles[0] || {};

                                const payload = {
                                    driver: driverInfo?.id,
                                    vehicle: currentVehicle.id,
                                    date: new Date().toISOString().split('T')[0],
                                    logs: routeLegs.map((leg, index) => ({
                                        from_location: leg.from,
                                        to_location: leg.to,
                                        order_index: index
                                    }))
                                };

                                try {
                                    if (editingRouteId) {
                                        await LogisticsService.patchRoute(editingRouteId, payload);
                                        swal('Success', 'Route updated successfully!', 'success');
                                    } else {
                                        await LogisticsService.changeRoute(payload);
                                        swal('Success', 'Route created successfully!', 'success');
                                    }
                                    setShowChangeRouteModal(false);
                                    setEditingRouteId(null);
                                    setRouteLegs([{ from: '', to: '' }]);
                                } catch (error) {
                                    console.error('Error saving route:', error);
                                    swal('Error', 'Failed to update route.', 'error');
                                }
                            }}
                            style={{
                                width: '100%', padding: '14px', borderRadius: T.rMd, border: 'none',
                                background: 'linear-gradient(135deg, #0f1e45 0%, #243580 100%)', color: '#fff', fontSize: '0.9rem', fontWeight: '700',
                                cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center',
                                boxShadow: '0 6px 16px rgba(15, 30, 69, 0.3)', marginTop: '8px', transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(15,30,69,0.45)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(15, 30, 69, 0.3)'; }}
                        >
                            {editingRouteId ? 'Update Route' : 'Submit Route'}
                        </button>

                        {/* ── Previous Routes ── */}
                        {previousRoutes.length > 0 && (
                            <div style={{ marginTop: '20px' }}>
                                <h3 style={{ fontSize: '1.05rem', color: T.ink, fontFamily: "'DM Serif Display',serif", marginBottom: '12px' }}>Previous Routes</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {previousRoutes.map(req => {
                                        return (
                                            <div key={req.id} style={{
                                                padding: '12px', borderRadius: T.rMd, border: `1px solid ${T.cloud}`,
                                                background: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                            }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ fontWeight: '700', color: T.ink, fontSize: '0.9rem' }}>
                                                        Route on {req.date ? req.date.split('-').reverse().join('-') : 'N/A'}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: T.slate }}>
                                                        {req.logs && req.logs.length > 0 ? `${req.logs.length} legs` : 'No legs'}
                                                    </span>
                                                </div>
                                                <button 
                                                    onClick={() => handleEditRoute(req)}
                                                    style={{
                                                        padding: '8px', borderRadius: T.rSm, border: 'none',
                                                        background: T.accentSoft, color: T.accent,
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                    title="Edit Route"
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 20h9"></path>
                                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                                    </svg>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Vehicle Details Modal ─────────────────────────────────────────── */}
            {showVehicleDetailsModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 22, 36, 0.6)', backdropFilter: 'blur(4px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px', animation: 'fadeIn 0.3s ease'
                }}>
                    <div className="driver-card" style={{
                        background: T.white, borderRadius: T.rXl, padding: '24px',
                        width: '100%', maxWidth: '400px', boxShadow: T.shMd,
                        display: 'flex', flexDirection: 'column', gap: '16px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fdf4e7', color: '#f59f00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🚚</div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: T.ink, fontFamily: "'DM Serif Display',serif" }}>Vehicle Details</h2>
                                </div>
                            </div>
                            <button onClick={() => {setShowVehicleDetailsModal(false); setSelectedVehicleId('');}} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: T.slate }}>✖</button>
                        </div>
                        
                        {!selectedVehicleId ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                                <div>
                                    <input 
                                        type="text" 
                                        placeholder="Search vehicle name or number..." 
                                        value={vehicleSearch} 
                                        onChange={(e) => setVehicleSearch(e.target.value)} 
                                        style={{ 
                                            width: '100%', padding: '10px 14px', borderRadius: '8px', 
                                            border: '1px solid #eef1f6', fontSize: '0.9rem', outline: 'none',
                                            boxSizing: 'border-box', background: '#f8f9fa'
                                        }} 
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {vehicles
                                        .filter(v => 
                                            (v.vehicle_name || '').toLowerCase().includes(vehicleSearch.toLowerCase()) || 
                                            (v.vehicle_number || '').toLowerCase().includes(vehicleSearch.toLowerCase())
                                        )
                                        .map(v => (
                                        <div 
                                            key={v.id} 
                                            onClick={() => setSelectedVehicleId(v.id.toString())}
                                            style={{ 
                                                padding: '14px 16px', background: '#fff', border: '1px solid #eef1f6', borderRadius: '10px',
                                                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)', transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <span style={{ fontWeight: '700', color: T.ink, fontSize: '0.95rem' }}>{v.vehicle_name}</span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '4px 8px', background: '#f8f9fa', borderRadius: '6px', color: '#64748b', border: '1px solid #e2e8f0' }}>
                                                {v.vehicle_number}
                                            </span>
                                        </div>
                                    ))}
                                    {vehicles.filter(v => 
                                        (v.vehicle_name || '').toLowerCase().includes(vehicleSearch.toLowerCase()) || 
                                        (v.vehicle_number || '').toLowerCase().includes(vehicleSearch.toLowerCase())
                                    ).length === 0 && (
                                        <div style={{ padding: '20px', textAlign: 'center', color: T.slate, fontSize: '0.9rem' }}>
                                            No vehicles found matching "{vehicleSearch}"
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            (() => {
                                const v = vehicles.find(veh => veh.id.toString() === selectedVehicleId.toString());
                                if (!v) return null;
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <button 
                                            onClick={() => setSelectedVehicleId('')}
                                            style={{ 
                                                background: 'none', border: 'none', color: '#3b5bdb', fontSize: '0.85rem', fontWeight: '600', 
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: 0, width: 'fit-content'
                                            }}
                                        >
                                            <span>←</span> Choose another vehicle
                                        </button>
                                        
                                        <div style={{ padding: '16px', background: T.surface, borderRadius: T.rMd, border: '1px solid #eef1f6', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.85rem', color: T.slate, fontWeight: '500' }}>Vehicle Name</span>
                                                <span style={{ fontSize: '0.9rem', color: T.ink, fontWeight: '700' }}>{v.vehicle_name}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.85rem', color: T.slate, fontWeight: '500' }}>Vehicle Number</span>
                                                <span style={{ fontSize: '0.9rem', color: T.ink, fontWeight: '700' }}>{v.vehicle_number}</span>
                                            </div>
                                            <hr style={{ margin: '4px 0', border: '0', borderTop: '1px dashed #eef1f6' }} />
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.85rem', color: T.slate, fontWeight: '500' }}>Insurance Expiry</span>
                                                <span style={{ fontSize: '0.9rem', color: T.ink, fontWeight: '600' }}>{v.vehicle_insurance_date ? v.vehicle_insurance_date.split('-').reverse().join('-') : 'N/A'}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.85rem', color: T.slate, fontWeight: '500' }}>Tax Expiry</span>
                                                <span style={{ fontSize: '0.9rem', color: T.ink, fontWeight: '600' }}>{v.vehicle_taxes_date ? v.vehicle_taxes_date.split('-').reverse().join('-') : 'N/A'}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.85rem', color: T.slate, fontWeight: '500' }}>Pollution Expiry</span>
                                                <span style={{ fontSize: '0.9rem', color: T.ink, fontWeight: '600' }}>{v.vehicle_pollution_date ? v.vehicle_pollution_date.split('-').reverse().join('-') : 'N/A'}</span>
                                            </div>
                                            <hr style={{ margin: '4px 0', border: '0', borderTop: '1px dashed #eef1f6' }} />
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.85rem', color: T.slate, fontWeight: '500' }}>Next Service</span>
                                                <span style={{ fontSize: '0.9rem', color: T.ink, fontWeight: '600' }}>{v.next_service_date ? v.next_service_date.split('-').reverse().join('-') : 'N/A'}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.85rem', color: T.slate, fontWeight: '500' }}>Next Retest</span>
                                                <span style={{ fontSize: '0.9rem', color: T.ink, fontWeight: '600' }}>{v.next_retest_date ? v.next_retest_date.split('-').reverse().join('-') : 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()
                        )}
                    </div>
                </div>
            )}
            {/* ── Start Journey Modal ─────────────────────────────────────────── */}
            {showStartJourneyModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 22, 36, 0.6)', backdropFilter: 'blur(4px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div style={{
                        background: T.white, borderRadius: T.rXl, padding: '24px',
                        width: '100%', maxWidth: '400px', boxShadow: T.shMd,
                        display: 'flex', flexDirection: 'column', gap: '16px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', color: T.ink, fontFamily: "'DM Serif Display',serif" }}>Start Journey</h2>
                            <button onClick={() => setShowStartJourneyModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: T.slate }}>✖</button>
                        </div>
                        <div>
                            <span style={fieldLabel}>Starting KM</span>
                            <input 
                                type="number" 
                                style={fieldBase} 
                                placeholder="Enter starting km..."
                                value={startJourneyKM}
                                onChange={(e) => setStartJourneyKM(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={async () => {
                                if (!startJourneyKM) {
                                    swal('Warning', 'Please enter starting km', 'warning');
                                    return;
                                }
                                if (!driverInfo) {
                                    swal('Error', 'Driver profile not found.', 'error');
                                    return;
                                }
                                try {
                                    const res = await LogisticsService.createJourney({
                                        driver: driverInfo.id,
                                        start_km: startJourneyKM,
                                        status: 'STARTED'
                                    });
                                    setIsJourneyStarted(true);
                                    setJourneyId(res.data.id);
                                    setShowStartJourneyModal(false);

                                    // Update pending orders to 'In Transit'
                                    const ordersToUpdate = orders.filter(o => o.status === 'Pending' || o.status === 'Loaded');
                                    if (ordersToUpdate.length > 0) {
                                        await Promise.all(ordersToUpdate.map(async (o) => {
                                            try {
                                                await SalesService.patchSalesOrder(o.id, { status: 'In Transit' });
                                            } catch (e) {
                                                console.error('Error updating order status:', e);
                                            }
                                        }));
                                        
                                        const updatedOrders = orders.map(o => {
                                            if (o.status === 'Pending' || o.status === 'Loaded') {
                                                return { ...o, status: 'In Transit' };
                                            }
                                            return o;
                                        });
                                        setOrders(updatedOrders);
                                    }
                                } catch (error) {
                                    console.error(error);
                                    const errMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
                                    swal('Error', `Failed to start journey: ${errMsg}`, 'error');
                                }
                            }}
                            style={{
                                background: T.accent, color: T.white, border: 'none',
                                padding: '12px', borderRadius: T.rMd, fontSize: '1rem',
                                fontWeight: '700', cursor: 'pointer', marginTop: '10px'
                            }}
                        >
                            Start
                        </button>
                    </div>
                </div>
            )}

            {/* ── View Order Modal ────────────────────────────────────────────── */}
            {viewingOrder && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 22, 36, 0.6)', backdropFilter: 'blur(4px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div className="driver-card" style={{
                        background: T.white, borderRadius: T.rXl, padding: '24px',
                        width: '100%', maxWidth: '600px', boxShadow: T.shMd,
                        display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '85vh', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: T.accentSoft, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📋</div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: T.ink, fontFamily: "'DM Serif Display',serif" }}>Order Details</h2>
                                    <span style={{ fontSize: '0.85rem', color: T.slate }}>{viewingOrder.so_no}</span>
                                </div>
                            </div>
                            <button onClick={() => setViewingOrder(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: T.slate }}>✖</button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ background: T.surface, padding: '16px', borderRadius: T.rMd, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <span style={fieldLabel}>Customer</span>
                                    <div style={{ fontWeight: '600', color: T.ink, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                        <span>{viewingOrder.customer_ledger_name}</span>
                                        <span style={{ color: T.slate, fontWeight: 'normal' }}>
                                            {ledgers.find(l => String(l.id) === String(viewingOrder.customer_ledger))?.phone ? ledgers.find(l => String(l.id) === String(viewingOrder.customer_ledger)).phone : ''}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <span style={fieldLabel}>Status</span>
                                    <div style={{ 
                                        display: 'inline-block',
                                        background: viewingOrder.status === 'Pending' ? '#fef3c7' : '#d1fae5', 
                                        color: viewingOrder.status === 'Pending' ? '#b45309' : '#047857',
                                        padding: '2px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700'
                                    }}>{viewingOrder.status || 'Pending'}</div>
                                </div>
                                <div>
                                    <span style={fieldLabel}>Delivery Date & Time</span>
                                    <div style={{ fontWeight: '500', color: T.ink }}>
                                                        {(() => {
                                                            const dt = viewingOrder.preferred_delivery_date || viewingOrder.delivery_date || viewingOrder.entry_date || '';
                                                            if (!dt) return '';
                                                            let str = dt.replace('T', ' ');
                                                            let [datePart, timePart] = str.split(' ');
                                                            if (datePart) {
                                                                const dp = datePart.split('-');
                                                                if (dp.length === 3) datePart = `${dp[2]}-${dp[1]}-${dp[0]}`;
                                                            }
                                                            if (timePart) {
                                                                const tp = timePart.split(':');
                                                                if (tp.length >= 2) {
                                                                    let h = parseInt(tp[0], 10);
                                                                    const ampm = h >= 12 ? 'PM' : 'AM';
                                                                    h = h % 12 || 12;
                                                                    const hh = h < 10 ? '0' + h : h;
                                                                    timePart = `${hh}:${tp[1]} ${ampm}`;
                                                                }
                                                                return (
                                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                        <span>{datePart}</span>
                                                                        <span>{timePart}</span>
                                                                    </div>
                                                                );
                                                            }
                                                            return <span>{datePart}</span>;
                                                        })()}
                                                    </div>
                                </div>
                                <div>
                                    <span style={fieldLabel}>Location</span>
                                    <div style={{ fontWeight: '500', color: T.ink }}>{viewingOrder.delivery_location_name || viewingOrder.delivery_location || 'Standard Location'}</div>
                                </div>
                            </div>
                            
                            <div>
                                <h3 style={{ margin: '0 0 10px', fontSize: '1rem', color: T.ink, fontFamily: "'DM Serif Display',serif" }}>Items</h3>
                                {viewingOrder.items && viewingOrder.items.length > 0 ? (
                                    <div style={{ border: `1px solid ${T.cloud}`, borderRadius: T.rMd, overflow: 'hidden' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', background: T.surface, padding: '8px 12px', borderBottom: `1px solid ${T.cloud}` }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: '700', color: T.slate, textTransform: 'uppercase' }}>Product</span>
                                            <span style={{ fontSize: '0.7rem', fontWeight: '700', color: T.slate, textTransform: 'uppercase', textAlign: 'right' }}>Qty</span>
                                        </div>
                                        {viewingOrder.items.map((item, i) => (
                                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', padding: '10px 12px', borderBottom: i === viewingOrder.items.length - 1 ? 'none' : `1px solid ${T.cloud}` }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: T.ink }}>{item.productName || item.product_name || `Item #${item.product}`}</span>
                                                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: T.ink, textAlign: 'right' }}>{Number(item.quantity)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', background: T.surface, borderRadius: T.rMd, color: T.slate, fontSize: '0.9rem' }}>
                                        No items details found.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* ── End Journey Modal ───────────────────────────────────────────── */}
            {showEndJourneyModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 22, 36, 0.6)', backdropFilter: 'blur(4px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div style={{
                        background: T.white, borderRadius: T.rXl, padding: '24px',
                        width: '100%', maxWidth: '400px', boxShadow: T.shMd,
                        display: 'flex', flexDirection: 'column', gap: '16px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', color: T.ink, fontFamily: "'DM Serif Display',serif" }}>End Journey</h2>
                            <button onClick={() => setShowEndJourneyModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: T.slate }}>✖</button>
                        </div>
                        <div>
                            <span style={fieldLabel}>Ending KM</span>
                            <input 
                                type="number" 
                                style={fieldBase} 
                                placeholder="Enter ending km..."
                                value={endJourneyKM}
                                onChange={(e) => setEndJourneyKM(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={async () => {
                                if (!endJourneyKM) {
                                    swal('Warning', 'Please enter ending km', 'warning');
                                    return;
                                }
                                if (!driverInfo) {
                                    swal('Error', 'Driver profile not found.', 'error');
                                    return;
                                }
                                try {
                                    if (journeyId) {
                                        await LogisticsService.patchJourney(journeyId, {
                                            status: 'COMPLETED',
                                            end_km: endJourneyKM
                                        });
                                    } else {
                                        await LogisticsService.createJourney({
                                            driver: driverInfo.id,
                                            start_km: 0,
                                            end_km: endJourneyKM,
                                            status: 'COMPLETED'
                                        });
                                    }
                                    setIsJourneyStarted(false);
                                    setIsJourneyCompleted(true);
                                    setJourneyId(null);
                                    setShowEndJourneyModal(false);
                                    swal('Journey Completed', 'This will mark the journey as complete.', 'success');
                                } catch (error) {
                                    console.error(error);
                                    const errMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
                                    swal('Error', `Failed to complete journey: ${errMsg}`, 'error');
                                }
                            }}
                            style={{
                                padding: '12px', borderRadius: T.rMd, border: 'none',
                                background: `linear-gradient(135deg, ${T.accent} 0%, #2f49c5 100%)`, 
                                color: T.white, fontSize: '1rem', fontWeight: '700',
                                cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                            }}
                        >
                            Complete Journey
                        </button>
                    </div>
                </div>
            )}

            <CameraCapture 
                show={showFuelCameraModal} 
                onHide={() => setShowFuelCameraModal(false)} 
                onCapture={(file) => setFuelAttachment(file)} 
                title="Take Fuel Receipt Photo"
            />
        </div>
    );
};

export default DriverOperationsScreen;
