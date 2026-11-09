import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pagination } from 'react-bootstrap';
import axiosInstance from '../../../services/AxiosInstance';
import Swal from 'sweetalert2';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';

const TaskReportList = () => {
    const [tasks, setTasks] = useState([]);
    const [filteredTasks, setFilteredTasks] = useState([]);
    const [search, setSearch] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const navigate = useNavigate();

    const fetchTasks = async () => {
        try {
            const res = await axiosInstance.get('/api/task-management/tasks/?report=true');
            setTasks(res.data);
            setFilteredTasks(res.data);
        } catch (error) {
            console.error("Error fetching tasks:", error);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    useEffect(() => {
        let result = tasks;
        if (fromDate) {
            result = result.filter(t => t.plannedDate >= fromDate);
        }
        if (toDate) {
            result = result.filter(t => t.plannedDate <= toDate);
        }
        if (search) {
            const s = search.toLowerCase();
            result = result.filter(t => 
                (t.taskName && t.taskName.toLowerCase().includes(s)) || 
                (t.description && t.description.toLowerCase().includes(s)) ||
                (t.plannedDate && t.plannedDate.toLowerCase().includes(s)) ||
                (t.plannedStartTime && t.plannedStartTime.toLowerCase().includes(s)) ||
                (t.expectedDuration && t.expectedDuration.toLowerCase().includes(s)) ||
                (t.priority && t.priority.toLowerCase().includes(s)) ||
                (t.status && t.status.toLowerCase().includes(s)) ||
                (t.assigned_by ? 'admin'.includes(s) : 'self'.includes(s)) || 'myself'.includes(s)
            );
        }
        setFilteredTasks(result);
        setCurrentPage(1);
    }, [search, fromDate, toDate, tasks]);

    const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredTasks.slice(indexOfFirstItem, indexOfLastItem);

    const handleDelete = async (taskId) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "Are you sure you want to delete this task?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Delete'
        });

        if (result.isConfirmed) {
            try {
                await axiosInstance.delete(`/api/task-management/tasks/${taskId}/`);
                Swal.fire('Deleted!', 'Task deleted successfully.', 'success');
                fetchTasks();
            } catch (error) {
                Swal.fire('Error', 'Unable to delete task.', 'error');
            }
        }
    };

    const handleExport = (format) => {
        const columns = [
            { header: 'Sl No', dataKey: 'slNo' },
            { header: 'Task Name', dataKey: 'taskName' },
            { header: 'Date & Time', dataKey: 'plannedDateTime' },
            { header: 'Duration', dataKey: 'expectedDuration' },
            { header: 'Priority', dataKey: 'priority' },
            { header: 'Status', dataKey: 'status' },
            { header: 'Completed At', dataKey: 'completedAt' },
            { header: 'Assigned By', dataKey: 'assignedBy' }
        ];

        const dataToExport = filteredTasks.map((task, index) => ({
            slNo: index + 1,
            taskName: task.taskName,
            plannedDateTime: `${task.plannedDate} ${task.plannedStartTime}`,
            expectedDuration: task.expectedDuration,
            priority: task.priority,
            status: task.status,
            completedAt: task.status === 'Completed' && task.completedAt ? new Date(task.completedAt).toLocaleString() : '-',
            assignedBy: task.assigned_by ? 'Admin' : 'Self'
        }));

        const title = 'Task Report';
        if (format === 'pdf') exportToPDF(dataToExport, columns, title);
        else if (format === 'excel') exportToExcel(dataToExport, columns, title);
        else if (format === 'print') printData(dataToExport, columns, title);
    };

    const handleStartTask = async (taskId) => {
        try {
            await axiosInstance.post(`/api/task-management/tasks/${taskId}/start_task/`);
            fetchTasks();
        } catch (error) {
            console.error("Error starting task:", error);
        }
    };

    const handleCompleteTask = async (taskId) => {
        try {
            await axiosInstance.post(`/api/task-management/tasks/${taskId}/complete_task/`);
            fetchTasks();
        } catch (error) {
            console.error("Error completing task:", error);
        }
    };

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <div className="card" style={{ borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                        <div className="card-header border-0 pb-0 d-flex justify-content-between align-items-center flex-wrap" style={{ gap: '15px' }}>
                            <div className="d-flex align-items-center" style={{ gap: '15px' }}>
                                <button 
                                    onClick={() => navigate('/task-management/dashboard')} 
                                    className="btn btn-primary btn-sm d-flex align-items-center"
                                    style={{ gap: '6px', borderRadius: '6px', height: 'fit-content' }}
                                >
                                    <i className="fa fa-arrow-left"></i> Back
                                </button>
                                <div>
                                    <h4 className="card-title mb-1" style={{ fontSize: '1.25rem', fontWeight: '600' }}>All Tasks</h4>
                                    <p className="mb-0 text-muted" style={{ fontSize: '13px' }}>View and manage your tasks</p>
                                </div>
                            </div>
                            
                            <div className="d-flex align-items-center flex-wrap" style={{ gap: '12px' }}>
                                <div className="d-flex align-items-center" style={{ gap: '8px' }}>
                                    <input 
                                        type="date" 
                                        className="form-control" 
                                        value={fromDate}
                                        onChange={(e) => setFromDate(e.target.value)}
                                        style={{ width: '130px', borderRadius: '6px' }}
                                    />
                                    <span className="text-muted">to</span>
                                    <input 
                                        type="date" 
                                        className="form-control" 
                                        value={toDate}
                                        onChange={(e) => setToDate(e.target.value)}
                                        style={{ width: '130px', borderRadius: '6px' }}
                                    />
                                </div>
                                <div className="input-group search-area" style={{ width: '250px', border: '1px solid #e2e2e2', borderRadius: '6px', backgroundColor: '#f9f9fc', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                                    <span className="input-group-text" style={{ background: 'transparent', border: 'none', padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <i className="fa fa-search" style={{ color: '#5682b4', fontSize: '14px', fontWeight: 'bold' }}></i>
                                    </span>
                                    <input 
                                        type="text" 
                                        className="form-control" 
                                        placeholder="Search tasks, dates, status, assignee..." 
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        style={{ height: '38px', border: 'none', background: 'transparent', padding: '0', boxShadow: 'none', color: '#5682b4', fontSize: '14px' }}
                                    />
                                </div>
                                <div className="d-flex align-items-center" style={{ gap: '8px' }}>
                                    <button className="btn btn-light border p-0 d-flex justify-content-center align-items-center" onClick={() => handleExport('pdf')} title="Export to PDF" style={{ height: '38px', width: '38px', borderRadius: '6px' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    </button>
                                    <button className="btn btn-light border p-0 d-flex justify-content-center align-items-center" onClick={() => handleExport('excel')} title="Export to Excel" style={{ height: '38px', width: '38px', borderRadius: '6px' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                    </button>
                                    <button className="btn btn-light border p-0 d-flex justify-content-center align-items-center" onClick={() => handleExport('print')} title="Print" style={{ height: '38px', width: '38px', borderRadius: '6px' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="card-body">
                            <div className="table-responsive">
                                <table className="table w-100">
                                    <thead>
                                        <tr>
                                            <th style={{width: '50px'}}><strong>Sl No</strong></th>
                                            <th><strong>Task Name</strong></th>
                                            <th><strong>Date & Time</strong></th>
                                            <th><strong>Duration</strong></th>
                                            <th><strong>Priority</strong></th>
                                            <th><strong>Status</strong></th>
                                            <th><strong>Completed At</strong></th>
                                            <th><strong>Assigned By</strong></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentItems.length > 0 ? (
                                            currentItems.map((task, index) => (
                                                <tr key={task.id}>
                                                    <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                    <td>{task.taskName}</td>
                                                    <td>
                                                        {task.plannedDate} <br />
                                                        <small className="text-muted">{task.plannedStartTime}</small>
                                                    </td>
                                                    <td>{task.expectedDuration}</td>
                                                    <td>
                                                        <span className={`badge light badge-${task.priority === 'High' || task.priority === 'Critical' ? 'danger' : task.priority === 'Medium' ? 'warning' : 'info'}`}>
                                                            {task.priority}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`badge light badge-${task.status === 'Completed' ? 'success' : task.status === 'In Progress' ? 'primary' : task.status === 'Incomplete' ? 'danger' : 'light'}`}>
                                                            {task.status}
                                                        </span>
                                                    </td>
                                                    <td>{task.status === 'Completed' && task.completedAt ? new Date(task.completedAt).toLocaleString() : '-'}</td>
                                                    <td>
                                                        <span className={`badge light badge-${task.assigned_by ? 'dark' : 'info'}`}>
                                                            {task.assigned_by ? 'Admin' : 'Self'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="8" className="text-center">No tasks found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {totalPages > 1 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap">
                                    <div className="mb-2">
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredTasks.length)} of {filteredTasks.length} entries
                                    </div>
                                    <nav>
                                <ul className="pagination pagination-gutter pagination-success no-bg mb-0">
                                    <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                        <button className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>
                                            <i className="la la-angle-left"></i>
                                        </button>
                                    </li>
                                    {Array.from({ length: totalPages }, (_, i) => (
                                        <li key={i + 1} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
                                            <button className="page-link" onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
                                        </li>
                                    ))}
                                    <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                        <button className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}>
                                            <i className="la la-angle-right"></i>
                                        </button>
                                    </li>
                                </ul>
                            </nav>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskReportList;
