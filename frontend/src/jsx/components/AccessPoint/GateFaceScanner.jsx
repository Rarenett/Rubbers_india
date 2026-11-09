import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Button, Spinner, Alert, Badge } from 'react-bootstrap';
import * as faceapi from 'face-api.js';
import { scanEmployeeFaceGateEntry } from '../../../services/GateManagementService';
import { playCheckInSound, playCheckOutSound, playErrorSound } from '../../../utils/audioNotification';
import Swal from 'sweetalert2';

const GateFaceScanner = ({
    gateId = 1,
    isDark = false,
    onScanSuccess = null,
    onOpenEnroll = null,
    onClose = null,
    className = ""
}) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const detectTimerRef = useRef(null);
    const isProcessingRef = useRef(false);
    const isCooldownRef = useRef(false);

    const [cameraActive, setCameraActive] = useState(true);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [loadingModels, setLoadingModels] = useState(true);
    const [cameraError, setCameraError] = useState(null);
    const [statusText, setStatusText] = useState('Initializing AI face models...');
    const [statusType, setStatusType] = useState('info'); // 'info', 'scanning', 'success', 'error', 'cooldown'
    const [faceDetected, setFaceDetected] = useState(false);
    const [cooldownCountdown, setCooldownCountdown] = useState(0);
    const [lastMatchedEmployee, setLastMatchedEmployee] = useState(null);
    const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'

    // 1. Load Face-API models
    useEffect(() => {
        let isMounted = true;
        const loadModels = async () => {
            try {
                setLoadingModels(true);
                setStatusText('Loading AI facial models...');
                const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);
                if (isMounted) {
                    setModelsLoaded(true);
                    setLoadingModels(false);
                    setStatusText('Models loaded. Starting camera feed...');
                }
            } catch (err) {
                console.error('Failed to load face-api models:', err);
                if (isMounted) {
                    setLoadingModels(false);
                    setCameraError('Failed to load AI face recognition models. Please check your internet connection.');
                    setStatusText('Model loading error');
                    setStatusType('error');
                }
            }
        };

        loadModels();
        return () => {
            isMounted = false;
        };
    }, []);

    // 2. Start Camera
    const startCamera = useCallback(async () => {
        setCameraError(null);
        setStatusText('Accessing gate camera...');
        setStatusType('info');
        try {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setCameraActive(true);
            setStatusText('Camera active. Align employee face inside frame.');
            setStatusType('scanning');
        } catch (err) {
            console.error('Camera access error:', err);
            setCameraError('Unable to access camera. Please allow camera permissions in your browser.');
            setStatusText('Camera permission denied or unavailable');
            setStatusType('error');
            setCameraActive(false);
        }
    }, [facingMode]);

    // 3. Stop Camera
    const stopCamera = useCallback(() => {
        if (detectTimerRef.current) {
            clearInterval(detectTimerRef.current);
            detectTimerRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
        setStatusText('Camera paused');
        setStatusType('info');
    }, []);

    // Trigger camera start when models are ready and cameraActive is true
    useEffect(() => {
        if (modelsLoaded && cameraActive) {
            startCamera();
        }
        return () => {
            stopCamera();
        };
    }, [modelsLoaded, facingMode, startCamera, stopCamera]);

    // 4. Real-time Face Detection Loop
    const handleVideoPlay = () => {
        if (!modelsLoaded || !videoRef.current) return;

        if (detectTimerRef.current) {
            clearInterval(detectTimerRef.current);
        }

        detectTimerRef.current = setInterval(async () => {
            if (isProcessingRef.current || isCooldownRef.current || !videoRef.current) {
                return;
            }

            const video = videoRef.current;
            if (video.paused || video.ended || !video.videoWidth) {
                return;
            }

            try {
                // Detect single face with landmarks and descriptor
                const detection = await faceapi
                    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (!detection) {
                    setFaceDetected(false);
                    if (!isCooldownRef.current) {
                        setStatusText('Position employee face inside camera view');
                        setStatusType('scanning');
                    }
                    return;
                }

                setFaceDetected(true);
                setStatusText('Face detected! Recognizing employee...');
                setStatusType('scanning');

                // Process the detected face
                processFaceCheck(detection);

            } catch (detErr) {
                console.warn('Face detection tick error:', detErr);
            }
        }, 900);
    };

    // 5. Submit Face Recognition to Backend
    const processFaceCheck = async (detection) => {
        if (isProcessingRef.current || isCooldownRef.current || !videoRef.current) return;

        isProcessingRef.current = true;
        setStatusText('Verifying identity with enrolled profiles...');
        setStatusType('scanning');

        try {
            // Capture high-res snapshot from current frame
            const video = videoRef.current;
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Add timestamp overlay
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            const dateStr = now.toLocaleDateString('en-IN');
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
            ctx.font = 'bold 16px sans-serif';
            ctx.fillStyle = '#2ece8a';
            ctx.fillText(`Gate Camera • ${dateStr} ${timeStr}`, 14, canvas.height - 14);

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));

            const formData = new FormData();
            formData.append('face_descriptor', JSON.stringify(Array.from(detection.descriptor)));
            formData.append('gate_id', gateId || 1);
            if (blob) {
                formData.append('snapshot', blob, 'gate_employee_snapshot.jpg');
            }

            const response = await scanEmployeeFaceGateEntry(formData);
            const action = response.action;
            const isCheckIn = action === 'CHECK_IN';
            const entry = response.entry || {};
            const empName = response.employee_name || entry.employee_name || 'Employee';
            const empNo = response.employment_no || entry.employment_no || '';
            const confidence = response.confidence ? `${response.confidence}%` : '';

            // Play notification audio (no card printing for employee entries)
            if (isCheckIn) {
                playCheckInSound();
            } else {
                playCheckOutSound();
            }

            // Show Toast Notification
            Swal.fire({
                icon: isCheckIn ? 'success' : 'info',
                title: isCheckIn ? '🟢 Employee Checked IN' : '🔵 Employee Checked OUT',
                html: `
                    <div style="text-align: center; padding: 4px 0;">
                        <h5 style="margin: 0 0 6px 0; font-weight: 700; color: ${isCheckIn ? '#16a34a' : '#2563eb'};">
                            ${empName}
                        </h5>
                        <div style="font-size: 13px; color: #64748b; margin-bottom: 6px;">
                            ID: <strong style="color: #334155;">${empNo}</strong> &bull; Face Verified (${confidence})
                        </div>
                        ${entry.vehicle_number ? `
                            <div style="display: inline-flex; align-items: center; gap: 6px; background: ${isCheckIn ? '#ecfdf5' : '#f8fafc'}; border: 1px solid ${isCheckIn ? '#a7f3d0' : '#e2e8f0'}; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600; color: ${isCheckIn ? '#065f46' : '#475569'}; margin-bottom: 4px;">
                                <i class="fa fa-car ${isCheckIn ? 'text-success' : 'text-primary'}"></i>
                                Vehicle: <strong>${entry.vehicle_number}</strong> ${isCheckIn ? '(Inside Campus)' : 'Checked OUT'}
                            </div>
                        ` : ''}
                        ${isCheckIn && entry.parking_details ? `
                            <div style="margin-bottom: 6px;">
                                <div style="display: inline-flex; align-items: center; gap: 6px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600; color: #1d4ed8;">
                                    <i class="fa fa-parking text-primary"></i>
                                    Parking: <strong>${entry.parking_details}</strong>
                                </div>
                            </div>
                        ` : ''}
                        ${!isCheckIn && entry.stay_duration ? `
                            <div style="display: inline-block; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 600; margin-top: 4px;">
                                ⏱️ Stay Duration: ${entry.stay_duration}
                            </div>
                        ` : ''}
                    </div>
                `,
                timer: 3500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });

            setLastMatchedEmployee({
                name: empName,
                no: empNo,
                action: isCheckIn ? 'CHECKED IN' : 'CHECKED OUT',
                confidence: confidence
            });

            setStatusText(`Verified: ${empName} (${action === 'CHECK_IN' ? 'Check IN' : 'Check OUT'})`);
            setStatusType('success');

            // Stop camera hardware tracks immediately upon successful verification
            stopCamera();

            // Notify parent form / list
            if (typeof onScanSuccess === 'function') {
                onScanSuccess({
                    action,
                    message: response.message,
                    entry,
                    confidence: response.confidence,
                    timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                });
            }

        } catch (error) {
            console.error('Face verification error:', error);
            playErrorSound();
            const errMsg = error.response?.data?.error || 'Face not recognized. No enrolled employee matched.';

            setStatusText(errMsg);
            setStatusType('error');

            Swal.fire({
                icon: 'warning',
                title: 'Face Not Recognized',
                text: errMsg,
                showCancelButton: true,
                confirmButtonColor: '#2ece8a',
                cancelButtonColor: '#64748b',
                confirmButtonText: '<i class="fa fa-user-plus me-1"></i> Enroll Face Now',
                cancelButtonText: 'Try Again',
                timer: 4500,
                timerProgressBar: true
            }).then((result) => {
                if (result.isConfirmed && typeof onOpenEnroll === 'function') {
                    onOpenEnroll();
                }
            });

            // Brief pause before trying again
            startCooldown(2.0);

        } finally {
            isProcessingRef.current = false;
        }
    };

    // 6. Cooldown Debounce Timer
    const startCooldown = (seconds) => {
        isCooldownRef.current = true;
        setCooldownCountdown(Math.ceil(seconds));

        let remaining = Math.ceil(seconds);
        const interval = setInterval(() => {
            remaining -= 1;
            setCooldownCountdown(remaining);
            if (remaining <= 0) {
                clearInterval(interval);
                isCooldownRef.current = false;
                setStatusText('Camera ready. Position employee face inside frame.');
                setStatusType('scanning');
            }
        }, 1000);
    };

    return (
        <Card className={`border shadow-sm mb-3 ${className}`} style={{ borderRadius: '12px', overflow: 'hidden', background: isDark ? '#1e293b' : '#ffffff' }}>
            <Card.Header className="py-2.5 px-3 d-flex align-items-center justify-content-between flex-wrap gap-2" style={{ background: isDark ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                <div className="d-flex align-items-center gap-2">
                    <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle d-flex align-items-center gap-1.5 px-2.5 py-1">
                        <span className="spinner-grow spinner-grow-sm text-success" style={{ width: '8px', height: '8px' }}></span>
                        <i className="fa fa-camera"></i> Live Face Recognition
                    </span>
                    <span className="small text-muted d-none d-sm-inline">
                        Gate Camera Mode Active
                    </span>
                </div>

                <div className="d-flex align-items-center gap-2">
                    {typeof onOpenEnroll === 'function' && (
                        <Button
                            variant="outline-primary"
                            size="sm"
                            className="rounded-pill px-2.5 py-1"
                            style={{ fontSize: '12px' }}
                            onClick={onOpenEnroll}
                            title="Enroll a new employee's face photo"
                        >
                            <i className="fa fa-user-plus me-1"></i> Enroll Face
                        </Button>
                    )}

                    <Button
                        variant={cameraActive ? "outline-warning" : "outline-success"}
                        size="sm"
                        className="rounded-pill px-2.5 py-1"
                        style={{ fontSize: '12px' }}
                        onClick={() => {
                            if (cameraActive) stopCamera();
                            else startCamera();
                        }}
                    >
                        <i className={`fa ${cameraActive ? 'fa-pause' : 'fa-play'} me-1`}></i>
                        {cameraActive ? 'Pause' : 'Resume'}
                    </Button>

                    <Button
                        variant="outline-secondary"
                        size="sm"
                        className="rounded-circle p-0 d-flex align-items-center justify-content-center"
                        style={{ width: '28px', height: '28px' }}
                        onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                        title="Switch Camera (Front/Back)"
                    >
                        <i className="fa fa-sync-alt" style={{ fontSize: '11px' }}></i>
                    </Button>

                    {typeof onClose === 'function' && (
                        <Button
                            variant="outline-secondary"
                            size="sm"
                            className="rounded-pill px-2.5 py-1 d-inline-flex align-items-center gap-1.5 shadow-none ms-1"
                            style={{ 
                                fontSize: '12px', 
                                borderColor: isDark ? '#475569' : '#cbd5e1', 
                                color: isDark ? '#cbd5e1' : '#334155',
                                background: isDark ? '#1e293b' : '#ffffff'
                            }}
                            onClick={onClose}
                            title="Exit camera and return to Visitor / Vehicle / Employee search screen"
                        >
                            <i className="fa fa-arrow-left text-muted"></i>
                            <span>Back to Visitor / Vehicle Entry</span>
                        </Button>
                    )}
                </div>
            </Card.Header>

            <Card.Body className="p-3 text-center position-relative">
                {/* Error Banner */}
                {cameraError && (
                    <Alert variant="danger" className="py-2 px-3 mb-2 small text-start d-flex align-items-center justify-content-between">
                        <div>
                            <i className="fa fa-exclamation-triangle me-1.5"></i> {cameraError}
                        </div>
                        <Button variant="outline-danger" size="sm" className="py-0 px-2" onClick={startCamera}>
                            Retry
                        </Button>
                    </Alert>
                )}

                {/* Viewport Frame */}
                <div 
                    className="position-relative mx-auto rounded-3 overflow-hidden shadow-sm"
                    style={{ 
                        maxWidth: '560px', 
                        height: '320px', 
                        background: '#0a0f1d',
                        border: `2px solid ${statusType === 'success' ? '#22c55e' : statusType === 'error' ? '#ef4444' : faceDetected ? '#3b82f6' : isDark ? '#334155' : '#cbd5e1'}`
                    }}
                >
                    {/* Video Element */}
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        onPlay={handleVideoPlay}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
                        }}
                    />

                    {/* Hidden Canvas for captures */}
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    {/* Loading Overlay */}
                    {loadingModels && (
                        <div className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-dark bg-opacity-75 text-white">
                            <Spinner animation="border" variant="success" className="mb-2" />
                            <small className="fw-semibold">Loading AI Facial Recognition Models...</small>
                            <small className="text-muted" style={{ fontSize: '11px' }}>Powered by face-api.js</small>
                        </div>
                    )}

                    {/* Targeting Viewfinder Overlay */}
                    {!loadingModels && cameraActive && (
                        <div className="position-absolute top-0 start-0 w-100 h-100 pointer-events-none d-flex align-items-center justify-content-center">
                            {/* Futuristic Targeting Box */}
                            <div 
                                style={{
                                    width: '210px',
                                    height: '240px',
                                    border: `2px dashed ${faceDetected ? '#22c55e' : 'rgba(255, 255, 255, 0.45)'}`,
                                    borderRadius: '16px',
                                    boxShadow: faceDetected ? '0 0 20px rgba(34, 197, 94, 0.4)' : 'none',
                                    transition: 'all 0.2s ease',
                                    position: 'relative'
                                }}
                            >
                                {/* Corner Accents */}
                                <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '20px', height: '20px', borderTop: '3px solid #2ece8a', borderLeft: '3px solid #2ece8a', borderTopLeftRadius: '8px' }}></div>
                                <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '20px', height: '20px', borderTop: '3px solid #2ece8a', borderRight: '3px solid #2ece8a', borderTopRightRadius: '8px' }}></div>
                                <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '20px', height: '20px', borderBottom: '3px solid #2ece8a', borderLeft: '3px solid #2ece8a', borderBottomLeftRadius: '8px' }}></div>
                                <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '20px', height: '20px', borderBottom: '3px solid #2ece8a', borderRight: '3px solid #2ece8a', borderBottomRightRadius: '8px' }}></div>
                            </div>

                            {/* Scan Line Animation */}
                            {faceDetected && !isCooldownRef.current && (
                                <style>{`
                                    @keyframes scanLineAnim {
                                        0% { top: 15%; opacity: 0.8; }
                                        50% { top: 80%; opacity: 1; }
                                        100% { top: 15%; opacity: 0.8; }
                                    }
                                    .gate-scanner-laser {
                                        position: absolute;
                                        width: 210px;
                                        height: 2px;
                                        background: linear-gradient(90deg, transparent, #22c55e, transparent);
                                        box-shadow: 0 0 10px #22c55e;
                                        animation: scanLineAnim 1.6s infinite ease-in-out;
                                    }
                                `}</style>
                            )}
                            {faceDetected && !isCooldownRef.current && <div className="gate-scanner-laser"></div>}
                        </div>
                    )}

                    {/* Cooldown Overlay */}
                    {cooldownCountdown > 0 && lastMatchedEmployee && (
                        <div className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-dark bg-opacity-80 text-white p-3">
                            <div className="rounded-circle bg-success bg-opacity-25 p-3 mb-2 text-success">
                                <i className="fa fa-check-circle fa-2x"></i>
                            </div>
                            <h5 className="fw-bold mb-1 text-white">{lastMatchedEmployee.name}</h5>
                            <div className="small text-success-emphasis fw-semibold mb-2">
                                <Badge bg="success" className="me-1">{lastMatchedEmployee.action}</Badge>
                                ID: {lastMatchedEmployee.no}
                            </div>
                            <small className="text-muted" style={{ fontSize: '12px' }}>
                                Next scan resumes in <b className="text-white">{cooldownCountdown}s</b>...
                            </small>
                        </div>
                    )}
                </div>

                {/* Bottom Status Indicator Bar */}
                <div className="mt-2.5 d-flex align-items-center justify-content-between flex-wrap gap-2 px-1">
                    <div className="d-flex align-items-center gap-2 text-start">
                        <span 
                            className="rounded-circle"
                            style={{
                                width: '10px',
                                height: '10px',
                                backgroundColor: statusType === 'success' ? '#22c55e' : statusType === 'error' ? '#ef4444' : faceDetected ? '#3b82f6' : '#94a3b8'
                            }}
                        ></span>
                        <span 
                            className="fw-semibold" 
                            style={{ 
                                fontSize: '13px', 
                                color: statusType === 'success' ? '#16a34a' : statusType === 'error' ? '#dc2626' : (isDark ? '#e2e8f0' : '#334155') 
                            }}
                        >
                            {statusText}
                        </span>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <small className="text-muted" style={{ fontSize: '11px' }}>
                            <i className="fa fa-shield-alt me-1 text-success"></i> Auto Check-IN / OUT Toggle
                        </small>
                    </div>
                </div>
            </Card.Body>
        </Card>
    );
};

export default GateFaceScanner;
