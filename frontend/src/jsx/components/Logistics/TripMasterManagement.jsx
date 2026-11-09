import React, { useState, useEffect } from 'react';
import { Card, Form, Row, Col, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import swal from 'sweetalert';
import LogisticsService from '../../../services/LogisticsService';
import PageTitle from '../../layouts/PageTitle';

import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const TripMasterManagement = () => {
    const { can } = usePermission();
    const navigate = useNavigate();
    
    // Data states
    const [trips, setTrips] = useState([]);
    const [filteredTrips, setFilteredTrips] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [routes, setRoutes] = useState([]);
    
    // UI states
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentTripId, setCurrentTripId] = useState(null);
    const [loading, setLoading] = useState(false);
    
    // Form states
    const [tripDate, setTripDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [selectedRoute, setSelectedRoute] = useState(null);

    // Pagination (using a simple setup similar to StockItemList)
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    useEffect(() => {
        fetchTrips();
        fetchDropdownData();
    }, []);

    useEffect(() => {
        const filtered = trips.filter(trip => 
            (trip.trip_id && trip.trip_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (trip.vehicle_name && trip.vehicle_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (trip.driver_name && trip.driver_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (trip.route_name && trip.route_name.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        setFilteredTrips(filtered);
        setCurrentPage(1);
    }, [searchTerm, trips]);

    const fetchTrips = async () => {
        setLoading(true);
        try {
            const response = await LogisticsService.getTripMasters();
            setTrips(response.data);
            setFilteredTrips(response.data);
        } catch (error) {
            console.error("Error fetching trips:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDropdownData = async () => {
        try {
            const [vehRes, drvRes, routeRes] = await Promise.all([
                LogisticsService.getVehicles(),
                LogisticsService.getDrivers(),
                LogisticsService.getRouteMasters()
            ]);
            
            setVehicles(vehRes.data.map(v => ({ value: v.id, label: v.vehicle_name || v.registration_number || `Vehicle ${v.id}`, driverId: v.driver })));
            setDrivers(drvRes.data.map(d => ({ value: d.id, label: d.name || d.user_full_name || `Driver ${d.id}` })));
            setRoutes(routeRes.data.map(r => ({ value: r.id, label: r.route_name })));
        } catch (error) {
            console.error("Error fetching dropdown data:", error);
        }
    };

    const handleVehicleChange = (selectedOption) => {
        setSelectedVehicle(selectedOption);
        if (selectedOption && selectedOption.driverId) {
            const assignedDriver = drivers.find(d => d.value === selectedOption.driverId);
            if (assignedDriver) {
                setSelectedDriver(assignedDriver);
            }
        }
    };

    const handleShowModal = (trip = null) => {
        if (trip) {
            setIsEditing(true);
            setCurrentTripId(trip.id);
            setTripDate(trip.trip_date || new Date().toISOString().split('T')[0]);
            
            const veh = vehicles.find(v => v.value === trip.vehicle);
            setSelectedVehicle(veh || null);
            
            const drv = drivers.find(d => d.value === trip.driver);
            setSelectedDriver(drv || null);
            
            const rt = routes.find(r => r.value === trip.route);
            setSelectedRoute(rt || null);
        } else {
            setIsEditing(false);
            setCurrentTripId(null);
            setTripDate(new Date().toISOString().split('T')[0]);
            setSelectedVehicle(null);
            setSelectedDriver(null);
            setSelectedRoute(null);
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!tripDate || !selectedVehicle || !selectedDriver || !selectedRoute) {
            swal('Warning', 'Please fill all required fields.', 'warning');
            return;
        }

        const payload = {
            trip_date: tripDate,
            vehicle: selectedVehicle.value,
            driver: selectedDriver.value,
            route: selectedRoute.value
        };

        try {
            if (isEditing) {
                await LogisticsService.patchTripMaster(currentTripId, payload);
                swal('Success', 'Trip updated successfully!', 'success');
            } else {
                await LogisticsService.createTripMaster(payload);
                swal('Success', 'Trip created successfully!', 'success');
            }
            handleCloseModal();
            fetchTrips();
        } catch (error) {
            console.error('Error saving trip:', error);
            swal('Error', 'Failed to save trip. Please try again.', 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirm = await swal({
            title: "Are you sure?",
            text: "Once deleted, you will not be able to recover this trip!",
            icon: "warning",
            buttons: true,
            dangerMode: true,
        });

        if (confirm) {
            try {
                await LogisticsService.deleteTripMaster(id);
                swal("Deleted!", "Trip has been deleted.", "success");
                fetchTrips();
            } catch (error) {
                console.error("Error deleting trip", error);
                swal("Error", "Failed to delete trip", "error");
            }
        }
    };

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredTrips.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredTrips.length / itemsPerPage);

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#2ece8a' : '#e0e0e0',
            boxShadow: state.isFocused ? '0 0 0 1px #2ece8a' : 'none',
            '&:hover': {
                borderColor: state.isFocused ? '#2ece8a' : '#2ece8a'
            },
            borderRadius: '8px',
            fontSize: '13px'
        }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#2ece8a' : state.isFocused ? '#f8f9fa' : 'white',
            color: state.isSelected ? 'white' : '#333',
            fontSize: '13px',
            cursor: 'pointer',
            '&:hover': {
                backgroundColor: state.isSelected ? '#2ece8a' : '#f8f9fa'
            }
        }),
        menuPortal: base => ({ ...base, zIndex: 9999 })
    };

    return (
        <>
            <PageTitle activeMenu="Trip Master" motherMenu="Logistics" />
            <div className="container-fluid">
            <Row>
                <Col lg={12}>
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Trip Master Management</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Trip..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '35px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <CreateButton module="trip_master" onClick={() => handleShowModal()}>
                                    Trip Master
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
                                <div className="table-responsive">
                                    <table className="table table-responsive-md">
                                        <thead>
                                            <tr>
                                                <th><strong>SI NO</strong></th>
                                                <th><strong>TRIP ID</strong></th>
                                                <th><strong>DATE</strong></th>
                                                <th><strong>VEHICLE</strong></th>
                                                <th><strong>DRIVER</strong></th>
                                                <th><strong>ROUTE</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentItems.length > 0 ? currentItems.map((trip, idx) => (
                                                <tr key={trip.id} style={{ verticalAlign: 'middle' }}>
                                                    <td><strong>{indexOfFirstItem + idx + 1}</strong></td>
                                                    <td><strong>{trip.trip_id}</strong></td>
                                                    <td>{trip.trip_date ? trip.trip_date.split('-').reverse().join('-') : 'N/A'}</td>
                                                    <td>{trip.vehicle_name || 'N/A'}</td>
                                                    <td>{trip.driver_name || 'N/A'}</td>
                                                    <td>{trip.route_name || 'N/A'}</td>
                                                    <td className="text-end">
                                                        {can('trips', 'edit') || can('trips', 'delete') ? (
                                                            <div className="d-flex justify-content-end gap-2">
                                                                <button
                                                                    className="btn btn-primary shadow btn-xs sharp me-1"
                                                                    title="Loading Screen"
                                                                    onClick={() => navigate(`/trip-loading/${trip.id}`)}
                                                                >
                                                                    <i className="fa fa-cog"></i>
                                                                </button>
                                                                <EditButton
                                                                    module="trip_master"
                                                                    onClick={() => handleShowModal(trip)}
                                                                />
                                                                <DeleteButton
                                                                    module="trip_master"
                                                                    onClick={() => handleDelete(trip.id)}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span className="badge badge-danger light mt-1">No Access</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="7" className="text-center py-4 text-muted">No trips found.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {filteredTrips.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredTrips.length)} of {filteredTrips.length} entries
                                    </div>
                                            {totalPages > 1 && (
                                                <nav>
                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                            <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-left" />
                                                </button>
                                            </li>
                                            {[...Array(totalPages)].map((_, idx) => (
                                                <li key={idx} className={`page-item ${currentPage === idx + 1 ? 'active' : ''}`}>
                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(idx + 1)} style={{ border: 'none', background: currentPage === idx + 1 ? '' : 'none' }}>
                                                        {idx + 1}
                                                    </button>
                                                </li>
                                            ))}
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

            <Modal 
                show={showModal} 
                onHide={handleCloseModal}
                backdrop="static"
                keyboard={false}
                centered
                size="md"
                dialogClassName="custom-modal-fade"
                contentClassName="border-0 shadow-lg"
                style={{ borderRadius: '16px', overflow: 'hidden' }}
            >
                <div style={{ padding: '24px 32px' }}>
                    <Form onSubmit={handleSubmit}>
                        <style>{`
                            .pkg-close-btn {
                                background-color: #7A70BA !important;
                                color: white !important;
                                border-radius: 8px !important;
                                font-weight: 500 !important;
                                font-size: 14px !important;
                                padding: 10px 24px !important;
                                border: none !important;
                                cursor: pointer;
                                transition: background-color 0.2s, transform 0.1s !important;
                            }
                            .pkg-close-btn:hover {
                                background-color: #6357a7 !important;
                            }
                            .pkg-submit-btn {
                                background-color: #2ece8a !important;
                                color: white !important;
                                border-radius: 8px !important;
                                font-weight: 500 !important;
                                font-size: 14px !important;
                                padding: 10px 24px !important;
                                border: none !important;
                                cursor: pointer;
                                transition: background-color 0.2s, transform 0.1s !important;
                            }
                            .pkg-submit-btn:hover, .pkg-submit-btn:focus {
                                background-color: #26b277 !important;
                                box-shadow: 0 0 0 4px rgba(46, 206, 138, 0.4) !important;
                                outline: none !important;
                            }
                        `}</style>
                        <div style={{ marginBottom: '0' }}>
                            <div className="d-flex align-items-center justify-content-between gap-3 mb-1" style={{ paddingBottom: '4px' }}>
                                <div className="d-flex align-items-center gap-3">
                                    <div style={{
                                        width: '48px', height: '48px', borderRadius: '50%',
                                        background: 'var(--primary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                            <line x1="12" y1="22.08" x2="12" y2="12"></line>
                                        </svg>
                                    </div>
                                    <div>
                                        <h5 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>
                                            {isEditing ? 'Edit Trip' : 'Add New Trip'}
                                        </h5>
                                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                                            Configure trip details and assign vehicles
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <hr style={{ borderColor: '#e2e8f0', margin: '16px 0 20px 0' }} />

                        <Row>
                            <Col md={12}>
                                <Form.Group className="mb-3">
                                    <label className="fw-semibold">Trip Date <span className="text-danger">*</span></label>
                                    <Form.Control
                                        type="date"
                                        className="form-control"
                                        value={tripDate}
                                        onChange={(e) => setTripDate(e.target.value)}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            
                            <Col md={12}>
                                <Form.Group className="mb-3">
                                    <label className="fw-semibold">Select Vehicle <span className="text-danger">*</span></label>
                                    <Select
                                        value={selectedVehicle}
                                        onChange={handleVehicleChange}
                                        options={vehicles}
                                        placeholder="Search vehicle..."
                                        isClearable
                                        styles={selectStyles}
                                        menuPortalTarget={document.body}
                                    />
                                </Form.Group>
                            </Col>

                            <Col md={12}>
                                <Form.Group className="mb-3">
                                    <label className="fw-semibold">Select Driver <span className="text-danger">*</span></label>
                                    <Select
                                        value={selectedDriver}
                                        onChange={setSelectedDriver}
                                        options={drivers}
                                        placeholder="Search driver..."
                                        isClearable
                                        styles={selectStyles}
                                        menuPortalTarget={document.body}
                                    />
                                </Form.Group>
                            </Col>

                            <Col md={12}>
                                <Form.Group className="mb-3">
                                    <label className="fw-semibold">Select Route <span className="text-danger">*</span></label>
                                    <Select
                                        value={selectedRoute}
                                        onChange={setSelectedRoute}
                                        options={routes}
                                        placeholder="Search route..."
                                        isClearable
                                        styles={selectStyles}
                                        menuPortalTarget={document.body}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                        
                        <div
                            className="modal-actions d-flex justify-content-end gap-2 mt-4 pt-3"
                            style={{ borderTop: '1px solid #f1f5f9' }}
                        >
                            <button
                                type="button"
                                className="pkg-close-btn"
                                onClick={handleCloseModal}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="pkg-submit-btn"
                            >
                                {isEditing ? 'Save Changes' : 'Save'}
                            </button>
                        </div>
                    </Form>
                </div>
            </Modal>
        </>
    );
};

export default TripMasterManagement;
