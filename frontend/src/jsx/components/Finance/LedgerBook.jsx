import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form, Modal } from 'react-bootstrap';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ThemeContext } from '../../../context/ThemeContext';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import SalesService from '../../../services/SalesService';
import PurchaseService from '../../../services/PurchaseService';
import { getLedgersList, getLedgerBook, getDayBook, deleteReceipt, deletePayment, deleteJournal, deleteContra } from '../../../services/FinanceService';
import { fetchCompanyFinancialYears } from '../../../services/CompanyService';

const getTodayDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const clampToActiveFy = (dateStr, start, end) => {
    if (!dateStr) return dateStr;
    if (start && dateStr < start) return start;
    if (end && dateStr > end) return end;
    return dateStr;
};

const getDefaultDate = (start, end) => {
    const today = getTodayDate();
    return clampToActiveFy(today, start, end);
};

const fmtDateDisplay = (dStr) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length !== 3) return dStr;
    const [y, m, d] = parts;
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${parseInt(d, 10)}-${MONTHS[parseInt(m, 10) - 1] || m}-${y}`;
};

const LedgerBook = () => {
    const navigate = useNavigate();
    const { background } = useContext(ThemeContext);
    const isDark = background?.value === 'dark';

    const [ledgers, setLedgers] = useState([]);
    const [selectedLedgerId, setSelectedLedgerId] = useState('All');
    const [loading, setLoading] = useState(false);
    const [ledgerData, setLedgerData] = useState(null);

    const [fyStart, setFyStart] = useState(localStorage.getItem('active_fy_start') || '');
    const [fyEnd, setFyEnd] = useState(localStorage.getItem('active_fy_end') || '');

    // Filters - Default to today (restricted to active financial year)
    const [fromDate, setFromDate] = useState(() => {
        const start = localStorage.getItem('active_fy_start') || '';
        const end = localStorage.getItem('active_fy_end') || '';
        return getDefaultDate(start, end);
    });
    const [toDate, setToDate] = useState(() => {
        const start = localStorage.getItem('active_fy_start') || '';
        const end = localStorage.getItem('active_fy_end') || '';
        return getDefaultDate(start, end);
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRowKey, setSelectedRowKey] = useState(null);

    const [showPeriodModal, setShowPeriodModal] = useState(false);
    const [tempFromDate, setTempFromDate] = useState(fromDate);
    const [tempToDate, setTempToDate] = useState(toDate);

    // Sync active financial year and restrict date selections
    useEffect(() => {
        const fetchFy = async () => {
            try {
                const companyId = localStorage.getItem('companyId') || 1;
                const res = await fetchCompanyFinancialYears(companyId);
                const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
                const activeFy = list.find(fy => fy.is_active);
                if (activeFy) {
                    setFyStart(activeFy.start_date);
                    setFyEnd(activeFy.end_date);
                    localStorage.setItem('active_fy_start', activeFy.start_date);
                    localStorage.setItem('active_fy_end', activeFy.end_date);
                    setFromDate(prev => clampToActiveFy(prev, activeFy.start_date, activeFy.end_date));
                    setToDate(prev => clampToActiveFy(prev, activeFy.start_date, activeFy.end_date));
                }
            } catch (err) {
                console.error('Failed to fetch active financial year:', err);
            }
        };

        const currentFyStart = localStorage.getItem('active_fy_start');
        const currentFyEnd = localStorage.getItem('active_fy_end');
        if (currentFyStart && currentFyEnd) {
            setFyStart(currentFyStart);
            setFyEnd(currentFyEnd);
        }
        fetchFy();

        const handleFyUpdate = () => {
            const updatedStart = localStorage.getItem('active_fy_start');
            const updatedEnd = localStorage.getItem('active_fy_end');
            if (updatedStart && updatedEnd) {
                setFyStart(updatedStart);
                setFyEnd(updatedEnd);
                setFromDate(prev => clampToActiveFy(prev, updatedStart, updatedEnd));
                setToDate(prev => clampToActiveFy(prev, updatedStart, updatedEnd));
            }
        };
        window.addEventListener('financialYearUpdate', handleFyUpdate);
        return () => window.removeEventListener('financialYearUpdate', handleFyUpdate);
    }, []);

    const handleFromDateChange = (val) => {
        if (!val) {
            setFromDate('');
            return;
        }
        if (fyStart && val < fyStart) {
            Swal.fire('Out of Financial Year', `Date cannot be earlier than active financial year start (${fmtDateDisplay(fyStart)})`, 'warning');
            val = fyStart;
        } else if (fyEnd && val > fyEnd) {
            Swal.fire('Out of Financial Year', `Date cannot be later than active financial year end (${fmtDateDisplay(fyEnd)})`, 'warning');
            val = fyEnd;
        }
        setFromDate(val);
        if (toDate && val > toDate) {
            setToDate(val);
        }
    };

    const handleToDateChange = (val) => {
        if (!val) {
            setToDate('');
            return;
        }
        if (fyStart && val < fyStart) {
            Swal.fire('Out of Financial Year', `Date cannot be earlier than active financial year start (${fmtDateDisplay(fyStart)})`, 'warning');
            val = fyStart;
        } else if (fyEnd && val > fyEnd) {
            Swal.fire('Out of Financial Year', `Date cannot be later than active financial year end (${fmtDateDisplay(fyEnd)})`, 'warning');
            val = fyEnd;
        }
        setToDate(val);
        if (fromDate && val < fromDate) {
            setFromDate(val);
        }
    };

    useEffect(() => {
        const fetchLedgers = async () => {
            try {
                const res = await getLedgersList();
                const list = Array.isArray(res) ? res : (res.results || []);
                setLedgers(list);
            } catch (err) {
                console.error('Failed to fetch ledgers list:', err);
            }
        };
        fetchLedgers();
    }, []);

    const fetchReport = async () => {
        if (!selectedLedgerId) return;
        setLoading(true);
        try {
            const params = {};
            if (fromDate) params.from_date = fromDate;
            if (toDate) params.to_date = toDate;
            let res;
            if (selectedLedgerId === 'All') {
                res = await getDayBook(params);
            } else {
                res = await getLedgerBook(selectedLedgerId, params);
            }
            setLedgerData(res);
        } catch (error) {
            console.error('Error fetching Ledger Book:', error);
            Swal.fire('Error', 'Failed to fetch Ledger Book data', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [selectedLedgerId, fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F3') {
                e.preventDefault();
                setTempFromDate(fromDate);
                setTempToDate(toDate);
                setShowPeriodModal(true);
            }
            if (e.altKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); exportToExcel(); }
            if (e.altKey && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); exportToPDF(); }
            if (e.altKey && (e.key === 'r' || e.key === 'R')) { e.preventDefault(); handlePrint(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [fromDate, toDate, ledgerData, searchTerm, selectedLedgerId]);

    const handlePrint = () => {
        window.print();
    };

    const handleApplyPeriod = () => {
        let validFrom = tempFromDate;
        let validTo = tempToDate;
        let clamped = false;

        if (fyStart && validFrom && validFrom < fyStart) {
            validFrom = fyStart;
            clamped = true;
        }
        if (fyEnd && validFrom && validFrom > fyEnd) {
            validFrom = fyEnd;
            clamped = true;
        }
        if (fyStart && validTo && validTo < fyStart) {
            validTo = fyStart;
            clamped = true;
        }
        if (fyEnd && validTo && validTo > fyEnd) {
            validTo = fyEnd;
            clamped = true;
        }

        if (clamped) {
            Swal.fire('Out of Financial Year', `Selected dates have been adjusted to stay within the active financial year (${fmtDateDisplay(fyStart)} to ${fmtDateDisplay(fyEnd)})`, 'warning');
        }

        setFromDate(validFrom);
        setToDate(validTo);
        setShowPeriodModal(false);
    };

    const handleEditVoucher = (row) => {
        const vType = (row.voucher_type || '').toLowerCase();
        const vNo = row.voucher_no ? encodeURIComponent(row.voucher_no) : ((row.id || '').includes('_') ? row.id.split('_')[1] : row.id);

        if (vType.includes('sales return') || vType.includes('sales_return')) {
            navigate(`/sales-returns?edit=${vNo}`);
        } else if (vType.includes('purchase return') || vType.includes('purchase_return')) {
            navigate(`/purchase-returns?edit=${vNo}`);
        } else if (vType.includes('sales invoice') || vType.includes('sales_invoice') || vType.includes('sales')) {
            navigate(`/sales/invoices?edit=${vNo}`);
        } else if (vType.includes('purchase invoice') || vType.includes('purchase_invoice') || vType.includes('purchase')) {
            navigate(`/purchase-invoices?edit=${vNo}`);
        } else if (vType.includes('receipt')) {
            navigate(`/finance/receipts?edit=${vNo}`);
        } else if (vType.includes('payment')) {
            navigate(`/finance/payments?edit=${vNo}`);
        } else if (vType.includes('journal')) {
            navigate(`/finance/journals?edit=${vNo}`);
        } else if (vType.includes('contra')) {
            navigate(`/finance/contras?edit=${vNo}`);
        } else {
            navigate(`/finance/journals`);
        }
    };

    const handlePrintVoucher = (row) => {
        const vType = (row.voucher_type || '').toLowerCase();
        const vNo = row.voucher_no ? encodeURIComponent(row.voucher_no) : ((row.id || '').includes('_') ? row.id.split('_')[1] : row.id);

        if (vType.includes('sales return') || vType.includes('sales_return')) {
            navigate(`/sales-returns?print=${vNo}`);
        } else if (vType.includes('purchase return') || vType.includes('purchase_return')) {
            navigate(`/purchase-returns?print=${vNo}`);
        } else if (vType.includes('sales invoice') || vType.includes('sales_invoice') || vType.includes('sales')) {
            navigate(`/sales/invoices?print=${vNo}`);
        } else if (vType.includes('purchase invoice') || vType.includes('purchase_invoice') || vType.includes('purchase')) {
            navigate(`/purchase-invoices?print=${vNo}`);
        } else if (vType.includes('receipt')) {
            navigate(`/finance/receipts?print=${vNo}`);
        } else if (vType.includes('payment')) {
            navigate(`/finance/payments?print=${vNo}`);
        } else if (vType.includes('journal')) {
            navigate(`/finance/journals?print=${vNo}`);
        } else if (vType.includes('contra')) {
            navigate(`/finance/contras?print=${vNo}`);
        }
    };

    const handleDeleteVoucher = async (row) => {
        const vType = (row.voucher_type || '').toLowerCase();
        const rawId = (row.id || '').includes('_') ? row.id.split('_')[1] : row.id;
        const vNo = row.voucher_no || rawId;

        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Delete ${row.voucher_type} ${vNo}? This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                if (vType.includes('sales return') || vType.includes('sales_return')) {
                    await SalesService.deleteSalesReturn(rawId);
                } else if (vType.includes('purchase return') || vType.includes('purchase_return')) {
                    await PurchaseService.deletePurchaseReturn(rawId);
                } else if (vType.includes('sales')) {
                    await SalesService.deleteSalesInvoice(rawId);
                } else if (vType.includes('purchase')) {
                    await PurchaseService.deletePurchaseInvoice(rawId);
                } else if (vType.includes('receipt')) {
                    await deleteReceipt(rawId);
                } else if (vType.includes('payment')) {
                    await deletePayment(rawId);
                } else if (vType.includes('journal')) {
                    await deleteJournal(rawId);
                } else if (vType.includes('contra')) {
                    await deleteContra(rawId);
                }
                Swal.fire('Deleted!', 'Voucher deleted successfully.', 'success');
                fetchReport();
            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'Failed to delete voucher.', 'error');
            }
        }
    };

    // Calculate Running Balances
    const vouchersList = ledgerData?.vouchers || ledgerData?.entries || [];
    const filteredVouchers = vouchersList.filter(item => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            (item.particulars && item.particulars.toLowerCase().includes(term)) ||
            (item.voucher_no && item.voucher_no.toLowerCase().includes(term)) ||
            (item.voucher_type && item.voucher_type.toLowerCase().includes(term))
        );
    });

    let currentBalance = parseFloat(ledgerData?.opening_balance || 0);
    const rowsWithBalance = filteredVouchers.map((row) => {
        const dr = parseFloat(row.debit || 0);
        const cr = parseFloat(row.credit || 0);
        currentBalance += (dr - cr);
        return {
            ...row,
            running_balance: Math.abs(currentBalance),
            balance_type: currentBalance >= 0 ? 'Dr' : 'Cr'
        };
    });

    const totalDebit = filteredVouchers.reduce((sum, r) => sum + parseFloat(r.debit || 0), 0);
    const totalCredit = filteredVouchers.reduce((sum, r) => sum + parseFloat(r.credit || 0), 0);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedLedgerId, fromDate, toDate, searchTerm]);

    const totalPages = Math.ceil(rowsWithBalance.length / pageSize) || 1;
    const paginatedRows = rowsWithBalance.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handlePageSizeChange = (e) => {
        setPageSize(Number(e.target.value));
        setCurrentPage(1);
    };

    const exportToExcel = () => {
        const selectedLedger = ledgers.find(l => String(l.id) === String(selectedLedgerId));
        const ledgerName = selectedLedger ? selectedLedger.name : 'Ledger';

        const exportData = rowsWithBalance.map(r => ({
            Date: r.date,
            Particulars: r.particulars || '--',
            'Voucher Type': r.voucher_type || '--',
            'Voucher No': r.voucher_no || '--',
            'Debit (Dr)': parseFloat(r.debit || 0).toFixed(2),
            'Credit (Cr)': parseFloat(r.credit || 0).toFixed(2),
            'Running Balance': `${parseFloat(r.running_balance).toFixed(2)} ${r.balance_type}`
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Ledger Book');
        XLSX.writeFile(workbook, `LedgerBook_${ledgerName}_${fromDate}_to_${toDate}.xlsx`);
    };

    const exportToPDF = () => {
        const doc = new jsPDF('p', 'mm', 'a4');
        const selectedLedger = ledgers.find(l => String(l.id) === String(selectedLedgerId));
        const ledgerName = selectedLedger ? selectedLedger.name : 'Ledger';

        doc.setFontSize(16);
        doc.text(`Ledger Statement: ${ledgerName}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Period: ${fromDate} to ${toDate}`, 14, 22);

        const tableColumn = ['Date', 'Particulars', 'Voucher Type', 'Voucher No', 'Debit', 'Credit', 'Balance'];
        const tableRows = rowsWithBalance.map(r => [
            r.date,
            r.particulars || '--',
            r.voucher_type || '--',
            r.voucher_no || '--',
            parseFloat(r.debit || 0).toFixed(2),
            parseFloat(r.credit || 0).toFixed(2),
            `${parseFloat(r.running_balance).toFixed(2)} ${r.balance_type}`
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 28,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] }
        });

        doc.save(`LedgerBook_${ledgerName}_${fromDate}_to_${toDate}.pdf`);
    };

    const selectedLedger = selectedLedgerId === 'All'
        ? { id: 'All', name: 'All Ledgers' }
        : ledgers.find(l => String(l.id) === String(selectedLedgerId));

    return (
        <div className="container-fluid px-2 px-md-4 py-3">
            <Card className="border-0 shadow-sm" style={{ borderRadius: '12px', background: isDark ? '#1e293b' : '#ffffff' }}>
                {/* ── Card Header: Title + Filters + Export Buttons ── */}
                <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <Card.Title className="mb-0 fs-4 fw-bold">Ledger Book</Card.Title>

                    {/* Filters */}
                    <div className="d-flex align-items-center gap-2 flex-wrap no-print">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="text-muted small fw-semibold">From</span>
                            <Form.Control
                                type="date"
                                size="sm"
                                min={fyStart || undefined}
                                max={fyEnd || undefined}
                                value={fromDate}
                                onChange={(e) => handleFromDateChange(e.target.value)}
                                style={{ width: '140px', height: '34px', fontSize: '13px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="text-muted small fw-semibold">To</span>
                            <Form.Control
                                type="date"
                                size="sm"
                                min={fyStart || undefined}
                                max={fyEnd || undefined}
                                value={toDate}
                                onChange={(e) => handleToDateChange(e.target.value)}
                                style={{ width: '140px', height: '34px', fontSize: '13px' }}
                            />
                        </div>
                        <Form.Select
                            size="sm"
                            value={selectedLedgerId}
                            onChange={(e) => setSelectedLedgerId(e.target.value)}
                            style={{ width: '220px', height: '34px', fontSize: '13px', fontWeight: 600 }}
                        >
                            <option value="All">All Ledgers</option>
                            {ledgers.map(l => (
                                <option key={l.id} value={String(l.id)}>{l.name} ({l.account_group_name || 'Group'})</option>
                            ))}
                        </Form.Select>

                        {/* Search */}
                        <div style={{ width: '220px', position: 'relative' }}>
                            <i className="fa fa-search position-absolute text-muted" style={{ left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px' }}></i>
                            <Form.Control
                                type="text"
                                size="sm"
                                placeholder="Particulars or Voucher No..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ height: '34px', paddingLeft: '30px', fontSize: '13px' }}
                            />
                        </div>

                        {/* Export Buttons */}
                        <div className="d-flex gap-1">
                            <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => { setTempFromDate(fromDate); setTempToDate(toDate); setShowPeriodModal(true); }}
                                style={{ width: '34px', height: '34px', padding: 0 }}
                                className="d-inline-flex align-items-center justify-content-center"
                                title="F3 – Select Period"
                            >
                                <i className="fas fa-calendar-alt"></i>
                            </Button>
                            <Button
                                variant="outline-success"
                                size="sm"
                                onClick={exportToExcel}
                                style={{ width: '34px', height: '34px', padding: 0 }}
                                className="d-inline-flex align-items-center justify-content-center"
                                title="Alt+S – Export Excel"
                            >
                                <i className="fas fa-file-excel"></i>
                            </Button>
                            <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={exportToPDF}
                                style={{ width: '34px', height: '34px', padding: 0 }}
                                className="d-inline-flex align-items-center justify-content-center"
                                title="Alt+D – Export PDF"
                            >
                                <i className="fas fa-file-pdf"></i>
                            </Button>
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={handlePrint}
                                style={{ width: '34px', height: '34px', padding: 0 }}
                                className="d-inline-flex align-items-center justify-content-center"
                                title="Alt+R – Print Report"
                            >
                                <i className="fas fa-print"></i>
                            </Button>
                        </div>
                    </div>
                </Card.Header>

                <Card.Body className="p-0">
                    {/* Print-only company header */}
                    <div className="d-none d-print-block p-4 border-bottom bg-light">
                        <div className="d-flex justify-content-between align-items-start">
                            <div>
                                <h4 className="fw-bold text-dark mb-1">{ledgerData?.company?.display_name || ledgerData?.company_name || ledgerData?.company?.name || ''}</h4>
                                {ledgerData?.company?.address && <p className="text-muted mb-1 small"><i className="fa fa-map-marker-alt me-1 text-danger"></i>{ledgerData.company.address}</p>}
                                <div className="d-flex flex-wrap gap-3 text-muted small mt-1">
                                    {ledgerData?.company?.gst_no && <span><strong>GSTIN:</strong> {ledgerData.company.gst_no}</span>}
                                    {ledgerData?.company?.pan_no && <span><strong>PAN:</strong> {ledgerData.company.pan_no}</span>}
                                    {ledgerData?.company?.phone && <span><strong>Phone:</strong> {ledgerData.company.phone}</span>}
                                    {ledgerData?.company?.email && <span><strong>Email:</strong> {ledgerData.company.email}</span>}
                                </div>
                            </div>
                            <div className="text-end">
                                <div className="fw-bold text-dark fs-6">Ledger Book Report</div>
                                <div className="text-muted small mt-1 fw-semibold">Period: {fromDate} to {toDate}</div>
                                {selectedLedger && <div className="text-muted small mt-1">Account: {selectedLedger.name}</div>}
                            </div>
                        </div>
                    </div>

                    {/* Metrics Summary Strip */}
                    {selectedLedger && (
                        <div className="p-3 border-bottom bg-light bg-opacity-50">
                            <div className="row g-2 g-md-3">
                                <div className="col-12 col-sm-6 col-lg-3">
                                    <div className="p-2 border rounded bg-white shadow-sm">
                                        <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Opening Balance</small>
                                        <span className="fw-bold mb-0 text-truncate fs-6">
                                            ₹{parseFloat(ledgerData?.opening_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>

                                <div className="col-12 col-sm-6 col-lg-3">
                                    <div className="p-2 border rounded bg-white shadow-sm">
                                        <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Total Debit (Dr)</small>
                                        <span className="fw-bold text-dark mb-0 text-truncate fs-6">
                                            ₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>

                                <div className="col-12 col-sm-6 col-lg-3">
                                    <div className="p-2 border rounded bg-white shadow-sm">
                                        <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Total Credit (Cr)</small>
                                        <span className="fw-bold text-dark mb-0 text-truncate fs-6">
                                            ₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>

                                <div className="col-12 col-sm-6 col-lg-3">
                                    <div className="p-2 border rounded bg-white shadow-sm">
                                        <small className="text-muted d-block text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Closing Balance</small>
                                        <span className="fw-bold text-dark mb-0 text-truncate fs-6">
                                            ₹{Math.abs(currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {currentBalance >= 0 ? 'Dr' : 'Cr'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Table */}
                    <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table className="table table-responsive-md align-middle mb-0" style={{ minWidth: '940px' }}>
                            <thead>
                                <tr>
                                    <th className="ps-3 ps-md-4 text-nowrap" style={{ width: '45px' }}>#</th>
                                    <th className="text-nowrap" style={{ width: '130px' }}>VOUCHER NO</th>
                                    <th className="text-nowrap" style={{ width: '110px' }}>DATE</th>
                                    <th className="text-nowrap">PARTICULARS</th>
                                    <th className="text-nowrap" style={{ width: '140px' }}>VOUCHER TYPE</th>
                                    <th className="text-end text-nowrap" style={{ width: '130px' }}>DEBIT (₹)</th>
                                    <th className="text-end text-nowrap" style={{ width: '130px' }}>CREDIT (₹)</th>
                                    <th className="text-end text-nowrap" style={{ width: '170px' }}>RUNNING BALANCE (₹)</th>
                                    <th className="text-end pe-3 pe-md-4 text-nowrap" style={{ width: '130px' }}>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="9" className="text-center py-4">
                                            <div className="spinner-border text-primary spinner-border-sm me-2"></div>
                                            Loading ledger statement...
                                        </td>
                                    </tr>
                                ) : rowsWithBalance.length > 0 ? (
                                    paginatedRows.map((row, idx) => {
                                        const absoluteIndex = (currentPage - 1) * pageSize + idx + 1;
                                        return (
                                            <tr
                                                key={idx}
                                                onClick={() => setSelectedRowKey(idx)}
                                                style={{ backgroundColor: selectedRowKey === idx ? (isDark ? '#334155' : '#e2e8f0') : 'transparent', cursor: 'pointer' }}
                                            >
                                                <td className="ps-3 ps-md-4 text-muted text-nowrap">{absoluteIndex}</td>
                                                <td className="text-nowrap">{row.voucher_no || '--'}</td>
                                                <td className="text-nowrap">{row.date}</td>
                                                <td>{row.particulars || '--'}</td>
                                                <td className="text-nowrap">{row.voucher_type || '--'}</td>
                                                <td className="text-end text-nowrap">
                                                    {parseFloat(row.debit || 0) > 0 ? `₹${parseFloat(row.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '--'}
                                                </td>
                                                <td className="text-end text-nowrap">
                                                    {parseFloat(row.credit || 0) > 0 ? `₹${parseFloat(row.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '--'}
                                                </td>
                                                <td className="text-end text-nowrap">
                                                    ₹{parseFloat(row.running_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {row.balance_type}
                                                </td>
                                                <td className="text-end pe-3 pe-md-4 text-nowrap" onClick={e => e.stopPropagation()}>
                                                    <div className="d-flex justify-content-end align-items-center gap-1">
                                                        <Button 
                                                            variant="outline-info" 
                                                            size="sm" 
                                                            style={{ width: '28px', height: '28px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                                                            onClick={() => handlePrintVoucher(row)} 
                                                            title="Print Voucher"
                                                        >
                                                            <i className="fa fa-print"></i>
                                                        </Button>
                                                        <EditButton module="finance" onClick={() => handleEditVoucher(row)} />
                                                        <DeleteButton module="finance" onClick={() => handleDeleteVoucher(row)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="9" className="text-center text-muted py-5">
                                            <i className="fas fa-book-open fs-3 d-block mb-2 text-secondary"></i>
                                            No ledger transactions found for this period.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {rowsWithBalance.length > 0 && (
                        <div className="d-flex justify-content-between align-items-center p-3 flex-wrap gap-2 border-top no-print">
                            <div className="d-flex align-items-center gap-2">
                                <span className="text-muted" style={{ fontSize: '13px' }}>
                                    Showing {Math.min((currentPage - 1) * pageSize + 1, rowsWithBalance.length)}–{Math.min(currentPage * pageSize, rowsWithBalance.length)} of {rowsWithBalance.length} entries
                                </span>
                                <select
                                    className="form-select form-select-sm"
                                    style={{ width: 'auto', fontSize: '13px' }}
                                    value={pageSize}
                                    onChange={handlePageSizeChange}
                                >
                                    {[10, 25, 50, 100].map(size => (
                                        <option key={size} value={size}>{size} / page</option>
                                    ))}
                                </select>
                            </div>
                            <nav>
                                <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                    <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                        <button type="button" className="page-link" onClick={() => handlePageChange(1)} disabled={currentPage === 1} title="First" style={{ border: 'none', background: 'none' }}>
                                            <i className="la la-angle-double-left" />
                                        </button>
                                    </li>
                                    <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                        <button type="button" className="page-link" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} title="Previous" style={{ border: 'none', background: 'none' }}>
                                            <i className="la la-angle-left" />
                                        </button>
                                    </li>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                                        .reduce((acc, page, idx, arr) => {
                                            if (idx > 0 && page - arr[idx - 1] > 1) acc.push('...');
                                            acc.push(page);
                                            return acc;
                                        }, [])
                                        .map((item, idx) =>
                                            item === '...' ? (
                                                <li key={`ellipsis-${idx}`} className="page-item disabled">
                                                    <span className="page-link" style={{ border: 'none', background: 'none' }}>…</span>
                                                </li>
                                            ) : (
                                                <li key={item} className={`page-item ${currentPage === item ? 'active' : ''}`}>
                                                    <button type="button" className="page-link" onClick={() => handlePageChange(item)} style={{ border: 'none' }}>
                                                        {item}
                                                    </button>
                                                </li>
                                            )
                                        )
                                    }
                                    <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                        <button type="button" className="page-link" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} title="Next" style={{ border: 'none', background: 'none' }}>
                                            <i className="la la-angle-right" />
                                        </button>
                                    </li>
                                    <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                        <button type="button" className="page-link" onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} title="Last" style={{ border: 'none', background: 'none' }}>
                                            <i className="la la-angle-double-right" />
                                        </button>
                                    </li>
                                </ul>
                            </nav>
                        </div>
                    )}
                </Card.Body>
            </Card>

            {/* Period Modal */}
            <Modal show={showPeriodModal} onHide={() => setShowPeriodModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title className="fw-bold">Select Report Period (F3)</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {fyStart && fyEnd && (
                        <div className="alert alert-info py-1 px-2 small mb-3">
                            <i className="fa fa-info-circle me-1"></i>
                            Active FY: <strong>{fmtDateDisplay(fyStart)}</strong> to <strong>{fmtDateDisplay(fyEnd)}</strong>
                        </div>
                    )}
                    <Form.Group className="mb-3">
                        <Form.Label className="fw-semibold">From Date</Form.Label>
                        <Form.Control
                            type="date"
                            min={fyStart || undefined}
                            max={fyEnd || undefined}
                            value={tempFromDate}
                            onChange={e => setTempFromDate(e.target.value)}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label className="fw-semibold">To Date</Form.Label>
                        <Form.Control
                            type="date"
                            min={fyStart || undefined}
                            max={fyEnd || undefined}
                            value={tempToDate}
                            onChange={e => setTempToDate(e.target.value)}
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowPeriodModal(false)}>Cancel</Button>
                    <Button variant="primary" onClick={handleApplyPeriod}>Apply Period</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default LedgerBook;
