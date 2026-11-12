import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Card, Modal, Form, Table, Badge, Button } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import {
    getMeetings, createMeeting, updateMeeting, deleteMeeting,
    getCategories, getSubcategories, getMeetingRooms,
    checkRoomAvailability, getRoomSchedule
} from '../../../services/MeetingManagementService.js';
import { getDepartments, getEmployees } from '../../../services/HRManagementService.js';
import ParticipantManagement from './ParticipantManagement.jsx';
import AgendaManagement from './AgendaManagement.jsx';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import { usePermission } from '../../../hooks/usePermission';
import { formatDate } from '../../../utils/dateUtils';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import '../Assets/FileDashboard.css';
import { usePageTitle } from '../../../context/TitleContext';

// ─── Reusable icon button matching Edit/Delete button style ──────────────────
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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const DeleteIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <polyline points="3 6 5 6 21 6" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" fill="#fee2e2" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 11v6M14 11v6" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const ParticipantsIcon = ({ hasParticipants }) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {hasParticipants ? (
            <>
                <circle cx="18" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M21 20c0-2.2-1.3-4-3-4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </>
        ) : (
            <>
                <line x1="19" y1="8" x2="19" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="16" y1="11" x2="22" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </>
        )}
    </svg>
);
const AgendaIcon = ({ hasAgendas }) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" strokeWidth="2" />
        <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="8" y1="16" x2="12" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {!hasAgendas && (
            <>
                <line x1="19" y1="19" x2="19" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="17" y1="21" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </>
        )}
    </svg>
);
const DecisionIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L3 7v5c0 5 3.8 9.7 9 11 5.2-1.3 9-6 9-11V7L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <polyline points="9 12 11 14 15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const CalendarIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2.5" fill="#ede9fe" stroke="#7c3aed" strokeWidth="1.6" />
        <line x1="3" y1="10" x2="21" y2="10" stroke="#7c3aed" strokeWidth="1.4" />
        <line x1="8" y1="2" x2="8" y2="6" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="16" y1="2" x2="16" y2="6" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
);
const AddIcon = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="4" width="18" height="18" rx="2.5" fill="#f3e8ff" stroke="#7c3aed" strokeWidth="1.6" />
        <line x1="3" y1="10" x2="21" y2="10" stroke="#7c3aed" strokeWidth="1.4" />
        <line x1="8" y1="2" x2="8" y2="6" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="16" y1="2" x2="16" y2="6" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="18.5" cy="18.5" r="5" fill="#7c3aed" />
        <path d="M18.5 15.5v6M15.5 18.5h6" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);

const formatTime = (timeString) => {
    if (!timeString) return "";
    const parts = timeString.split(':');
    return `${parts[0]}:${parts[1]}`;
};

