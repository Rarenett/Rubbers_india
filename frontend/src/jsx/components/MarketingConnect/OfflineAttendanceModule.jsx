import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Button, Spinner, Alert, Table, Badge } from 'react-bootstrap';
import axiosInstance from '../../../services/axiosInstance';
import Swal from 'sweetalert2';

// Simple IndexedDB Wrapper
const DB_NAME = 'GlendaAquaOfflineDB';
const STORE_NAME = 'offline_attendance';
const DB_VERSION = 1;

const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'offlineAttendanceId' });
            }
        };
    });
};

const saveOfflineRecord = async (record) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

const getOfflineRecords = async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

const updateOfflineRecordStatus = async (offlineAttendanceId, status, errorMsg = '') => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(offlineAttendanceId);
        request.onsuccess = () => {
            const data = request.result;
            if (data) {
                data.syncStatus = status;
                data.syncError = errorMsg;
                if (status === 'SYNCED') data.syncedAt = new Date().toISOString();
                store.put(data);
            }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

const OfflineAttendanceModule = () => {
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [location, setLocation] = useState(null);
    const [locationError, setLocationError] = useState(null);
    const [user, setUser] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [history, setHistory] = useState([]);
    const [showCamera, setShowCamera] = useState(false);
    const [photo, setPhoto] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    const checkNetwork = () => setIsOnline(navigator.onLine);

    useEffect(() => {
        window.addEventListener('online', checkNetwork);
        window.addEventListener('offline', checkNetwork);
        
        let localUser = { first_name: '', last_name: '', username: '' };
        try {
            const ud = JSON.parse(localStorage.getItem('userDetails') || '{}');
            localUser = ud.user || ud || localUser;
        } catch(e) {}
        setUser(localUser);
        
        loadHistory();
        getLocation();

        return () => {
            window.removeEventListener('online', checkNetwork);
            window.removeEventListener('offline', checkNetwork);
            stopCamera();
        };
    }, []);

    useEffect(() => {
        if (isOnline) {
            syncPendingRecords();
        }
    }, [isOnline]);

    const loadHistory = async () => {
        try {
            const records = await getOfflineRecords();
            // Sort by createdAt desc
            records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setHistory(records);
        } catch (e) {
            console.error("Error loading offline history", e);
        }
    };

    const syncPendingRecords = async () => {
        try {
            const records = await getOfflineRecords();
            const pending = records.filter(r => r.syncStatus === 'PENDING_SYNC' || r.syncStatus === 'SYNC_FAILED');
            for (const record of pending) {
                try {
                    await updateOfflineRecordStatus(record.offlineAttendanceId, 'SYNCING');
                    setHistory(prev => prev.map(r => r.offlineAttendanceId === record.offlineAttendanceId ? {...r, syncStatus: 'SYNCING'} : r));
                    
                    const response = await axiosInstance.post('/api/project/marketing/attendance/sync_offline/', record);
                    
                    await updateOfflineRecordStatus(record.offlineAttendanceId, 'SYNCED');
                } catch (error) {
                    console.error("Sync error for record", record.offlineAttendanceId, error);
                    await updateOfflineRecordStatus(record.offlineAttendanceId, 'SYNC_FAILED', error.message);
                }
            }
            loadHistory();
        } catch (e) {
            console.error("Error during sync process", e);
        }
    };

    const getLocation = () => {
        setLocationError(null);
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by your browser");
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
            },
            (err) => {
                setLocationError("Unable to capture your current location. Please enable location services and try again.");
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const startCamera = async () => {
        setShowCamera(true);
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error("Camera error:", err);
            setShowCamera(false);
            Swal.fire('Camera Error', 'Camera access is unavailable. Please check camera permissions.', 'error');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setShowCamera(false);
    };

    const capturePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth || 640;
            canvas.height = videoRef.current.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            
            // Draw timestamp overlay
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY format
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            const timestamp = `Verified (Offline): ${dateStr} at ${timeStr}`;
            const locText = location ? `Location: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : 'Location: Not Captured';
            
            // Add a semi-transparent dark background bar for text readability
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, canvas.height - 60, canvas.width, 60);

            ctx.font = 'bold 18px Arial';
            ctx.fillStyle = '#ffdf00'; // Bright yellow
            const padding = 15;
            ctx.fillText(timestamp, padding, canvas.height - 35);
            ctx.fillText(locText, padding, canvas.height - 12);
            
            setPhoto(canvas.toDataURL('image/jpeg', 0.8));
            stopCamera();
        }
    };

    const markOfflineAttendance = async () => {
        setIsProcessing(true);
        
        try {
            let photoBase64 = photo;

            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toTimeString().split(' ')[0];

            const newRecord = {
                offlineAttendanceId: 'off_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                employeeId: user?.employee_id || user?.username,
                employeeName: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
                attendanceDate: dateStr,
                attendanceTime: timeStr,
                latitude: location?.lat || null,
                longitude: location?.lng || null,
                locationAccuracy: location?.accuracy || null,
                selfieImage: photoBase64,
                createdAt: now.toISOString(),
                syncStatus: 'PENDING_SYNC',
                syncError: ''
            };

            await saveOfflineRecord(newRecord);
            
            stopCamera();
            await loadHistory();
            
            setSuccessMessage(newRecord);
            
            if (isOnline) {
                syncPendingRecords();
            }

        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Could not save offline attendance.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const pendingCount = history.filter(r => r.syncStatus === 'PENDING_SYNC' || r.syncStatus === 'SYNC_FAILED').length;

    if (successMessage) {
        return (
            <div className="container-fluid" style={{ background: '#f5f7fa', padding: '15px', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Card className="text-center shadow-lg" style={{ borderRadius: '14px', maxWidth: '400px', width: '100%', border: 'none' }}>
                    <Card.Body className="p-4">
                        <div className="mb-3" style={{ fontSize: '3rem', color: '#28a745' }}>
                            <i className="fa fa-check-circle"></i>
                        </div>
                        <h4 className="fw-bold mb-4 text-success">Attendance Marked Successfully</h4>
                        
                        <div className="text-start mb-3" style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
                            <p className="mb-1"><strong>Employee:</strong> {successMessage.employeeName}</p>
                            <p className="mb-1"><strong>Date:</strong> {successMessage.attendanceDate}</p>
                            <p className="mb-1"><strong>Time:</strong> {successMessage.attendanceTime}</p>
                            <p className="mb-1"><strong>Location:</strong> {successMessage.latitude ? 'Captured' : 'Not Captured'}</p>
                            <p className="mb-1"><strong>Network:</strong> {isOnline ? 'Online' : 'Offline'}</p>
                            <p className="mb-1"><strong>Sync Status:</strong> {successMessage.syncStatus}</p>
                        </div>
                        
                        <Alert variant="info" className="small">
                            Your attendance has been safely stored on this device and will automatically synchronize when the network connection is restored.
                        </Alert>
                        
                        <Button variant="primary" className="w-100 mt-2" onClick={() => setSuccessMessage(null)} style={{ borderRadius: '8px', padding: '10px' }}>
                            Back to Offline Attendance
                        </Button>
                    </Card.Body>
                </Card>
            </div>
        );
    }

    return (
        <React.Fragment>
            <div className="container-fluid" style={{ background: '#f5f7fa', padding: '15px', minHeight: '100vh', paddingBottom: '100px' }}>
                <div className="row mb-3 mt-3 text-center">
                    <div className="col-12">
                        <Button variant="link" className="text-dark position-absolute start-0 ms-3" onClick={() => navigate(-1)}>
                            <i className="fa fa-arrow-left fa-lg"></i>
                        </Button>
                        <h4 style={{ fontFamily: 'DM Serif Display', color: '#0f1624' }}>OFFLINE ATTENDANCE</h4>
                    </div>
                </div>
                
                <Row className="justify-content-center">
                    <Col xs="12" md="8" lg="6">
                        
                        <div className="d-flex justify-content-between align-items-center mb-3 bg-white p-3 rounded shadow-sm">
                            <span className="fw-bold text-muted">Network Status</span>
                            {isOnline ? (
                                <Badge bg="success" pill className="px-3 py-2">● Online</Badge>
                            ) : (
                                <Badge bg="danger" pill className="px-3 py-2">● Offline</Badge>
                            )}
                        </div>

                        {!isOnline && (
                            <Alert variant="warning" className="text-center shadow-sm">
                                <strong>Offline Mode</strong> - Attendance will sync when network is restored
                            </Alert>
                        )}

                        {pendingCount > 0 && (
                            <Alert variant="info" className="text-center shadow-sm">
                                {pendingCount} Attendance Record{pendingCount !== 1 ? 's' : ''} Pending Sync
                            </Alert>
                        )}

                        <Card className="shadow-sm mb-4" style={{ borderRadius: '14px', border: 'none' }}>
                            <Card.Body className="p-4">
                                <div className="text-start mb-4">
                                    <p className="mb-2 text-muted fw-bold text-uppercase" style={{ fontSize: '0.85rem' }}>Employee Details</p>
                                    <h5 className="fw-bold mb-1">{user?.first_name} {user?.last_name}</h5>
                                    <p className="mb-0 text-muted small">ID: {user?.employee_id || user?.username}</p>
                                </div>
                                
                                <div className="d-flex justify-content-between align-items-center mb-3 bg-light p-3 rounded">
                                    <div>
                                        <p className="mb-0 text-muted small">Date & Time</p>
                                        <h6 className="fw-bold mb-0">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</h6>
                                    </div>
                                    <div className="text-end">
                                        <p className="mb-0 text-muted small">Location</p>
                                        {location ? (
                                            <h6 className="fw-bold text-success mb-0"><i className="fa fa-map-marker me-1"></i> Captured</h6>
                                        ) : (
                                            <h6 className="fw-bold text-danger mb-0"><i className="fa fa-map-marker me-1"></i> Missing</h6>
                                        )}
                                    </div>
                                </div>

                                {locationError && (
                                    <Alert variant="danger" className="small p-2">
                                        {locationError} <Button variant="link" size="sm" className="p-0 ms-2" onClick={getLocation}>Retry</Button>
                                    </Alert>
                                )}

                                {photo ? (
                                    <div className="mb-3 position-relative bg-dark rounded overflow-hidden" style={{ minHeight: '200px' }}>
                                        <img src={photo} alt="Selfie" style={{ width: '100%', objectFit: 'cover' }} />
                                        <Button variant="danger" size="sm" className="position-absolute top-0 end-0 m-2" onClick={() => setPhoto(null)}>
                                            <i className="fa fa-trash"></i> Retake
                                        </Button>
                                    </div>
                                ) : !showCamera ? (
                                    <Button variant="outline-primary" className="w-100 mb-3 py-2" style={{ borderRadius: '8px' }} onClick={startCamera}>
                                        <i className="fa fa-camera me-2"></i> Capture Selfie (Optional)
                                    </Button>
                                ) : (
                                    <div className="mb-3 position-relative bg-dark rounded overflow-hidden" style={{ minHeight: '200px' }}>
                                        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', objectFit: 'cover' }} />
                                        <Button variant="danger" size="sm" className="position-absolute top-0 end-0 m-2" onClick={stopCamera}>
                                            <i className="fa fa-times"></i>
                                        </Button>
                                        <Button 
                                            variant="success" 
                                            className="position-absolute bottom-0 start-50 translate-middle-x mb-3 rounded-circle shadow" 
                                            style={{ width: '50px', height: '50px', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                                            onClick={capturePhoto}
                                        >
                                            <i className="fa fa-camera fs-4"></i>
                                        </Button>
                                    </div>
                                )}

                                <Button 
                                    variant="primary" 
                                    className="w-100 py-3 fw-bold shadow-sm"
                                    style={{ borderRadius: '12px', fontSize: '1.1rem' }}
                                    onClick={markOfflineAttendance}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? <Spinner size="sm" animation="border" /> : 'MARK OFFLINE ATTENDANCE'}
                                </Button>
                            </Card.Body>
                        </Card>

                        {/* History Section */}
                        {history.length > 0 && (
                            <Card className="shadow-sm mb-4" style={{ borderRadius: '14px', border: 'none' }}>
                                <Card.Body className="p-3">
                                    <h6 className="fw-bold text-muted mb-3">Offline Attendance History</h6>
                                    <div className="table-responsive">
                                        <Table size="sm" hover className="align-middle mb-0">
                                            <thead>
                                                <tr>
                                                    <th className="text-muted small">Date/Time</th>
                                                    <th className="text-muted small">Location</th>
                                                    <th className="text-muted small">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {history.slice(0, 5).map((record, idx) => (
                                                    <tr key={idx}>
                                                        <td className="small">
                                                            {record.attendanceDate}<br/>
                                                            <span className="text-muted">{record.attendanceTime.substring(0, 5)}</span>
                                                        </td>
                                                        <td className="small text-center">
                                                            {record.latitude ? <i className="fa fa-check text-success"></i> : <i className="fa fa-times text-danger"></i>}
                                                        </td>
                                                        <td className="small">
                                                            {record.syncStatus === 'SYNCED' ? (
                                                                <Badge bg="success">Synced</Badge>
                                                            ) : record.syncStatus === 'SYNCING' ? (
                                                                <Badge bg="info">Syncing</Badge>
                                                            ) : record.syncStatus === 'SYNC_FAILED' ? (
                                                                <Badge bg="danger">Failed</Badge>
                                                            ) : (
                                                                <Badge bg="warning" text="dark">Pending</Badge>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </div>
                                </Card.Body>
                            </Card>
                        )}
                        
                    </Col>
                </Row>
            </div>
        </React.Fragment>
    );
};

export default OfflineAttendanceModule;
