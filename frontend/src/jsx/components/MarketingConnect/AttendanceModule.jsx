import './marketing-cute.css';
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePageTitle } from '../../../context/TitleContext';
import { Row, Col, Card, Button, Spinner, Alert } from 'react-bootstrap';
import * as faceapi from 'face-api.js';
import axiosInstance from '../../../services/axiosInstance';
import Swal from 'sweetalert2';

const AttendanceModule = () => {
    usePageTitle("Attendance - Marketing Connect");
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [status, setStatus] = useState('Checking Enrollment Status...');
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [location, setLocation] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [successData, setSuccessData] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const isProcessingRef = useRef(false);
    const captureIntervalRef = useRef(null);
    const [isEnrolled, setIsEnrolled] = useState(null);
    const isEnrolledRef = useRef(null);
    const [faceDetected, setFaceDetected] = useState(false);
    const [activeDetection, setActiveDetection] = useState(null);
    const [sessionStatus, setSessionStatus] = useState('CHECKING'); // 'CHECKING', 'ACTIVE', 'SIGNED_OUT', 'CAMERA'
    const [sessionData, setSessionData] = useState(null);
    const [signOutLocationStatus, setSignOutLocationStatus] = useState('');
    
    // 1. Check Enrollment and Load Models
    useEffect(() => {
        const init = async () => {
            try {
                // Fetch session status first
                const statusRes = await axiosInstance.get('/api/project/marketing/attendance/current_status/');
                
                const curStatus = statusRes.data.status;
                setSessionData(statusRes.data);
                
                if (curStatus === 'ACTIVE' || curStatus === 'SIGNED_OUT') {
                    setSessionStatus(curStatus);
                    return; // Wait for user action
                }
                
                // No session today, start camera process
                await startSignInAgain();
            } catch (err) {
                console.error("Initialization Error", err);
                const msg = err.response?.data?.error || err.response?.data?.detail || "Failed to initialize. Please check your connection.";
                setErrorMsg(msg);
                setSessionStatus('CAMERA'); // Switch away from spinner so error UI is shown
            }
        };
        init();

        return () => {
            stopCamera();
        };
    }, []);

    const startSignInAgain = async () => {
        setSessionStatus('CAMERA');
        setStatus('Loading Face Models...');
        try {
            const enrollRes = await axiosInstance.get('/api/project/marketing/attendance/check_enrollment/');
            const enrolledStatus = enrollRes?.data?.is_enrolled ?? enrollRes?.is_enrolled ?? false;
            const boolStatus = (enrolledStatus === true || enrolledStatus === 'true');
            setIsEnrolled(boolStatus);
            isEnrolledRef.current = boolStatus;

            const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
            if (!modelsLoaded) {
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);
                setModelsLoaded(true);
            }
            startCamera();
        } catch (err) {
            console.error("Error starting sign in", err);
            const msg = err.response?.data?.error || err.response?.data?.detail || "Failed to start camera for sign in.";
            setErrorMsg(msg);
        }
    };

    const handleSignOut = async () => {
        setIsProcessing(true);
        setSignOutLocationStatus('Detecting location...');
        try {
            let lat = null;
            let lng = null;
            
            try {
                const pos = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true, timeout: 10000, maximumAge: 0
                    });
                });
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
                setSignOutLocationStatus('Location detected ✓');
            } catch(e) {
                console.warn("Location not available for sign out.");
                setSignOutLocationStatus('Could not detect location, proceeding without it.');
            }
            
            const res = await axiosInstance.post('/api/project/marketing/attendance/sign_out/', {
                latitude: lat,
                longitude: lng
            });
            
            setSessionData({
                status: 'SIGNED_OUT',
                last_sign_out: res.data.sign_out_time
            });
            setSessionStatus('SIGNED_OUT');
            setIsProcessing(false);
            setSignOutLocationStatus('');
            
            Swal.fire({
                icon: 'success',
                title: 'Signed Out',
                text: 'Your session has been closed successfully.',
                timer: 2000,
                showConfirmButton: false
            });
            
        } catch(e) {
            setIsProcessing(false);
            setSignOutLocationStatus('');
            setErrorMsg("Failed to sign out. Please check connection.");
        }
    };

    // 2. Start Camera
    const startCamera = async () => {
        setStatus('Requesting camera permission...');
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            setStream(mediaStream);
            setStatus('Position your face inside the frame');
        } catch (err) {
            console.error("Camera error:", err);
            setErrorMsg("Camera access is required for face verification. Please enable camera permission and try again.");
        }
    };

    useEffect(() => {
        if (stream && videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream, sessionStatus]);

    const stopCamera = () => {
        if (captureIntervalRef.current) {
            clearInterval(captureIntervalRef.current);
            captureIntervalRef.current = null;
        }
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    // 3. Detect Face Loop
    const handleVideoPlay = () => {
        if (!modelsLoaded || isProcessingRef.current) return;

        if (captureIntervalRef.current) {
            clearInterval(captureIntervalRef.current);
        }

        captureIntervalRef.current = setInterval(async () => {
            if (isProcessingRef.current || !videoRef.current) {
                if (captureIntervalRef.current) {
                    clearInterval(captureIntervalRef.current);
                    captureIntervalRef.current = null;
                }
                return;
            }

            // Only update status if we aren't enrolling
            if (isEnrolledRef.current) {
                setStatus('Scanning face...');
            }

            try {
                const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptors();
                
                if (isProcessingRef.current) {
                    return;
                }

                if (detections.length === 0) {
                    setFaceDetected(false);
                    setActiveDetection(null);
                    if (isEnrolledRef.current) setStatus('No face detected. Please position your face inside the frame.');
                } else if (detections.length > 1) {
                    setFaceDetected(false);
                    setActiveDetection(null);
                    if (isEnrolledRef.current) setStatus('Only one person should be visible during verification.');
                } else if (detections.length === 1 && !isProcessingRef.current) {
                    setFaceDetected(true);
                    setActiveDetection(detections[0]);
                    
                    if (isEnrolledRef.current) {
                        isProcessingRef.current = true;
                        setIsProcessing(true);
                        if (captureIntervalRef.current) {
                            clearInterval(captureIntervalRef.current);
                            captureIntervalRef.current = null;
                        }
                        processAttendance(detections[0]);
                    } else {
                        setStatus('Face detected. You can take your photo now.');
                    }
                }
            } catch (detErr) {
                console.error("Face detection error:", detErr);
            }
        }, 1500);
    };

    // 4a. Manual Process Enrollment
    const handleManualEnroll = async () => {
        if (!activeDetection || !videoRef.current || isProcessingRef.current) return;
        isProcessingRef.current = true;
        setIsProcessing(true);
        if (captureIntervalRef.current) {
            clearInterval(captureIntervalRef.current);
            captureIntervalRef.current = null;
        }
        setStatus('Enrolling Face Data...');

        // Capture image for records
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0);
        
        // Draw timestamp overlay
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY format
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        const timestamp = `Enrolled: ${dateStr} at ${timeStr}`;
        
        // Add a semi-transparent dark background bar for text readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, canvas.height - 50, canvas.width, 50);

        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = '#ffdf00'; // Bright yellow
        const padding = 15;
        const textX = padding;
        const textY = canvas.height - 18;
        ctx.fillText(timestamp, textX, textY);
        
        canvas.toBlob(async (blob) => {
            try {
                const formData = new FormData();
                formData.append('enrolled_image', blob, 'enroll_face.jpg');
                formData.append('face_descriptor', JSON.stringify(Array.from(activeDetection.descriptor)));
                
                const response = await axiosInstance.post('/api/project/marketing/attendance/enroll_face/', 
                    formData,
                    {
                        headers: { 
                            'Content-Type': 'multipart/form-data'
                        }
                    }
                );

                Swal.fire({
                    icon: 'success',
                    title: 'Enrollment Successful',
                    text: 'Your photo is saved! Proceeding to mark attendance.',
                    timer: 2000,
                    showConfirmButton: false
                });

                setIsEnrolled(true);
                isEnrolledRef.current = true;
                isProcessingRef.current = false;
                setIsProcessing(false);
                setStatus('Position your face for Attendance');
                handleVideoPlay(); // Restart detection loop for attendance

            } catch (apiError) {
                isProcessingRef.current = false;
                setIsProcessing(false);
                console.error("Enrollment API Error:", apiError, apiError.response);
                
                let errorResponse = "Unable to save enrollment data.";
                if (apiError.response && apiError.response.data) {
                    const data = apiError.response.data;
                    if (data.error) errorResponse = data.error;
                    else if (data.detail) errorResponse = data.detail;
                    else if (typeof data === 'string') errorResponse = data.substring(0, 100);
                    else errorResponse = JSON.stringify(data).substring(0, 100);
                } else if (apiError.message) {
                    errorResponse = apiError.message;
                }
                
                setErrorMsg(errorResponse);
                stopCamera();
            }
        }, 'image/jpeg');
    };

    // 4b. Capture Location and Process Attendance
    const processAttendance = async (detection) => {
        isProcessingRef.current = true;
        setIsProcessing(true);
        setStatus('Recognizing employee...');
        
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });
            
            setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
            setStatus('Location detected ✓');

            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current ? videoRef.current.videoWidth : 640;
            canvas.height = videoRef.current ? videoRef.current.videoHeight : 480;
            const ctx = canvas.getContext('2d');
            if (videoRef.current) {
                ctx.drawImage(videoRef.current, 0, 0);
            }
            
            // Draw timestamp overlay
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY format
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            const timestamp = `Verified: ${dateStr} at ${timeStr}`;
            const locText = `Location: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
            
            // Add a semi-transparent dark background bar for text readability
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, canvas.height - 60, canvas.width, 60);

            ctx.font = 'bold 18px Arial';
            ctx.fillStyle = '#ffdf00'; // Bright yellow
            const padding = 15;
            ctx.fillText(timestamp, padding, canvas.height - 35);
            ctx.fillText(locText, padding, canvas.height - 12);
            
            canvas.toBlob(async (blob) => {
                const formData = new FormData();
                formData.append('selfie_image', blob, 'selfie.jpg');
                formData.append('latitude', pos.coords.latitude);
                formData.append('longitude', pos.coords.longitude);
                formData.append('location_accuracy', pos.coords.accuracy);
                formData.append('face_descriptor', JSON.stringify(Array.from(detection.descriptor)));
                
                try {
                    const response = await axiosInstance.post('/api/project/marketing/attendance/', formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data'
                        }
                    });

                    setStatus('Attendance marked successfully');
                    stopCamera();
                    
                    let localUser = { first_name: '', last_name: '', username: '' };
                    try {
                        const ud = JSON.parse(localStorage.getItem('userDetails') || '{}');
                        localUser = ud.user || ud || localUser;
                    } catch(e) {}
                    
                    setSuccessData({
                        data: response.data,
                        user: localUser
                    });

                } catch (apiError) {
                    isProcessingRef.current = false;
                    setIsProcessing(false);
                    console.error("Attendance API Error:", apiError, apiError.response);
                    
                    let errorResponse = "Unable to save attendance. Please check your connection and try again.";
                    if (apiError.response && apiError.response.data) {
                        const data = apiError.response.data;
                        if (data.error) errorResponse = data.error;
                        else if (data.detail) errorResponse = data.detail;
                        else if (typeof data === 'string') errorResponse = data.substring(0, 100);
                        else errorResponse = JSON.stringify(data).substring(0, 100);
                    } else if (apiError.message) {
                        errorResponse = apiError.message;
                    }
                    
                    setErrorMsg(errorResponse);
                    stopCamera();
                }

            }, 'image/jpeg');

        } catch (locError) {
            isProcessingRef.current = false;
            setIsProcessing(false);
            console.error("Location error", locError);
            setErrorMsg("Location access is required to mark attendance. Please enable location permission and try again.");
            stopCamera();
        }
    };

    if (successData) {
        return (
            <div className="container-fluid" style={{ background: '#f5f7fa', padding: '15px', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Card className="text-center shadow-lg" style={{ borderRadius: '14px', maxWidth: '400px', width: '100%', border: 'none' }}>
                    <Card.Body className="p-4">
                        <div className="mb-3" style={{ fontSize: '3rem', color: '#28a745' }}>
                            <i className="fa fa-check-circle"></i>
                        </div>
                        <h4 className="fw-bold mb-4 text-success">Attendance Marked Successfully</h4>
                        
                        <div className="text-start mb-3" style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
                            <p className="mb-1"><strong>Employee:</strong> {successData.user.first_name} {successData.user.last_name}</p>
                            <p className="mb-1"><strong>Employee ID:</strong> {successData.user.employee_id || successData.user.username}</p>
                            <p className="mb-1"><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                            <p className="mb-1"><strong>Check-In:</strong> {new Date().toLocaleTimeString()}</p>
                            <p className="mb-1 text-success"><i className="fa fa-map-marker me-1"></i> Location Verified ✓</p>
                            <p className="mb-0 text-success"><i className="fa fa-user-circle me-1"></i> Face Verified ✓</p>
                        </div>
                        
                        <Button 
                            variant="success" 
                            className="w-100 mt-3 py-2 fw-bold" 
                            onClick={() => {
                                setSessionData({
                                    status: 'ACTIVE',
                                    session_type: successData.data?.session_type || 'FIRST_SIGN_IN',
                                    sign_in_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                                });
                                setSessionStatus('ACTIVE');
                                setSuccessData(null);
                            }} 
                            style={{ borderRadius: '8px' }}
                        >
                            Continue to Session
                        </Button>
                        <Button 
                            variant="outline-secondary" 
                            className="w-100 mt-2 py-2" 
                            onClick={() => navigate('/market_connect_master')} 
                            style={{ borderRadius: '8px' }}
                        >
                            Back to Dashboard
                        </Button>
                    </Card.Body>
                </Card>
            </div>
        );
    }


    if (sessionStatus === 'CHECKING') {
        return (
            <div className="container-fluid" style={{ background: '#f5f7fa', padding: '15px', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Spinner animation="border" variant="primary" />
            </div>
        );
    }

    if (sessionStatus === 'ACTIVE') {
        return (
            <div className="container-fluid" style={{ background: '#f5f7fa', padding: '15px', minHeight: '100vh' }}>
                <Row className="justify-content-center mt-5">
                    <Col xs="12" md="8" lg="6">
                        <Card className="text-center shadow-sm" style={{ borderRadius: '14px', border: 'none' }}>
                            <Card.Body className="p-4">
                                <h4 style={{ fontFamily: 'DM Serif Display', color: '#0f1624' }}>ATTENDANCE</h4>
                                <div className="mt-4 mb-4" style={{ fontSize: '3rem', color: '#28a745' }}>
                                    <i className="fa fa-briefcase"></i>
                                </div>
                                <h5 className="fw-bold text-success mb-3">
                                    <span className="me-2">●</span> Currently Working
                                </h5>
                                {sessionData?.session_type === 'RE_ENTRY' && (
                                    <p className="text-muted mb-2 fw-bold">Re-Entry Session</p>
                                )}
                                <p className="mb-4"><strong>Sign In:</strong> {sessionData?.sign_in_time}</p>
                                
                                <Button 
                                    variant="danger" 
                                    className="w-100 py-3 fw-bold" 
                                    style={{ borderRadius: '8px' }}
                                    onClick={handleSignOut}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? <Spinner animation="border" size="sm" /> : "SIGN OUT"}
                                </Button>
                                {signOutLocationStatus && <p className="text-muted small mt-2">{signOutLocationStatus}</p>}
                                
                                {errorMsg && <Alert variant="danger" className="mt-3">{errorMsg}</Alert>}
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </div>
        );
    }

    if (sessionStatus === 'SIGNED_OUT') {
        return (
            <div className="container-fluid" style={{ background: '#f5f7fa', padding: '15px', minHeight: '100vh' }}>
                <Row className="justify-content-center mt-5">
                    <Col xs="12" md="8" lg="6">
                        <Card className="text-center shadow-sm" style={{ borderRadius: '14px', border: 'none' }}>
                            <Card.Body className="p-4">
                                <h4 style={{ fontFamily: 'DM Serif Display', color: '#0f1624' }}>ATTENDANCE</h4>
                                <div className="mt-4 mb-4" style={{ fontSize: '3rem', color: '#6c757d' }}>
                                    <i className="fa fa-sign-out-alt"></i>
                                </div>
                                <h5 className="fw-bold text-secondary mb-3">
                                    <span className="me-2">○</span> Signed Out
                                </h5>
                                <p className="mb-4"><strong>Last Sign Out:</strong> {sessionData?.last_sign_out}</p>
                                
                                <Button 
                                    variant="primary" 
                                    className="w-100 py-3 fw-bold mb-3" 
                                    style={{ borderRadius: '8px' }}
                                    onClick={startSignInAgain}
                                >
                                    <i className="fa fa-sign-in-alt me-2"></i> SIGN IN AGAIN
                                </Button>
                                
                                <Button 
                                    variant="outline-secondary" 
                                    className="w-100 py-2 fw-semibold" 
                                    style={{ borderRadius: '8px' }}
                                    onClick={() => navigate('/market_connect_master')}
                                >
                                    Back to Dashboard
                                </Button>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </div>
        );
    }

    return (
        <React.Fragment>
            <div className="container-fluid" style={{ background: '#f5f7fa', padding: '15px', minHeight: '100vh', paddingBottom: '100px' }}>
                <div className="row mb-3 mt-3 text-center">
                    <div className="col-12">
                        <h4 style={{ fontFamily: 'DM Serif Display', color: '#0f1624' }}>GLENDA AQUA</h4>
                        <h6 style={{ color: '#6b7a90', letterSpacing: '1px' }}>
                            {isEnrolled === false ? 'FACE ENROLLMENT' : 'ATTENDANCE'}
                        </h6>
                    </div>
                </div>
                
                <Row className="justify-content-center">
                    <Col xs="12" md="8" lg="6">
                        <Card className="shadow-sm" style={{ borderRadius: '14px', border: 'none', overflow: 'hidden' }}>
                            <Card.Body className="p-0 text-center bg-dark" style={{ position: 'relative', minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                
                                {errorMsg ? (
                                    <div className="p-4 bg-white h-100 d-flex flex-column justify-content-center align-items-center">
                                        <Alert variant="danger" className="w-100 text-start border-0 shadow-sm">
                                            <i className="fa fa-exclamation-triangle me-2"></i> {errorMsg}
                                        </Alert>
                                        <Button variant="outline-primary" className="mt-3 w-100" onClick={() => {
                                            setErrorMsg(null);
                                            setIsProcessing(false);
                                            setModelsLoaded(false);
                                            window.location.reload();
                                        }}>
                                            Try Again
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ position: 'relative', width: '100%', background: '#000' }}>
                                            <video 
                                                ref={videoRef} 
                                                onPlay={handleVideoPlay}
                                                autoPlay 
                                                muted 
                                                playsInline
                                                style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }}
                                            />
                                            <div style={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                width: '200px',
                                                height: '250px',
                                                border: `2px dashed ${faceDetected ? '#28a745' : 'rgba(255, 255, 255, 0.7)'}`,
                                                borderRadius: '50%',
                                                boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.5)',
                                                pointerEvents: 'none',
                                                transition: 'border 0.3s ease'
                                            }}></div>
                                        </div>
                                        
                                        <div className="p-3" style={{ background: '#fff' }}>
                                            <h6 className="fw-bold mb-2 text-primary">
                                                {isProcessing || !modelsLoaded ? <Spinner animation="border" size="sm" className="me-2" /> : <span className="me-2">●</span>} 
                                                {status}
                                            </h6>
                                            
                                            {isEnrolled === false && !isProcessing && (
                                                <Button 
                                                    variant={faceDetected ? "success" : "secondary"} 
                                                    className="w-100 mt-2 py-2 fw-bold shadow-sm"
                                                    disabled={!faceDetected}
                                                    onClick={handleManualEnroll}
                                                    style={{ borderRadius: '8px' }}
                                                >
                                                    <i className="fa fa-camera me-2"></i> Take Photo & Save
                                                </Button>
                                            )}

                                            {location && (
                                                <p className="text-success small fw-bold mb-0 mt-2">Location detected ✓</p>
                                            )}
                                        </div>
                                    </>
                                )}
                            </Card.Body>
                        </Card>
                        {isEnrolled === false && !errorMsg && (
                            <div className="text-center mt-3">
                                <p className="text-muted small">Capture a clear photo of your face to save it in the database. This will be used for future verification.</p>
                            </div>
                        )}
                        <Row className="justify-content-center mt-3">
                            <Col xs="12">
                                <Button 
                                    variant="outline-secondary" 
                                    className="w-100 py-3 shadow-sm d-flex align-items-center justify-content-center fw-bold bg-white text-dark"
                                    style={{ borderRadius: '12px', fontSize: '1.1rem', border: '1px solid #dee2e6' }}
                                    onClick={() => navigate('/market_connect_master/attendance/offline')}
                                >
                                    <i className="fa fa-wifi me-2 text-danger"></i> Offline Attendance
                                </Button>
                            </Col>
                        </Row>
                    </Col>
                </Row>
            </div>
        </React.Fragment>
    );
};

export default AttendanceModule;
