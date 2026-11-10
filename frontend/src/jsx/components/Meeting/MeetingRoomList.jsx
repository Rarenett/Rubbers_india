import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Modal, Form, Table } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import {
    getMeetingRooms,
    createMeetingRoom,
    updateMeetingRoom,
    deleteMeetingRoom
} from '../../../services/MeetingManagementService.js';
import { getUsers } from '../../../services/HRManagementService.js';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import '../Assets/FileDashboard.css';
import { usePageTitle } from '../../../context/TitleContext';




const EQUIPMENT_OPTIONS = [
    "Projector", "Whiteboard", "Video Conferencing", "Audio System",
    "Wi-Fi", "Smart TV", "HDMI Cable", "Laptop Charging Points"
];

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

// ─── Reusable icon action button with tooltip ─────────────────────────────────
function ActionBtn({ onClick, title, children }) {
    const [hov, setHov] = useState(false);
    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
                onClick={onClick}
                onMouseEnter={() => setHov(true)}
                onMouseLeave={() => setHov(false)}
                style={{
                    width: 32, height: 32,
                    border: 'none',
                    background: 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                    transform: hov ? 'translateY(-3px) scale(1.18)' : 'scale(1)',
                }}
            >
                {children}
            </button>
            <div style={{
                position: 'absolute', bottom: 'calc(100% + 7px)', left: '50%',
                transform: 'translateX(-50%)',
                background: '#111827', color: '#f9fafb',
                fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                padding: '4px 9px', borderRadius: 6,
                pointerEvents: 'none',
                opacity: hov ? 1 : 0,
                transition: 'opacity 0.15s ease',
                zIndex: 20,
            }}>
                {title}
                <div style={{
                    position: 'absolute', top: '100%', left: '50%',
                    transform: 'translateX(-50%)',
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: '5px solid #111827',
                }} />
            </div>
        </div>
    );
}

// ─── Edit Icon — blue ─────────────────────────────────────────────────────────
const EditIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// ─── Delete Icon — red ────────────────────────────────────────────────────────
const DeleteIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polyline points="3 6 5 6 21 6" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" fill="#fee2e2" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 11v6M14 11v6" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const AddIcon = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
            d="M3 10L12 4L21 10V20C21 21.1 20.1 22 19 22H5C3.9 22 3 21.1 3 20V10Z"
            fill="#f3e8ff"
            stroke="#7c3aed"
            strokeWidth="1.6"
            strokeLinejoin="round"
        />
        <rect
            x="10"
            y="14"
            width="4"
            height="6"
            rx="1"
            fill="#f3e8ff"
            stroke="#7c3aed"
            strokeWidth="1.6"
        />
        <circle cx="18.5" cy="18.5" r="5" fill="#7c3aed" />
        <path
            d="M18.5 15.5v6M15.5 18.5h6"
            stroke="#ffffff"
            strokeWidth="1.6"
            strokeLinecap="round"
        />
    </svg>
);
const PdfIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
);

// ─── Excel Icon — green (Renewal Reminder Report style) ───────────────────────
const ExcelIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
);

// ─── Print Icon — blue (Renewal Reminder Report style) ────────────────────────
const PrintIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
);

