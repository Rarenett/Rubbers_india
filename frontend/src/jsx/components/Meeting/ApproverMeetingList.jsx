import React, { useState, useEffect, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Table, Badge, Modal } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getApproverMeetings,
    verifyMeeting,
    getMeetingAgendas,
    getMeetingParticipants
} from '../../../services/MeetingManagementService.js';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import { usePermission } from '../../../hooks/usePermission';
import { formatDate } from '../../../utils/dateUtils';
import '../Assets/FileDashboard.css';

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
const EyeIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);
const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);
const XIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

const formatTime = (timeString) => {
    if (!timeString) return "";
    const parts = timeString.split(':');
    return `${parts[0]}:${parts[1]}`;
};

const ApproverMeetingList = () => {
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { can } = usePermission();

    // View Details modal state
    const [viewModal, setViewModal] = useState(false);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewMeeting, setViewMeeting] = useState(null);
    const [viewParticipants, setViewParticipants] = useState([]);
    const [viewAgendas, setViewAgendas] = useState([]);

    const statusConfig = {
        approved: { bg: '#dcfce7', color: '#15803d', dot: '#22c55e' },
        rejected: { bg: '#fee2e2', color: '#dc2626', dot: '#ef4444' },
        pending: { bg: '#fef9c3', color: '#92400e', dot: '#f59e0b' },
    };

    // Per-meeting hasContent cache: { [meetingId]: bool }
    const [contentCache, setContentCache] = useState({});

    const userDetails = JSON.parse(localStorage.getItem('userDetails')) || {};
    const userId = userDetails.user ? userDetails.user.id : null;

    useEffect(() => {
        if (userId) fetchMeetings();
    }, [userId]);

    const fetchMeetings = async () => {
        try {
            setLoading(true);
            const data = await getApproverMeetings(null, null, true);
            setMeetings(data);
            // Prefetch content availability for all meetings
            checkContentForMeetings(data);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch meetings for approval' });
        } finally {
            setLoading(false);
        }
    };

    const checkContentForMeetings = async (meetingList) => {
        const cache = {};
        await Promise.all(meetingList.map(async (m) => {
            try {
                const [agendas, parts] = await Promise.all([
                    getMeetingAgendas(m.id),
                    getMeetingParticipants(m.id)
                ]);
                const hasAgendas = agendas && agendas.length > 0;
                // Flat shape: array of participant objects
                const hasParts = Array.isArray(parts) && parts.length > 0;
                cache[m.id] = hasAgendas || hasParts;
            } catch {
                cache[m.id] = false;
            }
        }));
        setContentCache(cache);
    };

    const handleView = async (meeting) => {
        setViewMeeting(meeting);
        setViewLoading(true);
        setViewModal(true);
        setViewParticipants([]);
        setViewAgendas([]);
        try {
            const [agendas, parts] = await Promise.all([
                getMeetingAgendas(meeting.id),
                getMeetingParticipants(meeting.id)
            ]);
            setViewAgendas(agendas || []);
            // API returns a flat array: [{id, participant, participant_name, ...}, ...]
            if (Array.isArray(parts) && parts.length > 0) {
                if (parts[0].participant_name !== undefined) {
                    // Flat participant objects (current API shape)
                    setViewParticipants(parts.map(p => ({
                        id: p.participant,
                        name: p.participant_name || `User ${p.participant}`
                    })));
                } else if (parts[0].participant && Array.isArray(parts[0].participant)) {
                    // Legacy shape: first element has arrays of IDs + names
                    const mp = parts[0];
                    setViewParticipants(mp.participant.map((id, i) => ({
                        id,
                        name: mp.participant_names?.[i] || `User ${id}`
                    })));
                }
            }
        } catch {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load meeting details' });
        } finally {
            setViewLoading(false);
        }
    };

    const handleVerify = async (id, status, title) => {
        const actionText = status === 'approved' ? 'Approve' : 'Reject';
        const result = await Swal.fire({
            title: `${actionText} Meeting?`,
            text: `Are you sure you want to ${status} "${title}"?`,
            icon: status === 'approved' ? 'success' : 'warning',
            showCancelButton: true,
            confirmButtonColor: status === 'approved' ? '#3085d6' : '#d33',
            confirmButtonText: `Yes, ${actionText}`
        });
        if (result.isConfirmed) {
            try {
                await verifyMeeting(id, status);
                Swal.fire({ icon: 'success', title: 'Success', text: `Meeting ${status} successfully`, timer: 1500 });
                fetchMeetings();
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: `Failed to ${status} meeting` });
            }
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'approved': return <Badge bg="success">APPROVED</Badge>;
            case 'rejected': return <Badge bg="danger">REJECTED</Badge>;
            default: return <Badge bg="warning" text="dark">PENDING</Badge>;
        }
    };

    const handleExport = (format) => {
        const filtered = meetings.filter(m => {
            const searchStr = `${m.meeting_code} ${m.meeting_title} ${m.created_by_name} ${m.room_name} ${m.approval_status}`.toLowerCase();
            return searchStr.includes(searchTerm.toLowerCase());
        });

        const columns = [
            { header: 'Code', dataKey: 'meeting_code' },
            { header: 'Title', dataKey: 'meeting_title' },
            { header: 'Requested By', dataKey: 'created_by_name' },
            { header: 'Date', dataKey: 'meeting_date', formatter: (val) => formatDate(val) },
            { header: 'Time', dataKey: 'start_time', formatter: (val, row) => `${formatTime(row.start_time)} - ${formatTime(row.end_time)}` },
            { header: 'Room', dataKey: 'room_name' },
            { header: 'Status', dataKey: 'approval_status' }
        ];

        const fileName = `Approval_Meetings_${new Date().toISOString().split('T')[0]}`;
        const title = 'Meetings for My Approval Report';

        if (format === 'pdf') exportToPDF(filtered, columns, `${fileName}.pdf`, title);
        else if (format === 'excel') exportToExcel(filtered, columns, `${fileName}.xlsx`);
        else if (format === 'print') printData(filtered, columns, title);
    };

    const filteredMeetings = meetings.filter(m => {
        if (!searchTerm) return true;
        const searchStr = `${m.meeting_code} ${m.meeting_title} ${m.created_by_name} ${m.room_name} ${m.approval_status}`.toLowerCase();
        return searchStr.includes(searchTerm.toLowerCase());
    });

    return (
        <div className="container-fluid">
            <style>{`
 .view-details-btn {
 background: #f8f9fa;
 border: 1.5px solid #dee2e6;
 border-radius: 6px;
 padding: 4px 12px;
 font-size: 12px;
 font-weight: 600;
 color: #495057;
 cursor: pointer;
 transition: all 0.15s;
 display: inline-flex;
 align-items: center;
 gap: 5px;
 }
 .view-details-btn:hover:not(:disabled) {
 background: #e9ecef;
 border-color: #adb5bd;
 color: #212529;
 }
 .view-details-btn:disabled {
 opacity: 0.4;
 cursor: not-allowed;
 }
 .detail-section-title {
 font-size: 11px;
 font-weight: 700;
 letter-spacing: 1px;
 text-transform: uppercase;
 color: #6c757d;
 margin-bottom: 10px;
 padding-bottom: 6px;
 border-bottom: 1px solid #f1f5f9;
 }
 .participant-chip {
 display: inline-flex;
 align-items: center;
 gap: 6px;
 background: #f0f4ff;
 border: 1px solid #d0dcff;
 border-radius: 50px;
 padding: 4px 12px;
 font-size: 13px;
 font-weight: 500;
 color: #2d3748;
 margin: 4px 4px 4px 0;
 }
 .participant-chip .avatar {
 width: 22px;
 height: 22px;
 border-radius: 50%;
 background: #4f6ef7;
 color: #fff;
 display: inline-flex;
 align-items: center;
 justify-content: center;
 font-size: 10px;
 font-weight: 700;
 flex-shrink: 0;
 }
 .agenda-detail-row {
 background: #fff;
 border: 1px solid #e9ecef;
 border-radius: 8px;
 padding: 12px 16px;
 margin-bottom: 8px;
 }
 .agenda-detail-row .agenda-num {
 width: 24px;
 height: 24px;
 border-radius: 6px;
 background: #e9ecef;
 display: inline-flex;
 align-items: center;
 justify-content: center;
 font-size: 11px;
 font-weight: 700;
 color: #495057;
 flex-shrink: 0;
 }
 .agenda-detail-row .agenda-title {
 font-weight: 600;
 font-size: 14px;
 color: #212529;
 }
 .agenda-detail-row .agenda-meta {
 font-size: 12px;
 color: #6c757d;
 display: flex;
 gap: 14px;
 margin-top: 4px;
 flex-wrap: wrap;
 }
 .detail-modal .modal-header {
 border-bottom: 1px solid #f1f5f9;
 padding: 16px 20px;
 }
 .detail-modal .modal-body {
 padding: 20px 24px;
 background: #f8f9fc;
 }
 .detail-tab {
 display: flex;
 gap: 8px;
 margin-bottom: 20px;
 }
 .detail-section {
 background: #fff;
 border-radius: 10px;
 padding: 16px;
 border: 1px solid #e9ecef;
 margin-bottom: 16px;
 }
 .count-badge {
 background: #e9ecef;
 border-radius: 50px;
 padding: 1px 8px;
 font-size: 11px;
 font-weight: 700;
 color: #495057;
 margin-left: 6px;
 }
 `}</style>

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
                            <Card.Title className="mb-0 text-nowrap">Meetings for My Approval</Card.Title>
                            <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                                <div className="search-bar-container w-100 m-0" style={{ maxWidth: '250px' }}>
                                    <span className="search-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Search requests..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                                    <div className="d-flex align-items-center gap-2">
                                        <ExportBtn onClick={() => handleExport('pdf')} title="Export PDF"><PdfIcon /></ExportBtn>
                                        <ExportBtn onClick={() => handleExport('excel')} title="Export Excel"><ExcelIcon /></ExportBtn>
                                        <ExportBtn onClick={() => handleExport('print')} title="Print"><PrintIcon /></ExportBtn>
                                    </div>
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <div className="table-responsive">
                                <table className="table table-responsive-md">
                                    <thead>
                                        <tr>
                                            <th><strong>CODE</strong></th>
                                            <th><strong>TITLE</strong></th>
                                            <th><strong>REQUESTED BY</strong></th>
                                            <th><strong>DATE &amp; TIME</strong></th>
                                            <th><strong>ROOM</strong></th>
                                            <th><strong>STATUS</strong></th>
                                            <th className="text-center"><strong>DETAILS</strong></th>
                                            <th className="text-center"><strong>ACTIONS</strong></th>
                                        </tr>
                                    </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="8" className="text-center">Loading...</td></tr>
                                    ) : filteredMeetings.length === 0 ? (
                                        <tr><td colSpan="8" className="text-center">No meetings found</td></tr>
                                    ) : (
                                        filteredMeetings.map(meeting => (
                                            <tr key={meeting.id}>
                                                <td><strong>{meeting.meeting_code}</strong></td>
                                                <td>{meeting.meeting_title}</td>
                                                <td>{meeting.created_by_name}</td>
                                                <td>
                                                    {formatDate(meeting.meeting_date)} <br />
                                                    <small className="text-muted">{formatTime(meeting.start_time)} - {formatTime(meeting.end_time)}</small>
                                                </td>
                                                <td>{meeting.room_name || 'N/A'}</td>
                                                <td>
                                                    <span className={`badge badge-${
                                                        meeting.approval_status === 'approved' ? 'success' :
                                                        meeting.approval_status === 'rejected' ? 'danger' : 'warning'
                                                    } light`}>
                                                        {meeting.approval_status ? (meeting.approval_status.charAt(0).toUpperCase() + meeting.approval_status.slice(1)) : 'Pending'}
                                                    </span>
                                                </td>

                                                {/* ── View Details ── */}
                                                <td className="text-center">
                                                    <button
                                                        onClick={() => handleView(meeting)}
                                                        disabled={contentCache[meeting.id] === false}
                                                        style={{
                                                            padding: '6px 14px',
                                                            borderRadius: '20px',
                                                            background: contentCache[meeting.id] === false ? '#f3f4f6' : '#eff6ff',
                                                            color: contentCache[meeting.id] === false ? '#9ca3af' : '#2563eb',
                                                            border: 'none',
                                                            fontSize: '11px',
                                                            fontWeight: '700',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            cursor: contentCache[meeting.id] === false ? 'not-allowed' : 'pointer',
                                                            transition: 'all 0.2s ease',
                                                        }}
                                                        title={contentCache[meeting.id] === false ? 'No participants or agendas added' : 'View participants & agendas'}
                                                    >
                                                        <EyeIcon /> View
                                                    </button>
                                                </td>

                                                {/* ── Approve / Reject ── */}
                                                <td className="text-center">
                                                    {can('meetings', 'approve') && meeting.approval_status === 'pending' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleVerify(meeting.id, 'approved', meeting.meeting_title)}
                                                                style={{
                                                                    padding: '6px 12px',
                                                                    borderRadius: '20px',
                                                                    background: '#dcfce7',
                                                                    color: '#15803d',
                                                                    border: 'none',
                                                                    fontSize: '11px',
                                                                    fontWeight: '700',
                                                                    marginRight: '8px',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px'
                                                                }}
                                                            >
                                                                <CheckIcon /> Approve
                                                            </button>
                                                            <button
                                                                onClick={() => handleVerify(meeting.id, 'rejected', meeting.meeting_title)}
                                                                style={{
                                                                    padding: '6px 12px',
                                                                    borderRadius: '20px',
                                                                    background: '#fee2e2',
                                                                    color: '#dc2626',
                                                                    border: 'none',
                                                                    fontSize: '11px',
                                                                    fontWeight: '700',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px'
                                                                }}
                                                            >
                                                                <XIcon /> Reject
                                                            </button>
                                                        </>
                                                    )}
                                                    {(!can('meetings', 'approve') || meeting.approval_status !== 'pending') && (
                                                        <span className="text-muted small">
                                                            {meeting.approval_status !== 'pending' ? 'Processed' : <span className="badge badge-danger light">No Access</span>}
                                                        </span>
                                                    )}
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

            {/* ═══ DETAILS MODAL ═══ */}
            <Modal
                show={viewModal}
                onHide={() => setViewModal(false)}
                size="lg"
                centered
                enforceFocus={false}
                className="detail-modal"
            >
                <Modal.Header closeButton>
                    <div>
                        <div style={{ fontSize: 11, color: '#6c757d', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                            Meeting Details
                        </div>
                        <Modal.Title style={{ fontSize: 17, fontWeight: 700, color: '#212529' }}>
                            {viewMeeting?.meeting_title}
                        </Modal.Title>
                        {viewMeeting && (
                            <div style={{ fontSize: 12, color: '#6c757d', marginTop: 4, display: 'flex', gap: 16 }}>
                                <span><i className="fa fa-calendar me-1"></i>{formatDate(viewMeeting.meeting_date)}</span>
                                <span><i className="fa fa-clock-o me-1"></i>{formatTime(viewMeeting.start_time)} – {formatTime(viewMeeting.end_time)}</span>
                                {viewMeeting.room_name && <span><i className="fa fa-map-marker me-1"></i>{viewMeeting.room_name}</span>}
                            </div>
                        )}
                    </div>
                </Modal.Header>

                <Modal.Body>
                    {viewLoading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status" style={{ width: 36, height: 36 }} />
                            <div className="mt-2 text-muted small">Loading details...</div>
                        </div>
                    ) : (
                        <>
                            {/* Participants */}
                            <div className="detail-section">
                                <div className="detail-section-title">
                                    <i className="fa fa-users me-1"></i>
                                    Participants
                                    <span className="count-badge">{viewParticipants.length}</span>
                                </div>
                                {viewParticipants.length === 0 ? (
                                    <div className="text-muted small">No participants added.</div>
                                ) : (
                                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                                        {viewParticipants.map((p, i) => (
                                            <span key={i} className="participant-chip">
                                                <span className="avatar">
                                                    {p.name.charAt(0).toUpperCase()}
                                                </span>
                                                {p.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Agendas */}
                            <div className="detail-section">
                                <div className="detail-section-title">
                                    <i className="fa fa-list-ul me-1"></i>
                                    Agenda Points
                                    <span className="count-badge">{viewAgendas.length}</span>
                                </div>
                                {viewAgendas.length === 0 ? (
                                    <div className="text-muted small">No agenda points added.</div>
                                ) : (
                                    viewAgendas.map((agenda, index) => (
                                        <div key={agenda.id} className="agenda-detail-row">
                                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                                <span className="agenda-num">{index + 1}</span>
                                                <div style={{ flex: 1 }}>
                                                    <div className="agenda-title">{agenda.points}</div>
                                                    {agenda.details && (
                                                        <div style={{ fontSize: 12, color: '#6c757d', marginTop: 2 }}>{agenda.details}</div>
                                                    )}
                                                    <div className="agenda-meta">
                                                        {agenda.presenter_name && (
                                                            <span><i className="fa fa-user me-1"></i>{agenda.presenter_name}</span>
                                                        )}
                                                        {agenda.duration_minutes && (
                                                            <span><i className="fa fa-clock-o me-1"></i>{agenda.duration_minutes} min</span>
                                                        )}
                                                        {agenda.file_upload_url && (
                                                            <a href={agenda.file_upload_url} target="_blank" rel="noopener noreferrer"
                                                                style={{ color: '#e67e22', fontWeight: 600 }}>
                                                                <i className="fa fa-paperclip me-1"></i>Attachment
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </Modal.Body>

                <Modal.Footer style={{ borderTop: '1px solid #f1f5f9', padding: '12px 20px' }}>
                    <Button variant="secondary" size="sm" onClick={() => setViewModal(false)}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ApproverMeetingList;
