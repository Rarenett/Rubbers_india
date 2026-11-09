import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Table, Badge, Button, Spinner, Form, Modal } from 'react-bootstrap';
import { ThemeContext } from "../../../context/ThemeContext";
import { getVehicleEntries, markVehicleExit, searchVehicleByNumber, createVehicle, createVehicleEntry, getGates, getVehicleTypes } from '../../../services/GateManagementService';
import Swal from 'sweetalert2';

const VehicleGateManagement = ({ embedded = false }) => {
    const navigate = useNavigate();
    const { background } = useContext(ThemeContext);
    const isDark = background.value === "dark";

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'completed'
    const [searchTerm, setSearchTerm] = useState('');

    const [showFormModal, setShowFormModal] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    
    // Form States
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [vehicleData, setVehicleData] = useState(null);
    const [isNewVehicle, setIsNewVehicle] = useState(false);
    const [gates, setGates] = useState([]);
    const [vehicleTypes, setVehicleTypes] = useState([]);

    const [formData, setFormData] = useState({
        vehicle_type: '',
        company: '',
        driver: '',
        purpose: '',
        material_details: '',
        parking_location: '',
        entry_gate: ''
    });

    useEffect(() => {
        fetchEntries();
        loadMasters();
    }, []);

    const loadMasters = async () => {
        try {
            const [gatesRes, typesRes] = await Promise.all([
                getGates(),
                getVehicleTypes()
            ]);
            setGates(gatesRes);
            setVehicleTypes(typesRes);
        } catch (error) {
            console.error("Error loading masters", error);
        }
    };

    const fetchEntries = async () => {
        try {
            setLoading(true);
            const data = await getVehicleEntries();
            setEntries(data);
        } catch (error) {
            console.error("Error fetching vehicle entries", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchVehicle = async () => {
        if (!vehicleNumber.trim()) return;
        try {
            setFormLoading(true);
            const res = await searchVehicleByNumber(vehicleNumber);
            if (res && res.length > 0) {
                const v = res[0];
                setVehicleData(v);
                setIsNewVehicle(false);
                setFormData(prev => ({
                    ...prev,
                    company: v.company || '',
                    driver: v.driver || '',
                    vehicle_type: v.vehicle_type || ''
                }));
            }
        } catch (error) {
            if (error.response && error.response.status === 404) {
                setIsNewVehicle(true);
                setVehicleData(null);
                setFormData(prev => ({ ...prev, company: '', driver: '', vehicle_type: '' }));
            }
        } finally {
            setFormLoading(false);
        }
    };

    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmitEntry = async () => {
        if (!vehicleNumber || !formData.entry_gate || !formData.driver) {
            Swal.fire('Error', 'Please fill required fields (Vehicle No, Driver, Entry Gate).', 'error');
            return;
        }

        try {
            setFormLoading(true);
            let vehicleId = vehicleData?.id;

            if (isNewVehicle) {
                const newVehicle = await createVehicle({
                    vehicle_number: vehicleNumber,
                    vehicle_type: formData.vehicle_type,
                    company: formData.company,
                    driver: formData.driver
                });
                vehicleId = newVehicle.id;
            }

            await createVehicleEntry({
                vehicle: vehicleId,
                driver: formData.driver,
                company: formData.company,
                purpose: formData.purpose,
                material_details: formData.material_details,
                parking_location: formData.parking_location,
                entry_gate: formData.entry_gate
            });

            Swal.fire('Success', 'Vehicle entry recorded successfully!', 'success');
            setShowFormModal(false);
            resetForm();
            fetchEntries();
        } catch (error) {
            Swal.fire('Error', error.response?.data?.vehicle?.[0] || 'Failed to create entry.', 'error');
        } finally {
            setFormLoading(false);
        }
    };

    const resetForm = () => {
        setVehicleNumber('');
        setVehicleData(null);
        setIsNewVehicle(false);
        setFormData({
            vehicle_type: '',
            company: '',
            driver: '',
            purpose: '',
            material_details: '',
            parking_location: '',
            entry_gate: ''
        });
    };

    const handleMarkExit = async (id) => {
        const result = await Swal.fire({
            title: 'Mark Exit?',
            text: "Are you sure you want to mark this vehicle as exited?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, mark exit!'
        });

        if (result.isConfirmed) {
            try {
                await markVehicleExit(id);
                Swal.fire('Marked!', 'Vehicle has been marked as exited.', 'success');
                fetchEntries();
            } catch (error) {
                Swal.fire('Error', 'Could not mark exit.', 'error');
            }
        }
    };

    const filteredEntries = entries.filter(e => {
        if (e.status !== activeTab) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return (e.vehicle_number || '').toLowerCase().includes(term) ||
                   (e.driver || '').toLowerCase().includes(term) ||
                   (e.company || '').toLowerCase().includes(term);
        }
        return true;
    });

    return (
        <div className={embedded ? '' : 'container-fluid pt-4'}>
            {!embedded && (
                <Row className="mb-4 align-items-center">
                    <Col>
                        <h3 className={`fw-bold ${isDark ? 'text-white' : 'text-dark'} mb-0`}>Vehicle Entries</h3>
                    </Col>
                </Row>
            )}

            <Card>
                <Card.Header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 border-0 pb-0">
                    <div className="d-flex align-items-center gap-3">
                        <Card.Title className="mb-0 text-nowrap">Vehicle Entries</Card.Title>
                        <div className="d-flex gap-2">
                            <Button 
                                variant={activeTab === 'pending' ? 'primary' : 'outline-primary'}
                                size="sm"
                                className="rounded-pill px-3 fw-bold"
                                onClick={() => setActiveTab('pending')}
                            >
                                Active Inside
                            </Button>
                            <Button 
                                variant={activeTab === 'completed' ? 'success' : 'outline-success'}
                                size="sm"
                                className="rounded-pill px-3 fw-bold"
                                onClick={() => setActiveTab('completed')}
                            >
                                History
                            </Button>
                        </div>
                    </div>
                    <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                        <div className="search-bar-container w-100 m-0" style={{ maxWidth: '250px' }}>
                            <span className="search-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </span>
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search vehicle..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                            <Button
                                className="rounded-pill px-3 shadow-sm fw-semibold d-flex align-items-center text-white"
                                style={{ background: '#2ece8a', borderColor: '#2ece8a' }}
                                onClick={() => navigate('/access-point/gate-entry?mode=fast_pass')}
                                title="Instant 1-Tap Entry / Exit for Owner & Company Vehicles"
                            >
                                <i className="fa fa-car-side me-1.5"></i> Fast Pass
                            </Button>
                            <Button
                                className="rounded-pill px-4 shadow-sm fw-bold d-flex align-items-center"
                                style={{ background: '#2B1C57', borderColor: '#2B1C57' }}
                                onClick={() => setShowFormModal(true)}
                            >
                                <i className="fa fa-plus me-2"></i> New Entry
                            </Button>
                        </div>
                    </div>
                </Card.Header>
                <Card.Body>
                    <div className="table-responsive">
                        <Table hover className="table table-responsive-md align-middle mb-0">
                            <thead>
                                <tr>
                                    <th><strong>VEHICLE NO</strong></th>
                                    <th><strong>TYPE / COMPANY</strong></th>
                                    <th><strong>DRIVER</strong></th>
                                    <th><strong>ENTRY TIME</strong></th>
                                    {activeTab === 'completed' && <th><strong>EXIT TIME</strong></th>}
                                    <th><strong>PURPOSE</strong></th>
                                    <th className="text-end"><strong>ACTION</strong></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="text-center py-5">
                                            <Spinner animation="border" variant="primary" />
                                        </td>
                                    </tr>
                                ) : filteredEntries.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="text-center py-5 text-muted">
                                            No {activeTab} vehicle entries found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredEntries.map(entry => (
                                        <tr key={entry.id}>
                                            <td>
                                                <strong style={{ color: '#1e293b' }}>{entry.vehicle_number}</strong>
                                            </td>
                                            <td style={{ color: '#64748b' }}>
                                                <div>{entry.vehicle_type_name || 'N/A'}</div>
                                                <div className="small">{entry.company || '-'}</div>
                                            </td>
                                            <td style={{ color: '#64748b' }}>{entry.driver}</td>
                                            <td style={{ color: '#64748b' }}>
                                                <div>{new Date(entry.entry_time).toLocaleDateString()}</div>
                                                <div className="small">{new Date(entry.entry_time).toLocaleTimeString()}</div>
                                            </td>
                                            {activeTab === 'completed' && (
                                                <td style={{ color: '#64748b' }}>
                                                    <div>{new Date(entry.exit_time).toLocaleDateString()}</div>
                                                    <div className="small">{new Date(entry.exit_time).toLocaleTimeString()}</div>
                                                </td>
                                            )}
                                            <td style={{ color: '#64748b', maxWidth: '150px' }} className="text-truncate">
                                                {entry.purpose || '-'}
                                            </td>
                                            <td className="text-end">
                                                {activeTab === 'pending' ? (
                                                    <Button variant="danger" size="sm" className="rounded-pill shadow-sm px-3 fw-bold" onClick={() => handleMarkExit(entry.id)}>
                                                        <i className="fa fa-sign-out-alt me-1"></i> Exit
                                                    </Button>
                                                ) : (
                                                    <span className="badge badge-success light">Completed</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </Table>
                    </div>
                </Card.Body>
            </Card>

            <Modal show={showFormModal} onHide={() => setShowFormModal(false)} size="lg" centered>
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title className="fw-bold"><i className="fa fa-truck text-primary me-2"></i> Register Vehicle Entry</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Row className="mb-4">
                        <Col md={8}>
                            <Form.Group>
                                <Form.Label className="fw-bold">Vehicle Number <span className="text-danger">*</span></Form.Label>
                                <div className="d-flex gap-2">
                                    <Form.Control 
                                        type="text" 
                                        placeholder="e.g. MH-12-AB-1234"
                                        value={vehicleNumber}
                                        onChange={(e) => {
                                            setVehicleNumber(e.target.value.toUpperCase());
                                            setIsNewVehicle(false);
                                        }}
                                        className="shadow-sm border-0 bg-light py-2 fs-5 text-uppercase fw-bold"
                                    />
                                    <Button variant="primary" onClick={handleSearchVehicle} disabled={formLoading || !vehicleNumber} className="px-4 fw-bold">
                                        {formLoading ? <Spinner size="sm" /> : 'Search'}
                                    </Button>
                                </div>
                            </Form.Group>
                        </Col>
                    </Row>

                    {(vehicleData || isNewVehicle) && (
                        <div className="p-4 rounded-4 shadow-sm" style={{ background: isDark ? 'rgba(0,210,255,0.03)' : '#f8f9fa', border: `1px solid ${isDark ? 'rgba(0,210,255,0.1)' : '#eee'}` }}>
                            {isNewVehicle && <Badge bg="warning" className="mb-3 text-dark px-3 py-2 rounded-pill shadow-sm"><i className="fa fa-star me-1"></i> New Vehicle Registration</Badge>}
                            <Row className="g-3">
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label className="fw-600">Vehicle Type</Form.Label>
                                        <Form.Select 
                                            name="vehicle_type" 
                                            value={formData.vehicle_type} 
                                            onChange={handleFormChange}
                                            className="border-0 shadow-sm py-2"
                                        >
                                            <option value="">Select Type</option>
                                            {vehicleTypes.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label className="fw-600">Entry Gate <span className="text-danger">*</span></Form.Label>
                                        <Form.Select 
                                            name="entry_gate" 
                                            value={formData.entry_gate} 
                                            onChange={handleFormChange}
                                            className="border-0 shadow-sm py-2"
                                        >
                                            <option value="">Select Gate</option>
                                            {gates.map(g => (
                                                <option key={g.id} value={g.id}>{g.name || g.gate_no}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label className="fw-600">Driver Name <span className="text-danger">*</span></Form.Label>
                                        <Form.Control type="text" name="driver" value={formData.driver} onChange={handleFormChange} className="border-0 shadow-sm py-2" />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label className="fw-600">Company / Transporter</Form.Label>
                                        <Form.Control type="text" name="company" value={formData.company} onChange={handleFormChange} className="border-0 shadow-sm py-2" />
                                    </Form.Group>
                                </Col>
                                <Col md={12}>
                                    <Form.Group>
                                        <Form.Label className="fw-600">Purpose of Visit</Form.Label>
                                        <Form.Control as="textarea" rows={2} name="purpose" value={formData.purpose} onChange={handleFormChange} className="border-0 shadow-sm py-2" />
                                    </Form.Group>
                                </Col>
                                <Col md={12}>
                                    <Form.Group>
                                        <Form.Label className="fw-600">Material Details (if any)</Form.Label>
                                        <Form.Control type="text" name="material_details" value={formData.material_details} onChange={handleFormChange} placeholder="e.g. 10 Boxes, Tools" className="border-0 shadow-sm py-2" />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label className="fw-600">Parking Location</Form.Label>
                                        <Form.Control type="text" name="parking_location" value={formData.parking_location} onChange={handleFormChange} className="border-0 shadow-sm py-2" />
                                    </Form.Group>
                                </Col>
                            </Row>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer className="border-0">
                    <Button variant="light" onClick={() => setShowFormModal(false)} className="rounded-pill px-4 fw-bold">Cancel</Button>
                    <Button variant="primary" onClick={handleSubmitEntry} disabled={formLoading || (!vehicleData && !isNewVehicle)} className="rounded-pill px-4 shadow-sm fw-bold">
                        {formLoading ? <Spinner size="sm" /> : 'Log Entry'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default VehicleGateManagement;
