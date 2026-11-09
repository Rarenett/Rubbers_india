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
import { getDayBook, deleteReceipt, deletePayment, deleteJournal, deleteContra } from '../../../services/FinanceService';
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

const DayBook = () => {
    const navigate = useNavigate();
    const { background } = useContext(ThemeContext);
    const isDark = background?.value === 'dark';

    const handleEditVoucher = (entry) => {
        const vType = (entry.voucher_type || '').toLowerCase();
        const rawId = (entry.id || '').includes('_') ? entry.id.split('_')[1] : entry.id;
        const vNo = entry.voucher_no ? encodeURIComponent(entry.voucher_no) : rawId;

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

    const handlePrintVoucher = (entry) => {
        const vType = (entry.voucher_type || '').toLowerCase();
        const rawId = (entry.id || '').includes('_') ? entry.id.split('_')[1] : entry.id;
        const vNo = entry.voucher_no ? encodeURIComponent(entry.voucher_no) : rawId;

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

    const handleDeleteVoucher = async (entry) => {
        const vType = (entry.voucher_type || '').toLowerCase();
        const rawId = (entry.id || '').includes('_') ? entry.id.split('_')[1] : entry.id;
        const vNo = entry.voucher_no || rawId;

        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Delete ${entry.voucher_type} ${vNo}? This action cannot be undone.`,
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

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

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
    const [voucherType, setVoucherType] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [showPeriodModal, setShowPeriodModal] = useState(false);
    const [tempFromDate, setTempFromDate] = useState(fromDate);
    const [tempToDate, setTempToDate] = useState(toDate);

    const [selectedRowKey, setSelectedRowKey] = useState(null);

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

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [fromDate, toDate, voucherType, searchTerm, itemsPerPage]);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const params = {};
            if (fromDate) params.from_date = fromDate;
            if (toDate) params.to_date = toDate;
            if (voucherType && voucherType !== 'All') params.voucher_type = voucherType;
            if (searchTerm) params.search = searchTerm;
            const res = await getDayBook(params);
            setData(res);
        } catch (error) {
            console.error('Error fetching Day Book:', error);
            Swal.fire('Error', 'Failed to fetch Day Book data', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [fromDate, toDate, voucherType]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F3') {
                e.preventDefault();
                setTempFromDate(fromDate);
                setTempToDate(toDate);
                setShowPeriodModal(true);
            }
            if (e.altKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); handleExportExcel(); }
            if (e.altKey && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); handleExportPDF(); }
            if (e.altKey && (e.key === 'r' || e.key === 'R')) { e.preventDefault(); handlePrint(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [fromDate, toDate, data, searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchReport();
    };

    const fmt = (val) => {
        if (val === null || val === undefined) return '';
        const num = parseFloat(val) || 0;
        if (num === 0) return '';
        return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const VOUCHER_TYPES = [
        'All', 'Sales Invoice', 'Sales Return', 'Purchase Invoice', 'Purchase Return',
        'Receipt', 'Payment', 'Journal', 'Contra', 'Service Invoice', 'Manufactural Journal', 'Stock Journal'
    ];

    const filteredEntries = (data?.entries || []).filter(entry => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase().trim();
        return (
            (entry.particulars || '').toLowerCase().includes(term) ||
            (entry.voucher_no || '').toLowerCase().includes(term) ||
            (entry.voucher_type || '').toLowerCase().includes(term) ||
            (entry.date || '').toLowerCase().includes(term) ||
            String(entry.debit || '').includes(term) ||
            String(entry.credit || '').includes(term)
        );
    });

    // Pagination Calculations
    const isAll = itemsPerPage === 'All';
    const effectiveItemsPerPage = isAll ? filteredEntries.length || 1 : parseInt(itemsPerPage) || 10;
    const indexOfLastItem = currentPage * effectiveItemsPerPage;
    const indexOfFirstItem = isAll ? 0 : indexOfLastItem - effectiveItemsPerPage;
    const currentEntries = isAll ? filteredEntries : filteredEntries.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = isAll ? 1 : Math.ceil(filteredEntries.length / effectiveItemsPerPage);

    const calculatedTotalDebit = filteredEntries.reduce((sum, e) => sum + (parseFloat(e.debit) || 0), 0);
    const calculatedTotalCredit = filteredEntries.reduce((sum, e) => sum + (parseFloat(e.credit) || 0), 0);

    // Export to Excel
    const handleExportExcel = () => {
        if (!filteredEntries || filteredEntries.length === 0) { Swal.fire('Warning', 'No data to export', 'warning'); return; }
        const compName = data?.company?.display_name || data?.company_name || data?.company?.name || '';
        const gstNo = data?.company?.gst_no ? `GSTIN: ${data.company.gst_no}` : '';
        const panNo = data?.company?.pan_no ? `PAN: ${data.company.pan_no}` : '';
        const periodStr = `Period: ${fmtDateDisplay(fromDate)} to ${fmtDateDisplay(toDate)}`;
        const sheetData = [];
        if (compName) sheetData.push([compName]);
        const taxInfo = [gstNo, panNo].filter(Boolean).join('  |  ');
        if (taxInfo) sheetData.push([taxInfo]);
        sheetData.push(['Day Book Report']);
        sheetData.push([periodStr, '', '', '', '', '', `Total Vouchers: ${filteredEntries.length}`]);
        sheetData.push([]);
        sheetData.push(['#', 'Date', 'Particulars', 'Voucher Type', 'Order No. / Voucher No.', 'Debit (₹)', 'Credit (₹)']);
        filteredEntries.forEach((e, idx) => {
            sheetData.push([idx + 1, fmtDateDisplay(e.date), e.particulars || '', e.voucher_type || '', e.voucher_no || '', parseFloat(e.debit) || 0, parseFloat(e.credit) || 0]);
        });
        sheetData.push(['', '', '', '', 'TOTAL', parseFloat(calculatedTotalDebit) || 0, parseFloat(calculatedTotalCredit) || 0]);
        sheetData.push([]);
        sheetData.push([`${compName} — Financial Day Book Report`]);
        sheetData.push([`Computer generated report • Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`]);
        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
        worksheet['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Day Book');
        XLSX.writeFile(workbook, `DayBook_${fromDate}_to_${toDate}.xlsx`);
    };

    // Export to PDF
    const handleExportPDF = () => {
        if (!filteredEntries || filteredEntries.length === 0) { Swal.fire('Warning', 'No data to export', 'warning'); return; }
        const doc = new jsPDF('p', 'mm', 'a4');
        const compName = data?.company?.display_name || data?.company_name || data?.company?.name || 'Company';
        const address = data?.company?.address || '';
        const gstNo = data?.company?.gst_no ? `GSTIN: ${data.company.gst_no}` : '';
        const panNo = data?.company?.pan_no ? `PAN: ${data.company.pan_no}` : '';
        const phone = data?.company?.phone ? `Phone: ${data.company.phone}` : '';
        const email = data?.company?.email ? `Email: ${data.company.email}` : '';
        let yPos = 14;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(33, 37, 41);
        doc.text(compName, 14, yPos); yPos += 6;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(108, 117, 125);
        if (address) { doc.text(address, 14, yPos); yPos += 5; }
        const subDetails = [gstNo, panNo, phone, email].filter(Boolean).join('  |  ');
        if (subDetails) { doc.text(subDetails, 14, yPos); yPos += 5; }
        yPos += 2;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(13, 110, 253);
        doc.text('Day Book Report', 14, yPos);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(33, 37, 41);
        const periodText = `Period: ${fmtDateDisplay(fromDate)} to ${fmtDateDisplay(toDate)}`;
        doc.text(periodText, 14, yPos + 5);
        const totalVouchersText = `Total Vouchers: ${filteredEntries.length}`;
        const pageWidth = doc.internal.pageSize.getWidth();
        doc.text(totalVouchersText, pageWidth - 14 - doc.getTextWidth(totalVouchersText), yPos + 5);
        yPos += 10;
        const tableRows = filteredEntries.map((e, idx) => [idx + 1, fmtDateDisplay(e.date), e.particulars || '', e.voucher_type || '', e.voucher_no || '', fmt(e.debit), fmt(e.credit)]);
        tableRows.push(['', '', '', '', 'TOTAL', `Rs. ${fmt(calculatedTotalDebit)}`, `Rs. ${fmt(calculatedTotalCredit)}`]);
        autoTable(doc, {
            startY: yPos,
            head: [['#', 'Date', 'Particulars', 'Voucher Type', 'Order No. / Voucher No.', 'Debit (Rs)', 'Credit (Rs)']],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
            columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 24 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 28 }, 4: { cellWidth: 35 }, 5: { cellWidth: 26, halign: 'right' }, 6: { cellWidth: 26, halign: 'right' } },
            styles: { fontSize: 8, cellPadding: 2.5 },
            didParseCell: (dataCell) => { if (dataCell.row.index === tableRows.length - 1) { dataCell.cell.styles.fontStyle = 'bold'; dataCell.cell.styles.fillColor = [241, 245, 249]; } },
            didDrawPage: (dataPage) => {
                const totalPages = doc.internal.getNumberOfPages();
                const pageHeight = doc.internal.pageSize.getHeight();
                doc.setFontSize(8); doc.setTextColor(148, 163, 184);
                doc.text(`${compName} — Financial Day Book Report`, 14, pageHeight - 8);
                const pageStr = `Page ${dataPage.pageNumber} of ${totalPages}`;
                doc.text(pageStr, pageWidth - 14 - doc.getTextWidth(pageStr), pageHeight - 8);
            }
        });
        doc.save(`DayBook_${fromDate}_to_${toDate}.pdf`);
    };

    const handlePrint = () => { window.print(); };

    return (
        <div className="container-fluid">
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; color: black !important; }
                }
                .tally-row:hover { background-color: #f1f5f9 !important; }
                .is-dark .tally-row:hover { background-color: #334155 !important; }
            `}</style>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        {/* ── Card Header: Title + Filters + Export Buttons ── */}
                        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <Card.Title className="mb-0">Day Book</Card.Title>

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
                                        style={{ width: '140px', height: '34px' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="text-muted fw-semibold" style={{ fontSize: '13px' }}>To</span>
                                    <Form.Control
                                        type="date"
                                        size="sm"
                                        min={fyStart || undefined}
                                        max={fyEnd || undefined}
                                        value={toDate}
                                        onChange={(e) => handleToDateChange(e.target.value)}
                                        style={{ width: '140px', height: '34px' }}
                                    />
                                </div>
                                <Form.Select
                                    size="sm"
                                    value={voucherType}
                                    onChange={(e) => setVoucherType(e.target.value)}
                                    style={{ width: '160px', height: '34px' }}
                                >
                                    {VOUCHER_TYPES.map(vt => (
                                        <option key={vt} value={vt}>{vt}</option>
                                    ))}
                                </Form.Select>

                                {/* Search */}
                                <Form onSubmit={handleSearchSubmit} className="d-flex align-items-center gap-1">
                                    <div style={{ width: '220px', position: 'relative' }}>
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            size="sm"
                                            placeholder="Particulars or Voucher No..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            style={{ height: '34px', paddingLeft: '30px' }}
                                        />
                                    </div>
                                </Form>

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
                                        onClick={handleExportExcel}
                                        style={{ width: '34px', height: '34px', padding: 0 }}
                                        className="d-inline-flex align-items-center justify-content-center"
                                        title="Alt+S – Export Excel"
                                    >
                                        <i className="fas fa-file-excel"></i>
                                    </Button>
                                    <Button
                                        variant="outline-danger"
                                        size="sm"
                                        onClick={handleExportPDF}
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

                        {/* ── Card Body: Table ── */}
                        <Card.Body className="p-0">
                            {/* Print-only company header */}
                            <div className="d-none d-print-block p-4 border-bottom bg-light">
                                <div className="d-flex justify-content-between align-items-start">
                                    <div>
                                        <h4 className="fw-bold text-dark mb-1">{data?.company?.display_name || data?.company_name || data?.company?.name || ''}</h4>
                                        {data?.company?.address && <p className="text-muted mb-1 small"><i className="fa fa-map-marker-alt me-1 text-danger"></i>{data.company.address}</p>}
                                        <div className="d-flex flex-wrap gap-3 text-muted small mt-1">
                                            {data?.company?.gst_no && <span><strong>GSTIN:</strong> {data.company.gst_no}</span>}
                                            {data?.company?.pan_no && <span><strong>PAN:</strong> {data.company.pan_no}</span>}
                                            {data?.company?.phone && <span><strong>Phone:</strong> {data.company.phone}</span>}
                                            {data?.company?.email && <span><strong>Email:</strong> {data.company.email}</span>}
                                        </div>
                                    </div>
                                    <div className="text-end">
                                        <div className="fw-bold text-dark fs-6">Day Book Report</div>
                                        <div className="text-muted small mt-1 fw-semibold">Period: {fmtDateDisplay(fromDate)} to {fmtDateDisplay(toDate)}</div>
                                        <div className="text-muted small mt-1">Total Vouchers: {filteredEntries.length}</div>
                                    </div>
                                </div>
                            </div>

                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                    <p className="mt-2 text-muted fw-semibold" style={{ fontSize: '13px' }}>Loading Day Book entries...</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-responsive-md" style={{ marginBottom: 0 }}>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>VOUCHER NO.</th>
                                                <th>DATE</th>
                                                <th>PARTICULARS</th>
                                                <th>VOUCHER TYPE</th>
                                                <th className="text-end">DEBIT (₹)</th>
                                                <th className="text-end">CREDIT (₹)</th>
                                                <th className="text-end pe-4">ACTIONS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredEntries.length === 0 ? (
                                                <tr>
                                                    <td colSpan="8" className="text-center py-4 text-muted">
                                                        No voucher transactions found matching '{searchTerm || 'selected filter'}'
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentEntries.map((entry, idx) => {
                                                    const isSelected = selectedRowKey === entry.id;
                                                    return (
                                                        <tr
                                                            key={entry.id}
                                                            className="tally-row"
                                                            onClick={() => setSelectedRowKey(entry.id)}
                                                            style={{
                                                                backgroundColor: isSelected ? (isDark ? '#1e293b' : '#f8fafc') : 'transparent',
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            <td className="text-muted">{indexOfFirstItem + idx + 1}</td>
                                                            <td className="text-nowrap">
                                                                {entry.voucher_no}
                                                            </td>
                                                            <td>{fmtDateDisplay(entry.date)}</td>
                                                            <td>{entry.particulars}</td>
                                                            <td>{entry.voucher_type}</td>
                                                            <td className="text-end text-nowrap">
                                                                {fmt(entry.debit)}
                                                            </td>
                                                            <td className="text-end text-nowrap">
                                                                {fmt(entry.credit)}
                                                            </td>
                                                            <td className="text-end pe-4" onClick={e => e.stopPropagation()}>
                                                                <div className="d-flex justify-content-end align-items-center">
                                                                    <Button 
                                                                        variant="outline-info" 
                                                                        size="sm" 
                                                                        className="me-1" 
                                                                        style={{ width: '28px', height: '28px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                                                                        onClick={() => handlePrintVoucher(entry)} 
                                                                        title="Print Voucher"
                                                                    >
                                                                        <i className="fa fa-print"></i>
                                                                    </Button>
                                                                    <EditButton module="finance" onClick={() => handleEditVoucher(entry)} className="me-1" />
                                                                    <DeleteButton module="finance" onClick={() => handleDeleteVoucher(entry)} />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                        <tfoot>
                                            <tr className="fw-bold" style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}>
                                                <td colSpan="5" className="text-end py-2">TOTAL</td>
                                                <td className="text-end py-2">
                                                    ₹ {fmt(calculatedTotalDebit)}
                                                </td>
                                                <td className="text-end py-2">
                                                    ₹ {fmt(calculatedTotalCredit)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>

                                    {/* ── Pagination Controls ── */}
                                    {!loading && filteredEntries.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 px-4 py-3 border-top no-print">
                                            <div className="d-flex align-items-center gap-2">
                                                <span className="text-muted small">Show</span>
                                                <Form.Select
                                                    size="sm"
                                                    value={itemsPerPage}
                                                    onChange={(e) => setItemsPerPage(e.target.value)}
                                                    style={{ width: '80px', height: '32px', fontSize: '12px' }}
                                                >
                                                    <option value={10}>10</option>
                                                    <option value={25}>25</option>
                                                    <option value={50}>50</option>
                                                    <option value={100}>100</option>
                                                    <option value="All">All</option>
                                                </Form.Select>
                                                <span className="text-muted small">entries per page</span>
                                            </div>

                                            <div className="text-muted small">
                                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredEntries.length)} of {filteredEntries.length} entries
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

                            {/* Print footer */}
                            <div className="d-none d-print-flex p-3 border-top bg-light justify-content-between align-items-center text-muted small">
                                <div><i className="fa fa-building me-1"></i><strong>{data?.company?.display_name || data?.company_name || data?.company?.name || ''}</strong> — Financial Day Book Report</div>
                                <div>Computer generated report • Generated on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                            </div>
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* ── Period Modal ── */}
            <Modal show={showPeriodModal} onHide={() => setShowPeriodModal(false)} centered size="sm">
                <Modal.Header closeButton style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                    <Modal.Title className="fs-6 fw-bold text-dark">Select Date Range</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {fyStart && fyEnd && (
                        <div className="alert alert-info py-1 px-2 small mb-3">
                            <i className="fa fa-info-circle me-1"></i>
                            Active FY: <strong>{fmtDateDisplay(fyStart)}</strong> to <strong>{fmtDateDisplay(fyEnd)}</strong>
                        </div>
                    )}
                    <Form.Group className="mb-3">
                        <Form.Label className="small fw-semibold">From Date</Form.Label>
                        <Form.Control
                            type="date"
                            size="sm"
                            min={fyStart || undefined}
                            max={fyEnd || undefined}
                            value={tempFromDate}
                            onChange={(e) => setTempFromDate(e.target.value)}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label className="small fw-semibold">To Date</Form.Label>
                        <Form.Control
                            type="date"
                            size="sm"
                            min={fyStart || undefined}
                            max={fyEnd || undefined}
                            value={tempToDate}
                            onChange={(e) => setTempToDate(e.target.value)}
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" size="sm" onClick={() => setShowPeriodModal(false)}>Cancel</Button>
                    <Button variant="primary" size="sm" onClick={handleApplyPeriod}>Apply</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default DayBook;
