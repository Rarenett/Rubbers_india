import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { Spinner, Card, Button, Form } from 'react-bootstrap';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import { getReportResponsibilities, getResponsibilityReminderDetailsForReport } from '../../../../services/HRManagementService';
import { exportToPDF, exportToExcel, printData } from '../../Assets/exportUtils';
import { getDatePickerFormat } from '../../../../utils/dateUtils';

const ResponsibilityDetailReport = () => {
    // ── State ──────────────────────────────────────────────────────────────
    const [responsibilities, setResponsibilities] = useState([]);
    const [selectedResponsibility, setSelectedResponsibility] = useState(null);
    const [details, setDetails] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchingResponsibilities, setFetchingResponsibilities] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedResponsibility]);

    // Default to current month start, and 1 year into the future for toDate
    const currentDate = new Date();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const [fromDate, setFromDate] = useState(
        `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`
    );
    const [toDate, setToDate] = useState(
        `${currentDate.getFullYear() + 1}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
    );

    const handleDateInputAndSyncMonths = (newFrom, newTo) => {
        setFromDate(newFrom);
        setToDate(newTo);
    };

    // ── Fetch Dropdown Options ─────────────────────────────────────────────
    useEffect(() => {
        const fetchResponsibilities = async () => {
            try {
                const data = await getReportResponsibilities();
                setResponsibilities(data.map(r => ({ value: r.id, label: r.name })));
            } catch (error) {
                console.error("Error fetching report responsibilities:", error);
            } finally {
                setFetchingResponsibilities(false);
            }
        };
        fetchResponsibilities();
    }, []);

    // ── Fetch Details ──────────────────────────────────────────────────────
    const fetchDetails = useCallback(async (responsibilityId) => {
        if (!responsibilityId) {
            setDetails([]);
            return;
        }
        setLoading(true);
        try {
            const data = await getResponsibilityReminderDetailsForReport(responsibilityId);
            setDetails(data);
        } catch (error) {
            console.error("Error fetching details for report:", error);
            setDetails([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedResponsibility) {
            fetchDetails(selectedResponsibility.value);
        } else {
            setDetails([]);
        }
    }, [selectedResponsibility, fetchDetails]);

    // ── Filtered list (client-side search & date filter) ───────────────────
    const filteredData = details.filter((item) => {
        const term = searchTerm.toLowerCase();
        
        let dateInRange = true;
        // Filtering based on reminder_date
        const itemDate = item.reminder_date ? item.reminder_date.split('T')[0] : null;
        if (fromDate && (!itemDate || itemDate < fromDate)) dateInRange = false;
        if (toDate && (!itemDate || itemDate > toDate)) dateInRange = false;

        return dateInRange && (
            (item.employee_names || '').toLowerCase().includes(term) ||
            (item.department_name || '').toLowerCase().includes(term)
        );
    });

    // ── Pagination Logic ───────────────────────────────────────────────────
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    // ── Export Handling ────────────────────────────────────────────────────
    const handleExport = (format) => {
        const columns = [
            { header: 'SL.NO', dataKey: 'index' },
            { header: 'Department', dataKey: 'department_name' },
            { header: 'Employee(s)', dataKey: 'employee_names' },
            { header: 'Start Date', dataKey: 'start_date_formatted' },
            { header: 'Frequency', dataKey: 'frequency_days' },
            { header: 'Reminder Date', dataKey: 'reminder_date_formatted' },
            { header: 'Status', dataKey: 'status_str' }
        ];
        
        const dataWithIndex = filteredData.map((d, i) => {
            return {
                ...d,
                index: i + 1,
                start_date_formatted: d.start_date ? d.start_date.split('-').reverse().join('-') : '-',
                reminder_date_formatted: d.reminder_date ? d.reminder_date.split('-').reverse().join('-') : '-',
                status_str: d.is_acknowledged ? 'Acknowledged' : 'Pending'
            };
        });
        
        const responsibilityName = selectedResponsibility ? selectedResponsibility.label : 'All Responsibilities';
        const title = `Responsibility Detail Report - ${responsibilityName} (${fromDate || 'All'} to ${toDate || 'All'})`;

        if (format === 'pdf') {
            exportToPDF(dataWithIndex, columns, 'responsibility_detail_report.pdf', title, false);
        } else if (format === 'excel') {
            exportToExcel(dataWithIndex, columns, 'responsibility_detail_report.xlsx', false);
        } else if (format === 'print') {
            printData(dataWithIndex, columns, title, false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <Fragment>
            <div className="container-fluid">

                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex flex-column gap-3 px-4 py-3 align-items-start w-100">
                                <Card.Title className="mb-0">Responsibility Detail Report</Card.Title>
                                <div className="d-flex flex-wrap justify-content-start justify-content-xl-end align-items-center gap-3 w-100">
                                    
                                    {/* Responsibility Selection */}
                                    <div className="d-flex align-items-center order-1" style={{ flex: '1 1 auto', minWidth: '250px', maxWidth: '400px', zIndex: 999 }}>
                                        <div style={{ width: '100%' }}>
                                            <Select
                                                options={responsibilities}
                                                value={selectedResponsibility}
                                                onChange={setSelectedResponsibility}
                                                isLoading={fetchingResponsibilities}
                                                placeholder="Select Responsibility..."
                                                classNamePrefix="select"
                                                isClearable
                                                styles={{
                                                    control: (base) => ({
                                                        ...base,
                                                        borderRadius: '6px',
                                                        borderColor: '#cbd5e1',
                                                        minHeight: '37px',
                                                        height: '37px',
                                                        boxShadow: 'none',
                                                        '&:hover': { borderColor: '#94a3b8' },
                                                        cursor: 'pointer'
                                                    }),
                                                    menu: (base) => ({
                                                        ...base,
                                                        borderRadius: '6px',
                                                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                                                        border: '1px solid #e2e8f0',
                                                        zIndex: 9999
                                                    }),
                                                    option: (base, state) => ({
                                                        ...base,
                                                        fontSize: '13px',
                                                        fontWeight: 500,
                                                        backgroundColor: state.isSelected ? '#eff6ff' : state.isFocused ? '#f8fafc' : 'white',
                                                        color: state.isSelected ? '#1d4ed8' : '#475569',
                                                        cursor: 'pointer',
                                                        '&:active': { backgroundColor: '#dbeafe' }
                                                    })
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Export Buttons */}
                                    <div className="d-flex gap-2 align-items-center flex-shrink-0 order-2 order-xl-4">
                                        <Button variant="light" className="border d-flex align-items-center justify-content-center p-0" onClick={() => handleExport('pdf')} title="Export PDF" style={{ height: '37px', width: '37px', borderRadius: '8px' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                        </Button>
                                        <Button variant="light" className="border d-flex align-items-center justify-content-center p-0" onClick={() => handleExport('excel')} title="Export Excel" style={{ height: '37px', width: '37px', borderRadius: '8px' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                        </Button>
                                        <Button variant="light" className="border d-flex align-items-center justify-content-center p-0" onClick={() => handleExport('print')} title="Print" style={{ height: '37px', width: '37px', borderRadius: '8px' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                        </Button>
                                    </div>

                                    {/* Dates and Search Group */}
                                    <div className="d-flex flex-column flex-md-row align-items-stretch align-items-md-center gap-3 flex-grow-1 order-3 order-xl-2">
                                        {/* Date Filters */}
                                        <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3">
                                            <div className="d-flex align-items-center gap-2 flex-grow-1">
                                                <label className="form-label mb-0 fw-bold text-nowrap" style={{ minWidth: '40px' }}>From:</label>
                                                <DatePicker
                                                    className="form-control"
                                                    selected={fromDate ? new Date(fromDate.split('-')[0], fromDate.split('-')[1] - 1, fromDate.split('-')[2]) : null}
                                                    onChange={(date) => {
                                                        if (!date) return;
                                                        const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                                                        handleDateInputAndSyncMonths(formatted, toDate);
                                                    }}
                                                    dateFormat={getDatePickerFormat()}
                                                    placeholderText="From"
                                                    style={{ height: '37px', borderRadius: '6px', fontSize: '13px', width: '100%', minWidth: '130px' }}
                                                />
                                            </div>
                                            <div className="d-flex align-items-center gap-2 flex-grow-1">
                                                <label className="form-label mb-0 fw-bold text-nowrap" style={{ minWidth: '40px' }}>To:</label>
                                                <DatePicker
                                                    className="form-control"
                                                    selected={toDate ? new Date(toDate.split('-')[0], toDate.split('-')[1] - 1, toDate.split('-')[2]) : null}
                                                    onChange={(date) => {
                                                        if (!date) return;
                                                        const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                                                        handleDateInputAndSyncMonths(fromDate, formatted);
                                                    }}
                                                    dateFormat={getDatePickerFormat()}
                                                    placeholderText="To"
                                                    style={{ height: '37px', borderRadius: '6px', fontSize: '13px', width: '100%', minWidth: '130px' }}
                                                />
                                            </div>
                                        </div>

                                        {/* Search Input */}
                                        <div className="search-bar-container" style={{ flex: '1 1 auto', margin: 0, minWidth: '200px', maxWidth: '400px', position: 'relative' }}>
                                            <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                            <Form.Control
                                                type="text"
                                                placeholder="Search report..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                style={{ height: '37px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px', width: '100%' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </Card.Header>
                            <Card.Body>
                                {loading ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-responsive-md">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '60px' }}><strong>SI NO</strong></th>
                                                    <th><strong>DEPARTMENT</strong></th>
                                                    <th><strong>EMPLOYEE(S)</strong></th>
                                                    <th><strong>START DATE</strong></th>
                                                    <th><strong>FREQUENCY (DAYS)</strong></th>
                                                    <th><strong>REMINDER DATE</strong></th>
                                                    <th><strong>STATUS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {!selectedResponsibility ? (
                                                    <tr><td colSpan="7" className="text-center py-4 text-muted">Please select a responsibility from the dropdown above to view its report.</td></tr>
                                                ) : currentItems.length === 0 ? (
                                                    <tr><td colSpan="7" className="text-center py-4 text-muted">No reminder details found for the selected date range and criteria.</td></tr>
                                                ) : (
                                                    <Fragment>
                                                        {currentItems.map((detail, index) => {
                                                            const slNo = indexOfFirstItem + index + 1;
                                                            return (
                                                                <tr key={detail.id}>
                                                                    <td>{slNo}</td>
                                                                    <td className="fw-semibold">{detail.department_name}</td>
                                                                    <td className="fw-bold">{detail.employee_names}</td>
                                                                    <td>{detail.start_date ? detail.start_date.split('-').reverse().join('-') : '-'}</td>
                                                                    <td>{detail.frequency_days}</td>
                                                                    <td>{detail.reminder_date ? detail.reminder_date.split('-').reverse().join('-') : '-'}</td>
                                                                    <td>
                                                                        {detail.is_acknowledged ? (
                                                                            <span className="badge badge-success light">Acknowledged</span>
                                                                        ) : (
                                                                            <span className="badge badge-warning light">Pending</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </Fragment>
                                                )}
                                            </tbody>
                                        </table>

                                        {selectedResponsibility && !loading && currentItems.length > 0 && totalPages > 1 && (
                                            <div className="d-flex justify-content-between align-items-center mt-3">
                                                <div className="text-muted" style={{ fontSize: '13px' }}>
                                                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredData.length)} of {filteredData.length} entries
                                                </div>
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
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </div>
                </div>
            </div>
        </Fragment>
    );
};

export default ResponsibilityDetailReport;
