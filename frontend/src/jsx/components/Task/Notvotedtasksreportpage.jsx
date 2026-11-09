import React, { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { getNotVotedTasksReport } from '../../../services/TaskService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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

const statusText = (item) => (item.cutoff_passed ? 'Cutoff Passed' : 'Voting Open');

const REPORT_TITLE = 'Pending Votes';
const FILE_NAME = 'Pending_Votes';

const EXPORT_COLUMNS = [
    { header: '#', key: 'index', width: 6 },
    { header: 'Task Name', key: 'task_name', width: 28 },
    { header: 'Category', key: 'category', width: 26 },
    { header: 'Type', key: 'task_type', width: 12 },
    { header: 'Assigned To', key: 'assigned_to', width: 22 },
    { header: 'Approval Type', key: 'approval_type', width: 14 },
    { header: 'Cutoff Date', key: 'cutoff', width: 20 },
    { header: 'Yes / No / Pending', key: 'votes', width: 18 },
    { header: 'Not Voted By', key: 'not_voted_by', width: 30 },
    { header: 'Status', key: 'status', width: 16 },
];

const toExportRow = (item, i) => ({
    index: i + 1,
    task_name: item.task?.task_name || '—',
    category: categoryText(item.task || {}),
    task_type: item.task?.task_type || 'individual',
    assigned_to: item.assigned_employee_name || '—',
    approval_type: (item.approval_type || '—').toUpperCase(),
    cutoff: formatDateTime(item.cutoff_date),
    votes: `${item.yes_count} / ${item.no_count} / ${item.pending_count}`,
    not_voted_by: (item.pending_voters || []).join(', ') || '—',
    status: statusText(item),
});

const NotVotedByCell = ({ names }) => {
    const list = names || [];
    if (list.length === 0) return <span className="text-muted">—</span>;
    const shown = list.slice(0, 3);
    const extra = list.length - shown.length;
    return (
        <div className="d-flex flex-column" title={list.join(', ')}>
            {shown.map((n, i) => (
                <small key={i} className="fw-semibold text-dark">{n}</small>
            ))}
            {extra > 0 && <small className="text-muted">+{extra} more</small>}
        </div>
    );
};

const NotVotedTasksReportPage = () => {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [summary, setSummary] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const fetchReport = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getNotVotedTasksReport();
            setItems(data?.items || []);
            setSummary(data?.summary || {});
        } catch (err) {
            console.error('Failed to load not voted tasks report:', err);
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
    useEffect(() => { setCurrentPage(1); }, [searchTerm]);

    const filteredItems = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        if (!q) return items;
        return items.filter((item) => {
            const t = item.task || {};
            return (
                t.task_name?.toLowerCase().includes(q) ||
                t.category_name?.toLowerCase().includes(q) ||
                t.subcategory_name?.toLowerCase().includes(q) ||
                t.task_type?.toLowerCase().includes(q) ||
                item.assigned_employee_name?.toLowerCase().includes(q) ||
                item.created_by_name?.toLowerCase().includes(q) ||
                (item.pending_voters || []).some((n) => n?.toLowerCase().includes(q))
            );
        });
    }, [items, searchTerm]);

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
                columnStyles: { index: { cellWidth: 28, halign: 'center', fontStyle: 'bold' } },
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
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Not Voted');
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
                .nvr-header { display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: space-between !important; flex-wrap: wrap !important; gap: 15px !important; }
                .nvr-controls { display: flex !important; align-items: center !important; gap: 8px !important; flex-wrap: wrap !important; }
                .nvr-search { width: 300px !important; }
                .nvr-table { margin-bottom: 0 !important; }
                .nvr-table th { white-space: nowrap !important; vertical-align: middle !important; font-size: 13px !important; }
                .nvr-table td { vertical-align: middle !important; }
                @media (max-width: 767px) {
                    .nvr-header { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
                    .nvr-controls { width: 100% !important; }
                    .nvr-search { width: auto !important; flex: 1 1 auto !important; min-width: 0 !important; }
                    .nvr-table { min-width: 800px !important; }
                }
            ` }} />

            <div className="container-fluid">
                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center nvr-header">
                                <div className="d-flex flex-column gap-1">
                                    <Card.Title className="mb-0">Pending Votes</Card.Title>
                                    <small className="text-muted">
                                        Tasks sent for voting where one or more voters have not voted yet
                                        {!loading && (
                                            <> — <strong>{summary.total_tasks || 0}</strong> total
                                            {' '}(<strong>{summary.voting_open || 0}</strong> open, <strong>{summary.cutoff_passed || 0}</strong> cutoff passed)</>
                                        )}
                                    </small>
                                </div>

                                <div className="nvr-controls">
                                    <div className="nvr-search" style={{ position: 'relative' }}>
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search tasks..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>
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
                                        <table className="table table-responsive-md nvr-table">
                                            <thead>
                                                <tr>
                                                    <th><strong>SL.NO</strong></th>
                                                    <th><strong>TASK NAME</strong></th>
                                                    <th><strong>CATEGORY</strong></th>
                                                    <th><strong>TYPE</strong></th>
                                                    <th><strong>ASSIGNED TO</strong></th>
                                                    <th><strong>APPROVAL</strong></th>
                                                    <th><strong>CUTOFF DATE</strong></th>
                                                    <th className="text-center"><strong>YES / NO / PENDING</strong></th>
                                                    <th><strong>NOT VOTED BY</strong></th>
                                                    <th className="text-center"><strong>STATUS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredItems.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="10" className="text-center py-4 text-muted">
                                                            No pending votes found.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentItems.map((item, idx) => {
                                                        const task = item.task || {};
                                                        return (
                                                            <tr key={item.vote_request_id}>
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
                                                                <td>
                                                                    <span className="badge badge-primary light" style={{ textTransform: 'uppercase' }}>
                                                                        {item.approval_type || '—'}
                                                                    </span>
                                                                </td>
                                                                <td>{formatDateTime(item.cutoff_date)}</td>
                                                                <td className="text-center">
                                                                    <span className="text-success fw-bold">{item.yes_count}</span>
                                                                    <span className="text-muted"> / </span>
                                                                    <span className="text-danger fw-bold">{item.no_count}</span>
                                                                    <span className="text-muted"> / </span>
                                                                    <span className="fw-bold" style={{ color: '#b58105' }}>{item.pending_count}</span>
                                                                </td>
                                                                <td><NotVotedByCell names={item.pending_voters} /></td>
                                                                <td className="text-center">
                                                                    <span className={`badge badge-${item.cutoff_passed ? 'danger' : 'warning'} light`}>
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

export default NotVotedTasksReportPage;
