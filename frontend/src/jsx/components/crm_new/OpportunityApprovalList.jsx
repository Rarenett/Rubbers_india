import React, { useState, useEffect, useMemo } from 'react';
import { Card, Table, Badge, Button, Form, Modal } from 'react-bootstrap';
import axiosInstance from '../../../services/AxiosInstance';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '../../../context/TitleContext';
import OpportunityAccountModal from './OpportunityAccountModal';
import * as FinanceService from '../../../services/FinanceService';

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

const OpportunityApprovalList = () => {
    usePageTitle('Opportunity Approvals');
    const navigate = useNavigate();

    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [accountGroups, setAccountGroups] = useState([]);

    // Filters
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'ACCEPTED' | 'ON_HOLD'
    const [classificationFilter, setClassificationFilter] = useState('ALL');
    const [search, setSearch] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // View Details Modal State
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [accountModalData, setAccountModalData] = useState(null);

    const fetchApprovals = async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/api/crm_new/opportunity-approvals/');
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setApprovals(data);
        } catch (err) {
            console.error('Error fetching opportunity approvals:', err);
            Swal.fire({
                icon: 'error',
                title: 'Failed to load approvals',
                text: err.response?.data?.detail || err.message || 'Something went wrong',
                confirmButtonColor: '#0a500f'
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchAccountGroups = async () => {
        try {
            const res = await FinanceService.getAccountGroups();
            const groups = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (res?.results || []));
            setAccountGroups(groups);
        } catch (err) {
            console.error('Error fetching account groups in OpportunityApprovalList:', err);
        }
    };

    useEffect(() => {
        fetchApprovals();
        fetchAccountGroups();
    }, []);

    // Counts for dropdown labels
    const counts = useMemo(() => {
        const total = approvals.length;
        const pending = approvals.filter(a => a.status === 'PENDING').length;
        const accepted = approvals.filter(a => a.status === 'ACCEPTED').length;
        const onHold = approvals.filter(a => a.status === 'ON_HOLD').length;
        return { total, pending, accepted, onHold };
    }, [approvals]);

    // Filtered data
    const filteredApprovals = useMemo(() => {
        return approvals.filter(item => {
            // Status
            if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;

            // Classification
            if (classificationFilter !== 'ALL' && (item.classification || '').toLowerCase() !== classificationFilter.toLowerCase()) return false;

            // Search
            if (search.trim()) {
                const q = search.toLowerCase().trim();
                const leadName = (item.lead_name || '').toLowerCase();
                const company = (item.company || '').toLowerCase();
                const phone = (item.phone || '').toLowerCase();
                const email = (item.email || '').toLowerCase();
                const convBy = (item.converted_by_name || '').toLowerCase();
                const subBy = (item.submitted_by_name || '').toLowerCase();
                return leadName.includes(q) || company.includes(q) || phone.includes(q) || email.includes(q) || convBy.includes(q) || subBy.includes(q);
            }
            return true;
        });
    }, [approvals, statusFilter, classificationFilter, search]);

    const totalPages = Math.ceil(filteredApprovals.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentApprovals = filteredApprovals.slice(indexOfFirstItem, indexOfLastItem);

    // Handle Approver Action: Accept or On Hold
    const handleAction = async (approval, actionType) => {
        const isAccept = actionType === 'ACCEPT';
        const leadName = approval.lead_name || approval.company || (approval.lead_id ? `Lead #${approval.lead_id}` : 'Opportunity');

        const { value: formValues } = await Swal.fire({
            title: isAccept ? 'Accept Opportunity' : 'Put Opportunity On Hold',
            html: `
                <div style="text-align: left; font-size: 13px; color: #475569;">
                    <p style="margin-bottom: 8px;">
                        <strong>Opportunity:</strong> <span style="color: #1e293b;">${leadName}</span>
                    </p>
                    <p style="margin-bottom: ${isAccept ? '0' : '12px'};">
                        <strong>Action:</strong> <span style="color: ${isAccept ? '#16a34a' : '#d97706'}; font-weight: 600;">
                            ${isAccept ? 'Accept & Mark Approved' : 'Put On Hold'}
                        </span>
                    </p>
                    ${!isAccept ? `
                        <label style="font-weight: 600; font-size: 12px; margin-bottom: 4px; display: block;">
                            Reason / Remarks (Required for On Hold):
                        </label>
                        <textarea 
                            id="swal-remarks-input" 
                            class="swal2-textarea" 
                            style="width: 100%; margin: 0; font-size: 13px; height: 80px; box-sizing: border-box;" 
                            placeholder="e.g., Awaiting tax registration certificate from client"
                        ></textarea>
                    ` : ''}
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: isAccept ? '<i class="fa fa-check me-1"></i> Accept' : '<i class="fa fa-pause me-1"></i> Put On Hold',
            confirmButtonColor: isAccept ? '#10b981' : '#f59e0b',
            cancelButtonText: 'Cancel',
            cancelButtonColor: '#64748b',
            preConfirm: () => {
                const remarksInput = document.getElementById('swal-remarks-input');
                const remarks = remarksInput ? remarksInput.value.trim() : '';
                if (!isAccept && !remarks) {
                    Swal.showValidationMessage('Please provide a reason or remarks for putting this opportunity on hold.');
                    return false;
                }
                return { remarks };
            }
        });

        if (!formValues) return;

        setActionLoadingId(approval.id);
        try {
            await axiosInstance.post(`/api/crm_new/opportunity-approvals/${approval.id}/action/`, {
                action: actionType,
                remarks: formValues.remarks
            });

            Swal.fire({
                icon: 'success',
                title: isAccept ? 'Accepted!' : 'Put On Hold',
                text: `Opportunity "${leadName}" has been ${isAccept ? 'accepted successfully' : 'put on hold'}.`,
                timer: 2000,
                showConfirmButton: false
            });

            fetchApprovals();
        } catch (err) {
            console.error('Error submitting action:', err);
            Swal.fire({
                icon: 'error',
                title: 'Action Failed',
                text: err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to update approval status.',
                confirmButtonColor: '#0a500f'
            });
        } finally {
            setActionLoadingId(null);
        }
    };

    // Open Opportunity Account details modal for inspection & editing
    const handleViewAccount = async (item) => {
        try {
            let accData = null;
            const oppAccId = item.opportunity_account_id || item.opportunity_account;
            if (oppAccId) {
                const res = await axiosInstance.get(`/api/crm_new/opportunity-accounts/${oppAccId}/`);
                accData = res.data;
            } else if (item.lead || item.lead_id) {
                const leadId = item.lead || item.lead_id;
                try {
                    const res = await axiosInstance.get('/api/crm_new/opportunity-accounts/', {
                        params: { lead: leadId }
                    });
                    const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
                    if (list.length > 0) {
                        accData = list[0];
                    }
                } catch (e) {
                    console.warn('Could not query opportunity account by lead:', e);
                }
            }

            if (!accData) {
                const classification = item.classification || 'Distributor';
                let targetGroupId = classification === 'Vendor' ? 12 : 3;
                if (accountGroups && accountGroups.length > 0) {
                    const matched = accountGroups.find(g => {
                        const gName = (g.name || '').toLowerCase();
                        if (classification === 'Vendor') {
                            return String(g.id) === '12' || gName.includes('creditor') || gName.includes('vendor') || gName.includes('supplier');
                        }
                        return String(g.id) === '3' || gName.includes('debtor') || gName.includes('customer');
                    });
                    if (matched) targetGroupId = matched.id;
                }

                accData = {
                    id: null,
                    lead: item.lead || item.lead_id,
                    assignment: item.assignment || item.assignment_id || null,
                    name: item.company || item.lead_name || '',
                    mailing_name: item.company || item.lead_name || '',
                    classification: classification,
                    phone: item.phone || '',
                    email: item.email || '',
                    city: item.city || '',
                    state: item.state || 'Kerala',
                    country: 'India',
                    accountGroup: targetGroupId,
                    maintain_biilwise_details: true,
                    opening_balance: 0.00,
                    credit_limit: 0.00,
                    opening_balance_type: classification === 'Vendor' ? 'Cr' : 'Dr',
                    placeofsupply: item.state || 'Kerala',
                    registration_type: 'unknown',
                    gst_details: [],
                    contact_details: [{
                        contact_name: item.company || item.lead_name || '',
                        phone_no: item.phone || '',
                        primary_mobile: item.phone || '',
                        email: item.email || ''
                    }],
                    bank_details: []
                };
            }

            setAccountModalData(accData);
            setShowAccountModal(true);
        } catch (err) {
            console.error('Error fetching account data:', err);
            Swal.fire({
                icon: 'info',
                title: 'Opportunity Summary',
                html: `
                    <div style="text-align: left; font-size: 13px;">
                        <p><strong>Company:</strong> ${item.company || item.lead_name}</p>
                        <p><strong>Phone:</strong> ${item.phone || '—'}</p>
                        <p><strong>Email:</strong> ${item.email || '—'}</p>
                        <p><strong>Classification:</strong> ${item.classification}</p>
                        <p><strong>Status:</strong> ${item.status}</p>
                    </div>
                `,
                confirmButtonColor: '#0a500f'
            });
        }
    };

    return (
        <>
            <style>{`
                .opp-approval-header-container {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    flex-wrap: wrap !important;
                    gap: 15px !important;
                }
                .opp-approval-controls-wrapper {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    flex-wrap: wrap !important;
                }
                .opp-approval-search-bar {
                    width: 260px !important;
                    position: relative !important;
                }
                .opp-approval-table th {
                    white-space: nowrap !important;
                }
                @media (max-width: 767px) {
                    .opp-approval-header-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 12px !important;
                    }
                    .opp-approval-controls-wrapper {
                        width: 100% !important;
                        justify-content: flex-start !important;
                        gap: 8px !important;
                    }
                    .opp-approval-search-bar {
                        width: 100% !important;
                        order: 2 !important;
                        margin-top: 4px !important;
                    }
                    .opp-approval-table {
                        min-width: 600px !important;
                    }
                }
            `}</style>

            <div className="container-fluid">
                {/* Standard Page Titles */}
                <div className="page-titles mb-3">
                    <button
                        onClick={() => navigate('/crm_new/converted-opportunities')}
                        className="btn btn-outline-primary btn-sm d-flex align-items-center"
                        style={{ gap: '6px', borderRadius: '6px' }}
                    >
                        <i className="fa fa-arrow-left"></i> Back to Converted Opportunities
                    </button>
                </div>

                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex justify-content-between align-items-center opp-approval-header-container">
                                <Card.Title className="mb-0">Opportunity Approvals</Card.Title>
                                <div className="d-flex align-items-center gap-2 opp-approval-controls-wrapper">
                                    {/* Search Input */}
                                    <div className="opp-approval-search-bar">
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search opportunity, company..."
                                            value={search}
                                            onChange={(e) => {
                                                setSearch(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>

                                    {/* Status Filter */}
                                    <Form.Select
                                        value={statusFilter}
                                        onChange={(e) => {
                                            setStatusFilter(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        style={{ height: '38px', width: '170px', borderRadius: '6px', fontSize: '13px' }}
                                    >
                                        <option value="ALL">All Statuses ({counts.total})</option>
                                        <option value="PENDING">Pending ({counts.pending})</option>
                                        <option value="ACCEPTED">Accepted ({counts.accepted})</option>
                                        <option value="ON_HOLD">On Hold ({counts.onHold})</option>
                                    </Form.Select>

                                    {/* Classification Filter */}
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

                                    {/* Clear Filters */}
                                    {(search || statusFilter !== 'ALL' || classificationFilter !== 'ALL') && (
                                        <Button
                                            variant="outline-secondary"
                                            onClick={() => {
                                                setSearch('');
                                                setStatusFilter('ALL');
                                                setClassificationFilter('ALL');
                                                setCurrentPage(1);
                                            }}
                                            style={{ height: '38px', borderRadius: '6px', padding: '0 12px', fontSize: '13px' }}
                                            title="Clear Filters"
                                        >
                                            <i className="fa fa-times"></i>
                                        </Button>
                                    )}

                                    {/* Refresh Button */}
                                    <Button
                                        variant="outline-primary"
                                        onClick={fetchApprovals}
                                        disabled={loading}
                                        className="d-flex align-items-center justify-content-center"
                                        style={{ height: '38px', borderRadius: '6px', padding: '0 14px', fontSize: '13px' }}
                                        title="Refresh Approvals List"
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
                                        <table className="table table-responsive-md opp-approval-table">
                                            <thead>
                                                <tr>
                                                    <th><strong>Sl.No</strong></th>
                                                    <th><strong>COMPANY / LEAD</strong></th>
                                                    <th><strong>CONTACT DETAILS</strong></th>
                                                    <th><strong>LOCATION</strong></th>
                                                    <th><strong>CLASSIFICATION</strong></th>
                                                    <th><strong>CONVERTED BY</strong></th>
                                                    <th><strong>STATUS</strong></th>
                                                    <th><strong>DECISION & REMARKS</strong></th>
                                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredApprovals.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="9" className="text-center py-4 text-muted">
                                                            No approval requests found
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentApprovals.map((item, idx) => {
                                                        const isVendor = (item.classification || '').toLowerCase() === 'vendor';
                                                        const isActioning = actionLoadingId === item.id;
                                                        const phone = item.phone || '';

                                                        return (
                                                            <tr key={item.id}>
                                                                <td>{indexOfFirstItem + idx + 1}</td>
                                                                <td>
                                                                    <div className="d-flex flex-column">
                                                                        <strong>{item.company || item.lead_name}</strong>
                                                                        {item.company && item.lead_name && item.company !== item.lead_name && (
                                                                            <span className="text-muted" style={{ fontSize: '12px' }}>
                                                                                {item.lead_name}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <div className="d-flex flex-column" style={{ fontSize: '13px' }}>
                                                                        {phone ? (
                                                                            <div className="d-flex align-items-center gap-1.5">
                                                                                <a
                                                                                    href={`tel:${phone}`}
                                                                                    className="text-success font-w600 text-decoration-none"
                                                                                    style={{ fontSize: '12.5px' }}
                                                                                    title="Click to Call"
                                                                                >
                                                                                    <i className="fa fa-phone me-1"></i>
                                                                                    {phone}
                                                                                </a>
                                                                                <a
                                                                                    href={`https://wa.me/${String(phone || '').replace(/[^0-9]/g, '')}`}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="text-success text-decoration-none ms-1"
                                                                                    title="Open WhatsApp chat"
                                                                                    style={{ fontSize: '13px' }}
                                                                                >
                                                                                    <i className="fa fa-whatsapp"></i>
                                                                                </a>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-muted" style={{ fontSize: '12px' }}>—</span>
                                                                        )}
                                                                        {item.email && (
                                                                            <a
                                                                                href={`mailto:${item.email}`}
                                                                                className="text-muted text-decoration-none text-truncate"
                                                                                style={{ fontSize: '11px', maxWidth: '170px' }}
                                                                                title={item.email}
                                                                            >
                                                                                {item.email}
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <div style={{ fontSize: '12.5px' }}>
                                                                        <div className="text-dark font-w500">
                                                                            {item.city || '—'}
                                                                        </div>
                                                                        {item.state && (
                                                                            <div className="text-muted" style={{ fontSize: '11px' }}>
                                                                                {item.state}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <span
                                                                        className="badge"
                                                                        style={{
                                                                            borderRadius: '6px',
                                                                            fontSize: '11px',
                                                                            fontWeight: 600,
                                                                            padding: '4px 8px',
                                                                            backgroundColor: isVendor ? '#864AD1' : '#0a500f',
                                                                            color: '#ffffff'
                                                                        }}
                                                                    >
                                                                        <i className={`fa ${isVendor ? 'fa-truck' : 'fa-id-card-o'} me-1`}></i>
                                                                        {isVendor ? 'Vendor Lead' : 'Distributor Lead'}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <div className="d-flex flex-column" style={{ fontSize: '12px' }}>
                                                                        <span className="text-dark font-w600">
                                                                            <i className="fa fa-user me-1 text-primary"></i>
                                                                            {item.converted_by_name || '—'}
                                                                        </span>
                                                                        <span className="text-muted" style={{ fontSize: '11px' }}>
                                                                            {formatDate(item.converted_at)}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    {item.status === 'ACCEPTED' ? (
                                                                        <span className="badge light badge-success">Accepted</span>
                                                                    ) : item.status === 'ON_HOLD' ? (
                                                                        <span className="badge light badge-danger">On Hold</span>
                                                                    ) : (
                                                                        <span className="badge light badge-warning">Pending Approval</span>
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    <div className="d-flex flex-column" style={{ fontSize: '12px' }}>
                                                                        {item.action_by_name ? (
                                                                            <>
                                                                                <span className="text-dark font-w500">
                                                                                    By: <strong>{item.action_by_name}</strong>
                                                                                </span>
                                                                                <span className="text-muted" style={{ fontSize: '11px' }}>
                                                                                    {formatDate(item.action_at)}
                                                                                </span>
                                                                            </>
                                                                        ) : (
                                                                            <span className="text-muted fst-italic">Awaiting decision</span>
                                                                        )}
                                                                        {item.remarks && (
                                                                            <div
                                                                                className="text-truncate mt-1 text-muted"
                                                                                style={{ maxWidth: '180px', fontSize: '11px' }}
                                                                                title={item.remarks}
                                                                            >
                                                                                "{item.remarks}"
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="text-end">
                                                                    <div className="d-flex align-items-center justify-content-end gap-1.5 flex-wrap">
                                                                        {item.status !== 'ACCEPTED' && (
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-sm btn-success d-inline-flex align-items-center gap-1 shadow-sm text-white"
                                                                                disabled={isActioning}
                                                                                onClick={() => handleAction(item, 'ACCEPT')}
                                                                                style={{ height: '32px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, padding: '0 10px', whiteSpace: 'nowrap' }}
                                                                                title="Accept Opportunity"
                                                                            >
                                                                                <i className="fa fa-check"></i> Accept
                                                                            </button>
                                                                        )}

                                                                        {item.status !== 'ON_HOLD' && (
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-sm text-white d-inline-flex align-items-center gap-1 shadow-sm"
                                                                                disabled={isActioning}
                                                                                onClick={() => handleAction(item, 'ON_HOLD')}
                                                                                style={{ height: '32px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, padding: '0 10px', backgroundColor: '#f59e0b', borderColor: '#f59e0b', whiteSpace: 'nowrap' }}
                                                                                title="Put Opportunity On Hold"
                                                                            >
                                                                                <i className="fa fa-pause"></i> On Hold
                                                                            </button>
                                                                        )}

                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-sm btn-outline-info shadow-sm"
                                                                            onClick={() => handleViewAccount(item)}
                                                                            style={{
                                                                                height: '32px',
                                                                                width: '32px',
                                                                                borderRadius: '6px',
                                                                                padding: 0,
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center'
                                                                            }}
                                                                            title="View Details"
                                                                        >
                                                                            <i className="fa fa-eye"></i>
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>

                                        {filteredApprovals.length > 0 && (
                                            <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                                <div className="text-muted" style={{ fontSize: '13px' }}>
                                                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredApprovals.length)} of {filteredApprovals.length} entries
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
                                                                } else if (pageNumber === currentPage - 2 || pageNumber === currentPage + 2) {
                                                                    return <li key={pageNumber} className="page-item disabled"><span className="page-link" style={{ border: 'none' }}>...</span></li>;
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

                {/* Opportunity Account Modal for Inspecting & Reviewing Details */}
                {showAccountModal && accountModalData && (
                    <OpportunityAccountModal
                        show={showAccountModal}
                        onHide={() => setShowAccountModal(false)}
                        handleClose={() => setShowAccountModal(false)}
                        accountToEdit={accountModalData}
                        initialData={accountModalData}
                        accountGroups={accountGroups}
                        classification={accountModalData?.classification || 'Distributor'}
                        readOnly={true}
                        onSave={() => {
                            setShowAccountModal(false);
                            fetchApprovals();
                        }}
                        onSaved={() => {
                            setShowAccountModal(false);
                            fetchApprovals();
                        }}
                    />
                )}
            </div>
        </>
    );
};

export default OpportunityApprovalList;