const MeetingList = () => {
    usePageTitle("Meeting List");
    const [meetings, setMeetings] = useState([]);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [availableRooms, setAvailableRooms] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [approvers, setApprovers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { can } = usePermission();

    const userDetails = JSON.parse(localStorage.getItem('userDetails')) || {};
    const userId = userDetails.user ? userDetails.user.id : null;

    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentMeeting, setCurrentMeeting] = useState({
        id: null, meeting_title: '', meeting_description: '', mode: 'offline',
        meeting_date: '', start_time: '', end_time: '', meeting_room: '',
        category: '', subcategory: '', department: '', meeting_approver: '', approval_status: 'pending'
    });

    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showParticipantModal, setShowParticipantModal] = useState(false);
    const [showAgendaModal, setShowAgendaModal] = useState(false);
    const [selectedMeetingForModal, setSelectedMeetingForModal] = useState({ id: null, title: '' });
    const [roomSchedule, setRoomSchedule] = useState([]);
    const [selectedRoomName, setSelectedRoomName] = useState('');

    useEffect(() => { fetchData(); fetchMasters(); }, []);

    useEffect(() => {
        if (currentMeeting.meeting_date && currentMeeting.start_time && currentMeeting.end_time) {
            fetchAvailableRoomsList();
        } else {
            setAvailableRooms(rooms);
        }
    }, [currentMeeting.meeting_date, currentMeeting.start_time, currentMeeting.end_time, rooms, currentMeeting.id]);

    useEffect(() => {
        if (currentMeeting.department) fetchApprovers(currentMeeting.department);
        else setApprovers([]);
    }, [currentMeeting.department]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getMeetings(userId ? { created_by: userId } : {});
            setMeetings(data);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch meetings' });
        } finally {
            setLoading(false);
        }
    };

    const fetchMasters = async () => {
        try {
            const [catData, subcatData, roomData, deptData] = await Promise.all([
                getCategories(), getSubcategories(), getMeetingRooms(), getDepartments()
            ]);
            setCategories(catData); setSubcategories(subcatData);
            setRooms(roomData); setAvailableRooms(roomData); setDepartments(deptData);
        } catch (error) { console.error("Failed to fetch master data", error); }
    };

    const fetchApprovers = async (deptId) => {
        try {
            const data = await getEmployees(deptId, true);
            setApprovers(Array.isArray(data) ? data : data?.results || []);
        } catch (error) {
            console.error("Failed to fetch approvers", error);
            setApprovers([]);
        }
    };

    const fetchAvailableRoomsList = async () => {
        try {
            const data = await checkRoomAvailability(
                currentMeeting.meeting_date, currentMeeting.start_time,
                currentMeeting.end_time, currentMeeting.id
            );
            setAvailableRooms(data);
            if (currentMeeting.meeting_room && !data.find(r => r.id === parseInt(currentMeeting.meeting_room))) {
                if (!editMode) setCurrentMeeting(prev => ({ ...prev, meeting_room: '' }));
            }
        } catch (error) { console.error("Failed to check availability", error); }
    };

    const handleStartTimeChange = (val) => {
        if (!val) return;
        let [hours, minutes] = val.split(':').map(Number);
        minutes += 30;
        if (minutes >= 60) { hours = (hours + 1) % 24; minutes -= 60; }
        const endTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        setCurrentMeeting(prev => ({ ...prev, start_time: val, end_time: endTime }));
    };

    const handleShowModal = (meeting = null) => {
        if (meeting) {
            setCurrentMeeting({
                ...meeting, meeting_room: meeting.meeting_room || '',
                category: meeting.category || '', subcategory: meeting.subcategory || '',
                department: meeting.department || '', meeting_approver: meeting.meeting_approver || ''
            });
            setEditMode(true);
        } else {
            setCurrentMeeting({
                id: null, meeting_title: '', meeting_description: '', mode: 'offline',
                meeting_date: '', start_time: '', end_time: '', meeting_room: '',
                category: '', subcategory: '', department: '', meeting_approver: '', approval_status: 'pending'
            });
            setEditMode(false);
        }
        setShowModal(true);
    };

    const validateTimes = () => {
        const now = new Date();
        // Use YYYY-MM-DD string for today to avoid timezone offset issues (UTC vs local)
        const todayStr = now.toLocaleDateString('en-CA'); // 'en-CA' gives YYYY-MM-DD format
        const meetingDateStr = currentMeeting.meeting_date;

        if (meetingDateStr < todayStr) {
            Swal.fire({ icon: 'error', title: 'Invalid Date', text: 'Meetings cannot be scheduled for back dates.' });
            return false;
        }
        if (meetingDateStr === todayStr) {
            const startTime = new Date(`${meetingDateStr}T${currentMeeting.start_time}`);
            if (startTime < now) {
                Swal.fire({ icon: 'error', title: 'Invalid Time', text: 'Start time cannot be in the past.' });
                return false;
            }
        }
        const startTime = new Date(`${meetingDateStr}T${currentMeeting.start_time}`);
        const endTime = new Date(`${meetingDateStr}T${currentMeeting.end_time}`);
        if ((endTime - startTime) / (1000 * 60) < 30) {
            Swal.fire({ icon: 'error', title: 'Invalid Duration', text: 'Meeting must be at least 30 minutes long.' });
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateTimes()) return;
        try {
            const data = { ...currentMeeting };
            ['meeting_room', 'category', 'subcategory', 'department'].forEach(key => { if (!data[key]) data[key] = null; });
            if (editMode) {
                await updateMeeting(currentMeeting.id, data);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Meeting updated successfully', timer: 1500 });
            } else {
                await createMeeting(data);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Meeting scheduled successfully', timer: 1500 });
            }
            setShowModal(false); fetchData();
        } catch (error) {
            const errorMsg = error.response?.data?.meeting_room || error.response?.data?.non_field_errors || error.response?.data?.error || 'Failed to save meeting';
            Swal.fire({ icon: 'error', title: 'Error', text: Array.isArray(errorMsg) ? errorMsg[0] : errorMsg });
        }
    };

    const handleDelete = async (id, title) => {
        const result = await Swal.fire({
            title: 'Cancel Meeting?', text: `Are you sure you want to cancel "${title}"?`,
            icon: 'warning', showCancelButton: true,
            confirmButtonColor: '#d33', confirmButtonText: 'Yes, cancel it'
        });
        if (result.isConfirmed) {
            try {
                await deleteMeeting(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Meeting cancelled successfully', timer: 1500 });
                fetchData();
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to cancel meeting' });
            }
        }
    };

    const handleViewSchedule = async (id, name) => {
        try {
            const schedule = await getRoomSchedule(id);
            setRoomSchedule(schedule); setSelectedRoomName(name); setShowScheduleModal(true);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch room schedule' });
        }
    };

    const handleExport = (format) => {
        const filtered = meetings.filter(m => {
            const s = `${m.meeting_code} ${m.meeting_title} ${m.category_name} ${m.subcategory_name} ${m.room_name} ${m.approval_status}`.toLowerCase();
            return s.includes(searchTerm.toLowerCase());
        });
        const columns = [
            { header: 'Code', dataKey: 'meeting_code' },
            { header: 'Title', dataKey: 'meeting_title' },
            { header: 'Category', dataKey: 'category_name' },
            { header: 'Subcategory', dataKey: 'subcategory_name' },
            { header: 'Date', dataKey: 'meeting_date', formatter: (val) => formatDate(val) },
            { header: 'Time', dataKey: 'start_time', formatter: (val, row) => `${formatTime(row.start_time)} - ${formatTime(row.end_time)}` },
            { header: 'Room', dataKey: 'room_name' },
            { header: 'Status', dataKey: 'approval_status' }
        ];
        const fileName = `Meetings_${new Date().toISOString().split('T')[0]}`;
        const title = 'Meeting Schedule Report';
        if (format === 'pdf') exportToPDF(filtered, columns, `${fileName}.pdf`, title);
        else if (format === 'excel') exportToExcel(filtered, columns, `${fileName}.xlsx`);
        else if (format === 'print') printData(filtered, columns, title);
    };

    const filteredMeetings = meetings.filter(m => {
        if (!searchTerm) return true;
        const s = `${m.meeting_code} ${m.meeting_title} ${m.category_name} ${m.subcategory_name} ${m.room_name} ${m.approval_status}`.toLowerCase();
        return s.includes(searchTerm.toLowerCase());
    });

    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedMeetings = React.useMemo(() => {
        let sortableItems = [...filteredMeetings];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                const aVal = a[sortConfig.key] ? a[sortConfig.key].toString().toLowerCase() : '';
                const bVal = b[sortConfig.key] ? b[sortConfig.key].toString().toLowerCase() : '';
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredMeetings, sortConfig]);

    // ── react-select helpers matching StockItemList ──
    const toOptions = (arr, labelFn) => arr.map(item => ({ value: item.id, label: labelFn(item) }));
    const findOption = (options, value) => options.find(o => String(o.value) === String(value)) || null;

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '42px',
            borderColor: state.isFocused ? '#6d4aff' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 2px rgba(109,74,255,0.15)' : 'none',
            '&:hover': { borderColor: '#6d4aff' },
            borderRadius: '10px',
            fontSize: '14px',
        }),
        menu: base => ({ ...base, zIndex: 9999, fontSize: '0.875rem' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#6d4aff' : state.isFocused ? '#f0ecff' : 'white',
            color: state.isSelected ? 'white' : '#333',
            cursor: 'pointer',
        }),
    };

    const currentSelectControlRef = useRef(null);

    const getFocusable = () => {
        const modal = document.querySelector('.mc-modal');
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.form-control-custom, input[type="checkbox"]:not([disabled]), .react-select__control, button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const focusNextFromControl = (control) => {
        const all = getFocusable();
        const index = all.indexOf(control);
        if (index > -1 && index < all.length - 1) {
            const next = all[index + 1];
            if (index === all.length - 2) {
                setTimeout(() => {
                    all[all.length - 1].click();
                }, 50);
            } else if (next.classList.contains('react-select__control')) {
                setTimeout(() => {
                    const input = next.querySelector('input:not([type="hidden"])') || next.querySelector('input');
                    if (input) {
                        input.focus();
                    }
                }, 50);
            } else {
                setTimeout(() => {
                    next.focus();
                }, 50);
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        const all = getFocusable();
        let target = e.target || document.activeElement;
        let index = all.indexOf(target);
        if (index === -1 && target) {
            const parentControl = target.closest('.form-control-custom, .react-select__control');
            if (parentControl) {
                index = all.indexOf(parentControl);
            }
        }
        if (index === -1 && document.activeElement) {
            let active = document.activeElement;
            index = all.indexOf(active);
            if (index === -1) {
                const parentControl = active.closest('.form-control-custom, .react-select__control');
                if (parentControl) {
                    index = all.indexOf(parentControl);
                }
            }
        }
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            e.stopPropagation();
            const next = all[index + 1];
            if (index === all.length - 2) {
                setTimeout(() => {
                    all[all.length - 1].click();
                }, 50);
            } else if (next.classList.contains('react-select__control')) {
                setTimeout(() => {
                    const input = next.querySelector('input:not([type="hidden"])') || next.querySelector('input');
                    if (input) {
                        input.focus();
                    }
                }, 50);
            } else {
                setTimeout(() => {
                    next.focus();
                }, 50);
            }
        }
    };

    const handleSelectFocus = (e) => {
        currentSelectControlRef.current = e.target.closest('.react-select__control');
    };

    const handleSelectKeyDown = (e) => {
        if (e.key === 'Enter') {
            const menuOpen = !!document.querySelector('.react-select__menu');
            if (!menuOpen) {
                e.preventDefault();
                const control = e.target.closest('.react-select__control');
                if (control) focusNextFromControl(control);
            }
        }
    };

    const makeSelectChange = (field) => (opt) => {
        setCurrentMeeting(prev => ({
            ...prev,
            [field]: opt ? opt.value : '',
            ...(field === 'category' ? { subcategory: '' } : {}),
            ...(field === 'department' ? { meeting_approver: '' } : {})
        }));
        if (opt !== null) {
            const control = currentSelectControlRef.current;
            setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
        }
    };

    const availableSubcategories = subcategories.filter(s => s.category === parseInt(currentMeeting.category));
    const today = new Date().toISOString().split('T')[0];

    const roomOptions = [
        ...availableRooms.map(room => ({ value: room.id, label: `${room.room_name} (${room.location})` })),
        ...(currentMeeting.meeting_room && !availableRooms.find(r => r.id === parseInt(currentMeeting.meeting_room)) ? [{
            value: parseInt(currentMeeting.meeting_room),
            label: `${rooms.find(r => r.id === parseInt(currentMeeting.meeting_room))?.room_name || 'Selected Room'} (NOT AVAILABLE)`,
            isDisabled: true
        }] : [])
    ];

    const statusConfig = {
        approved: { bg: '#dcfce7', color: '#15803d', dot: '#22c55e' },
        rejected: { bg: '#fee2e2', color: '#dc2626', dot: '#ef4444' },
        pending: { bg: '#fef9c3', color: '#92400e', dot: '#f59e0b' },
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

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 border-0 pb-0">
                            <Card.Title className="mb-0 text-nowrap">All Meetings</Card.Title>
                            <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                                {/* Search */}
                                <div className="search-bar-container w-100 m-0" style={{ maxWidth: '250px' }}>
                                    <span className="search-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        </svg>
                                    </span>
                                    <input type="text" className="search-input" placeholder="Search meetings..."
                                        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                </div>

                                {/* Export icon buttons */}
                                <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                                    <div className="d-flex align-items-center gap-2">
                                        <ExportBtn onClick={() => handleExport('pdf')} title="Export PDF"><PdfIcon /></ExportBtn>
                                        <ExportBtn onClick={() => handleExport('excel')} title="Export Excel"><ExcelIcon /></ExportBtn>
                                        <ExportBtn onClick={() => handleExport('print')} title="Print"><PrintIcon /></ExportBtn>
                                    </div>

                                    {/* New Meeting button - requires create permission */}
                                    {can('meetings', 'create') && (
                                        <CreateButton
                                            module="meetings"
                                            onClick={() => handleShowModal()}
                                        >
                                            Meeting
                                        </CreateButton>
                                    )}
                                </div>
                            </div>
                        </Card.Header>

                        <Card.Body>
                            <div className="table-responsive">
                                <table className="table table-responsive-md">
                                    <thead>
                                        <tr>
                                            <th onClick={() => handleSort('meeting_code')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                <strong>CODE</strong>
                                            </th>
                                            <th onClick={() => handleSort('meeting_title')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                <strong>TITLE</strong>
                                            </th>
                                            <th onClick={() => handleSort('category_name')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                <strong>CATEGORY</strong>
                                            </th>
                                            <th onClick={() => handleSort('meeting_date')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                <strong>DATE & TIME</strong>
                                            </th>
                                            <th onClick={() => handleSort('room_name')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                <strong>ROOM</strong>
                                            </th>
                                            <th onClick={() => handleSort('approval_status')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                <strong>STATUS</strong>
                                            </th>
                                            <th className="text-end" style={{ whiteSpace: 'nowrap' }}>
                                                <strong>ACTIONS</strong>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan="7" className="text-center">Loading...</td></tr>
                                        ) : sortedMeetings.length === 0 ? (
                                            <tr><td colSpan="7" className="text-center">No meetings found</td></tr>
                                        ) : (
                                            sortedMeetings.map(meeting => {
                                                const sc = statusConfig[meeting.approval_status] || statusConfig.pending;
                                                return (
                                                    <tr key={meeting.id}>
                                                        <td style={{ whiteSpace: 'nowrap' }}><strong>{meeting.meeting_code}</strong></td>
                                                        <td style={{ whiteSpace: 'nowrap' }}>{meeting.meeting_title}</td>
                                                        <td style={{ whiteSpace: 'nowrap' }}>{meeting.category_name} - {meeting.subcategory_name}</td>
                                                        <td style={{ whiteSpace: 'nowrap' }}>
                                                            {formatDate(meeting.meeting_date)}<br />
                                                            <small className="text-muted">{formatTime(meeting.start_time)} - {formatTime(meeting.end_time)}</small>
                                                        </td>
                                                        <td style={{ whiteSpace: 'nowrap' }}>{meeting.room_name || 'N/A'}</td>

                                                        {/* Status */}
                                                        <td style={{ whiteSpace: 'nowrap' }}>
                                                            <span className={`badge badge-${
                                                                meeting.approval_status === 'approved' ? 'success' :
                                                                meeting.approval_status === 'rejected' ? 'danger' : 'warning'
                                                            } light`}>
                                                                {meeting.approval_status ? (meeting.approval_status.charAt(0).toUpperCase() + meeting.approval_status.slice(1)) : 'Pending'}
                                                            </span>
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="text-end" style={{ whiteSpace: 'nowrap' }}>
                                                            {can('meetings', 'edit') || can('meetings', 'delete') || (meeting.has_agendas && meeting.approval_status === 'approved' && meeting.meeting_status === 'ended') ? (
                                                                <div className="d-flex justify-content-end align-items-center gap-1">
                                                                    {can('meetings', 'edit') && (
                                                                        <EditButton
                                                                            module="meetings"
                                                                            onClick={() => handleShowModal(meeting)}
                                                                            className="me-1"
                                                                        />
                                                                    )}

                                                                    {can('meetings', 'delete') && (
                                                                        <DeleteButton
                                                                            module="meetings"
                                                                            onClick={() => handleDelete(meeting.id, meeting.meeting_title)}
                                                                            className="me-1"
                                                                        />
                                                                    )}

                                                                    {can('meetings', 'edit') && (
                                                                        <IconBtn
                                                                            variant="outline-info"
                                                                            onClick={() => {
                                                                                setSelectedMeetingForModal({ id: meeting.id, title: meeting.meeting_title });
                                                                                setShowParticipantModal(true);
                                                                            }}
                                                                            title={meeting.has_participants ? `Participants (${meeting.participant_count})` : 'Add Participants'}
                                                                        >
                                                                            <ParticipantsIcon hasParticipants={meeting.has_participants} />
                                                                        </IconBtn>
                                                                    )}

                                                                    {can('meetings', 'edit') && (
                                                                        <IconBtn
                                                                            variant="outline-warning"
                                                                            onClick={() => {
                                                                                setSelectedMeetingForModal({ id: meeting.id, title: meeting.meeting_title });
                                                                                setShowAgendaModal(true);
                                                                            }}
                                                                            title={!meeting.has_participants ? 'Add participants first' : meeting.has_agendas ? `Agendas (${meeting.agenda_count})` : 'Add Agendas'}
                                                                            disabled={!meeting.has_participants}
                                                                        >
                                                                            <AgendaIcon hasAgendas={meeting.has_agendas} />
                                                                        </IconBtn>
                                                                    )}

                                                                    {meeting.has_agendas && meeting.approval_status === 'approved' && meeting.meeting_status === 'ended' && (
                                                                        <Link to={`/meeting/agenda-decisions/${meeting.id}`} style={{ display: 'inline-flex' }}>
                                                                            <IconBtn variant="outline-success" title="Agenda Decisions">
                                                                                <DecisionIcon />
                                                                            </IconBtn>
                                                                        </Link>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="badge badge-danger light">No Access</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Meeting Modal */}
            <Modal
                show={showModal}
                onHide={() => setShowModal(false)}
                size="lg"
                dialogClassName="mc-modal item-custom-modal"
                className="mc-modal item-custom-modal"
                backdrop="static"
                keyboard={false}
                centered
                onEntered={() => {
                    const el = document.getElementById('meeting-title-input');
                    if (el) el.focus();
                }}
            >
                <style>{`
                    .mc-modal .modal-content {
                        border-radius: 16px !important;
                        border: none !important;
                        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                        overflow: hidden;
                    }
                    .mc-modal .modal-header-custom {
                        background: white;
                        padding: 24px 28px 20px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        border-bottom: 1px solid #f1f5f9;
                    }
                    .mc-modal .modal-icon-circle {
                        width: 48px;
                        height: 48px;
                        border-radius: 12px;
                        background: var(--form-icon-color, #0a500f);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                        box-shadow: 0 4px 12px rgba(10, 80, 15, 0.25);
                    }
                    .mc-modal .modal-close-x {
                        width: 36px;
                        height: 36px;
                        border-radius: 8px;
                        border: 1px solid #e2e8f0;
                        background: #f8fafc;
                        color: #64748b;
                        font-size: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .mc-modal .modal-close-x:hover {
                        background: #f1f5f9;
                        color: #1e293b;
                    }
                    .mc-modal .modal-body-custom {
                        padding: 24px 28px;
                        background: #f8fafc;
                    }
                    .mc-modal .form-label-custom {
                        font-size: 13px;
                        font-weight: 600;
                        color: #334155;
                        margin-bottom: 6px;
                    }
                    .mc-modal .form-control-custom,
                    .mc-modal .form-select-custom {
                        height: 42px;
                        border-radius: 10px;
                        border: 1px solid #cbd5e1;
                        font-size: 14px;
                        color: #1e293b;
                        background: white;
                        padding: 8px 14px;
                        transition: all 0.2s;
                    }
                    .mc-modal .form-control-custom:focus,
                    .mc-modal .form-select-custom:focus {
                        border-color: #0a500f;
                        box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                        outline: none;
                    }
                    .mc-modal .modal-footer-custom {
                        padding: 16px 28px;
                        background: white;
                        border-top: 1px solid #f1f5f9;
                        display: flex;
                        align-items: center;
                        justify-content: flex-end;
                        gap: 12px;
                    }
                    .mc-modal .btn-close-custom {
                        height: 42px;
                        padding: 0 24px;
                        border-radius: 8px;
                        border: none;
                        background: var(--cancel-btn-color, #dc3545) !important;
                        background-color: var(--cancel-btn-color, #dc3545) !important;
                        color: white !important;
                        font-weight: 500;
                        font-size: 14px;
                        transition: all 0.2s;
                    }
                    .mc-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                    .mc-modal .btn-save-custom {
                        height: 42px;
                        padding: 0 28px;
                        border-radius: 10px;
                        border: none;
                        background: var(--save-btn-color, #0a500f);
                        color: white;
                        font-weight: 600;
                        font-size: 14px;
                        box-shadow: 0 4px 14px rgba(10, 80, 15, 0.25);
                        transition: all 0.2s;
                    }
                    .mc-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                `}</style>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M16 2V6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M8 2V6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M3 10H21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Meeting' : 'Schedule Meeting'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage meeting schedule
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>
                        &times;
                    </button>
                </div>
                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-8">
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Meeting Title <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="text"
                                        id="meeting-title-input"
                                        className="form-control-custom"
                                        value={currentMeeting.meeting_title}
                                        onChange={(e) => setCurrentMeeting({ ...currentMeeting, meeting_title: e.target.value })}
                                        required
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-4">
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Mode</Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={[
                                            { value: 'offline', label: 'Offline' },
                                            { value: 'remote', label: 'Remote' },
                                            { value: 'hybrid', label: 'Hybrid' }
                                        ]}
                                        value={findOption([
                                            { value: 'offline', label: 'Offline' },
                                            { value: 'remote', label: 'Remote' },
                                            { value: 'hybrid', label: 'Hybrid' }
                                        ], currentMeeting.mode)}
                                        onChange={(opt) => {
                                            setCurrentMeeting(prev => ({ ...prev, mode: opt ? opt.value : 'offline' }));
                                            if (opt !== null) {
                                                const control = currentSelectControlRef.current;
                                                setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
                                            }
                                        }}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        placeholder="Select Mode..."
                                        openMenuOnFocus={true}
                                        styles={selectStyles}
                                    />
                                </Form.Group>
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-md-3">
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Category <span className="text-danger">*</span></Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={toOptions(categories, cat => cat.category_name)}
                                        value={findOption(toOptions(categories, cat => cat.category_name), currentMeeting.category)}
                                        onChange={makeSelectChange('category')}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        placeholder="Select Category..."
                                        isClearable
                                        openMenuOnFocus={true}
                                        styles={selectStyles}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Subcategory <span className="text-danger">*</span></Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={toOptions(availableSubcategories, sub => sub.subcategory_name)}
                                        value={findOption(toOptions(availableSubcategories, sub => sub.subcategory_name), currentMeeting.subcategory)}
                                        onChange={makeSelectChange('subcategory')}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        placeholder="Select Subcategory..."
                                        isClearable
                                        isDisabled={!currentMeeting.category}
                                        openMenuOnFocus={true}
                                        styles={selectStyles}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Department</Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={toOptions(departments, dept => dept.name)}
                                        value={findOption(toOptions(departments, dept => dept.name), currentMeeting.department)}
                                        onChange={makeSelectChange('department')}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        placeholder="Select Department..."
                                        isClearable
                                        openMenuOnFocus={true}
                                        styles={selectStyles}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-3">
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Meeting Approver</Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={approvers.map(emp => ({
                                            value: emp.user,
                                            label: emp.user_name || emp.full_name || emp.user_email || `User ${emp.user}`
                                        }))}
                                        value={findOption(approvers.map(emp => ({
                                            value: emp.user,
                                            label: emp.user_name || emp.full_name || emp.user_email || `User ${emp.user}`
                                        })), currentMeeting.meeting_approver)}
                                        onChange={makeSelectChange('meeting_approver')}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        placeholder="Select Approver..."
                                        isClearable
                                        isDisabled={!currentMeeting.department}
                                        openMenuOnFocus={true}
                                        styles={selectStyles}
                                    />
                                </Form.Group>
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-md-4">
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Date <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="date"
                                        className="form-control-custom"
                                        min={today}
                                        value={currentMeeting.meeting_date}
                                        onChange={(e) => setCurrentMeeting({ ...currentMeeting, meeting_date: e.target.value })}
                                        required
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-4">
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">Start Time <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="time"
                                        className="form-control-custom"
                                        value={currentMeeting.start_time}
                                        onChange={(e) => handleStartTimeChange(e.target.value)}
                                        required
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-4">
                                <Form.Group className="mb-3">
                                    <Form.Label className="form-label-custom">End Time <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="time"
                                        className="form-control-custom"
                                        value={currentMeeting.end_time}
                                        onChange={(e) => setCurrentMeeting({ ...currentMeeting, end_time: e.target.value })}
                                        required
                                    />
                                </Form.Group>
                            </div>
                        </div>
                        <div className="row align-items-stretch">
                            <div className="col-md-6 d-flex flex-column">
                                <Form.Group className="mb-3 d-flex flex-column flex-grow-1">
                                    <Form.Label className="form-label-custom">Meeting Room {currentMeeting.mode !== 'remote' && <span className="text-danger">*</span>}</Form.Label>
                                    <div className="d-flex align-items-center gap-2">
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <Select
                                                classNamePrefix="react-select"
                                                options={roomOptions}
                                                value={findOption(roomOptions, currentMeeting.meeting_room)}
                                                onChange={makeSelectChange('meeting_room')}
                                                onFocus={handleSelectFocus}
                                                onKeyDown={handleSelectKeyDown}
                                                placeholder="Select Room..."
                                                isClearable
                                                isDisabled={currentMeeting.mode === 'remote'}
                                                openMenuOnFocus={true}
                                                styles={selectStyles}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (currentMeeting.meeting_room) {
                                                    handleViewSchedule(currentMeeting.meeting_room, rooms.find(r => r.id === parseInt(currentMeeting.meeting_room))?.room_name);
                                                } else {
                                                    Swal.fire({ icon: 'info', title: 'Select Room', text: 'Please select a room first to see its schedule.' });
                                                }
                                            }}
                                            style={{
                                                border: '1px solid #cbd5e1',
                                                background: '#f8f9ff', borderRadius: '10px',
                                                padding: '0 14px', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'background 0.15s',
                                                height: '42px',
                                                flexShrink: 0,
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#ede9fe'}
                                            onMouseLeave={e => e.currentTarget.style.background = '#f8f9ff'}
                                            title="View Room Schedule"
                                        >
                                            <CalendarIcon />
                                        </button>
                                    </div>
                                    <Form.Text className="text-muted">Only available rooms for the selected time are shown.</Form.Text>
                                </Form.Group>
                            </div>
                            <div className="col-md-6 d-flex flex-column">
                                <Form.Group className="mb-3 d-flex flex-column flex-grow-1">
                                    <Form.Label className="form-label-custom">Description</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        style={{ flex: 1, resize: 'none' }}
                                        className="form-control-custom"
                                        value={currentMeeting.meeting_description}
                                        onChange={(e) => setCurrentMeeting({ ...currentMeeting, meeting_description: e.target.value })}
                                    />
                                </Form.Group>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowModal(false)}>
                            Close
                        </Button>
                        <Button type="submit" className="btn-save-custom">
                            {editMode ? 'Update' : 'Schedule'}
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* Room Schedule Modal */}
            <Modal show={showScheduleModal} onHide={() => setShowScheduleModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Schedule for {selectedRoomName}</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-0">
                    <Table responsive striped className="mb-0">
                        <thead className="bg-light">
                            <tr><th>Date</th><th>Time</th><th>Meeting</th></tr>
                        </thead>
                        <tbody>
                            {roomSchedule.length === 0 ? (
                                <tr><td colSpan="3" className="text-center">No upcoming meetings</td></tr>
                            ) : (
                                roomSchedule.map((s, i) => (
                                    <tr key={i}>
                                        <td>{s.meeting_date}</td>
                                        <td>{s.start_time} - {s.end_time}</td>
                                        <td>{s.meeting_title}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </Table>
                </Modal.Body>
            </Modal>

            <ParticipantManagement
                show={showParticipantModal}
                onHide={(refresh) => { setShowParticipantModal(false); if (refresh === true) fetchData(); }}
                meetingId={selectedMeetingForModal.id}
                meetingTitle={selectedMeetingForModal.title}
            />
            <AgendaManagement
                show={showAgendaModal}
                onHide={(refresh) => { setShowAgendaModal(false); if (refresh === true) fetchData(); }}
                meetingId={selectedMeetingForModal.id}
                meetingTitle={selectedMeetingForModal.title}
            />
        </div>
    );
};

export default MeetingList;