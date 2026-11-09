import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import swal from 'sweetalert';
import { Modal } from 'react-bootstrap';
import axiosInstance from '../../../services/AxiosInstance';

const TripLoadingScreen = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [tripData, setTripData] = useState(null);
    const [availableOrders, setAvailableOrders] = useState([]);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [showGatePassModal, setShowGatePassModal] = useState(false);
    
    // Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedEditOrder, setSelectedEditOrder] = useState(null);
    const [editItems, setEditItems] = useState({});
    // Filter Date State
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    
    // Hidden Orders State (persisted in sessionStorage)
    const [hiddenOrders, setHiddenOrders] = useState(() => {
        const stored = sessionStorage.getItem(`hiddenOrders_trip_${id}`);
        return stored ? JSON.parse(stored) : [];
    });
    
    const lastFetchedParams = useRef(null);

    useEffect(() => {
        sessionStorage.setItem(`hiddenOrders_trip_${id}`, JSON.stringify(hiddenOrders));
    }, [hiddenOrders, id]);

    const fetchData = useCallback(async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);
            let queryParams = '';
            if (fromDate && toDate) {
                queryParams = `?from_date=${fromDate}&to_date=${toDate}`;
            }
            
            const isNewDateSearch = lastFetchedParams.current !== null && lastFetchedParams.current !== queryParams && !isInitial;
            lastFetchedParams.current = queryParams;

            const [tripRes, ordersRes] = await Promise.all([
                axiosInstance.get(`/api/logistics/trips/${id}/loading-data/`),
                axiosInstance.get(`/api/logistics/trips/${id}/available-orders/${queryParams}`)
            ]);
            setTripData(tripRes.data);
            setAvailableOrders(ordersRes.data);
            
            if (isNewDateSearch) {
                setHiddenOrders(prev => prev.filter(orderId => !ordersRes.data.some(o => o.id === orderId)));
            }
        } catch (error) {
            console.error("Error fetching trip data:", error);
            swal("Error", "Failed to load trip data", "error");
        } finally {
            if (isInitial) setLoading(false);
        }
    }, [id, fromDate, toDate]);

    useEffect(() => {
        fetchData(loading);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchData]);

    const handleLoadOrder = async (orderId) => {
        try {
            await axiosInstance.post(`/api/logistics/trips/${id}/load-order/`, { order_id: orderId });
            fetchData();
        } catch (error) {
            console.error("Error loading order:", error);
            swal("Error", "Failed to load order", "error");
        }
    };

    const handleUnloadOrder = async (orderId) => {
        try {
            await axiosInstance.post(`/api/logistics/trips/${id}/unload-order/`, { order_id: orderId });
            fetchData();
        } catch (error) {
            console.error("Error unloading order:", error);
            swal("Error", "Failed to unload order", "error");
        }
    };

    const handleEditOrder = (order) => {
        setSelectedEditOrder(order);
        const initialItems = {};
        if (order.items_details) {
            order.items_details.forEach(item => {
                initialItems[item.id] = item.quantity;
            });
        }
        setEditItems(initialItems);
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        try {
            const processedItems = {};
            for (const key in editItems) {
                processedItems[key] = editItems[key] === '' ? 0 : editItems[key];
            }
            await axiosInstance.post(`/api/logistics/trips/${id}/edit-loaded-order/`, {
                order_id: selectedEditOrder.id,
                items: processedItems
            });
            setShowEditModal(false);
            swal("Success", "Order quantities updated successfully.", "success");
            fetchData();
        } catch (error) {
            console.error("Error editing order:", error);
            swal("Error", error.response?.data?.error || "Failed to edit order quantities", "error");
        }
    };

    const handleItemQtyChange = (itemId, val, maxQty) => {
        if (val === '') {
            setEditItems(prev => ({ ...prev, [itemId]: '' }));
            return;
        }
        let newQty = parseFloat(val);
        if (isNaN(newQty) || newQty < 0) newQty = 0;
        if (newQty > maxQty) newQty = maxQty;
        // Keep string if it ends with . to allow typing decimals like "5."
        if (val.endsWith('.')) {
             setEditItems(prev => ({ ...prev, [itemId]: val }));
             return;
        }
        setEditItems(prev => ({ ...prev, [itemId]: newQty }));
    };

    if (loading) {
        return (
            <div className="text-center py-5">
                <div className="spinner-border" style={{ color: '#4f46e5' }} role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    if (!tripData) return <div>Trip not found</div>;

    const utilization = tripData.vehicle_volume > 0 
        ? ((tripData.loaded_volume / tripData.vehicle_volume) * 100).toFixed(1) 
        : 0;

    const customerColors = [
        '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', 
        '#f97316', '#ec4899', '#14b8a6', '#6366f1', '#84cc16', 
        '#0ea5e9', '#f43f5e', '#d946ef', '#10b981', '#8b5cf6'
    ];
    const customerColorMap = {};
    let colorIndex = 0;
    if (tripData && tripData.loaded_orders) {
        tripData.loaded_orders.forEach(order => {
            if (!customerColorMap[order.customer_name]) {
                customerColorMap[order.customer_name] = customerColors[colorIndex % customerColors.length];
                colorIndex++;
            }
        });
    }

    const customerAggregatedOrders = [];
    if (tripData && tripData.loaded_orders) {
        const custMap = {};
        tripData.loaded_orders.forEach(order => {
            const key = `${order.customer_name}_${order.delivery_location}`;
            if (!custMap[key]) {
                custMap[key] = {
                    customer_name: order.customer_name,
                    delivery_location: order.delivery_location,
                    items: {}
                };
            }
            
            const itemsArray = (order.items_summary || '').split(',').map(s => s.trim()).filter(i => i);
            itemsArray.forEach(itemStr => {
                const lastColonIdx = itemStr.lastIndexOf(':');
                if (lastColonIdx > -1) {
                    const itemName = itemStr.substring(0, lastColonIdx).trim();
                    const qtyStr = itemStr.substring(lastColonIdx + 1).trim();
                    const qty = parseFloat(qtyStr) || 0;
                    if (!custMap[key].items[itemName] || typeof custMap[key].items[itemName] !== 'object') {
                        custMap[key].items[itemName] = { qty: 0, uom: '' };
                    }
                    custMap[key].items[itemName].qty += qty;
                } else {
                    if (!custMap[key].items[itemStr] || typeof custMap[key].items[itemStr] !== 'object') {
                        custMap[key].items[itemStr] = { qty: 0, uom: '' };
                    }
                }
            });

            // If we have items_details, we can extract UOM and optionally more accurate qty
            // We will NOT add to qty here if it was already added by items_summary to avoid double counting,
            // OR we can just overwrite the qty/uom with the detailed one if present.
            // Actually, items_details is the source of truth for the order's items, 
            // but we must be careful since items_summary already aggregated it.
            // Let's just use items_details to grab the UOM, and if it wasn't in items_summary, add it.
            if (order.items_details) {
                order.items_details.forEach(item => {
                    if (!custMap[key].items[item.product_name] || typeof custMap[key].items[item.product_name] !== 'object') {
                        custMap[key].items[item.product_name] = { qty: parseFloat(item.quantity || 0), uom: item.uom || '' };
                    } else {
                        // Already exists from items_summary, just update UOM if available
                        if (item.uom) {
                            custMap[key].items[item.product_name].uom = item.uom;
                        }
                    }
                });
            }
        });

        Object.keys(custMap).forEach(key => {
            if (custMap[key]) {
                const formattedItems = [];
                const rawItemsList = [];
                for (const [itemName, itemObj] of Object.entries(custMap[key].items)) {
                    const qty = typeof itemObj === 'object' && itemObj !== null ? itemObj.qty : itemObj;
                    const uom = typeof itemObj === 'object' && itemObj !== null ? itemObj.uom : '';
                    formattedItems.push(qty > 0 ? `${itemName}: ${qty}` : itemName);
                    rawItemsList.push({ name: itemName, qty: qty, uom: uom });
                }
                customerAggregatedOrders.push({
                    customer_name: custMap[key].customer_name,
                    delivery_location: custMap[key].delivery_location,
                    items_list: formattedItems,
                    raw_items: rawItemsList
                });
                delete custMap[key]; 
            }
        });
    }

    return (
        <div className="fd-dashboard-container">
            <style dangerouslySetInnerHTML={{ __html: `
                .tls-container { padding: 0.5rem 1rem; }
                .tls-header {
                    background: linear-gradient(135deg, #4f46e5, #312e81);
                    border-radius: 14px;
                    padding: 24px;
                    color: white;
                    margin-bottom: 24px;
                    box-shadow: 0 10px 25px rgba(49, 46, 129, 0.2);
                    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;
                }
                .tls-title { margin: 0; font-size: 1.6rem; font-weight: 800; color: #ffffff !important; }
                .tls-subtitle { margin: 0; font-size: 0.9rem; color: rgba(255,255,255,0.85) !important; }
                .tls-btn-back {
                    background: rgba(255,255,255,0.15);
                    color: white; border: none; padding: 8px 16px; border-radius: 8px;
                    font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s;
                    display: inline-flex; align-items: center; gap: 6px;
                }
                .tls-btn-back:hover { background: rgba(255,255,255,0.25); color: white; }
                
                @media print {
                    .gate-pass-page {
                        page-break-after: always;
                    }
                    .gate-pass-page:last-child {
                        page-break-after: auto;
                    }
                    @page { margin: 10mm; size: A5 landscape; }
                }
                .tls-info-grid {
                    display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 16px;
                }
                .tls-info-item {
                    background: #f1f5f9; border-radius: 8px; padding: 12px 16px;
                }
                .tls-info-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 4px; }
                .tls-info-value { font-size: 1.1rem; font-weight: 700; margin: 0; color: #1e293b; }

                .tls-section {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 14px;
                    margin-bottom: 24px;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
                    overflow: hidden;
                }
                .tls-section-header {
                    display: flex; align-items: center; gap: 10px;
                    padding: 18px 24px; border-bottom: 1px solid #f1f5f9;
                }
                .tls-section-icon {
                    width: 32px; height: 32px;
                    background: linear-gradient(135deg, #6366f1, #4338ca);
                    border-radius: 8px;
                    display: flex; align-items: center; justify-content: center;
                    color: #fff; flex-shrink: 0;
                }
                .tls-section-icon.warning { background: linear-gradient(135deg, #f59e0b, #d97706); }
                .tls-section-title { font-size: 1.1rem; font-weight: 700; color: #1e293b; margin: 0; }
                
                .tls-table { width: 100%; border-collapse: collapse; }
                .tls-table thead tr { background: linear-gradient(to right, #4f46e5, #312e81); }
                .tls-table th {
                    color: #ffffff; font-size: 0.75rem; font-weight: 700;
                    padding: 12px 16px; text-transform: uppercase; letter-spacing: 0.5px;
                }
                .tls-table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; color: #334155; }
                .tls-table tr:last-child td { border-bottom: none; }
                .tls-table tbody tr:hover { background: #f8fafc; }

                .tls-btn-action {
                    display: inline-flex; align-items: center; justify-content: center;
                    height: 32px; padding: 0 16px; border-radius: 6px; font-size: 0.8rem; font-weight: 700;
                    cursor: pointer; transition: 0.2s; border: none; outline: none;
                }
                .tls-btn-load { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
                .tls-btn-load:hover { background: #2563eb; color: #fff; border-color: #2563eb; }
                .tls-btn-unload { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
                .tls-btn-unload:hover { background: #dc2626; color: #fff; border-color: #dc2626; }

                .tls-util-bar {
                    background: #f1f5f9; border-radius: 20px; height: 12px; margin-top: 8px; overflow: hidden;
                }
                .tls-util-fill {
                    height: 100%; border-radius: 20px; transition: width 0.4s ease;
                }
                .tls-util-fill.safe { background: linear-gradient(to right, #312e81, #1e1b4b); }
                .tls-util-fill.warning { background: linear-gradient(to right, #f59e0b, #d97706); }
                .tls-util-fill.danger { background: linear-gradient(to right, #ef4444, #dc2626); }

                @media (max-width: 991px) {
                    .tls-container { padding: 1.5rem 1rem; }
                    .tls-info-grid { grid-template-columns: repeat(2, 1fr); }
                }
                @media (max-width: 575px) {
                    .tls-container { padding: 1rem 0.5rem; }
                    .tls-header { padding: 16px; flex-direction: column; align-items: flex-start; }
                    .tls-info-grid { grid-template-columns: 1fr; }
                    .tls-title { font-size: 1.3rem; }
                }

                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    .printable-loading-sheet, .printable-loading-sheet * {
                        visibility: visible !important;
                    }

                    /* Override Bootstrap Modal wrappers so they don't center the print output */
                    .modal, .modal-dialog, .modal-content, .modal-body {
                        position: static !important;
                        transform: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        background: transparent !important;
                        min-height: 0 !important;
                        width: auto !important;
                        max-width: none !important;
                    }

                    .printable-loading-sheet {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        background: #fff !important;
                        color: #000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    .modal-header, .modal-footer, .btn-close, .modal-backdrop {
                        display: none !important;
                    }
                    .printable-header {
                        text-align: center;
                        margin-bottom: 20px;
                        border-bottom: 2px solid #1e293b;
                        padding-bottom: 10px;
                    }
                    .printable-header h1 {
                        font-size: 24px;
                        font-weight: 800;
                        margin: 0;
                        text-transform: uppercase;
                        letter-spacing: 2px;
                    }
                    .printable-header h2 {
                        font-size: 18px;
                        margin: 5px 0;
                    }
                    .printable-header p {
                        font-size: 14px;
                        margin: 5px 0;
                        color: #334155;
                    }
                    .printable-section {
                        margin-bottom: 25px;
                    }
                    .printable-section h3 {
                        font-size: 16px;
                        font-weight: 700;
                        border-bottom: 1px solid #cbd5e1;
                        padding-bottom: 5px;
                        margin-bottom: 10px;
                        color: #1e293b;
                    }
                    .printable-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        font-size: 13px !important;
                    }
                    .printable-table th {
                        border-top: 1px solid #1e3a8a !important;
                        border-bottom: 2px solid #1e3a8a !important;
                        padding: 12px 12px !important;
                        text-align: left !important;
                        background-color: transparent !important;
                        font-weight: 800 !important;
                        color: #1e3a8a !important;
                        text-transform: uppercase !important;
                        font-size: 11px !important;
                        letter-spacing: 0.05em !important;
                    }
                    .printable-table td {
                        border-bottom: 1px dashed #cbd5e1 !important;
                        padding: 12px 12px !important;
                        text-align: left !important;
                        color: #1e293b !important;
                    }
                    .printable-table tbody tr:last-child td {
                        border-bottom: 2px solid #e2e8f0 !important;
                    }
                    .printable-table th {
                        background-color: #f8fafc !important;
                        font-weight: 700 !important;
                        color: #475569 !important;
                        text-transform: uppercase !important;
                        font-size: 11px !important;
                        letter-spacing: 0.05em !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .returnables-box {
                        background-color: #fef9c3 !important;
                        border: 1px solid #fde047;
                        padding: 10px;
                        font-size: 12px;
                        color: #854d0e;
                        font-weight: 600;
                        -webkit-print-color-adjust: exact;
                    }
                    .signatures {
                        display: flex !important;
                        justify-content: space-between !important;
                        margin-top: 60px !important;
                        font-size: 14px !important;
                        font-weight: 600 !important;
                    }
                    .signature-line {
                        width: 30% !important;
                        border-top: 1px solid #000 !important;
                        text-align: center !important;
                        padding-top: 8px !important;
                    }
                }
            `}} />

            <div className="tls-container">
                {/* Header */}
                <div className="tls-header">
                    <div>
                        <h2 className="tls-title">Trip Loading: {tripData.trip_id}</h2>
                        <p className="tls-subtitle">Manage cargo and vehicle utilization</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button className="tls-btn-back" onClick={() => setShowPrintModal(true)} style={{ background: '#4338ca', color: '#fff', border: '1px solid #6366f1' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'text-bottom' }}>
                                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                                <rect x="6" y="14" width="12" height="8"></rect>
                            </svg>
                            Loading Sheet
                        </button>
                        <button className="tls-btn-back" onClick={() => setShowGatePassModal(true)} style={{ background: '#4338ca', color: '#fff', border: '1px solid #6366f1' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'text-bottom' }}>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                            Gate Passes
                        </button>
                        <button className="tls-btn-back" onClick={() => navigate(-1)}>
                            ‹ Back to Trips
                        </button>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="tls-section" style={{ padding: '24px', background: 'linear-gradient(to right, #f8fafc, #ffffff)' }}>
                    <div className="tls-info-grid">
                        <div className="tls-info-item">
                            <div className="tls-info-label">Vehicle</div>
                            <div className="tls-info-value">{tripData.vehicle_number} - {tripData.vehicle}</div>
                        </div>
                        <div className="tls-info-item">
                            <div className="tls-info-label">Driver</div>
                            <div className="tls-info-value">{tripData.driver}</div>
                        </div>
                        <div className="tls-info-item">
                            <div className="tls-info-label">Route</div>
                            <div className="tls-info-value">{tripData.route}</div>
                        </div>
                        <div className="tls-info-item">
                            <div className="tls-info-label">Date</div>
                            <div className="tls-info-value">
                                {tripData.trip_date ? tripData.trip_date.split('-').reverse().join('-') : ''}
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>VEHICLE UTILIZATION</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>
                                {tripData.loaded_volume} / {tripData.vehicle_volume} m³ ({utilization}%)
                            </span>
                        </div>
                        <div className="tls-util-bar">
                            <div 
                                className={`tls-util-fill ${utilization > 90 ? 'danger' : utilization > 75 ? 'warning' : 'safe'}`} 
                                style={{ width: `${Math.min(utilization, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                <div className="row align-items-stretch">
                    {/* Loaded Orders */}
                    <div className="col-lg-7 mb-4 mb-lg-0">
                        <div className="tls-section h-100 d-flex flex-column" style={{ marginBottom: 0 }}>
                            <div className="tls-section-header">
                                <div className="tls-section-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                        <line x1="12" y1="22.08" x2="12" y2="12"></line>
                                    </svg>
                                </div>
                                <h3 className="tls-section-title">Loaded Orders</h3>
                                <span style={{ marginLeft: 'auto', background: '#eff6ff', color: '#2563eb', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                    {tripData.loaded_orders.length} Items
                                </span>
                            </div>
                            <div style={{ overflowX: 'auto', flexGrow: 1 }}>
                                <table className="tls-table">
                                    <thead>
                                        <tr>
                                            <th>SL NO</th>
                                            <th>Order No</th>
                                            <th>Customer & Location</th>
                                            <th>Volume</th>
                                            <th style={{ textAlign: 'right' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tripData.loaded_orders.length > 0 ? tripData.loaded_orders.map((order, idx) => (
                                            <tr key={order.id}>
                                                <td style={{ fontWeight: 600, color: '#94a3b8' }}>{idx + 1}</td>
                                                <td style={{ fontWeight: 700 }}>{order.so_no}</td>
                                                <td>
                                                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: customerColorMap[order.customer_name], flexShrink: 0 }}></div>
                                                        {order.customer_name}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{order.delivery_location}</div>
                                                </td>
                                                <td style={{ fontWeight: 700, color: '#4f46e5' }}>{order.volume} m³</td>
                                                <td style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button className="tls-btn-action tls-btn-load" style={{ background: '#f8fafc', color: '#475569', borderColor: '#cbd5e1' }} onClick={() => handleEditOrder(order)}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                        </svg>
                                                        Edit
                                                    </button>
                                                    <button className="tls-btn-action tls-btn-unload" onClick={() => handleUnloadOrder(order.id)}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                            <polyline points="17 8 12 3 7 8"></polyline>
                                                            <line x1="12" y1="3" x2="12" y2="15"></line>
                                                        </svg>
                                                        Unload
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                                                    No orders loaded yet.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Available Orders */}
                    <div className="col-lg-5">
                        <div className="tls-section h-100 d-flex flex-column" style={{ marginBottom: 0 }}>
                            <div className="tls-section-header">
                                <div className="tls-section-icon warning">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="8" y1="6" x2="21" y2="6"></line>
                                        <line x1="8" y1="12" x2="21" y2="12"></line>
                                        <line x1="8" y1="18" x2="21" y2="18"></line>
                                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                                    </svg>
                                </div>
                                <h3 className="tls-section-title">Available Orders</h3>
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                            <input 
                                                type="date" 
                                                value={fromDate || (tripData?.trip_date || '')}
                                                onChange={(e) => setFromDate(e.target.value)}
                                                style={{ 
                                                    height: '32px', 
                                                    fontSize: '12px', 
                                                    padding: '0 8px', 
                                                    borderRadius: '8px', 
                                                    border: '1px solid #e2e8f0', 
                                                    width: '115px', 
                                                    color: '#334155',
                                                    backgroundColor: '#f8fafc',
                                                    fontWeight: '600',
                                                    outline: 'none',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                                }}
                                                onFocus={(e) => {
                                                    e.target.style.border = '1px solid #93c5fd';
                                                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                                                    e.target.style.backgroundColor = '#ffffff';
                                                }}
                                                onBlur={(e) => {
                                                    e.target.style.border = '1px solid #e2e8f0';
                                                    e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)';
                                                    e.target.style.backgroundColor = '#f8fafc';
                                                }}
                                                title="From Date"
                                            />
                                        </div>
                                        <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}>To</span>
                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                            <input 
                                                type="date" 
                                                value={toDate || (tripData?.trip_date || '')}
                                                onChange={(e) => setToDate(e.target.value)}
                                                style={{ 
                                                    height: '32px', 
                                                    fontSize: '12px', 
                                                    padding: '0 8px', 
                                                    borderRadius: '8px', 
                                                    border: '1px solid #e2e8f0', 
                                                    width: '115px', 
                                                    color: '#334155',
                                                    backgroundColor: '#f8fafc',
                                                    fontWeight: '600',
                                                    outline: 'none',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                                }}
                                                onFocus={(e) => {
                                                    e.target.style.border = '1px solid #93c5fd';
                                                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                                                    e.target.style.backgroundColor = '#ffffff';
                                                }}
                                                onBlur={(e) => {
                                                    e.target.style.border = '1px solid #e2e8f0';
                                                    e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)';
                                                    e.target.style.backgroundColor = '#f8fafc';
                                                }}
                                                title="To Date"
                                            />
                                        </div>
                                    </div>
                                    <button onClick={() => { setHiddenOrders([]); fetchData(true); }} style={{ background: '#e0f2fe', border: '1px solid #bae6fd', cursor: 'pointer', color: '#0369a1', padding: '6px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s ease', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }} onMouseEnter={(e) => e.currentTarget.style.background = '#bae6fd'} onMouseLeave={(e) => e.currentTarget.style.background = '#e0f2fe'} title="Refresh & Restore Dismissed Orders">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="23 4 23 10 17 10"></polyline>
                                            <polyline points="1 20 1 14 7 14"></polyline>
                                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                                        </svg>
                                    </button>
                                    {/* <span style={{ background: '#fef3c7', color: '#d97706', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                        Route Matched
                                    </span> */}
                                </div>
                            </div>
                            <div style={{ padding: '16px', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                {availableOrders.length > 0 ? availableOrders.filter(order => !hiddenOrders.includes(order.id)).map((order) => (
                                    <div key={order.id} style={{ 
                                        padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', 
                                        borderRadius: '10px', marginBottom: '12px', display: 'flex', 
                                        justifyContent: 'space-between', alignItems: 'center'
                                    }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                                <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem' }}>{order.so_no}</div>
                                                {order.delivery_date && (
                                                    <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px' }}>
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                                            <line x1="16" y1="2" x2="16" y2="6"></line>
                                                            <line x1="8" y1="2" x2="8" y2="6"></line>
                                                            <line x1="3" y1="10" x2="21" y2="10"></line>
                                                        </svg>
                                                        {order.delivery_date}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>{order.customer_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{order.delivery_location}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 800, color: '#4f46e5', marginBottom: '8px' }}>{order.volume} m³</div>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button className="btn btn-sm" onClick={() => setHiddenOrders(prev => [...prev, order.id])} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', fontWeight: 'bold', fontSize: '0.75rem', padding: '4px 8px', borderRadius: '6px' }} title="Dismiss from list">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                                    </svg>
                                                </button>
                                                <button className="tls-btn-action tls-btn-load" onClick={() => handleLoadOrder(order.id)}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                        <polyline points="7 10 12 15 17 10"></polyline>
                                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                                    </svg>
                                                    Load
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '32px 16px', color: '#94a3b8' }}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '48px', height: '48px', margin: '0 auto 12px', opacity: 0.5 }}>
                                            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                                        </svg>
                                        <div>No available orders for this route.</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Order Modal */}
            <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontWeight: 800 }}>Edit Loaded Quantities</Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ backgroundColor: '#f1f5f9', padding: '24px' }}>
                    {selectedEditOrder && (
                        <div>
                            <div style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                Order: {selectedEditOrder.so_no}
                            </div>
                            <div style={{ background: '#fff', borderRadius: '8px', padding: '16px', border: '1px solid #e2e8f0' }}>
                                <table className="tls-table">
                                    <thead>
                                        <tr>
                                            <th>Product</th>
                                            <th style={{ textAlign: 'center' }}>Original Qty</th>
                                            <th style={{ textAlign: 'center' }}>Loaded Qty</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedEditOrder.items_details && selectedEditOrder.items_details.map(item => (
                                            <tr key={item.id}>
                                                <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                                                <td style={{ textAlign: 'center', color: '#64748b' }}>{item.quantity}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <input 
                                                        type="number" 
                                                        className="form-control" 
                                                        style={{ width: '100px', margin: '0 auto', textAlign: 'center' }}
                                                        value={editItems[item.id] !== undefined ? editItems[item.id] : item.quantity}
                                                        onChange={(e) => handleItemQtyChange(item.id, e.target.value, item.quantity)}
                                                        min="0"
                                                        max={item.quantity}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ marginTop: '16px', background: '#fffbeb', color: '#b45309', padding: '12px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600 }}>
                                Note: Decreasing quantities will split the remaining items into a new "Pending" Sales Order so they can be loaded onto a different trip.
                            </div>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSaveEdit}>Save Changes</button>
                </Modal.Footer>
            </Modal>

            {/* Loading Sheet Preview Modal */}
            <Modal show={showPrintModal} onHide={() => setShowPrintModal(false)} size="xl" centered>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontWeight: 800 }}>Loading Sheet Preview</Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ backgroundColor: '#f1f5f9', padding: '30px' }}>
                    <div className="printable-loading-sheet" style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', color: '#000', fontFamily: "'Inter', sans-serif" }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '20px', marginBottom: '25px' }}>
                            <div>
                                <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#1e3a8a', margin: 0, letterSpacing: '-0.5px' }}>GLENDA</h1>
                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, letterSpacing: '1px' }}>PURE FOR CARE</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Loading Sheet</h2>
                                <div style={{ fontSize: '14px', color: '#475569', marginTop: '4px' }}>
                                    <span style={{ fontWeight: 600 }}>Trip ID:</span> {tripData.trip_id}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', background: '#f8fafc', borderRadius: '8px', padding: '16px 24px', marginBottom: '30px', border: '1px solid #e2e8f0', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px', letterSpacing: '0.05em' }}>Date</div>
                                <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>{tripData.trip_date ? tripData.trip_date.split('-').reverse().join('-') : ''}</div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px', letterSpacing: '0.05em' }}>Vehicle</div>
                                <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>{tripData.vehicle_number} - {tripData.vehicle}</div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px', letterSpacing: '0.05em' }}>Driver</div>
                                <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>{tripData.driver}</div>
                            </div>
                        </div>

                        <table style={{ width: '100%', marginBottom: '35px', border: 'none' }}>
                            <tbody>
                                <tr>
                                    <td style={{ width: '60%', verticalAlign: 'top', border: 'none', paddingRight: '20px' }}>
                                        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1e3a8a', marginBottom: '16px', borderLeft: '4px solid #f59e0b', paddingLeft: '10px' }}>Summary by Product</h3>
                                        <table className="printable-table" border="0" cellPadding="12" style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
                                            <thead>
                                                <tr>
                                                    <th>Product Name</th>
                                                    <th style={{ textAlign: 'right' }}>Total Quantity</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tripData.product_summary && tripData.product_summary.length > 0 ? (
                                                    tripData.product_summary.map((prod, idx) => (
                                                        <tr key={idx}>
                                                            <td>{prod.product}</td>
                                                            <td style={{ textAlign: 'right' }}>{prod.total_qty.toFixed(2)}</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="2" style={{ textAlign: 'center', fontStyle: 'italic', color: '#94a3b8' }}>No products loaded</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </td>
                                    <td style={{ width: '40%', verticalAlign: 'top', border: 'none', paddingLeft: '10px' }}>
                                        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1e3a8a', marginBottom: '16px', borderLeft: '4px solid #f59e0b', paddingLeft: '10px' }}>Important Note</h3>
                                        <div className="returnables-box" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '4px solid #f59e0b', padding: '16px', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '12px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                            </svg>
                                            <div style={{ fontSize: '13px', color: '#92400e', lineHeight: 1.5 }}>
                                                <strong style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Returnables Required</strong>
                                                Ensure Driver carries enough empty crates/shells if applicable.
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="printable-section">
                            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1e3a8a', marginBottom: '16px', borderLeft: '4px solid #f59e0b', paddingLeft: '10px' }}>Dispatch Details (Sales Orders)</h3>
                            <table className="printable-table" border="0" cellPadding="12" style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
                                <thead>
                                    <tr>
                                        <th>SL No</th>
                                        <th>Customer</th>
                                        <th>Delivery Location</th>
                                        <th>Items summary</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customerAggregatedOrders.length > 0 ? (
                                        customerAggregatedOrders.map((aggOrder, idx) => {
                                            return (
                                                <tr key={idx}>
                                                    <td style={{ color: '#4f46e5', fontWeight: 600 }}>{idx + 1}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: customerColorMap[aggOrder.customer_name], WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', flexShrink: 0 }}></div>
                                                            {aggOrder.customer_name}
                                                        </div>
                                                    </td>
                                                    <td>{aggOrder.delivery_location}</td>
                                                    <td>
                                                        {aggOrder.items_list.length > 0 ? aggOrder.items_list.map((itemLine, i) => (
                                                            <div key={i} style={{ marginBottom: i < aggOrder.items_list.length - 1 ? '4px' : '0' }}>{itemLine}</div>
                                                        )) : 'N/A'}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="4" style={{ textAlign: 'center', fontStyle: 'italic', color: '#94a3b8' }}>No orders loaded</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <table style={{ width: '100%', marginTop: '100px', textAlign: 'center', fontSize: '13px', fontWeight: 600, borderCollapse: 'collapse', border: 'none' }}>
                            <tbody>
                                <tr>
                                    <td style={{ width: '33%', border: 'none', padding: '0 30px' }}>
                                        <div style={{ borderTop: '2px dashed #cbd5e1', paddingTop: '12px', color: '#64748b' }}>Warehouse Supervisor</div>
                                    </td>
                                    <td style={{ width: '33%', border: 'none', padding: '0 30px' }}>
                                        <div style={{ borderTop: '2px dashed #cbd5e1', paddingTop: '12px', color: '#64748b' }}>Driver Signature</div>
                                    </td>
                                    <td style={{ width: '33%', border: 'none', padding: '0 30px' }}>
                                        <div style={{ borderTop: '2px dashed #cbd5e1', paddingTop: '12px', color: '#64748b' }}>Security Check</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <button className="btn btn-secondary" onClick={() => setShowPrintModal(false)}>Close</button>
                    <button className="btn btn-primary" onClick={() => window.print()}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }}>
                            <polyline points="6 9 6 2 18 2 18 9"></polyline>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                            <rect x="6" y="14" width="12" height="8"></rect>
                        </svg>
                        Print
                    </button>
                </Modal.Footer>
            </Modal>

            {/* Gate Pass Preview Modal */}
            <Modal show={showGatePassModal} onHide={() => setShowGatePassModal(false)} size="xl" centered>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontWeight: 800 }}>Gate Passes (Dispatch Advice)</Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ backgroundColor: '#e2e8f0', padding: '30px' }}>
                    <div className="printable-gate-pass" style={{ color: '#000', fontFamily: "'Inter', sans-serif" }}>
                        {customerAggregatedOrders.length > 0 ? customerAggregatedOrders.map((aggOrder, idx) => (
                            <div key={idx} className="gate-pass-page" style={{ background: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: idx < customerAggregatedOrders.length - 1 ? '30px' : '0' }}>
                                
                                <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #1e293b', paddingBottom: '15px' }}>
                                    <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#1e3a8a', margin: '0 0 8px 0', letterSpacing: '2px', textDecoration: 'underline' }}>DISPATCH ADVICE</h1>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700, marginTop: '10px' }}>
                                        <div>Sl. No. : <span style={{ color: '#dc2626', fontWeight: 800, marginLeft: '4px' }}>{tripData.trip_id}/{idx + 1}</span></div>
                                        <div>Date: <span style={{ color: '#1e293b', marginLeft: '4px' }}>{tripData.trip_date ? tripData.trip_date.split('-').reverse().join('-') : ''}</span></div>
                                    </div>
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px', fontSize: '15px', fontWeight: 700 }}>
                                    <div>
                                        <div style={{ display: 'flex', marginBottom: '8px' }}>
                                            <div style={{ width: '100px', whiteSpace: 'nowrap' }}>Customer :</div>
                                            <div style={{ borderBottom: '1px dashed #94a3b8', flex: 1, paddingLeft: '8px', color: '#1e3a8a' }}>{aggOrder.customer_name}</div>
                                        </div>
                                        <div style={{ display: 'flex' }}>
                                            <div style={{ width: '100px', whiteSpace: 'nowrap' }}>Driver :</div>
                                            <div style={{ borderBottom: '1px dashed #94a3b8', flex: 1, paddingLeft: '8px' }}>{tripData.driver}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', marginBottom: '8px' }}>
                                            <div style={{ width: '100px', whiteSpace: 'nowrap' }}>Vehicle No. :</div>
                                            <div style={{ borderBottom: '1px dashed #94a3b8', flex: 1, paddingLeft: '8px' }}>{tripData.vehicle_number}</div>
                                        </div>
                                        <div style={{ display: 'flex' }}>
                                            <div style={{ width: '100px', whiteSpace: 'nowrap' }}>Mob :</div>
                                            <div style={{ borderBottom: '1px dashed #94a3b8', flex: 1, paddingLeft: '8px' }}></div>
                                        </div>
                                    </div>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '30px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontSize: '14px', width: '60px' }}>Sl. No.</th>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontSize: '14px', width: '120px' }}>Brand</th>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', fontSize: '14px' }}>Item/SKU</th>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontSize: '14px', width: '90px' }}>Qty.<br/>Advised</th>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontSize: '14px', width: '70px' }}>UOM</th>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontSize: '14px', width: '90px' }}>Qty.<br/>Loaded</th>
                                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontSize: '14px', width: '100px' }}>Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {aggOrder.raw_items && aggOrder.raw_items.map((item, i) => (
                                            <tr key={i}>
                                                <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', fontWeight: 600 }}>{i + 1}</td>
                                                <td style={{ border: '1px solid #000', padding: '10px 8px' }}></td>
                                                <td style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 600 }}>{item.name}</td>
                                                <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>{item.qty}</td>
                                                <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center' }}>{item.uom || ''}</td>
                                                <td style={{ border: '1px solid #000', padding: '10px 8px' }}></td>
                                                <td style={{ border: '1px solid #000', padding: '10px 8px' }}></td>
                                            </tr>
                                        ))}
                                        {/* Add some empty padding rows for hand-written additions */}
                                        {Array.from({ length: Math.max(0, 4 - (aggOrder.raw_items ? aggOrder.raw_items.length : 0)) }).map((_, i) => (
                                            <tr key={`empty-${i}`}>
                                                <td style={{ border: '1px solid #000', padding: '18px 8px' }}></td>
                                                <td style={{ border: '1px solid #000', padding: '18px 8px' }}></td>
                                                <td style={{ border: '1px solid #000', padding: '18px 8px' }}></td>
                                                <td style={{ border: '1px solid #000', padding: '18px 8px' }}></td>
                                                <td style={{ border: '1px solid #000', padding: '18px 8px' }}></td>
                                                <td style={{ border: '1px solid #000', padding: '18px 8px' }}></td>
                                                <td style={{ border: '1px solid #000', padding: '18px 8px' }}></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 600, marginTop: '30px', padding: '0 5px' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', whiteSpace: 'nowrap' }}>
                                        <span style={{ marginRight: '8px' }}>Initiated by:</span>
                                        <span style={{ width: '100px', borderBottom: '1px solid #000', display: 'inline-block' }}></span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', whiteSpace: 'nowrap' }}>
                                        <span style={{ marginRight: '8px' }}>Loaded by:</span>
                                        <span style={{ width: '100px', borderBottom: '1px solid #000', display: 'inline-block' }}></span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', whiteSpace: 'nowrap' }}>
                                        <span style={{ marginRight: '8px' }}>Bill No.</span>
                                        <span style={{ width: '80px', borderBottom: '1px solid #000', display: 'inline-block' }}></span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', whiteSpace: 'nowrap' }}>
                                        <span style={{ marginRight: '8px' }}>Security</span>
                                        <span style={{ width: '80px', borderBottom: '1px solid #000', display: 'inline-block' }}></span>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div style={{ textAlign: 'center', padding: '40px', fontSize: '1.2rem', color: '#64748b' }}>
                                No loaded orders to generate gate passes for.
                            </div>
                        )}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <button className="btn btn-secondary" onClick={() => setShowGatePassModal(false)}>Close</button>
                    <button className="btn btn-primary" onClick={() => {
                        const content = document.querySelector('.printable-gate-pass').innerHTML;
                        const printWindow = window.open('', '_blank');
                        printWindow.document.write(`
                            <html>
                                <head>
                                    <title>Gate Passes - TRP-${tripData.trip_id}</title>
                                    <style>
                                        @media print {
                                            @page { margin: 10mm; size: auto; }
                                            body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff !important; padding: 0 !important; margin: 0 !important; }
                                            .gate-pass-page { 
                                                page-break-inside: avoid; 
                                                page-break-after: always; 
                                                box-shadow: none !important; 
                                                margin: 0 0 20px 0 !important; 
                                                padding: 10px !important; 
                                                border: none !important;
                                            }
                                            .gate-pass-page:last-child { page-break-after: auto; }
                                        }
                                        body { font-family: 'Inter', sans-serif; background: #e2e8f0; padding: 20px; }
                                    </style>
                                </head>
                                <body>
                                    ${content}
                                    <script>
                                        window.onload = () => { window.print(); window.close(); }
                                    </script>
                                </body>
                            </html>
                        `);
                        printWindow.document.close();
                    }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }}>
                            <polyline points="6 9 6 2 18 2 18 9"></polyline>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                            <rect x="6" y="14" width="12" height="8"></rect>
                        </svg>
                        Print Gate Passes
                    </button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default TripLoadingScreen;
