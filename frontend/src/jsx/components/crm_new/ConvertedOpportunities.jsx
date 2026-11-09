import React, { useState, useEffect, useMemo } from 'react';
import { Card, Row, Col, Table, Badge, Button, Form, Modal } from 'react-bootstrap';
import axiosInstance from '../../../services/AxiosInstance';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import PageTitle from '../../layouts/PageTitle';
import { usePageTitle } from '../../../context/TitleContext';
import OpportunityAccountModal from './OpportunityAccountModal';
import EditButton from '../../../components/permissions/EditButton';
import * as FinanceService from '../../../services/FinanceService';

// ─── Format Helpers ─────────────────────────────────────────────────────────
const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const PRIORITY_META = {
    'Critical': { label: 'Critical', color: '#FF4C41', bg: '#ffefee', badgeClass: 'badge-danger light' },
    'High':     { label: 'High',     color: '#FFAC30', bg: '#fff2dd', badgeClass: 'badge-warning light' },
    'Medium':   { label: 'Medium',   color: '#51A6F5', bg: '#f5fafe', badgeClass: 'badge-info light' },
    'Low':      { label: 'Low',      color: '#68CF29', bg: '#ecfae4', badgeClass: 'badge-success light' },
};

const getPriorityBadgeClass = (priority) => {
    return PRIORITY_META[priority]?.badgeClass || 'badge-info light';
};

const OUTCOME_META = {
    'Contacted': { label: 'Contacted', badgeClass: 'badge-info light', color: '#0284c7', bg: '#f5fafe' },
    'Interested': { label: 'Interested', badgeClass: 'badge-success light', color: '#68CF29', bg: '#ecfae4' },
    'Call Back Later': { label: 'Call Back Later', badgeClass: 'badge-warning light', color: '#FFAC30', bg: '#fff2dd' },
    'Converted': { label: 'Converted to Opportunity', badgeClass: 'badge-success light', color: '#68CF29', bg: '#ecfae4' },
    'Converted to Opportunity': { label: 'Converted to Opportunity', badgeClass: 'badge-success light', color: '#68CF29', bg: '#ecfae4' },
    'Busy': { label: 'Busy', badgeClass: 'badge-warning light', color: '#FFAC30', bg: '#fff2dd' },
    'Not Answered': { label: 'Not Answered', badgeClass: 'badge-dark light', color: '#6e6e6e', bg: '#eeeeee' },
    'Not Interested': { label: 'Not Interested', badgeClass: 'badge-danger light', color: '#FF4C41', bg: '#ffefee' },
    'Wrong Number': { label: 'Wrong Number', badgeClass: 'badge-danger light', color: '#FF4C41', bg: '#ffefee' },
};

const getOutcomeBadgeClass = (outcome) => {
    return OUTCOME_META[outcome]?.badgeClass || 'badge-success light';
};

// ─── Classification Helper ──────────────────────────────────────────────────
export const getLeadClassification = (item) => {
    const lead = item?.lead || item || {};
    const textToScan = [
        item?.lead_source,
        item?.lead_source_name,
        item?.lead?.lead_source,
        item?.lead?.lead_source_name,
        item?.lead?.category_name,
        item?.lead?.category,
        lead.lead_source,
        lead.lead_source_name,
        lead.category_name,
        lead.lead_category_name,
        lead.category,
        lead.company,
        lead.title,
        lead.first_name,
        lead.last_name,
        lead.description,
        item?.team_name,
    ].filter(Boolean).join(' ').toLowerCase();

    if (textToScan.includes('vendor') || textToScan.includes('supplier') || textToScan.includes('creditor')) {
        return 'Vendor';
    }
    return 'Distributor';
};

const getLeadName = (lead) => {
    if (!lead) return '—';
    const parts = [lead.first_name, lead.last_name].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
    if (lead.company) return lead.company;
    return 'Unnamed Lead';
};

