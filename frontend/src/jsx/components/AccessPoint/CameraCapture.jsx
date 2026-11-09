import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Modal, Button } from 'react-bootstrap';

/**
 * CameraCapture - A reusable modal that lets the user:
 * - Stream a live webcam feed
 * - Capture a still frame
 * - Re-capture or browse from disk
 * - Confirm selection via "Use Image"
 *
 * Props:
 * show {boolean} - controls modal visibility
 * onHide {function} - called when modal should close
 * onCapture {function(File)} - called with a File object when user confirms
 * title {string} - modal title (e.g. "Capture Visitor Photo")
 */
const CameraCapture = ({ show, onHide, onCapture, title = 'Capture Image', isDark = false }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const streamRef = useRef(null);

 const [mode, setMode] = useState('live'); // 'live' | 'captured' | 'browse'
 const [capturedUrl, setCapturedUrl] = useState(null);
 const [capturedFile, setCapturedFile] = useState(null);
 const [cameraError, setCameraError] = useState(null);

    // Start the camera stream
    const startCamera = useCallback(async () => {
        setCameraError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
        } catch (err) {
            setCameraError('Camera access denied or not available. Please check browser permissions.');
        }
    }, []);

 // Stop the camera stream
 const stopCamera = useCallback(() => {
 if (streamRef.current) {
 streamRef.current.getTracks().forEach(track => track.stop());
 streamRef.current = null;
 }
 }, []);

 // Start camera when modal opens in live mode
 useEffect(() => {
 if (show && mode === 'live') {
 startCamera();
 }
 return () => {
 if (!show) stopCamera();
 };
 }, [show, mode, startCamera, stopCamera]);

 // Capture a frame from the live feed
 const handleCapture = () => {
 if (!videoRef.current || !canvasRef.current) return;
 const video = videoRef.current;
 const canvas = canvasRef.current;
 canvas.width = video.videoWidth;
 canvas.height = video.videoHeight;
 const ctx = canvas.getContext('2d');
 ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
 const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
 setCapturedUrl(dataUrl);

 // Convert data URL to File
 canvas.toBlob(blob => {
 const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
 setCapturedFile(file);
 }, 'image/jpeg', 0.92);

 stopCamera();
 setMode('captured');
 };

 // Handle browse file
 const handleBrowse = (e) => {
 const file = e.target.files[0];
 if (!file) return;
 const url = URL.createObjectURL(file);
 setCapturedUrl(url);
 setCapturedFile(file);
 stopCamera();
 setMode('captured');
 };

 // Confirm selection
 const handleUseImage = () => {
 if (capturedFile) {
 onCapture(capturedFile);
 }
 handleClose();
 };

 // Re-capture
 const handleRetake = () => {
 setCapturedUrl(null);
 setCapturedFile(null);
 setMode('live');
 startCamera();
 };

 // Switch to live capture from the button
 const handleLiveCapture = () => {
 setCapturedUrl(null);
 setCapturedFile(null);
 setMode('live');
 startCamera();
 };

 // Close
 const handleClose = () => {
 stopCamera();
 setCapturedUrl(null);
 setCapturedFile(null);
 setCameraError(null);
 setMode('live');
 onHide();
 };

    return (
        <Modal show={show} onHide={handleClose} centered size="md">
            <Modal.Header closeButton style={{
                background: isDark ? '#1a1a2e' : '#fff',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#eee'}`
            }}>
                <Modal.Title style={{ color: isDark ? '#fff' : '#333', fontSize: '16px', fontWeight: 600 }}>
                    <i className="fa fa-camera me-2 text-info"></i>{title}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ background: isDark ? '#1a1a2e' : '#f8f9fa', padding: '20px' }}>
                {/* Video / Preview Area */}
                <div
                    style={{
                        width: '100%',
                        height: '280px',
                        background: isDark ? '#0a0a1a' : '#000',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        position: 'relative',
                        border: `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#ddd'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    {cameraError ? (
                        <div className="text-center text-danger px-4">
                            <i className="fa fa-video-slash mb-2" style={{ fontSize: '36px' }}></i>
                            <p className="mb-0 small">{cameraError}</p>
                        </div>
                    ) : mode === 'live' ? (
                        <video
                            ref={videoRef}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            autoPlay
                            muted
                            playsInline
                        />
                    ) : (
                        <img
                            src={capturedUrl}
                            alt="Captured"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    )}
                    {/* Live indicator */}
                    {mode === 'live' && !cameraError && (
                        <div style={{
                            position: 'absolute', top: '10px', left: '10px',
                            background: 'rgba(0,0,0,0.6)', borderRadius: '6px',
                            padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px'
                        }}>
                            <span style={{ width: '8px', height: '8px', background: '#ff4444', borderRadius: '50%', display: 'inline-block', animation: 'blink 1s infinite' }}></span>
                            <span style={{ color: '#fff', fontSize: '11px', fontWeight: 600 }}>LIVE</span>
                        </div>
                    )}
                </div>

 {/* Hidden canvas for capture */}
 <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Capture Button (shown in live mode) */}
                {mode === 'live' && !cameraError && (
                    <div className="text-center mt-3">
                        <Button
                            onClick={handleCapture}
                            style={{
                                background: 'linear-gradient(135deg, #00d2ff, #3a7bd5)',
                                border: 'none', borderRadius: '50px',
                                padding: '10px 30px', fontWeight: 600, color: '#fff'
                            }}
                        >
                            <i className="fa fa-circle me-2 text-danger"></i>Capture
                        </Button>
                    </div>
                )}

                {/* Retake button in captured mode */}
                {mode === 'captured' && (
                    <div className="text-center mt-3">
                        <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={handleRetake}
                            style={{ borderRadius: '8px', color: isDark ? '#aaa' : '#666', borderColor: isDark ? '#555' : '#ccc' }}
                        >
                            <i className="fa fa-redo me-2"></i>Retake
                        </Button>
                    </div>
                )}
            </Modal.Body>

            <Modal.Footer style={{
                background: isDark ? '#1a1a2e' : '#fff',
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#eee'}`,
                gap: '8px'
            }}>
                {/* Browse from disk */}
                <Button
                    variant={isDark ? "outline-light" : "outline-secondary"}
                    size="sm"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    style={{ borderRadius: '8px', fontSize: '13px' }}
                >
                    <i className="fa fa-folder-open me-2"></i>Browse
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBrowse} />

                {/* Live Capture button */}
                {mode !== 'live' && (
                    <Button
                        size="sm"
                        onClick={handleLiveCapture}
                        style={{
                            background: 'linear-gradient(135deg, #5b4fd1, #3a7bd5)',
                            border: 'none', borderRadius: '8px', fontSize: '13px', color: '#fff'
                        }}
                    >
                        <i className="fa fa-camera me-2"></i>Live Capture
                    </Button>
                )}

                {/* Use Image (only when an image is selected) */}
                <Button
                    size="sm"
                    disabled={!capturedFile}
                    onClick={handleUseImage}
                    style={{
                        background: capturedFile ? 'linear-gradient(135deg, #00c851, #007e33)' : '#555',
                        border: 'none', borderRadius: '8px', fontSize: '13px', color: '#fff'
                    }}
                >
                    <i className="fa fa-check me-2"></i>Use Image
                </Button>
            </Modal.Footer>

 <style>{`
 @keyframes blink {
 0%, 100% { opacity: 1; }
 50% { opacity: 0.2; }
 }
 `}</style>
 </Modal>
 );
};

export default CameraCapture;
