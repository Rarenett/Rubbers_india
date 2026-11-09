import React, { useState, useEffect, Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Button, Table, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { getMyMeetings, enterMeeting } from '../../../services/MeetingManagementService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import { formatDate } from '../../../utils/dateUtils';
import '../Assets/FileDashboard.css';
import { usePageTitle } from '../../../context/TitleContext';


// ─── Export button matching Renewal Reminder Report style ─────────────────────
function ExportBtn({ onClick, title, children }) {
    return (
        <button
            className="btn btn-sm btn-light border d-flex align-items-center justify-content-center"
            onClick={onClick}
            title={title}
            style={{ height: '38px', width: '38px', borderRadius: '6px', padding: 0 }}
        >
            {children}
        </button>
    );
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const PdfIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
);
const ExcelIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
);
const PrintIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
);
const RefreshIcon = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#eef2ff" stroke="#6366f1" strokeWidth="1.6" />
        <path d="M16.5 8A5.5 5.5 0 0 0 7.5 12" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7.5 16A5.5 5.5 0 0 0 16.5 12" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" />
        <polyline points="15.5 6 16.5 8 14.5 9" stroke="#6366f1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="8.5 18 7.5 16 9.5 15" stroke="#6366f1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const formatTime = (timeString) => {
    if (!timeString) return "";
    const parts = timeString.split(':');
    return `${parts[0]}:${parts[1]}`;
};

