import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Table, Modal, Button, Spinner, Card, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import PageTitle from '../../layouts/PageTitle';
import CRMNewService from '../../../services/CRMNewService';
import { fetchCompanyFinancialYears } from '../../../services/CompanyService';
import { formatDate } from '../../../utils/dateUtils';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import { usePageTitle } from '../../../context/TitleContext';

// ─── Formatting Helpers ──────────────────────────────────────────────────────
const formatSeconds = (s) => {
    if (!s && s !== 0) return '00:00';
    const num = parseInt(s, 10) || 0;
    const m = Math.floor(num / 60);
    const sec = num % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const formatDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const STATUS_META = {
    'Not Contacted': { color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' },
    'Contacted': { color: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)' },
    'Pre Qualified': { color: '#0d9488', bg: 'rgba(13, 148, 136, 0.12)' },
    'Not Qualified': { color: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)' },
    'Lost Lead': { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
    'Junk Lead': { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)' },
    'Escalated': { color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)' },
    'Converted': { color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)' },
    'Converted to Opportunity': { color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)' },
};

const OUTCOME_META = {
    'Contacted': { label: 'Contacted', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)', icon: 'fa-phone' },
    'Interested': { label: 'Interested', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', icon: 'fa-star' },
    'Call Back Later': { label: 'Call Back Later', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', icon: 'fa-clock' },
    'Converted': { label: 'Converted to Opportunity', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)', icon: 'fa-trophy' },
    'Converted to Opportunity': { label: 'Converted to Opportunity', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)', icon: 'fa-trophy' },
    'Busy': { label: 'Busy', color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)', icon: 'fa-hourglass-half' },
    'Not Answered': { label: 'Not Answered', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', icon: 'fa-phone-slash' },
    'Not Interested': { label: 'Not Interested', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', icon: 'fa-thumbs-down' },
    'Wrong Number': { label: 'Wrong Number', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)', icon: 'fa-times-circle' },
};

const getOutcomeBadgeClass = (outcome) => {
    switch (outcome) {
        case 'Converted':
        case 'Converted to Opportunity':
        case 'Pre Qualified':
        case 'Interested':
            return 'badge badge-success light';
        case 'Contacted':
        case 'Follow-up':
            return 'badge badge-info light';
        case 'Call Back Later':
        case 'Busy':
        case 'Follow-up Scheduled':
            return 'badge badge-warning light';
        case 'Not Interested':
        case 'Wrong Number':
        case 'Lost Lead':
            return 'badge badge-danger light';
        default:
            return 'badge badge-dark light';
    }
};

const getStatusBadgeClass = (status) => {
    switch (status) {
        case 'Converted':
        case 'Converted to Opportunity':
        case 'Pre Qualified':
        case 'Qualified':
            return 'badge badge-success light';
        case 'Contacted':
        case 'In Progress':
        case 'Follow Up':
            return 'badge badge-info light';
        case 'Call Back Later':
        case 'Pending':
        case 'Escalated':
            return 'badge badge-warning light';
        case 'Not Interested':
        case 'Lost Lead':
        case 'Disqualified':
        case 'Not Qualified':
        case 'Junk Lead':
            return 'badge badge-danger light';
        default:
            return 'badge badge-dark light';
    }
};

const CrmLeadsReport = () => {
    usePageTitle('Leads Report');
    const navigate = useNavigate();

    // Data states
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState({
        is_admin: false,
        summary: {
            total_leads: 0,
            called_leads: 0,
            uncalled_leads: 0,
            converted_leads: 0,
        },
        callers_list: [],
        status_options: [],
        leads: [],
    });

    // Filters
    const [statusFilter, setStatusFilter] = useState('');
    const [callerFilter, setCallerFilter] = useState('');
    const [search, setSearch] = useState('');
    const [fromDate, setFromDate] = useState(
        localStorage.getItem('active_fy_start') || ''
    );
    const [toDate, setToDate] = useState(
        localStorage.getItem('active_fy_end') || ''
    );

    // Pagination (10 rows per page standard)
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;

    // Full Lead History Modal state
    const [historyModal, setHistoryModal] = useState({
        isOpen: false,
        lead: null,
        history: [],
        totalCalls: 0,
    });

    // Load active financial year from company settings
    useEffect(() => {
        const fetchFy = async () => {
            try {
                const companySettings = JSON.parse(localStorage.getItem('companySettings') || '{}');
                const companyId = companySettings.id || localStorage.getItem('companyId') || 1;
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

    // Fetch Lead Report Data from API
    const fetchLeadsReport = useCallback(async () => {
        try {
            setLoading(true);
            const params = {};
            if (statusFilter) {
                params.lead_status = statusFilter;
            }
            if (callerFilter && callerFilter !== 'all') {
                params.caller = callerFilter;
            }
            if (search.trim()) {
                params.search = search.trim();
            }
            if (fromDate) {
                params.start_date = fromDate;
            }
            if (toDate) {
                params.end_date = toDate;
            }

            const res = await CRMNewService.getLeadsReport(params);
            if (res.data) {
                setReportData(res.data);
                setCurrentPage(1);
            }
        } catch (err) {
            console.error('Error fetching CRM Leads Report:', err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, callerFilter, search, fromDate, toDate]);

    useEffect(() => {
        fetchLeadsReport();
    }, [fetchLeadsReport]);

    const { summary = {}, callers_list = [], status_options = [], leads = [] } = reportData;

    // Filtered leads
    const filteredLeads = useMemo(() => {
        return leads || [];
    }, [leads]);

    const totalPages = Math.max(1, Math.ceil(filteredLeads.length / rowsPerPage));
    const paginatedLeads = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredLeads.slice(start, start + rowsPerPage);
    }, [filteredLeads, currentPage, rowsPerPage]);

    // Open Full Lead History Modal
    const handleOpenLeadHistory = (leadItem) => {
        setHistoryModal({
            isOpen: true,
            lead: leadItem,
            history: leadItem.lead_full_history || [],
            totalCalls: leadItem.total_calls || (leadItem.lead_full_history ? leadItem.lead_full_history.length : 0),
        });
    };

    const handleCloseLeadHistory = () => {
        setHistoryModal({
            isOpen: false,
            lead: null,
            history: [],
            totalCalls: 0,
        });
    };

    // Export Handler (PDF, Excel, Print)
    const handleExport = (format) => {
        const columns = [
            { header: 'SL.NO', dataKey: 'index' },
            { header: 'LEAD NAME', dataKey: 'lead_name' },
            { header: 'CONTACT', dataKey: 'contact' },
            { header: 'CATEGORY', dataKey: 'category_name' },
            { header: 'CURRENT STATUS', dataKey: 'lead_status' },
            { header: 'CALLS', dataKey: 'total_calls' },
            { header: 'LATEST OUTCOME', dataKey: 'latest_outcome' },
            { header: 'LAST CALLED', dataKey: 'last_called_formatted' }
        ];

        const exportData = filteredLeads.map((l, idx) => ({
            index: idx + 1,
            lead_name: l.company || l.name || `Lead #${l.id}`,
            contact: l.phone || l.mobile || '—',
            category_name: l.category_name || l.source_name || '—',
            lead_status: l.lead_status || 'Not Contacted',
            called_by_display: l.called_by_display || 'Not Called Yet',
            total_calls: l.total_calls || 0,
            latest_outcome: l.latest_call ? l.latest_call.call_outcome : '—',
            last_called_formatted: l.last_called_at ? formatDate(l.last_called_at) : (l.created_at ? formatDate(l.created_at) : '—')
        }));

        if (format === 'pdf') {
            exportToPDF(exportData, columns, 'crm_leads_report.pdf', 'CRM Leads Report');
        } else if (format === 'excel') {
            exportToExcel(exportData, columns, 'crm_leads_report.xlsx');
        } else if (format === 'print') {
            printData(exportData, columns, 'CRM Leads Report');
        }
    };

    // Pagination display array
    const paginationItems = useMemo(() => {
        const items = [];
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) items.push(i);
        } else {
            items.push(1);
            if (currentPage > 3) items.push('...');
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) {
                if (!items.includes(i)) items.push(i);
            }
            if (currentPage < totalPages - 2) items.push('...');
            if (!items.includes(totalPages)) items.push(totalPages);
        }
        return items;
    }, [totalPages, currentPage]);

    return (
        <div className="container-fluid" style={{ minHeight: '100vh', background: '#f8fafc', padding: '1.25rem 1.5rem' }}>
            <PageTitle activeMenu="Leads Report" motherMenu="CRM" />

            <style>{`
                .crm-report-card {
                    background: #ffffff;
                    border: 1px solid #eaebf0;
                    border-radius: 12px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                }
                .crm-table th {
                    background-color: #ffffff !important;
                    color: #475569 !important;
                    font-size: 11px !important;
                    font-weight: 700 !important;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    border-bottom: 1px solid #eaebf0 !important;
                    padding: 12px 14px !important;
                    white-space: nowrap;
                }
                .crm-table td {
                    padding: 14px 14px !important;
                    font-size: 13px;
                    border-bottom: 1px solid #f1f5f9;
                    vertical-align: middle;
                }
                .crm-table tbody tr:hover {
                    background-color: #f8f9ff !important;
                }
                .timeline-container {
                    position: relative;
                    padding-left: 20px;
                }
                .timeline-container::before {
                    content: '';
                    position: absolute;
                    left: 6px;
                    top: 10px;
                    bottom: 10px;
                    width: 2px;
                    background: #e2e8f0;
                }
                .timeline-item {
                    position: relative;
                    margin-bottom: 20px;
                }
                .timeline-dot {
                    position: absolute;
                    left: -20px;
                    top: 16px;
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    background: #ffffff;
                    border: 3px solid #16a34a;
                    box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.2);
                }
            `}</style>

            {/* Quick Report Switcher Header */}
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                <div className="d-inline-flex p-1 bg-white rounded-pill shadow-sm" style={{ border: '1px solid #eaebf0' }}>
                    <button
                        type="button"
                        className="btn btn-sm rounded-pill px-3 py-1 fw-bold btn-link text-muted text-decoration-none"
                        onClick={() => navigate('/crm_new/reports')}
                    >
                        <i className="fa fa-headphones me-1"></i> Call Logs & History
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm rounded-pill px-3 py-1 fw-bold btn-primary text-white shadow-sm"
                        onClick={() => {}}
                    >
                        <i className="fa fa-users me-1"></i> All Leads Report
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm rounded-pill px-3 py-1 fw-bold btn-link text-muted text-decoration-none"
                        onClick={() => navigate('/crm_new/converted-leads-report')}
                    >
                        <i className="fa fa-trophy me-1"></i> Converted Leads Report
                    </button>
                </div>
            </div>

            {/* Main Card */}
            <Card className="crm-report-card shadow-sm">
                <Card.Header className="bg-white border-bottom py-3 px-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
                    {/* Left: Title */}
                    <div className="d-flex align-items-center gap-2">
                        <h4 className="mb-0 fw-bold text-dark" style={{ fontSize: '17px' }}>
                            Leads Report
                        </h4>
                        <span className="badge ms-1" style={{ background: '#f1f5f9', color: '#475569', fontSize: '12px', fontWeight: 600, borderRadius: '6px' }}>
                            {filteredLeads.length} {filteredLeads.length === 1 ? 'Lead' : 'Leads'}
                        </span>
                    </div>

                    {/* Right: Filters + Search Bar + Export Buttons on the Same Line */}
                    <div className="d-flex align-items-center gap-2 flex-wrap flex-grow-1 justify-content-end">
                        {/* From Date */}
                        <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                            <span className="text-muted" style={{ fontSize: '12px', fontWeight: '500' }}>From:</span>
                            <Form.Control
                                type="date"
                                size="sm"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                style={{
                                    height: '38px',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    borderColor: '#eaebf0',
                                    color: '#1e293b',
                                    width: '145px'
                                }}
                            />
                        </div>

                        {/* To Date */}
                        <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                            <span className="text-muted" style={{ fontSize: '12px', fontWeight: '500' }}>To:</span>
                            <Form.Control
                                type="date"
                                size="sm"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                style={{
                                    height: '38px',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    borderColor: '#eaebf0',
                                    color: '#1e293b',
                                    width: '145px'
                                }}
                            />
                        </div>

                        {/* Current Lead Status Filter */}
                        <div className="flex-shrink-0" style={{ width: '160px' }}>
                            <select
                                className="form-select form-select-sm"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                style={{ height: '38px', borderRadius: '6px', borderColor: '#eaebf0', fontSize: '12.5px', background: '#fcfcfd' }}
                            >
                                <option value="">All Lead Statuses</option>
                                {status_options.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        {/* Telecaller Filter */}
                        {callers_list.length > 0 && (
                            <div className="flex-shrink-0" style={{ width: '160px' }}>
                                <select
                                    className="form-select form-select-sm"
                                    value={callerFilter}
                                    onChange={(e) => setCallerFilter(e.target.value)}
                                    style={{ height: '38px', borderRadius: '6px', borderColor: '#eaebf0', fontSize: '12.5px', background: '#fcfcfd' }}
                                >
                                    <option value="all">All Telecallers ({callers_list.length})</option>
                                    {callers_list.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Search Bar */}
                        <div style={{ position: 'relative', width: '220px' }}>
                            <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                            <Form.Control
                                type="text"
                                placeholder="Search leads..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setCurrentPage(1);
                                }}
                                style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px', borderColor: '#eaebf0' }}
                            />
                        </div>

                        {/* Export Buttons */}
                        <div className="d-flex align-items-center gap-2 flex-shrink-0">
                            <button
                                type="button"
                                className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center"
                                onClick={() => handleExport('pdf')}
                                title="Export PDF"
                                style={{ width: '38px', height: '38px', borderRadius: '6px', background: '#ffffff', borderColor: '#eaebf0' }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center"
                                onClick={() => handleExport('excel')}
                                title="Export Excel"
                                style={{ width: '38px', height: '38px', borderRadius: '6px', background: '#ffffff', borderColor: '#eaebf0' }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center"
                                onClick={() => handleExport('print')}
                                title="Print"
                                style={{ width: '38px', height: '38px', borderRadius: '6px', background: '#ffffff', borderColor: '#eaebf0' }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            </button>
                        </div>
                    </div>
                </Card.Header>

                <Card.Body className="p-0">
                    <div className="table-responsive">
                        <table className="table table-responsive-md">
                            <thead>
                                <tr>
                                    <th style={{ width: '60px' }}>SL NO</th>
                                    <th>LEAD NAME</th>
                                    <th>CONTACT</th>
                                    <th>CATEGORY / SOURCE</th>
                                    <th>CURRENT STATUS</th>
                                    <th className="text-center">CALLS</th>
                                    <th>LATEST OUTCOME</th>
                                    <th>LAST CALLED</th>
                                    <th className="text-end">ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="text-center py-4">
                                            Loading leads report...
                                        </td>
                                    </tr>
                                ) : filteredLeads.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="text-center py-4 text-muted">
                                            No leads found for the selected criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedLeads.map((lead, idx) => {
                                        const globalIdx = (currentPage - 1) * rowsPerPage + idx + 1;
                                        const latestOutcome = lead.latest_call ? lead.latest_call.call_outcome : null;
                                        const outcomeMeta = latestOutcome ? (OUTCOME_META[latestOutcome] || { label: latestOutcome }) : null;
                                        const leadDisplay = lead.company || lead.name || `Lead #${lead.id}`;

                                        return (
                                            <tr key={lead.id || idx}>
                                                {/* 1. SL NO */}
                                                <td>{globalIdx}</td>

                                                {/* 2. LEAD NAME */}
                                                <td>
                                                    <strong
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => handleOpenLeadHistory(lead)}
                                                        title="Click to view complete call history"
                                                    >
                                                        {leadDisplay}
                                                    </strong>
                                                    {lead.city && (
                                                        <div className="text-muted" style={{ fontSize: '11px' }}>
                                                            {lead.city}{lead.state ? `, ${lead.state}` : ''}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* 3. CONTACT */}
                                                <td>
                                                    {lead.phone || lead.mobile ? (
                                                        <a href={`tel:${lead.phone || lead.mobile}`} className="text-decoration-none text-dark">
                                                            {lead.phone || lead.mobile}
                                                        </a>
                                                    ) : '—'}
                                                    {lead.email && (
                                                        <div className="text-muted" style={{ fontSize: '11px' }}>
                                                            {lead.email}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* 4. CATEGORY / SOURCE */}
                                                <td>
                                                    <div>
                                                        {lead.category_name && <div>{lead.category_name}</div>}
                                                        {lead.source_name && (
                                                            <div className="text-muted" style={{ fontSize: '11px' }}>
                                                                Source: {lead.source_name}
                                                            </div>
                                                        )}
                                                        {!lead.category_name && !lead.source_name && '—'}
                                                    </div>
                                                </td>

                                                {/* 5. CURRENT STATUS OF THAT LEAD (Matching STATUS light badge) */}
                                                <td>
                                                    <span className={getStatusBadgeClass(lead.lead_status)}>
                                                        {lead.lead_status || 'Not Contacted'}
                                                    </span>
                                                </td>

                                                {/* 7. CALLS */}
                                                <td className="text-center">
                                                    <span className="badge badge-info light">
                                                        {lead.total_calls || 0}
                                                    </span>
                                                </td>

                                                {/* 8. LATEST CALL OUTCOME (Matching STATUS light badge) */}
                                                <td>
                                                    {latestOutcome ? (
                                                        <span className={getOutcomeBadgeClass(latestOutcome)}>
                                                            {outcomeMeta?.label || latestOutcome}
                                                        </span>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>

                                                {/* 9. LAST CALLED */}
                                                <td>
                                                    {lead.last_called_at ? formatDate(lead.last_called_at) : (lead.created_at ? formatDate(lead.created_at) : '—')}
                                                </td>

                                                {/* 10. ACTION */}
                                                <td className="text-end">
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-info"
                                                        onClick={() => handleOpenLeadHistory(lead)}
                                                        style={{
                                                            width: '32px',
                                                            height: '32px',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            padding: '0',
                                                            borderRadius: '6px'
                                                        }}
                                                        title="View complete call history for this lead"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="10"></circle>
                                                            <polyline points="12 6 12 12 16 14"></polyline>
                                                        </svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination (Matching RenewalHistoryReport) */}
                    {!loading && filteredLeads.length > 0 && (
                        <div className="d-flex justify-content-between align-items-center mt-3 p-3">
                            <div className="dataTables_info">
                                Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredLeads.length)} of {filteredLeads.length} entries
                            </div>

                            {totalPages > 1 && (
                                <div className="dataTables_paginate paging_simple_numbers">
                                    <nav>
                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                            <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                <button
                                                    type="button"
                                                    className="page-link"
                                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                    disabled={currentPage === 1}
                                                    style={{ border: 'none', background: 'none' }}
                                                >
                                                    <i className="la la-angle-left" />
                                                </button>
                                            </li>

                                            {paginationItems.map((item, idx) => (
                                                <li
                                                    key={idx}
                                                    className={`page-item ${item === currentPage ? 'active' : ''} ${item === '...' ? 'disabled' : ''}`}
                                                >
                                                    {item === '...' ? (
                                                        <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="page-link"
                                                            onClick={() => setCurrentPage(item)}
                                                            style={{ border: 'none' }}
                                                        >
                                                            {item}
                                                        </button>
                                                    )}
                                                </li>
                                            ))}

                                            <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                <button
                                                    type="button"
                                                    className="page-link"
                                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                    disabled={currentPage === totalPages}
                                                    style={{ border: 'none', background: 'none' }}
                                                >
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

            {/* ── Full Lead Call History Modal ── */}
            <Modal
                show={historyModal.isOpen}
                onHide={handleCloseLeadHistory}
                size="lg"
                centered
                backdrop="static"
            >
                <Modal.Header closeButton style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <div>
                        <Modal.Title style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                            <i className="fa fa-history text-success me-2"></i>
                            Complete Lead Call History
                        </Modal.Title>
                        <small className="text-muted" style={{ fontSize: '12px' }}>
                            Detailed timeline of all calls attended across all telecallers for this specific lead
                        </small>
                    </div>
                </Modal.Header>
                <Modal.Body className="p-4">
                    {/* Lead Quick Header Card */}
                    {historyModal.lead && (
                        <div className="p-3 mb-4 rounded" style={{ background: '#f1f5f9', border: '1px solid #cbd5e1' }}>
                            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                                <div>
                                    <h4 className="mb-0 fw-bold" style={{ fontSize: '17px', color: '#16a34a' }}>
                                        {historyModal.lead.company || historyModal.lead.name || 'Client Lead'}
                                    </h4>
                                    <div className="d-flex flex-wrap align-items-center gap-3 mt-1 text-muted" style={{ fontSize: '12px' }}>
                                        {historyModal.lead.name && (
                                            <span><i className="fa fa-user me-1"></i>{historyModal.lead.name}</span>
                                        )}
                                        {historyModal.lead.phone && (
                                            <span><i className="fa fa-phone me-1"></i>{historyModal.lead.phone}</span>
                                        )}
                                        {historyModal.lead.city && (
                                            <span><i className="fa fa-map-marker me-1"></i>{historyModal.lead.city}</span>
                                        )}
                                        {historyModal.lead.lead_status && (
                                            <span className="badge" style={{ background: '#e2e8f0', color: '#334155' }}>
                                                Status: {historyModal.lead.lead_status}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-end">
                                    <span className="badge" style={{ background: '#eef2ff', color: '#6366f1', fontSize: '12px', padding: '6px 12px', borderRadius: '8px', fontWeight: 600 }}>
                                        {historyModal.totalCalls} {historyModal.totalCalls === 1 ? 'Total Call' : 'Total Calls'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Timeline of All Calls */}
                    <h5 className="fw-bold mb-3" style={{ fontSize: '14px', color: '#334155' }}>
                        Interaction Timeline ({historyModal.history.length} Logs)
                    </h5>

                    {historyModal.history.length === 0 ? (
                        <div className="text-center py-4 text-muted">
                            <i className="fa fa-phone-square fa-2x mb-2 text-secondary opacity-50"></i>
                            <p className="mb-0">No past calls recorded for this lead.</p>
                        </div>
                    ) : (
                        <div className="timeline-container ps-2">
                            {historyModal.history.map((h, i) => {
                                const hMeta = OUTCOME_META[h.call_outcome] || { label: h.call_outcome, color: '#64748b', bg: '#f1f5f9', icon: 'fa-phone' };
                                return (
                                    <div key={h.id || i} className="timeline-item">
                                        <div className="timeline-dot" style={{ borderColor: hMeta.color }}></div>
                                        <div className="p-3 rounded" style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                                            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                                                <div className="d-flex align-items-center gap-2">
                                                    <span
                                                        className="badge d-inline-flex align-items-center gap-1"
                                                        style={{
                                                            backgroundColor: hMeta.bg,
                                                            color: hMeta.color,
                                                            fontWeight: 700,
                                                            fontSize: '12px',
                                                            padding: '4px 8px',
                                                            borderRadius: '6px'
                                                        }}
                                                    >
                                                        <i className={`fa ${hMeta.icon}`}></i>
                                                        {hMeta.label || h.call_outcome}
                                                    </span>
                                                    <span className="text-muted" style={{ fontSize: '12px' }}>
                                                        <i className="fa fa-clock-o me-1"></i>Duration: <strong>{h.duration_display || formatSeconds(h.duration_seconds)}</strong>
                                                    </span>
                                                </div>

                                                <div className="text-muted" style={{ fontSize: '12px' }}>
                                                    <i className="fa fa-calendar me-1"></i>
                                                    {formatDateTime(h.called_at)}
                                                </div>
                                            </div>

                                            <div className="d-flex align-items-center gap-2 mb-2" style={{ fontSize: '12.5px' }}>
                                                <span className="text-muted">Attended by:</span>
                                                <strong style={{ color: '#1e293b' }}>{h.caller_name || 'Telecaller'}</strong>
                                            </div>

                                            {h.notes ? (
                                                <div className="p-2 rounded mt-2" style={{ background: '#f8fafc', borderLeft: `3px solid ${hMeta.color}`, fontSize: '12.5px', color: '#334155' }}>
                                                    <strong>Remarks:</strong> {h.notes}
                                                </div>
                                            ) : (
                                                <div className="text-muted mt-1" style={{ fontSize: '12px', fontStyle: 'italic' }}>
                                                    No remarks logged for this call.
                                                </div>
                                            )}

                                            {h.follow_up_date && (
                                                <div className="mt-2 text-warning fw-bold" style={{ fontSize: '11.5px' }}>
                                                    <i className="fa fa-bell me-1"></i>Scheduled Follow-up Date: {formatDate(h.follow_up_date)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                    <Button variant="secondary" size="sm" onClick={handleCloseLeadHistory} style={{ borderRadius: '6px', fontSize: '12.5px', fontWeight: 600 }}>
                        Close History
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default CrmLeadsReport;
