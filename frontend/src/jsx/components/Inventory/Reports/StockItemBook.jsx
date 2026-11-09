import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form, Modal } from 'react-bootstrap';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ThemeContext } from '../../../../context/ThemeContext';
import EditButton from '../../../../components/permissions/EditButton';
import DeleteButton from '../../../../components/permissions/DeleteButton';
import SalesService from '../../../../services/SalesService';
import PurchaseService from '../../../../services/PurchaseService';
import {
    getStockItemBook,
    deleteWarehouseTransfer,
    deletePhysicalStock,
    deleteStockItem,
} from '../../../../services/InventoryService';
import {
    deleteStockJournal,
    deleteManufacturalJournal,
} from '../../../../services/FinanceService';
import axiosInstance from '../../../../services/AxiosInstance';

const StockItemBook = () => {
    const navigate = useNavigate();
    const { background } = useContext(ThemeContext);
    const isDark = background?.value === 'dark';

    const [stockItems, setStockItems] = useState([]);
    const [selectedItemId, setSelectedItemId] = useState('All');
    const [loading, setLoading] = useState(false);
    const [bookData, setBookData] = useState(null);
    const [selectedRowKey, setSelectedRowKey] = useState(null);

    // Filters - Default to current year start
    const now = new Date();
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const [fromDate, setFromDate] = useState(firstDayOfYear);
    const [toDate, setToDate] = useState(lastDayOfMonth);
    const [searchTerm, setSearchTerm] = useState('');

    const [showPeriodModal, setShowPeriodModal] = useState(false);
    const [tempFromDate, setTempFromDate] = useState(firstDayOfYear);
    const [tempToDate, setTempToDate] = useState(lastDayOfMonth);

    // Fetch stock items list robustly
    useEffect(() => {
        const fetchItems = async () => {
            try {
                const res = await axiosInstance.get('/api/inventory/stock-items/simple/');
                let list = [];
                if (Array.isArray(res.data)) {
                    list = res.data;
                } else if (res.data && Array.isArray(res.data.results)) {
                    list = res.data.results;
                } else if (res.data && Array.isArray(res.data.data)) {
                    list = res.data.data;
                }
                
                if (list.length === 0) {
                    const fallbackRes = await axiosInstance.get('/api/inventory/stock-items/');
                    if (Array.isArray(fallbackRes.data)) {
                        list = fallbackRes.data;
                    } else if (fallbackRes.data && Array.isArray(fallbackRes.data.results)) {
                        list = fallbackRes.data.results;
                    }
                }
                setStockItems(list);
            } catch (err) {
                console.error('Failed to fetch stock items list:', err);
                try {
                    const fallbackRes = await axiosInstance.get('/api/inventory/stock-items/');
                    const list = Array.isArray(fallbackRes.data)
                        ? fallbackRes.data
                        : (fallbackRes.data?.results || fallbackRes.data?.data || []);
                    setStockItems(list);
                } catch (fallbackErr) {
                    console.error('Fallback stock items fetch error:', fallbackErr);
                }
            }
        };
        fetchItems();
    }, []);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const params = {};
            if (fromDate) params.from_date = fromDate;
            if (toDate) params.to_date = toDate;
            const res = await getStockItemBook(selectedItemId, params);
            setBookData(res);
        } catch (error) {
            console.error('Error fetching Stock Item Book:', error);
            Swal.fire('Error', 'Failed to fetch Stock Item Book data', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [selectedItemId, fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

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
    }, [fromDate, toDate, bookData, searchTerm, selectedItemId]);

    const handlePrint = () => {
        window.print();
    };

    const handleApplyPeriod = () => {
        setFromDate(tempFromDate);
        setToDate(tempToDate);
        setShowPeriodModal(false);
    };

    const handleEditVoucher = (row) => {
        const tType = (row.transaction_type || '').toLowerCase();
        const vType = (row.voucher_type || '').toLowerCase();
        const rawId = row.reference_id || row.id;
        const vNo = row.voucher_no ? encodeURIComponent(row.voucher_no) : rawId;
        const itemId = row.item_id || rawId;
        const targetEditParam = rawId || vNo;
        const currentBookUrl = encodeURIComponent(window.location.pathname + window.location.search);
        const returnParam = `&returnUrl=${currentBookUrl}`;

        if (tType.includes('sales_return') || tType.includes('sales return') || vType.includes('sales return') || vType.includes('sales_return')) {
            navigate(`/sales-returns?edit=${targetEditParam}${returnParam}`);
        } else if (tType.includes('purchase_return') || tType.includes('purchase return') || vType.includes('purchase return') || vType.includes('purchase_return')) {
            navigate(`/purchase-returns?edit=${targetEditParam}${returnParam}`);
        } else if (tType.includes('sales') || tType.includes('sales_invoice') || vType.includes('sales')) {
            navigate(`/sales/invoices?edit=${targetEditParam}${returnParam}`);
        } else if (tType.includes('purchase') || tType.includes('purchase_invoice') || vType.includes('purchase')) {
            navigate(`/purchase-invoices?edit=${targetEditParam}${returnParam}`);
        } else if (tType.includes('warehouse_transfer') || tType.includes('transfer') || vType.includes('warehouse transfer') || vType.includes('transfer')) {
            navigate(`/inventory/warehouse-transfers?edit=${targetEditParam}${returnParam}`);
        } else if (tType.includes('physical_stock') || tType.includes('physical') || vType.includes('physical stock') || vType.includes('physical')) {
            navigate(`/inventory/physical-stock?edit=${targetEditParam}${returnParam}`);
        } else if (tType.includes('stock_journal') || tType.includes('stock journal') || vType.includes('stock journal')) {
            navigate(`/finance/stock-journals?edit=${targetEditParam}${returnParam}`);
        } else if (tType.includes('manufactur') || vType.includes('manufactur')) {
            navigate(`/finance/manufactural-journals?edit=${targetEditParam}${returnParam}`);
        } else if (tType.includes('opening') || vType.includes('opening')) {
            navigate(`/Inventory/stock-items?edit=${itemId}${returnParam}`);
        } else {
            navigate(`/Inventory/stock-items?edit=${itemId}${returnParam}`);
        }
    };

    const handlePrintVoucher = (row) => {
        const tType = (row.transaction_type || '').toLowerCase();
        const vType = (row.voucher_type || '').toLowerCase();
        const rawId = row.reference_id || row.id;
        const vNo = row.voucher_no ? encodeURIComponent(row.voucher_no) : rawId;

        if (tType.includes('sales_return') || vType.includes('sales return')) {
            navigate(`/sales-returns?print=${vNo}`);
        } else if (tType.includes('purchase_return') || vType.includes('purchase return')) {
            navigate(`/purchase-returns?print=${vNo}`);
        } else if (tType.includes('sales') || vType.includes('sales')) {
            navigate(`/sales/invoices?print=${vNo}`);
        } else if (tType.includes('purchase') || vType.includes('purchase')) {
            navigate(`/purchase-invoices?print=${vNo}`);
        } else if (tType.includes('warehouse_transfer') || vType.includes('transfer')) {
            navigate(`/inventory/warehouse-transfers?print=${vNo}`);
        } else if (tType.includes('physical_stock') || vType.includes('physical')) {
            navigate(`/inventory/physical-stock?print=${vNo}`);
        } else if (tType.includes('stock_journal') || vType.includes('stock journal')) {
            navigate(`/finance/stock-journals?print=${vNo}`);
        } else if (tType.includes('manufactur') || vType.includes('manufactur')) {
            navigate(`/finance/manufactural-journals?print=${vNo}`);
        }
    };

    const handleDeleteVoucher = async (row) => {
        const tType = (row.transaction_type || '').toLowerCase();
        const vType = (row.voucher_type || '').toLowerCase();
        const rawId = row.reference_id || row.id;
        const vNo = row.voucher_no || rawId;

        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Delete ${row.voucher_type || row.transaction_type} ${vNo}? This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                if (tType.includes('sales_return') || vType.includes('sales return')) {
                    await SalesService.deleteSalesReturn(rawId);
                } else if (tType.includes('purchase_return') || vType.includes('purchase return')) {
                    await PurchaseService.deletePurchaseReturn(rawId);
                } else if (tType.includes('sales') || vType.includes('sales')) {
                    await SalesService.deleteSalesInvoice(rawId);
                } else if (tType.includes('purchase') || vType.includes('purchase')) {
                    await PurchaseService.deletePurchaseInvoice(rawId);
                } else if (tType.includes('warehouse_transfer') || vType.includes('transfer')) {
                    await deleteWarehouseTransfer(rawId);
                } else if (tType.includes('physical_stock') || vType.includes('physical')) {
                    await deletePhysicalStock(rawId);
                } else if (tType.includes('stock_journal') || vType.includes('stock journal')) {
                    await deleteStockJournal(rawId);
                } else if (tType.includes('manufactur') || vType.includes('manufactur')) {
                    await deleteManufacturalJournal(rawId);
                } else {
                    await deleteStockItem(row.item_id || rawId);
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
    const entriesList = bookData?.entries || [];
    const filteredEntries = entriesList.filter(item => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            (item.particulars && item.particulars.toLowerCase().includes(term)) ||
            (item.item_name && item.item_name.toLowerCase().includes(term)) ||
            (item.voucher_no && item.voucher_no.toLowerCase().includes(term)) ||
            (item.voucher_type && item.voucher_type.toLowerCase().includes(term)) ||
            (item.warehouse_name && item.warehouse_name.toLowerCase().includes(term)) ||
            (item.batch_number && item.batch_number.toLowerCase().includes(term))
        );
    });

    let currentQty = parseFloat(bookData?.opening_qty || 0);
    let currentVal = parseFloat(bookData?.opening_val || 0);

    const rowsWithBalance = filteredEntries.map((row) => {
        const inQty = parseFloat(row.inward_qty || 0);
        const inVal = parseFloat(row.inward_val || 0);
        const outQty = parseFloat(row.outward_qty || 0);
        const outVal = parseFloat(row.outward_val || 0);

        currentQty += (inQty - outQty);
        currentVal += (inVal - outVal);
        const currentRate = currentQty !== 0 ? (currentVal / currentQty) : 0;

        return {
            ...row,
            running_qty: currentQty,
            running_val: currentVal,
            running_rate: currentRate,
        };
    });

    const totalInwardQty = filteredEntries.reduce((sum, r) => sum + parseFloat(r.inward_qty || 0), 0);
    const totalInwardVal = filteredEntries.reduce((sum, r) => sum + parseFloat(r.inward_val || 0), 0);
    const totalOutwardQty = filteredEntries.reduce((sum, r) => sum + parseFloat(r.outward_qty || 0), 0);
    const totalOutwardVal = filteredEntries.reduce((sum, r) => sum + parseFloat(r.outward_val || 0), 0);
    const closingQty = currentQty;
    const closingVal = currentVal;

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedItemId, fromDate, toDate, searchTerm]);

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

    // Date formatting helper: 2026-04-01 -> 1-Apr-26
    const formatDisplayDate = (dStr) => {
        if (!dStr) return '';
        try {
            const parts = dStr.split('-');
            if (parts.length !== 3) return dStr;
            const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const day = dateObj.getDate();
            const month = months[dateObj.getMonth()];
            const year = dateObj.getFullYear().toString().slice(-2);
            return `${day}-${month}-${year}`;
        } catch (e) {
            return dStr;
        }
    };

    const formatNum = (num, decimals = 2) => {
        if (num === null || num === undefined || isNaN(num)) return '0.00';
        return parseFloat(num).toLocaleString('en-IN', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    const defaultUnit = bookData?.item?.unit || 'Nos';

    const selectedItemObj = selectedItemId === 'All'
        ? { id: 'All', name: 'All Stock Items' }
        : stockItems.find(i => String(i.id) === String(selectedItemId));

    const selectedItemName = bookData?.item?.name || selectedItemObj?.name || 'All Stock Items';

    const exportToExcel = () => {
        const exportData = rowsWithBalance.map(r => ({
            Date: formatDisplayDate(r.date),
            Particulars: r.particulars || '--',
            'Vch Type': r.voucher_type || '--',
            'Vch No.': r.voucher_no || '--',
            'Inward Quantity': r.inward_qty ? `${formatNum(r.inward_qty, 0)} ${r.unit_name || defaultUnit}` : '',
            'Inward Value': r.inward_val ? formatNum(r.inward_val) : '',
            'Outward Quantity': r.outward_qty ? `${formatNum(r.outward_qty, 0)} ${r.unit_name || defaultUnit}` : '',
            'Outward Value': r.outward_val ? formatNum(r.outward_val) : '',
            'Closing Quantity': `${formatNum(r.running_qty, 0)} ${r.unit_name || defaultUnit}`,
            'Closing Value': formatNum(r.running_val)
        }));  

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Item Book');
        XLSX.writeFile(workbook, `StockItemBook_${selectedItemName.replace(/\s+/g, '_')}_${fromDate}_to_${toDate}.xlsx`);
    };

    const exportToPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');

        doc.setFontSize(14);
        doc.text(`Stock Item: ${selectedItemName}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Period: ${formatDisplayDate(fromDate)} to ${formatDisplayDate(toDate)}`, 230, 15);

        const tableColumn = [
            'Date', 'Particulars', 'Vch Type', 'Vch No.',
            'Inward Qty', 'Inward Val',
            'Outward Qty', 'Outward Val',
            'Closing Qty', 'Closing Val'
        ];

        const tableRows = [
            [
                formatDisplayDate(fromDate), 'Opening Balance', '', '',
                '', '',
                '', '',
                `${formatNum(bookData?.opening_qty || 0, 0)} ${defaultUnit}`,
                formatNum(bookData?.opening_val || 0)
            ],
            ...rowsWithBalance.map(r => [
                formatDisplayDate(r.date),
                r.particulars || '--',
                r.voucher_type || '--',
                r.voucher_no || '--',
                r.inward_qty ? `${formatNum(r.inward_qty, 0)} ${r.unit_name || defaultUnit}` : '',
                r.inward_val ? formatNum(r.inward_val) : '',
                r.outward_qty ? `${formatNum(r.outward_qty, 0)} ${r.unit_name || defaultUnit}` : '',
                r.outward_val ? formatNum(r.outward_val) : '',
                `${formatNum(r.running_qty, 0)} ${r.unit_name || defaultUnit}`,
                formatNum(r.running_val)
            ]),
            [
                'Totals:', "Totals as per 'Default' valuation", '', '',
                `${formatNum(totalInwardQty, 0)} ${defaultUnit}`,
                formatNum(totalInwardVal),
                `${formatNum(totalOutwardQty, 0)} ${defaultUnit}`,
                formatNum(totalOutwardVal),
                `${formatNum(closingQty, 0)} ${defaultUnit}`,
                formatNum(closingVal)
            ]
        ];

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 22,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] }
        });

        doc.save(`StockItemBook_${selectedItemName.replace(/\s+/g, '_')}_${fromDate}_to_${toDate}.pdf`);
    };

    return (
        <div className="container-fluid">
            <div className="page-titles no-print" style={{ marginTop: '-30px', padding: '4px 0 6px 0' }}>
                <button
                    onClick={() => window.history.back()}
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>
            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        {/* ── Card Header: Title & Controls (Matching LedgerList) ── */}
                        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <Card.Title className="mb-0">Stock Item Book</Card.Title>

                            {/* Control Bar */}
                            <div className="d-flex align-items-center gap-2 flex-wrap no-print ms-auto">
                                <Form.Select
                                    size="sm"
                                    value={selectedItemId}
                                    onChange={(e) => setSelectedItemId(e.target.value)}
                                    style={{ width: '220px', height: '38px', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}
                                >
                                    <option value="All">All Stock Items</option>
                                    {stockItems.map(item => (
                                        <option key={item.id} value={String(item.id)}>{item.name}</option>
                                    ))}
                                </Form.Select>

                                <div className="d-flex align-items-center gap-1">
                                    <span className="text-muted small fw-semibold">From</span>
                                    <Form.Control
                                        type="date"
                                        size="sm"
                                        value={fromDate}
                                        onChange={(e) => setFromDate(e.target.value)}
                                        style={{ width: '135px', height: '38px', borderRadius: '6px', fontSize: '13px' }}
                                    />
                                </div>
                                <div className="d-flex align-items-center gap-1">
                                    <span className="text-muted small fw-semibold">To</span>
                                    <Form.Control
                                        type="date"
                                        size="sm"
                                        value={toDate}
                                        onChange={(e) => setToDate(e.target.value)}
                                        style={{ width: '135px', height: '38px', borderRadius: '6px', fontSize: '13px' }}
                                    />
                                </div>

                                {/* Search Input with Icon */}
                                <div style={{ width: '220px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>

                                {/* Export Action Buttons */}
                                <div className="d-flex gap-1">
                                    <Button
                                        variant="outline-primary"
                                        size="sm"
                                        onClick={() => { setTempFromDate(fromDate); setTempToDate(toDate); setShowPeriodModal(true); }}
                                        style={{ height: '38px', padding: '0 10px', fontSize: '13px', borderRadius: '6px' }}
                                        className="d-inline-flex align-items-center gap-1"
                                        title="F3 – Select Period"
                                    >
                                        <i className="fas fa-calendar-alt"></i> Period
                                    </Button>
                                    <Button
                                        variant="outline-success"
                                        size="sm"
                                        onClick={exportToExcel}
                                        style={{ height: '38px', width: '38px', padding: 0, borderRadius: '6px' }}
                                        className="d-inline-flex align-items-center justify-content-center"
                                        title="Alt+S – Export Excel"
                                    >
                                        <i className="fas fa-file-excel"></i>
                                    </Button>
                                    <Button
                                        variant="outline-danger"
                                        size="sm"
                                        onClick={exportToPDF}
                                        style={{ height: '38px', width: '38px', padding: 0, borderRadius: '6px' }}
                                        className="d-inline-flex align-items-center justify-content-center"
                                        title="Alt+D – Export PDF"
                                    >
                                        <i className="fas fa-file-pdf"></i>
                                    </Button>
                                    <Button
                                        variant="outline-secondary"
                                        size="sm"
                                        onClick={handlePrint}
                                        style={{ height: '38px', width: '38px', padding: 0, borderRadius: '6px' }}
                                        className="d-inline-flex align-items-center justify-content-center"
                                        title="Alt+R – Print Report"
                                    >
                                        <i className="fas fa-print"></i>
                                    </Button>
                                </div>
                            </div>
                        </Card.Header>

                        <Card.Body>
                            {/* Stock Item Header Info Strip */}
                            <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom" style={{ fontSize: '14px' }}>
                                <div>
                                    <span className="text-muted">Stock Item: </span>
                                    <span className="fw-bold text-dark">{selectedItemName}</span>
                                </div>
                                <div className="text-end text-muted small">
                                    <span>Period: {formatDisplayDate(fromDate)} to {formatDisplayDate(toDate)}</span>
                                </div>
                            </div>

                            {/* Print-only company header */}
                            <div className="d-none d-print-block p-3 border-bottom mb-3">
                                <div className="d-flex justify-content-between align-items-start">
                                    <div>
                                        <h4 className="fw-bold mb-1">{bookData?.company?.display_name || bookData?.company?.name || ''}</h4>
                                        {bookData?.company?.address && <p className="mb-1 small">{bookData.company.address}</p>}
                                        <div className="d-flex gap-3 small text-muted">
                                            {bookData?.company?.gst_no && <span>GSTIN: {bookData.company.gst_no}</span>}
                                            {bookData?.company?.phone && <span>Phone: {bookData.company.phone}</span>}
                                        </div>
                                    </div>
                                    <div className="text-end">
                                        <h5 className="fw-bold mb-1">Stock Item Register</h5>
                                        <div className="small text-muted">Period: {formatDisplayDate(fromDate)} to {formatDisplayDate(toDate)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading Stock Register...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-responsive-md align-middle mb-0">
                                        <thead>
                                            <tr>
                                                <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>SL NO</strong></th>
                                                <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>DATE</strong></th>
                                                <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>PARTICULARS</strong></th>
                                                <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>VOUCHER TYPE</strong></th>
                                                <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>VOUCHER NO</strong></th>
                                                <th className="text-end" style={{ padding: '12px 16px', fontSize: '13px' }}><strong>INWARDS</strong></th>
                                                <th className="text-end" style={{ padding: '12px 16px', fontSize: '13px' }}><strong>OUTWARDS</strong></th>
                                                <th className="text-end" style={{ padding: '12px 16px', fontSize: '13px' }}><strong>CLOSING BALANCE</strong></th>
                                                <th className="text-end no-print" style={{ padding: '12px 16px', fontSize: '13px' }}><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan="9" className="text-center py-4 text-muted">
                                                        No stock vouchers found for the selected period.
                                                    </td>
                                                </tr>
                                            ) : (
                                                paginatedRows.map((row, idx) => {
                                                    const absoluteIndex = (currentPage - 1) * pageSize + idx + 1;
                                                    return (
                                                        <tr 
                                                            key={row.id || idx} 
                                                            onClick={() => setSelectedRowKey(idx)}
                                                            onDoubleClick={() => handleEditVoucher(row)}
                                                            style={{ 
                                                                backgroundColor: selectedRowKey === idx ? (isDark ? '#334155' : '#f1f5f9') : 'transparent', 
                                                                cursor: 'pointer' 
                                                            }}
                                                        >
                                                            <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>{absoluteIndex}</td>
                                                            <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>{formatDisplayDate(row.date)}</td>
                                                            <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                                                                <span 
                                                                    className="fw-bold text-dark cursor-pointer" 
                                                                    style={{ cursor: 'pointer', textDecoration: 'underline' }} 
                                                                    onClick={() => handleEditVoucher(row)}
                                                                    title="Click to view/edit voucher"
                                                                >
                                                                    {row.particulars || row.item_name || '--'}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                                                                {row.voucher_type || '--'}
                                                            </td>
                                                            <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                                                                {row.voucher_no || '--'}
                                                            </td>
                                                            
                                                            {/* Inwards */}
                                                            <td className="text-end" style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                                                                {row.inward_qty ? (
                                                                    <div>
                                                                        <div className="fw-bold">{formatNum(row.inward_qty, 0)} {row.unit_name || defaultUnit}</div>
                                                                        <small className="text-muted fw-normal">₹{formatNum(row.inward_val)}</small>
                                                                    </div>
                                                                ) : '--'}
                                                            </td>

                                                            {/* Outwards */}
                                                            <td className="text-end" style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                                                                {row.outward_qty ? (
                                                                    <div>
                                                                        <div className="fw-bold">{formatNum(row.outward_qty, 0)} {row.unit_name || defaultUnit}</div>
                                                                        <small className="text-muted fw-normal">₹{formatNum(row.outward_val)}</small>
                                                                    </div>
                                                                ) : '--'}
                                                            </td>

                                                            {/* Closing */}
                                                            <td className="text-end" style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                                                                <div className="fw-bold">{formatNum(row.running_qty, 0)} {row.unit_name || defaultUnit}</div>
                                                                <small className="text-muted fw-normal">₹{formatNum(row.running_val)}</small>
                                                            </td>

                                                            {/* Actions */}
                                                            <td className="text-end no-print" style={{ padding: '10px 16px', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                                                                <div className="d-flex justify-content-end align-items-center">
                                                                    <Button
                                                                        variant="outline-info"
                                                                        size="sm"
                                                                        className="shadow me-1"
                                                                        style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '12px', borderRadius: '6px' }}
                                                                        onClick={() => handlePrintVoucher(row)}
                                                                        title="Print Voucher"
                                                                    >
                                                                        <i className="fa fa-print"></i>
                                                                    </Button>
                                                                    <EditButton
                                                                        module="inventory"
                                                                        onClick={() => handleEditVoucher(row)}
                                                                        className="me-1"
                                                                    />
                                                                    <DeleteButton
                                                                        module="inventory"
                                                                        onClick={() => handleDeleteVoucher(row)}
                                                                    />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                        {/* Totals Footer Row */}
                                        <tfoot>
                                            <tr className="fw-bold border-top border-bottom border-2 text-nowrap" style={{ fontSize: '13px' }}>
                                                <td colSpan="5" style={{ padding: '12px 16px' }} className="text-dark">Totals as per 'Default' valuation :</td>
                                                <td className="text-end" style={{ padding: '12px 16px' }}>
                                                    <div>{formatNum(totalInwardQty, 0)} {defaultUnit}</div>
                                                    <small className="text-muted fw-normal">₹{formatNum(totalInwardVal)}</small>
                                                </td>
                                                <td className="text-end" style={{ padding: '12px 16px' }}>
                                                    <div>{formatNum(totalOutwardQty, 0)} {defaultUnit}</div>
                                                    <small className="text-muted fw-normal">₹{formatNum(totalOutwardVal)}</small>
                                                </td>
                                                <td className="text-end" style={{ padding: '12px 16px' }}>
                                                    <div>{formatNum(closingQty, 0)} {defaultUnit}</div>
                                                    <small className="text-muted fw-normal">₹{formatNum(closingVal)}</small>
                                                </td>
                                                <td className="no-print"></td>
                                            </tr>
                                        </tfoot>
                                    </table>

                                    {/* Pagination (Matching LedgerList) */}
                                    {totalPages > 1 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 no-print">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                Showing {rowsWithBalance.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, rowsWithBalance.length)} of {rowsWithBalance.length} entries
                                            </div>
                                            <nav>
                                                <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                    <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                        <button 
                                                            type="button" 
                                                            className="page-link" 
                                                            onClick={() => handlePageChange(currentPage - 1)} 
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
                                                                        onClick={() => handlePageChange(pageNumber)}
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
                                                            onClick={() => handlePageChange(currentPage + 1)} 
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
                </div>
            </div>

            {/* ── Modal: Period Selector (F3) ── */}
            <Modal show={showPeriodModal} onHide={() => setShowPeriodModal(false)} centered size="sm">
                <Modal.Header closeButton>
                    <Modal.Title className="fs-6 fw-bold">Select Period (F3)</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group className="mb-3">
                        <Form.Label className="small fw-semibold">From Date</Form.Label>
                        <Form.Control
                            type="date"
                            size="sm"
                            value={tempFromDate}
                            onChange={(e) => setTempFromDate(e.target.value)}
                        />
                    </Form.Group>
                    <Form.Group className="mb-2">
                        <Form.Label className="small fw-semibold">To Date</Form.Label>
                        <Form.Control
                            type="date"
                            size="sm"
                            value={tempToDate}
                            onChange={(e) => setTempToDate(e.target.value)}
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer className="p-2">
                    <Button variant="secondary" size="sm" onClick={() => setShowPeriodModal(false)}>Cancel</Button>
                    <Button variant="primary" size="sm" onClick={handleApplyPeriod}>Apply Period</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default StockItemBook;
