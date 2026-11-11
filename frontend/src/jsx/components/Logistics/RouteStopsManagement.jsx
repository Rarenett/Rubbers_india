import React, { useState, useEffect, useRef } from 'react';
import { Card, Form, Button, Row, Col, Modal, Table } from 'react-bootstrap';
import Select from 'react-select';
import swal from 'sweetalert';
import LogisticsService from '../../../services/LogisticsService';
import SalesService from '../../../services/SalesService';
import PageTitle from '../../layouts/PageTitle';

import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const RouteStopsManagement = () => {
    const { can } = usePermission();
    const [routes, setRoutes] = useState([]);
    const [filteredRoutes, setFilteredRoutes] = useState([]);
    const [deliveryLocations, setDeliveryLocations] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [selectedStop, setSelectedStop] = useState(null);
    const [stops, setStops] = useState([]);
    const [stopDistances, setStopDistances] = useState({});

    const sortStopsAsc = (stopsArray, distances = stopDistances) => {
        return [...stopsArray].sort((a, b) => {
            const distA = distances[a.toLowerCase().trim()] || 0;
            const distB = distances[b.toLowerCase().trim()] || 0;
            return distA - distB;
        });
    };

    const dragItem = useRef();
    const dragOverItem = useRef();

    useEffect(() => {
        fetchRoutes();
        fetchDeliveryLocations();
    }, []);

    useEffect(() => {
        const filtered = routes.filter(route => 
            route.route_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredRoutes(filtered);
        setCurrentPage(1);
    }, [searchTerm, routes]);

    const fetchRoutes = async () => {
        try {
            const res = await LogisticsService.getRouteMasters();
            if (res.data) {
                const opts = res.data.map(r => ({
                    ...r,
                    value: r.id,
                    label: r.route_name,
                    existingStops: r.stops || []
                }));
                setRoutes(opts);
                setFilteredRoutes(opts);
            }
        } catch (error) {
            console.error('Error fetching routes:', error);
        }
    };

    const fetchDeliveryLocations = async () => {
        try {
            const res = await SalesService.getDeliveryLocations();
            const stopsRes = await LogisticsService.getRouteStopMasters();
            
            let distances = {};
            if (stopsRes.data) {
                stopsRes.data.forEach(s => {
                    if (s.stop_name) {
                        distances[s.stop_name.toLowerCase().trim()] = parseFloat(s.distance_km) || 0;
                    }
                });
                setStopDistances(distances);
            }

            const uniqueLocations = [];
            const seen = new Set();
            
            if (res.data) {
                res.data.forEach(loc => {
                    if (loc.location_name) {
                        const normalized = loc.location_name.toLowerCase().trim();
                        if (!seen.has(normalized)) {
                            seen.add(normalized);
                            uniqueLocations.push({
                                value: loc.id,
                                label: loc.location_name.trim(),
                                distance: distances[normalized] !== undefined ? distances[normalized] : 999999
                            });
                        }
                    }
                });
            }

            if (stopsRes.data) {
                stopsRes.data.forEach(s => {
                    if (s.stop_name) {
                        const normalized = s.stop_name.toLowerCase().trim();
                        if (!seen.has(normalized)) {
                            seen.add(normalized);
                            uniqueLocations.push({
                                value: s.id || `rs_${normalized}`,
                                label: s.stop_name.trim(),
                                distance: distances[normalized] !== undefined ? distances[normalized] : (parseFloat(s.distance_km) || 999999)
                            });
                        }
                    }
                });
            }
            
            uniqueLocations.sort((a, b) => a.distance - b.distance);
            setDeliveryLocations(uniqueLocations);
        } catch (error) {
            console.error("Error fetching delivery locations:", error);
        }
    };

    const handleDeleteRoute = async (id) => {
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
                swal("Deleted!", "Route has been deleted.", "success");
                fetchRoutes();
            } catch (error) {
                console.error("Error deleting route", error);
                swal("Error", "Failed to delete route", "error");
            }
        }
    };

    const openModal = (routeOpt = null) => {
        if (routeOpt) {
            setSelectedRoute(routeOpt);
            setStops(sortStopsAsc([...routeOpt.existingStops]));
        } else {
            setSelectedRoute(null);
            setStops([]);
        }
        setSelectedStop(null);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedRoute(null);
        setStops([]);
        setSelectedStop(null);
    };

    const handleRouteSelect = (option) => {
        setSelectedRoute(option);
        if (option) {
            setStops(sortStopsAsc([...option.existingStops]));
        } else {
            setStops([]);
        }
    };

    const handleAddStop = () => {
        if (!selectedRoute) {
            swal('Error', 'Please select a route first', 'error');
            return;
        }
        if (selectedStop && selectedStop.label.trim()) {
            setStops(sortStopsAsc([...stops, selectedStop.label.trim()]));
            setSelectedStop(null);
        }
    };

    const handleRemoveStop = (index) => {
        setStops(stops.filter((_, i) => i !== index));
    };

    const dragStart = (e, position) => {
        dragItem.current = position;
        e.dataTransfer.effectAllowed = "move";
        setTimeout(() => {
            e.target.style.opacity = '0.5';
        }, 0);
    };

    const dragEnter = (e, position) => {
        dragOverItem.current = position;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const dragEnd = (e) => {
        e.target.style.opacity = '1';
        if (dragItem.current !== undefined && dragOverItem.current !== undefined && dragItem.current !== dragOverItem.current) {
            const newStops = [...stops];
            const dragItemContent = newStops[dragItem.current];
            newStops.splice(dragItem.current, 1);
            newStops.splice(dragOverItem.current, 0, dragItemContent);
            setStops(newStops);
        }
        dragItem.current = undefined;
        dragOverItem.current = undefined;
    };

    const handleSubmit = async () => {
        if (!selectedRoute) {
            swal('Error', 'Please select a route', 'error');
            return;
        }

        try {
            await LogisticsService.patchRouteMaster(selectedRoute.value, { stops });
            swal('Success', 'Route stops updated successfully!', 'success');
            
            // Refresh list
            fetchRoutes();
            closeModal();
        } catch (error) {
            console.error('Error updating stops:', error);
            swal('Error', 'Failed to update stops', 'error');
        }
    };

    // Pagination logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredRoutes.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredRoutes.length / itemsPerPage);

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#0a500f' : '#e0e0e0',
            boxShadow: state.isFocused ? '0 0 0 2px rgba(10, 80, 15,0.15)' : 'none',
            '&:hover': { borderColor: '#0a500f' },
            borderRadius: '6px',
            fontSize: '0.875rem',
        }),
        menu: base => ({ ...base, zIndex: 9999, fontSize: '0.875rem' }),
        menuPortal: base => ({ ...base, zIndex: 9999 }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? '#f0fdf6' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    return (
        <>
            <style>{`
                .quick-add-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    background: linear-gradient(135deg, #0a500f, #073d0b);
                    border: none;
                    color: white;
                    font-size: 18px;
                    font-weight: 400;
                    line-height: 1;
                    cursor: pointer;
                    flex-shrink: 0;
                    transition: opacity 0.2s, transform 0.15s;
                    box-shadow: 0 2px 6px rgba(10, 80, 15,0.35);
                    margin-top: 1px;
                }
                .quick-add-btn:hover {
                    opacity: 0.88;
                    transform: scale(1.08);
                }
                .quick-add-btn:active { transform: scale(0.96); }
                .item-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .item-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .item-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .item-custom-modal .modal-close-x {
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    color: #aaa;
                    cursor: pointer;
                    transition: color 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                }
                .item-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .item-custom-modal .modal-body-custom {
                    padding: 0;
                    max-height: 70vh;
                    min-height: 450px;
                    overflow-y: auto;
                }
                .item-custom-tabs {
                    border-bottom: 1px solid #e2e8f0;
                    padding: 0 28px;
                    background: #fff;
                }
                .item-custom-tabs .nav-link {
                    color: #64748b;
                    font-weight: 500;
                    padding: 16px 20px;
                    border: none;
                    border-bottom: 2px solid transparent;
                    margin-bottom: -1px;
                    transition: all 0.2s;
                }
                .item-custom-tabs .nav-link:hover { color: #475569; border-bottom-color: #cbd5e1; }
                .item-custom-tabs .nav-link.active {
                    color: #0a500f;
                    background: transparent;
                    border-bottom-color: #0a500f;
                }
                .item-tab-content { padding: 24px 28px; }
                .item-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .item-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .item-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .item-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .item-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .item-custom-modal .form-check-input:checked {
                    background-color: #0a500f;
                    border-color: #0a500f;
                }
                .item-custom-modal .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .item-custom-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .item-custom-modal .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .item-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                .item-custom-modal .dropzone-upload {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    text-align: center;
                    border: 2px dashed #cbd5e1;
                    border-radius: 12px;
                    background-color: #fafbfc;
                    padding: 28px 20px;
                    cursor: pointer;
                    transition: border-color 0.2s, background-color 0.2s, transform 0.15s;
                    outline: none;
                }
                .item-custom-modal .dropzone-upload:hover {
                    border-color: #0a500f;
                    background-color: #f0fdf6;
                }
                .item-custom-modal .dropzone-upload:focus-visible {
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .item-custom-modal .dropzone-upload.dragging {
                    border-color: #16a34a;
                    border-style: solid;
                    background-color: #ecfdf5;
                    transform: scale(1.01);
                }
                .item-custom-modal .dropzone-upload .dz-icon {
                    width: 36px;
                    height: 36px;
                    color: #0a500f;
                }
                .item-custom-modal .dropzone-upload .dz-title {
                    font-size: 13.5px;
                    font-weight: 600;
                    color: #475569;
                }
                .item-custom-modal .dropzone-upload .dz-title span {
                    color: #16a34a;
                    text-decoration: underline;
                }
                .item-custom-modal .dropzone-upload .dz-subtitle {
                    font-size: 11.5px;
                    color: #94a3b8;
                }
                .item-custom-modal .dropzone-upload.has-image {
                    flex-direction: row;
                    justify-content: flex-start;
                    text-align: left;
                    padding: 12px 16px;
                    gap: 14px;
                }
                .item-custom-modal .dz-thumb {
                    width: 60px;
                    height: 60px;
                    border-radius: 10px;
                    object-fit: cover;
                    border: 1px solid #e2e8f0;
                    flex-shrink: 0;
                }
                .item-custom-modal .dz-file-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    overflow: hidden;
                    flex: 1;
                }
                .item-custom-modal .dz-file-name {
                    font-size: 13px;
                    font-weight: 500;
                    color: #334155;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .item-custom-modal .dz-file-hint {
                    font-size: 11.5px;
                    color: #64748b;
                }
                .item-custom-modal .dz-remove-btn {
                    flex-shrink: 0;
                    width: 26px;
                    height: 26px;
                    border-radius: 50%;
                    border: none;
                    background-color: #fee2e2;
                    color: #dc2626;
                    font-size: 14px;
                    line-height: 1;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background-color 0.2s;
                }
                .item-custom-modal .dz-remove-btn:hover {
                    background-color: #fecaca;
                }
            `}</style>
            <PageTitle activeMenu="Route Stops" motherMenu="Logistics" />
            <div className="container-fluid">
            <Row>
                <Col lg={12}>
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Route Stops Management</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Route..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '34px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <CreateButton module="route_stops" onClick={() => openModal()}>
                                    Route Stops
                                </CreateButton>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <div className="table-responsive">
                                <table className="table table-responsive-md">
                                    <thead>
                                        <tr>
                                            <th><strong>SI NO</strong></th>
                                            <th><strong>ROUTE NAME</strong></th>
                                            <th><strong>START POINT</strong></th>
                                            <th><strong>END POINT</strong></th>
                                            <th><strong>STOPS</strong></th>
                                            <th className="text-end"><strong>ACTIONS</strong></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentItems.length > 0 ? currentItems.map((route, idx) => (
                                            <tr key={route.id} style={{ verticalAlign: 'middle' }}>
                                                <td><strong>{indexOfFirstItem + idx + 1}</strong></td>
                                                <td><strong>{route.route_name}</strong></td>
                                                <td>{route.start_point}</td>
                                                <td>{route.end_point}</td>
                                                <td>
                                                    {route.existingStops && route.existingStops.length > 0 ? (
                                                        <span className="badge badge-info light">{route.existingStops.length} Stops</span>
                                                    ) : (
                                                        <span className="badge badge-light light text-muted border">No Stops</span>
                                                    )}
                                                </td>
                                                <td className="text-end">
                                                    {can('routes', 'edit') || can('routes', 'delete') ? (
                                                        <div className="d-flex justify-content-end gap-2">
                                                            <EditButton
                                                                module="route_stops"
                                                                onClick={() => openModal(route)}
                                                            />
                                                            <DeleteButton
                                                                module="route_stops"
                                                                onClick={() => handleDeleteRoute(route.id)}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="badge badge-danger light mt-1">No Access</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="6" className="text-center py-4 text-muted">No entries</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {filteredRoutes.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3">
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
                </Col>
            </Row>
            </div>

            {/* Custom Styled Popup Modal for Route Stops */}
            <Modal 
                show={isModalOpen} 
                onHide={closeModal} 
                dialogClassName="item-custom-modal"
                size="lg" 
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            {/* Route Icon */}
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 10H9v-2h6v2zm3-4H6V8h12v2z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {selectedRoute && selectedRoute.existingStops && selectedRoute.existingStops.length > 0 ? 'Edit Route Stops' : 'Create Route Stops'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage route stops
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={closeModal}>
                        &times;
                    </button>
                </div>

                <div className="modal-body-custom">
                    <div className="item-tab-content">
                        <div className="row mb-3">
                            <div className="col-md-12">
                                <Form.Label className="form-label-custom">Select Route <span className="text-danger">*</span></Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    options={routes}
                                    value={selectedRoute}
                                    onChange={handleRouteSelect}
                                    placeholder="Search Route..."
                                    isClearable
                                    styles={selectStyles}
                                    menuPortalTarget={document.body}
                                />
                            </div>
                        </div>

                        <div className="row mb-3">
                            <div className="col-md-12">
                                <Form.Label className="form-label-custom">Stop</Form.Label>
                                <div className="d-flex align-items-end gap-2">
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Select
                                            classNamePrefix="react-select"
                                            options={deliveryLocations.filter(loc => !stops.some(stop => stop.toLowerCase() === loc.label.toLowerCase()))}
                                            value={selectedStop}
                                            onChange={(option) => setSelectedStop(option)}
                                            placeholder="Search delivery location..."
                                            isClearable
                                            styles={selectStyles}
                                            menuPortalTarget={document.body}
                                        />
                                    </div>
                                    <button 
                                        type="button" 
                                        className="quick-add-btn" 
                                        title="Stop"
                                        onClick={handleAddStop}
                                    >+</button>
                                </div>
                            </div>
                        </div>

                        <div className="row mb-2">
                                    <div className="col-md-12">
                                        <Form.Label className="form-label-custom text-muted mb-2">Stops Detail (Auto-sorted by Distance)</Form.Label>
                                        <div className="table-responsive">
                                            <table className="table table-responsive-md mb-0">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '50px', textAlign: 'center' }}><strong>#</strong></th>
                                                        <th><strong>LOCATION NAME</strong></th>
                                                        <th className="text-center" style={{ width: '80px' }}><strong>ACTION</strong></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {stops.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="3" className="text-center py-4 text-muted">
                                                                No stops added yet
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        stops.map((stop, i) => (
                                                            <tr 
                                                                key={i}
                                                                draggable
                                                                onDragStart={(e) => dragStart(e, i)}
                                                                onDragEnter={(e) => dragEnter(e, i)}
                                                                onDragEnd={dragEnd}
                                                                onDragOver={(e) => e.preventDefault()}
                                                                style={{ cursor: 'grab', transition: 'opacity 0.2s', backgroundColor: dragOverItem.current === i ? '#f8fafc' : 'inherit' }}
                                                            >
                                                                <td className="text-center" style={{ verticalAlign: 'middle' }}>
                                                                    <i className="fa fa-grip-vertical text-muted me-2" style={{ cursor: 'grab' }}></i> {i + 1}
                                                                </td>
                                                                <td style={{ verticalAlign: 'middle' }}><strong>{stop}</strong></td>
                                                                <td className="text-center" style={{ verticalAlign: 'middle' }}>
                                                                    <div className="d-flex justify-content-center">
                                                                        <button type="button" className="dz-remove-btn" onClick={() => handleRemoveStop(i)} title="Remove Stop">
                                                                            <i className="fa fa-trash"></i>
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                    </div>
                </div>
                
                <div className="modal-footer-custom">
                    <Button type="button" className="btn-close-custom" onClick={closeModal}>
                        Close
                    </Button>
                    <Button type="button" className="btn-save-custom" onClick={handleSubmit}>
                        Save & Next
                    </Button>
                </div>
            </Modal>
        </>
    );
};

export default RouteStopsManagement;
