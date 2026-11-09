import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col, Badge, Table } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getMeetingAgendas,
    createMeetingAgenda,
    updateMeetingAgenda,
    deleteMeetingAgenda,
    getMeetingParticipants
} from '../../../services/MeetingManagementService.js';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import { usePermission } from '../../../hooks/usePermission';

// ─── Reusable icon button with tooltip ───────────────────────────────────────
function IconBtn({ onClick, title, disabled = false, variant = "outline-primary", className = "me-1", children }) {
    const [hov, setHov] = useState(false);
    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
                type="button"
                onClick={onClick}
                disabled={disabled}
                onMouseEnter={() => !disabled && setHov(true)}
                onMouseLeave={() => setHov(false)}
                className={`btn btn-sm btn-${variant} shadow d-inline-flex align-items-center justify-content-center ${className}`}
                style={{
                    width: '28px', height: '28px',
                    padding: 0,
                    borderRadius: '6px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.35 : 1,
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                }}
            >
                {children}
            </button>
            {hov && !disabled && (
                <div style={{
                    position: 'absolute', bottom: 'calc(100% + 7px)', left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#111827', color: '#f9fafb',
                    fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                    padding: '4px 9px', borderRadius: 6,
                    pointerEvents: 'none',
                    zIndex: 2000,
                }}>
                    {title}
                    <div style={{
                        position: 'absolute', top: '100%', left: '50%',
                        transform: 'translateX(-50%)',
                        borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                        borderTop: '5px solid #111827',
                    }} />
                </div>
            )}
        </div>
    );
}

// ─── Export button (no background, icon-only) ─────────────────────────────────
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
const EditIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const DeleteIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const AddIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.25)" />
        <line x1="12" y1="7" x2="12" y2="17" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="7" y1="12" x2="17" y2="12" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
);