// ─── Main Component ─────────────────────────────────────────────────────────
const ConvertedOpportunities = () => {
    usePageTitle('Converted Opportunities');
    const navigate = useNavigate();

    // Data state
    const [convertedLeads, setConvertedLeads] = useState([]);
    const [loading, setLoading]               = useState(true);

    // Filter & view state
    const [search, setSearch]                                 = useState('');
    const [classificationFilter, setClassificationFilter]     = useState('ALL'); // 'ALL' | 'Distributor' | 'Vendor'
    const [priorityFilter, setPriorityFilter]                 = useState('ALL');
    const [currentPage, setCurrentPage]                       = useState(1);
    const itemsPerPage = 10;

    // Modals
    const [historyTarget, setHistoryTarget]         = useState(null);
    const [modalHistoryViewMode, setModalHistoryViewMode] = useState('detailed');

    // Opportunity Account Modal state
    const [showAccountModal, setShowAccountModal]           = useState(false);
    const [accountPrefill, setAccountPrefill]               = useState(null);
    const [selectedLeadForAccount, setSelectedLeadForAccount] = useState(null);
    const [accountGroups, setAccountGroups]                 = useState([]);
    const [createdAccountLeadIds, setCreatedAccountLeadIds] = useState(new Set());
    const [approvalStatusMap, setApprovalStatusMap]         = useState({});
    const [approvingLeadId, setApprovingLeadId]             = useState(null);

    // User context
    const currentUser = (() => {
        try {
            const u = JSON.parse(localStorage.getItem('userDetails') || '{}');
            return u?.user || u || {};
        } catch {
            return {};
        }
    })();

    const currentUserId = currentUser?.id || currentUser?.user_id || currentUser?.pk || null;

    const isAdmin = Boolean(
        currentUser?.is_superuser ||
        (currentUser?.role?.name && ['admin', 'administrator', 'super admin'].includes(currentUser.role.name.toLowerCase())) ||
        (typeof currentUser?.role === 'string' && ['admin', 'administrator', 'super admin'].includes(currentUser.role.toLowerCase())) ||
        (currentUser?.username && currentUser.username.toLowerCase().startsWith('admin'))
    );

    // Initial load
    useEffect(() => {
        fetchConvertedOpportunities();
        fetchAccountGroupsMaster();
        fetchCreatedAccountLeadIds();
        fetchApprovalStatusMap();
    }, []);

    const fetchApprovalStatusMap = async () => {
        try {
            const res = await axiosInstance.get('/api/crm_new/opportunity-approvals/status-map/');
            setApprovalStatusMap(res.data || {});
        } catch (err) {
            console.error('Error fetching approval status map:', err);
        }
    };

    const fetchCreatedAccountLeadIds = async () => {
        try {
            const res = await axiosInstance.get('/api/crm_new/opportunity-accounts/created-lead-ids/');
            const ids = res.data?.lead_ids || [];
            setCreatedAccountLeadIds(new Set(ids));
        } catch (err) {
            console.error('Error fetching created account lead ids:', err);
        }
    };

    const fetchAccountGroupsMaster = async () => {
        try {
            const res = await FinanceService.getAccountGroups();
            const groups = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (res?.results || []));
            setAccountGroups(groups);
        } catch (err) {
            console.error('Error fetching account groups master:', err);
        }
    };

    const isConvertedOpportunity = (item) => {
        if (!item) return false;
        const lastOutcome = item.last_outcome || '';
        const leadStatus = item.lead?.lead_status || '';
        const hasConvertedLog = Array.isArray(item.call_logs) && item.call_logs.some(l => l.call_outcome === 'Converted' || l.call_outcome === 'Converted to Opportunity');
        const isConverted = (
            lastOutcome === 'Converted' ||
            lastOutcome === 'Converted to Opportunity' ||
            leadStatus === 'Converted' ||
            leadStatus === 'Converted to Opportunity' ||
            hasConvertedLog
        );
        if (!isConverted) return false;

        // Admin can view all converted opportunities
        if (isAdmin) return true;

        // Telecallers can strictly ONLY see opportunities they converted
        const convLog = Array.isArray(item.call_logs) ? item.call_logs.find(l => l.call_outcome === 'Converted' || l.call_outcome === 'Converted to Opportunity') : null;
        const convertedCallerId = item.converted_by_id || convLog?.caller_id || convLog?.caller;
        if (convertedCallerId && currentUserId) {
            return String(convertedCallerId) === String(currentUserId);
        }

        const convertedByName = String(item.converted_by_name || convLog?.caller_name || '').trim().toLowerCase();
        const currentFullName = `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim().toLowerCase();
        const currentName = String(currentUser?.name || currentFullName || currentUser?.username || '').trim().toLowerCase();
        if (convertedByName && currentName) {
            return convertedByName === currentName || convertedByName.includes(currentName) || currentName.includes(convertedByName);
        }

        return false;
    };

    const fetchConvertedOpportunities = async () => {
        setLoading(true);
        try {
            const [myRes, teamRes] = await Promise.allSettled([
                axiosInstance.get('/api/crm_new/telecalling-assignments/my-leads/'),
                axiosInstance.get('/api/crm_new/telecalling-assignments/team-leads/')
            ]);

            const rawMyLeads = (myRes.status === 'fulfilled' && Array.isArray(myRes.value.data)) ? myRes.value.data : [];
            const rawTeamLeads = (teamRes.status === 'fulfilled' && Array.isArray(teamRes.value.data)) ? teamRes.value.data : [];

            // Combine both individual and team assignments into one unified pool
            const combinedMap = new Map();
            [...rawMyLeads, ...rawTeamLeads].forEach(item => {
                if (!item) return;
                const id = item.assignment_id || item.lead?.id;
                if (!id) return;

                if (isConvertedOpportunity(item)) {
                    if (!combinedMap.has(id)) {
                        combinedMap.set(id, item);
                    }
                }
            });

            setConvertedLeads(Array.from(combinedMap.values()));
            fetchApprovalStatusMap();
        } catch (err) {
            console.error('Error fetching converted opportunities:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filtered Opportunities
    const filteredOpportunities = useMemo(() => {
        return convertedLeads.filter(item => {
            const lead = item.lead || {};
            const q = search.toLowerCase().trim();

            if (q) {
                const matchSearch =
                    (lead.company || '').toLowerCase().includes(q) ||
                    (lead.first_name || '').toLowerCase().includes(q) ||
                    (lead.last_name || '').toLowerCase().includes(q) ||
                    String(lead.phone || '').includes(q) ||
                    String(lead.mobile || '').includes(q) ||
                    (lead.city || '').toLowerCase().includes(q) ||
                    (item.assigned_caller_name || '').toLowerCase().includes(q) ||
                    (item.team_name || '').toLowerCase().includes(q);
                if (!matchSearch) return false;
            }

            if (classificationFilter !== 'ALL') {
                const cls = getLeadClassification(item);
                if (cls !== classificationFilter) return false;
            }

            if (priorityFilter !== 'ALL') {
                const p = lead.priority || 'Medium';
                if (p.toLowerCase() !== priorityFilter.toLowerCase()) return false;
            }

            return true;
        });
    }, [convertedLeads, search, classificationFilter, priorityFilter]);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentOpportunities = filteredOpportunities.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredOpportunities.length / itemsPerPage);

    // ── Opportunity Account Form Modal Trigger ─────────────────────────────
    const handleOpenAccountForm = async (item, forcedClassification = null) => {
        const lead = item.lead || {};
        const leadId = lead.id || item.lead_id;

        // If an Opportunity Account has already been created, fetch it to allow editing existing details
        if (leadId && createdAccountLeadIds.has(leadId)) {
            try {
                const res = await axiosInstance.get('/api/crm_new/opportunity-accounts/', {
                    params: { lead: leadId }
                });
                const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
                if (list.length > 0) {
                    const existing = list[0];
                    setSelectedLeadForAccount(item);
                    setAccountPrefill(existing);
                    setShowAccountModal(true);
                    return;
                }
            } catch (err) {
                console.error('Error fetching existing opportunity account for editing:', err);
            }
        }

        const classification = forcedClassification || getLeadClassification(item);

        // Account Groups: ID 3 (Sundry Debtors) for Distributor, ID 12 (Sundry Creditors) for Vendor
        let targetGroupId = classification === 'Vendor' ? 12 : 3;
        const matched = accountGroups.find(g => {
            const gName = (g.name || '').toLowerCase();
            if (classification === 'Vendor') {
                return String(g.id) === '12' || gName.includes('creditor') || gName.includes('vendor') || gName.includes('supplier');
            }
            return String(g.id) === '3' || gName.includes('debtor') || gName.includes('customer');
        });
        if (matched) {
            targetGroupId = matched.id;
        }

        const leadFullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.company || '';
        const companyOrName = lead.company || leadFullName || 'New Opportunity';
        const addr1 = lead.street_address || lead.flat_house_no || '';
        const addr2 = (lead.street_address && lead.flat_house_no) ? lead.flat_house_no : '';
        const stateVal = lead.state_province || lead.state || 'Kerala';
        const countryVal = lead.country || 'India';
        const pinVal = lead.zip_postal_code || lead.pincode || '';
        const phoneVal = lead.phone || lead.mobile || '';
        const emailVal = lead.email || '';
        const websiteVal = lead.website || '';
        const faxVal = lead.fax || '';

        const prefillData = {
            id: null,
            lead: lead.id || null,
            assignment: item.assignment_id || null,
            name: companyOrName,
            mailing_name: companyOrName,
            accountGroup: targetGroupId,
            classification: classification,
            maintain_biilwise_details: true,
            address1: addr1,
            address2: addr2,
            address3: '',
            address: [addr1, addr2].filter(Boolean).join(', '),
            city: lead.city || '',
            state: stateVal,
            country: countryVal,
            pincode: pinVal,
            phone: phoneVal,
            email: emailVal,
            gst_number: '',
            pan_number: '',
            credit_limit: 0.00,
            opening_balance: 0.00,
            opening_balance_type: classification === 'Distributor' ? 'Dr' : 'Cr',
            placeofsupply: stateVal,
            registration_type: 'unknown',
            gst_details: [{
                applicable_date: '',
                registration_type: '',
                gst_number: '',
                place_of_supply: stateVal,
                gst_percentage: '',
                hsn_code: ''
            }],
            contact_details: [{
                contact_name: leadFullName || companyOrName,
                phone_no: phoneVal,
                primary_mobile: lead.mobile || lead.phone || '',
                fax_no: faxVal,
                email: emailVal,
                cc: '',
                website: websiteVal,
                whatsapp_no: lead.mobile || lead.phone || '',
                whatsapp_marketing: false
            }],
            bank_details: [{
                bank_account_no: '',
                bank_name: '',
                branch: '',
                ifsc_code: '',
                micr_code: '',
                bank_phone_no: '',
            }]
        };

        setSelectedLeadForAccount(item);
        setAccountPrefill(prefillData);
        setShowAccountModal(true);
    };

    const handleAccountSaved = (savedAccount) => {
        setShowAccountModal(false);
        const leadId = selectedLeadForAccount?.lead?.id || savedAccount?.lead;

        if (leadId) {
            setCreatedAccountLeadIds(prev => {
                const next = new Set(prev);
                next.add(leadId);
                return next;
            });
        }

        Swal.fire({
            icon: 'success',
            title: 'Opportunity Profile Saved!',
            text: `Profile for "${savedAccount?.name || 'Opportunity'}" has been successfully saved to Opportunity Accounts.`,
            confirmButtonColor: '#2563eb'
        });

        setSelectedLeadForAccount(null);
        setAccountPrefill(null);
    };

    // ── Send for Approval ───────────────────────────────────────────────────
    const handleSendForApproval = async (item) => {
        const lead = item.lead || {};
        const leadId = lead.id || item.lead_id;
        const assignmentId = item.assignment_id;
        const classification = getLeadClassification(item);
        const leadName = lead.company || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || `Lead #${leadId}`;

        const currentApproval = approvalStatusMap[String(leadId)];
        const isReSend = currentApproval?.status === 'ON_HOLD';

        const result = await Swal.fire({
            title: isReSend ? 'Re-Submit for Approval?' : 'Send for Approval?',
            html: `
                <div style="font-size: 13px; text-align: left; color: #475569;">
                    <p style="margin-bottom: 6px;">Opportunity: <strong style="color: #1e293b;">${leadName}</strong></p>
                    <p style="margin-bottom: 6px;">Classification: <strong style="color: #1e293b;">${classification} Lead</strong></p>
                    <p style="margin-bottom: 0;">This opportunity will be submitted to the <strong>Opportunity Approvals</strong> page for reviewer verification.</p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '<i class="fa fa-paper-plane me-1"></i> Send for Approval',
            confirmButtonColor: '#10b981',
            cancelButtonText: 'Cancel',
            cancelButtonColor: '#64748b'
        });

        if (!result.isConfirmed) return;

        setApprovingLeadId(leadId);
        try {
            await axiosInstance.post('/api/crm_new/opportunity-approvals/send-for-approval/', {
                lead_id: leadId,
                assignment_id: assignmentId,
                classification: classification
            });

            Swal.fire({
                icon: 'success',
                title: 'Sent for Approval!',
                text: `Opportunity "${leadName}" has been submitted to the Approvals page.`,
                timer: 2200,
                showConfirmButton: false
            });

            fetchApprovalStatusMap();
        } catch (err) {
            console.error('Error sending opportunity for approval:', err);
            Swal.fire({
                icon: 'error',
                title: 'Submission Failed',
                text: err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to submit opportunity.',
                confirmButtonColor: 'rgb(61, 53, 119)'
            });
        } finally {
            setApprovingLeadId(null);
        }
    };

    // ── History Helpers ─────────────────────────────────────────────────────
    const getConversionLog = (item) => {
        if (!item?.call_logs || item.call_logs.length === 0) return null;
        return item.call_logs.find(l => l.call_outcome === 'Converted' || l.call_outcome === 'Converted to Opportunity') || item.call_logs[0];
    };

    return (
        <>
            <style>{`
                .converted-header-container {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    flex-wrap: wrap !important;
                    gap: 15px !important;
                }
                .converted-controls-wrapper {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    flex-wrap: wrap !important;
                }
                .converted-search-bar {
                    width: 280px !important;
                    position: relative !important;
                }
                .converted-table th {
                    white-space: nowrap !important;
                }
                @media (max-width: 767px) {
                    .converted-header-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 12px !important;
                    }
                    .converted-controls-wrapper {
                        width: 100% !important;
                        justify-content: flex-start !important;
                        gap: 8px !important;
                    }
                    .converted-search-bar {
                        width: 100% !important;
                        order: 2 !important;
                        margin-top: 4px !important;
                    }
                    .converted-table {
                        min-width: 550px !important;
                    }
                }
            `}</style>

            <div className="container-fluid">
                <div className="page-titles mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <button
                        onClick={() => navigate('/crm_new/my-leads')}
                        className="btn btn-outline-primary btn-sm d-flex align-items-center"
                        style={{ gap: '6px', borderRadius: '6px' }}
                    >
                        <i className="fa fa-arrow-left"></i> Back to My Leads
                    </button>
                    <div className="d-flex align-items-center gap-2">
                        <button
                            onClick={() => navigate('/crm_new/converted-leads-report')}
                            className="btn btn-outline-success btn-sm d-flex align-items-center shadow-sm"
                            style={{ gap: '6px', borderRadius: '6px', fontWeight: 600, fontSize: '13px' }}
                            title="View Converted Leads Report"
                        >
                            <i className="fa fa-line-chart text-success"></i> Converted Leads Report
                        </button>
                        <button
                            onClick={() => navigate('/crm_new/opportunity-approvals')}
                            className="btn btn-outline-secondary btn-sm d-flex align-items-center shadow-sm"
                            style={{ gap: '6px', borderRadius: '6px', fontWeight: 600, fontSize: '13px' }}
                            title="View Opportunity Approvals Page"
                        >
                            <i className="fa fa-check-square-o text-primary"></i> Opportunity Approvals
                        </button>
                    </div>
                </div>

                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center converted-header-container">
                                <Card.Title className="mb-0">Converted Opportunities</Card.Title>
                                <div className="d-flex align-items-center gap-2 converted-controls-wrapper">
                                    <div className="converted-search-bar">
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search company, contact, city..."
                                            value={search}
                                            onChange={(e) => {
                                                setSearch(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>
                                    <Form.Select
                                        value={classificationFilter}
                                        onChange={(e) => {
                                            setClassificationFilter(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        style={{ height: '38px', width: '160px', borderRadius: '6px', fontSize: '13px' }}
                                    >
                                        <option value="ALL">All Classifications</option>
                                        <option value="Distributor">Distributor Leads</option>
                                        <option value="Vendor">Vendor Leads</option>
                                    </Form.Select>
                                    <Form.Select
                                        value={priorityFilter}
                                        onChange={(e) => {
                                            setPriorityFilter(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        style={{ height: '38px', width: '135px', borderRadius: '6px', fontSize: '13px' }}
                                    >
                                        <option value="ALL">All Priorities</option>
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </Form.Select>
                                    {(search || classificationFilter !== 'ALL' || priorityFilter !== 'ALL') && (
                                        <Button
                                            variant="outline-secondary"
                                            onClick={() => {
                                                setSearch('');
                                                setClassificationFilter('ALL');
                                                setPriorityFilter('ALL');
                                                setCurrentPage(1);
                                            }}
                                            style={{ height: '38px', borderRadius: '6px', padding: '0 12px', fontSize: '13px' }}
                                            title="Clear Filters"
                                        >
                                            <i className="fa fa-times"></i>
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline-primary"
                                        onClick={fetchConvertedOpportunities}
                                        disabled={loading}
                                        className="d-flex align-items-center justify-content-center"
                                        style={{ height: '38px', borderRadius: '6px', padding: '0 14px', fontSize: '13px' }}
                                        title="Refresh Opportunities List"
                                    >
                                        <i className={`fa fa-refresh ${loading ? 'fa-spin' : ''} me-1`}></i> Refresh
                                    </Button>
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
                                    <div className="table-responsive pb-4">
                                        <table className="table table-responsive-md converted-table">
                                            <thead>
                                                <tr>
                                                    <th><strong>Sl.No</strong></th>
                                                    <th><strong>COMPANY / LEAD</strong></th>
                                                    <th><strong>CONTACT DETAILS</strong></th>
                                                    <th><strong>LOCATION</strong></th>
                                                    <th><strong>PRIORITY</strong></th>
                                                    <th><strong>CLASSIFICATION</strong></th>
                                                    <th><strong>CONVERTED BY</strong></th>
                                                    <th><strong>STATUS</strong></th>
                                                    <th className="text-center"><strong>HISTORY</strong></th>
                                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredOpportunities.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="10" className="text-center py-4 text-muted">
                                                            No converted opportunities found
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentOpportunities.map((item, idx) => {
                                                        const lead = item.lead || {};
                                                        const leadId = lead.id || item.lead_id;
                                                        const leadName = getLeadName(lead);
                                                        const phone = lead.phone || lead.mobile;
                                                        const classification = getLeadClassification(item);
                                                        const isVendor = classification === 'Vendor';
                                                        const convLog = getConversionLog(item);
                                                        const isAccountCreated = Boolean(leadId && (createdAccountLeadIds instanceof Set ? createdAccountLeadIds.has(leadId) : (Array.isArray(createdAccountLeadIds) && createdAccountLeadIds.includes(leadId))));

                                                        return (
                                                            <tr key={item.assignment_id || `lead_${leadId || idx}`}>
                                                                <td>{indexOfFirstItem + idx + 1}</td>
                                                                <td>
                                                                    <div className="d-flex flex-column">
                                                                        <strong>{lead.company || leadName}</strong>
                                                                        {lead.company && leadName && lead.company !== leadName && (
                                                                            <span className="text-muted" style={{ fontSize: '12px' }}>
                                                                                {leadName}
                                                                            </span>
                                                                        )}
                                                                        <div className="d-flex align-items-center gap-1 mt-1 flex-wrap">
                                                                            {(item.lead_source || lead.lead_source_name) && (
                                                                                <span
                                                                                    className="badge"
                                                                                    style={{
                                                                                        fontSize: '10.5px',
                                                                                        fontWeight: 600,
                                                                                        backgroundColor: isVendor ? '#f3e8ff' : '#eff6ff',
                                                                                        color: isVendor ? '#7c3aed' : '#2563eb',
                                                                                        border: `1px solid ${isVendor ? '#ddd6fe' : '#bfdbfe'}`,
                                                                                        borderRadius: '4px',
                                                                                        padding: '2px 7px'
                                                                                    }}
                                                                                >
                                                                                    {item.lead_source || lead.lead_source_name}
                                                                                </span>
                                                                            )}
                                                                            {lead.category_name && lead.category_name !== item.lead_source && (
                                                                                <span
                                                                                    className="badge"
                                                                                    style={{
                                                                                        fontSize: '10px',
                                                                                        backgroundColor: '#f1f5f9',
                                                                                        color: '#475569',
                                                                                        border: '1px solid #cbd5e1',
                                                                                        borderRadius: '4px',
                                                                                        padding: '2px 6px'
                                                                                    }}
                                                                                >
                                                                                    {lead.category_name}
                                                                                </span>
                                                                            )}
                                                                            {item.team_name && (
                                                                                <span
                                                                                    className="badge"
                                                                                    style={{
                                                                                        fontSize: '10px',
                                                                                        backgroundColor: '#f8fafc',
                                                                                        color: '#0284c7',
                                                                                        border: '1px solid #bae6fd',
                                                                                        borderRadius: '4px',
                                                                                        padding: '2px 6px'
                                                                                    }}
                                                                                >
                                                                                    <i className="fa fa-users me-1"></i>{item.team_name}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <div className="d-flex flex-column gap-1">
                                                                        {phone ? (
                                                                            <div className="d-flex align-items-center gap-2">
                                                                                <a
                                                                                    href={`tel:${phone}`}
                                                                                    className="font-w600 text-success text-decoration-none d-inline-flex align-items-center gap-1"
                                                                                    style={{ fontSize: '13px' }}
                                                                                >
                                                                                    <i className="fa fa-phone" style={{ fontSize: '11px' }}></i>
                                                                                    {phone}
                                                                                </a>
                                                                                <a
                                                                                    href={`https://wa.me/${String(phone || '').replace(/[^0-9]/g, '')}`}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="text-success text-decoration-none"
                                                                                    title="Open WhatsApp chat"
                                                                                    style={{ fontSize: '13px' }}
                                                                                >
                                                                                    <i className="fa fa-whatsapp"></i>
                                                                                </a>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-muted" style={{ fontSize: '12px' }}>—</span>
                                                                        )}
                                                                        {lead.email && (
                                                                            <a
                                                                                href={`mailto:${lead.email}`}
                                                                                className="text-muted text-decoration-none text-truncate"
                                                                                style={{ fontSize: '11px', maxWidth: '170px' }}
                                                                                title={lead.email}
                                                                            >
                                                                                {lead.email}
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <div style={{ fontSize: '12.5px' }}>
                                                                        <div className="text-dark font-w500">
                                                                            {lead.city || '—'}
                                                                        </div>
                                                                        {(lead.state_province || lead.country) && (
                                                                            <div className="text-muted" style={{ fontSize: '11px' }}>
                                                                                {[lead.state_province, lead.country].filter(Boolean).join(', ')}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <span
                                                                        className={`badge ${getPriorityBadgeClass(lead.priority || 'Medium')}`}
                                                                        style={{
                                                                            borderRadius: '6px',
                                                                            fontSize: '11.5px',
                                                                            fontWeight: 600,
                                                                            padding: '4px 10px'
                                                                        }}
                                                                    >
                                                                        {lead.priority || 'Medium'}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <span
                                                                        className="badge"
                                                                        style={{
                                                                            borderRadius: '6px',
                                                                            fontSize: '11.5px',
                                                                            fontWeight: 600,
                                                                            padding: '4px 10px',
                                                                            backgroundColor: isVendor ? '#f3e8ff' : '#eff6ff',
                                                                            color: isVendor ? '#7c3aed' : '#2563eb',
                                                                            border: `1px solid ${isVendor ? '#ddd6fe' : '#bfdbfe'}`
                                                                        }}
                                                                    >
                                                                        <i className={`fa ${isVendor ? 'fa-truck' : 'fa-id-card-o'} me-1`}></i>
                                                                        {classification} Lead
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <div style={{ fontSize: '12px' }}>
                                                                        <span className="badge bg-light text-dark font-w600" style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                                                                            <i className="fa fa-user text-success me-1"></i>
                                                                            {item.converted_by_name || convLog?.caller_name || item.assigned_caller_name || 'Telecaller'}
                                                                        </span>
                                                                        {(item.converted_at || convLog?.called_at) && (
                                                                            <div className="text-muted mt-1" style={{ fontSize: '10.5px' }}>
                                                                                {formatDate(item.converted_at || convLog?.called_at)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <span
                                                                        className={`badge ${getOutcomeBadgeClass('Converted')}`}
                                                                        style={{
                                                                            borderRadius: '6px',
                                                                            fontSize: '11.5px',
                                                                            fontWeight: 600,
                                                                            padding: '4px 10px'
                                                                        }}
                                                                    >
                                                                        <i className="fa fa-trophy me-1"></i> Converted
                                                                    </span>
                                                                </td>
                                                                <td className="text-center">
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-secondary"
                                                                        onClick={() => setHistoryTarget(item)}
                                                                        style={{ borderRadius: '6px', fontSize: '12px', padding: '4px 8px', border: '1px solid #cbd5e1' }}
                                                                        title={`View Interaction History (${item.call_logs?.length || 0} calls)`}
                                                                    >
                                                                        <i className="fa fa-history text-primary"></i>
                                                                    </button>
                                                                </td>
                                                                <td className="text-end">
                                                                    <div className="d-flex align-items-center justify-content-end gap-1.5 flex-wrap">
                                                                        {(() => {
                                                                            const approvalInfo = (approvalStatusMap || {})[String(leadId)];
                                                                            const isApproving = approvingLeadId === leadId;
                                                                            const isApprovedOrPending = approvalInfo?.status === 'PENDING' || approvalInfo?.status === 'ACCEPTED';
                                                                            const canEditAccount = !isApprovedOrPending;

                                                                            return (
                                                                                <>
                                                                                    {/* Opportunity Profile Form Action: Details / Profile Created + EditButton */}
                                                                                    {isAccountCreated ? (
                                                                                        <>
                                                                                            <span
                                                                                                className="badge bg-success-light text-success font-w600"
                                                                                                style={{
                                                                                                    fontSize: '11.5px',
                                                                                                    padding: '6px 12px',
                                                                                                    borderRadius: '6px',
                                                                                                    border: '1px solid #a7f3d0'
                                                                                                }}
                                                                                                title="Opportunity Profile Created"
                                                                                            >
                                                                                                <i className="fa fa-check me-1"></i> Profile Created
                                                                                            </span>
                                                                                            {canEditAccount && (
                                                                                                <EditButton
                                                                                                    onClick={() => handleOpenAccountForm(item)}
                                                                                                    title="Edit Opportunity Details"
                                                                                                />
                                                                                            )}
                                                                                        </>
                                                                                    ) : (
                                                                                        <button
                                                                                            type="button"
                                                                                            className="btn btn-sm text-white d-inline-flex align-items-center gap-1.5 shadow-sm"
                                                                                            onClick={() => handleOpenAccountForm(item)}
                                                                                            style={{
                                                                                                height: '32px',
                                                                                                borderRadius: '6px',
                                                                                                fontSize: '12px',
                                                                                                fontWeight: 600,
                                                                                                padding: '0 12px',
                                                                                                backgroundColor: 'rgb(61, 53, 119)',
                                                                                                borderColor: 'rgb(61, 53, 119)',
                                                                                                whiteSpace: 'nowrap'
                                                                                            }}
                                                                                            title="Opportunity Details — Click to fill Opportunity Profile"
                                                                                        >
                                                                                            <i className="fa fa-plus me-1"></i> Details
                                                                                        </button>
                                                                                    )}

                                                                                    {/* Approval Status & Workflow Action */}
                                                                                    {approvalInfo?.status === 'PENDING' && (
                                                                                        <span
                                                                                            className="badge d-inline-flex align-items-center gap-1 font-w600 shadow-sm"
                                                                                            style={{
                                                                                                height: '32px',
                                                                                                borderRadius: '6px',
                                                                                                fontSize: '11.5px',
                                                                                                padding: '0 10px',
                                                                                                backgroundColor: '#fef3c7',
                                                                                                color: '#b45309',
                                                                                                border: '1px solid #fde68a',
                                                                                                whiteSpace: 'nowrap'
                                                                                            }}
                                                                                            title={`Sent for approval on ${formatDateTime(approvalInfo.submitted_at)}. Awaiting review.`}
                                                                                        >
                                                                                            <i className="fa fa-clock-o"></i> Pending Approval
                                                                                        </span>
                                                                                    )}

                                                                                    {approvalInfo?.status === 'ACCEPTED' && (
                                                                                        <span
                                                                                            className="badge d-inline-flex align-items-center gap-1 font-w600 shadow-sm"
                                                                                            style={{
                                                                                                height: '32px',
                                                                                                borderRadius: '6px',
                                                                                                fontSize: '11.5px',
                                                                                                padding: '0 10px',
                                                                                                backgroundColor: '#d1fae5',
                                                                                                color: '#047857',
                                                                                                border: '1px solid #a7f3d0',
                                                                                                whiteSpace: 'nowrap'
                                                                                            }}
                                                                                            title="Opportunity has been accepted and approved!"
                                                                                        >
                                                                                            <i className="fa fa-check-circle"></i> Accepted
                                                                                        </span>
                                                                                    )}

                                                                                    {approvalInfo?.status === 'ON_HOLD' && (
                                                                                        <button
                                                                                            type="button"
                                                                                            className="btn btn-sm btn-outline-warning d-inline-flex align-items-center gap-1 shadow-sm"
                                                                                            onClick={() => handleSendForApproval(item)}
                                                                                            disabled={isApproving}
                                                                                            style={{
                                                                                                height: '32px',
                                                                                                borderRadius: '6px',
                                                                                                fontSize: '11.5px',
                                                                                                fontWeight: 600,
                                                                                                padding: '0 10px',
                                                                                                whiteSpace: 'nowrap'
                                                                                            }}
                                                                                            title={`Put On Hold: "${approvalInfo.remarks || 'No remarks'}". Click to re-submit for approval.`}
                                                                                        >
                                                                                            <i className={`fa ${isApproving ? 'fa-spinner fa-spin' : 'fa-refresh'}`}></i> On Hold (Re-send)
                                                                                        </button>
                                                                                    )}

                                                                                    {(!approvalInfo?.status || (approvalInfo.status !== 'PENDING' && approvalInfo.status !== 'ACCEPTED' && approvalInfo.status !== 'ON_HOLD')) && (
                                                                                        <button
                                                                                            type="button"
                                                                                            className="btn btn-sm text-white d-inline-flex align-items-center gap-1 shadow-sm"
                                                                                            onClick={() => handleSendForApproval(item)}
                                                                                            disabled={isApproving}
                                                                                            style={{
                                                                                                height: '32px',
                                                                                                borderRadius: '6px',
                                                                                                fontSize: '12px',
                                                                                                fontWeight: 600,
                                                                                                padding: '0 12px',
                                                                                                backgroundColor: '#10b981',
                                                                                                borderColor: '#10b981',
                                                                                                whiteSpace: 'nowrap'
                                                                                            }}
                                                                                            title="Send this converted opportunity for approval"
                                                                                        >
                                                                                            <i className={`fa ${isApproving ? 'fa-spinner fa-spin' : 'fa-check'}`}></i> Approve
                                                                                        </button>
                                                                                    )}
                                                                                </>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                        {filteredOpportunities.length > 0 && (
                                            <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                                <div className="text-muted" style={{ fontSize: '13px' }}>
                                                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredOpportunities.length)} of {filteredOpportunities.length} entries
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
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </div>
                </div>
            </div>

            {/* ── 3. Call History Modal ── */}
            <Modal
                show={!!historyTarget}
                onHide={() => setHistoryTarget(null)}
                size="lg"
                centered
            >
                <Modal.Header closeButton style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                    <div className="d-flex align-items-center justify-content-between w-100 me-3">
                        <Modal.Title style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                            <i className="fa fa-history text-primary me-2"></i>
                            Call History - {getLeadName(historyTarget?.lead || {})}
                        </Modal.Title>
                        {historyTarget?.call_logs && historyTarget.call_logs.length > 0 && (
                            <div className="btn-group btn-group-sm" role="group">
                                <button
                                    type="button"
                                    className={`btn ${modalHistoryViewMode === 'detailed' ? 'btn-primary' : 'btn-outline-primary'}`}
                                    onClick={() => setModalHistoryViewMode('detailed')}
                                    style={{ fontSize: '11px', padding: '2px 8px' }}
                                >
                                    Detailed
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${modalHistoryViewMode === 'summary' ? 'btn-primary' : 'btn-outline-primary'}`}
                                    onClick={() => setModalHistoryViewMode('summary')}
                                    style={{ fontSize: '11px', padding: '2px 8px' }}
                                >
                                    Summary
                                </button>
                            </div>
                        )}
                    </div>
                </Modal.Header>
                <Modal.Body style={{ padding: '20px', maxHeight: '550px', overflowY: 'auto' }}>
                    {historyTarget?.lead?.company && (
                        <div className="mb-3 p-2 bg-light rounded d-flex justify-content-between align-items-center" style={{ fontSize: '12px' }}>
                            <span>
                                <strong>Company:</strong> {historyTarget.lead.company} • <strong>Contact:</strong> {historyTarget.lead.phone || historyTarget.lead.mobile || '—'}
                            </span>
                            <span className="badge bg-secondary">Total: {historyTarget.call_logs?.length || 0} calls</span>
                        </div>
                    )}

                    {!historyTarget?.call_logs || historyTarget.call_logs.length === 0 ? (
                        <div className="text-center py-4 text-muted">
                            <i className="fa fa-phone-slash fa-2x mb-2 text-secondary"></i>
                            <p className="mb-0" style={{ fontSize: '13px' }}>No interaction logs recorded for this lead yet.</p>
                        </div>
                    ) : (
                        <div className="d-flex flex-column gap-3">
                            {historyTarget.call_logs.map((log) => {
                                const outcomeInfo = OUTCOME_META[log.call_outcome] || { label: log.call_outcome, badgeClass: 'badge-secondary light' };
                                return (
                                    <div
                                        key={log.id}
                                        className="p-3 rounded"
                                        style={{
                                            border: '1px solid #e2e8f0',
                                            backgroundColor: '#f8fafc',
                                            borderLeft: `4px solid ${outcomeInfo.color || '#2563eb'}`
                                        }}
                                    >
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <span className={`badge ${outcomeInfo.badgeClass}`} style={{ borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                                                {outcomeInfo.label}
                                            </span>
                                            <span className="text-muted" style={{ fontSize: '11px' }}>
                                                {formatDateTime(log.called_at)}
                                            </span>
                                        </div>
                                        <div className="mt-2 text-dark font-w500" style={{ fontSize: '12.5px', whiteSpace: 'pre-wrap' }}>
                                            {log.notes || 'No discussion remarks recorded.'}
                                        </div>
                                        <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top" style={{ fontSize: '11px', color: '#64748b' }}>
                                            <span>
                                                <i className="fa fa-user me-1"></i> Called by: <strong>{log.caller_name || 'Telecaller'}</strong>
                                            </span>
                                            {log.duration_display && (
                                                <span>
                                                    <i className="fa fa-clock-o me-1"></i> Duration: <strong>{log.duration_display}</strong>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer style={{ borderTop: '1px solid #e2e8f0' }}>
                    <Button variant="light" size="sm" onClick={() => setHistoryTarget(null)} style={{ borderRadius: '6px' }}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* ── 4. Converted Opportunity Profile Creation Modal ── */}
            {showAccountModal && (
                <OpportunityAccountModal
                    show={showAccountModal}
                    onHide={() => {
                        setShowAccountModal(false);
                        setAccountPrefill(null);
                        setSelectedLeadForAccount(null);
                    }}
                    accountToEdit={accountPrefill}
                    accountGroups={accountGroups}
                    classification={selectedLeadForAccount ? getLeadClassification(selectedLeadForAccount) : 'Distributor'}
                    onSave={handleAccountSaved}
                />
            )}
        </>
    );
};

// ── Error Boundary Component to guarantee no blank screen crashes ────────────
class ConvertedOpportunitiesErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error("ConvertedOpportunities error caught:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="container-fluid p-4">
                    <div className="card shadow-sm border-0 p-4 text-center">
                        <div className="mb-3">
                            <i className="fa fa-exclamation-triangle text-warning" style={{ fontSize: '42px' }}></i>
                        </div>
                        <h4 className="text-dark fw-bold mb-2">Unable to display Converted Opportunities</h4>
                        <p className="text-muted mb-3" style={{ fontSize: '13px' }}>
                            {this.state.error?.message || "An unexpected error occurred while loading this view."}
                        </p>
                        <div>
                            <button className="btn btn-primary btn-sm px-3" onClick={() => window.location.reload()}>
                                <i className="fa fa-refresh me-1"></i> Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

const ConvertedOpportunitiesWrapper = () => (
    <ConvertedOpportunitiesErrorBoundary>
        <ConvertedOpportunities />
    </ConvertedOpportunitiesErrorBoundary>
);

export default ConvertedOpportunitiesWrapper;

