import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Table, Modal, Button, Spinner, Card, Form, Badge } from 'react-bootstrap';
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
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getClassificationBadgeClass = (classification) => {
    if ((classification || '').toLowerCase() === 'vendor') {
        return 'badge badge-warning light';
    }
    return 'badge badge-info light';
};

const getApprovalBadgeClass = (status) => {
    switch ((status || '').toUpperCase()) {
        case 'ACCEPTED':
            return 'badge badge-success light';
        case 'PENDING':
            return 'badge badge-warning light';
        case 'ON_HOLD':
            return 'badge badge-danger light';
        case 'NOT_SUBMITTED':
        default:
            return 'badge badge-dark light';
    }
};

const getApprovalLabel = (status) => {
    switch ((status || '').toUpperCase()) {
        case 'ACCEPTED':
            return 'Accepted';
        case 'PENDING':
            return 'Pending Approval';
        case 'ON_HOLD':
            return 'On Hold';
        case 'NOT_SUBMITTED':
        default:
            return 'Not Submitted';
    }
};

const CrmConvertedLeadsReport = () => {
    usePageTitle('Converted Leads Report');
    const navigate = useNavigate();

    // Data states
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState({
        is_admin: false,
        summary: {
            total_converted: 0,
            total_distributors: 0,
            total_vendors: 0,
            accounts_created: 0,
            approvals_accepted: 0,
            approvals_pending: 0,
            approvals_on_hold: 0,
            top_callers: [],
        },
        callers_list: [],
        leads: [],
    });

    // Filters
    const [callerFilter, setCallerFilter] = useState('all');
    const [classificationFilter, setClassificationFilter] = useState('');
    const [approvalStatusFilter, setApprovalStatusFilter] = useState('');
    const [search, setSearch] = useState('');
    const [fromDate, setFromDate] = useState(
        localStorage.getItem('active_fy_start') || ''
    );
    const [toDate, setToDate] = useState(
        localStorage.getItem('active_fy_end') || ''
    );

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;

    // Full Lead History / Audit Modal state
    const [historyModal, setHistoryModal] = useState({
        isOpen: false,
        lead: null,
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

    // Fetch Converted Leads Report Data from API
    const fetchConvertedReport = useCallback(async () => {
        try {
            setLoading(true);
            const params = {};
            if (callerFilter && callerFilter !== 'all') {
                params.caller = callerFilter;
            }
            if (classificationFilter) {
                params.classification = classificationFilter;
            }
            if (approvalStatusFilter) {
                params.approval_status = approvalStatusFilter;
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

            const res = await CRMNewService.getConvertedLeadsReport(params);
            if (res.data) {
                setReportData(res.data);
                setCurrentPage(1);
            }
        } catch (err) {
            console.error('Error fetching Converted Leads Report:', err);
        } finally {
            setLoading(false);
        }
    }, [callerFilter, classificationFilter, approvalStatusFilter, search, fromDate, toDate]);

    useEffect(() => {
        fetchConvertedReport();
    }, [fetchConvertedReport]);

    const { summary = {}, callers_list = [], leads = [] } = reportData;

    // Filtered leads
    const filteredLeads = useMemo(() => {
        return leads || [];
    }, [leads]);

    const totalPages = Math.max(1, Math.ceil(filteredLeads.length / rowsPerPage));
    const paginatedLeads = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredLeads.slice(start, start + rowsPerPage);
    }, [filteredLeads, currentPage, rowsPerPage]);

    const handleOpenLeadHistory = (leadItem) => {
        setHistoryModal({
            isOpen: true,
            lead: leadItem,
        });
    };

    const handleCloseLeadHistory = () => {
        setHistoryModal({
            isOpen: false,
            lead: null,
        });
    };

    // Export Handler (PDF, Excel, Print)
    const handleExport = (format) => {
        const columns = [
            { header: 'SL.NO', dataKey: 'index' },
            { header: 'LEAD / COMPANY', dataKey: 'lead_name' },
            { header: 'CONTACT', dataKey: 'contact' },
            { header: 'CATEGORY', dataKey: 'category_name' },
            { header: 'CLASSIFICATION', dataKey: 'classification' },
            { header: 'CONVERTED BY', dataKey: 'converted_by_name' },
            { header: 'CONVERTED DATE', dataKey: 'converted_at_formatted' },
            { header: 'ACCOUNT CREATED', dataKey: 'account_status' },
            { header: 'APPROVAL STATUS', dataKey: 'approval_status_label' },
            { header: 'TOTAL CALLS', dataKey: 'total_calls' },
        ];

        const exportData = filteredLeads.map((l, idx) => ({
            index: idx + 1,
            lead_name: l.company || l.name || `Lead #${l.id}`,
            contact: l.phone || l.mobile || '—',
            category_name: l.category_name || l.source_name || '—',
            classification: l.classification || 'Distributor',
            converted_by_name: l.converted_by?.name || 'Unknown',
            converted_at_formatted: l.converted_at ? formatDate(l.converted_at) : (l.created_at ? formatDate(l.created_at) : '—'),
            account_status: l.has_account_created ? 'Yes' : 'No',
            approval_status_label: getApprovalLabel(l.approval_status),
            total_calls: l.total_calls || 0,
        }));

        if (format === 'pdf') {
            exportToPDF(exportData, columns, 'converted_leads_report.pdf', 'Converted Leads Report');
        } else if (format === 'excel') {
            exportToExcel(exportData, columns, 'converted_leads_report.xlsx');
        } else if (format === 'print') {
            printData(exportData, columns, 'Converted Leads Report');
        }
    };

    // Pagination items
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
            <PageTitle activeMenu="Converted Leads Report" motherMenu="CRM" />

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
                    top: 4px;
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
                        className="btn btn-sm rounded-pill px-3 py-1 fw-bold btn-link text-muted text-decoration-none"
                        onClick={() => navigate('/crm_new/leads-report')}
                    >
                        <i className="fa fa-users me-1"></i> All Leads Report
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm rounded-pill px-3 py-1 fw-bold btn-primary text-white shadow-sm"
                        onClick={() => {}}
                    >
                        <i className="fa fa-trophy me-1"></i> Converted Leads Report
                    </button>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button
                        onClick={() => navigate('/crm_new/converted-opportunities')}
                        className="btn btn-outline-primary btn-sm d-flex align-items-center shadow-sm"
                        style={{ gap: '6px', borderRadius: '6px', fontWeight: 600, fontSize: '13px' }}
                        title="Go to Converted Opportunities Pipeline"
                    >
                        <i className="fa fa-arrow-left"></i> Converted Opportunities Pipeline
                    </button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="row g-3 mb-4">
                <div className="col-xl-3 col-sm-6">
                    <div className="card mb-0 shadow-sm" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                        <div className="card-body p-3 d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted text-uppercase font-w600" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                                    Total Converted Leads
                                </div>
                                <h3 className="font-w700 mb-0 mt-1" style={{ fontSize: '26px', color: '#10b981' }}>
                                    {summary.total_converted || 0}
                                </h3>
                            </div>
                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                                <i className="fa fa-trophy"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-xl-3 col-sm-6">
                    <div className="card mb-0 shadow-sm" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                        <div className="card-body p-3 d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted text-uppercase font-w600" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                                    Distributor Opportunities
                                </div>
                                <h3 className="font-w700 mb-0 mt-1" style={{ fontSize: '26px', color: '#0284c7' }}>
                                    {summary.total_distributors || 0}
                                </h3>
                            </div>
                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f0f9ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                                <i className="fa fa-building"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-xl-3 col-sm-6">
                    <div className="card mb-0 shadow-sm" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                        <div className="card-body p-3 d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted text-uppercase font-w600" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                                    Vendor Opportunities
                                </div>
                                <h3 className="font-w700 mb-0 mt-1" style={{ fontSize: '26px', color: '#f59e0b' }}>
                                    {summary.total_vendors || 0}
                                </h3>
                            </div>
                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fffbeb', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                                <i className="fa fa-truck"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-xl-3 col-sm-6">
                    <div className="card mb-0 shadow-sm" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                        <div className="card-body p-3 d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted text-uppercase font-w600" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                                    Accounts Created
                                </div>
                                <h3 className="font-w700 mb-0 mt-1" style={{ fontSize: '26px', color: '#8b5cf6' }}>
                                    {summary.accounts_created || 0}
                                </h3>
                                <div className="text-muted" style={{ fontSize: '11px' }}>
                                    {summary.approvals_accepted || 0} Accepted | {summary.approvals_pending || 0} Pending
                                </div>
                            </div>
                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f5f3ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                                <i className="fa fa-user-plus"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Report Card */}
            <Card className="crm-report-card shadow-sm">
                <Card.Header className="bg-white border-bottom py-3 px-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
                    {/* Left: Title & Count */}
                    <div className="d-flex align-items-center gap-2">
                        <h4 className="mb-0 fw-bold text-dark" style={{ fontSize: '17px' }}>
                            Converted Leads Report
                        </h4>
                        <span className="badge ms-1" style={{ background: '#f1f5f9', color: '#475569', fontSize: '12px', fontWeight: 600, borderRadius: '6px' }}>
                            {filteredLeads.length} {filteredLeads.length === 1 ? 'Lead' : 'Leads'}
                        </span>
                    </div>

                    {/* Right: Filters + Search + Export */}
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

                        {/* Telecaller Filter */}
                        {callers_list.length > 0 && (
                            <div className="flex-shrink-0" style={{ width: '150px' }}>
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

                        {/* Classification Filter */}
                        <div className="flex-shrink-0" style={{ width: '145px' }}>
                            <select
                                className="form-select form-select-sm"
                                value={classificationFilter}
                                onChange={(e) => setClassificationFilter(e.target.value)}
                                style={{ height: '38px', borderRadius: '6px', borderColor: '#eaebf0', fontSize: '12.5px', background: '#fcfcfd' }}
                            >
                                <option value="">All Classifications</option>
                                <option value="Distributor">Distributor</option>
                                <option value="Vendor">Vendor</option>
                            </select>
                        </div>

                        {/* Approval Status Filter */}
                        <div className="flex-shrink-0" style={{ width: '150px' }}>
                            <select
                                className="form-select form-select-sm"
                                value={approvalStatusFilter}
                                onChange={(e) => setApprovalStatusFilter(e.target.value)}
                                style={{ height: '38px', borderRadius: '6px', borderColor: '#eaebf0', fontSize: '12.5px', background: '#fcfcfd' }}
                            >
                                <option value="">All Approvals</option>
                                <option value="ACCEPTED">Accepted</option>
                                <option value="PENDING">Pending Approval</option>
                                <option value="ON_HOLD">On Hold</option>
                                <option value="NOT_SUBMITTED">Not Submitted</option>
                            </select>
                        </div>

                        {/* Search Bar */}
                        <div style={{ position: 'relative', width: '200px' }}>
                            <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                            <Form.Control
                                type="text"
                                placeholder="Search leads..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setCurrentPage(1);
                                }}
                                style={{
                                    height: '38px',
                                    borderRadius: '6px',
                                    paddingLeft: '32px',
                                    fontSize: '13px',
                                    borderColor: '#eaebf0',
                                    color: '#1e293b'
                                }}
                            />
                        </div>

                        {/* Export Buttons directly beside Search Bar (Matching other pages) */}
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
                        <table className="table table-responsive-md crm-table mb-0">
                            <thead>
                                <tr>
                                    <th style={{ width: '60px' }}>SL NO</th>
                                    <th>LEAD / COMPANY NAME</th>
                                    <th>CONTACT</th>
                                    <th>CATEGORY / SOURCE</th>
                                    <th>CLASSIFICATION</th>
                                    <th>CONVERTED BY</th>
                                    <th>CONVERTED DATE</th>
                                    <th>ACCOUNT STATUS</th>
                                    <th>APPROVAL STATUS</th>
                                    <th className="text-center">CALLS</th>
                                    <th className="text-end">ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={11} className="text-center py-5">
                                            <Spinner animation="border" size="sm" variant="primary" className="me-2" />
                                            Loading converted leads report...
                                        </td>
                                    </tr>
                                ) : filteredLeads.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="text-center py-5 text-muted">
                                            <i className="fa fa-info-circle fa-2x mb-2 d-block text-muted"></i>
                                            No converted leads found for the selected criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedLeads.map((lead, idx) => {
                                        const globalIdx = (currentPage - 1) * rowsPerPage + idx + 1;
                                        const leadDisplay = lead.company || lead.name || `Lead #${lead.id}`;

                                        return (
                                            <tr key={lead.id || idx}>
                                                {/* 1. SL NO */}
                                                <td>{globalIdx}</td>

                                                {/* 2. LEAD / COMPANY NAME */}
                                                <td>
                                                    <strong
                                                        style={{ cursor: 'pointer', color: '#1e293b' }}
                                                        onClick={() => handleOpenLeadHistory(lead)}
                                                        title="Click to view complete details & call logs"
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

                                                {/* 5. CLASSIFICATION */}
                                                <td>
                                                    <span className={getClassificationBadgeClass(lead.classification)}>
                                                        {lead.classification || 'Distributor'}
                                                    </span>
                                                </td>

                                                {/* 6. CONVERTED BY */}
                                                <td>
                                                    <div className="d-flex align-items-center gap-1.5">
                                                        <i className="fa fa-user-circle text-muted" style={{ fontSize: '13px' }}></i>
                                                        <span style={{ fontWeight: 500 }}>
                                                            {lead.converted_by?.name || 'Unknown'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* 7. CONVERTED DATE */}
                                                <td>
                                                    {lead.converted_at ? formatDate(lead.converted_at) : (lead.created_at ? formatDate(lead.created_at) : '—')}
                                                </td>

                                                {/* 8. OPPORTUNITY ACCOUNT */}
                                                <td>
                                                    {lead.has_account_created ? (
                                                        <span className="badge badge-success light" title={lead.opportunity_account?.account_group_name || ''}>
                                                            <i className="fa fa-check me-1"></i> Profile Created
                                                        </span>
                                                    ) : (
                                                        <span className="badge badge-dark light">
                                                            Not Created
                                                        </span>
                                                    )}
                                                </td>

                                                {/* 9. APPROVAL STATUS */}
                                                <td>
                                                    <span className={getApprovalBadgeClass(lead.approval_status)}>
                                                        {getApprovalLabel(lead.approval_status)}
                                                    </span>
                                                </td>

                                                {/* 10. TOTAL CALLS */}
                                                <td className="text-center">
                                                    <span className="badge badge-info light">
                                                        {lead.total_calls || 0}
                                                    </span>
                                                </td>

                                                {/* 11. ACTION */}
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
                                                        title="View complete conversion details & call history"
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

                    {/* Pagination */}
                    {filteredLeads.length > 0 && (
                        <div className="d-flex justify-content-between align-items-center flex-wrap px-4 py-3 border-top">
                            <span className="text-muted" style={{ fontSize: '13px' }}>
                                Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, filteredLeads.length)} of {filteredLeads.length} entries
                            </span>
                            <div className="d-flex gap-1 align-items-center">
                                <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    style={{ borderRadius: '6px', padding: '4px 10px', fontSize: '12px' }}
                                >
                                    Previous
                                </Button>
                                {paginationItems.map((item, index) => (
                                    <Button
                                        key={index}
                                        variant={currentPage === item ? 'primary' : 'outline-secondary'}
                                        size="sm"
                                        disabled={item === '...'}
                                        onClick={() => typeof item === 'number' && setCurrentPage(item)}
                                        style={{
                                            borderRadius: '6px',
                                            padding: '4px 10px',
                                            fontSize: '12px',
                                            minWidth: '32px'
                                        }}
                                    >
                                        {item}
                                    </Button>
                                ))}
                                <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    style={{ borderRadius: '6px', padding: '4px 10px', fontSize: '12px' }}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </Card.Body>
            </Card>

            {/* Complete Lead History & Details Modal */}
            <Modal
                show={historyModal.isOpen}
                onHide={handleCloseLeadHistory}
                size="lg"
                centered
            >
                <Modal.Header closeButton className="border-bottom py-3 px-4">
                    <Modal.Title style={{ fontSize: '16px', fontWeight: 'bold' }}>
                        Converted Opportunity Details & History
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                    {historyModal.lead && (
                        <>
                            {/* Lead Information Card */}
                            <div className="p-3 mb-4 rounded-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                                    <div>
                                        <h5 className="mb-1 text-dark fw-bold">
                                            {historyModal.lead.company || historyModal.lead.name || `Lead #${historyModal.lead.id}`}
                                        </h5>
                                        <div className="text-muted" style={{ fontSize: '12px' }}>
                                            {historyModal.lead.city ? `${historyModal.lead.city}, ` : ''}{historyModal.lead.state || ''}
                                        </div>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <span className={getClassificationBadgeClass(historyModal.lead.classification)}>
                                            {historyModal.lead.classification || 'Distributor'}
                                        </span>
                                        <span className={getApprovalBadgeClass(historyModal.lead.approval_status)}>
                                            {getApprovalLabel(historyModal.lead.approval_status)}
                                        </span>
                                    </div>
                                </div>

                                <div className="row g-2 mt-2 pt-2 border-top" style={{ fontSize: '12.5px' }}>
                                    <div className="col-sm-6">
                                        <span className="text-muted">Contact:</span>{' '}
                                        <strong>{historyModal.lead.phone || historyModal.lead.mobile || '—'}</strong>
                                    </div>
                                    <div className="col-sm-6">
                                        <span className="text-muted">Email:</span>{' '}
                                        <strong>{historyModal.lead.email || '—'}</strong>
                                    </div>
                                    <div className="col-sm-6">
                                        <span className="text-muted">Converted By:</span>{' '}
                                        <strong>{historyModal.lead.converted_by?.name || 'Unknown'}</strong>
                                    </div>
                                    <div className="col-sm-6">
                                        <span className="text-muted">Converted Date:</span>{' '}
                                        <strong>{formatDateTime(historyModal.lead.converted_at)}</strong>
                                    </div>
                                    <div className="col-sm-6">
                                        <span className="text-muted">Total Duration:</span>{' '}
                                        <strong>{historyModal.lead.total_duration_display || '—'}</strong>
                                    </div>
                                    <div className="col-sm-6">
                                        <span className="text-muted">Total Calls:</span>{' '}
                                        <strong>{historyModal.lead.total_calls || 0}</strong>
                                    </div>
                                    {historyModal.lead.conversion_notes && (
                                        <div className="col-12 mt-2">
                                            <span className="text-muted">Conversion Remarks:</span>
                                            <div className="p-2 mt-1 rounded bg-white border" style={{ fontStyle: 'italic', color: '#334155' }}>
                                                "{historyModal.lead.conversion_notes}"
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Opportunity Profile Section (if exists) */}
                            {historyModal.lead.opportunity_account && (
                                <div className="p-3 mb-4 rounded-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                    <h6 className="fw-bold text-success mb-2 d-flex align-items-center gap-1.5">
                                        <i className="fa fa-check-circle"></i> Linked Financial Profile Details
                                    </h6>
                                    <div className="row g-2" style={{ fontSize: '12.5px' }}>
                                        <div className="col-sm-6">
                                            <span className="text-muted">Account Name:</span>{' '}
                                            <strong>{historyModal.lead.opportunity_account.name}</strong>
                                        </div>
                                        <div className="col-sm-6">
                                            <span className="text-muted">Account Group:</span>{' '}
                                            <strong>{historyModal.lead.opportunity_account.account_group_name || historyModal.lead.opportunity_account.accountGroup || '—'}</strong>
                                        </div>
                                        <div className="col-sm-6">
                                            <span className="text-muted">Credit Limit:</span>{' '}
                                            <strong>₹{formatCurrency(historyModal.lead.opportunity_account.credit_limit)}</strong>
                                        </div>
                                        <div className="col-sm-6">
                                            <span className="text-muted">Opening Balance:</span>{' '}
                                            <strong>₹{formatCurrency(historyModal.lead.opportunity_account.opening_balance)}</strong>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Approval Workflow Section (if exists) */}
                            {historyModal.lead.approval && (
                                <div className="p-3 mb-4 rounded-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                    <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-1.5">
                                        <i className="fa fa-check-square-o text-primary"></i> Approval Workflow Audit
                                    </h6>
                                    <div className="row g-2" style={{ fontSize: '12.5px' }}>
                                        <div className="col-sm-6">
                                            <span className="text-muted">Submitted By:</span>{' '}
                                            <strong>{historyModal.lead.approval.submitted_by_name || '—'}</strong>
                                        </div>
                                        <div className="col-sm-6">
                                            <span className="text-muted">Submitted At:</span>{' '}
                                            <strong>{formatDateTime(historyModal.lead.approval.submitted_at)}</strong>
                                        </div>
                                        <div className="col-sm-6">
                                            <span className="text-muted">Action By:</span>{' '}
                                            <strong>{historyModal.lead.approval.action_by_name || '—'}</strong>
                                        </div>
                                        <div className="col-sm-6">
                                            <span className="text-muted">Action At:</span>{' '}
                                            <strong>{formatDateTime(historyModal.lead.approval.action_at)}</strong>
                                        </div>
                                        {historyModal.lead.approval.remarks && (
                                            <div className="col-12 mt-1">
                                                <span className="text-muted">Approver Remarks:</span>{' '}
                                                <span className="text-dark">{historyModal.lead.approval.remarks}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Call History Timeline */}
                            <h6 className="fw-bold text-dark mb-3">
                                Call History Timeline ({historyModal.lead.call_logs?.length || 0})
                            </h6>
                            {(!historyModal.lead.call_logs || historyModal.lead.call_logs.length === 0) ? (
                                <p className="text-muted text-center py-3">No call logs recorded for this lead.</p>
                            ) : (
                                <div className="timeline-container">
                                    {historyModal.lead.call_logs.map((log, lIdx) => (
                                        <div key={log.id || lIdx} className="timeline-item">
                                            <div className="timeline-dot"></div>
                                            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-1">
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className={`badge ${log.call_outcome === 'Converted' || log.call_outcome === 'Converted to Opportunity' ? 'badge-success' : 'badge-info'} light`}>
                                                        {log.call_outcome}
                                                    </span>
                                                    <span className="text-muted" style={{ fontSize: '12px' }}>
                                                        by <strong>{log.caller_name || 'Unknown'}</strong>
                                                    </span>
                                                </div>
                                                <div className="text-muted" style={{ fontSize: '11.5px' }}>
                                                    {formatDateTime(log.called_at)}
                                                    {log.duration_display && ` (${log.duration_display})`}
                                                </div>
                                            </div>
                                            {log.notes && (
                                                <div className="p-2 rounded bg-light mt-1" style={{ fontSize: '12px', color: '#475569' }}>
                                                    {log.notes}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer className="border-top py-2 px-4">
                    <Button variant="secondary" size="sm" onClick={handleCloseLeadHistory}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default CrmConvertedLeadsReport;

