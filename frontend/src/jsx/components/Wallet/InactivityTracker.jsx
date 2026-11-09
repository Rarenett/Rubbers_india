import React, { useEffect, useRef, useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import WalletService from '../../../services/WalletService';

const CHANNEL_NAME = 'glenda_working_inactivity_channel';

const InactivityTracker = () => {
    // Current working settings
    const [settings, setSettings] = useState({
        idle_threshold_minutes: 10,
        check_interval_seconds: 60,
        heartbeat_timeout_minutes: 15,
        inactivity_timeout_minutes: 5,
        confirmation_countdown_seconds: 30,
        break_tracking_enabled: true,
        break_start_behavior: 'Automatic',
        monitoring_enabled: true,
    });

    const [isOnBreak, setIsOnBreak] = useState(false);
    const [breakStartTime, setBreakStartTime] = useState(null);
    const [elapsedBreakSeconds, setElapsedBreakSeconds] = useState(0);
    const [resuming, setResuming] = useState(false);

    // Refs for state inside listeners & timers
    const settingsRef = useRef(settings);
    const isOnBreakRef = useRef(isOnBreak);
    const lastActivityTimeRef = useRef(Date.now());
    const isAlertOpenRef = useRef(false);
    const checkTimerRef = useRef(null);
    const statusPollTimerRef = useRef(null);
    const channelRef = useRef(null);
    const activeEventIdRef = useRef(null);
    const lastKnownStatusRef = useRef('ACTIVE');

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    useEffect(() => {
        isOnBreakRef.current = isOnBreak;
    }, [isOnBreak]);

    // Load current configuration and active session status from backend
    const loadSettingsAndSession = useCallback(async () => {
        try {
            const data = await WalletService.getWorkingSession();
            if (data?.settings) {
                setSettings(data.settings);
            }
            if (data?.active_break) {
                setIsOnBreak(true);
                setBreakStartTime(data.active_break.break_start);
            } else {
                setIsOnBreak(false);
                setBreakStartTime(null);
            }
        } catch (error) {
            // Silently fail if not authenticated or network error
        }
    }, []);

    // Broadcast messages across multiple open browser tabs
    const broadcastMessage = (type, data = {}) => {
        try {
            if (channelRef.current) {
                channelRef.current.postMessage({ type, data });
            }
            localStorage.setItem('working_channel_msg', JSON.stringify({ type, data, _ts: Date.now() }));
        } catch (e) {}
    };

    // Show SweetAlert confirmation modal: "Are you working?" with 30s countdown
    const triggerInactivityConfirmation = useCallback(async (existingPromptData = null) => {
        if (isAlertOpenRef.current || isOnBreakRef.current) return;
        if (!settingsRef.current.monitoring_enabled) return;

        isAlertOpenRef.current = true;
        broadcastMessage('ALERT_OPENED');

        let eventId = existingPromptData?.event?.id || null;
        let initialSeconds = existingPromptData?.countdown_seconds;

        // If not provided from backend, register a pending prompt with Django backend
        if (initialSeconds === undefined || initialSeconds === null) {
            try {
                const promptRes = await WalletService.triggerIdlePrompt();
                if (promptRes?.event) {
                    eventId = promptRes.event.id;
                    initialSeconds = promptRes.countdown_seconds || 30;
                }
            } catch (err) {
                console.warn('Could not register pending prompt with backend:', err);
                initialSeconds = 30;
            }
        }

        activeEventIdRef.current = eventId;
        let secondsLeft = Math.max(1, parseInt(initialSeconds || 30, 10));
        let countdownTimer = null;
        let resolvedAction = null; // 'CONFIRMED' | 'TIMEOUT'

        Swal.fire({
            title: 'Are You Working?',
            html: `
                <div style="font-size: 15px; color: #475569; margin-bottom: 18px; line-height: 1.5;">
                    We haven't detected any keyboard or mouse activity. Are you still working?
                </div>
                <div id="swal-countdown-wrapper" style="padding: 12px; background: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 10px; color: #e11d48; font-weight: 600; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fa fa-clock-o" style="font-size: 18px;"></i>
                    <span><strong id="swal-countdown-num" style="font-size: 18px; font-weight: 800;">${secondsLeft}</strong> seconds remaining.</span>
                </div>
            `,
            icon: 'question',
            showCancelButton: false,
            confirmButtonText: "Yes, I'm Working",
            confirmButtonColor: '#2563eb',
            allowOutsideClick: false,
            allowEscapeKey: false,
            customClass: {
                popup: 'shadow-lg border-0 rounded-4',
                confirmButton: 'btn btn-primary px-4 py-2 fs-6 fw-bold shadow-sm'
            },
            didOpen: () => {
                const countElem = document.getElementById('swal-countdown-num');
                countdownTimer = setInterval(() => {
                    secondsLeft -= 1;
                    if (countElem) {
                        countElem.textContent = secondsLeft;
                    }
                    if (secondsLeft <= 0) {
                        clearInterval(countdownTimer);
                        resolvedAction = 'TIMEOUT';
                        Swal.close();
                    }
                }, 1000);
            },
            willClose: () => {
                if (countdownTimer) {
                    clearInterval(countdownTimer);
                }
            }
        }).then(async (result) => {
            isAlertOpenRef.current = false;
            const currentEventId = activeEventIdRef.current;
            activeEventIdRef.current = null;

            if (result.isConfirmed) {
                // Employee clicked "Yes, I'm Working" within 30 seconds
                try {
                    const confirmRes = await WalletService.confirmWorking({
                        event_id: currentEventId,
                        prompt_time: new Date().toISOString()
                    });

                    lastActivityTimeRef.current = Date.now();
                    lastKnownStatusRef.current = 'ACTIVE';
                    broadcastMessage('ALERT_CONFIRMED');
                    try { window.dispatchEvent(new Event('workingStatusUpdated')); } catch (ev) {}

                    Swal.fire({
                        icon: 'success',
                        title: 'Activity Confirmed!',
                        text: 'Your status has been restored to ACTIVE.',
                        timer: 2000,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end'
                    });
                } catch (e) {
                    console.error('Confirmation error:', e);
                    const msg = e.response?.data?.message || 'Confirmation deadline expired.';
                    Swal.fire({
                        icon: 'warning',
                        title: 'Timed Out',
                        text: msg,
                        timer: 3000,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end'
                    });
                }
            } else if (resolvedAction === 'TIMEOUT' || result.dismiss) {
                // 30 seconds expired without employee response
                try {
                    await WalletService.submitIdleTimeout({ event_id: currentEventId });
                } catch (e) {
                    console.error('Timeout recording error:', e);
                }

                lastKnownStatusRef.current = 'IDLE';
                try { window.dispatchEvent(new Event('workingStatusUpdated')); } catch (ev) {}

                // If break tracking is enabled, trigger break
                if (settingsRef.current.break_tracking_enabled) {
                    try {
                        const res = await WalletService.startWorkingBreak({
                            source: 'INACTIVITY_TIMEOUT',
                            prompt_time: new Date().toISOString()
                        });
                        const breakObj = res?.break;
                        const startIso = breakObj?.break_start || new Date().toISOString();
                        setIsOnBreak(true);
                        setBreakStartTime(startIso);
                        broadcastMessage('BREAK_STARTED', { break_start: startIso });
                    } catch (err) {}
                }

                Swal.fire({
                    icon: 'info',
                    title: 'Status Marked IDLE',
                    text: '30-second confirmation window elapsed without response.',
                    timer: 3000,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
            }
        });
    }, []);

    // Check for any active pending confirmation from backend (handles page refreshes)
    const checkPendingIdlePrompt = useCallback(async () => {
        if (isAlertOpenRef.current || isOnBreakRef.current) return;
        if (!settingsRef.current.monitoring_enabled) return;

        try {
            const data = await WalletService.getPendingIdlePrompt();
            if (data?.has_pending && data?.countdown_seconds > 0) {
                triggerInactivityConfirmation(data);
            }
        } catch (e) {}
    }, [triggerInactivityConfirmation]);

    // Poll current working status to detect ACTIVE -> IDLE state transition from Windows agent
    const pollWorkingStatus = useCallback(async () => {
        if (isAlertOpenRef.current || isOnBreakRef.current) return;
        if (!settingsRef.current.monitoring_enabled) return;

        try {
            // First check if there is an active pending confirmation on backend
            const promptData = await WalletService.getPendingIdlePrompt();
            if (promptData?.has_pending && promptData?.countdown_seconds > 0) {
                lastKnownStatusRef.current = 'IDLE';
                triggerInactivityConfirmation(promptData);
                return;
            }

            const statusData = await WalletService.getWorkingStatus();
            if (!statusData) return;

            const currentStatus = statusData.status;

            // Trigger when status transitions from ACTIVE to IDLE
            if (lastKnownStatusRef.current === 'ACTIVE' && currentStatus === 'IDLE') {
                lastKnownStatusRef.current = 'IDLE';
                triggerInactivityConfirmation();
            } else if (currentStatus === 'ACTIVE') {
                lastKnownStatusRef.current = 'ACTIVE';
            }
        } catch (e) {}
    }, [triggerInactivityConfirmation]);

    // Fetch initial settings & check pending prompts on mount
    useEffect(() => {
        loadSettingsAndSession();
        checkPendingIdlePrompt();

        const handleSettingsUpdate = () => {
            loadSettingsAndSession();
        };

        window.addEventListener('workingSettingsChanged', handleSettingsUpdate);
        window.addEventListener('storage', (e) => {
            if (e.key === 'working_settings_updated') {
                loadSettingsAndSession();
            }
        });

        return () => {
            window.removeEventListener('workingSettingsChanged', handleSettingsUpdate);
        };
    }, [loadSettingsAndSession, checkPendingIdlePrompt]);

    // Cross-tab communication setup
    useEffect(() => {
        let channel;
        try {
            if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
                channel = new BroadcastChannel(CHANNEL_NAME);
                channelRef.current = channel;

                channel.onmessage = (event) => {
                    const { type, data } = event.data || {};
                    if (type === 'USER_ACTIVITY') {
                        lastActivityTimeRef.current = data?.time || Date.now();
                    } else if (type === 'ALERT_OPENED') {
                        isAlertOpenRef.current = true;
                    } else if (type === 'ALERT_CONFIRMED') {
                        isAlertOpenRef.current = false;
                        lastActivityTimeRef.current = Date.now();
                        lastKnownStatusRef.current = 'ACTIVE';
                        if (Swal.isVisible()) {
                            Swal.close();
                        }
                    } else if (type === 'BREAK_STARTED') {
                        isAlertOpenRef.current = false;
                        setIsOnBreak(true);
                        setBreakStartTime(data?.break_start || new Date().toISOString());
                        if (Swal.isVisible()) {
                            Swal.close();
                        }
                    } else if (type === 'BREAK_ENDED') {
                        setIsOnBreak(false);
                        setBreakStartTime(null);
                        lastActivityTimeRef.current = Date.now();
                        lastKnownStatusRef.current = 'ACTIVE';
                    }
                };
            }
        } catch (e) {
            console.warn('BroadcastChannel not supported or error:', e);
        }

        // Fallback for multi-tab sync via localStorage storage event
        const handleStorageEvent = (e) => {
            if (e.key === 'working_channel_msg' && e.newValue) {
                try {
                    const { type, data } = JSON.parse(e.newValue);
                    if (type === 'USER_ACTIVITY') {
                        lastActivityTimeRef.current = data?.time || Date.now();
                    } else if (type === 'ALERT_OPENED') {
                        isAlertOpenRef.current = true;
                    } else if (type === 'ALERT_CONFIRMED') {
                        isAlertOpenRef.current = false;
                        lastActivityTimeRef.current = Date.now();
                        lastKnownStatusRef.current = 'ACTIVE';
                        if (Swal.isVisible()) {
                            Swal.close();
                        }
                    } else if (type === 'BREAK_STARTED') {
                        isAlertOpenRef.current = false;
                        setIsOnBreak(true);
                        setBreakStartTime(data?.break_start || new Date().toISOString());
                        if (Swal.isVisible()) {
                            Swal.close();
                        }
                    } else if (type === 'BREAK_ENDED') {
                        setIsOnBreak(false);
                        setBreakStartTime(null);
                        lastActivityTimeRef.current = Date.now();
                        lastKnownStatusRef.current = 'ACTIVE';
                    }
                } catch (err) {}
            }
        };

        window.addEventListener('storage', handleStorageEvent);

        return () => {
            window.removeEventListener('storage', handleStorageEvent);
            if (channel) {
                channel.close();
            }
        };
    }, []);

    // Qualifying interaction listener (Throttled)
    useEffect(() => {
        let lastLoggedActivity = 0;

        const handleUserInteraction = () => {
            const now = Date.now();
            if (now - lastLoggedActivity > 3000) {
                lastLoggedActivity = now;
                lastActivityTimeRef.current = now;
                broadcastMessage('USER_ACTIVITY', { time: now });
            }
        };

        const qualifyingEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
        qualifyingEvents.forEach(evt => {
            window.addEventListener(evt, handleUserInteraction, { passive: true });
        });

        return () => {
            qualifyingEvents.forEach(evt => {
                window.removeEventListener(evt, handleUserInteraction);
            });
        };
    }, []);

    // Main inactivity check loop running every 1 second
    useEffect(() => {
        if (!settings.monitoring_enabled) {
            if (checkTimerRef.current) clearInterval(checkTimerRef.current);
            return;
        }

        checkTimerRef.current = setInterval(() => {
            if (isOnBreakRef.current || isAlertOpenRef.current) {
                return;
            }

            const timeoutMs = (settingsRef.current.inactivity_timeout_minutes || 5) * 60 * 1000;
            const elapsed = Date.now() - lastActivityTimeRef.current;

            if (elapsed >= timeoutMs) {
                triggerInactivityConfirmation();
            }
        }, 1000);

        return () => {
            if (checkTimerRef.current) {
                clearInterval(checkTimerRef.current);
            }
        };
    }, [settings.monitoring_enabled, triggerInactivityConfirmation]);

    // Backend status polling loop (checks every 5 seconds for status transitions from desktop agent)
    useEffect(() => {
        if (!settings.monitoring_enabled) {
            if (statusPollTimerRef.current) clearInterval(statusPollTimerRef.current);
            return;
        }

        statusPollTimerRef.current = setInterval(() => {
            pollWorkingStatus();
        }, 5000);

        return () => {
            if (statusPollTimerRef.current) {
                clearInterval(statusPollTimerRef.current);
            }
        };
    }, [settings.monitoring_enabled, pollWorkingStatus]);

    // Live elapsed timer when on break
    useEffect(() => {
        if (!isOnBreak || !breakStartTime) {
            setElapsedBreakSeconds(0);
            return;
        }

        const startMs = new Date(breakStartTime).getTime();
        const updateElapsed = () => {
            const now = Date.now();
            const diff = Math.max(0, Math.floor((now - startMs) / 1000));
            setElapsedBreakSeconds(diff);
        };

        updateElapsed();
        const interval = setInterval(updateElapsed, 1000);
        return () => clearInterval(interval);
    }, [isOnBreak, breakStartTime]);

    // Handle employee clicking "Resume Work" from floating break banner
    const handleResumeWork = async () => {
        setResuming(true);
        try {
            await WalletService.endWorkingBreak();
            setIsOnBreak(false);
            setBreakStartTime(null);
            lastActivityTimeRef.current = Date.now();
            lastKnownStatusRef.current = 'ACTIVE';
            broadcastMessage('BREAK_ENDED');

            Swal.fire({
                icon: 'success',
                title: 'Welcome Back!',
                text: 'Work resumed successfully. Inactivity monitoring is active.',
                timer: 2000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        } catch (error) {
            console.error('Error resuming work:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to resume work. Please try again.'
            });
        } finally {
            setResuming(false);
        }
    };

    // Format duration helper
    const formatDuration = (totalSeconds) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        }
        return `${minutes}m ${seconds}s`;
    };

    if (!isOnBreak) {
        return null;
    }

    return (
        <div
            id="glenda-break-floating-banner"
            style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                zIndex: 99999,
                backgroundColor: '#0f172a',
                color: '#ffffff',
                borderRadius: '14px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
                padding: '16px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: '18px',
                border: '1px solid #334155',
                animation: 'fadeIn 0.3s ease-in-out',
                maxWidth: '420px'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                    style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundColor: '#fef3c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#d97706',
                        fontSize: '18px',
                        flexShrink: 0
                    }}
                >
                    <i className="fa fa-coffee"></i>
                </div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc' }}>
                        You are currently on break
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                        Elapsed Time: <span style={{ color: '#fbbf24', fontWeight: 700 }}>{formatDuration(elapsedBreakSeconds)}</span>
                    </div>
                </div>
            </div>
            <button
                onClick={handleResumeWork}
                className="btn btn-warning btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-bold text-dark shadow-sm"
                style={{ borderRadius: '8px', flexShrink: 0, fontSize: '13px' }}
                disabled={resuming}
            >
                {resuming ? (
                    <>
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                        Resuming...
                    </>
                ) : (
                    <>
                        <i className="fa fa-play-circle fs-6"></i>
                        Resume Work
                    </>
                )}
            </button>
        </div>
    );
};

export default InactivityTracker;
