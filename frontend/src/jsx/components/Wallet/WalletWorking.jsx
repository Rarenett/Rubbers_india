import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, Form, Row, Col, Badge, Spinner, Tabs, Tab } from 'react-bootstrap';
import Swal from 'sweetalert2';
import WalletService from '../../../services/WalletService';
import { usePageTitle } from '../../../context/TitleContext';
import { useDispatch, useSelector } from 'react-redux';
import { navtoggle } from '../../../store/actions/AuthActions';
import Pagination from '../Common/Pagination';
import EditButton from '../../../components/permissions/EditButton';

const WalletWorking = () => {
    usePageTitle("Working");
    const dispatch = useDispatch();
    const sideMenu = useSelector(state => state.sideMenu);
    const sideMenuRef = useRef(sideMenu);

    useEffect(() => {
        sideMenuRef.current = sideMenu;
    }, [sideMenu]);

    useEffect(() => {
        if (window.innerWidth <= 1199 && sideMenuRef.current) {
            dispatch(navtoggle());
        }
    }, [dispatch]);

    // Active View Tab: 'idle_status' (Desktop Tracking) or 'browser_breaks' (Browser Breaks)
    const [activeTab, setActiveTab] = useState('idle_status');

    // ==========================================
    // 1. Settings State
    // ==========================================
    const [settings, setSettings] = useState({
        idle_threshold_minutes: 10,
        check_interval_seconds: 60,
        heartbeat_timeout_minutes: 15,
        inactivity_timeout_minutes: 5,
        confirmation_countdown_seconds: 30,
        break_tracking_enabled: true,
        break_start_behavior: 'Automatic',
        monitoring_enabled: true,
        updated_by_name: null,
        updated_at: null,
    });
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);

    // ==========================================
    // 2. Idle Status Tracker State
    // ==========================================
    const [statusData, setStatusData] = useState(null);
    const [statusLoading, setStatusLoading] = useState(false);
    const [historyList, setHistoryList] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyCount, setHistoryCount] = useState(0);
    const [historyPage, setHistoryPage] = useState(1);
    const historyPageSize = 10;
    const [historySearch, setHistorySearch] = useState('');
    const [historyStatusFilter, setHistoryStatusFilter] = useState('All');
    const [historyFromDate, setHistoryFromDate] = useState('');
    const [historyToDate, setHistoryToDate] = useState('');

    // ==========================================
    // 3. Browser Breaks State
    // ==========================================
    const [sessionData, setSessionData] = useState(null);
    const [activeBreak, setActiveBreak] = useState(null);
    const [resumingBreak, setResumingBreak] = useState(false);
    const [elapsedBreakSeconds, setElapsedBreakSeconds] = useState(0);
    const [breaks, setBreaks] = useState([]);
    const [breaksLoading, setBreaksLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [sourceFilter, setSourceFilter] = useState('All');
    const [breaksPage, setBreaksPage] = useState(1);
    const breaksPageSize = 10;

    // Format datetime string
    const formatDateTime = (dtStr) => {
        if (!dtStr) return '-';
        try {
            const d = new Date(dtStr);
            return d.toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        } catch (e) {
            return dtStr;
        }
    };

    // Format seconds into HH:MM:SS or MM:SS
    const formatDuration = (totalSeconds) => {
        if (totalSeconds === null || totalSeconds === undefined) return '-';
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        }
        return `${minutes}m ${seconds}s`;
    };

    // ------------------------------------------
    // API: Fetch Current Idle Tracker Status
    // ------------------------------------------
    const fetchCurrentStatus = useCallback(async () => {
        setStatusLoading(true);
        try {
            const data = await WalletService.getWorkingStatus();
            if (data) {
                setStatusData(data);
            }
        } catch (error) {
            console.error('Error fetching working status:', error);
        } finally {
            setStatusLoading(false);
        }
    }, []);

    // ------------------------------------------
    // API: Fetch Idle Status History
    // ------------------------------------------
    const fetchStatusHistory = useCallback(async (page = historyPage) => {
        setHistoryLoading(true);
        try {
            const params = {
                page: page,
                page_size: historyPageSize,
            };
            if (historyStatusFilter !== 'All') params.status = historyStatusFilter;
            if (historySearch) params.search = historySearch;
            if (historyFromDate) params.from_date = historyFromDate;
            if (historyToDate) params.to_date = historyToDate;

            const res = await WalletService.getWorkingHistory(params);
            if (res?.results) {
                setHistoryList(res.results);
                setHistoryCount(res.count || 0);
            } else if (Array.isArray(res)) {
                setHistoryList(res);
                setHistoryCount(res.length);
            }
        } catch (error) {
            console.error('Error fetching working history:', error);
        } finally {
            setHistoryLoading(false);
        }
    }, [historyPage, historyStatusFilter, historySearch, historyFromDate, historyToDate]);

    // ------------------------------------------
    // API: Fetch Settings & Browser Session
    // ------------------------------------------
    const fetchSessionAndSettings = useCallback(async () => {
        setSettingsLoading(true);
        try {
            const data = await WalletService.getWorkingSession();
            if (data?.settings) {
                setSettings(prev => ({
                    ...prev,
                    ...data.settings,
                    idle_threshold_minutes: data.settings.idle_threshold_minutes ?? 10,
                    check_interval_seconds: data.settings.check_interval_seconds ?? 60,
                    heartbeat_timeout_minutes: data.settings.heartbeat_timeout_minutes ?? 15,
                }));
            }
            if (data?.session) {
                setSessionData(data.session);
            }
            setActiveBreak(data?.active_break || null);
        } catch (error) {
            console.error('Error fetching working session and settings:', error);
        } finally {
            setSettingsLoading(false);
        }
    }, []);

    // ------------------------------------------
    // API: Fetch Browser Breaks History
    // ------------------------------------------
    const fetchBreaks = useCallback(async () => {
        setBreaksLoading(true);
        try {
            const params = {};
            if (statusFilter !== 'All') params.status = statusFilter;
            if (sourceFilter !== 'All') params.source = sourceFilter;
            const data = await WalletService.getWorkingBreaks(params);
            setBreaks(Array.isArray(data) ? data : (data?.results || []));
        } catch (error) {
            console.error('Error fetching breaks history:', error);
        } finally {
            setBreaksLoading(false);
        }
    }, [statusFilter, sourceFilter]);

    // Initial and periodic fetch
    useEffect(() => {
        fetchSessionAndSettings();
        fetchCurrentStatus();
        fetchStatusHistory(1);
        fetchBreaks();
    }, [fetchSessionAndSettings, fetchCurrentStatus, fetchBreaks]);

    // Polling current status every 5s to keep UI alive with desktop agent changes
    useEffect(() => {
        const interval = setInterval(() => {
            fetchCurrentStatus();
        }, 5000);
        return () => clearInterval(interval);
    }, [fetchCurrentStatus]);

    // Listen to confirmation events to instantly update Working status UI
    useEffect(() => {
        const handleStatusEvent = () => {
            fetchCurrentStatus();
            fetchStatusHistory(historyPage);
        };
        window.addEventListener('workingStatusUpdated', handleStatusEvent);
        return () => window.removeEventListener('workingStatusUpdated', handleStatusEvent);
    }, [fetchCurrentStatus, fetchStatusHistory, historyPage]);

    // Trigger history refresh when filter changes
    useEffect(() => {
        fetchStatusHistory(historyPage);
    }, [fetchStatusHistory, historyPage]);

    // Elapsed timer for active break
    useEffect(() => {
        if (!activeBreak || !activeBreak.break_start) {
            setElapsedBreakSeconds(0);
            return;
        }
        const startMs = new Date(activeBreak.break_start).getTime();
        const updateElapsed = () => {
            const now = Date.now();
            const diff = Math.max(0, Math.floor((now - startMs) / 1000));
            setElapsedBreakSeconds(diff);
        };
        updateElapsed();
        const interval = setInterval(updateElapsed, 1000);
        return () => clearInterval(interval);
    }, [activeBreak]);

    // Save Settings
    const handleSaveSettings = async (e) => {
        e.preventDefault();

        const idleThreshold = parseInt(settings.idle_threshold_minutes, 10);
        const checkInterval = parseInt(settings.check_interval_seconds, 10);
        const heartbeatTimeout = parseInt(settings.heartbeat_timeout_minutes, 10);
        const timeout = parseInt(settings.inactivity_timeout_minutes, 10);
        const countdown = parseInt(settings.confirmation_countdown_seconds, 10);

        if (isNaN(idleThreshold) || idleThreshold < 1) {
            Swal.fire({ icon: 'warning', title: 'Invalid Idle Threshold', text: 'Idle threshold must be at least 1 minute.' });
            return;
        }
        if (isNaN(checkInterval) || checkInterval < 5) {
            Swal.fire({ icon: 'warning', title: 'Invalid Check Interval', text: 'Check interval must be at least 5 seconds.' });
            return;
        }
        if (isNaN(heartbeatTimeout) || heartbeatTimeout < 1) {
            Swal.fire({ icon: 'warning', title: 'Invalid Heartbeat Timeout', text: 'Heartbeat timeout must be at least 1 minute.' });
            return;
        }

        setSettingsSaving(true);
        try {
            const payload = {
                idle_threshold_minutes: idleThreshold,
                check_interval_seconds: checkInterval,
                heartbeat_timeout_minutes: heartbeatTimeout,
                inactivity_timeout_minutes: isNaN(timeout) ? 5 : timeout,
                confirmation_countdown_seconds: isNaN(countdown) ? 30 : countdown,
                break_tracking_enabled: Boolean(settings.break_tracking_enabled),
                break_start_behavior: settings.break_start_behavior || 'Automatic',
                monitoring_enabled: Boolean(settings.monitoring_enabled),
            };

            const res = await WalletService.updateWorkingSettings(payload);
            if (res?.settings) {
                setSettings(prev => ({ ...prev, ...res.settings }));
            }
            Swal.fire({
                icon: 'success',
                title: 'Settings Saved',
                text: 'Working idle tracker and monitoring settings updated successfully.',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Error updating working settings:', error);
            const msg = error.response?.data?.error || error.response?.data?.detail || 'Failed to update working settings.';
            Swal.fire({ icon: 'error', title: 'Error', text: typeof msg === 'object' ? JSON.stringify(msg) : msg });
        } finally {
            setSettingsSaving(false);
        }
    };

    // Per-break threshold inline edit state
    const [editingBreakId, setEditingBreakId] = useState(null);
    const [editingThresholdVal, setEditingThresholdVal] = useState('');
    const [savingBreakThreshold, setSavingBreakThreshold] = useState(false);

    // Start editing threshold for a specific employee break
    const handleStartEditThreshold = (item) => {
        setEditingBreakId(item.id);
        setEditingThresholdVal(item.threshold_minutes ?? settings.idle_threshold_minutes ?? 10);
    };

    // Cancel editing
    const handleCancelEditThreshold = () => {
        setEditingBreakId(null);
        setEditingThresholdVal('');
    };

    // Save individual employee break threshold
    const handleSaveBreakThreshold = async (item) => {
        const val = parseInt(editingThresholdVal, 10);
        if (isNaN(val) || val < 1) {
            Swal.fire({
                icon: 'warning',
                title: 'Invalid Threshold',
                text: 'Threshold must be at least 1 minute.'
            });
            return;
        }

        setSavingBreakThreshold(true);
        try {
            await WalletService.updateBreakThreshold(item.id, val);

            // Update only this break in the local state without altering the global settings or other employees
            setBreaks(prevBreaks => prevBreaks.map(b => {
                if (b.id === item.id) {
                    return { ...b, threshold_minutes: val };
                }
                return b;
            }));

            setEditingBreakId(null);
            setEditingThresholdVal('');

            Swal.fire({
                icon: 'success',
                title: 'Threshold Updated',
                text: `Threshold for ${item.user_name || item.user_email || 'employee'} set to ${val} min. Global settings remain unchanged.`,
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Error updating employee threshold:', error);
            Swal.fire({
                icon: 'error',
                title: 'Update Failed',
                text: error.response?.data?.error || 'Failed to update threshold for this employee.'
            });
        } finally {
            setSavingBreakThreshold(false);
        }
    };

    // End Break / Resume Work
    const handleResumeWork = async () => {
        setResumingBreak(true);
        try {
            const res = await WalletService.endWorkingBreak();
            setActiveBreak(null);
            if (sessionData) {
                setSessionData(prev => ({ ...prev, status: 'Active' }));
            }
            fetchBreaks();
            Swal.fire({
                icon: 'success',
                title: 'Welcome Back!',
                text: res?.message || 'Break ended. Work resumed successfully.',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Error ending break:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.response?.data?.message || 'Failed to end break.'
            });
        } finally {
            setResumingBreak(false);
        }
    };

    // Filter browser breaks
    const filteredBreaks = useMemo(() => {
        return breaks.filter(item => {
            const matchesSearch = !searchTerm ||
                (item.user_name && item.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.user_email && item.user_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.break_source && item.break_source.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
            const matchesSource = sourceFilter === 'All' || item.break_source === sourceFilter;
            return matchesSearch && matchesStatus && matchesSource;
        });
    }, [breaks, searchTerm, statusFilter, sourceFilter]);

    const totalBreaksRecords = filteredBreaks.length;
    const totalBreaksPages = Math.ceil(totalBreaksRecords / breaksPageSize) || 1;
    const currentBreaks = filteredBreaks.slice((breaksPage - 1) * breaksPageSize, breaksPage * breaksPageSize);

    const historyTotalPages = Math.ceil(historyCount / historyPageSize) || 1;

    const isOnline = statusData?.is_online;
    const currentStatus = statusData?.status || 'ACTIVE';

    return (
        <div className="container-fluid p-0">
            {/* Header with Title and Back button */}
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
                <div>
                    <h3 className="text-primary fw-bold mb-1">Working (Idle Status Tracker)</h3>
                    <p className="text-muted small mb-0">
                        Tracks employee desktop keyboard and mouse inactivity in the background via Windows agent.
                    </p>
                </div>
                <button
                    onClick={() => window.history.back()}
                    className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2"
                    style={{ borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>

            {/* Current Status Overview Cards */}
            <div className="row g-3 mb-4">
                {/* Employee & Activity Card */}
                <div className="col-12 col-md-6 col-lg-3">
                    <Card className="h-100 border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                        <Card.Body className="p-3">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="text-muted small fw-semibold text-uppercase">Tracking Employee</span>
                                <i className="fa fa-user text-primary fs-5"></i>
                            </div>
                            <h5 className="fw-bold mb-1 text-truncate">
                                {statusData?.user_name || 'Current User'}
                            </h5>
                            <div className="text-muted small text-truncate">
                                {statusData?.user_email || 'Desktop Monitoring Session'}
                            </div>
                        </Card.Body>
                    </Card>
                </div>

                {/* Status Indicator Card (ACTIVE vs IDLE) */}
                <div className="col-12 col-md-6 col-lg-3">
                    <Card 
                        className="h-100 border-0 shadow-sm" 
                        style={{ 
                            borderRadius: '12px',
                            backgroundColor: currentStatus === 'ACTIVE' ? '#f0fdf4' : '#fffbeb',
                            borderLeft: `4px solid ${currentStatus === 'ACTIVE' ? '#16a34a' : '#d97706'}`
                        }}
                    >
                        <Card.Body className="p-3">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="text-muted small fw-semibold text-uppercase">Inactivity Status</span>
                                <i className={currentStatus === 'ACTIVE' ? "fa fa-keyboard-o text-success fs-5" : "fa fa-moon-o text-warning fs-5"}></i>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <span 
                                    className="badge px-3 py-2 fs-6 text-uppercase"
                                    style={{
                                        backgroundColor: currentStatus === 'ACTIVE' ? '#16a34a' : '#d97706',
                                        color: '#ffffff'
                                    }}
                                >
                                    {currentStatus}
                                </span>
                            </div>
                            <div className="text-muted small mt-2">
                                Status Changed: <strong>{formatDateTime(statusData?.last_change)}</strong>
                            </div>
                        </Card.Body>
                    </Card>
                </div>

                {/* Last Activity Card */}
                <div className="col-12 col-md-6 col-lg-3">
                    <Card className="h-100 border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                        <Card.Body className="p-3">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="text-muted small fw-semibold text-uppercase">Last User Input</span>
                                <i className="fa fa-mouse-pointer text-info fs-5"></i>
                            </div>
                            <h6 className="fw-bold mb-1 text-dark">
                                {formatDateTime(statusData?.last_activity_at)}
                            </h6>
                            <div className="text-muted small">
                                Threshold: <strong>{settings.idle_threshold_minutes} min</strong> | Interval: <strong>{settings.check_interval_seconds}s</strong>
                            </div>
                        </Card.Body>
                    </Card>
                </div>

                {/* Windows Agent Connection Card */}
                <div className="col-12 col-md-6 col-lg-3">
                    <Card 
                        className="h-100 border-0 shadow-sm" 
                        style={{ 
                            borderRadius: '12px',
                            backgroundColor: isOnline ? '#f0f9ff' : '#fef2f2',
                            borderLeft: `4px solid ${isOnline ? '#0284c7' : '#dc2626'}`
                        }}
                    >
                        <Card.Body className="p-3">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="text-muted small fw-semibold text-uppercase">Agent Connection</span>
                                <i className={`fa fa-circle ${isOnline ? 'text-success' : 'text-danger'}`}></i>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <Badge bg={isOnline ? 'info' : 'danger'} className="px-2 py-1 fs-6">
                                    {statusData?.connection_status || (isOnline ? 'ONLINE' : 'OFFLINE')}
                                </Badge>
                                {statusData?.device_identifier && (
                                    <span className="text-muted small text-truncate" title={statusData.device_identifier}>
                                        <i className="fa fa-desktop me-1"></i>{statusData.device_identifier}
                                    </span>
                                )}
                            </div>
                            <div className="text-muted small mt-2">
                                Last Heartbeat: <strong>{formatDateTime(statusData?.last_heartbeat_at)}</strong>
                            </div>
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Configurable Settings Section */}
            <div className="row mb-4">
                <div className="col-12">
                    <Card className="shadow-sm border-0" style={{ borderRadius: '12px' }}>
                        <Card.Header className="bg-transparent border-bottom d-flex justify-content-between align-items-center py-3">
                            <div className="d-flex align-items-center gap-2">
                                <i className="fa fa-sliders text-primary fs-5"></i>
                                <h5 className="mb-0 fw-bold">Inactivity & Tracker Settings</h5>
                            </div>
                            {settings.updated_at && (
                                <span className="text-muted small">
                                    Last updated {settings.updated_by_name ? `by ${settings.updated_by_name}` : ''} on {formatDateTime(settings.updated_at)}
                                </span>
                            )}
                        </Card.Header>
                        <Card.Body className="p-4">
                            {settingsLoading ? (
                                <div className="text-center py-3">
                                    <Spinner animation="border" variant="primary" />
                                    <p className="text-muted small mt-2">Loading settings...</p>
                                </div>
                            ) : (
                                <Form onSubmit={handleSaveSettings}>
                                    <Row className="g-3">
                                        {/* Field 1: Idle Threshold */}
                                        <Col md={6} lg={3}>
                                            <Form.Group>
                                                <Form.Label className="fw-semibold">
                                                    Idle Threshold (Minutes) <span className="text-danger">*</span>
                                                </Form.Label>
                                                <Form.Control
                                                    type="number"
                                                    min="1"
                                                    max="1440"
                                                    value={settings.idle_threshold_minutes}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, idle_threshold_minutes: e.target.value }))}
                                                    required
                                                />
                                                <Form.Text className="text-muted small">
                                                    Inactivity duration before status switches to IDLE (default: 10 min).
                                                </Form.Text>
                                            </Form.Group>
                                        </Col>

                                        {/* Field 2: Check Interval */}
                                        <Col md={6} lg={3}>
                                            <Form.Group>
                                                <Form.Label className="fw-semibold">
                                                    Check Interval (Seconds) <span className="text-danger">*</span>
                                                </Form.Label>
                                                <Form.Control
                                                    type="number"
                                                    min="5"
                                                    max="3600"
                                                    value={settings.check_interval_seconds}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, check_interval_seconds: e.target.value }))}
                                                    required
                                                />
                                                <Form.Text className="text-muted small">
                                                    Frequency Windows agent checks input activity (default: 60s).
                                                </Form.Text>
                                            </Form.Group>
                                        </Col>

                                        {/* Field 3: Heartbeat Timeout */}
                                        <Col md={6} lg={3}>
                                            <Form.Group>
                                                <Form.Label className="fw-semibold">
                                                    Heartbeat Timeout (Minutes) <span className="text-danger">*</span>
                                                </Form.Label>
                                                <Form.Control
                                                    type="number"
                                                    min="1"
                                                    max="1440"
                                                    value={settings.heartbeat_timeout_minutes}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, heartbeat_timeout_minutes: e.target.value }))}
                                                    required
                                                />
                                                <Form.Text className="text-muted small">
                                                    Timeout to report agent connection OFFLINE (default: 15 min).
                                                </Form.Text>
                                            </Form.Group>
                                        </Col>

                                        {/* Field 4: Monitoring Status */}
                                        <Col md={6} lg={3}>
                                            <Form.Group>
                                                <Form.Label className="fw-semibold">
                                                    Monitoring Status <span className="text-danger">*</span>
                                                </Form.Label>
                                                <Form.Select
                                                    value={settings.monitoring_enabled ? 'true' : 'false'}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, monitoring_enabled: e.target.value === 'true' }))}
                                                >
                                                    <option value="true">Enabled</option>
                                                    <option value="false">Disabled</option>
                                                </Form.Select>
                                                <Form.Text className="text-muted small">
                                                    Enable or disable desktop activity status tracking.
                                                </Form.Text>
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    <div className="d-flex justify-content-end gap-2 mt-3 pt-3 border-top">
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary btn-sm px-3"
                                            onClick={() => {
                                                setSettings(prev => ({
                                                    ...prev,
                                                    idle_threshold_minutes: 10,
                                                    check_interval_seconds: 60,
                                                    heartbeat_timeout_minutes: 15,
                                                    monitoring_enabled: true,
                                                }));
                                            }}
                                        >
                                            Reset Defaults
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn btn-primary btn-sm px-4 d-flex align-items-center gap-2"
                                            disabled={settingsSaving}
                                        >
                                            {settingsSaving ? (
                                                <>
                                                    <Spinner animation="border" size="sm" />
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fa fa-save"></i>
                                                    Save Settings
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </Form>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Navigation Tabs: Idle Status History vs Browser Breaks */}
            <Tabs
                activeKey={activeTab}
                onSelect={(k) => setActiveTab(k)}
                className="mb-3 custom-tab"
                id="working-tabs"
            >
                <Tab eventKey="idle_status" title={<span><i className="fa fa-clock-o me-2"></i>Desktop Idle Status History</span>}>
                    {/* Status History Table */}
                    <Card className="shadow-sm border-0" style={{ borderRadius: '12px' }}>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-3 py-3">
                            <div className="d-flex align-items-center gap-2">
                                <i className="fa fa-history text-primary fs-5"></i>
                                <Card.Title className="mb-0 fw-bold">Activity Status Transitions (ACTIVE / IDLE)</Card.Title>
                            </div>
                            <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1 justify-content-end">
                                <div style={{ minWidth: '160px', maxWidth: '240px' }}>
                                    <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        placeholder="Search employee or device..."
                                        value={historySearch}
                                        onChange={(e) => setHistorySearch(e.target.value)}
                                    />
                                </div>
                                <Form.Select
                                    style={{ width: '130px', height: '36px', fontSize: '13px' }}
                                    value={historyStatusFilter}
                                    onChange={(e) => setHistoryStatusFilter(e.target.value)}
                                    className="form-control form-control-sm"
                                >
                                    <option value="All">All Status</option>
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="IDLE">IDLE</option>
                                </Form.Select>
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    style={{ width: '140px', height: '36px', fontSize: '13px' }}
                                    value={historyFromDate}
                                    onChange={(e) => setHistoryFromDate(e.target.value)}
                                    title="From Date"
                                />
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    style={{ width: '140px', height: '36px', fontSize: '13px' }}
                                    value={historyToDate}
                                    onChange={(e) => setHistoryToDate(e.target.value)}
                                    title="To Date"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        fetchCurrentStatus();
                                        fetchStatusHistory(historyPage);
                                    }}
                                    className="btn btn-outline-primary btn-sm d-flex align-items-center justify-content-center"
                                    style={{ width: '36px', height: '36px', borderRadius: '6px' }}
                                    title="Refresh History"
                                >
                                    <i className={`fa fa-sync-alt ${historyLoading ? 'fa-spin' : ''}`}></i>
                                </button>
                            </div>
                        </Card.Header>
                        <Card.Body className="p-0">
                            {historyLoading ? (
                                <div className="text-center py-5">
                                    <Spinner animation="border" variant="primary" />
                                    <p className="text-muted small mt-2">Loading status transitions...</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-hover table-striped mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th className="px-3"><strong>SL.NO</strong></th>
                                                <th><strong>EMPLOYEE</strong></th>
                                                <th><strong>STATUS</strong></th>
                                                <th><strong>STATUS CHANGED AT</strong></th>
                                                <th><strong>LAST ACTIVITY</strong></th>
                                                <th><strong>DEVICE / AGENT STATUS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historyList.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="text-center py-4 text-muted">
                                                        No status transitions recorded yet. The agent logs history only when status changes between ACTIVE and IDLE.
                                                    </td>
                                                </tr>
                                            ) : (
                                                historyList.map((item, index) => (
                                                    <tr key={item.id}>
                                                        <td className="px-3">{(historyPage - 1) * historyPageSize + index + 1}</td>
                                                        <td>
                                                            <strong>{item.user_name || item.user_email || 'Employee'}</strong>
                                                            {item.user_email && <div className="text-muted small">{item.user_email}</div>}
                                                        </td>
                                                        <td>
                                                            <span 
                                                                className="badge px-3 py-1"
                                                                style={{
                                                                    backgroundColor: item.status === 'ACTIVE' ? '#16a34a' : '#d97706',
                                                                    color: '#fff',
                                                                    fontWeight: '600'
                                                                }}
                                                            >
                                                                {item.status}
                                                            </span>
                                                        </td>
                                                        <td>{formatDateTime(item.changed_at)}</td>
                                                        <td>{formatDateTime(item.last_activity_at)}</td>
                                                        <td>
                                                            <span className="text-muted small">
                                                                <i className="fa fa-desktop me-1"></i>{item.device_identifier || 'Default Desktop'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pagination */}
                            {historyCount > historyPageSize && (
                                <div className="p-3 border-top">
                                    <Pagination
                                        currentPage={historyPage}
                                        totalPages={historyTotalPages}
                                        onPageChange={setHistoryPage}
                                    />
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Tab>

                <Tab eventKey="browser_breaks" title={<span><i className="fa fa-coffee me-2"></i>Browser Inactivity Breaks</span>}>
                    {/* Browser Breaks Card */}
                    <Card className="shadow-sm border-0" style={{ borderRadius: '12px' }}>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-3 py-3">
                            <div className="d-flex align-items-center gap-2">
                                <i className="fa fa-list text-primary fs-5"></i>
                                <Card.Title className="mb-0 fw-bold">Browser Inactivity Breaks & Prompts</Card.Title>
                            </div>
                            <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1 justify-content-end">
                                <div style={{ minWidth: '160px', maxWidth: '240px' }}>
                                    <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        placeholder="Search employee..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Form.Select
                                    style={{ width: '130px', height: '36px', fontSize: '13px' }}
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="form-control form-control-sm"
                                >
                                    <option value="All">All Status</option>
                                    <option value="Active">Active</option>
                                    <option value="Completed">Completed</option>
                                </Form.Select>
                                <button
                                    type="button"
                                    onClick={fetchBreaks}
                                    className="btn btn-outline-primary btn-sm d-flex align-items-center justify-content-center"
                                    style={{ width: '36px', height: '36px', borderRadius: '6px' }}
                                    title="Refresh Breaks"
                                >
                                    <i className={`fa fa-sync-alt ${breaksLoading ? 'fa-spin' : ''}`}></i>
                                </button>
                            </div>
                        </Card.Header>
                        <Card.Body className="p-0">
                            {breaksLoading ? (
                                <div className="text-center py-5">
                                    <Spinner animation="border" variant="primary" />
                                    <p className="text-muted small mt-2">Loading break history...</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-hover table-striped mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th className="px-3"><strong>#</strong></th>
                                                <th><strong>EMPLOYEE</strong></th>
                                                <th><strong>THRESHOLD</strong></th>
                                                <th><strong>DURATION</strong></th>
                                                <th><strong>STATUS</strong></th>
                                                <th className="text-center"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentBreaks.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="text-center py-4 text-muted">
                                                        No break history records found.
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentBreaks.map((item, index) => {
                                                    const isEditing = editingBreakId === item.id;
                                                    const currentThreshold = item.threshold_minutes ?? settings.idle_threshold_minutes ?? 10;

                                                    return (
                                                        <tr key={item.id}>
                                                            <td className="px-3">{(breaksPage - 1) * breaksPageSize + index + 1}</td>
                                                            <td>
                                                                <strong>{item.user_name || item.user_email || 'Employee'}</strong>
                                                                {item.user_email && <div className="text-muted small">{item.user_email}</div>}
                                                            </td>
                                                            <td>
                                                                {isEditing ? (
                                                                    <div className="input-group input-group-sm" style={{ maxWidth: '140px' }}>
                                                                        <input
                                                                            type="number"
                                                                            min="1"
                                                                            max="1440"
                                                                            className="form-control text-center fw-bold border-primary"
                                                                            value={editingThresholdVal}
                                                                            onChange={(e) => setEditingThresholdVal(e.target.value)}
                                                                            autoFocus
                                                                        />
                                                                        <span className="input-group-text bg-primary text-white small px-2">Min</span>
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ maxWidth: '130px' }}>
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-sm text-center fw-semibold bg-light"
                                                                            value={`${currentThreshold} Min`}
                                                                            readOnly
                                                                            title={`Threshold for ${item.user_name || 'employee'}`}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <strong className={item.status === 'Active' ? 'text-danger' : 'text-dark'}>
                                                                    {item.status === 'Active' ? formatDuration(elapsedBreakSeconds) : formatDuration(item.duration_seconds)}
                                                                </strong>
                                                            </td>
                                                            <td>
                                                                <Badge bg={item.status === 'Active' ? 'warning' : 'success'}>
                                                                    {item.status}
                                                                </Badge>
                                                            </td>
                                                            <td className="text-center">
                                                                {isEditing ? (
                                                                    <div className="d-flex align-items-center justify-content-center gap-1">
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-sm btn-success px-2 py-1"
                                                                            onClick={() => handleSaveBreakThreshold(item)}
                                                                            disabled={savingBreakThreshold}
                                                                            title="Save threshold"
                                                                        >
                                                                            {savingBreakThreshold ? (
                                                                                <Spinner size="sm" animation="border" />
                                                                            ) : (
                                                                                <i className="fa fa-check"></i>
                                                                            )}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-sm btn-outline-secondary px-2 py-1"
                                                                            onClick={handleCancelEditThreshold}
                                                                            disabled={savingBreakThreshold}
                                                                            title="Cancel"
                                                                        >
                                                                            <i className="fa fa-times"></i>
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="d-flex justify-content-center align-items-center">
                                                                        <EditButton
                                                                            module="wallet_working"
                                                                            onClick={() => handleStartEditThreshold(item)}
                                                                            title="Edit Threshold"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {totalBreaksRecords > breaksPageSize && (
                                <div className="p-3 border-top">
                                    <Pagination
                                        currentPage={breaksPage}
                                        totalPages={totalBreaksPages}
                                        onPageChange={setBreaksPage}
                                    />
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Tab>
            </Tabs>
        </div>
    );
};

export default WalletWorking;
