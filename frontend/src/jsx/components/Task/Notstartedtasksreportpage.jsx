import React, { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { getNotStartedTasksReport } from '../../../services/TaskService';
import { fetchCompanyFinancialYears } from '../../../services/CompanyService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return isNaN(date.getTime()) ? d : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return isNaN(date.getTime())
        ? d
        : date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const escapeHtml = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const categoryText = (task) =>
    `${task.category_name || '—'}${task.subcategory_name ? ' › ' + task.subcategory_name : ''}`;

const getPct = (item) =>
    Math.round(Number(item.completed_percentage ?? (item.task?.completed_percentage ?? 0)));

const statusText = (item) => {
    const pct = getPct(item);
    if (pct >= 100) return 'Completed';
    if (item.start_date_passed) return 'Start Date Passed';
    if (pct > 0) return 'In Progress';
    return 'Not Started';
};

const statusBadgeClass = (item) => {
    const pct = getPct(item);
    if (pct >= 100) return 'success';
    if (item.start_date_passed) return 'danger';
    if (pct > 0) return 'primary';
    return 'secondary';
};

const REPORT_TITLE = 'Pending Tasks';
const FILE_NAME = 'Pending_Tasks';

const EXPORT_COLUMNS = [
    { header: '#', key: 'index', width: 6 },
    { header: 'Task Name', key: 'task_name', width: 28 },
    { header: 'Category', key: 'category', width: 26 },
    { header: 'Type', key: 'task_type', width: 12 },
    { header: 'Assigned To', key: 'assigned_to', width: 22 },
    { header: 'Assigned By', key: 'assigned_by', width: 20 },
    { header: 'Approved On', key: 'approved_on', width: 20 },
    { header: 'Start Date', key: 'start_date', width: 14 },
    { header: 'Due Date', key: 'due_date', width: 14 },
    { header: 'Progress', key: 'percentage', width: 14 },
    { header: 'Status', key: 'status', width: 18 },
];

const toExportRow = (item, i) => ({
    index: i + 1,
    task_name: item.task?.task_name || '—',
    category: categoryText(item.task || {}),
    task_type: item.task?.task_type || 'individual',
    assigned_to: item.assigned_employee_name || '—',
    assigned_by: item.created_by_name || '—',
    approved_on: formatDateTime(item.approved_on),
    start_date: formatDate(item.task?.start_date),
    due_date: formatDate(item.task?.due_date),
    percentage: `${getPct(item)}%`,
    status: statusText(item),
});

const NotStartedTasksReportPage = () => {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [summary, setSummary] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [fromDate, setFromDate] = useState(
        localStorage.getItem('active_fy_start') || ''
    );
    const [toDate, setToDate] = useState(
        localStorage.getItem('active_fy_end') || ''
    );
    const [percentageFilter, setPercentageFilter] = useState('all');
    const [customMinPct, setCustomMinPct] = useState('');
    const [customMaxPct, setCustomMaxPct] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Load active financial year from company settings
    useEffect(() => {
        const fetchFy = async () => {
            try {
                const companyId = localStorage.getItem('companyId') || 1;
                const res = await fetchCompanyFinancialYears(companyId);
                const fyList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
                const activeFy = fyList.find((fy) => fy.is_active);
                if (activeFy) {
                    setFromDate(activeFy.start_date);
                    setToDate(activeFy.end_date);
                    localStorage.setItem('active_fy_start', activeFy.start_date);
                    localStorage.setItem('active_fy_end', activeFy.end_date);
                }
            } catch (err) {
                console.error('Failed to fetch active financial year:', err);
            }
        };

        const currentFyStart = localStorage.getItem('active_fy_start');
        const currentFyEnd = localStorage.getItem('active_fy_end');
        if (currentFyStart && currentFyEnd) {
            setFromDate(currentFyStart);
            setToDate(currentFyEnd);
        }
        fetchFy();

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

    const fetchReport = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getNotStartedTasksReport();
            setItems(data?.items || []);
            setSummary(data?.summary || {});
        } catch (err) {
            console.error('Failed to load pending tasks report:', err);
            Swal.fire({
                icon: 'error',
                title: 'Error Loading Report',
                text: err?.response?.data?.detail || 'Could not fetch the report. Please try again.',
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchReport(); }, [fetchReport]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, fromDate, toDate, percentageFilter, customMinPct, customMaxPct]);

    const handleClearDateFilter = () => {
        setFromDate('');
        setToDate('');
    };

    const handleClearPercentageFilter = () => {
        setPercentageFilter('all');
        setCustomMinPct('');
        setCustomMaxPct('');
    };

    const filteredItems = useMemo(() => {
        let result = items;

        // Period filter (Date range)
        if (fromDate) {
            result = result.filter((item) => {
                const sDate = item.task?.start_date;
                const dDate = item.task?.due_date;
                const aDate = item.approved_on ? item.approved_on.slice(0, 10) : null;
                return (sDate && sDate >= fromDate) || (dDate && dDate >= fromDate) || (aDate && aDate >= fromDate);
            });
        }

        if (toDate) {
            result = result.filter((item) => {
                const sDate = item.task?.start_date;
                const dDate = item.task?.due_date;
                const aDate = item.approved_on ? item.approved_on.slice(0, 10) : null;
                return (dDate && dDate <= toDate) || (sDate && sDate <= toDate) || (aDate && aDate <= toDate);
            });
        }

        // Percentage filter
        if (percentageFilter !== 'all') {
            result = result.filter((item) => {
                const pct = getPct(item);
                if (percentageFilter === '0') return pct === 0;
                if (percentageFilter === '1-25') return pct > 0 && pct <= 25;
                if (percentageFilter === '26-50') return pct > 25 && pct <= 50;
                if (percentageFilter === '51-75') return pct > 50 && pct <= 75;
                if (percentageFilter === '76-99') return pct > 75 && pct < 100;
                if (percentageFilter === '100') return pct >= 100;
                if (percentageFilter === 'custom') {
                    const min = customMinPct !== '' ? Number(customMinPct) : 0;
                    const max = customMaxPct !== '' ? Number(customMaxPct) : 100;
                    return pct >= min && pct <= max;
                }
                return true;
            });
        }

        // Search filter
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase().trim();
            result = result.filter((item) => {
                const t = item.task || {};
                return (
                    t.task_name?.toLowerCase().includes(q) ||
                    t.category_name?.toLowerCase().includes(q) ||
                    t.subcategory_name?.toLowerCase().includes(q) ||
                    t.task_type?.toLowerCase().includes(q) ||
                    item.assigned_employee_name?.toLowerCase().includes(q) ||
                    item.created_by_name?.toLowerCase().includes(q)
                );
            });
        }

        return result;
    }, [items, searchTerm, fromDate, toDate, percentageFilter, customMinPct, customMaxPct]);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

    const handleExport = (type) => {
        const rows = filteredItems.map(toExportRow);

        if (type === 'pdf') {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
            doc.setFontSize(16);
            doc.setTextColor(30, 41, 59);
            doc.text(REPORT_TITLE, 30, 32);
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 30, 46);
            autoTable(doc, {
                startY: 58,
                columns: EXPORT_COLUMNS.map((c) => ({ header: c.header, dataKey: c.key })),
                body: rows,
                theme: 'grid',
                headStyles: { fillColor: [39, 114, 219], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
                styles: { fontSize: 8, cellPadding: 3.5, textColor: [51, 65, 85], lineColor: [203, 213, 225], lineWidth: 0.5, overflow: 'linebreak' },
                columnStyles: {
                    index: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
                    percentage: { cellWidth: 45, halign: 'center' },
                    status: { cellWidth: 65, halign: 'center' },
                },
                margin: { top: 58, left: 30, right: 30, bottom: 30 },
            });
            doc.save(`${FILE_NAME}.pdf`);
        } else if (type === 'excel') {
            const data = rows.map((r) => {
                const out = {};
                EXPORT_COLUMNS.forEach((c) => { out[c.header] = r[c.key]; });
                return out;
            });
            const worksheet = XLSX.utils.json_to_sheet(data);
            worksheet['!cols'] = EXPORT_COLUMNS.map((c) => ({ wch: c.width }));
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Pending Tasks');
            XLSX.writeFile(workbook, `${FILE_NAME}.xlsx`);
        } else if (type === 'print') {
            const printWindow = window.open('', '_blank');
            if (!printWindow) return;
            const html = `
                <html>
                    <head>
                        <title>${escapeHtml(REPORT_TITLE)}</title>
                        <style>
                            @page { size: landscape; margin: 12mm; }
                            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 15px; font-size: 12px; color: #1e293b; }
                            h2 { margin: 0 0 4px 0; color: #0f172a; font-size: 18px; }
                            .timestamp { color: #64748b; font-size: 11px; margin-bottom: 16px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
                            th { background-color: #2772db; color: #ffffff; font-weight: 600; font-size: 11px; }
                            @media print { body { padding: 0; } }
                        </style>
                    </head>
                    <body>
                        <h2>${escapeHtml(REPORT_TITLE)}</h2>
                        <div class="timestamp">Generated on: ${escapeHtml(new Date().toLocaleString())}</div>
                        <table>
                            <thead><tr>${EXPORT_COLUMNS.map((c) => `<th>${escapeHtml(c.header)}</th>`).join('')}</tr></thead>
                            <tbody>
                                ${rows.map((r) => `<tr>${EXPORT_COLUMNS.map((c) => `<td>${escapeHtml(r[c.key])}</td>`).join('')}</tr>`).join('')}
                            </tbody>
                        </table>
                        <script>
                            window.onload = () => {
                                window.print();
                                window.onafterprint = () => window.close();
                            };
                        </script>
                    </body>
                </html>
            `;
            printWindow.document.write(html);
            printWindow.document.close();
        }
    };

    const exportBtnStyle = {
        borderRadius: '6px', width: '38px', height: '38px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0',
    };

    return (
        <Fragment>
            <style dangerouslySetInnerHTML={{ __html: `
                .nsr-header {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    flex-wrap: wrap !important;
                    gap: 15px !important;
                }
                .nsr-controls {
                    display: flex !important;
                    align-items: center !important;
                    gap: 10px !important;
                    flex-wrap: wrap !important;
                }
                .nsr-filter-group {
                    display: flex !important;
                    align-items: center !important;
                    gap: 6px !important;
                }
                .nsr-filter-label {
                    font-size: 12px !important;
                    font-weight: 600 !important;
                    color: #64748b !important;
                    margin-bottom: 0 !important;
                    white-space: nowrap !important;
                }
                .nsr-search {
                    width: 200px !important;
                }
                .nsr-pct-input {
                    width: 65px !important;
                    height: 38px !important;
                    padding: 0 6px !important;
                    text-align: center !important;
                    font-size: 13px !important;
                    font-weight: 500 !important;
                    color: #1e293b !important;
                    border-radius: 6px !important;
                    -moz-appearance: textfield !important;
                }
                .nsr-pct-input::-webkit-outer-spin-button,
                .nsr-pct-input::-webkit-inner-spin-button {
                    -webkit-appearance: none !important;
                    margin: 0 !important;
                }
                .nsr-table {
                    margin-bottom: 0 !important;
                }
                .nsr-table th {
                    white-space: nowrap !important;
                    vertical-align: middle !important;
                    font-size: 13px !important;
                }
                .nsr-table td {
                    vertical-align: middle !important;
                }
                @media (max-width: 1200px) {
                    .nsr-search {
                        width: 160px !important;
                    }
                }
                @media (max-width: 991px) {
                    .nsr-header {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 12px !important;
                    }
                    .nsr-controls {
                        width: 100% !important;
                    }
                }
                @media (max-width: 767px) {
                    .nsr-controls {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 10px !important;
                    }
                    .nsr-filter-group {
                        width: 100% !important;
                        flex-wrap: wrap !important;
                    }
                    .nsr-search {
                        width: 100% !important;
                    }
                    .nsr-table {
                        min-width: 850px !important;
                    }
                }
            ` }} />

            <div className="container-fluid">
                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center nsr-header">
                                <div className="d-flex flex-column gap-1">
                                    <Card.Title className="mb-0">Pending Tasks</Card.Title>
                                    <small className="text-muted">
                                        Tasks approved in voting pending completion
                                        {!loading && (
                                            <> — <strong>{summary.total_tasks || 0}</strong> total
                                            {' '}(<strong>{summary.start_date_passed || 0}</strong> past start date)</>
                                        )}
                                    </small>
                                </div>

                                <div className="nsr-controls">
                                    {/* Date Range Filter (From & To) */}
                                    <div className="nsr-filter-group">
                                        <span className="nsr-filter-label">From:</span>
                                        <Form.Control
                                            type="date"
                                            size="sm"
                                            value={fromDate}
                                            onChange={(e) => setFromDate(e.target.value)}
                                            title="From Date"
                                            style={{ height: '38px', borderRadius: '6px', fontSize: '12px', width: '135px' }}
                                        />
                                        <span className="nsr-filter-label">To:</span>
                                        <Form.Control
                                            type="date"
                                            size="sm"
                                            value={toDate}
                                            onChange={(e) => setToDate(e.target.value)}
                                            title="To Date"
                                            style={{ height: '38px', borderRadius: '6px', fontSize: '12px', width: '135px' }}
                                        />
                                    </div>

                                    {/* Percentage Filter */}
                                    <div className="nsr-filter-group">
                                        <span className="nsr-filter-label">Percentage:</span>
                                        <Form.Select
                                            size="sm"
                                            value={percentageFilter}
                                            onChange={(e) => setPercentageFilter(e.target.value)}
                                            style={{ height: '38px', borderRadius: '6px', fontSize: '12.5px', width: '135px' }}
                                        >
                                            <option value="all">All %</option>
                                            <option value="0">0% (Not Started)</option>
                                            <option value="1-25">1% - 25%</option>
                                            <option value="26-50">26% - 50%</option>
                                            <option value="51-75">51% - 75%</option>
                                            <option value="76-99">76% - 99%</option>
                                            <option value="100">100% (Completed)</option>
                                            <option value="custom">Custom Range</option>
                                        </Form.Select>
                                        {percentageFilter === 'custom' && (
                                            <div className="d-flex align-items-center gap-1">
                                                <Form.Control
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    placeholder="0"
                                                    value={customMinPct}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === '' || (Number(val) >= 0 && Number(val) <= 100)) {
                                                            setCustomMinPct(val);
                                                        }
                                                    }}
                                                    title="Min %"
                                                    className="nsr-pct-input"
                                                    style={{ height: '38px', width: '65px', padding: '0 6px', borderRadius: '6px', fontSize: '13px', fontWeight: '500', textAlign: 'center', color: '#1e293b' }}
                                                />
                                                <span className="text-muted" style={{ fontSize: '12px', fontWeight: '500' }}>% to</span>
                                                <Form.Control
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    placeholder="100"
                                                    value={customMaxPct}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === '' || (Number(val) >= 0 && Number(val) <= 100)) {
                                                            setCustomMaxPct(val);
                                                        }
                                                    }}
                                                    title="Max %"
                                                    className="nsr-pct-input"
                                                    style={{ height: '38px', width: '65px', padding: '0 6px', borderRadius: '6px', fontSize: '13px', fontWeight: '500', textAlign: 'center', color: '#1e293b' }}
                                                />
                                                <span className="text-muted" style={{ fontSize: '12px', fontWeight: '500' }}>%</span>
                                            </div>
                                        )}
                                        {(percentageFilter !== 'all' || customMinPct || customMaxPct) && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-link text-danger p-0 text-decoration-none"
                                                onClick={handleClearPercentageFilter}
                                                title="Clear percentage filter"
                                                style={{ fontSize: '16px', lineHeight: 1 }}
                                            >
                                                <i className="fa fa-times-circle"></i>
                                            </button>
                                        )}
                                    </div>

                                    {/* Search */}
                                    <div className="nsr-search" style={{ position: 'relative' }}>
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search tasks..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>

                                    {/* Export Buttons */}
                                    <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                        <button className="btn btn-sm btn-light border" style={exportBtnStyle} onClick={() => handleExport('pdf')} title="Export PDF">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                        </button>
                                        <button className="btn btn-sm btn-light border" style={exportBtnStyle} onClick={() => handleExport('excel')} title="Export Excel">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                        </button>
                                        <button className="btn btn-sm btn-light border" style={exportBtnStyle} onClick={() => handleExport('print')} title="Print">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                        </button>
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
                                        <table className="table table-responsive-md nsr-table">
                                            <thead>
                                                <tr>
                                                    <th><strong>SL.NO</strong></th>
                                                    <th><strong>TASK NAME</strong></th>
                                                    <th><strong>CATEGORY</strong></th>
                                                    <th><strong>TYPE</strong></th>
                                                    <th><strong>ASSIGNED TO</strong></th>
                                                    <th><strong>ASSIGNED BY</strong></th>
                                                    <th><strong>APPROVED ON</strong></th>
                                                    <th><strong>START DATE</strong></th>
                                                    <th><strong>DUE DATE</strong></th>
                                                    <th><strong>PROGRESS</strong></th>
                                                    <th className="text-center"><strong>STATUS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredItems.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="11" className="text-center py-4 text-muted">
                                                            No pending tasks match the selected filters.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentItems.map((item, idx) => {
                                                        const task = item.task || {};
                                                        const pct = getPct(item);
                                                        return (
                                                            <tr key={item.vote_request_id || idx}>
                                                                <td>{indexOfFirstItem + idx + 1}</td>
                                                                <td><strong>{task.task_name}</strong></td>
                                                                <td>
                                                                    <div className="d-flex flex-column gap-1">
                                                                        <small>{task.category_name || '—'}</small>
                                                                        {task.subcategory_name && <small className="text-muted">› {task.subcategory_name}</small>}
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <span
                                                                        className={`badge badge-${(task.task_type || 'individual').toLowerCase() === 'group' ? 'info' : 'primary'} light`}
                                                                        style={{ textTransform: 'capitalize' }}
                                                                    >
                                                                        {task.task_type || 'individual'}
                                                                    </span>
                                                                </td>
                                                                <td>{item.assigned_employee_name || '—'}</td>
                                                                <td>{item.created_by_name || '—'}</td>
                                                                <td>{formatDateTime(item.approved_on)}</td>
                                                                <td>{formatDate(task.start_date)}</td>
                                                                <td>{formatDate(task.due_date)}</td>
                                                                <td>
                                                                    <div style={{ minWidth: '95px' }}>
                                                                        <div className="d-flex justify-content-between mb-1" style={{ fontSize: '11px' }}>
                                                                            <span className="fw-semibold text-dark">{pct}%</span>
                                                                        </div>
                                                                        <div style={{ height: '5px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                                                            <div
                                                                                style={{
                                                                                    width: `${Math.min(100, Math.max(0, pct))}%`,
                                                                                    height: '100%',
                                                                                    backgroundColor: pct >= 100 ? '#16a34a' : pct > 50 ? '#0284c7' : pct > 0 ? '#3b82f6' : '#94a3b8',
                                                                                    borderRadius: '3px',
                                                                                    transition: 'width 0.3s ease',
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="text-center">
                                                                    <span className={`badge badge-${statusBadgeClass(item)} light`}>
                                                                        {statusText(item)}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {totalPages > 1 && (
                                    <div className="d-flex justify-content-between align-items-center mt-3 p-3 border-top">
                                        <span className="text-muted" style={{ fontSize: '13px' }}>
                                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredItems.length)} of {filteredItems.length} entries
                                        </span>
                                        <div className="d-flex gap-1">
                                            <button className="btn btn-sm btn-light border" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}>
                                                Previous
                                            </button>
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                                <button
                                                    key={page}
                                                    className={`btn btn-sm ${currentPage === page ? 'btn-primary' : 'btn-light border'}`}
                                                    onClick={() => setCurrentPage(page)}
                                                >
                                                    {page}
                                                </button>
                                            ))}
                                            <button className="btn btn-sm btn-light border" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}>
                                                Next
                                            </button>
                                        </div>
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

export default NotStartedTasksReportPage;
