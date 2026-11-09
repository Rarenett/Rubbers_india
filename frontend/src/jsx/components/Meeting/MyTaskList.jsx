import React, { useState, useEffect, Fragment } from 'react';
import { Card, Table, Badge, Form, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { getMyTasks, updateTaskStatus } from '../../../services/MeetingManagementService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
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
const RefreshIcon = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#eef2ff" stroke="#6366f1" strokeWidth="1.6" />
        <path d="M16.5 8A5.5 5.5 0 0 0 7.5 12" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7.5 16A5.5 5.5 0 0 0 16.5 12" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" />
        <polyline points="15.5 6 16.5 8 14.5 9" stroke="#6366f1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="8.5 18 7.5 16 9.5 15" stroke="#6366f1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const MyTaskList = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    const statusConfig = {
        completed: { bg: '#dcfce7', color: '#15803d', dot: '#22c55e' },
        in_progress: { bg: '#e0f2fe', color: '#0369a1', dot: '#0ea5e9' },
        pending: { bg: '#fef9c3', color: '#92400e', dot: '#f59e0b' },
    };

    const userDetails = JSON.parse(localStorage.getItem('userDetails')) || {};
    const userId = userDetails.user ? userDetails.user.id : null;

    useEffect(() => {
        if (userId) fetchTasks();
    }, [userId]);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const data = await getMyTasks(userId);
            setTasks(data);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch your tasks.' });
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (taskId, newStatus) => {
        try {
            await updateTaskStatus(taskId, newStatus);
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
            Swal.fire({
                icon: 'success',
                title: 'Status Updated',
                timer: 1000,
                showConfirmButton: false,
                position: 'top-end',
                toast: true
            });
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to update status.' });
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'completed': return <span className="badge badge-success light">Completed</span>;
            case 'in_progress': return <span className="badge badge-info light">In Progress</span>;
            case 'pending': return <span className="badge badge-warning light">Pending</span>;
            default: return <span className="badge badge-primary light">{status ? (status.charAt(0).toUpperCase() + status.slice(1)) : 'Pending'}</span>;
        }
    };

    const handleExport = (format) => {
        const filtered = tasks.filter(t => {
            const matchesFilter = filter === 'all' || t.status === filter;
            const searchStr = `${t.title} ${t.description} ${t.meeting_title} ${t.agenda_points} ${t.status}`.toLowerCase();
            const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
            return matchesFilter && matchesSearch;
        });

        const columns = [
            { header: 'Task Title', dataKey: 'title' },
            { header: 'Meeting', dataKey: 'meeting_title' },
            { header: 'Agenda', dataKey: 'agenda_points' },
            { header: 'Due Date', dataKey: 'due_date', formatter: (val) => formatDate(val) },
            { header: 'Status', dataKey: 'status' }
        ];

        const fileName = `My_Tasks_${new Date().toISOString().split('T')[0]}`;
        const title = 'My Assigned Tasks Report';

        if (format === 'pdf') exportToPDF(filtered, columns, `${fileName}.pdf`, title);
        else if (format === 'excel') exportToExcel(filtered, columns, `${fileName}.xlsx`);
        else if (format === 'print') printData(filtered, columns, title);
    };

    const filteredTasks = tasks.filter(t => {
        const matchesFilter = filter === 'all' || t.status === filter;
        if (!searchTerm) return matchesFilter;
        const searchStr = `${t.title} ${t.description} ${t.meeting_title} ${t.agenda_points} ${t.status}`.toLowerCase();
        return matchesFilter && searchStr.includes(searchTerm.toLowerCase());
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
                            <Card.Title className="mb-0 text-nowrap">My Assigned Tasks</Card.Title>
                            <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                                <div className="search-bar-container w-100 m-0" style={{ maxWidth: '250px' }}>
                                    <span className="search-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Search tasks..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div style={{ minWidth: '150px' }}>
                                    <Form.Select
                                        size="sm"
                                        value={filter}
                                        onChange={(e) => setFilter(e.target.value)}
                                        style={{
                                            borderRadius: '8px',
                                            border: '1px solid #e0e7ff',
                                            padding: '6px 12px',
                                            fontSize: '13px',
                                            fontWeight: '500'
                                        }}
                                    >
                                        <option value="all">All Statuses</option>
                                        <option value="pending">Pending</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="completed">Completed</option>
                                    </Form.Select>
                                </div>
                                <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                                    <div className="d-flex align-items-center gap-2">
                                        <ExportBtn onClick={() => handleExport('pdf')} title="Export PDF"><PdfIcon /></ExportBtn>
                                        <ExportBtn onClick={() => handleExport('excel')} title="Export Excel"><ExcelIcon /></ExportBtn>
                                        <ExportBtn onClick={() => handleExport('print')} title="Print"><PrintIcon /></ExportBtn>
                                        <ExportBtn onClick={fetchTasks} title="Refresh Task List"><RefreshIcon /></ExportBtn>
                                    </div>
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <div className="table-responsive">
                                <table className="table table-responsive-md">
                                    <thead>
                                        <tr>
                                            <th><strong>TASK</strong></th>
                                            <th><strong>AGENDA / MEETING</strong></th>
                                            <th><strong>DUE DATE</strong></th>
                                            <th><strong>STATUS</strong></th>
                                            <th className="text-end"><strong>UPDATE STATUS</strong></th>
                                        </tr>
                                    </thead>
                                <tbody>
                                    {loading && filteredTasks.length === 0 ? (
                                        <tr><td colSpan="5" className="text-center py-5">
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="sr-only">Loading...</span>
                                            </div>
                                        </td></tr>
                                    ) : filteredTasks.length === 0 ? (
                                        <tr><td colSpan="5" className="text-center py-5 text-muted">No tasks found.</td></tr>
                                    ) : (
                                        filteredTasks.map(task => (
                                            <tr key={task.id}>
                                                <td>
                                                    <div className="font-w600 text-black">{task.title}</div>
                                                    <small className="text-muted">{task.description || 'No description provided'}</small>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 600, color: '#1e88e5' }}>{task.meeting_title}</div>
                                                    <div className="fs-14 text-dark mt-1">
                                                        <i className="fa fa-list-ul me-1 text-muted"></i> {task.agenda_points}
                                                    </div>
                                                    {task.agenda_details && (
                                                        <div className="mt-1 small text-muted" style={{ borderLeft: '2px solid #ddd', paddingLeft: '8px', fontSize: '0.78rem' }}>
                                                            {task.agenda_details}
                                                        </div>
                                                    )}
                                                    {task.agenda_file_url && (
                                                        <a href={task.agenda_file_url} target="_blank" rel="noopener noreferrer"
                                                            className="badge bg-light text-orange mt-1" style={{ border: '1px solid #ffd8a8', color: '#e67300' }}>
                                                            <i className="fa fa-paperclip me-1"></i> Attachment
                                                        </a>
                                                    )}
                                                </td>
                                                <td>
                                                    {task.due_date ? (
                                                        <span className="text-nowrap"><i className="fa fa-calendar me-1"></i> {task.due_date}</span>
                                                    ) : (
                                                        <span className="text-muted">No deadline</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {(() => {
                                                        const sc = statusConfig[task.status] || statusConfig.pending;
                                                        return (
                                                            <span style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                                background: sc.bg, color: sc.color,
                                                                fontSize: 11, fontWeight: 700,
                                                                padding: '3px 10px', borderRadius: 20,
                                                                letterSpacing: '0.04em',
                                                            }}>
                                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                                                                {task.status?.replace('_', ' ').toUpperCase()}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="text-end">
                                                    <Form.Select
                                                        size="sm"
                                                        value={task.status}
                                                        onChange={(e) => handleStatusUpdate(task.id, e.target.value)}
                                                        style={{ width: '130px', display: 'inline-block', borderRadius: '6px' }}
                                                    >
                                                        <option value="pending">Pending</option>
                                                        <option value="in_progress">In Progress</option>
                                                        <option value="completed">Completed</option>
                                                    </Form.Select>
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

export default MyTaskList;