const MeetingRoomList = () => {
    usePageTitle("Meeting Room List");
    const [rooms, setRooms] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRows, setSelectedRows] = useState([]);
    const [currentRoom, setCurrentRoom] = useState({
        id: null,
        room_name: '',
        capacity: 10,
        location: '',
        equipment: [],
        additionalEquipment: '',
        incharge: '',
        status: 'active',
        is_available: true
    });
    const { can } = usePermission();
    const currentSelectControlRef = useRef(null);

    useEffect(() => {
        fetchData();
        fetchUsers();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getMeetingRooms();
            setRooms(data);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch rooms' });
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const userData = await getUsers();
            setUsers(userData);
        } catch (error) {
            console.error("Failed to fetch users", error);
        }
    };

    const handleShowModal = (room = null) => {
        if (room) {
            const equipmentArray = room.equipment
                ? (typeof room.equipment === 'string'
                    ? room.equipment.split(',').map(item => item.trim())
                    : room.equipment)
                : [];
            const predefined = equipmentArray.filter(item => EQUIPMENT_OPTIONS.includes(item));
            const additional = equipmentArray.filter(item => !EQUIPMENT_OPTIONS.includes(item)).join(', ');
            setCurrentRoom({ ...room, equipment: predefined, additionalEquipment: additional, incharge: room.incharge || '' });
            setEditMode(true);
        } else {
            setCurrentRoom({ id: null, room_name: '', capacity: 10, location: '', equipment: [], additionalEquipment: '', incharge: '', status: 'active', is_available: true });
            setEditMode(false);
        }
        setShowModal(true);
    };

    const handleEquipmentChange = (option) => {
        const updatedEquipment = currentRoom.equipment.includes(option)
            ? currentRoom.equipment.filter(item => item !== option)
            : [...currentRoom.equipment, option];
        setCurrentRoom({ ...currentRoom, equipment: updatedEquipment });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const allEquipment = [...currentRoom.equipment];
            if (currentRoom.additionalEquipment.trim()) {
                const extraItems = currentRoom.additionalEquipment.split(',').map(item => item.trim()).filter(item => item !== '');
                allEquipment.push(...extraItems);
            }
            const data = { ...currentRoom, equipment: allEquipment.join(',') };
            delete data.additionalEquipment;
            if (!data.incharge) delete data.incharge;

            if (editMode) {
                await updateMeetingRoom(currentRoom.id, data);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Room updated successfully', timer: 1500 });
            } else {
                await createMeetingRoom(data);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Room created successfully', timer: 1500 });
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save room' });
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Room?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });
        if (result.isConfirmed) {
            try {
                await deleteMeetingRoom(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Room deleted successfully', timer: 1500 });
                fetchData();
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete room' });
            }
        }
    };

    const handleBulkDelete = async () => {
        const result = await Swal.fire({
            title: 'Delete Selected Rooms?',
            text: `Are you sure you want to delete ${selectedRows.length} selected rooms?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete them'
        });
        if (result.isConfirmed) {
            try {
                await Promise.all(selectedRows.map(id => deleteMeetingRoom(id)));
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Selected rooms deleted successfully', timer: 1500 });
                setSelectedRows([]);
                fetchData();
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete some rooms' });
            }
        }
    };

    const toggleRow = (id) => {
        setSelectedRows(prev =>
            prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
        );
    };

    const handleExport = (format) => {
        const filteredRooms = rooms.filter(room => {
            const searchStr = `${room.room_name} ${room.location} ${room.capacity} ${room.incharge_name || ''} ${room.status} ${room.equipment || ''}`.toLowerCase();
            return searchStr.includes(searchTerm.toLowerCase());
        });
        const columns = [
            { header: 'Room Name', dataKey: 'room_name' },
            { header: 'Location', dataKey: 'location' },
            { header: 'Capacity', dataKey: 'capacity' },
            { header: 'Equipment', dataKey: 'equipment' },
            { header: 'In-charge', dataKey: 'incharge_name' },
            { header: 'Status', dataKey: 'status' },
            { header: 'Available', dataKey: 'is_available', formatter: (val) => val ? 'Yes' : 'No' }
        ];
        const fileName = `Meeting_Rooms_${new Date().toISOString().split('T')[0]}`;
        const title = 'Meeting Rooms Report';
        if (format === 'pdf') exportToPDF(filteredRooms, columns, `${fileName}.pdf`, title);
        else if (format === 'excel') exportToExcel(filteredRooms, columns, `${fileName}.xlsx`);
        else if (format === 'print') printData(filteredRooms, columns, title);
    };

    const filteredRooms = rooms.filter(room => {
        if (!searchTerm) return true;
        const searchStr = `${room.room_name} ${room.location} ${room.capacity} ${room.incharge_name || ''} ${room.status} ${room.equipment || ''}`.toLowerCase();
        return searchStr.includes(searchTerm.toLowerCase());
    });

    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedRooms = React.useMemo(() => {
        let sortableRooms = [...filteredRooms];
        if (sortConfig.key !== null) {
            sortableRooms.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (aValue === null || aValue === undefined) aValue = '';
                if (bValue === null || bValue === undefined) bValue = '';

                if (typeof aValue === 'string') aValue = aValue.toLowerCase();
                if (typeof bValue === 'string') bValue = bValue.toLowerCase();

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableRooms;
    }, [filteredRooms, sortConfig]);

    // Auto-focus first input when Room modal opens
    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                const modal = document.querySelector('.room-modal');
                if (modal) {
                    const firstInput = modal.querySelector('.form-control-custom');
                    if (firstInput) firstInput.focus();
                }
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [showModal]);

    // ── Keyboard & Enter Navigation ──────────────────────────────────────
    const getFocusable = (modalSelector) => {
        const modal = document.querySelector(modalSelector);
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.form-control-custom, .react-select__control, #eq-0, .form-select-custom, button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled && el.type !== 'hidden');
    };

    const focusNextFromControl = (control, modalSelector = '.room-modal') => {
        const all = getFocusable(modalSelector);
        const index = all.indexOf(control);
        if (index > -1 && index < all.length - 1) {
            if (index === all.length - 2) {
                const submitBtn = all[all.length - 1];
                if (submitBtn) submitBtn.click();
            } else {
                const next = all[index + 1];
                if (next.classList && next.classList.contains('react-select__control')) {
                    next.querySelector('input')?.focus();
                } else {
                    next.focus();
                }
            }
        }
    };

    const handleKeyDown = (e, modalSelector) => {
        if (e.key !== 'Enter') return;
        if (document.querySelector('.react-select__menu')) {
            return;
        }
        const activeEl = document.activeElement;
        if (activeEl && activeEl.id && activeEl.id.startsWith('eq-')) {
            e.preventDefault();
            const addEqInput = document.querySelector('#additional-equipment-input');
            if (addEqInput) addEqInput.focus();
            return;
        }
        if (activeEl && activeEl.tagName === 'TEXTAREA' && e.shiftKey) {
            return;
        }
        const all = getFocusable(modalSelector);
        const currentItem = activeEl?.closest('.react-select__control') || activeEl;
        const index = all.indexOf(currentItem);
        if (index > -1) {
            e.preventDefault();
            if (index === all.length - 1 || index === all.length - 2) {
                const submitBtn = all[all.length - 1];
                if (submitBtn) submitBtn.click();
            } else {
                const next = all[index + 1];
                if (next.classList && next.classList.contains('react-select__control')) {
                    next.querySelector('input')?.focus();
                } else {
                    next.focus();
                }
            }
        }
    };

    const handleFocus = (e) => {
        if (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.type === 'text')) {
            e.target.select();
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
                if (control) focusNextFromControl(control, '.room-modal');
            }
        }
    };

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '42px',
            borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15, 0.15)' : 'none',
            '&:hover': { borderColor: state.isFocused ? '#0a500f' : '#94a3b8' },
            borderRadius: '10px',
            fontSize: '14px',
            backgroundColor: '#fff',
        }),
        menu: base => ({
            ...base,
            zIndex: 99999,
            fontSize: '14px',
            borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
            overflow: 'hidden',
        }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected
                ? '#0a500f'
                : state.isFocused
                ? '#f0fdf4'
                : 'white',
            color: state.isSelected ? 'white' : '#334155',
            cursor: 'pointer',
            padding: '10px 14px',
        }),
        placeholder: base => ({
            ...base,
            color: '#94a3b8',
        }),
        singleValue: base => ({
            ...base,
            color: '#334155',
        }),
    };

    const inchargeOptions = users.map(u => ({
        value: u.id,
        label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || `User #${u.id}`
    }));

    const inchargeValue = inchargeOptions.find(opt =>
        String(opt.value) === String(currentRoom.incharge)
    ) || null;

    const statusOptions = [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' }
    ];
    const statusValue = statusOptions.find(opt => opt.value === currentRoom.status) || statusOptions[0];

    const availabilityOptions = [
        { value: true, label: 'Available' },
        { value: false, label: 'Not Available' }
    ];
    const availabilityValue = availabilityOptions.find(opt => opt.value === currentRoom.is_available) || availabilityOptions[0];

    return (
        <div className="container-fluid">
            <style>{`
                /* ── StockItem Modal Styling ── */
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
                    background: #0a500f;
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
                    background: #dc3545 !important;
                    background-color: #dc3545 !important;
                    color: white !important;
                    font-weight: 500;
                    font-size: 14px;
                    transition: all 0.2s;
                }
                .mc-modal .btn-close-custom:hover {
                    background: #bb2d3b !important;
                    background-color: #bb2d3b !important;
                    color: white !important;
                }
                .mc-modal .btn-save-custom {
                    height: 42px;
                    padding: 0 28px;
                    border-radius: 10px;
                    border: none;
                    background: #0a500f;
                    color: white;
                    font-weight: 600;
                    font-size: 14px;
                    box-shadow: 0 4px 12px rgba(10, 80, 15, 0.25);
                    transition: all 0.2s;
                }
                .mc-modal .btn-save-custom:hover {
                    background: #073d0b;
                    box-shadow: 0 2px 8px rgba(10, 80, 15, 0.2);
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
                            <Card.Title className="mb-0 text-nowrap">Meeting Rooms</Card.Title>
                            <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                                {/* Search */}
                                <div className="search-bar-container w-100 m-0" style={{ maxWidth: '250px' }}>
                                    <span className="search-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Search Rooms..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                {/* ── Icon export buttons ── */}
                                <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                                    <div className="d-flex align-items-center gap-2">
                                        <ExportBtn onClick={() => handleExport('pdf')} title="Export PDF">
                                            <PdfIcon />
                                        </ExportBtn>
                                        <ExportBtn onClick={() => handleExport('excel')} title="Export Excel">
                                            <ExcelIcon />
                                        </ExportBtn>
                                        <ExportBtn onClick={() => handleExport('print')} title="Print">
                                            <PrintIcon />
                                        </ExportBtn>
                                    </div>
                                    {can('meeting-rooms', 'create') && (
                                        <CreateButton
                                            module="meeting-rooms"
                                            onClick={() => handleShowModal()}
                                        >
                                            Room
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
                                            <th onClick={() => handleSort('room_name')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                <strong>ROOM NAME</strong>
                                            </th>
                                            <th onClick={() => handleSort('location')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                <strong>LOCATION</strong>
                                            </th>
                                            <th onClick={() => handleSort('capacity')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                <strong>CAPACITY</strong>
                                            </th>
                                            <th style={{ width: '280px', minWidth: '200px', maxWidth: '320px' }}><strong>EQUIPMENT</strong></th>
                                            <th onClick={() => handleSort('incharge_name')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                <strong>IN-CHARGE</strong>
                                            </th>
                                            <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                <strong>STATUS</strong>
                                            </th>
                                            <th onClick={() => handleSort('is_available')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                <strong>AVAILABLE</strong>
                                            </th>
                                            <th className="text-end"><strong>ACTIONS</strong></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan="8" className="text-center">Loading...</td></tr>
                                        ) : sortedRooms.length === 0 ? (
                                            <tr><td colSpan="8" className="text-center">No rooms found</td></tr>
                                        ) : (
                                            sortedRooms.map(room => (
                                                <tr key={room.id}>
                                                    <td style={{ whiteSpace: 'nowrap' }}><strong>{room.room_name}</strong></td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>{room.location}</td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>{room.capacity}</td>
                                                    <td style={{ maxWidth: '300px', minWidth: '220px' }}>
                                                        <div className="d-flex flex-wrap gap-1" style={{ maxWidth: '280px' }}>
                                                            {room.equipment && room.equipment.trim() !== '' ?
                                                                room.equipment.split(',').map((eq, i) => (
                                                                    <span key={i} className="badge badge-info light mb-1" style={{ whiteSpace: 'nowrap' }}>{eq.trim()}</span>
                                                                )) :
                                                                <span className="text-muted">No equipment</span>
                                                            }
                                                        </div>
                                                    </td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>{room.incharge_name || 'N/A'}</td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>
                                                        {room.status === 'active' ? (
                                                            <span className="badge badge-success light">Active</span>
                                                        ) : (
                                                            <span className="badge badge-danger light">Inactive</span>
                                                        )}
                                                    </td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>
                                                        {room.is_available ?
                                                            <span className="badge badge-success light">Available</span> :
                                                            <span className="badge badge-warning light">Occupied</span>
                                                        }
                                                    </td>
                                                    <td className="text-end">
                                                        {can('meeting-rooms', 'edit') || can('meeting-rooms', 'delete') ? (
                                                            <div className="d-flex justify-content-end align-items-center">
                                                                {can('meeting-rooms', 'edit') && (
                                                                    <EditButton
                                                                        module="meeting-rooms"
                                                                        onClick={() => handleShowModal(room)}
                                                                        className="me-1"
                                                                    />
                                                                )}
                                                                {can('meeting-rooms', 'delete') && (
                                                                    <DeleteButton
                                                                        module="meeting-rooms"
                                                                        onClick={() => handleDelete(room.id, room.room_name)}
                                                                    />
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
                                </table>
                            </div>
                        </Card.Body>
                    </Card>
                </div>
            </div>

            <Modal
                show={showModal}
                onHide={() => setShowModal(false)}
                size="lg"
                dialogClassName="mc-modal room-modal"
                backdrop="static"
                keyboard={false}
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 10L12 4L21 10V20C21 21.1 20.1 22 19 22H5C3.9 22 3 21.1 3 20V10Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
                                <path d="M9 22V12H15V22" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Edit Meeting Room' : 'Create Meeting Room'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter details to manage meeting room
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>
                        &times;
                    </button>
                </div>
                <Form onSubmit={handleSubmit} onKeyDown={(e) => handleKeyDown(e, '.room-modal')} onFocus={handleFocus}>
                    <div className="modal-body-custom">
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">
                                    Room Name <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    value={currentRoom.room_name}
                                    onChange={(e) => setCurrentRoom({ ...currentRoom, room_name: e.target.value })}
                                    required
                                    placeholder="Enter room name"
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">
                                    Location <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    value={currentRoom.location}
                                    onChange={(e) => setCurrentRoom({ ...currentRoom, location: e.target.value })}
                                    required
                                    placeholder="Enter location"
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">
                                    Capacity <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    type="number"
                                    className="form-control-custom"
                                    value={currentRoom.capacity}
                                    onChange={(e) => setCurrentRoom({ ...currentRoom, capacity: parseInt(e.target.value) || 0 })}
                                    required
                                    min="1"
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">
                                    In-charge
                                </Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    options={inchargeOptions}
                                    value={inchargeValue}
                                    onChange={(opt) => {
                                        setCurrentRoom({ ...currentRoom, incharge: opt ? opt.value : '' });
                                        if (opt) {
                                            const control = currentSelectControlRef.current;
                                            setTimeout(() => {
                                                if (control) focusNextFromControl(control, '.room-modal');
                                            }, 50);
                                        }
                                    }}
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleSelectKeyDown}
                                    openMenuOnFocus={true}
                                    placeholder="Select Incharge..."
                                    styles={selectStyles}
                                    isClearable
                                />
                            </div>
                        </div>

                        <div className="mb-3">
                            <Form.Label className="form-label-custom">
                                Available Equipment
                            </Form.Label>
                            <div className="d-flex flex-wrap gap-3 mb-3 p-3 rounded" style={{ background: 'white', border: '1px solid #e2e8f0' }}>
                                {EQUIPMENT_OPTIONS.map((option, index) => (
                                    <Form.Check
                                        key={index}
                                        type="checkbox"
                                        label={option}
                                        checked={currentRoom.equipment.includes(option)}
                                        onChange={() => handleEquipmentChange(option)}
                                        id={`eq-${index}`}
                                        style={{ fontSize: '13px', color: '#334155' }}
                                    />
                                ))}
                            </div>
                            <Form.Label className="form-label-custom">
                                Additional Equipment <span className="text-muted fw-normal" style={{ fontSize: '12px' }}>(comma separated)</span>
                            </Form.Label>
                            <Form.Control
                                id="additional-equipment-input"
                                type="text"
                                className="form-control-custom"
                                placeholder="e.g. Laser Pointer, Conference Phone"
                                value={currentRoom.additionalEquipment}
                                onChange={(e) => setCurrentRoom({ ...currentRoom, additionalEquipment: e.target.value })}
                            />
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">
                                    Status
                                </Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    options={statusOptions}
                                    value={statusValue}
                                    onChange={(opt) => {
                                        setCurrentRoom({ ...currentRoom, status: opt ? opt.value : 'active' });
                                        if (opt) {
                                            const control = currentSelectControlRef.current;
                                            setTimeout(() => {
                                                if (control) focusNextFromControl(control, '.room-modal');
                                            }, 50);
                                        }
                                    }}
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleSelectKeyDown}
                                    openMenuOnFocus={true}
                                    placeholder="Select Status..."
                                    styles={selectStyles}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <Form.Label className="form-label-custom">
                                    Is Available
                                </Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    options={availabilityOptions}
                                    value={availabilityValue}
                                    onChange={(opt) => {
                                        setCurrentRoom({ ...currentRoom, is_available: opt ? opt.value : true });
                                        if (opt) {
                                            const control = currentSelectControlRef.current;
                                            setTimeout(() => {
                                                if (control) focusNextFromControl(control, '.room-modal');
                                            }, 50);
                                        }
                                    }}
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleSelectKeyDown}
                                    openMenuOnFocus={true}
                                    placeholder="Select Availability..."
                                    styles={selectStyles}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn-close-custom" onClick={() => setShowModal(false)}>
                            Close
                        </Button>
                        <Button type="submit" className="btn-save-custom">
                            {editMode ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default MeetingRoomList;