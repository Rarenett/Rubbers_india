import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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

const CrmReports = () => {
    usePageTitle('Call Logs & History');
    const navigate = useNavigate();

    // View mode: 'callerWise' | 'list'
    const [viewMode, setViewMode] = useState('callerWise');
    const [selectedCallerName, setSelectedCallerName] = useState('');
    const initialScopingDone = useRef(false);

    // Data states
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState({
        is_admin: false,
        current_user: {},
        selected_caller_id: null,
        efficiency: {
            total_calls: 0,
            unique_leads: 0,
            conversions: 0,
            conversion_rate: 0,
            lead_conversion_rate: 0,
            contact_rate: 0,
            avg_duration_seconds: 0,
            total_duration_seconds: 0,
        },
        callers_list: [],
        calls: [],
    });

    // Filters
    const [selectedCallerId, setSelectedCallerId] = useState('all');
    const [outcomeFilter, setOutcomeFilter] = useState('');
    const [search, setSearch] = useState('');
    const [fromDate, setFromDate] = useState(
        localStorage.getItem('active_fy_start') || ''
    );
    const [toDate, setToDate] = useState(
        localStorage.getItem('active_fy_end') || ''
    );

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

    // Pagination (10 rows per page matching reference Image 2)
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;

    // Full Lead History Modal state
    const [historyModal, setHistoryModal] = useState({
        isOpen: false,
        lead: null,
        history: [],
        totalCalls: 0,
    });

    // Fetch Report Data from API
    const fetchReports = useCallback(async () => {
        try {
            setLoading(true);
            const params = {};
            if (selectedCallerId && selectedCallerId !== 'all') {
                params.caller = selectedCallerId;
            }
            if (outcomeFilter) {
                params.call_outcome = outcomeFilter;
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

            const res = await CRMNewService.getCallerReports(params);
            if (res.data) {
                setReportData(res.data);
                if (!initialScopingDone.current) {
                    initialScopingDone.current = true;
                    if (res.data.is_admin) {
                        setViewMode('callerWise');
                    } else {
                        setViewMode('list');
                    }
                }
                setCurrentPage(1);
            }
        } catch (err) {
            console.error('Error fetching CRM reports:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedCallerId, outcomeFilter, search, fromDate, toDate]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const { is_admin, callers_list = [], efficiency = {}, calls = [] } = reportData;

    // Filtered calls - show each lead once (deduplicated by unique lead)
    const filteredCalls = useMemo(() => {
        if (!calls || !Array.isArray(calls)) return [];
        const seen = new Set();
        const uniqueCalls = [];
        for (const call of calls) {
            const leadKey = call.lead?.id 
                ? `lead_${call.lead.id}` 
                : (call.assignment_id ? `assign_${call.assignment_id}` : (call.lead?.company || call.lead?.name || `call_${call.id}`));
            if (!seen.has(leadKey)) {
                seen.add(leadKey);
                uniqueCalls.push(call);
            }
        }
        return uniqueCalls;
    }, [calls]);

    const totalPages = Math.max(1, Math.ceil(filteredCalls.length / rowsPerPage));
    const paginatedCalls = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredCalls.slice(start, start + rowsPerPage);
    }, [filteredCalls, currentPage, rowsPerPage]);

    // Open Full Lead History Modal
    const handleOpenLeadHistory = (callItem) => {
        setHistoryModal({
            isOpen: true,
            lead: callItem.lead,
            history: callItem.lead_full_history || [],
            totalCalls: callItem.total_lead_calls || (callItem.lead_full_history ? callItem.lead_full_history.length : 0),
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

    // ─── Export Handler (PDF, Excel, Print) ──────────────────────────────────
    const handleExport = (format) => {
        const columns = [
            { header: 'SL.NO', dataKey: 'index' },
            { header: 'LEAD NAME', dataKey: 'lead_name' },
            { header: 'DATE', dataKey: 'called_at_formatted' },
            { header: 'CONTACT', dataKey: 'contact' },
            { header: 'ATTENDED BY', dataKey: 'caller_name' },
            { header: 'DURATION', dataKey: 'duration_display' },
            { header: 'CALLS', dataKey: 'total_lead_calls' },
            { header: 'CALL OUTCOME', dataKey: 'call_outcome' },
            { header: 'REMARKS', dataKey: 'notes' }
        ];

        const exportData = filteredCalls.map((c, idx) => ({
            index: idx + 1,
            lead_name: c.lead?.company || c.lead?.name || `Lead #${c.assignment_id}`,
            called_at_formatted: formatDate(c.called_at),
            contact: c.lead?.phone || c.lead?.mobile || '—',
            caller_name: c.caller?.name || 'Unknown',
            duration_display: c.duration_display || formatSeconds(c.duration_seconds),
            total_lead_calls: c.total_lead_calls || 1,
            call_outcome: c.call_outcome,
            notes: c.notes || '—'
        }));

        if (format === 'pdf') {
            exportToPDF(exportData, columns, 'telecalling_report.pdf', 'Telecalling Performance Report');
        } else if (format === 'excel') {
            exportToExcel(exportData, columns, 'telecalling_report.xlsx');
        } else if (format === 'print') {
            printData(exportData, columns, 'Telecalling Performance Report');
        }
    };

    // Helper for pagination display array [1, 2, '...', 5]
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
            <PageTitle activeMenu="Reports & Performance" motherMenu="CRM" />

            <style>{`
                .crm-report-card {
                    background: #ffffff;
                    border: 1px solid #eaebf0;
                    border-radius: 12px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                }
                .crm-table th {
                    font-size: 11px !important;
                    font-weight: 700 !important;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #64748b;
                    border-bottom: 2px solid #eaebf0 !important;
                    padding: 14px 16px !important;
                    background: #ffffff;
                    white-space: nowrap;
                }
                .crm-table td {
                    padding: 14px 16px !important;
                    vertical-align: middle;
                    font-size: 13px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .crm-table tbody tr {
                    transition: background-color 0.15s ease;
                }
                .crm-table tbody tr:hover {
                    background-color: #f8f9ff !important;
                }
                .report-date-picker .react-datepicker-wrapper {
                    width: 100% !important;
                }
                .report-date-picker input {
                    border-radius: 8px !important;
                    border: 1px solid #eaebf0 !important;
                    height: 38px !important;
                    padding: 0 12px !important;
                    font-size: 13px !important;
                    background: #fcfcfd !important;
                    color: #1e293b !important;
                    width: 100% !important;
                }
                .report-date-picker input:focus {
                    outline: none !important;
                    border-color: #00b8d9 !important;
                    box-shadow: 0 0 0 2px rgba(0, 184, 217, 0.15) !important;
                }
                .timeline-item {
                    position: relative;
                    padding-left: 28px;
                    padding-bottom: 20px;
                    border-left: 2px solid #e2e8f0;
                }
                .timeline-item:last-child {
                    border-left: 2px solid transparent;
                    padding-bottom: 0;
                }
                .timeline-dot {
                    position: absolute;
                    left: -9px;
                    top: 2px;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #ffffff;
                    border: 3px solid #22c55e;
                }
            `}</style>

            {/* Quick Report Switcher Header */}
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                <div className="d-inline-flex p-1 bg-white rounded-pill shadow-sm" style={{ border: '1px solid #eaebf0' }}>
                    <button
                        type="button"
                        className="btn btn-sm rounded-pill px-3 py-1 fw-bold btn-primary text-white shadow-sm"
                        onClick={() => {}}
                    >
                        <i className="fa fa-headphones me-1"></i> Call Logs & History
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm rounded-pill px-3 py-1 fw-bold btn-link text-muted text-decoration-none"
                        onClick={() => navigate('/crm_new/leads-report')}
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

            {/* ── Main Unified Enterprise Card (Matching other modules: AssetAllocationList) ── */}
            <Card className="crm-report-card">
                <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-3 py-3 border-bottom" style={{ background: '#ffffff', borderColor: '#eaebf0' }}>
                    {/* Left: Title + Switcher */}
                    <div className="d-flex align-items-center gap-3">
                        <Card.Title className="mb-0 fw-bold" style={{ fontSize: '1.1rem', color: '#1e293b' }}>
                            Call Logs & History
                        </Card.Title>
                        {is_admin && (
                            <div className="d-inline-flex p-1 bg-light rounded-pill" style={{ border: '1px solid #eaebf0' }}>
                                <button
                                    type="button"
                                    className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold d-flex align-items-center ${viewMode === 'callerWise' ? 'bg-white shadow-sm' : 'text-muted bg-transparent border-0'}`}
                                    onClick={() => {
                                        setViewMode('callerWise');
                                        if (selectedCallerId && selectedCallerId !== 'all') {
                                            setSelectedCallerId('all');
                                            setSelectedCallerName('');
                                        }
                                    }}
                                    style={{
                                        border: viewMode === 'callerWise' ? '1px solid #eaebf0' : 'none',
                                        color: viewMode === 'callerWise' ? '#00b8d9' : '#64748b',
                                        fontSize: '0.8rem',
                                        transition: 'all 0.2s ease-in-out'
                                    }}
                                >
                                    <i className="fa fa-users me-1.5"></i> All Telecallers
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold d-flex align-items-center ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-muted bg-transparent border-0'}`}
                                    onClick={() => setViewMode('list')}
                                    style={{
                                        border: viewMode === 'list' ? '1px solid #eaebf0' : 'none',
                                        color: viewMode === 'list' ? '#00b8d9' : '#64748b',
                                        fontSize: '0.8rem',
                                        transition: 'all 0.2s ease-in-out'
                                    }}
                                >
                                    <i className="fa fa-list me-1.5"></i> All Calls List
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right: Filters + Search Bar + Export Buttons on the Same Line */}
                    <div className="d-flex align-items-center gap-2 flex-wrap flex-grow-1 justify-content-end">
                        {/* From Date (Native Date Input matching other modules / user reference) */}
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

                        {/* To Date (Native Date Input matching other modules / user reference) */}
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

                        {/* Call Outcome Filter */}
                        <div className="flex-shrink-0" style={{ width: '150px' }}>
                            <select
                                className="form-select form-select-sm"
                                value={outcomeFilter}
                                onChange={(e) => setOutcomeFilter(e.target.value)}
                                style={{ height: '38px', borderRadius: '6px', borderColor: '#eaebf0', fontSize: '12.5px', background: '#fcfcfd' }}
                            >
                                <option value="">All Call Outcomes</option>
                                {Object.keys(OUTCOME_META).filter(k => k !== 'Converted').map((k) => (
                                    <option key={k} value={k}>{OUTCOME_META[k].label || k}</option>
                                ))}
                            </select>
                        </div>

                        {/* Telecaller Filter (if Admin) */}
                        {is_admin && callers_list.length > 0 && (
                            <div className="flex-shrink-0" style={{ width: '160px' }}>
                                <select
                                    className="form-select form-select-sm"
                                    value={selectedCallerId || 'all'}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSelectedCallerId(val);
                                        if (val && val !== 'all') {
                                            const found = callers_list.find(c => String(c.id) === String(val));
                                            setSelectedCallerName(found ? found.name : '');
                                            setViewMode('list');
                                        } else {
                                            setSelectedCallerName('');
                                        }
                                    }}
                                    style={{ height: '38px', borderRadius: '6px', borderColor: '#eaebf0', fontSize: '12.5px', background: '#fcfcfd' }}
                                >
                                    <option value="all">All Telecallers ({callers_list.length})</option>
                                    {callers_list.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} ({c.total_calls})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Search Bar (Matching other modules: AssetAllocationList.jsx / CrmServiceList.jsx) */}
                        <div style={{ position: 'relative', width: '220px' }}>
                            <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                            <Form.Control
                                type="text"
                                placeholder="Search reports..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setCurrentPage(1);
                                }}
                                style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px', borderColor: '#eaebf0' }}
                            />
                        </div>

                        {/* Export Buttons directly beside Search Bar (Matching other modules) */}
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

                    {/* ════════════════════════════════════════════════════════════
                        VIEW 1: LIST VIEW TABLE (Matching Renewal History Report Design)
                    ════════════════════════════════════════════════════════════ */}
                    {viewMode === 'list' && (
                        <div>
                            {is_admin && selectedCallerId && selectedCallerId !== 'all' && (
                                <div className="d-flex align-items-center justify-content-between px-3 py-2 bg-light border-bottom">
                                    <div className="d-flex align-items-center gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                                            onClick={() => {
                                                setSelectedCallerId('all');
                                                setSelectedCallerName('');
                                                setViewMode('callerWise');
                                            }}
                                            style={{ fontSize: '12px', borderRadius: '6px' }}
                                        >
                                            <i className="fa fa-arrow-left"></i> Back to Telecallers
                                        </button>
                                        <span className="text-muted" style={{ fontSize: '13px' }}>|</span>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                                            Call History: <span className="text-primary">{selectedCallerName || `Telecaller #${selectedCallerId}`}</span>
                                        </span>
                                        <span className="badge badge-info light ms-1" style={{ fontSize: '11px' }}>
                                            {filteredCalls.length} {filteredCalls.length === 1 ? 'Lead' : 'Leads'} Contacted
                                        </span>
                                    </div>
                                    <span className="text-muted d-none d-md-inline" style={{ fontSize: '12px' }}>
                                        Showing call history grouped by leads separately
                                    </span>
                                </div>
                            )}
                            <div className="table-responsive">
                                <table className="table table-responsive-md">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '60px' }}>SL NO</th>
                                            <th>LEAD NAME</th>
                                            <th>DATE</th>
                                            <th>CONTACT</th>
                                            {is_admin && <th>ATTENDED BY</th>}
                                            <th>DURATION</th>
                                            <th className="text-center">CALLS</th>
                                            <th>CALL OUTCOME</th>
                                            <th>REMARKS</th>
                                            <th className="text-end">ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr>
                                                <td colSpan={is_admin ? 10 : 9} className="text-center py-4">
                                                    Loading call records...
                                                </td>
                                            </tr>
                                        ) : filteredCalls.length === 0 ? (
                                            <tr>
                                                <td colSpan={is_admin ? 10 : 9} className="text-center py-4 text-muted">
                                                    No call records found for the selected criteria.
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedCalls.map((call, idx) => {
                                                const globalIdx = (currentPage - 1) * rowsPerPage + idx + 1;
                                                const meta = OUTCOME_META[call.call_outcome] || { label: call.call_outcome };
                                                const lead = call.lead || {};
                                                const leadDisplay = lead.company || lead.name || `Lead #${call.assignment_id}`;

                                                return (
                                                    <tr key={call.id || idx}>
                                                        {/* 1. SL NO */}
                                                        <td>{globalIdx}</td>

                                                        {/* 2. LEAD NAME */}
                                                        <td>
                                                            <strong
                                                                style={{ cursor: 'pointer' }}
                                                                onClick={() => handleOpenLeadHistory(call)}
                                                                title="Click to view full lead history"
                                                            >
                                                                {leadDisplay}
                                                            </strong>
                                                            {lead.city && (
                                                                <div className="text-muted" style={{ fontSize: '11px' }}>
                                                                    {lead.city}
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* 3. DATE */}
                                                        <td>{formatDate(call.called_at)}</td>

                                                        {/* 4. CONTACT */}
                                                        <td>
                                                            {lead.phone || lead.mobile ? (
                                                                <a href={`tel:${lead.phone || lead.mobile}`} className="text-decoration-none text-dark">
                                                                    {lead.phone || lead.mobile}
                                                                </a>
                                                            ) : (lead.name || '—')}
                                                        </td>

                                                        {/* ATTENDED BY (If Admin - Matching ALLOCATED TO light badge) */}
                                                        {is_admin && (
                                                            <td>
                                                                <span className="badge badge-info light">
                                                                    {call.caller?.name || 'Unknown'}
                                                                </span>
                                                            </td>
                                                        )}

                                                        {/* 5. DURATION */}
                                                        <td>
                                                            {call.duration_display || formatSeconds(call.duration_seconds)}
                                                        </td>

                                                        {/* 6. CALLS */}
                                                        <td className="text-center">
                                                            <span className="badge badge-info light">
                                                                {call.total_lead_calls || 1}
                                                            </span>
                                                        </td>

                                                        {/* 7. CALL OUTCOME (Matching STATUS light badge) */}
                                                        <td>
                                                            <span className={getOutcomeBadgeClass(call.call_outcome)}>
                                                                {meta.label || call.call_outcome}
                                                            </span>
                                                        </td>

                                                        {/* 8. REMARKS */}
                                                        <td>{call.notes || '—'}</td>

                                                        {/* 9. ACTION */}
                                                        <td className="text-end">
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-info"
                                                                onClick={() => handleOpenLeadHistory(call)}
                                                                style={{
                                                                    width: '32px',
                                                                    height: '32px',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    padding: '0',
                                                                    borderRadius: '6px'
                                                                }}
                                                                title="View full call history for this lead"
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

                            {/* ── Bottom Pagination (Matching RenewalHistoryReport) ── */}
                            {!loading && filteredCalls.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 p-3">
                                    <div className="dataTables_info">
                                        Showing {filteredCalls.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} to {Math.min(currentPage * rowsPerPage, filteredCalls.length)} of {filteredCalls.length} entries
                                    </div>
                                    {totalPages > 1 && (
                                        <div className="dataTables_paginate paging_simple_numbers">
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
                                                    {paginationItems.map((item, i) => {
                                                        if (item === '...') {
                                                            return (
                                                                <li key={i} className="page-item disabled">
                                                                    <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                                </li>
                                                            );
                                                        }
                                                        const isActive = currentPage === item;
                                                        return (
                                                            <li key={i} className={`page-item ${isActive ? 'active' : ''}`}>
                                                                <button
                                                                    type="button"
                                                                    className="page-link"
                                                                    onClick={() => setCurrentPage(item)}
                                                                    style={{ border: 'none' }}
                                                                >
                                                                    {item}
                                                                </button>
                                                            </li>
                                                        );
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
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ════════════════════════════════════════════════════════════
                        VIEW 2: CALLER WISE VIEW (If Admin - Matching Renewal History Table Design)
                    ════════════════════════════════════════════════════════════ */}
                    {viewMode === 'callerWise' && is_admin && (
                        <div>
                            <div className="table-responsive">
                                <table className="table table-responsive-md">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '60px' }}>SL NO</th>
                                            <th>TELECALLER</th>
                                            <th className="text-center">TOTAL CALLS</th>
                                            <th className="text-center">UNIQUE LEADS</th>
                                            <th className="text-center">CONVERTED</th>
                                            <th className="text-center">CONVERSION RATE</th>
                                            <th className="text-center">CONTACT RATE</th>
                                            <th className="text-center">AVG DURATION</th>
                                            <th>LAST ACTIVE</th>
                                            <th className="text-end">ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {callers_list.map((c, idx) => (
                                            <tr key={c.id}>
                                                <td>{idx + 1}</td>
                                                <td>
                                                    <strong>{c.name}</strong>
                                                    <div className="text-muted" style={{ fontSize: '11px' }}>
                                                        {c.email || c.username}
                                                    </div>
                                                </td>
                                                <td className="text-center">{c.total_calls}</td>
                                                <td className="text-center">{c.unique_leads}</td>
                                                <td className="text-center">
                                                    <span className="badge badge-success light">
                                                        {c.conversions}
                                                    </span>
                                                </td>
                                                <td className="text-center">
                                                    {c.conversion_rate}%
                                                </td>
                                                <td className="text-center">{c.contact_rate}%</td>
                                                <td className="text-center">{formatSeconds(c.avg_duration_seconds)}</td>
                                                <td>
                                                    {c.last_call_at ? formatDate(c.last_call_at) : '—'}
                                                </td>
                                                <td className="text-end">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-info"
                                                        onClick={() => {
                                                            setSelectedCallerId(String(c.id));
                                                            setSelectedCallerName(c.name);
                                                            setViewMode('list');
                                                        }}
                                                        style={{ fontSize: '12px', fontWeight: 600, borderRadius: '6px' }}
                                                    >
                                                        <i className="fa fa-history me-1"></i> History
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
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

export default CrmReports;
