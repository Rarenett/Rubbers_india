import React, { useState, useEffect, Fragment } from 'react';
import { Card, Table, Form, Button, Row, Col, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { getMeetings } from '../../../services/MeetingManagementService';
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

const formatTime = (timeString) => {
    if (!timeString) return "";
    const parts = timeString.split(':');
    return `${parts[0]}:${parts[1]}`;
};

const CompletedMeetingsReport = () => {
    usePageTitle("Completed Meetings");
    
    const [meetings, setMeetings] = useState([]);
    const [filteredMeetings, setFilteredMeetings] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [meetingMode, setMeetingMode] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    const statusConfig = {
        approved: { bg: '#dcfce7', color: '#15803d', dot: '#22c55e' },
        rejected: { bg: '#fee2e2', color: '#dc2626', dot: '#ef4444' },
        pending: { bg: '#fef9c3', color: '#92400e', dot: '#f59e0b' },
    };

    const modeConfig = {
        offline: { bg: '#dcfce7', color: '#15803d', dot: '#22c55e' },
        remote: { bg: '#cffafe', color: '#0891b2', dot: '#06b6d4' },
        hybrid: { bg: '#fef3c7', color: '#b45309', dot: '#f59e0b' },
    };

    useEffect(() => {
        fetchMeetings();
    }, []);

    useEffect(() => {
        applyFilters();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meetings, startDate, endDate, meetingMode, searchTerm]);

    const fetchMeetings = async () => {
        try {
            setLoading(true);
            const data = await getMeetings({ status: 'approved' });
            setMeetings(data);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch meetings.' });
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        const now = new Date();
        let filtered = meetings.filter(m => {
            const meetingEnd = new Date(`${m.meeting_date}T${m.end_time}`);
            return meetingEnd < now;
        });

        if (startDate) filtered = filtered.filter(m => m.meeting_date >= startDate);
        if (endDate) filtered = filtered.filter(m => m.meeting_date <= endDate);
        if (meetingMode !== 'all') filtered = filtered.filter(m => m.mode === meetingMode);
        if (searchTerm) {
            const lowSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(m => m.meeting_title?.toLowerCase().includes(lowSearch) || m.meeting_code?.toLowerCase().includes(lowSearch));
        }

        setFilteredMeetings(filtered);
    };

    const handleExport = (format) => {
        const columns = [
            { header: 'Code', dataKey: 'meeting_code' },
            { header: 'Title', dataKey: 'meeting_title' },
            { header: 'Category', dataKey: 'category_name' },
            { header: 'Date', dataKey: 'meeting_date', formatter: (val) => formatDate(val) },
            { header: 'Time', dataKey: 'start_time', formatter: (val, row) => `${formatTime(row.start_time)} - ${formatTime(row.end_time)}` },
            { header: 'Mode', dataKey: 'mode' }
        ];
        const fileName = `Completed_Meetings_Report_${new Date().toISOString().split('T')[0]}`;
        const title = 'Completed Meetings Report';
        if (format === 'pdf') exportToPDF(filteredMeetings, columns, `${fileName}.pdf`, title);
        else if (format === 'excel') exportToExcel(filteredMeetings, columns, `${fileName}.xlsx`);
        else if (format === 'print') printData(filteredMeetings, columns, title);
    };

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
            <Row>
                <Col lg={12}>
                    <Card>
                        <Card.Header className="d-block border-0 pb-0">
                            <div className="d-flex flex-wrap align-items-center justify-content-between mb-3">
                                <Card.Title className="mb-0">Completed Meetings Report</Card.Title>
                                <div className="d-flex align-items-center gap-1">
                                    <ExportBtn onClick={() => handleExport('pdf')} title="Export PDF"><PdfIcon /></ExportBtn>
                                    <ExportBtn onClick={() => handleExport('excel')} title="Export Excel"><ExcelIcon /></ExportBtn>
                                    <ExportBtn onClick={() => handleExport('print')} title="Print"><PrintIcon /></ExportBtn>
                                </div>
                            </div>
                            <Row className="gy-3">
                                <Col md={3}><Form.Group><Form.Label>Start Date</Form.Label><Form.Control type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Form.Group></Col>
                                <Col md={3}><Form.Group><Form.Label>End Date</Form.Label><Form.Control type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Form.Group></Col>
                                <Col md={3}>
                                    <Form.Group>
                                        <Form.Label>Meeting Mode</Form.Label>
                                        <Form.Select value={meetingMode} onChange={(e) => setMeetingMode(e.target.value)}>
                                            <option value="all">All Modes</option>
                                            <option value="remote">Remote</option>
                                            <option value="offline">Offline</option>
                                            <option value="hybrid">Hybrid</option>
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                                <Col md={3}>
                                    <Form.Group>
                                        <Form.Label>Search</Form.Label>
                                        <div className="search-bar-container w-100 mt-0">
                                            <span className="search-icon">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                            </span>
                                            <input type="text" className="search-input" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                        </div>
                                    </Form.Group>
                                </Col>
                            </Row>
                        </Card.Header>
                        <Card.Body>
                            <div className="table-responsive">
                                <table className="table table-responsive-md">
                                    <thead>
                                        <tr>
                                            <th><strong>SI NO</strong></th>
                                            <th><strong>CODE</strong></th>
                                            <th><strong>TITLE</strong></th>
                                            <th><strong>CATEGORY</strong></th>
                                            <th><strong>DATE &amp; TIME</strong></th>
                                            <th><strong>MODE</strong></th>
                                            <th><strong>STATUS</strong></th>
                                        </tr>
                                    </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="7" className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
                                    ) : filteredMeetings.length === 0 ? (
                                        <tr><td colSpan="7" className="text-center py-5 text-muted">No completed meetings found.</td></tr>
                                    ) : (
                                        filteredMeetings.map((m, index) => (
                                            <tr key={m.id}>
                                                <td><strong>{index + 1}</strong></td>
                                                <td><span className="font-w600">{m.meeting_code}</span></td>
                                                <td>{m.meeting_title}</td>
                                                <td>{m.category_name}</td>
                                                <td>{formatDate(m.meeting_date)} <br /><small className="text-primary font-w600">{formatTime(m.start_time)} - {formatTime(m.end_time)}</small></td>
                                                <td>
                                                    {(() => {
                                                        const mc = modeConfig[m.mode] || modeConfig.offline;
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
                                                                {m.mode}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td>
                                                    <span className="badge badge-success light">
                                                        Completed
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default CompletedMeetingsReport;
