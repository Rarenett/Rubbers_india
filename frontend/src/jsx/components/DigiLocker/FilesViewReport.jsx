import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DigiLockerService from '../../../services/DigiLockerService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils.jsx';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { getDatePickerFormat } from '../../../utils/dateUtils';
import { Card } from 'react-bootstrap';
import { usePageTitle } from '../../../context/TitleContext';
import '../Assets/FileDashboard.css';

const CustomDateInput = React.forwardRef(({ value, onClick, onChange, placeholder }, ref) => (
    <input
        value={value}
        onClick={onClick}
        onChange={onChange}
        placeholder={placeholder}
        ref={ref}
        className="form-control"
        style={{ height: '49px', borderRadius: '8px' }}
    />
));

const FilesViewReport = () => {
    usePageTitle("Files View Report");

    // ── State ──────────────────────────────────────────────────────────────
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // Default to current month or active financial year
    const currentDate = new Date();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    const [fromDate, setFromDate] = useState(
        localStorage.getItem('active_fy_start') ||
        `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`
    );
    const [toDate, setToDate] = useState(
        localStorage.getItem('active_fy_end') ||
        `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
    );

    useEffect(() => {
        const handleFyUpdate = () => {
            const fyStart = localStorage.getItem('active_fy_start');
            const fyEnd = localStorage.getItem('active_fy_end');
            if (fyStart && fyEnd) {
                setFromDate(fyStart);
                setToDate(fyEnd);
            }
        };
        window.addEventListener('financialYearUpdate', handleFyUpdate);
        return () => window.removeEventListener('financialYearUpdate', handleFyUpdate);
    }, []);

    // ── Fetch ─────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = { all: 'true' };
            if (fromDate) params.start_date = fromDate;
            if (toDate) params.end_date = toDate;

            const res = await DigiLockerService.getFilesViewReport(params);
            const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
            setLogs(data);
        } catch (err) {
            console.error('Error fetching Files View Report:', err);
        } finally {
            setLoading(false);
        }
    }, [fromDate, toDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatDateTime = (timestamp) => {
        if (!timestamp) return { date: '-', time: '-' };
        const d = new Date(timestamp);
        if (isNaN(d.getTime())) return { date: '-', time: '-' };
        const dateStr = d.toLocaleDateString('en-GB'); // DD/MM/YYYY
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        return { date: dateStr, time: timeStr, rawDate: timestamp.split('T')[0] };
    };

    // ── Filtered list (client-side search & date filter) ──
    const filteredData = useMemo(() => {
        return logs.filter((item) => {
            const term = searchTerm.toLowerCase();
            const filename = (item.document_name || item.document?.original_filename || '').toLowerCase();
            const access = (item.actor_name || '').toLowerCase();
            const documentOf = (item.target_employee_name || '').toLowerCase();
            const folder = (item.folder_name || '').toLowerCase();

            const matchesSearch = !term ||
                filename.includes(term) ||
                access.includes(term) ||
                documentOf.includes(term) ||
                folder.includes(term);

            let dateInRange = true;
            if (item.timestamp) {
                const itemDate = item.timestamp.split('T')[0];
                if (fromDate && itemDate < fromDate) dateInRange = false;
                if (toDate && itemDate > toDate) dateInRange = false;
            }
            return matchesSearch && dateInRange;
        });
    }, [logs, searchTerm, fromDate, toDate]);

    // ── Pagination Logic ───────────────────────────────────────────────
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    const handleExport = (format) => {
        const columns = [
            { header: 'Sl. No.', dataKey: 'index' },
            { header: 'Date', dataKey: 'date' },
            { header: 'Time', dataKey: 'time' },
            { header: 'Filename', dataKey: 'filename' },
            { header: 'Document Owner', dataKey: 'documentOwner' },
            { header: 'Access', dataKey: 'access' }
        ];

        const dataWithIndex = filteredData.map((d, i) => {
            const dt = formatDateTime(d.timestamp);
            return {
                index: i + 1,
                date: dt.date,
                time: dt.time,
                filename: d.document_name || d.document?.original_filename || '—',
                documentOwner: d.target_employee_name ? `${d.target_employee_name}${d.target_employee_designation ? ` (${d.target_employee_designation})` : ''}` : '—',
                access: d.actor_name ? `${d.actor_name}${d.actor_designation ? ` (${d.actor_designation})` : ''}` : '—'
            };
        });

        const title = `Files View Report (${fromDate || 'All'} to ${toDate || 'All'})`;

        if (format === 'pdf') exportToPDF(dataWithIndex, columns, 'files_view_report.pdf', title);
        else if (format === 'excel') exportToExcel(dataWithIndex, columns, 'files_view_report.xlsx');
        else if (format === 'print') printData(dataWithIndex, columns, title);
    };

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Body>
                            <div className="d-flex flex-column gap-3 w-100 mb-2">
                                
                                {/* Top Row: Title + Export Buttons */}
                                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                                    <div>
                                        <h4 className="mb-0 fw-bold text-dark">Files View Report</h4>
                                        <small className="text-muted">Real-time audit history of successful document view access</small>
                                    </div>

                                    {/* Export Buttons matching SalesReportList */}
                                    <div className="d-flex gap-2">
                                        <button className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center" onClick={() => handleExport('pdf')} title="Export PDF" style={{ width: '38px', height: '38px', borderRadius: '8px' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                        </button>
                                        <button className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center" onClick={() => handleExport('excel')} title="Export Excel" style={{ width: '38px', height: '38px', borderRadius: '8px' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                        </button>
                                        <button className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center" onClick={() => handleExport('print')} title="Print" style={{ width: '38px', height: '38px', borderRadius: '8px' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Bottom Row: Date Filters + Search matching SalesReportList flex-nowrap row */}
                                <div className="row flex-nowrap w-100 m-0">
                                    <div className="col-4 px-1">
                                        <div className="d-flex align-items-center gap-2 w-100">
                                            <label className="form-label mb-0 fw-bold flex-shrink-0 text-nowrap">From:</label>
                                            <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                                <DatePicker
                                                    customInput={<CustomDateInput />}
                                                    selected={fromDate ? new Date(fromDate.split('-')[0], fromDate.split('-')[1] - 1, fromDate.split('-')[2]) : null}
                                                    onChange={(date) => {
                                                        if (!date) return;
                                                        const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                                                        setFromDate(formatted);
                                                    }}
                                                    dateFormat={getDatePickerFormat()}
                                                    placeholderText={getDatePickerFormat().toLowerCase()}
                                                    wrapperClassName="w-100"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-4 px-1">
                                        <div className="d-flex align-items-center gap-2 w-100">
                                            <label className="form-label mb-0 fw-bold flex-shrink-0 text-nowrap">To:</label>
                                            <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                                <DatePicker
                                                    customInput={<CustomDateInput />}
                                                    selected={toDate ? new Date(toDate.split('-')[0], toDate.split('-')[1] - 1, toDate.split('-')[2]) : null}
                                                    onChange={(date) => {
                                                        if (!date) return;
                                                        const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                                                        setToDate(formatted);
                                                    }}
                                                    dateFormat={getDatePickerFormat()}
                                                    placeholderText={getDatePickerFormat().toLowerCase()}
                                                    wrapperClassName="w-100"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-4 px-1">
                                        <div className="search-bar-container w-100">
                                            <span className="search-icon">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                            </span>
                                            <input
                                                type="text"
                                                className="search-input w-100"
                                                style={{ height: '49px' }}
                                                placeholder="Search filename, employee..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Table Content */}
                                <div className="mt-1 px-1 pb-4">
                                    <div className="table-responsive">
                                        <table className="fd-table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '60px' }}>Sl.No</th>
                                                    <th>Date</th>
                                                    <th>Time</th>
                                                    <th>Filename</th>
                                                    <th>Document Owner</th>
                                                    <th className="text-end">Access</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {loading ? (
                                                    <tr><td colSpan="6" className="text-center py-4">Loading report...</td></tr>
                                                ) : filteredData.length === 0 ? (
                                                    <tr><td colSpan="6" className="text-center py-4 text-muted">No file view records found for the selected date range.</td></tr>
                                                ) : currentItems.map((item, idx) => {
                                                    const dt = formatDateTime(item.timestamp);
                                                    return (
                                                        <tr key={item.id || idx}>
                                                             <td>{indexOfFirstItem + idx + 1}</td>
                                                            <td className="fw-semibold">{dt.date}</td>
                                                            <td>
                                                                <span className="badge badge-info light font-w500" style={{ fontSize: '11px' }}>
                                                                    <i className="fa fa-clock me-1"></i>{dt.time}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className="text-primary fw-bold">
                                                                    <i className="fa fa-file-alt me-2 text-muted"></i>
                                                                    {item.document_name || item.document?.original_filename || '—'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className="badge badge-light text-dark border font-w500 px-2 py-1" style={{ fontSize: '12px' }}>
                                                                    <i className="fa fa-id-badge me-1 text-primary"></i>
                                                                    {item.target_employee_name || '—'}
                                                                </span>
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="d-flex flex-column align-items-end">
                                                                    <span className="fw-bold text-dark">
                                                                        <i className="fa fa-user me-1 text-secondary"></i>
                                                                        {item.actor_name || '—'}
                                                                    </span>
                                                                    {item.actor_designation && (
                                                                        <span className="text-muted small" style={{ fontSize: '11px' }}>
                                                                            {item.actor_designation}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {filteredData.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredData.length)} of {filteredData.length} entries
                                            </div>
                                            {totalPages > 1 && (
                                                <nav>
                                                    <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                        <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
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
                                                                        <button type="button" className="page-link" onClick={() => setCurrentPage(pageNumber)} style={{ border: 'none' }}>
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
                                                            <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-right" />
                                                            </button>
                                                        </li>
                                                    </ul>
                                                </nav>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default FilesViewReport;