const AssignedMeetingList = () => {
    usePageTitle("Assigned Meeting List");
    const navigate = useNavigate();
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const modeConfig = {
        offline: { bg: '#dcfce7', color: '#15803d', dot: '#22c55e' },
        remote: { bg: '#cffafe', color: '#0891b2', dot: '#06b6d4' },
        hybrid: { bg: '#fef3c7', color: '#b45309', dot: '#f59e0b' },
    };

    const statusConfig = {
        ongoing: { bg: '#e0f2fe', color: '#0369a1', dot: '#0ea5e9' },
        ended: { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
        upcoming: { bg: '#fef9c3', color: '#92400e', dot: '#f59e0b' },
    };

    useEffect(() => {
        fetchMyMeetings();
        // Refresh every minute to update button state and status
        const interval = setInterval(fetchMyMeetings, 60000);
        return () => clearInterval(interval);
    }, []);

    const fetchMyMeetings = async () => {
        try {
            setLoading(true);
            const data = await getMyMeetings();
            setMeetings(data);
        } catch (error) {
            console.error("Failed to fetch assigned meetings", error);
            // Don't show error alert on background refresh to avoid annoyance
            if (loading) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch assigned meetings' });
            }
        } finally {
            setLoading(false);
        }
    };

    const getDeviceDetails = () => {
        const ua = navigator.userAgent;
        let browser = "Unknown Browser";
        let os = "Unknown OS";
        let device = "Desktop/Unknown";

        // Simple OS detection
        if (ua.indexOf("Win") !== -1) os = "Windows";
        if (ua.indexOf("Mac") !== -1) os = "MacOS";
        if (ua.indexOf("X11") !== -1) os = "UNIX";
        if (ua.indexOf("Linux") !== -1) os = "Linux";
        if (ua.indexOf("Android") !== -1) os = "Android";
        if (ua.indexOf("iPhone") !== -1 || ua.indexOf("iPad") !== -1) os = "iOS";

        // Simple Browser detection
        if (ua.indexOf("Firefox") !== -1) browser = "Firefox";
        else if (ua.indexOf("SamsungBrowser") !== -1) browser = "Samsung Browser";
        else if (ua.indexOf("Opera") !== -1 || ua.indexOf("OPR") !== -1) browser = "Opera";
        else if (ua.indexOf("Trident") !== -1) browser = "Internet Explorer";
        else if (ua.indexOf("Edge") !== -1 || ua.indexOf("Edg") !== -1) browser = "Edge";
        else if (ua.indexOf("Chrome") !== -1) browser = "Chrome";
        else if (ua.indexOf("Safari") !== -1) browser = "Safari";

        // Simple Device detection
        if (/Mobi|Android|iPhone/i.test(ua)) {
            device = "Mobile";
        } else {
            device = "Desktop";
        }

        return { browser, os, device };
    };

    const generateFingerprint = () => {
        const specs = [
            navigator.userAgent,
            navigator.language,
            window.screen.colorDepth,
            window.screen.width + "x" + window.screen.height,
            new Date().getTimezoneOffset(),
            navigator.hardwareConcurrency,
            navigator.deviceMemory || "unknown",
            navigator.platform
        ].join('###');

        // Simple Hash implementation
        let hash = 0;
        for (let i = 0; i < specs.length; i++) {
            const char = specs.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        return "DEV-" + Math.abs(hash).toString(16).toUpperCase();
    };

    const handleEnterMeeting = async (meeting) => {
        try {
            // Try to get geolocation
            const deviceDetails = getDeviceDetails();
            const fingerprint = generateFingerprint();

            let entryData = {
                ...deviceDetails,
                device_fingerprint: fingerprint,
                join_method: 'web'
            };

            if ("geolocation" in navigator) {
                try {
                    const position = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            timeout: 5000
                        });
                    });
                    entryData = {
                        ...entryData,
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        location_accuracy_meters: position.coords.accuracy,
                        location_address: 'Browser Geolocation'
                    };
                } catch (geoError) {
                    console.warn("Geolocation failed or denied", geoError);
                }
            }

            // Rename keys to match backend expected parameters if necessary
            const payload = {
                latitude: entryData.latitude,
                longitude: entryData.longitude,
                location_address: entryData.location_address,
                location_accuracy_meters: entryData.location_accuracy_meters,
                device_name: entryData.device,
                operating_system: entryData.os,
                browser_info: entryData.browser,
                device_fingerprint: entryData.device_fingerprint,
                join_method: entryData.join_method
            };

            await enterMeeting(meeting.id, payload);

            Swal.fire({
                icon: 'success',
                title: 'Welcome',
                text: 'You have entered the meeting room.',
                timer: 1500,
                showConfirmButton: false
            });

            // Redirect to the dedicated virtual meeting room
            navigate(`/meeting/virtual-room/${meeting.id}`);

        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Failed to log meeting entry';
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'ongoing': return <Badge bg="info">ONGOING</Badge>;
            case 'ended': return <Badge bg="secondary">ENDED</Badge>;
            case 'upcoming': return <Badge bg="primary">UPCOMING</Badge>;
            default: return <Badge bg="secondary">{status?.toUpperCase()}</Badge>;
        }
    };

    const handleExport = (format) => {
        const filtered = meetings.filter(m => {
            const searchStr = `${m.meeting_code} ${m.meeting_title} ${m.category_name} ${m.subcategory_name} ${m.room_name} ${m.meeting_status}`.toLowerCase();
            return searchStr.includes(searchTerm.toLowerCase());
        });

        const columns = [
            { header: 'Meeting Code', dataKey: 'meeting_code' },
            { header: 'Title', dataKey: 'meeting_title' },
            { header: 'Category', dataKey: 'category_name' },
            { header: 'Subcategory', dataKey: 'subcategory_name' },
            { header: 'Date', dataKey: 'meeting_date', formatter: (val) => formatDate(val) },
            { header: 'Time', dataKey: 'start_time', formatter: (val, row) => `${formatTime(row.start_time)} - ${formatTime(row.end_time)}` },
            { header: 'Room/Mode', dataKey: 'mode', formatter: (val, row) => val === 'offline' ? row.room_name : val },
            { header: 'Status', dataKey: 'meeting_status' }
        ];

        const fileName = `Assigned_Meetings_${new Date().toISOString().split('T')[0]}`;
        const title = 'My Assigned Meetings Report';

        if (format === 'pdf') exportToPDF(filtered, columns, `${fileName}.pdf`, title);
        else if (format === 'excel') exportToExcel(filtered, columns, `${fileName}.xlsx`);
        else if (format === 'print') printData(filtered, columns, title);
    };

    const filteredMeetings = meetings.filter(m => {
        if (!searchTerm) return true;
        const searchStr = `${m.meeting_code} ${m.meeting_title} ${m.category_name} ${m.subcategory_name} ${m.room_name} ${m.meeting_status}`.toLowerCase();
        return searchStr.includes(searchTerm.toLowerCase());
    });

    return (
        <div className="container-fluid">
            <div className="page-titles">
                <button 
                    onClick={() => window.history.back()} 
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 border-0 pb-0">
                            <Card.Title className="mb-0 text-nowrap">My Assigned Meetings</Card.Title>
                            <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                                <div className="search-bar-container w-100 m-0" style={{ maxWidth: '250px' }}>
                                    <span className="search-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Search meetings..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                                    <div className="d-flex align-items-center gap-2">
                                        <ExportBtn onClick={() => handleExport('pdf')} title="Export PDF"><PdfIcon /></ExportBtn>
                                        <ExportBtn onClick={() => handleExport('excel')} title="Export Excel"><ExcelIcon /></ExportBtn>
                                        <ExportBtn onClick={() => handleExport('print')} title="Print"><PrintIcon /></ExportBtn>
                                        <ExportBtn onClick={fetchMyMeetings} title="Refresh List"><RefreshIcon /></ExportBtn>
                                    </div>
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <div className="table-responsive">
                                <table className="table table-responsive-md">
                                    <thead>
                                        <tr>
                                            <th><strong>MEETING CODE</strong></th>
                                            <th><strong>TITLE</strong></th>
                                            <th><strong>DATE & TIME</strong></th>
                                            <th><strong>ROOM / MODE</strong></th>
                                            <th><strong>STATUS</strong></th>
                                            <th className="text-end"><strong>ACTION</strong></th>
                                        </tr>
                                    </thead>
                                <tbody>
                                    {loading && filteredMeetings.length === 0 ? (
                                        <tr><td colSpan="6" className="text-center p-5">
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="sr-only">Loading...</span>
                                            </div>
                                        </td></tr>
                                    ) : filteredMeetings.length === 0 ? (
                                        <tr><td colSpan="6" className="text-center p-5 text-muted">No meetings found</td></tr>
                                    ) : (
                                        filteredMeetings.map(meeting => (
                                            <tr key={meeting.id}>
                                                <td><strong>{meeting.meeting_code}</strong></td>
                                                <td>
                                                    <div className="d-flex align-items-center">
                                                        <div>
                                                            <h6 className="mb-0 fs-14">{meeting.meeting_title}</h6>
                                                            <small className="text-muted">{meeting.category_name} - {meeting.subcategory_name}</small>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="text-nowrap">{formatDate(meeting.meeting_date)}</span><br />
                                                    <small className="text-primary font-w600">{formatTime(meeting.start_time)} - {formatTime(meeting.end_time)}</small>
                                                </td>
                                                <td>
                                                    {(() => {
                                                        const mc = modeConfig[meeting.mode] || modeConfig.offline;
                                                        return (
                                                            <span style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                                background: mc.bg, color: mc.color,
                                                                fontSize: 11, fontWeight: 700,
                                                                padding: '3px 10px', borderRadius: 20,
                                                                letterSpacing: '0.04em',
                                                                textTransform: 'uppercase'
                                                            }}>
                                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: mc.dot, flexShrink: 0 }} />
                                                                {meeting.mode === 'offline' ? (meeting.room_name || 'OFFLINE') : meeting.mode}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td>
                                                    <span className={`badge badge-${
                                                        meeting.meeting_status === 'ongoing' ? 'info' :
                                                        meeting.meeting_status === 'ended' ? 'success' : 'primary'
                                                    } light`}>
                                                        {meeting.meeting_status ? (meeting.meeting_status.charAt(0).toUpperCase() + meeting.meeting_status.slice(1)) : 'Upcoming'}
                                                    </span>
                                                </td>
                                                <td className="text-end">
                                                    <Button
                                                        onClick={() => handleEnterMeeting(meeting)}
                                                        disabled={!meeting.is_enter_enabled}
                                                        style={{
                                                            background: meeting.is_enter_enabled
                                                                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                                                : '#f3f4f6',
                                                            color: meeting.is_enter_enabled ? '#fff' : '#9ca3af',
                                                            border: 'none',
                                                            borderRadius: '20px',
                                                            padding: '6px 16px',
                                                            fontSize: '12px',
                                                            fontWeight: '600',
                                                            cursor: meeting.is_enter_enabled ? 'pointer' : 'not-allowed',
                                                            transition: 'all 0.2s ease',
                                                            boxShadow: meeting.is_enter_enabled ? '0 4px 10px rgba(16, 185, 129, 0.2)' : 'none'
                                                        }}
                                                    >
                                                        Enter Meeting
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AssignedMeetingList;