const AgendaManagement = ({ show, onHide, meetingId, meetingTitle }) => {
    const [agendas, setAgendas] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editIndex, setEditIndex] = useState(null); // null = add mode, number = edit mode
    const { can } = usePermission();

    const [tempAgendas, setTempAgendas] = useState([{
        id: null, meeting: meetingId, points: '', details: '',
        duration_minutes: 15, presenter: '', file_upload: null
    }]);

    useEffect(() => {
        if (show && meetingId) fetchData();
    }, [show, meetingId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [agendaData, partData] = await Promise.all([
                getMeetingAgendas(meetingId),
                getMeetingParticipants(meetingId)
            ]);
            setAgendas(Array.isArray(agendaData) ? agendaData : []);

            // partData is now an array of detailed user/employee objects
            if (Array.isArray(partData)) {
                setParticipants(partData.map(p => ({
                    id: p.id || p.user, // Handle both user id and employee id if they differ
                    name: p.user_name || p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || `User ${p.id}`
                })));
            } else {
                setParticipants([]);
            }
        } catch {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load agendas' });
        } finally {
            setLoading(false);
        }
    };

    const handleExport = (type) => {
        if (!agendas || agendas.length === 0) {
            Swal.fire('Info', 'No agendas to export', 'info');
            return;
        }
        const columns = [
            { header: 'Points', dataKey: 'points' },
            { header: 'Details', dataKey: 'details' },
            { header: 'Presenter', dataKey: 'presenter_name' },
            { header: 'Duration (min)', dataKey: 'duration_minutes' }
        ];
        const fileName = `Agendas_${meetingTitle || 'Meeting'}`;
        const title = `Meeting Agendas: ${meetingTitle || ''}`;

        if (type === 'pdf') exportToPDF(agendas, columns, `${fileName}.pdf`, title);
        else if (type === 'excel') exportToExcel(agendas, columns, `${fileName}.xlsx`);
        else if (type === 'print') printData(agendas, columns, title);
    };

    const handleAddRow = () => setTempAgendas([...tempAgendas, {
        id: null, meeting: meetingId, points: '', details: '',
        duration_minutes: 15, presenter: '', file_upload: null
    }]);

    const handleRemoveRow = (index) => {
        if (tempAgendas.length > 1) setTempAgendas(tempAgendas.filter((_, i) => i !== index));
    };

    const handleFieldChange = (index, field, value) => {
        const updated = [...tempAgendas];
        updated[index][field] = value;
        setTempAgendas(updated);
    };

    const handleFileChange = (index, file) => {
        const updated = [...tempAgendas];
        updated[index].file_upload = file;
        setTempAgendas(updated);
    };

    const handleSubmitAll = async () => {
        try {
            setLoading(true);
            if (tempAgendas.some(a => !a.points.trim())) {
                Swal.fire('Warning', 'Agenda title is required for all items', 'warning');
                return;
            }
            await Promise.all(tempAgendas.map(agenda =>
                agenda.id
                    ? updateMeetingAgenda(agenda.id, agenda)
                    : createMeetingAgenda({ ...agenda, meeting: meetingId })
            ));
            Swal.fire({ icon: 'success', title: 'Saved!', text: 'Agendas saved successfully', timer: 1500, showConfirmButton: false });
            setShowForm(false);
            fetchData();
        } catch {
            Swal.fire('Error', 'Failed to save agendas', 'error');
        } finally {
            setLoading(false);
        }
    };

    const startAdd = () => {
        setEditIndex(null);
        setTempAgendas([{ id: null, meeting: meetingId, points: '', details: '', duration_minutes: 15, presenter: '', file_upload: null }]);
        setShowForm(true);
    };

    const itemOffset = agendas.length;

    const startEdit = (agenda) => {
        const idx = agendas.findIndex(a => a.id === agenda.id);
        setEditIndex(idx >= 0 ? idx : 0);
        setTempAgendas([{ id: agenda.id, meeting: meetingId, points: agenda.points, details: agenda.details, duration_minutes: agenda.duration_minutes, presenter: agenda.presenter || '', file_upload: null }]);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Delete this agenda point?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e74c3c',
            cancelButtonColor: '#95a5a6',
            confirmButtonText: 'Yes, delete it'
        });
        if (result.isConfirmed) {
            try {
                await deleteMeetingAgenda(id);
                fetchData();
                Swal.fire({ icon: 'success', title: 'Deleted!', text: 'Agenda point removed.', timer: 1200, showConfirmButton: false });
            } catch {
                Swal.fire('Error', 'Failed to delete agenda point', 'error');
            }
        }
    };

    const totalDuration = agendas.reduce((sum, a) => sum + (parseInt(a.duration_minutes) || 0), 0);

    return (
        <>
            <style>{`
 .agenda-modal .modal-content {
 border: none;
 border-radius: 12px;
 box-shadow: 0 20px 60px rgba(0,0,0,0.12);
 background: #f8f9fc;
 overflow: hidden;
 }

 /* ── Header ── */
 .agenda-modal .modal-header {
 background: #fff;
 border-bottom: 1px solid #f1f5f9;
 padding: 20px 28px 18px;
 position: relative;
 }
 .agenda-modal .modal-header .btn-close {
 position: absolute;
 top: 18px;
 right: 20px;
 }
 .agenda-modal .breadcrumb-text {
 font-size: 11px;
 letter-spacing: 1.5px;
 text-transform: uppercase;
 color: #94a3b8;
 margin-bottom: 6px;
 display: flex;
 align-items: center;
 gap: 6px;
 }
 .agenda-modal .modal-title-text {
 font-weight: 700;
 font-size: 18px;
 color: #1e293b;
 margin: 0;
 line-height: 1.3;
 }
 .agenda-modal .meeting-title-accent {
 color: var(--primary, #6610f2);
 }
 .agenda-modal .header-stats {
 display: flex;
 gap: 14px;
 margin-top: 14px;
 }
 .agenda-modal .stat-pill {
 background: #f8f9fa;
 border: 1px solid #e9ecef;
 border-radius: 50px;
 padding: 4px 12px;
 font-size: 12px;
 color: #64748b;
 display: flex;
 align-items: center;
 gap: 5px;
 }
 .agenda-modal .stat-pill i { color: var(--primary, #6610f2); font-size: 11px; }

 /* ── Body ── */
 .agenda-modal .modal-body {
 padding: 28px 36px;
 background: #f8f9fc;
 min-height: 340px;
 }

 /* ── Toolbar ── */
 .agenda-toolbar {
 display: flex;
 justify-content: space-between;
 align-items: center;
 margin-bottom: 22px;
 }
 .agenda-section-label {
 font-size: 13px;
 font-weight: 700;
 letter-spacing: 1px;
 text-transform: uppercase;
 color: #64748b;
 }
 .agenda-add-btn {
 background: var(--primary, #6610f2) !important;
 border: none !important;
 border-radius: 50px !important;
 padding: 7px 18px !important;
 font-weight: 600 !important;
 font-size: 13px !important;
 color: #fff !important;
 box-shadow: 0 3px 10px rgba(0,0,0,0.12) !important;
 transition: all 0.2s !important;
 display: flex !important;
 align-items: center !important;
 gap: 6px !important;
 }
 .agenda-add-btn:hover {
 transform: translateY(-1px) !important;
 box-shadow: 0 5px 16px rgba(0,0,0,0.18) !important;
 }

 /* ── Table ── */
 .agenda-table-wrap {
 border-radius: 14px;
 overflow: hidden;
 border: 1px solid #e2e8f0;
 box-shadow: 0 2px 12px rgba(15,23,42,0.06);
 background: #fff;
 }
 .agenda-table {
 margin: 0 !important;
 }
 .agenda-table thead tr {
 background: #f1f5f9 !important;
 }
 .agenda-table thead th {
 font-size: 11px;
 font-weight: 700;
 letter-spacing: 1px;
 text-transform: uppercase;
 color: #94a3b8;
 padding: 12px 18px;
 border: none !important;
 white-space: nowrap;
 }
 .agenda-table tbody tr {
 border-bottom: 1px solid #f1f5f9 !important;
 transition: background 0.15s;
 }
 .agenda-table tbody tr:last-child { border-bottom: none !important; }
 .agenda-table tbody tr:hover { background: #f8fafc !important; }
 .agenda-table tbody td {
 padding: 16px 18px;
 border: none !important;
 vertical-align: middle;
 }

 .agenda-index-badge {
 width: 26px; height: 26px;
 background: #f1f5f9;
 border-radius: 6px;
 display: inline-flex;
 align-items: center;
 justify-content: center;
 font-size: 12px;
 font-weight: 700;
 color: #64748b;
 }
 .agenda-point-title {
 font-weight: 600;
 color: #0f172a;
 font-size: 14px;
 margin-bottom: 3px;
 }
 .agenda-point-detail {
 font-size: 12px;
 color: #94a3b8;
 max-width: 260px;
 white-space: nowrap;
 overflow: hidden;
 text-overflow: ellipsis;
 }
 .presenter-tag {
 display: inline-flex;
 align-items: center;
 gap: 6px;
 background: #eff6ff;
 border: 1px solid #bfdbfe;
 border-radius: 50px;
 padding: 3px 10px;
 font-size: 12px;
 font-weight: 600;
 color: #1d4ed8;
 }
 .presenter-avatar {
 width: 18px; height: 18px;
 background: #dbeafe;
 border-radius: 50%;
 display: inline-flex;
 align-items: center;
 justify-content: center;
 font-size: 9px;
 color: #1d4ed8;
 }
 .duration-tag {
 display: inline-flex;
 align-items: center;
 gap: 5px;
 background: #f0fdf4;
 border: 1px solid #bbf7d0;
 border-radius: 50px;
 padding: 3px 10px;
 font-size: 12px;
 font-weight: 600;
 color: #16a34a;
 }
 .file-link-btn {
 background: #fff7ed !important;
 border: 1px solid #fed7aa !important;
 border-radius: 50px !important;
 padding: 3px 10px !important;
 font-size: 12px !important;
 font-weight: 600 !important;
 color: #ea580c !important;
 text-decoration: none !important;
 display: inline-flex !important;
 align-items: center !important;
 gap: 5px !important;
 transition: all 0.15s !important;
 }
 .file-link-btn:hover { background: #ffedd5 !important; }
 .no-file-text { font-size: 12px; color: #cbd5e1; }
 .action-btn-edit, .action-btn-del {
 width: 34px; height: 34px;
 border-radius: 8px;
 border: none;
 display: inline-flex;
 align-items: center;
 justify-content: center;
 cursor: pointer;
 transition: all 0.18s;
 opacity: 1 !important;
 line-height: 1;
 }
 .action-btn-edit, .action-btn-del,
 .action-btn-edit i, .action-btn-del i {
 font-family: FontAwesome, sans-serif !important;
 }
 .action-btn-edit i, .action-btn-del i {
 font-size: 15px !important;
 line-height: 1 !important;
 display: block;
 }
 .action-btn-edit { background: #2563eb; color: #fff !important; }
 .action-btn-edit:hover { background: #1d4ed8; }
 .action-btn-del { background: #dc2626; color: #fff !important; }
 .action-btn-del:hover { background: #b91c1c; }
 .empty-state {
 text-align: center;
 padding: 56px 20px;
 }
 .empty-state-icon {
 width: 64px; height: 64px;
 background: #f1f5f9;
 border-radius: 20px;
 display: inline-flex;
 align-items: center;
 justify-content: center;
 font-size: 28px;
 color: #cbd5e1;
 margin-bottom: 14px;
 }
 .empty-state-text { font-size: 14px; color: #94a3b8; }

 /* ── Form view ── */
 .form-section-header {
 display: flex;
 justify-content: space-between;
 align-items: center;
 margin-bottom: 22px;
 }
 .form-section-title {
 font-weight: 700;
 font-size: 15px;
 color: #1e3a5f;
 }
 .add-more-btn {
 background: #fff !important;
 border: 1.5px dashed #93c5fd !important;
 border-radius: 50px !important;
 padding: 6px 16px !important;
 font-size: 12px !important;
 font-weight: 600 !important;
 color: #2563eb !important;
 transition: all 0.2s !important;
 }
 .add-more-btn:hover {
 background: #eff6ff !important;
 border-color: #3b82f6 !important;
 }

 .agenda-form-card {
 background: #fff;
 border: 1px solid #e2e8f0;
 border-radius: 16px;
 overflow: hidden;
 margin-bottom: 14px;
 box-shadow: 0 2px 8px rgba(15,23,42,0.05);
 transition: box-shadow 0.2s;
 animation: slideUp 0.25s ease forwards;
 }
 .agenda-form-card:hover { box-shadow: 0 4px 20px rgba(15,23,42,0.09); }
 @keyframes slideUp {
 from { opacity: 0; transform: translateY(10px); }
 to { opacity: 1; transform: translateY(0); }
 }
 .card-item-header {
 background: #f8fafc;
 border-bottom: 1px solid #f1f5f9;
 padding: 10px 18px;
 display: flex;
 justify-content: space-between;
 align-items: center;
 }
 .item-num-badge {
 font-size: 11px;
 font-weight: 700;
 letter-spacing: 1px;
 text-transform: uppercase;
 background: var(--primary, #6610f2);
 color: #fff;
 border-radius: 6px;
 padding: 3px 10px;
 }
 .remove-item-btn {
 background: none;
 border: none;
 font-size: 12px;
 font-weight: 600;
 color: #e11d48;
 cursor: pointer;
 display: flex;
 align-items: center;
 gap: 4px;
 padding: 2px 8px;
 border-radius: 6px;
 transition: background 0.15s;
 }
 .remove-item-btn:hover { background: #fff1f2; }
 .card-item-body { padding: 18px; }
 .form-label-styled {
 font-size: 11px;
 font-weight: 700;
 letter-spacing: 0.8px;
 text-transform: uppercase;
 color: #64748b;
 margin-bottom: 6px;
 display: block;
 }
 .form-control-styled, .form-select-styled {
 border: 1.5px solid #e2e8f0 !important;
 border-radius: 8px !important;
 padding: 0 14px !important;
 height: 42px !important;
 font-size: 13.5px !important;
 color: #0f172a !important;
 background: #fafbfd !important;
 box-shadow: none !important;
 transition: border-color 0.2s, box-shadow 0.2s !important;
 display: flex !important;
 align-items: center !important;
 }
 .form-control-styled:focus, .form-select-styled:focus {
 border-color: var(--primary) !important;
 box-shadow: 0 0 0 3px rgba(102,16,242,0.1) !important;
 background: #fff !important;
 }
 textarea.form-control-styled { resize: vertical !important; height: auto !important; min-height: 70px !important; padding: 10px 14px !important; }

 .file-upload-zone {
 border: 1.5px dashed #cbd5e1;
 border-radius: 8px;
 cursor: pointer;
 position: relative;
 background: #fafbfd;
 transition: all 0.2s;
 height: 42px;
 display: flex;
 align-items: center;
 justify-content: center;
 gap: 6px;
 font-size: 13px;
 font-weight: 600;
 color: #94a3b8;
 padding: 0;
 }
 .file-upload-zone.has-file {
 border-color: #22c55e;
 background: #f0fdf4;
 color: #16a34a;
 }
 .file-upload-zone input[type="file"] {
 position: absolute;
 inset: 0;
 opacity: 0;
 cursor: pointer;
 width: 100%;
 height: 100%;
 }
 .file-upload-zone:hover:not(.has-file) {
 border-color: var(--primary);
 background: #f5f0ff;
 color: var(--primary);
 }

 /* ── Footer ── */
 .agenda-modal .modal-footer {
 border: none;
 background: #fff;
 padding: 18px 36px;
 border-top: 1px solid #f1f5f9;
 display: flex;
 gap: 12px;
 justify-content: flex-start;
 }
 .btn-submit-agenda {
 background: var(--primary, #6610f2) !important;
 border: none !important;
 border-radius: 8px !important;
 padding: 10px 28px !important;
 font-weight: 700 !important;
 font-size: 14px !important;
 color: #fff !important;
 box-shadow: 0 4px 12px rgba(0,0,0,0.12) !important;
 transition: all 0.2s !important;
 min-width: 140px;
 }
 .btn-submit-agenda:hover:not(:disabled) {
 transform: translateY(-1px) !important;
 box-shadow: 0 6px 18px rgba(0,0,0,0.18) !important;
 }
 .btn-submit-agenda:disabled { opacity: 0.65 !important; }
 .btn-back-agenda {
 background: #fff !important;
 border: 1.5px solid #e2e8f0 !important;
 border-radius: 10px !important;
 padding: 10px 24px !important;
 font-family: 'DM Sans', sans-serif !important;
 font-weight: 600 !important;
 font-size: 14px !important;
 color: #64748b !important;
 transition: all 0.15s !important;
 }
 .btn-back-agenda:hover {
 border-color: #94a3b8 !important;
 color: #0f172a !important;
 }

 /* Loading pulse */
 .loading-overlay {
 position: absolute; inset: 0;
 background: rgba(248,249,252,0.75);
 backdrop-filter: blur(3px);
 display: flex; align-items: center; justify-content: center;
 z-index: 10; border-radius: 20px;
 }
 .loading-spinner {
 width: 36px; height: 36px;
 border: 3px solid #e2e8f0;
 border-top-color: #3b82f6;
 border-radius: 50%;
 animation: spin 0.7s linear infinite;
 }
 @keyframes spin { to { transform: rotate(360deg); } }
 `}</style>

            <Modal show={show} onHide={() => onHide(false)} size="xl" centered scrollable className="agenda-modal" enforceFocus={false} restoreFocus={true}>
                {/* ── HEADER ── */}
                <Modal.Header closeButton>
                    <div className="w-100">
                        <div className="breadcrumb-text">
                            <i className="fa fa-th-large"></i> Dashboard
                            <span className="text-muted">›</span>
                            Meetings
                            <span className="text-muted">›</span>
                            Agenda
                        </div>
                        <h4 className="modal-title-text">
                            {meetingTitle
                                ? <><span className="text-muted fw-normal" style={{ fontSize: '0.9em' }}>Agenda for </span><span className="meeting-title-accent">{meetingTitle}</span></>
                                : 'Meeting Agenda'
                            }
                        </h4>
                        <div className="header-stats">
                            <div className="stat-pill">
                                <i className="fa fa-list-ul"></i>
                                {agendas.length} {agendas.length === 1 ? 'Point' : 'Points'}
                            </div>
                            {totalDuration > 0 && (
                                <div className="stat-pill">
                                    <i className="fa fa-clock-o"></i>
                                    {totalDuration} min total
                                </div>
                            )}
                            {participants.length > 0 && (
                                <div className="stat-pill">
                                    <i className="fa fa-users"></i>
                                    {participants.length} Participants
                                </div>
                            )}
                        </div>
                    </div>
                </Modal.Header>

                {/* ── BODY ── */}
                <Modal.Body style={{ position: 'relative' }}>
                    {loading && (
                        <div className="loading-overlay">
                            <div className="loading-spinner" />
                        </div>
                    )}

                    {!showForm ? (
                        /* ─── LIST VIEW ─── */
                        <div>
                            <div className="agenda-toolbar">
                                <span className="agenda-section-label">
                                    Agenda Points <span style={{ color: '#cbd5e1', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({agendas.length})</span>
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', background: '#fff', padding: '2px 8px', borderRadius: '12px', border: '1px solid #eef2ff' }}>
                                        <ExportBtn onClick={() => handleExport('pdf')} title="Export PDF"><PdfIcon /></ExportBtn>
                                        <ExportBtn onClick={() => handleExport('excel')} title="Export Excel"><ExcelIcon /></ExportBtn>
                                        <ExportBtn onClick={() => handleExport('print')} title="Print Report"><PrintIcon /></ExportBtn>
                                    </div>
                                    <div style={{ width: '1px', height: '24px', background: '#e2e8f0' }} />
                                    {can('meetings', 'create') && (
                                        <button
                                            onClick={() => startAdd()}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 7,
                                                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                                border: 'none', borderRadius: 10, padding: '7px 16px',
                                                fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
                                                boxShadow: '0 4px 14px #6366f140',
                                                transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px #6366f155'; }}
                                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px #6366f140'; }}
                                        >
                                            <AddIcon /> Agenda Points
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="agenda-table-wrap">
                                <Table className="agenda-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 52 }}>#</th>
                                            <th>Points &amp; Details</th>
                                            <th>Presenter</th>
                                            <th>Duration</th>
                                            <th>File</th>
                                            <th style={{ textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {agendas.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{ padding: 0, border: 'none' }}>
                                                    <div className="empty-state">
                                                        <div className="empty-state-icon">📋</div>
                                                        <div style={{ fontWeight: 700, color: '#475569', marginBottom: 6 }}>No agenda points yet</div>
                                                        <div className="empty-state-text">Click "Add Agenda Points" to get started</div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            agendas.map((agenda, index) => (
                                                <tr key={agenda.id}>
                                                    <td><span className="agenda-index-badge">{index + 1}</span></td>
                                                    <td>
                                                        <div className="agenda-point-title">{agenda.points}</div>
                                                        {agenda.details && <div className="agenda-point-detail">{agenda.details}</div>}
                                                    </td>
                                                    <td>
                                                        <span className="presenter-tag">
                                                            <span className="presenter-avatar"><i className="fa fa-user" style={{ fontSize: 8 }}></i></span>
                                                            {agenda.presenter_name || 'Unassigned'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="duration-tag">
                                                            <i className="fa fa-clock-o" style={{ fontSize: 11 }}></i>
                                                            {agenda.duration_minutes} min
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {agenda.file_upload_url
                                                            ? <a href={agenda.file_upload_url} target="_blank" rel="noopener noreferrer" className="file-link-btn">
                                                                <i className="fa fa-paperclip"></i> View
                                                            </a>
                                                            : <span className="no-file-text">—</span>
                                                        }
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {can('meetings', 'edit') || can('meetings', 'delete') ? (
                                                            <div style={{ display: 'inline-flex', gap: 6 }}>
                                                                {can('meetings', 'edit') && (
                                                                    <IconBtn variant="outline-primary" onClick={() => startEdit(agenda)} title="Edit Agenda">
                                                                        <EditIcon />
                                                                    </IconBtn>
                                                                )}
                                                                {can('meetings', 'delete') && (
                                                                    <IconBtn variant="outline-danger" onClick={() => handleDelete(agenda.id)} title="Delete Agenda">
                                                                        <DeleteIcon />
                                                                    </IconBtn>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="badge badge-danger light">No Access</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </Table>
                            </div>
                        </div>
                    ) : (
                        /* ─── FORM VIEW ─── */
                        <div>
                            <div className="form-section-header">
                                <span className="form-section-title">Define Agenda Items</span>
                                {editIndex === null && (
                                    <button className="add-more-btn btn" onClick={handleAddRow}>
                                        <i className="fa fa-plus-circle me-1"></i> Add Another
                                    </button>
                                )}
                            </div>

                            {tempAgendas.map((item, index) => (
                                <div className="agenda-form-card" key={index}>
                                    <div className="card-item-header">
                                        <span className="item-num-badge">
                                            Item {String((editIndex !== null ? editIndex : itemOffset + index) + 1).padStart(2, '0')}
                                        </span>
                                        {tempAgendas.length > 1 && (
                                            <button className="remove-item-btn" onClick={() => handleRemoveRow(index)}>
                                                <i className="fa fa-times"></i> Remove
                                            </button>
                                        )}
                                    </div>
                                    <div className="card-item-body">
                                        <Row className="g-3">
                                            <Col md={5}>
                                                <Form.Group>
                                                    <label className="form-label-styled">Agenda Title <span style={{ color: '#e11d48' }}>*</span></label>
                                                    <Form.Control
                                                        className="form-control-styled"
                                                        placeholder="Main topic or goal of this point"
                                                        value={item.points}
                                                        onChange={e => handleFieldChange(index, 'points', e.target.value)}
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group>
                                                    <label className="form-label-styled">Presenter</label>
                                                    <Form.Select
                                                        className="form-select-styled"
                                                        value={item.presenter}
                                                        onChange={e => handleFieldChange(index, 'presenter', e.target.value)}
                                                    >
                                                        <option value="">Select presenter…</option>
                                                        {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                    </Form.Select>
                                                </Form.Group>
                                            </Col>
                                            <Col md={2}>
                                                <Form.Group>
                                                    <label className="form-label-styled">Duration (min)</label>
                                                    <Form.Control
                                                        type="number"
                                                        className="form-control-styled"
                                                        value={item.duration_minutes}
                                                        onChange={e => handleFieldChange(index, 'duration_minutes', e.target.value)}
                                                        style={{ textAlign: 'center' }}
                                                        min={1}
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col md={1}>
                                                <Form.Group>
                                                    <label className="form-label-styled">File</label>
                                                    <div className={`file-upload-zone ${item.file_upload ? 'has-file' : ''}`}>
                                                        <input type="file" onChange={e => handleFileChange(index, e.target.files[0])} />
                                                        {item.file_upload
                                                            ? <><i className="fa fa-check-circle"></i></>
                                                            : <><i className="fa fa-upload"></i></>
                                                        }
                                                    </div>
                                                </Form.Group>
                                            </Col>
                                            <Col md={12}>
                                                <Form.Group>
                                                    <label className="form-label-styled">Description / Context</label>
                                                    <Form.Control
                                                        as="textarea"
                                                        rows={2}
                                                        className="form-control-styled"
                                                        placeholder="Provide background or key discussion points for this agenda item…"
                                                        value={item.details}
                                                        onChange={e => handleFieldChange(index, 'details', e.target.value)}
                                                    />
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Modal.Body>

                {/* ── FOOTER ── */}
                <Modal.Footer style={{ background: '#fff', borderTop: '1px solid #f1f5f9', padding: '16px 28px' }}>
                    <button onClick={() => onHide(false)} type="button"
                        style={{
                            background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '8px 20px',
                            fontSize: 13, fontWeight: 500, color: '#374151', cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
                        onMouseLeave={e => e.currentTarget.style.background = '#f3f4f6'}
                    >
                        Close
                    </button>

                    {showForm ? (
                        <>
                            <button onClick={() => setShowForm(false)} type="button"
                                style={{
                                    background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '8px 20px',
                                    fontSize: 13, fontWeight: 500, color: '#374151', cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
                                onMouseLeave={e => e.currentTarget.style.background = '#f3f4f6'}
                            >
                                 Back
                            </button>
                            <button
                                style={{
                                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                    border: 'none', borderRadius: 8, padding: '8px 24px',
                                    fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
                                    boxShadow: '0 4px 14px #6366f140',
                                    transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px #6366f155'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px #6366f140'; }}
                                onClick={handleSubmitAll}
                                disabled={loading}
                            >
                                {loading ? 'Saving...' : (editIndex === null ? 'Save All Agendas' : 'Update Agenda')}
                            </button>
                        </>
                    ) : (
                        can('meetings', 'create') && (
                            <button
                                className="agenda-add-btn btn"
                                onClick={startAdd}
                            >
                                <AddIcon /> Agenda
                            </button>
                        )
                    )}
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default AgendaManagement;