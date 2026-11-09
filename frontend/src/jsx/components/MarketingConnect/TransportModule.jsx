import './marketing-cute.css';
import React, { useState, useEffect, Fragment } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { usePageTitle } from '../../../context/TitleContext';
import axiosInstance from '../../../services/axiosInstance';
import { Row, Col, Card, Form, Button } from 'react-bootstrap';

const TransportModule = () => {
    usePageTitle("Transport - Marketing Connect");
    const navigate = useNavigate();

    const [mode, setMode] = useState('');
    const [startKm, setStartKm] = useState('');
    const [endKm, setEndKm] = useState('');
    const [totalKm, setTotalKm] = useState('');
    const [odometerFiles, setOdometerFiles] = useState([]);
    const [existingPhotos, setExistingPhotos] = useState([]);
    const [ticketFile, setTicketFile] = useState(null);
    const [travelId, setTravelId] = useState(null);

    const user = useSelector(state => state.auth?.auth?.user);
    const today = new Date().toISOString().split('T')[0];
    const draftKey = `transport_draft_${user?.email || 'default'}_${today}`;

    // 1. Load Draft from LocalStorage on mount
    useEffect(() => {
        const draft = localStorage.getItem(draftKey);
        if (draft) {
            try {
                const parsed = JSON.parse(draft);
                if (parsed.mode) setMode(parsed.mode);
                if (parsed.startKm) setStartKm(parsed.startKm);
                if (parsed.endKm) setEndKm(parsed.endKm);
                if (parsed.totalKm) setTotalKm(parsed.totalKm);
            } catch (e) {
                console.error("Error parsing draft", e);
            }
        }
    }, [draftKey]);

    // 2. Fetch from backend (Overwrites draft if already saved)
    useEffect(() => {
        const fetchTodayTravel = async () => {
            try {
                const response = await axiosInstance.get(`/api/project/marketing/travel/?date=${today}`);
                if (response.data && response.data.length > 0) {
                    const record = response.data[0];
                    setTravelId(record.id);
                    setMode(record.mode || '');
                    setStartKm(record.start_km || '');
                    setEndKm(record.end_km || '');
                    setTotalKm(record.total_km || '');
                    if (record.photos) setExistingPhotos(record.photos);
                }
            } catch (error) {
                console.error("Failed to fetch today's travel:", error);
            }
        };
        fetchTodayTravel();
    }, []);

    // 3. Auto-save to LocalStorage whenever fields change
    useEffect(() => {
        const draftData = { mode, startKm, endKm, totalKm };
        localStorage.setItem(draftKey, JSON.stringify(draftData));
    }, [mode, startKm, endKm, totalKm, draftKey]);

    const handleModeChange = (e) => {
        setMode(e.target.value);
        setStartKm('');
        setEndKm('');
        setTotalKm('');
        setOdometerFiles([]);
        setExistingPhotos([]);
        setTicketFile(null);
    };

    const submitTravel = async () => {
        if (!mode) {
            alert("Please select a transport mode.");
            return;
        }

        if (mode === 'Bike' || mode === 'Car') {
            if (!travelId) {
                if (!startKm) {
                    alert("Please enter the Start KM.");
                    return;
                }
                if (odometerFiles.length === 0) {
                    alert("Please upload an odometer photo for the Start KM.");
                    return;
                }
            } else {
                if (!endKm) {
                    alert("Please enter the End KM.");
                    return;
                }
                if (odometerFiles.length === 0) {
                    alert("Please upload an odometer photo for the End KM.");
                    return;
                }
            }
        }

        if (mode === 'Bus' || mode === 'Train' || mode === 'Flight') {
            if (!totalKm) {
                alert("Please enter the Travelled KM.");
                return;
            }
            if (!ticketFile && !travelId) {
                alert("Please upload a ticket file.");
                return;
            }
        }

        const payload = new FormData();
        payload.append('mode', mode);
        if (startKm) payload.append('start_km', startKm);
        if (endKm) payload.append('end_km', endKm);
        if (totalKm) payload.append('total_km', totalKm);
        odometerFiles.forEach(file => payload.append('odometer_photos', file));
        if (ticketFile) payload.append('ticket_file', ticketFile);

        try {
            if (travelId) {
                await axiosInstance.patch(`/api/project/marketing/travel/${travelId}/`, payload);
            } else {
                const response = await axiosInstance.post('/api/project/marketing/travel/', payload);
                if (response.data && response.data.id) {
                    setTravelId(response.data.id);
                }
            }
            alert("Travel record saved successfully!");
            // Optional: clear local storage since it's now in DB
            localStorage.removeItem(draftKey);
            navigate('/market_connect_master');
        } catch (error) {
            console.error("Error saving travel:", error);
            const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            alert("Failed to save travel record: " + errorMsg);
        }
    };

    return (
        <Fragment>
            <div className="page-titles">
                <ol className="breadcrumb">
                    <li className="breadcrumb-item"><Link to={"/market_connect_master"}>Marketing Connect</Link></li>
                    <li className="breadcrumb-item active"><Link to={"#"}>Transport</Link></li>
                </ol>
            </div>

            <Row>
                <Col xl="12">
                    <Card>
                        <Card.Header>
                            <Card.Title>Travel Details</Card.Title>
                        </Card.Header>
                        <Card.Body>
                            <p className="text-muted mb-4">Record your travel for the day.</p>

                            <Row>
                                <Col md="12" xs="12" className="mb-3">
                                    <Form.Label className="font-w600 d-block mb-2">Transport Mode</Form.Label>
                                    <div className="transport-mode-grid mb-2">
                                        {[
                                            { id: 'Bike', label: 'Bike', icon: 'fa-motorcycle', emoji: '🏍️' },
                                            { id: 'Car', label: 'Car', icon: 'fa-car', emoji: '🚗' },
                                            { id: 'Bus', label: 'Bus', icon: 'fa-bus', emoji: '🚌' },
                                            { id: 'Train', label: 'Train', icon: 'fa-train', emoji: '🚆' },
                                            { id: 'Flight', label: 'Flight', icon: 'fa-plane', emoji: '✈️' },
                                        ].map(item => (
                                            <button
                                                type="button"
                                                key={item.id}
                                                className={`transport-chip ${mode === item.id ? 'active' : ''}`}
                                                onClick={() => {
                                                    setMode(item.id);
                                                    setStartKm('');
                                                    setEndKm('');
                                                    setTotalKm('');
                                                    setOdometerFiles([]);
                                                    setExistingPhotos([]);
                                                    setTicketFile(null);
                                                }}
                                            >
                                                <span className="transport-chip-icon">{item.emoji}</span>
                                                <span className="transport-chip-label">{item.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <Form.Select 
                                        value={mode} 
                                        onChange={handleModeChange}
                                        className="d-none d-md-none" // Kept for accessibility or fallback
                                    >
                                        <option value="">-- Select Mode --</option>
                                        <option value="Bike">Bike</option>
                                        <option value="Car">Car</option>
                                        <option value="Bus">Bus</option>
                                        <option value="Train">Train</option>
                                        <option value="Flight">Flight</option>
                                    </Form.Select>
                                </Col>
                            </Row>

                            {(mode === 'Bike' || mode === 'Car') && (
                                <Row className="mt-2">
                                    <Col md="6" xs="12" className="mb-3">
                                        <Form.Label className="font-w600">Start KM</Form.Label>
                                        <Form.Control type="number" value={startKm} onChange={e => setStartKm(e.target.value)} disabled={!!travelId && startKm !== ''} />
                                    </Col>
                                    <Col md="6" xs="12" className="mb-3">
                                        <Form.Label className="font-w600">End KM</Form.Label>
                                        <Form.Control type="number" value={endKm} onChange={e => setEndKm(e.target.value)} disabled={!travelId} />
                                    </Col>

                                    <Col md="12" xs="12" className="mb-3">
                                        <Form.Label className="font-w600"><i className="fa fa-camera me-1"></i> Odometer Photos</Form.Label>
                                        <Form.Control type="file" accept="image/*" multiple onChange={(e) => setOdometerFiles(Array.from(e.target.files))} />
                                        {!travelId && <small className="text-danger d-block mt-1">Please save your Start KM first to unlock End KM.</small>}
                                        {odometerFiles.length > 0 && <p className="text-success mt-1 small">{odometerFiles.length} file(s) selected.</p>}
                                        {existingPhotos.length > 0 && (
                                            <div className="mt-2 d-flex flex-wrap gap-2">
                                                {existingPhotos.map(photo => (
                                                    <img key={photo.id} src={photo.photo} alt="Odometer" style={{width: '60px', height: '60px', objectFit: 'cover', borderRadius: '5px'}} />
                                                ))}
                                            </div>
                                        )}
                                    </Col>
                                </Row>
                            )}

                            {(mode === 'Bus' || mode === 'Train' || mode === 'Flight') && (
                                <Row className="mt-2">
                                    <Col md="6" xs="12" className="mb-3">
                                        <Form.Label className="font-w600">Travelled KM</Form.Label>
                                        <Form.Control type="number" value={totalKm} onChange={e => setTotalKm(e.target.value)} />
                                    </Col>

                                    <Col md="6" xs="12" className="mb-3">
                                        <Form.Label className="font-w600"><i className="fa fa-paperclip me-1"></i> Upload Ticket</Form.Label>
                                        <Form.Control type="file" onChange={(e) => { if(e.target.files[0]) setTicketFile(e.target.files[0]) }} />
                                        {ticketFile && <p className="text-success mt-1 small">File selected: {ticketFile.name}</p>}
                                    </Col>
                                </Row>
                            )}

                            <Button 
                                variant="primary"
                                className="w-100 mt-4" 
                                onClick={submitTravel}
                                disabled={!mode}
                                style={{ padding: '12px', fontWeight: 'bold' }}
                            >
                                Save Travel Record
                            </Button>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Fragment>
    );
};

export default TransportModule;
