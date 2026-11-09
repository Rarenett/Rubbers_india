import React, { useState, useEffect, useCallback } from 'react';
import { Card, Spinner } from 'react-bootstrap';
import Select from 'react-select';
import swal from 'sweetalert';
import SalesService from '../../../services/SalesService';
import LogisticsService from '../../../services/LogisticsService';
import { formatDate, formatDateTime } from '../../../utils/dateUtils';
import { usePageTitle } from '../../../context/TitleContext';

const SalesOrderBulkUpdate = () => {
    // ── State ──────────────────────────────────────────────────────────────
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Filters
    const [deliveryDateFilter, setDeliveryDateFilter] = useState('');

    // Bulk action state
    const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
    const [drivers, setDrivers] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    
    // Dropdown selections
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [selectedVehicle, setSelectedVehicle] = useState(null);

    // Fetch Masters
    useEffect(() => {
        const fetchMasters = async () => {
            try {
                const [driverRes, vehicleRes] = await Promise.all([
                    LogisticsService.getDrivers(),
                    LogisticsService.getVehicles()
                ]);
                
                const driverOptions = (Array.isArray(driverRes.data) ? driverRes.data : []).map(d => ({
                    value: d.id,
                    label: d.user_name || d.name || 'Unnamed Driver'
                }));
                
                const vehicleOptions = (Array.isArray(vehicleRes.data) ? vehicleRes.data : []).map(v => ({
                    value: v.id,
                    label: v.vehicle_name ? `${v.vehicle_name} (${v.vehicle_number})` : (v.vehicle_number || 'Unnamed Vehicle')
                }));
                
                setDrivers(driverOptions);
                setVehicles(vehicleOptions);
            } catch (err) {
                console.error("Failed to load drivers or vehicles", err);
            }
        };
        fetchMasters();
    }, []);

    usePageTitle("Bulk Update Sales Orders");

    // Fetch Orders when deliveryDateFilter changes
    const fetchOrders = useCallback(async () => {
        if (!deliveryDateFilter) {
            setOrders([]);
            setSelectedOrderIds(new Set());
            return;
        }

        setLoading(true);
        try {
            // del_from_date and del_to_date are used for preferred_delivery_date in backend
            const res = await SalesService.getSalesOrders({
                del_from_date: `${deliveryDateFilter}T00:00:00`,
                del_to_date: deliveryDateFilter
            });
            setOrders(Array.isArray(res.data) ? res.data : []);
            setSelectedOrderIds(new Set());
        } catch (err) {
            console.error('Error fetching orders:', err);
            swal('Error', 'Failed to fetch sales orders for the selected date.', 'error');
        } finally {
            setLoading(false);
        }
    }, [deliveryDateFilter]);

    useEffect(() => {
        if (deliveryDateFilter) {
            fetchOrders();
        }
    }, [fetchOrders, deliveryDateFilter]);

    // Checkbox Handlers
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const allIds = new Set(orders.map(o => o.id));
            setSelectedOrderIds(allIds);
        } else {
            setSelectedOrderIds(new Set());
        }
    };

    const handleSelectRow = (id) => {
        const newSet = new Set(selectedOrderIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedOrderIds(newSet);
    };

    // Bulk Apply Handler
    const handleApply = async () => {
        if (selectedOrderIds.size === 0) {
            swal('Warning', 'Please select at least one order to update.', 'warning');
            return;
        }
        
        if (!selectedDriver && !selectedVehicle) {
            swal('Warning', 'Please select a driver or vehicle to apply.', 'warning');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                order_ids: Array.from(selectedOrderIds)
            };
            
            if (selectedDriver) payload.driver = selectedDriver.value;
            if (selectedVehicle) payload.vehicle = selectedVehicle.value;
            
            await SalesService.bulkUpdateSalesOrders(payload);
            
            swal('Success', `Successfully updated ${selectedOrderIds.size} orders.`, 'success');
            
            // Clear selection and refresh list
            setSelectedDriver(null);
            setSelectedVehicle(null);
            await fetchOrders();
            
        } catch (err) {
            console.error('Error in bulk update:', err);
            const msg = err.response?.data?.detail || 'Failed to update orders.';
            swal('Error', msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Status Badge
    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Delivered': return 'badge badge-success light';
            case 'Pending': return 'badge badge-warning light';
            case 'Cancelled': return 'badge badge-danger light';
            case 'Shipped': return 'badge badge-info light';
            case 'On Hold': return 'badge badge-secondary light';
            default: return 'badge bg-light text-dark';
        }
    };

    return (
        <div className="container-fluid">
            <Card>
                <Card.Header className="d-flex flex-column flex-xl-row gap-3 px-4 py-3 align-items-start align-items-xl-center justify-content-between w-100">
                    <Card.Title className="mb-0 text-nowrap">Sales Order Bulk Update</Card.Title>
                    <div className="d-flex flex-wrap justify-content-start justify-content-xl-end align-items-center gap-3 flex-grow-1">
                        
                        {/* Date Filter */}
                        <div className="d-flex align-items-center gap-2" style={{ flex: '0 0 auto' }}>
                            <label className="form-label mb-0 fw-bold text-nowrap" style={{ minWidth: '40px' }}>Delivery Date:</label>
                            <input 
                                type="date" 
                                className="form-control" 
                                value={deliveryDateFilter}
                                onChange={(e) => setDeliveryDateFilter(e.target.value)}
                                style={{ height: '37px', borderRadius: '6px', fontSize: '13px', width: '150px' }}
                            />
                        </div>

                        {/* Driver Selection */}
                        <div className="d-flex align-items-center" style={{ flex: '0 0 auto', minWidth: '200px', maxWidth: '300px', zIndex: 999 }}>
                            <div style={{ width: '100%' }}>
                                <Select
                                    value={selectedDriver}
                                    onChange={setSelectedDriver}
                                    options={drivers}
                                    isClearable
                                    placeholder="Select Driver..."
                                    classNamePrefix="select"
                                    isDisabled={selectedOrderIds.size === 0}
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            borderRadius: '6px',
                                            borderColor: '#cbd5e1',
                                            minHeight: '37px',
                                            height: '37px',
                                            boxShadow: 'none',
                                            '&:hover': { borderColor: '#94a3b8' },
                                            cursor: 'pointer'
                                        }),
                                        menu: (base) => ({
                                            ...base,
                                            borderRadius: '6px',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                                            border: '1px solid #e2e8f0',
                                            zIndex: 9999
                                        }),
                                        option: (base, state) => ({
                                            ...base,
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            backgroundColor: state.isSelected ? '#eff6ff' : state.isFocused ? '#f8fafc' : 'white',
                                            color: state.isSelected ? '#1d4ed8' : '#475569',
                                            cursor: 'pointer',
                                            '&:active': { backgroundColor: '#dbeafe' }
                                        })
                                    }}
                                />
                            </div>
                        </div>

                        {/* Vehicle Selection */}
                        <div className="d-flex align-items-center" style={{ flex: '0 0 auto', minWidth: '200px', maxWidth: '300px', zIndex: 999 }}>
                            <div style={{ width: '100%' }}>
                                <Select
                                    value={selectedVehicle}
                                    onChange={setSelectedVehicle}
                                    options={vehicles}
                                    isClearable
                                    placeholder="Select Vehicle..."
                                    classNamePrefix="select"
                                    isDisabled={selectedOrderIds.size === 0}
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            borderRadius: '6px',
                                            borderColor: '#cbd5e1',
                                            minHeight: '37px',
                                            height: '37px',
                                            boxShadow: 'none',
                                            '&:hover': { borderColor: '#94a3b8' },
                                            cursor: 'pointer'
                                        }),
                                        menu: (base) => ({
                                            ...base,
                                            borderRadius: '6px',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                                            border: '1px solid #e2e8f0',
                                            zIndex: 9999
                                        }),
                                        option: (base, state) => ({
                                            ...base,
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            backgroundColor: state.isSelected ? '#eff6ff' : state.isFocused ? '#f8fafc' : 'white',
                                            color: state.isSelected ? '#1d4ed8' : '#475569',
                                            cursor: 'pointer',
                                            '&:active': { backgroundColor: '#dbeafe' }
                                        })
                                    }}
                                />
                            </div>
                        </div>

                        {/* Apply Button */}
                        <div className="search-bar-container" style={{ flex: '0 0 auto', margin: 0 }}>
                            <button 
                                className="btn text-white d-flex align-items-center justify-content-center"
                                onClick={handleApply}
                                disabled={selectedOrderIds.size === 0 || (!selectedDriver && !selectedVehicle) || loading}
                                style={{ 
                                    height: '38px', 
                                    borderRadius: '6px', 
                                    whiteSpace: 'nowrap', 
                                    padding: '0 16px', 
                                    backgroundColor: '#1a3a72', 
                                    borderColor: '#1a3a72', 
                                    fontWeight: '600', 
                                    fontSize: '13px', 
                                    minWidth: '130px',
                                    opacity: (selectedOrderIds.size === 0 || (!selectedDriver && !selectedVehicle) || loading) ? 0.6 : 1
                                }}
                            >
                                {loading ? <Spinner size="sm" /> : 'Apply to Selected'}
                            </button>
                        </div>
                    </div>
                </Card.Header>
                <Card.Body>
                    {/* Table Area */}
                    <div className="table-responsive">
                        <table className="table table-responsive-md table-hover">
                            <thead>
                                <tr>
                                    <th style={{ width: '50px' }}>
                                        <div className="form-check custom-checkbox">
                                            <input 
                                                type="checkbox" 
                                                className="form-check-input" 
                                                id="selectAll"
                                                checked={orders.length > 0 && selectedOrderIds.size === orders.length}
                                                onChange={handleSelectAll}
                                                disabled={orders.length === 0}  
                                            />
                                        </div>
                                    </th>
                                    <th><strong>SL NO</strong></th>
                                    <th><strong>ORDER NO.</strong></th>
                                    <th><strong>ORDER DATE</strong></th>
                                    <th><strong>CUSTOMER NAME</strong></th>
                                    <th><strong>DRIVER</strong></th>
                                    <th><strong>VEHICLE</strong></th>
                                    <th className="text-end"><strong>TOTAL AMOUNT</strong></th>
                                    <th><strong>DELIVERY DATE & TIME</strong></th>
                                    <th><strong>STATUS</strong></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && orders.length === 0 ? (
                                    <tr><td colSpan="10" className="text-center py-4"><Spinner animation="border" variant="primary" /></td></tr>
                                ) : !deliveryDateFilter ? (
                                    <tr><td colSpan="10" className="text-center py-5 text-muted">Please select a delivery date to fetch orders.</td></tr>
                                ) : orders.length === 0 ? (
                                    <tr><td colSpan="10" className="text-center py-5 text-muted">No sales orders found for this delivery date.</td></tr>
                                ) : (
                                    orders.map((order, idx) => (
                                        <tr key={order.id} className={selectedOrderIds.has(order.id) ? 'bg-light' : ''}>
                                            <td>
                                                <div className="form-check custom-checkbox">
                                                    <input 
                                                        type="checkbox" 
                                                        className="form-check-input" 
                                                        id={`check-${order.id}`}
                                                        checked={selectedOrderIds.has(order.id)}
                                                        onChange={() => handleSelectRow(order.id)}
                                                    />
                                                </div>
                                            </td>
                                            <td>{idx + 1}</td>
                                            <td>
                                                <span className="text-primary fw-bold">{order.so_no}</span>
                                            </td>
                                            <td>{formatDate(order.entry_date)}</td>
                                            <td className="fw-semibold">{order.customer_ledger_name || '—'}</td>
                                            <td>
                                                {order.driver_name ? (
                                                    <span className="badge badge-primary light badge-sm d-inline-flex align-items-center gap-1">
                                                        <i className="fa fa-user text-primary" style={{ fontSize: '0.75rem' }}></i> 
                                                        <span>{order.driver_name}</span>
                                                    </span>
                                                ) : <span className="text-muted">—</span>}
                                            </td>
                                            <td>
                                                {order.vehicle_name ? (
                                                    <span className="badge badge-info light badge-sm d-inline-flex align-items-center gap-1">
                                                        <i className="fa fa-truck text-info" style={{ fontSize: '0.75rem' }}></i> 
                                                        <span>{order.vehicle_name}</span>
                                                    </span>
                                                ) : <span className="text-muted">—</span>}
                                            </td>
                                            <td className="text-end fw-bold text-success">
                                                {order.total_amount}
                                            </td>
                                            <td>
                                                {formatDateTime(order.preferred_delivery_date)}
                                            </td>
                                            <td>
                                                <span className={getStatusBadgeClass(order.status)}>
                                                    {order.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card.Body>
            </Card>
        </div>
    );
};

export default SalesOrderBulkUpdate;
