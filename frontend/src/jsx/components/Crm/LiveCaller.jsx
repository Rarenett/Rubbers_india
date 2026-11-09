import React, { useState, useEffect, useRef } from 'react';
import axiosInstance from '../../../services/AxiosInstance';

const LiveCaller = ({ assignment, onEndCall }) => {
    const [status, setStatus] = useState('Dialing'); // Dialing, Connected, Ended
    const [timer, setTimer] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const timerRef = useRef(null);
    const hasInitiated = useRef(false);

    // Simulated Telephony Audio (Dial tone / Connection beep)
    useEffect(() => {
        if (hasInitiated.current) return;
        hasInitiated.current = true;

        const startDialing = async () => {
            try {
                // Initialize session in backend
                const res = await axiosInstance.post('/api/crm/call-sessions/', {
                    assignment: assignment.id,
                    phone_number: assignment.lead_detail?.phone || 'N/A',
                    status: 'Dialing'
                });
                setSessionId(res.data.id);

                // Simulate "Ringing" period
                setTimeout(() => {
                    setStatus('Connected');
                    startTimer();
                }, 3000);
            } catch (error) {
                console.error("Failed to initiate call session", error);
                setStatus('Failed');
            }
        };

        const startTimer = () => {
            timerRef.current = setInterval(() => {
                setTimer(prev => prev + 1);
            }, 1000);
        };

        startDialing();

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [assignment.id]);

    const handleEndCall = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setStatus('Ended');

        try {
            if (sessionId) {
                await axiosInstance.patch(`/api/crm/call-sessions/${sessionId}/`, {
                    status: 'Completed',
                    duration: timer,
                    end_time: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error("Failed to close call session", error);
        }

        // Delay slightly for UX before closing dialer
        setTimeout(() => {
            onEndCall(timer);
        }, 1500);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="live-caller-overlay">
            <style>{`
                .live-caller-overlay {
                    position: fixed;
                    bottom: 30px;
                    right: 30px;
                    width: 320px;
                    max-width: calc(100vw - 32px);
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(0, 209, 255, 0.3);
                    border-radius: 30px;
                    padding: 2rem;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.15);
                    z-index: 1000;
                    animation: slideUpCaller 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                @media (max-width: 576px) {
                    .live-caller-overlay {
                        bottom: 16px;
                        right: 16px;
                        left: 16px;
                        width: auto;
                        padding: 1.5rem;
                        border-radius: 24px;
                    }
                }

                @keyframes slideUpCaller {
                    from { transform: translateY(100%) scale(0.8); opacity: 0; }
                    to { transform: translateY(0) scale(1); opacity: 1; }
                }

                .caller-avatar {
                    width: 80px;
                    height: 80px;
                    background: linear-gradient(135deg, #00d1ff, #0076ff);
                    margin: 0 auto 1.5rem;
                    border-radius: 25px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 2rem;
                    font-weight: 900;
                    box-shadow: 0 10px 20px rgba(0, 209, 255, 0.3);
                    position: relative;
                }

                .avatar-ripple {
                    position: absolute;
                    inset: -5px;
                    border: 2px solid #00d1ff;
                    border-radius: 30px;
                    animation: rippleCaller 1.5s infinite;
                    opacity: 0;
                }

                @keyframes rippleCaller {
                    0% { transform: scale(1); opacity: 0.5; }
                    100% { transform: scale(1.4); opacity: 0; }
                }

                .caller-status {
                    text-align: center;
                    margin-bottom: 2rem;
                }

                .status-text {
                    display: block;
                    font-weight: 800;
                    color: #64748b;
                    letter-spacing: 1px;
                    font-size: 0.75rem;
                    margin-bottom: 0.5rem;
                }

                .timer-text {
                    font-size: 2.2rem;
                    font-weight: 900;
                    color: #1e293b;
                    font-family: 'Courier New', Courier, monospace;
                }

                .caller-actions {
                    display: flex;
                    justify-content: space-around;
                    align-items: center;
                }

                .action-btn {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    transition: all 0.3s;
                    cursor: pointer;
                }

                .btn-mute { background: #f1f5f9; color: #64748b; }
                .btn-mute.active { background: #fee2e2; color: #ef4444; }

                .btn-end { background: #ef4444; color: white; transform: rotate(135deg); box-shadow: 0 8px 15px rgba(239, 68, 68, 0.3); }
                .btn-end:hover { transform: rotate(135deg) scale(1.1); }

                .pulse-red { animation: pulseRed 1s infinite; }
                @keyframes pulseRed {
                    0% { transform: rotate(135deg) scale(1); }
                    50% { transform: rotate(135deg) scale(1.1); }
                    100% { transform: rotate(135deg) scale(1); }
                }
            `}</style>

            <div className="caller-avatar">
                {assignment.lead_detail?.first_name?.charAt(0) || 'L'}
                {status === 'Connected' && <div className="avatar-ripple"></div>}
            </div>

            <div className="caller-status">
                <h5 className="fw-900 m-0 text-center">{assignment.lead_detail?.first_name} {assignment.lead_detail?.last_name}</h5>
                <small className="text-secondary fw-700">{assignment.lead_detail?.phone}</small>
                
                <div className="mt-4">
                    <span className="status-text">{status.toUpperCase()}</span>
                    <span className="timer-text">{formatTime(timer)}</span>
                </div>
            </div>

            <div className="caller-actions">
                <button 
                    className={`action-btn btn-mute ${isMuted ? 'active' : ''}`}
                    onClick={() => setIsMuted(!isMuted)}
                >
                    <i className={`fa ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                </button>
                
                <button className="action-btn btn-end pulse-red" onClick={handleEndCall}>
                    <i className="fa fa-phone"></i>
                </button>

                <button className="action-btn btn-mute">
                    <i className="fa fa-pause"></i>
                </button>
            </div>
        </div>
    );
};

export default LiveCaller;
