import './marketing-cute.css';
import React, { useState, useEffect, Fragment } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axiosInstance from '../../../services/axiosInstance';
import { usePageTitle } from '../../../context/TitleContext';
import { Row, Col, Card, Form, Button } from 'react-bootstrap';
import OrderModal from './OrderModal';

const ShopVisitModule = () => {
    usePageTitle("Shop Visit - Marketing Connect");
    const navigate = useNavigate();
    
    const user = useSelector(state => state.auth?.auth?.user);

    const [location, setLocation] = useState(null);
    const [formData, setFormData] = useState({
        shopName: '',
        address: '',
        city: '',
        state: '',
        mobileNumber: '',
        gstNumber: '',
        shopType: ''
    });
    const [leads, setLeads] = useState([]);
    const [selectedLeadId, setSelectedLeadId] = useState('');
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [savedVisitData, setSavedVisitData] = useState(null);
    const [photos, setPhotos] = useState([]);

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => console.warn("Could not fetch location."),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        }

        const fetchLeads = async () => {
            try {
                const response = await axiosInstance.get('/api/project/marketing/lead/');
                setLeads(response.data);
            } catch (error) {
                console.error("Failed to fetch leads:", error);
            }
        };
        fetchLeads();
    }, []);

    const handleLeadSelect = (e) => {
        const leadId = e.target.value;
        setSelectedLeadId(leadId);
        
        if (leadId) {
            const selectedLead = leads.find(l => l.id === parseInt(leadId));
            if (selectedLead) {
                setFormData({
                    shopName: selectedLead.shop_name || '',
                    address: selectedLead.address || '',
                    city: selectedLead.city || '',
                    state: selectedLead.state || '',
                    mobileNumber: selectedLead.mobile_number || '',
                    gstNumber: selectedLead.gst_number || '',
                    shopType: selectedLead.shop_type || ''
                });
            }
        } else {
            setFormData({
                shopName: '', address: '', city: '', state: '', mobileNumber: '', gstNumber: '', shopType: ''
            });
        }
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePhotoChange = (e) => {
        if (e.target.files) {
            setPhotos(Array.from(e.target.files));
        }
    };

    const submitVisit = async () => {
        if (!formData.shopName || !formData.shopType) {
            alert("Shop Name and Type are required.");
            return;
        }
        if (photos.length === 0) {
            alert("Shop photos are required. Please upload at least one photo (Front, Inside, or Card).");
            return;
        }

        // We will need the employee ID; use 1 as a fallback for testing
        const payload = {
            employee: user?.employee_id || 1, // Fallback for testing
            shop_name: formData.shopName,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            mobile_number: formData.mobileNumber,
            gst_number: formData.gstNumber,
            shop_type: formData.shopType,
            latitude: location ? location.lat : null,
            longitude: location ? location.lng : null,
        };

        try {
            await axiosInstance.post('/api/project/marketing/shop-visit/', payload);
            alert("Shop Visit recorded successfully!");
            setSavedVisitData(payload);
            setShowOrderModal(true);
        } catch (error) {
            console.error("Failed to record shop visit", error);
            const errMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            alert("Error saving shop visit: " + errMsg);
        }
    };

    return (
        <Fragment>
            <div className="page-titles">
                <ol className="breadcrumb">
                    <li className="breadcrumb-item"><Link to={"/market_connect_master"}>Marketing Connect</Link></li>
                    <li className="breadcrumb-item active"><Link to={"#"}>Shop Visit</Link></li>
                </ol>
            </div>

            <Row>
                <Col xl="12">
                    <Card>
                        <Card.Header>
                            <Card.Title>Shop Visit Registration</Card.Title>
                        </Card.Header>
                        <Card.Body>
                            <p className="text-muted mb-3">Register a new shop or record a visit.</p>

                            {location ? (
                                <div className="alert alert-success p-2 mb-4" style={{ fontSize: '0.85rem' }}>
                                    <i className="fa fa-map-marker me-2"></i> Location Captured: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                                </div>
                            ) : (
                                <div className="alert alert-warning p-2 mb-4" style={{ fontSize: '0.85rem' }}>
                                    <i className="fa fa-map-marker me-2"></i> Fetching Location... Ensure GPS is enabled.
                                </div>
                            )}

                            <Row>
                                <Col md="12" className="mb-4">
                                    <div className="p-3 rounded bg-light border">
                                        <Form.Label className="font-w600">Import Existing Lead</Form.Label>
                                        <Form.Select value={selectedLeadId} onChange={handleLeadSelect}>
                                            <option value="">-- Select a Lead (Optional) --</option>
                                            {leads.filter(l => l.status && l.status.toLowerCase() === 'active').map(lead => (
                                                <option key={lead.id} value={lead.id}>
                                                    {lead.shop_name} - {lead.city || 'Unknown City'}
                                                </option>
                                            ))}
                                        </Form.Select>
                                    </div>
                                </Col>

                                <Col md="6" xs="12" className="mb-3">
                                    <Form.Label className="font-w600">Shop Name *</Form.Label>
                                    <Form.Control type="text" name="shopName" value={formData.shopName} onChange={handleInputChange} />
                                </Col>
                                <Col md="6" xs="12" className="mb-3">
                                    <Form.Label className="font-w600">Mobile Number</Form.Label>
                                    <Form.Control type="tel" name="mobileNumber" value={formData.mobileNumber} onChange={handleInputChange} />
                                </Col>
                                <Col md="12" xs="12" className="mb-3">
                                    <Form.Label className="font-w600">Shop Type *</Form.Label>
                                    <Form.Select name="shopType" value={formData.shopType} onChange={handleInputChange}>
                                        <option value="">-- Select Type --</option>
                                        <option value="Retail Shop">Retail Shop</option>
                                        <option value="Wholesale Shop">Wholesale Shop</option>
                                    </Form.Select>
                                </Col>
                                <Col md="12" xs="12" className="mb-3">
                                    <Form.Label className="font-w600">Address</Form.Label>
                                    <Form.Control as="textarea" rows={2} name="address" value={formData.address} onChange={handleInputChange} />
                                </Col>
                                <Col md="6" xs="12" className="mb-3">
                                    <Form.Label className="font-w600">City</Form.Label>
                                    <Form.Control type="text" name="city" value={formData.city} onChange={handleInputChange} />
                                </Col>
                                <Col md="6" xs="12" className="mb-3">
                                    <Form.Label className="font-w600">State</Form.Label>
                                    <Form.Control type="text" name="state" value={formData.state} onChange={handleInputChange} />
                                </Col>
                                <Col md="6" xs="12" className="mb-3">
                                    <Form.Label className="font-w600">GST Number</Form.Label>
                                    <Form.Control type="text" name="gstNumber" value={formData.gstNumber} onChange={handleInputChange} />
                                </Col>
                                <Col md="6" xs="12" className="mb-4">
                                    <Form.Label className="font-w600"><i className="fa fa-camera me-1"></i> Upload Photos (Front, Inside, Card) <span className="text-danger">*</span></Form.Label>
                                    <Form.Control type="file" multiple accept="image/*" onChange={handlePhotoChange} />
                                    {photos.length > 0 && <p className="text-success mt-1 small">{photos.length} file(s) selected.</p>}
                                </Col>
                                <Col md="12">
                                    <Button 
                                        variant="primary" 
                                        className="w-100" 
                                        onClick={submitVisit}
                                        style={{ padding: '12px', fontWeight: 'bold' }}
                                    >
                                        Save Shop Visit
                                    </Button>
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
            
            <OrderModal 
                show={showOrderModal} 
                onHide={() => navigate('/market_connect_master')}
                visitData={savedVisitData}
                onSuccess={() => navigate('/market_connect_master')}
            />
        </Fragment>
    );
};

export default ShopVisitModule;
