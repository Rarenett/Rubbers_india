import React, { useState, useEffect, useCallback } from 'react';
import { Card } from 'react-bootstrap';
import DatePicker from 'react-datepicker';
import { Link } from 'react-router-dom';
import { getRenewalReminders } from '../../../services/RenewalService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import { formatDate, getDatePickerFormat } from '../../../utils/dateUtils';
import { usePageTitle } from '../../../context/TitleContext';

const RenewalReport = () => {
    usePageTitle("Renewal Report");
    // ── State ──────────────────────────────────────────────────────────────
    
    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, fromDate, toDate]);

    // ── Fetch Reminders ────────────────────────────────────────────────────
    const fetchReminders = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getRenewalReminders();
            const arr = Array.isArray(data) ? data : (data.results || []);
            setReminders(arr);
        } catch (error) {
            console.error('Error fetching renewal reminders for report:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReminders();
    }, [fetchReminders]);

    // ── Filtered List ──────────────────────────────────────────────────────
    const filteredReminders = reminders.filter((item) => {
        const term = searchTerm.toLowerCase();

        let dateInRange = true;
        const itemDate = item.renewal_date ? item.renewal_date.split('T')[0] : null;
        if (fromDate && (!itemDate || itemDate < fromDate)) dateInRange = false;
        if (toDate && (!itemDate || itemDate > toDate)) dateInRange = false;

        const allocatedStr = Array.isArray(item.allocated_to_details)
            ? item.allocated_to_details.map(emp => emp.name || emp.email).join(' ')
            : '';

        const matchesSearch =
            (item.name || '').toLowerCase().includes(term) ||
            (item.renewal_subject_name || '').toLowerCase().includes(term) ||
            (item.branch_name || '').toLowerCase().includes(term) ||
            (item.department_name || '').toLowerCase().includes(term) ||
            allocatedStr.toLowerCase().includes(term) ||
            (item.remarks || '').toLowerCase().includes(term);

        return dateInRange && matchesSearch;
    });

    // ── Pagination Logic ───────────────────────────────────────────────────
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredReminders.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredReminders.length / itemsPerPage);

    // ── Export Handling ────────────────────────────────────────────────────
    const handleExport = (format) => {
        const columns = [
            { header: 'Sl. No.', dataKey: 'index' },
            { header: 'Branch', dataKey: 'branch_name', formatter: (v) => v || '—' },
            { header: 'Subject', dataKey: 'renewal_subject_name', formatter: (v) => v || '—' },
            { header: 'Name', dataKey: 'name', formatter: (v) => v || '—' },
            { header: 'Department', dataKey: 'department_name', formatter: (v) => v || '—' },
            { header: 'Allocated To', dataKey: 'allocated_to_str', formatter: (v) => v || '—' },
            { header: 'Renewal Date', dataKey: 'formatted_date', formatter: (v) => v || '—' },
            { header: 'Reminder Days', dataKey: 'reminder_days_str', formatter: (v) => v || '—' }
        ];

        const dataWithIndex = filteredReminders.map((d, i) => ({
            ...d,
            index: i + 1,
            allocated_to_str: Array.isArray(d.allocated_to_details)
                ? d.allocated_to_details.map(emp => emp.name || emp.email).join(', ')
                : '—',
            formatted_date: d.renewal_date ? formatDate(d.renewal_date) : '—',
            reminder_days_str: `${d.reminder_days || 0} days`
        }));

        const title = `Renewal Reminders Report (${fromDate || 'All Dates'} to ${toDate || 'All Dates'})`;

        if (format === 'pdf') exportToPDF(dataWithIndex, columns, 'renewal_reminders_report.pdf', title);
        else if (format === 'excel') exportToExcel(dataWithIndex, columns, 'renewal_reminders_report.xlsx');
        else if (format === 'print') printData(dataWithIndex, columns, title);
    };

    // ── Render ─────────────────────────────────────────────────────────────
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
                        <Card.Header className="d-flex justify-content-between align-items-start flex-wrap">
                            {/* <Card.Title className="mb-0 mt-2">Renewal Reminders Report</Card.Title> */}
                            
                            <div className="d-flex align-items-center gap-3 flex-wrap mt-2 mt-sm-0 justify-content-end flex-grow-1">
                                <div className="d-flex gap-2 flex-wrap">
                                    <div className="d-flex align-items-center gap-2">
                                    <label className="form-label mb-0 fw-bold">From:</label>
                                    <DatePicker
                                        className="form-control form-control-sm"
                                        selected={fromDate ? new Date(fromDate.split('-')[0], fromDate.split('-')[1] - 1, fromDate.split('-')[2]) : null}
                                        onChange={(date) => {
                                            if (!date) {
                                                setFromDate('');
                                                return;
                                            }
                                            const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                                            setFromDate(formatted);
                                        }}
                                        dateFormat={getDatePickerFormat()}
                                        placeholderText="All Dates"
                                        isClearable
                                    />
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <label className="form-label mb-0 fw-bold">To:</label>
                                    <DatePicker
                                        className="form-control form-control-sm"
                                        selected={toDate ? new Date(toDate.split('-')[0], toDate.split('-')[1] - 1, toDate.split('-')[2]) : null}
                                        onChange={(date) => {
                                            if (!date) {
                                                setToDate('');
                                                return;
                                            }
                                            const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                                            setToDate(formatted);
                                        }}
                                        dateFormat={getDatePickerFormat()}
                                        placeholderText="All Dates"
                                        placeholderText="All Dates"
                                        isClearable
                                    />
                                </div>
                                </div>
                                
                                <div className="d-flex gap-3 flex-wrap align-items-center justify-content-end">
                                <div className="search-bar-container m-0" style={{ maxWidth: '250px', flex: 1, minWidth: '150px' }}>
                                    <span className="search-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Search report..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                
                                <div className="d-flex gap-2">
                                    <button className="btn btn-sm btn-light border" onClick={() => handleExport('pdf')} title="Export PDF">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    </button>
                                    <button className="btn btn-sm btn-light border" onClick={() => handleExport('excel')} title="Export Excel">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                    </button>
                                    <button className="btn btn-sm btn-light border" onClick={() => handleExport('print')} title="Print">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                    </button>
                                </div>
                                </div>
                            </div>
                        </Card.Header>

                        <Card.Body className="p-0">
                            <div className="table-responsive">
                                <table className="table table-responsive-md">
                                <thead>
                                    <tr>
                                        <th style={{ width: '60px' }}>SL NO</th>
                                        <th>BRANCH</th>
                                        <th>SUBJECT</th>
                                        <th>NAME</th>
                                        <th>DEPARTMENT</th>
                                        <th>ALLOCATED TO</th>
                                        <th>RENEWAL DATE</th>
                                        <th>REMINDER DAYS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="8" className="text-center py-4">Loading report...</td></tr>
                                    ) : filteredReminders.length === 0 ? (
                                        <tr><td colSpan="8" className="text-center py-4 text-muted">No renewal reminders found for the selected criteria.</td></tr>
                                    ) : currentItems.map((item, idx) => (
                                        <tr key={item.id || idx}>
                                            <td>{indexOfFirstItem + idx + 1}</td>
                                            <td>{item.branch_name || '—'}</td>
                                            <td><strong>{item.renewal_subject_name || '—'}</strong></td>
                                            <td>{item.name || '—'}</td>
                                            <td>{item.department_name || '—'}</td>
                                            <td>
                                                {Array.isArray(item.allocated_to_details) && item.allocated_to_details.length > 0 ? (
                                                    <div className="d-flex flex-wrap gap-1">
                                                        {item.allocated_to_details.map((emp, i) => (
                                                            <span key={i} className="badge badge-success light me-1 mb-1">
                                                                {emp.name || emp.email}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : '—'}
                                            </td>
                                            <td>{item.renewal_date ? formatDate(item.renewal_date) : '—'}</td>
                                            <td>{item.reminder_days || 0} days</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {filteredReminders.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredReminders.length)} of {filteredReminders.length} entries
                                </div>
                                            {totalPages > 1 && (
                                                <nav>
                                    <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                        <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                            <button
                                                type="button"
                                                className="page-link"
                                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                disabled={currentPage === 1}
                                                style={{ border: 'none', background: 'none' }}
                                            >
                                                <i className="la la-angle-left" />
                                            </button>
                                        </li>
                                        {Array.from({ length: totalPages }, (_, index) => {
                                            const pageNumber = index + 1;
                                            if (
                                                pageNumber === 1 ||
                                                pageNumber === totalPages ||
                                                (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                            ) {
                                                return (
                                                    <li key={pageNumber} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}>
                                                        <button
                                                            type="button"
                                                            className="page-link"
                                                            onClick={() => setCurrentPage(pageNumber)}
                                                            style={{ border: 'none' }}
                                                        >
                                                            {pageNumber}
                                                        </button>
                                                    </li>
                                                );
                                            } else if (
                                                pageNumber === currentPage - 2 ||
                                                pageNumber === currentPage + 2
                                            ) {
                                                return (
                                                    <li key={pageNumber} className="page-item disabled">
                                                        <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                    </li>
                                                );
                                            }
                                            return null;
                                        })}
                                        <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                            <button
                                                type="button"
                                                className="page-link"
                                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                                disabled={currentPage === totalPages}
                                                style={{ border: 'none', background: 'none' }}
                                            >
                                                <i className="la la-angle-right" />
                                            </button>
                                        </li>
                                    </ul>
                                </nav>
                                            )}
                                        </div>
                                    )}
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default RenewalReport;
