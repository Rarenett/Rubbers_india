import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../../../services/AxiosInstance';

const LedgerDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // ─── ALL STATE ────────────────────────────────────────────────────────────
    const [loading, setLoading] = useState(true);
    const [ledgerData, setLedgerData] = useState(null);
    const [error, setError] = useState(null);

    const [activeMainTab, setActiveMainTab] = useState('vouchers');
    const [voucherSideFilter, setVoucherSideFilter] = useState('all');
    const [billStatusFilter, setBillStatusFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    const [voucherPage, setVoucherPage] = useState(1);
    const [billPage, setBillPage] = useState(1);
    const itemsPerPage = 10;

    // ─── FETCH ────────────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchLedgerVouchers = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await axiosInstance.get(`/api/finance/ledgers/${id}/vouchers/`);
                setLedgerData(res.data);
            } catch (err) {
                console.error('Failed to load ledger details:', err);
                setError('Could not load ledger details. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchLedgerVouchers();
        }
    }, [id]);

    // ─── RESET PAGINATION (must be above early returns) ───────────────────────
    useEffect(() => {
        setVoucherPage(1);
    }, [searchTerm, voucherSideFilter]);

    useEffect(() => {
        setBillPage(1);
    }, [searchTerm, billStatusFilter]);

    // ─── KEYBOARD SHORTCUTS (Esc / Backspace to navigate back) ───────────────────
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName);
            if (e.key === 'Escape' || (!isInput && e.key === 'Backspace')) {
                e.preventDefault();
                navigate(-1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigate]);

    // ─── HELPERS ──────────────────────────────────────────────────────────────
    const formatCurrency = (amount) => {
        const val = parseFloat(amount) || 0;
        return `${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // ─── EARLY RETURNS (after all hooks) ──────────────────────────────────────
    if (loading) {
        return (
            <div className="container-fluid" style={{ minHeight: '80vh', padding: '30px' }}>
                <div className="d-flex justify-content-center align-items-center" style={{ height: '300px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="sr-only">Loading...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !ledgerData) {
        return (
            <div className="container-fluid" style={{ padding: '30px' }}>
                <div className="alert alert-danger shadow-sm border-0" role="alert">
                    <i className="la la-exclamation-circle me-2" />
                    {error || 'Ledger not found.'}
                    <button className="btn btn-sm btn-outline-danger ms-3" onClick={() => navigate('/finance/ledgers')}>
                        Back to Ledgers
                    </button>
                </div>
            </div>
        );
    }

    // ─── DATA ─────────────────────────────────────────────────────────────────
    const ledger_name         = ledgerData?.ledger_name || '';
    const account_group_name  = ledgerData?.account_group_name || '';
    const opening_balance     = ledgerData?.opening_balance || 0;
    const opening_balance_type= ledgerData?.opening_balance_type || 'Dr';
    const total_debit         = ledgerData?.total_debit || 0;
    const total_credit        = ledgerData?.total_credit || 0;
    const closing_balance     = ledgerData?.closing_balance || 0;
    const closing_balance_type= ledgerData?.closing_balance_type || 'Dr';
    const vouchers            = Array.isArray(ledgerData?.vouchers) ? ledgerData.vouchers : [];
    const bills               = Array.isArray(ledgerData?.bills)    ? ledgerData.bills    : [];
    const summary             = ledgerData?.summary || {};

    // ─── FILTER VOUCHERS ──────────────────────────────────────────────────────
    const filteredVouchers = vouchers.filter(v => {
        if (!v) return false;
        if (voucherSideFilter === 'dr' && (parseFloat(v.debit)  || 0) <= 0) return false;
        if (voucherSideFilter === 'cr' && (parseFloat(v.credit) || 0) <= 0) return false;
        if (searchTerm && searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            return (
                (v.voucher_no  || '').toLowerCase().includes(term) ||
                (v.voucher_type|| '').toLowerCase().includes(term) ||
                (v.particulars || '').toLowerCase().includes(term) ||
                (v.narration   || '').toLowerCase().includes(term)
            );
        }
        return true;
    });

    // ─── FILTER BILLS ─────────────────────────────────────────────────────────
    const filteredBills = bills.filter(b => {
        if (!b) return false;
        if (billStatusFilter === 'unpaid'         && b.status !== 'Unpaid')         return false;
        if (billStatusFilter === 'partially_paid' && b.status !== 'Partially Paid') return false;
        if (billStatusFilter === 'paid'           && b.status !== 'Paid')           return false;
        if (searchTerm && searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            return (
                (b.bill_no  || '').toLowerCase().includes(term) ||
                (b.bill_type|| '').toLowerCase().includes(term)
            );
        }
        return true;
    });

    // ─── PAGINATION ───────────────────────────────────────────────────────────
    const totalVoucherPages = Math.max(1, Math.ceil(filteredVouchers.length / itemsPerPage));
    const voucherStartIndex = (voucherPage - 1) * itemsPerPage;
    const currentVouchers   = filteredVouchers.slice(voucherStartIndex, voucherStartIndex + itemsPerPage);

    const totalBillPages = Math.max(1, Math.ceil(filteredBills.length / itemsPerPage));
    const billStartIndex = (billPage - 1) * itemsPerPage;
    const currentBills   = filteredBills.slice(billStartIndex, billStartIndex + itemsPerPage);

    // ─── RENDER ───────────────────────────────────────────────────────────────
    return (
        <div className="container-fluid" style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>

            {/* Top Header & Breadcrumb */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <nav aria-label="breadcrumb">
                        <ol className="breadcrumb mb-1" style={{ fontSize: '13px', backgroundColor: 'transparent', padding: 0 }}>
                            <li className="breadcrumb-item"><Link to="/finance/ledgers" style={{ color: '#64748b', textDecoration: 'none' }}>Accounts</Link></li>
                            <li className="breadcrumb-item"><Link to="/finance/ledgers" style={{ color: '#64748b', textDecoration: 'none' }}>Ledgers</Link></li>
                            <li className="breadcrumb-item active" aria-current="page" style={{ color: '#0f172a', fontWeight: 600 }}>{ledger_name} Details</li>
                        </ol>
                    </nav>
                    <div className="d-flex align-items-center gap-3">
                        <div style={{
                            width: '42px', height: '42px', borderRadius: '10px',
                            backgroundColor: '#f1f5f9', color: '#334155',
                            border: '1px solid #e2e8f0', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontSize: '20px'
                        }}>
                            <i className="la la-book" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '22px' }}>{ledger_name}</h3>
                            <span className="badge bg-light text-secondary border mt-1" style={{ fontWeight: 500, fontSize: '11px' }}>
                                Group: {account_group_name || 'General Ledger'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Executive Metric Cards */}
            <div className="row g-3 mb-4">
                <div className="col-md">
                    <div className="card border shadow-sm" style={{ borderRadius: '10px', padding: '16px', backgroundColor: '#ffffff' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>Opening Balance</div>
                        <div className="d-flex align-items-baseline gap-2 mt-2">
                            <span style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(opening_balance)}</span>
                            <span className={`badge ${opening_balance_type === 'Dr' ? 'bg-light text-success border' : 'bg-light text-danger border'}`} style={{ fontSize: '11px' }}>
                                {opening_balance_type}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="col-md">
                    <div className="card border shadow-sm" style={{ borderRadius: '10px', padding: '16px', backgroundColor: '#ffffff' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>Total Debit (DR)</div>
                        <div className="mt-2" style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(total_debit)}</div>
                    </div>
                </div>

                <div className="col-md">
                    <div className="card border shadow-sm" style={{ borderRadius: '10px', padding: '16px', backgroundColor: '#ffffff' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>Total Credit (CR)</div>
                        <div className="mt-2" style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(total_credit)}</div>
                    </div>
                </div>

                <div className="col-md">
                    <div className="card border shadow-sm" style={{ borderRadius: '10px', padding: '16px', backgroundColor: '#ffffff' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>Closing Balance</div>
                        <div className="d-flex align-items-baseline gap-2 mt-2">
                            <span style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(closing_balance)}</span>
                            <span className={`badge ${closing_balance_type === 'Dr' ? 'bg-light text-success border' : 'bg-light text-danger border'}`} style={{ fontSize: '11px' }}>
                                {closing_balance_type}
                            </span>
                        </div>
                    </div>
                </div>

                {summary.total_bills > 0 && (
                    <div className="col-md">
                        <div className="card border shadow-sm" style={{ borderRadius: '10px', padding: '16px', backgroundColor: '#ffffff' }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>Pending Outstanding</div>
                            <div className="d-flex align-items-baseline gap-2 mt-2">
                                <span style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(summary.total_pending_amount)}</span>
                                <span className="badge bg-light text-secondary border" style={{ fontSize: '11px' }}>
                                    {(summary.unpaid_count || 0) + (summary.partially_paid_count || 0)} Pending
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Tabs Container */}
            <div className="card border shadow-sm" style={{ borderRadius: '10px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
                <div className="card-header border-bottom bg-white d-flex justify-content-between align-items-center flex-wrap" style={{ padding: '14px 20px' }}>
                    <div className="d-flex gap-2">
                        <button
                            className="btn btn-sm"
                            style={{
                                borderRadius: '6px', padding: '7px 16px', fontWeight: 600, fontSize: '13px',
                                backgroundColor: activeMainTab === 'vouchers' ? '#e2e8f0' : '#ffffff',
                                color: activeMainTab === 'vouchers' ? '#0f172a' : '#64748b',
                                border: `1px solid ${activeMainTab === 'vouchers' ? '#94a3b8' : '#e2e8f0'}`
                            }}
                            onClick={() => setActiveMainTab('vouchers')}
                        >
                            <i className="la la-list-alt me-1" />
                            All Voucher Transactions ({vouchers.length})
                        </button>
                        <button
                            className="btn btn-sm"
                            style={{
                                borderRadius: '6px', padding: '7px 16px', fontWeight: 600, fontSize: '13px',
                                backgroundColor: activeMainTab === 'bills' ? '#e2e8f0' : '#ffffff',
                                color: activeMainTab === 'bills' ? '#0f172a' : '#64748b',
                                border: `1px solid ${activeMainTab === 'bills' ? '#94a3b8' : '#e2e8f0'}`
                            }}
                            onClick={() => setActiveMainTab('bills')}
                        >
                            <i className="la la-file-invoice-dollar me-1" />
                            Bill-wise Outstanding Status ({bills.length})
                        </button>
                    </div>

                    <div className="d-flex align-items-center gap-2 mt-2 mt-sm-0">
                        <div className="input-group input-group-sm" style={{ width: '260px' }}>
                            <span className="input-group-text bg-light border-end-0"><i className="la la-search" /></span>
                            <input
                                type="text"
                                className="form-control bg-light border-start-0"
                                placeholder={activeMainTab === 'vouchers' ? 'Search voucher, no, particulars...' : 'Search bill no...'}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ borderRadius: '0 6px 6px 0', fontSize: '13px' }}
                            />
                        </div>
                        <button
                            className="btn btn-sm d-flex align-items-center gap-1"
                            style={{ borderRadius: '6px', padding: '6px 14px', fontWeight: 600, fontSize: '13px', backgroundColor: '#64748b', color: '#ffffff', border: '1px solid #64748b', whiteSpace: 'nowrap' }}
                            onClick={() => window.print()}
                        >
                            <i className="la la-print" />
                            Print / Export
                        </button>
                    </div>
                </div>

                <div className="card-body" style={{ padding: '20px' }}>

                    {/* TAB 1: ALL VOUCHERS */}
                    {activeMainTab === 'vouchers' && (
                        <div>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <div className="btn-group btn-group-sm">
                                    {[
                                        { key: 'all', label: `All Vouchers (${vouchers.length})` },
                                        { key: 'dr',  label: 'Debit Side (Dr)' },
                                        { key: 'cr',  label: 'Credit Side (Cr)' },
                                    ].map(({ key, label }) => (
                                        <button
                                            key={key}
                                            className="btn"
                                            style={{
                                                backgroundColor: voucherSideFilter === key ? '#e2e8f0' : '#ffffff',
                                                color:           voucherSideFilter === key ? '#0f172a' : '#64748b',
                                                borderColor:     voucherSideFilter === key ? '#94a3b8' : '#e2e8f0',
                                                fontWeight:      voucherSideFilter === key ? 600 : 500,
                                            }}
                                            onClick={() => setVoucherSideFilter(key)}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <span className="text-muted" style={{ fontSize: '12px' }}>
                                    Showing {filteredVouchers.length} of {vouchers.length} vouchers
                                </span>
                            </div>

                            <div className="table-responsive">
                                <table className="table table-responsive-md">
                                    <thead>
                                        <tr>
                                            <th><strong>SL NO</strong></th>
                                            <th><strong>DATE</strong></th>
                                            <th><strong>VOUCHER TYPE</strong></th>
                                            <th><strong>VOUCHER / BILL NO</strong></th>
                                            <th><strong>PARTICULARS (ACCOUNT)</strong></th>
                                            <th><strong>DEBIT (DR) ₹</strong></th>
                                            <th><strong>CREDIT (CR) ₹</strong></th>
                                            <th className="text-end"><strong>RUNNING BALANCE</strong></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredVouchers.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" className="text-center py-4 text-muted">
                                                    No voucher records match the selected filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            currentVouchers.map((row, idx) => (
                                                <tr key={row.id || idx}>
                                                    <td>{voucherStartIndex + idx + 1}</td>
                                                    <td>{row.date}</td>
                                                    <td>
                                                        <span className="badge bg-light text-dark border" style={{ fontWeight: 500, fontSize: '11px' }}>
                                                            {row.voucher_type}
                                                        </span>
                                                    </td>
                                                    <td>{row.voucher_no}</td>
                                                    <td>
                                                        <div>{row.particulars}</div>
                                                        {row.narration && (
                                                            <div className="text-muted small" style={{ fontSize: '11px' }}>{row.narration}</div>
                                                        )}
                                                        {row.bill_allocations && row.bill_allocations.length > 0 && (
                                                            <div className="d-flex flex-wrap gap-1 mt-1">
                                                                {row.bill_allocations.map((alloc, aIdx) => (
                                                                    <span key={aIdx} className="badge bg-light text-secondary border" style={{ fontSize: '10px' }}>
                                                                        {alloc.allocation_type}: {alloc.bill_no} ({formatCurrency(alloc.amount)})
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {row.debit > 0 ? (
                                                            <>{formatCurrency(row.debit)}{' '}<span className="fw-bold text-success" style={{ fontSize: '11px' }}>Dr</span></>
                                                        ) : '—'}
                                                    </td>
                                                    <td>
                                                        {row.credit > 0 ? (
                                                            <>{formatCurrency(row.credit)}{' '}<span className="fw-bold text-danger" style={{ fontSize: '11px' }}>Cr</span></>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="text-end">
                                                        {formatCurrency(row.running_balance)}{' '}
                                                        <span className={`fw-bold ${row.running_balance_type === 'Dr' ? 'text-success' : 'text-danger'}`} style={{ fontSize: '11px' }}>
                                                            {row.running_balance_type}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {totalVoucherPages > 1 && (
                                <div className="d-flex justify-content-between align-items-center mt-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {voucherStartIndex + 1} to {Math.min(voucherStartIndex + itemsPerPage, filteredVouchers.length)} of {filteredVouchers.length} entries
                                    </div>
                                    <nav>
                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                            <li className={`page-item page-indicator ${voucherPage === 1 ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setVoucherPage(prev => Math.max(prev - 1, 1))} disabled={voucherPage === 1} style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-left" />
                                                </button>
                                            </li>
                                            {Array.from({ length: totalVoucherPages }, (_, index) => {
                                                const pageNumber = index + 1;
                                                if (pageNumber === 1 || pageNumber === totalVoucherPages || (pageNumber >= voucherPage - 1 && pageNumber <= voucherPage + 1)) {
                                                    return (
                                                        <li key={pageNumber} className={`page-item ${voucherPage === pageNumber ? 'active' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setVoucherPage(pageNumber)} style={{ border: 'none' }}>
                                                                {pageNumber}
                                                            </button>
                                                        </li>
                                                    );
                                                } else if (pageNumber === voucherPage - 2 || pageNumber === voucherPage + 2) {
                                                    return (
                                                        <li key={pageNumber} className="page-item disabled">
                                                            <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                        </li>
                                                    );
                                                }
                                                return null;
                                            })}
                                            <li className={`page-item page-indicator ${voucherPage === totalVoucherPages ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setVoucherPage(prev => Math.min(prev + 1, totalVoucherPages))} disabled={voucherPage === totalVoucherPages} style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-right" />
                                                </button>
                                            </li>
                                        </ul>
                                    </nav>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: BILL-WISE OUTSTANDING STATUS */}
                    {activeMainTab === 'bills' && (
                        <div>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <div className="btn-group btn-group-sm">
                                    {[
                                        { key: 'all',            label: `All Bills (${bills.length})` },
                                        { key: 'unpaid',         label: `Not Paid / Unpaid (${summary.unpaid_count || 0})` },
                                        { key: 'partially_paid', label: `Partially Paid (${summary.partially_paid_count || 0})` },
                                        { key: 'paid',           label: `Fully Paid (${summary.paid_count || 0})` },
                                    ].map(({ key, label }) => (
                                        <button
                                            key={key}
                                            className="btn"
                                            style={{
                                                backgroundColor: billStatusFilter === key ? '#e2e8f0' : '#ffffff',
                                                color:           billStatusFilter === key ? '#0f172a' : '#64748b',
                                                borderColor:     billStatusFilter === key ? '#94a3b8' : '#e2e8f0',
                                                fontWeight:      billStatusFilter === key ? 600 : 500,
                                            }}
                                            onClick={() => setBillStatusFilter(key)}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <span className="text-muted" style={{ fontSize: '12px' }}>
                                    Showing {filteredBills.length} of {bills.length} bills
                                </span>
                            </div>

                            <div className="table-responsive">
                                <table className="table table-responsive-md">
                                    <thead>
                                        <tr>
                                            <th><strong>SL NO</strong></th>
                                            <th><strong>BILL DATE</strong></th>
                                            <th><strong>BILL / INVOICE NO</strong></th>
                                            <th><strong>BILL TYPE</strong></th>
                                            <th><strong>ORIGINAL AMOUNT ₹</strong></th>
                                            <th><strong>PAID / RECEIVED ₹</strong></th>
                                            <th><strong>PENDING BALANCE ₹</strong></th>
                                            <th className="text-center"><strong>BILL STATUS</strong></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredBills.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" className="text-center py-4 text-muted">
                                                    No bill records found for this filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            currentBills.map((b, idx) => (
                                                <tr key={idx}>
                                                    <td>{billStartIndex + idx + 1}</td>
                                                    <td>{b.date}</td>
                                                    <td>{b.bill_no}</td>
                                                    <td>
                                                        <span className="badge bg-light text-dark border" style={{ fontWeight: 500, fontSize: '11px' }}>
                                                            {b.bill_type}
                                                        </span>
                                                    </td>
                                                    <td>{formatCurrency(b.original_amount)}</td>
                                                    <td>{formatCurrency(b.paid_amount)}</td>
                                                    <td>{formatCurrency(b.pending_amount)}</td>
                                                    <td className="text-center">
                                                        <span className={`badge ${
                                                            b.status === 'Paid'           ? 'bg-light text-success border' :
                                                            b.status === 'Partially Paid' ? 'bg-light text-warning border text-dark' :
                                                            'bg-light text-danger border'
                                                        }`} style={{ fontWeight: 500, fontSize: '11px', padding: '4px 8px' }}>
                                                            {b.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {totalBillPages > 1 && (
                                <div className="d-flex justify-content-between align-items-center mt-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {billStartIndex + 1} to {Math.min(billStartIndex + itemsPerPage, filteredBills.length)} of {filteredBills.length} entries
                                    </div>
                                    <nav>
                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                            <li className={`page-item page-indicator ${billPage === 1 ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setBillPage(prev => Math.max(prev - 1, 1))} disabled={billPage === 1} style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-left" />
                                                </button>
                                            </li>
                                            {Array.from({ length: totalBillPages }, (_, index) => {
                                                const pageNumber = index + 1;
                                                if (pageNumber === 1 || pageNumber === totalBillPages || (pageNumber >= billPage - 1 && pageNumber <= billPage + 1)) {
                                                    return (
                                                        <li key={pageNumber} className={`page-item ${billPage === pageNumber ? 'active' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setBillPage(pageNumber)} style={{ border: 'none' }}>
                                                                {pageNumber}
                                                            </button>
                                                        </li>
                                                    );
                                                } else if (pageNumber === billPage - 2 || pageNumber === billPage + 2) {
                                                    return (
                                                        <li key={pageNumber} className="page-item disabled">
                                                            <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                        </li>
                                                    );
                                                }
                                                return null;
                                            })}
                                            <li className={`page-item page-indicator ${billPage === totalBillPages ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setBillPage(prev => Math.min(prev + 1, totalBillPages))} disabled={billPage === totalBillPages} style={{ border: 'none', background: 'none' }}>
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
            </div>
        </div>
    );
};

export default LedgerDetailsPage;
