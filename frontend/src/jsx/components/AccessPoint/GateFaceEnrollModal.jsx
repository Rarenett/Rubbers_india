import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal, Button, Form, Spinner, Alert, Badge, Row, Col } from 'react-bootstrap';
import * as faceapi from 'face-api.js';
import { getEnrolledEmployees, enrollEmployeeFace } from '../../../services/GateManagementService';
import Swal from 'sweetalert2';

const GateFaceEnrollModal = ({
    show,
    onHide,
    onEnrolled,
    isDark = false
}) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const [employees, setEmployees] = useState([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const [cameraActive, setCameraActive] = useState(false);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [capturedBlob, setCapturedBlob] = useState(null);
    const [capturedPreview, setCapturedPreview] = useState(null);
    const [capturedDescriptor, setCapturedDescriptor] = useState(null);
    const [isDetecting, setIsDetecting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    // Fetch employee list on show
    useEffect(() => {
        if (!show) {
            stopCamera();
            setCapturedBlob(null);
            setCapturedPreview(null);
            setCapturedDescriptor(null);
            setErrorMsg(null);
            return;
        }

        const fetchEmployees = async () => {
            try {
                setLoadingEmployees(true);
                const data = await getEnrolledEmployees();
                setEmployees(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Error loading employees for face enrollment:', err);
            } finally {
                setLoadingEmployees(false);
            }
        };

        fetchEmployees();
        loadModels();
    }, [show]);

    const loadModels = async () => {
        try {
            const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            ]);
            setModelsLoaded(true);
            startCamera();
        } catch (err) {
            console.error('Face models load error in enroll modal:', err);
            setErrorMsg('Failed to load AI face models. Please check connection.');
        }
    };

    const startCamera = async () => {
        setErrorMsg(null);
        try {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setCameraActive(true);
        } catch (err) {
            console.error('Camera access error:', err);
            setErrorMsg('Unable to access camera for face enrollment.');
            setCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
    };

    const handleCapture = async () => {
        if (!videoRef.current || !modelsLoaded) return;
        setIsDetecting(true);
        setErrorMsg(null);

        const video = videoRef.current;
        try {
            const detection = await faceapi
                .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                setErrorMsg('No face clearly detected. Please face the camera straight-on in good lighting and try again.');
                setIsDetecting(false);
                return;
            }

            // Create captured snapshot canvas
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));

            setCapturedBlob(blob);
            setCapturedPreview(dataUrl);
            setCapturedDescriptor(Array.from(detection.descriptor));
            stopCamera();

        } catch (err) {
            console.error('Capture detection error:', err);
            setErrorMsg('Failed to process facial features. Please try again.');
        } finally {
            setIsDetecting(false);
        }
    };

    const handleRetake = () => {
        setCapturedBlob(null);
        setCapturedPreview(null);
        setCapturedDescriptor(null);
        setErrorMsg(null);
        startCamera();
    };

    const handleSaveEnrollment = async () => {
        if (!selectedEmployeeId) {
            Swal.fire('Warning', 'Please select an employee to enroll.', 'warning');
            return;
        }
        if (!capturedDescriptor) {
            Swal.fire('Warning', 'Please capture the employee photo first.', 'warning');
            return;
        }

        setIsSaving(true);
        setErrorMsg(null);

        try {
            const formData = new FormData();
            formData.append('employee_id', selectedEmployeeId);
            formData.append('face_descriptor', JSON.stringify(capturedDescriptor));
            if (capturedBlob) {
                formData.append('enrolled_image', capturedBlob, 'enrolled_face.jpg');
            }

            const res = await enrollEmployeeFace(formData);

            Swal.fire({
                icon: 'success',
                title: 'Face Enrolled Successfully!',
                text: res.message || 'Employee facial recognition profile is now active.',
                timer: 2500,
                showConfirmButton: false
            });

            if (typeof onEnrolled === 'function') {
                onEnrolled(selectedEmployeeId);
            }
            onHide();

        } catch (err) {
            console.error('Error saving face enrollment:', err);
            const errorMsg = err.response?.data?.error || 'Failed to save enrollment. Please try again.';
            setErrorMsg(errorMsg);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredEmployees = employees.filter(emp => {
        const q = searchTerm.toLowerCase();
        return (
            emp.name?.toLowerCase().includes(q) ||
            emp.employment_no?.toLowerCase().includes(q) ||
            emp.department?.toLowerCase().includes(q)
        );
    });

    const selectedEmployee = employees.find(e => String(e.id) === String(selectedEmployeeId));

    return (
        <Modal 
            show={show} 
            onHide={onHide} 
            size="lg" 
            centered
            backdrop="static"
            keyboard={false}
            dialogClassName="gate-custom-modal item-custom-modal face-enroll-modal"
        >
            {/* Standard Glenda Modal Header */}
            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <i className="fa fa-user-plus text-white" style={{ fontSize: '18px' }}></i>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                            Enroll Employee Face
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            Register employee facial descriptor for gate attendance
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide}>
                    &times;
                </button>
            </div>

            <div className="modal-body-custom" style={{ background: isDark ? '#1e293b' : '#ffffff' }}>
                {errorMsg && (
                    <Alert variant="danger" className="py-2 px-3 mb-3 small d-flex align-items-center justify-content-between">
                        <div>
                            <i className="fa fa-exclamation-circle me-1.5"></i> {errorMsg}
                        </div>
                    </Alert>
                )}

                <Row className="g-4">
                    {/* Left: Employee Selection */}
                    <Col md={5} className="border-end pe-md-4">
                        <Form.Group className="mb-3">
                            <Form.Label className="small fw-semibold text-muted text-uppercase" style={{ letterSpacing: '0.5px' }}>
                                1. Select Employee <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                                type="text"
                                size="sm"
                                placeholder="Search by name, ID, or dept..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="mb-2 shadow-none"
                            />
                            {loadingEmployees ? (
                                <div className="text-center py-4 text-muted small">
                                    <Spinner size="sm" animation="border" className="me-2" /> Loading employees...
                                </div>
                            ) : (
                                <div 
                                    className="border rounded-3 p-1 overflow-auto" 
                                    style={{ maxHeight: '260px', background: isDark ? '#0f172a' : '#f8fafc' }}
                                >
                                    {filteredEmployees.length === 0 ? (
                                        <div className="text-center py-3 text-muted small">No employees found</div>
                                    ) : (
                                        filteredEmployees.map(emp => {
                                            const isSelected = String(emp.id) === String(selectedEmployeeId);
                                            return (
                                                <div
                                                    key={emp.id}
                                                    onClick={() => setSelectedEmployeeId(emp.id)}
                                                    className={`p-2 rounded-2 mb-1 d-flex align-items-center justify-content-between cursor-pointer transition-all ${isSelected ? 'bg-success text-white shadow-sm' : isDark ? 'hover-bg-dark' : 'hover-bg-light'}`}
                                                    style={{ cursor: 'pointer', fontSize: '13px' }}
                                                >
                                                    <div>
                                                        <div className={`fw-semibold ${isSelected ? 'text-white' : ''}`}>
                                                            {emp.name}
                                                        </div>
                                                        <div className={`small ${isSelected ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: '11px' }}>
                                                            {emp.employment_no} &bull; {emp.department}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        {emp.is_enrolled ? (
                                                            <Badge bg={isSelected ? 'light' : 'success-subtle'} text={isSelected ? 'dark' : 'success'} pill style={{ fontSize: '10px' }}>
                                                                <i className="fa fa-check me-1"></i>Enrolled
                                                            </Badge>
                                                        ) : (
                                                            <Badge bg={isSelected ? 'light' : 'warning-subtle'} text={isSelected ? 'dark' : 'warning'} pill style={{ fontSize: '10px' }}>
                                                                Not Enrolled
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </Form.Group>

                        {selectedEmployee && (
                            <div className="p-3 rounded-3 bg-light border small">
                                <div className="fw-bold text-dark mb-1">{selectedEmployee.name}</div>
                                <div className="text-muted mb-1">Badge ID: <strong>{selectedEmployee.employment_no}</strong></div>
                                <div className="text-muted">Dept: {selectedEmployee.department} &bull; {selectedEmployee.designation}</div>
                            </div>
                        )}
                    </Col>

                    {/* Right: Camera / Photo Capture */}
                    <Col md={7} className="ps-md-4 text-center">
                        <Form.Label className="small fw-semibold text-muted text-uppercase d-block text-start" style={{ letterSpacing: '0.5px' }}>
                            2. Capture Face Frame <span className="text-danger">*</span>
                        </Form.Label>

                        <div 
                            className="position-relative mx-auto rounded-3 overflow-hidden shadow-sm bg-dark"
                            style={{ width: '100%', height: '240px', border: `2px solid ${capturedPreview ? '#22c55e' : '#334155'}` }}
                        >
                            {capturedPreview ? (
                                <img
                                    src={capturedPreview}
                                    alt="Enrolled Face Preview"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                                />
                            )}

                            {!capturedPreview && (
                                <div className="position-absolute top-0 start-0 w-100 h-100 pointer-events-none d-flex align-items-center justify-content-center">
                                    <div 
                                        style={{
                                            width: '160px',
                                            height: '190px',
                                            border: '2px dashed rgba(10, 80, 15, 0.7)',
                                            borderRadius: '12px'
                                        }}
                                    ></div>
                                </div>
                            )}
                        </div>

                        {/* Capture Action Controls */}
                        <div className="mt-3 d-flex align-items-center justify-content-center gap-2">
                            {!capturedPreview ? (
                                <Button
                                    variant="success"
                                    size="sm"
                                    className="px-4 py-1.5 rounded-pill fw-semibold shadow-sm text-white"
                                    onClick={handleCapture}
                                    disabled={!cameraActive || isDetecting || !modelsLoaded}
                                    style={{ backgroundColor: '#0a500f', borderColor: '#0a500f' }}
                                >
                                    {isDetecting ? (
                                        <>
                                            <Spinner size="sm" animation="border" className="me-1.5" />
                                            Scanning Face...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa fa-camera me-1.5"></i> Capture Face
                                        </>
                                    )}
                                </Button>
                            ) : (
                                <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    className="px-3 rounded-pill"
                                    onClick={handleRetake}
                                >
                                    <i className="fa fa-redo me-1"></i> Retake Photo
                                </Button>
                            )}
                        </div>

                        {capturedDescriptor && (
                            <div className="mt-2 text-success small fw-semibold">
                                <i className="fa fa-check-circle me-1"></i> AI descriptor extracted (128 facial features)
                            </div>
                        )}
                    </Col>
                </Row>
            </div>

            {/* Standard Glenda Modal Footer */}
            <div className="modal-footer-custom">
                <button 
                    type="button" 
                    className="btn-close-custom" 
                    onClick={onHide}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    className="btn-save-custom"
                    onClick={handleSaveEnrollment}
                    disabled={isSaving || !selectedEmployeeId || !capturedDescriptor}
                >
                    {isSaving ? (
                        <>
                            <Spinner size="sm" animation="border" className="me-1.5" />
                            Enrolling...
                        </>
                    ) : (
                        <>
                            <i className="fa fa-save me-1.5"></i> Save & Enroll Face
                        </>
                    )}
                </button>
            </div>
        </Modal>
    );
};

export default GateFaceEnrollModal;
