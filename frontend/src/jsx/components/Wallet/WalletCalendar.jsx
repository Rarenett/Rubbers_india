import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, Modal, Form, Badge, Spinner, Button, Row, Col } from 'react-bootstrap';
import Swal from 'sweetalert2';
import WalletService from '../../../services/WalletService';
import { usePageTitle } from '../../../context/TitleContext';
import { useDispatch, useSelector } from 'react-redux';
import { navtoggle } from '../../../store/actions/AuthActions';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const STATUS_CONFIG = {
    'Captured': {
        color: '#15803d',
        bgColor: '#dcfce7',
        borderColor: '#bbf7d0',
        icon: 'fa fa-check-circle',
        label: 'Captured'
    },
    'Scheduled': {
        color: '#1d4ed8',
        bgColor: '#dbeafe',
        borderColor: '#bfdbfe',
        icon: 'fa fa-clock-o',
        label: 'Scheduled'
    },
   
    'Missed': {
        color: '#be123c',
        bgColor: '#ffe4e6',
        borderColor: '#fecdd3',
        icon: 'fa fa-times-circle',
        label: 'Missed'
    }
};

const WalletCalendar = () => {
    usePageTitle("Calendar");
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

    // Current date state
    const today = useMemo(() => new Date(), []);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1-12

    // Schedules state
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(false);

    // Selected date & panel state
    const [selectedDateStr, setSelectedDateStr] = useState(() => {
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    });
    const [showDateModal, setShowDateModal] = useState(false);

    // Add / Edit modal state
    const [showAddEditModal, setShowAddEditModal] = useState(false);
    const [editScheduleId, setEditScheduleId] = useState(null);
    const [scheduleTime, setScheduleTime] = useState('10:00');
    const [modalDate, setModalDate] = useState('');
    const [savingSchedule, setSavingSchedule] = useState(false);

    // Apply All modal state
    const [showApplyAllModal, setShowApplyAllModal] = useState(false);
    const [applyScope, setApplyScope] = useState('month');
    const [applyConflictMode, setApplyConflictMode] = useState('merge');
    const [applyingAll, setApplyingAll] = useState(false);

    // Screenshot preview modal state
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewExecution, setPreviewExecution] = useState(null);

    // Desktop Agent Online Status state & Setup modal
    const [agentStatus, setAgentStatus] = useState({ is_online: false, agent_info: null });
    const [showAgentSetupModal, setShowAgentSetupModal] = useState(false);

    // Check missed schedules periodically / on navigation
    useEffect(() => {
        WalletService.checkMissedSchedules().catch(() => {});
    }, [currentMonth, currentYear]);

    // Poll Desktop Agent Online Status (every 12 seconds)
    useEffect(() => {
        let isMounted = true;
        const checkAgent = async () => {
            try {
                const res = await WalletService.getAgentStatus();
                if (isMounted && res) {
                    setAgentStatus(res);
                }
            } catch (e) {
                // ignore
            }
        };
        checkAgent();
        const interval = setInterval(checkAgent, 12000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    // Fetch schedules for current month & year
    const fetchSchedules = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await WalletService.getCalendarSchedules({
                year: currentYear,
                month: currentMonth
            });
            setSchedules(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching calendar schedules:', error);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [currentYear, currentMonth]);

    useEffect(() => {
        fetchSchedules(false);
        const interval = setInterval(() => {
            fetchSchedules(true);
        }, 8000);
        return () => clearInterval(interval);
    }, [fetchSchedules]);


    // Format 24-hr time string (HH:MM:SS or HH:MM) to 12-hr AM/PM
    const formatTime12h = useCallback((timeStr) => {
        if (!timeStr) return '';
        const parts = timeStr.split(':');
        let hours = parseInt(parts[0], 10);
        const minutes = parts[1] || '00';
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // '0' should be '12'
        return `${hours}:${minutes} ${ampm}`;
    }, []);

    // Format YYYY-MM-DD to readable date
    const formatDateDisplay = useCallback((dateStr) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
        const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const monthName = MONTH_NAMES[parseInt(m, 10) - 1];
        return `${d} ${monthName} ${y} (${dayOfWeek})`;
    }, []);

    // Group schedules by scheduled_date
    const schedulesByDate = useMemo(() => {
        const map = {};
        schedules.forEach(item => {
            const d = item.scheduled_date;
            if (!map[d]) map[d] = [];
            map[d].push(item);
        });
        // Sort times chronologically in each date
        Object.keys(map).forEach(d => {
            map[d].sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
        });
        return map;
    }, [schedules]);

    // Selected date schedules
    const selectedDateSchedules = useMemo(() => {
        return schedulesByDate[selectedDateStr] || [];
    }, [schedulesByDate, selectedDateStr]);

    // Month Navigation
    const handlePrevMonth = () => {
        if (currentMonth === 1) {
            setCurrentMonth(12);
            setCurrentYear(prev => prev - 1);
        } else {
            setCurrentMonth(prev => prev - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 12) {
            setCurrentMonth(1);
            setCurrentYear(prev => prev + 1);
        } else {
            setCurrentMonth(prev => prev + 1);
        }
    };

    const handleTodayJump = () => {
        const now = new Date();
        setCurrentYear(now.getFullYear());
        setCurrentMonth(now.getMonth() + 1);
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        setSelectedDateStr(`${y}-${m}-${d}`);
    };

    // Calendar grid calculation (7 columns, Monday to Sunday)
    const calendarDays = useMemo(() => {
        const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

        // JS getDay(): 0 is Sunday, 1 is Monday... convert so Monday is 0, Sunday is 6
        let startDayIndex = firstDayOfMonth.getDay() - 1;
        if (startDayIndex === -1) startDayIndex = 6;

        const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();
        const totalSlots = Math.ceil((startDayIndex + daysInMonth) / 7) * 7;

        const days = [];

        for (let i = 0; i < totalSlots; i++) {
            if (i < startDayIndex) {
                // Days from previous month
                const dayNum = prevMonthDays - startDayIndex + i + 1;
                const m = currentMonth === 1 ? 12 : currentMonth - 1;
                const y = currentMonth === 1 ? currentYear - 1 : currentYear;
                const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                days.push({
                    dayNum,
                    dateStr,
                    isCurrentMonth: false,
                    isPrevMonth: true,
                    isToday: false
                });
            } else if (i < startDayIndex + daysInMonth) {
                // Days in current month
                const dayNum = i - startDayIndex + 1;
                const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isTodayDate = today.getFullYear() === currentYear &&
                                   (today.getMonth() + 1) === currentMonth &&
                                   today.getDate() === dayNum;
                days.push({
                    dayNum,
                    dateStr,
                    isCurrentMonth: true,
                    isToday: isTodayDate
                });
            } else {
                // Days from next month
                const dayNum = i - (startDayIndex + daysInMonth) + 1;
                const m = currentMonth === 12 ? 1 : currentMonth + 1;
                const y = currentMonth === 12 ? currentYear + 1 : currentYear;
                const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                days.push({
                    dayNum,
                    dateStr,
                    isCurrentMonth: false,
                    isNextMonth: true,
                    isToday: false
                });
            }
        }

        return days;
    }, [currentYear, currentMonth, today]);

    // Handle day cell click
    const handleDayClick = (dayObj) => {
        setSelectedDateStr(dayObj.dateStr);
        setShowDateModal(true);
    };

    // Open Add Time modal
    const handleOpenAddTime = (dateStr) => {
        setModalDate(dateStr || selectedDateStr);
        setEditScheduleId(null);
        setScheduleTime('10:00');
        setShowAddEditModal(true);
    };

    // Open Edit Time modal
    const handleOpenEditTime = (sched) => {
        setModalDate(sched.scheduled_date);
        setEditScheduleId(sched.id);
        const timeVal = sched.scheduled_time.substring(0, 5); // 'HH:MM'
        setScheduleTime(timeVal);
        setShowAddEditModal(true);
    };

    // Save schedule (Add or Edit)
    const handleSaveSchedule = async (e) => {
        e.preventDefault();
        if (!scheduleTime) {
            Swal.fire({ icon: 'warning', title: 'Time Required', text: 'Please select a scheduled capture time.' });
            return;
        }

        setSavingSchedule(true);
        const timeFormatted = scheduleTime.length === 5 ? `${scheduleTime}:00` : scheduleTime;

        try {
            if (editScheduleId) {
                await WalletService.updateCalendarSchedule(editScheduleId, {
                    scheduled_time: timeFormatted
                });
                Swal.fire({
                    icon: 'success',
                    title: 'Schedule Updated',
                    text: `Screenshot schedule updated to ${formatTime12h(timeFormatted)}.`,
                    timer: 1800,
                    showConfirmButton: false
                });
            } else {
                await WalletService.createCalendarSchedule({
                    scheduled_date: modalDate,
                    scheduled_time: timeFormatted
                });
                Swal.fire({
                    icon: 'success',
                    title: 'Schedule Added',
                    text: `Scheduled screenshot capture at ${formatTime12h(timeFormatted)} on ${modalDate}.`,
                    timer: 1800,
                    showConfirmButton: false
                });
            }
            setShowAddEditModal(false);
            fetchSchedules();
        } catch (error) {
            const err = error.response?.data?.scheduled_time?.[0] ||
                        error.response?.data?.error ||
                        error.response?.data?.detail ||
                        'Failed to save schedule time.';
            Swal.fire({
                icon: 'error',
                title: 'Cannot Save Schedule',
                text: typeof err === 'object' ? JSON.stringify(err) : String(err)
            });
        } finally {
            setSavingSchedule(false);
        }
    };

    // Delete schedule
    const handleDeleteSchedule = async (sched) => {
        const timeFormatted = formatTime12h(sched.scheduled_time);
        const result = await Swal.fire({
            title: 'Delete Schedule Time?',
            html: `Are you sure you want to delete the scheduled screenshot time at <b>${timeFormatted}</b> on <b>${sched.scheduled_date}</b>?<br/><br/><small class="text-muted">Past execution audit records and captured screenshots are retained safely.</small>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, Delete',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            try {
                await WalletService.deleteCalendarSchedule(sched.id);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted',
                    text: `Schedule at ${timeFormatted} removed successfully.`,
                    timer: 1500,
                    showConfirmButton: false
                });
                fetchSchedules();
            } catch (error) {
                console.error('Error deleting schedule:', error);
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete schedule.' });
            }
        }
    };

    // Open Apply All modal
    const handleOpenApplyAll = (dateStr) => {
        const targetDate = dateStr || selectedDateStr;
        setSelectedDateStr(targetDate);
        setApplyScope('month');
        setApplyConflictMode('merge');
        setShowApplyAllModal(true);
    };

    // Execute Apply All
    const handleExecuteApplyAll = async () => {
        const sourceSchedules = schedulesByDate[selectedDateStr] || [];
        if (sourceSchedules.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'No Schedules to Apply',
                text: `Selected date ${selectedDateStr} does not have any scheduled times configured.`
            });
            return;
        }

        if (applyConflictMode === 'replace') {
            const confirmReplace = await Swal.fire({
                title: 'Confirm Replace Schedule?',
                text: 'Replace mode will overwrite existing future scheduled times on the target dates with the times from this source date. Past execution history will be preserved.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#e11d48',
                confirmButtonText: 'Yes, Replace Schedules',
                cancelButtonText: 'Cancel'
            });
            if (!confirmReplace.isConfirmed) return;
        }

        setApplyingAll(true);
        try {
            const res = await WalletService.applyAllCalendarSchedules({
                source_date: selectedDateStr,
                scope: applyScope,
                conflict_mode: applyConflictMode,
                target_month: currentMonth,
                target_year: currentYear
            });

            setShowApplyAllModal(false);
            Swal.fire({
                icon: 'success',
                title: 'Schedule Applied Successfully!',
                html: `Applied <b>${sourceSchedules.length}</b> scheduled time(s) to <b>${res.dates_affected}</b> date(s).<br/><span class="text-muted small">Created ${res.schedules_created} new entries (skipped ${res.schedules_skipped} existing).</span>`,
                confirmButtonColor: '#2563eb'
            });
            fetchSchedules();
        } catch (error) {
            const err = error.response?.data?.error || error.response?.data?.detail || 'Failed to apply schedule.';
            Swal.fire({ icon: 'error', title: 'Apply Failed', text: String(err) });
        } finally {
            setApplyingAll(false);
        }
    };

    // Append authorized JWT token to screenshot URL if viewing/downloading via <img> or <a>
    const getAuthorizedImageUrl = useCallback((url) => {
        if (!url) return '';
        try {
            const userDetails = localStorage.getItem('userDetails');
            if (userDetails) {
                const parsed = JSON.parse(userDetails);
                const access = parsed?.access;
                if (access && !url.includes('token=')) {
                    const sep = url.includes('?') ? '&' : '?';
                    return `${url}${sep}token=${encodeURIComponent(access)}`;
                }
            }
        } catch (e) {
            console.error('Error attaching auth token to screenshot URL:', e);
        }
        return url;
    }, []);

    // View captured screenshot modal
    const handleViewScreenshot = (sched) => {
        if (sched.latest_execution) {
            setPreviewExecution(sched.latest_execution);
            setShowPreviewModal(true);
        } else if (sched.screenshot_url) {
            setPreviewExecution({
                screenshot_url: sched.screenshot_url,
                scheduled_date: sched.scheduled_date,
                scheduled_time: sched.scheduled_time,
                status: sched.status,
                capture_source: 'Authorized Capture',
                executed_at: sched.updated_at
            });
            setShowPreviewModal(true);
        } else {
            Swal.fire({
                icon: 'info',
                title: 'No Screenshot Available',
                text: 'This scheduled time does not have a captured screenshot record yet.'
            });
        }
    };

    return (
        <div className="container-fluid p-0 wallet-calendar-container">

            <style>{`
                .wallet-calendar-container {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }
                .calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    border-top: 1px solid #eaebf0;
                    border-left: 1px solid #eaebf0;
                    background: #ffffff;
                }
                .calendar-day-header {
                    background: #f8fafc;
                    padding: 12px 8px;
                    text-align: center;
                    font-weight: 700;
                    font-size: 12px;
                    letter-spacing: 0.05em;
                    color: #475569;
                    border-right: 1px solid #eaebf0;
                    border-bottom: 1px solid #eaebf0;
                }
                .calendar-day-cell {
                    min-height: 125px;
                    border-right: 1px solid #eaebf0;
                    border-bottom: 1px solid #eaebf0;
                    padding: 8px;
                    background: #ffffff;
                    position: relative;
                    cursor: pointer;
                    transition: background-color 0.15s ease, box-shadow 0.15s ease;
                    display: flex;
                    flex-direction: column;
                }
                .calendar-day-cell:hover {
                    background: #f8fafc;
                    box-shadow: inset 0 0 0 1.5px #3b82f6;
                }
                .calendar-day-cell.other-month {
                    background: #fafbfc;
                    opacity: 0.55;
                }
                .calendar-day-cell.selected-day {
                    background: #eff6ff;
                    box-shadow: inset 0 0 0 2px #2563eb;
                }
                .calendar-day-cell.today-cell {
                    background: #f0fdf4;
                }
                .day-number-badge {
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    font-weight: 600;
                    font-size: 13px;
                    color: #1e293b;
                }
                .day-number-badge.today {
                    background-color: #2563eb;
                    color: #ffffff;
                    box-shadow: 0 2px 6px rgba(37, 99, 235, 0.35);
                }
                .schedule-pill {
                    font-size: 11px;
                    font-weight: 600;
                    padding: 3px 6px;
                    border-radius: 6px;
                    margin-bottom: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border: 1px solid transparent;
                    transition: transform 0.1s ease;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .schedule-pill:hover {
                    transform: translateY(-1px);
                }
                .calendar-nav-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    border: 1px solid #eaebf0;
                    background: #ffffff;
                    color: #334155;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }
                .calendar-nav-btn:hover {
                    background: #f1f5f9;
                    color: #0f172a;
                }
                .more-pill {
                    font-size: 10px;
                    font-weight: 600;
                    padding: 2px 6px;
                    border-radius: 4px;
                    background: #e2e8f0;
                    color: #475569;
                    text-align: center;
                    margin-top: 2px;
                }
                .pulse-indicator {
                    display: inline-block;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: #22c55e;
                    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
                    animation: pulse 1.6s infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
                    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
                }
            `}</style>

            {/* 1. Header Toolbar */}
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
                <div>
                    <h3 className="text-primary fw-bold mb-1">Wallet Calendar</h3>
                    <p className="text-muted small mb-0">
                        Schedule automated screen capture times, view execution results, and manage date-wise schedules.
                    </p>
                </div>

                <div className="d-flex align-items-center flex-wrap gap-2">
                    {/* Desktop Agent Online Status Indicator */}
                    {agentStatus.is_online ? (
                        <div
                            className="d-flex align-items-center gap-2 px-3 py-1 bg-success-subtle border border-success-subtle rounded-pill cursor-pointer"
                            onClick={() => setShowAgentSetupModal(true)}
                            title={`Desktop Capture Agent is online on: ${agentStatus.agent_info?.hostname || 'Workstation'}. Click to view details.`}
                            style={{ cursor: 'pointer' }}
                        >
                            <span className="pulse-indicator"></span>
                            <span className="fw-bold text-success small">
                                <i className="fa fa-windows me-1"></i> Agent Online
                            </span>
                        </div>
                    ) : (
                        <div
                            className="d-flex align-items-center gap-2 px-3 py-1 bg-light border rounded-pill cursor-pointer"
                            onClick={() => setShowAgentSetupModal(true)}
                            title="Background desktop capture agent is not connected. Click for setup and connection instructions."
                            style={{ cursor: 'pointer' }}
                        >
                            <span className="text-muted small">
                                <i className="fa fa-windows me-1"></i> Agent Offline
                            </span>
                        </div>
                    )}

                    {/* Desktop Agent Setup Button */}
                    <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2"
                        onClick={() => setShowAgentSetupModal(true)}
                        style={{ borderRadius: '8px', padding: '7px 14px' }}
                        title="Configure and run the Windows Desktop Screenshot Capture Agent"
                    >
                        <i className="fa fa-desktop"></i>
                        <span>Agent Setup</span>
                    </button>

                    {/* Apply All Action */}
                    <button
                        type="button"
                        className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2"
                        onClick={() => handleOpenApplyAll(selectedDateStr)}
                        style={{ borderRadius: '8px', padding: '7px 14px' }}
                        title="Replicate scheduled times to other dates"
                    >
                        <i className="fa fa-clone"></i>
                        <span>Apply All</span>
                    </button>

                    {/* Today Jump */}
                    <button
                        type="button"
                        className="btn btn-light border btn-sm"
                        onClick={handleTodayJump}
                        style={{ borderRadius: '8px', padding: '7px 14px', backgroundColor: '#f8fafc', borderColor: '#eaebf0' }}
                    >
                        Today
                    </button>
                </div>
            </div>

            {/* 2. Month Navigation & Controls Banner */}
            <Card className="border-0 shadow-sm mb-3" style={{ borderRadius: '12px' }}>
                <Card.Body className="p-3">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                        {/* Month & Year Display with Previous / Next Controls */}
                        <div className="d-flex align-items-center gap-3">
                            <button
                                type="button"
                                className="calendar-nav-btn"
                                onClick={handlePrevMonth}
                                title="Previous Month"
                            >
                                <i className="fa fa-chevron-left"></i>
                            </button>

                            <h4 className="fw-bold mb-0 text-dark" style={{ minWidth: '190px', textAlign: 'center' }}>
                                {MONTH_NAMES[currentMonth - 1]} {currentYear}
                            </h4>

                            <button
                                type="button"
                                className="calendar-nav-btn"
                                onClick={handleNextMonth}
                                title="Next Month"
                            >
                                <i className="fa fa-chevron-right"></i>
                            </button>
                        </div>

                        {/* Status Legend Badges */}
                        <div className="d-flex flex-wrap align-items-center gap-3">
                           
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                <div key={key} className="d-flex align-items-center gap-1" style={{ fontSize: '12px' }}>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            backgroundColor: cfg.color
                                        }}
                                    ></span>
                                    <span className="text-secondary">{cfg.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card.Body>
            </Card>

            {/* 3. Block-Based Calendar Grid */}
            <Card className="border-0 shadow-sm overflow-hidden" style={{ borderRadius: '12px' }}>
                {loading && (
                    <div className="text-center py-4 bg-white">
                        <Spinner animation="border" variant="primary" size="sm" />
                        <span className="ms-2 text-muted small">Loading schedule data...</span>
                    </div>
                )}

                {/* Day of Week Headers */}
                <div className="calendar-grid">
                    {WEEKDAYS.map(day => (
                        <div key={day} className="calendar-day-header">
                            {day}
                        </div>
                    ))}

                    {/* Date Blocks */}
                    {calendarDays.map((dayObj, idx) => {
                        const daySchedules = schedulesByDate[dayObj.dateStr] || [];
                        const isSelected = dayObj.dateStr === selectedDateStr;

                        return (
                            <div
                                key={idx}
                                className={`calendar-day-cell ${!dayObj.isCurrentMonth ? 'other-month' : ''} ${isSelected ? 'selected-day' : ''} ${dayObj.isToday ? 'today-cell' : ''}`}
                                onClick={() => handleDayClick(dayObj)}
                            >
                                {/* Top Row: Date Number and Quick Add Button */}
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <span className={`day-number-badge ${dayObj.isToday ? 'today' : ''}`}>
                                        {dayObj.dayNum}
                                    </span>

                                    {dayObj.isCurrentMonth && (
                                        <button
                                            type="button"
                                            className="btn btn-link p-0 text-muted"
                                            style={{ fontSize: '11px', textDecoration: 'none' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenAddTime(dayObj.dateStr);
                                            }}
                                            title={`Add schedule to ${dayObj.dateStr}`}
                                        >
                                            <i className="fa fa-plus-circle text-primary"></i>
                                        </button>
                                    )}
                                </div>

                                {/* Scheduled Times Badges */}
                                <div className="flex-grow-1" style={{ minHeight: '60px' }}>
                                    {daySchedules.slice(0, 3).map(sched => {
                                        const cfg = STATUS_CONFIG[sched.status] || STATUS_CONFIG['Scheduled'];
                                        return (
                                            <div
                                                key={sched.id}
                                                className="schedule-pill"
                                                style={{
                                                    backgroundColor: cfg.bgColor,
                                                    color: cfg.color,
                                                    borderColor: cfg.borderColor
                                                }}
                                                title={`${formatTime12h(sched.scheduled_time)} — ${sched.status}`}
                                            >
                                                <span>
                                                    <i className={`${cfg.icon} me-1`} style={{ fontSize: '10px' }}></i>
                                                    {formatTime12h(sched.scheduled_time)}
                                                </span>
                                            </div>
                                        );
                                    })}

                                    {daySchedules.length > 3 && (
                                        <div className="more-pill">
                                            +{daySchedules.length - 3} more
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* 4. Date-Specific Schedule Panel / Popup Modal */}
            <Modal
                show={showDateModal}
                onHide={() => setShowDateModal(false)}
                size="lg"
                centered
                dialogClassName="date-schedule-modal"
            >
                <Modal.Header closeButton style={{ borderBottom: '1px solid #eaebf0', background: '#f8fafc', padding: '16px 24px' }}>
                    <div>
                        <h5 className="modal-title fw-bold text-dark mb-0">
                            Selected Date: {formatDateDisplay(selectedDateStr)}
                        </h5>
                        <small className="text-muted">
                            Manage all scheduled screenshot times for this calendar date.
                        </small>
                    </div>
                </Modal.Header>

                <Modal.Body style={{ padding: '24px' }}>
                    {/* Toolbar Actions inside Panel */}
                    <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
                        <div className="d-flex align-items-center gap-2">
                            <span className="fw-bold text-secondary small">
                                {selectedDateSchedules.length} Scheduled Time(s)
                            </span>
                        </div>

                        <div className="d-flex gap-2">
                            <CreateButton
                                module="wallet_calendar"
                                className="btn-sm"
                                style={{ borderRadius: '8px' }}
                                onClick={() => handleOpenAddTime(selectedDateStr)}
                            >
                                Add Time
                            </CreateButton>

                            {selectedDateSchedules.length > 0 && (
                                <button
                                    type="button"
                                    className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2"
                                    onClick={() => {
                                        setShowDateModal(false);
                                        handleOpenApplyAll(selectedDateStr);
                                    }}
                                    style={{ borderRadius: '8px' }}
                                >
                                    <i className="fa fa-clone"></i>
                                    <span>Apply All</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Schedules Table */}
                    {selectedDateSchedules.length === 0 ? (
                        <div className="text-center py-5 bg-light rounded-3 border">
                            <i className="fa fa-calendar-o text-muted mb-2" style={{ fontSize: '32px' }}></i>
                            <h6 className="fw-bold text-dark mb-1">No Schedules for this Date</h6>
                            <p className="text-muted small mb-3">Click "+ Add Time" to schedule a screenshot capture on this date.</p>
                            <CreateButton
                                module="wallet_calendar"
                                className="btn-sm"
                                style={{ borderRadius: '8px' }}
                                onClick={() => handleOpenAddTime(selectedDateStr)}
                            >
                                Add First Time
                            </CreateButton>
                        </div>
                    ) : (
                        <div className="table-responsive border rounded-3 overflow-hidden">
                            <table className="table table-hover align-middle mb-0">
                                <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #eaebf0' }}>
                                    <tr>
                                        <th style={{ width: '60px' }} className="text-center">#</th>
                                        <th>Scheduled Time</th>
                                        <th>Status</th>
                                        <th>Source</th>
                                        <th className="text-end" style={{ width: '130px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedDateSchedules.map((sched, idx) => {
                                        const cfg = STATUS_CONFIG[sched.status] || STATUS_CONFIG['Scheduled'];
                                        return (
                                            <tr key={sched.id}>
                                                <td className="text-center text-muted fw-bold">{idx + 1}</td>
                                                <td>
                                                    <span className="fw-bold text-dark fs-6">
                                                        {formatTime12h(sched.scheduled_time)}
                                                    </span>
                                                    <small className="text-muted d-block" style={{ fontSize: '11px' }}>
                                                        ({sched.scheduled_time})
                                                    </small>
                                                </td>
                                                <td>
                                                    <span
                                                        className="badge px-2 py-1 rounded-pill"
                                                        style={{
                                                            backgroundColor: cfg.bgColor,
                                                            color: cfg.color,
                                                            border: `1px solid ${cfg.borderColor}`
                                                        }}
                                                    >
                                                        <i className={`${cfg.icon} me-1`}></i>
                                                        {sched.status}
                                                    </span>
                                                    {sched.error_message && (
                                                        <div className="text-danger small mt-1" style={{ fontSize: '11px' }}>
                                                            {sched.error_message}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className="badge bg-light text-secondary border">
                                                        {sched.latest_execution?.capture_source || 'Scheduled'}
                                                    </span>
                                                </td>
                                                <td className="text-end">
                                                    <div className="d-flex justify-content-end align-items-center gap-2">
                                                        {/* If Captured: View Screenshot */}
                                                        {sched.status === 'Captured' && (
                                                            <Button
                                                                variant="outline-success"
                                                                size="sm"
                                                                className="shadow"
                                                                onClick={() => handleViewScreenshot(sched)}
                                                                title="View Captured Screenshot"
                                                                style={{
                                                                    width: '28px',
                                                                    height: '28px',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    padding: '0',
                                                                    fontSize: '12px',
                                                                    borderRadius: '6px',
                                                                }}
                                                            >
                                                                <i className="fa fa-eye"></i>
                                                            </Button>
                                                        )}

                                                        {/* Standard ERP Edit and Delete Buttons */}
                                                        <EditButton
                                                            module="wallet_calendar"
                                                            onClick={() => handleOpenEditTime(sched)}
                                                            title="Edit Schedule Time"
                                                        />
                                                        <DeleteButton
                                                            module="wallet_calendar"
                                                            onClick={() => handleDeleteSchedule(sched)}
                                                            title="Delete Schedule"
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Modal.Body>

                <Modal.Footer style={{ borderTop: '1px solid #eaebf0', background: '#f8fafc', padding: '12px 24px' }}>
                    <Button variant="secondary" size="sm" onClick={() => setShowDateModal(false)} style={{ borderRadius: '6px' }}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* 5. Add / Edit Schedule Time Modal */}
            <Modal
                show={showAddEditModal}
                onHide={() => setShowAddEditModal(false)}
                size="md"
                centered
            >
                <Modal.Header closeButton style={{ borderBottom: '1px solid #eaebf0', background: '#f8fafc' }}>
                    <div>
                        <h5 className="modal-title fw-bold text-dark mb-0">
                            {editScheduleId ? 'Edit Screenshot Time' : 'Add Screenshot Time'}
                        </h5>
                        <small className="text-muted">
                            Target Date: {formatDateDisplay(modalDate)}
                        </small>
                    </div>
                </Modal.Header>

                <Form onSubmit={handleSaveSchedule}>
                    <Modal.Body style={{ padding: '24px' }}>
                        <div className="mb-3">
                            <Form.Label className="fw-bold text-secondary small">Scheduled Clock Time</Form.Label>
                            <Form.Control
                                type="time"
                                value={scheduleTime}
                                onChange={(e) => setScheduleTime(e.target.value)}
                                required
                                style={{ height: '46px', borderRadius: '8px', fontSize: '16px' }}
                            />
                            <Form.Text className="text-muted">
                                Select the exact time when ongoing screen capture should be triggered.
                            </Form.Text>
                        </div>
                    </Modal.Body>

                    <Modal.Footer style={{ borderTop: '1px solid #eaebf0', background: '#f8fafc' }}>
                        <Button variant="secondary" size="sm" onClick={() => setShowAddEditModal(false)} style={{ borderRadius: '6px' }}>
                            Cancel
                        </Button>
                        <Button variant="primary" size="sm" type="submit" disabled={savingSchedule} style={{ borderRadius: '6px' }}>
                            {savingSchedule ? (
                                <>
                                    <Spinner animation="border" size="sm" className="me-2" />
                                    Saving...
                                </>
                            ) : (
                                'Save Schedule'
                            )}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* 6. Apply All Modal */}
            <Modal
                show={showApplyAllModal}
                onHide={() => setShowApplyAllModal(false)}
                size="lg"
                centered
            >
                <Modal.Header closeButton style={{ borderBottom: '1px solid #eaebf0', background: '#f8fafc', padding: '16px 24px' }}>
                    <div>
                        <h5 className="modal-title fw-bold text-dark mb-0">Apply All — Replicate Schedule</h5>
                        <small className="text-muted">
                            Copy this day's scheduled screenshot capture times to target dates.
                        </small>
                    </div>
                </Modal.Header>

                <Modal.Body style={{ padding: '24px' }}>
                    {/* Source Date Preview Card */}
                    <div className="p-3 mb-4 rounded-3 border" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                        <div className="d-flex align-items-center gap-2 mb-2">
                            <i className="fa fa-calendar-check-o text-success fs-5"></i>
                            <span className="fw-bold text-dark">Source Date: {formatDateDisplay(selectedDateStr)}</span>
                        </div>
                        <div className="text-secondary small mb-2">
                            The following configured capture times will be replicated:
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                            {(schedulesByDate[selectedDateStr] || []).map(s => (
                                <Badge key={s.id} bg="primary" className="px-2 py-1 fs-7">
                                    <i className="fa fa-clock-o me-1"></i>
                                    {formatTime12h(s.scheduled_time)}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* Step 1: Target Scope */}
                    <div className="mb-4">
                        <label className="form-label fw-bold text-secondary small">
                            1. Select Target Scope
                        </label>
                        <div className="d-flex flex-column gap-2">
                            <label className={`p-3 border rounded-3 d-flex align-items-start gap-3 cursor-pointer ${applyScope === 'month' ? 'border-primary bg-light' : ''}`} style={{ cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="applyScope"
                                    value="month"
                                    checked={applyScope === 'month'}
                                    onChange={(e) => setApplyScope(e.target.value)}
                                    className="mt-1"
                                />
                                <div>
                                    <div className="fw-bold text-dark">All dates in the selected month</div>
                                    <small className="text-muted">
                                        Replicates times across every day in {MONTH_NAMES[currentMonth - 1]} {currentYear}.
                                    </small>
                                </div>
                            </label>

                            <label className={`p-3 border rounded-3 d-flex align-items-start gap-3 cursor-pointer ${applyScope === 'year' ? 'border-primary bg-light' : ''}`} style={{ cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="applyScope"
                                    value="year"
                                    checked={applyScope === 'year'}
                                    onChange={(e) => setApplyScope(e.target.value)}
                                    className="mt-1"
                                />
                                <div>
                                    <div className="fw-bold text-dark">All dates in the selected year</div>
                                    <small className="text-muted">
                                        Replicates times across all 365 calendar dates in {currentYear}.
                                    </small>
                                </div>
                            </label>

                            <label className={`p-3 border rounded-3 d-flex align-items-start gap-3 cursor-pointer ${applyScope === 'future' ? 'border-primary bg-light' : ''}`} style={{ cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="applyScope"
                                    value="future"
                                    checked={applyScope === 'future'}
                                    onChange={(e) => setApplyScope(e.target.value)}
                                    className="mt-1"
                                />
                                <div>
                                    <div className="fw-bold text-dark">All future dates</div>
                                    <small className="text-muted">
                                        Replicates times across upcoming dates starting from tomorrow onward.
                                    </small>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Step 2: Conflict Mode */}
                    <div className="mb-3">
                        <label className="form-label fw-bold text-secondary small">
                            2. Conflict Handling for Existing Schedules
                        </label>
                        <div className="d-flex flex-column gap-2">
                            <label className={`p-3 border rounded-3 d-flex align-items-start gap-3 cursor-pointer ${applyConflictMode === 'merge' ? 'border-primary bg-light' : ''}`} style={{ cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="conflictMode"
                                    value="merge"
                                    checked={applyConflictMode === 'merge'}
                                    onChange={(e) => setApplyConflictMode(e.target.value)}
                                    className="mt-1"
                                />
                                <div>
                                    <div className="fw-bold text-dark">Merge with existing schedules (Recommended)</div>
                                    <small className="text-muted">
                                        Adds the source times to target dates without removing existing times. Avoids duplicate identical times.
                                    </small>
                                </div>
                            </label>

                            <label className={`p-3 border rounded-3 d-flex align-items-start gap-3 cursor-pointer ${applyConflictMode === 'replace' ? 'border-danger bg-light' : ''}`} style={{ cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="conflictMode"
                                    value="replace"
                                    checked={applyConflictMode === 'replace'}
                                    onChange={(e) => setApplyConflictMode(e.target.value)}
                                    className="mt-1"
                                />
                                <div>
                                    <div className="fw-bold text-danger">Replace existing future schedules</div>
                                    <small className="text-muted">
                                        Clears future scheduled times on target dates before applying the new times. Completed execution records remain preserved.
                                    </small>
                                </div>
                            </label>
                        </div>
                    </div>
                </Modal.Body>

                <Modal.Footer style={{ borderTop: '1px solid #eaebf0', background: '#f8fafc', padding: '12px 24px' }}>
                    <Button variant="secondary" size="sm" onClick={() => setShowApplyAllModal(false)} style={{ borderRadius: '6px' }}>
                        Cancel
                    </Button>
                    <Button
                        variant={applyConflictMode === 'replace' ? 'danger' : 'primary'}
                        size="sm"
                        onClick={handleExecuteApplyAll}
                        disabled={applyingAll}
                        style={{ borderRadius: '6px' }}
                    >
                        {applyingAll ? (
                            <>
                                <Spinner animation="border" size="sm" className="me-2" />
                                Applying Schedules...
                            </>
                        ) : (
                            'Confirm & Apply Schedule'
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* 7. Screenshot Preview Modal */}
            <Modal
                show={showPreviewModal}
                onHide={() => setShowPreviewModal(false)}
                size="xl"
                centered
            >
                <Modal.Header closeButton style={{ borderBottom: '1px solid #eaebf0', background: '#f8fafc' }}>
                    <div>
                        <h5 className="modal-title fw-bold text-dark mb-0">Captured Screenshot Preview</h5>
                        {previewExecution && (
                            <small className="text-muted">
                                Captured for: {previewExecution.scheduled_date} at {formatTime12h(previewExecution.scheduled_time)}
                            </small>
                        )}
                    </div>
                </Modal.Header>

                <Modal.Body className="p-3 text-center" style={{ backgroundColor: '#0f172a' }}>
                    {previewExecution?.screenshot_url ? (
                        <img
                            src={getAuthorizedImageUrl(previewExecution.screenshot_url)}
                            alt="Captured Screen"
                            className="img-fluid rounded shadow"
                            style={{ maxHeight: '72vh', objectFit: 'contain' }}
                        />
                    ) : (
                        <div className="text-white py-5">
                            <i className="fa fa-image fs-1 mb-2"></i>
                            <div>Screenshot preview unavailable</div>
                        </div>
                    )}
                </Modal.Body>

                <Modal.Footer style={{ borderTop: '1px solid #eaebf0', background: '#f8fafc' }}>
                    <div className="me-auto text-muted small text-start">
                        <div><strong>Capture Source:</strong> {previewExecution?.capture_source || 'Browser Session'}</div>
                        <div><strong>Execution Time:</strong> {previewExecution?.executed_at ? new Date(previewExecution.executed_at).toLocaleString() : 'N/A'}</div>
                    </div>

                    {previewExecution?.screenshot_url && (
                        <a
                            href={getAuthorizedImageUrl(previewExecution.screenshot_url)}
                            download={`screenshot_${previewExecution.scheduled_date}_${previewExecution.scheduled_time}.png`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline-primary btn-sm"
                            style={{ borderRadius: '6px' }}
                        >
                            <i className="fa fa-download me-1"></i> Download Image
                        </a>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => setShowPreviewModal(false)} style={{ borderRadius: '6px' }}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* 8. Desktop Agent Setup & Instructions Modal */}
            <Modal
                show={showAgentSetupModal}
                onHide={() => setShowAgentSetupModal(false)}
                size="lg"
                centered
            >
                <Modal.Header closeButton style={{ borderBottom: '1px solid #eaebf0', background: '#f8fafc' }}>
                    <div className="d-flex align-items-center gap-2">
                        <div
                            className="d-flex align-items-center justify-content-center bg-primary-subtle text-primary rounded-circle"
                            style={{ width: '38px', height: '38px' }}
                        >
                            <i className="fa fa-windows fs-5"></i>
                        </div>
                        <div>
                            <h5 className="modal-title fw-bold text-dark mb-0">Windows Desktop Capture Agent</h5>
                            <small className="text-muted">
                                Automatic, hands-free background desktop capture without browser screen-sharing dialogs
                            </small>
                        </div>
                    </div>
                </Modal.Header>

                <Modal.Body style={{ padding: '24px' }}>
                    {/* Status Card */}
                    <div className={`p-3 rounded-3 mb-4 border ${agentStatus.is_online ? 'bg-success-subtle border-success-subtle' : 'bg-light border-light-subtle'}`}>
                        <div className="d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center gap-3">
                                <span className={agentStatus.is_online ? 'pulse-indicator' : ''} style={!agentStatus.is_online ? { display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#94a3b8' } : {}}></span>
                                <div>
                                    <div className="fw-bold fs-6">
                                        Agent Status: {agentStatus.is_online ? (
                                            <span className="text-success">Connected & Active</span>
                                        ) : (
                                            <span className="text-muted">Offline / Not Connected</span>
                                        )}
                                    </div>
                                    <small className="text-muted">
                                        {agentStatus.is_online
                                            ? `Host: ${agentStatus.agent_info?.hostname || 'Workstation'} | Version: ${agentStatus.agent_info?.version || '1.2.0'} | Last Heartbeat: ${new Date().toLocaleTimeString()}`
                                            : 'The Windows desktop agent runs silently in the background on your workstation and captures screenshots automatically at scheduled times.'}
                                    </small>
                                </div>
                            </div>
                            <span className={`badge ${agentStatus.is_online ? 'bg-success' : 'bg-secondary'} px-3 py-2 rounded-pill`}>
                                {agentStatus.is_online ? 'ONLINE' : 'OFFLINE'}
                            </span>
                        </div>
                    </div>

                    <h6 className="fw-bold text-dark mb-2">How It Works</h6>
                    <ul className="text-muted small ps-3 mb-4">
                        <li className="mb-1"><strong>No browser prompts:</strong> Screenshots are captured natively using the authorized Windows agent without any Edge/Chrome screen-sharing permissions or camera icons.</li>
                        <li className="mb-1"><strong>Independent of browser:</strong> The capture executes automatically even when this calendar tab or browser is completely closed.</li>
                        <li className="mb-1"><strong>Secure storage:</strong> Screenshots are securely uploaded over HTTPS with token authentication and protected against duplicate executions.</li>
                    </ul>

                    <h6 className="fw-bold text-dark mb-2">How to Run on this Computer</h6>
                    <div className="bg-dark text-light p-3 rounded-3 font-monospace small mb-3">
                        <div className="text-muted mb-1"># 1. Open Command Prompt or PowerShell in your ERP directory:</div>
                        <div className="text-info mb-2">cd scripts</div>
                        <div className="text-muted mb-1"># 2. Start the desktop agent (or double-click start_capture_agent.bat):</div>
                        <div className="text-warning">python desktop_capture_agent.py --server http://127.0.0.1:8000 --username YOUR_USERNAME --password YOUR_PASSWORD</div>
                    </div>

                    <div className="alert alert-info py-2 px-3 small mb-0 d-flex align-items-center gap-2">
                        <i className="fa fa-info-circle text-info fs-5"></i>
                        <span>
                            To launch on Windows login automatically, you can add a shortcut of <code>scripts\start_capture_agent.bat</code> to your Windows Startup folder (<code>shell:startup</code>).
                        </span>
                    </div>
                </Modal.Body>

                <Modal.Footer style={{ borderTop: '1px solid #eaebf0', background: '#f8fafc', padding: '12px 24px' }}>
                    <Button variant="secondary" size="sm" onClick={() => setShowAgentSetupModal(false)} style={{ borderRadius: '6px' }}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default WalletCalendar;
