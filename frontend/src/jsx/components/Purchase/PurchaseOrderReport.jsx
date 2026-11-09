import React, { useRef,  useState, useEffect, useCallback, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import Select, { components } from 'react-select';
import { useNavigate } from 'react-router-dom';
import { Modal, Button } from 'react-bootstrap';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import PurchaseService from '../../../services/PurchaseService';
import PurchaseOrderReportCharts from './PurchaseOrderReportCharts';
import { formatDate, getDatePickerFormat } from '../../../utils/dateUtils';
import { usePageTitle } from '../../../context/TitleContext';
import {
    exportToPDF,
    exportToExcel,
    printData
} from '../Assets/exportUtils';

// ── Checkbox Option for Month Dropdown (copied from SalesReportList) ──────────
const CheckboxOption = (props) => {
    return (
        <components.Option {...props}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                    type="checkbox"
                    checked={props.isSelected}
                    onChange={() => null}
                    style={{ marginRight: '8px', cursor: 'pointer' }}
                />
                <label style={{ margin: 0, cursor: 'pointer' }}>{props.label}</label>
            </div>
        </components.Option>
    );
};

// ── Helper: format currency ────────────────────────────────────────────────────
const formatCurrency = (val) =>
    parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

// ── Stat Card ──────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon, color, bg }) => (
    <div
        className="d-flex align-items-center gap-3 p-3 rounded-3"
        style={{
            background: bg,
            border: `1.5px solid ${color}22`,
            flex: '1 1 200px',
            minWidth: '180px',
            transition: 'transform 0.15s, box-shadow 0.15s'
        }}
        onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = `0 6px 20px ${color}18`;
        }}
        onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
        }}
    >
        <div
            className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
            style={{ width: 48, height: 48, background: `${color}18`, fontSize: 22 }}
        >
            {icon}
        </div>
        <div>
            <div
                className="small text-muted mb-1"
                style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}
            >
                {label}
            </div>
            <div className="fw-bold" style={{ fontSize: '1.15rem', color }}>{value}</div>
        </div>
    </div>
);

// ── Detail Modal ───────────────────────────────────────────────────────────────
const PODetailModal = ({ po, show, onHide }) => {
    if (!po) return null;

    const items = po.items || [];
    const totalBaseAmount = items.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
    const totalGST = items.reduce((s, i) => s + (parseFloat(i.gst_amount || 0) || (parseFloat(i.cgst_amount || 0) + parseFloat(i.sgst_amount || 0) + parseFloat(i.igst_amount || 0))), 0);

    return (
        <Modal show={show} onHide={onHide} centered size="lg">
            <Modal.Header closeButton style={{ borderBottom: '1px solid #e9ecef', background: '#f8f9fa' }}>
                <Modal.Title style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                    </svg>
                    PO Detail — {po.po_no}
                </Modal.Title>
            </Modal.Header>

            <Modal.Body className="p-4">
                {/* PO Header Info */}
                <div className="d-flex flex-wrap gap-3 mb-4">
                    <div className="flex-fill p-3 rounded-3 text-center" style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}>
                        <div className="small text-muted mb-1" style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Supplier</div>
                        <div className="fw-bold" style={{ fontSize: '0.95rem', color: '#6366f1' }}>{po.supplier_name || '—'}</div>
                    </div>
                    <div className="flex-fill p-3 rounded-3 text-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <div className="small text-muted mb-1" style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Amount</div>
                        <div className="fw-bold" style={{ fontSize: '0.95rem', color: '#16a34a' }}>{formatCurrency(po.total_amount)}</div>
                    </div>
                    <div className="flex-fill p-3 rounded-3 text-center" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                        <div className="small text-muted mb-1" style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Order Type</div>
                        <div className="fw-bold" style={{ fontSize: '0.95rem', color: '#d97706' }}>{(po.order_type || '').replace(/_/g, ' ')}</div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="d-flex align-items-center gap-2" style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.04em', marginBottom: 10 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        <polyline points="3.29 7 12 12 20.71 7"></polyline>
                        <line x1="12" y1="22" x2="12" y2="12"></line>
                    </svg>
                    Item Breakdown ({items.length} items)
                </div>

                <div className="table-responsive">
                    <table className="table table-sm table-bordered mb-0" style={{ fontSize: '0.85rem' }}>
                        <thead style={{ background: '#f8f9fa' }}>
                            <tr>
                                <th style={{ width: '40px' }}>#</th>
                                <th>Product</th>
                                <th>Warehouse</th>
                                <th className="text-end">Qty</th>
                                <th className="text-end">Rate</th>
                                <th className="text-end">GST %</th>
                                <th className="text-end">GST Amt</th>
                                <th className="text-end">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="text-muted">{idx + 1}</td>
                                    <td className="fw-semibold">{item.product_name || '—'}</td>
                                    <td>{item.warehouse_name || '—'}</td>
                                    <td className="text-end">{item.quantity}</td>
                                    <td className="text-end">{formatCurrency(item.rate)}</td>
                                    <td className="text-end">{item.gst_percent}%</td>
                                    <td className="text-end">{formatCurrency(item.gst_amount)}</td>
                                    <td className="text-end fw-bold">{formatCurrency(item.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot style={{ background: '#f8f9fa', fontWeight: 700 }}>
                            <tr>
                                <td colSpan="6" className="text-end">Totals:</td>
                                <td className="text-end">{formatCurrency(totalGST)}</td>
                                <td className="text-end">{formatCurrency(totalBaseAmount)}</td>
                            </tr>
                            <tr>
                                <td colSpan="7" className="text-end" style={{ color: '#16a34a' }}>Grand Total:</td>
                                <td className="text-end" style={{ color: '#16a34a', fontSize: '1rem' }}>{formatCurrency(po.total_amount)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </Modal.Body>

            <Modal.Footer style={{ borderTop: '1px solid #e9ecef', background: '#f8f9fa' }}>
                <Button variant="secondary" size="sm" onClick={onHide} style={{ borderRadius: 8 }}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const PurchaseOrderReport = () => {
    const navigate = useNavigate();

    const [allData, setAllData] = useState([]);
    usePageTitle("Purchase Order Report");
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'graph' | 'itemGraph'
    const [itemSubTab, setItemSubTab] = useState('amount'); // 'amount' | 'quantity' (sub-tab inside Item Wise View)
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);
    const [selectedMonths, setSelectedMonths] = useState([]);
    const currentDate = new Date();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    const [fromDate, setFromDate] = useState(
        localStorage.getItem('active_fy_start') || `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`
    );
    const [toDate, setToDate] = useState(
        localStorage.getItem('active_fy_end') || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
    );

    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
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
    const [selectedPO, setSelectedPO] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;

    // ── Fetch data ─────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await PurchaseService.getPurchaseOrders();
            setAllData(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Error fetching purchase orders for report:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Filters ────────────────────────────────────────────────────────────────
    const filteredData = useMemo(() => {
        return allData.filter(po => {
            // Date range filter
            if (fromDate && po.entry_date < fromDate) return false;
            if (toDate && po.entry_date > toDate) return false;

            // Text search
            if (searchTerm) {
                const term = searchTerm.toLowerCase().trim();
                const orderTypeText = (po.order_type || '').toLowerCase().replace(/_/g, ' ');
                const itemNames = (po.items || []).map(i => (i.product_name || '').toLowerCase()).join(' ');
                const warehouseNames = (po.items || []).map(i => (i.warehouse_name || '').toLowerCase()).join(' ');

                return (
                    (po.po_no || '').toLowerCase().includes(term) ||
                    (po.supplier_name || '').toLowerCase().includes(term) ||
                    (po.entry_date || '').includes(term) ||
                    (po.other_reference || '').toLowerCase().includes(term) ||
                    String(po.total_amount || '').includes(term) ||
                    orderTypeText.includes(term) ||
                    itemNames.includes(term) ||
                    warehouseNames.includes(term)
                );
            }
            return true;
        });
    }, [allData, fromDate, toDate, searchTerm]);

    // ── Reset page when filters change ─────────────────────────────────────────
    useEffect(() => {
        setCurrentPage(1);
    }, [fromDate, toDate, searchTerm]);

    // ── Aggregated stats ───────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const totalAmount = filteredData.reduce((s, po) => s + parseFloat(po.total_amount || 0), 0);
        return { total: filteredData.length, totalAmount };
    }, [filteredData]);


    // ── Item-Wise & Quantity-Wise Graph Logic ──────────────────────────────────
    const itemMonthlyDataMap = {};
    const itemMonthlyQtyMap = {};
    const itemNamesSet = new Set();
    const itemTotalMap = {};
    const itemTotalQtyMap = {};

    filteredData.forEach(order => {
        const dateStr = order.entry_date;
        if (dateStr && order.items && Array.isArray(order.items)) {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                const monthYear = `${parts[0]}-${parts[1]}`;

                if (!itemMonthlyDataMap[monthYear]) {
                    itemMonthlyDataMap[monthYear] = {};
                }
                if (!itemMonthlyQtyMap[monthYear]) {
                    itemMonthlyQtyMap[monthYear] = {};
                }

                order.items.forEach(item => {
                    const itemName = item.product_name || 'Unknown Item';
                    const amountVal = parseFloat(item.amount) || 0;
                    const qtyVal = parseFloat(item.quantity) || 0;

                    itemNamesSet.add(itemName);

                    // Amount (value)
                    if (!itemMonthlyDataMap[monthYear][itemName]) {
                        itemMonthlyDataMap[monthYear][itemName] = 0;
                    }
                    itemMonthlyDataMap[monthYear][itemName] += amountVal;

                    if (!itemTotalMap[itemName]) {
                        itemTotalMap[itemName] = 0;
                    }
                    itemTotalMap[itemName] += amountVal;

                    // Quantity (units)
                    if (!itemMonthlyQtyMap[monthYear][itemName]) {
                        itemMonthlyQtyMap[monthYear][itemName] = 0;
                    }
                    itemMonthlyQtyMap[monthYear][itemName] += qtyVal;

                    if (!itemTotalQtyMap[itemName]) {
                        itemTotalQtyMap[itemName] = 0;
                    }
                    itemTotalQtyMap[itemName] += qtyVal;
                });
            }
        }
    });

    const itemNames = Array.from(itemNamesSet).sort((a, b) => 
        itemSubTab === 'quantity' 
            ? (itemTotalQtyMap[b] || 0) - (itemTotalQtyMap[a] || 0) 
            : (itemTotalMap[b] || 0) - (itemTotalMap[a] || 0)
    );

    const itemOptions = itemNames.map(name => ({
        value: name,
        label: `${name} (Total: ${itemTotalQtyMap[name]} Units, Value: ${itemTotalMap[name].toLocaleString('en-IN')})`
    }));

    const prevAllDataForTop5 = useRef(null);
    const prevTabForTop5 = useRef(null);
    
    useEffect(() => {
        if (prevAllDataForTop5.current !== allData || prevTabForTop5.current !== itemSubTab) {
            prevAllDataForTop5.current = allData;
            prevTabForTop5.current = itemSubTab;
            
            if (itemOptions.length > 0) {
                const top5 = itemOptions.slice(0, 5).map(opt => ({ label: opt.value, value: opt.value }));
                setSelectedItems(top5);
            } else if (allData.length === 0) {
                setSelectedItems([]);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allData, itemSubTab]);

    const getAllMonths = (start, end) => {
        if (!start || !end) return [];
        const startDate = new Date(start);
        const endDate = new Date(end);
        const months = [];
        let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

        while (current <= last) {
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1).padStart(2, '0');
            months.push(`${year}-${month}`);
            current.setMonth(current.getMonth() + 1);
        }
        return months;
    };

    let allAvailableMonths = getAllMonths(fromDate, toDate);
    if (allAvailableMonths.length === 0) {
        allAvailableMonths = Object.keys(itemMonthlyDataMap).sort();
    }

    // ── Month Dropdown (copied from SalesReportList) ────────────────────────
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const monthOptions = [
        { value: 'all', label: 'Select All' },
        ...allAvailableMonths.map(m => {
            const [year, month] = m.split('-');
            return { value: m, label: `${monthNames[parseInt(month, 10) - 1]} ${year}` };
        })
    ];

    const handleMonthSelectionChange = (selected) => {
        if (!selected) {
            setSelectedMonths([]);
            return;
        }

        const isSelectAll = selected.some(opt => opt.value === 'all');
        const wasSelectAll = selectedMonths.some(opt => opt.value === 'all');

        const allNormalOptions = monthOptions.filter(opt => opt.value !== 'all');

        if (isSelectAll && !wasSelectAll) {
            setSelectedMonths(monthOptions);
        } else if (!isSelectAll && wasSelectAll) {
            setSelectedMonths([]);
        } else if (isSelectAll && wasSelectAll) {
            setSelectedMonths(selected.filter(opt => opt.value !== 'all'));
        } else {
            if (selected.length === allNormalOptions.length && allNormalOptions.length > 0) {
                setSelectedMonths(monthOptions);
            } else {
                setSelectedMonths(selected);
            }
        }
    };

    let sortedMonths = selectedMonths.length > 0
        ? allAvailableMonths.filter(m => selectedMonths.some(sm => sm.value === m))
        : allAvailableMonths;

    // Determine which items to show
    let itemsToDisplay = [];
    if (selectedItems && selectedItems.length > 0) {
        itemsToDisplay = selectedItems.map(opt => opt.value);
    }

    const itemSeries = itemsToDisplay.map(itemName => {
        return {
            name: itemName,
            data: sortedMonths.map(month => (itemMonthlyDataMap[month] && itemMonthlyDataMap[month][itemName]) || 0)
        };
    });

    // Quantity Chart Series
    const itemQtySeries = itemsToDisplay.map(itemName => {
        return {
            name: itemName,
            data: sortedMonths.map(month => (itemMonthlyQtyMap[month] && itemMonthlyQtyMap[month][itemName]) || 0)
        };
    });

    const totalQtyMonthData = sortedMonths.map(month => {
        const items = itemMonthlyQtyMap[month] || {};
        return Object.values(items).reduce((sum, qty) => sum + qty, 0);
    });

    const totalQtySeries = [{
        name: 'Total Quantity',
        data: totalQtyMonthData
    }];


    const itemChartOptions = {
        chart: {
            type: 'line',
            height: 350,
            toolbar: { show: false },
            zoom: { enabled: false },
            fontFamily: 'Inter, sans-serif',
            animations: { enabled: true }
        },
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'],
        dataLabels: { enabled: false },
        stroke: {
            curve: 'smooth',
            width: 3
        },
        xaxis: {
            categories: sortedMonths.map(m => {
                const [yyyy, mm] = m.split('-');
                const date = new Date(yyyy, mm - 1);
                return date.toLocaleString('default', { month: 'short', year: '2-digit' });
            }),
            labels: {
                style: { colors: '#64748b', fontSize: '12px', fontWeight: 500 }
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: { colors: '#64748b', fontSize: '12px', fontWeight: 500 },
                formatter: (val) => val.toFixed(0)
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'right',
            fontWeight: 600,
            fontSize: '13px',
            markers: { radius: 12 }
        },
        grid: {
            borderColor: '#f1f5f9',
            strokeDashArray: 4,
            yaxis: { lines: { show: true } }
        },
        tooltip: {
            theme: 'light',
            y: { formatter: (val) => val.toLocaleString('en-IN', { maximumFractionDigits: 2 }) }
        }
    };

    const totalQuantityMonthData = sortedMonths.map(month => {
        const items = itemMonthlyDataMap[month] || {};
        return Object.values(items).reduce((sum, qty) => sum + qty, 0);
    });

    const totalQuantitySeries = [{
        name: 'Total Amount',
        data: totalQuantityMonthData
    }];

    const itemBarOptions = {
        ...itemChartOptions,
        chart: {
            ...itemChartOptions.chart,
            type: 'bar'
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '15%', // Reduced bar width for better UI
                borderRadius: 4,
            },
        },
        stroke: { show: true, width: 2, colors: ['transparent'] }
    };

    const itemQtyChartOptions = {
        ...itemChartOptions,
        tooltip: {
            theme: 'light',
            y: { formatter: (val) => val.toLocaleString('en-IN') + ' Units' }
        }
    };

    const itemQtyBarOptions = {
        ...itemBarOptions,
        tooltip: {
            theme: 'light',
            y: { formatter: (val) => val.toLocaleString('en-IN') + ' Units' }
        }
    };

    // ── Pagination ─────────────────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, currentPage, rowsPerPage]);

    // ── Export ──────────────────────────────────────────────────────────────────
    const handleExport = (format) => {
        const columns = [
            { header: 'Sl. No.', dataKey: 'index' },
            { header: 'PO No', dataKey: 'po_no' },
            { header: 'Date', dataKey: 'entry_date' },
            { header: 'Supplier', dataKey: 'supplier_name' },
            { header: 'Order Type', dataKey: 'order_type' },
            { header: 'Reference', dataKey: 'other_reference' },
            { header: 'Item Names', dataKey: 'item_names' },
            { header: 'Warehouse', dataKey: 'warehouse_names' },
            { header: 'No. of Items', dataKey: 'item_count' },
            { header: 'Total Amount', dataKey: 'total_amount' }
        ];

        const dataWithIndex = filteredData.map((po, index) => ({
            ...po,
            index: index + 1,
            item_names: (po.items || []).map(i => i.product_name || '').filter(Boolean).join(', ') || '—',
            warehouse_names: [...new Set((po.items || []).map(i => i.warehouse_name).filter(Boolean))].join(', ') || '—',
            item_count: (po.items || []).length
        }));

        if (format === 'pdf') {
            exportToPDF(dataWithIndex, columns, 'purchase_order_report.pdf', 'Purchase Order Report');
        } else if (format === 'excel') {
            exportToExcel(dataWithIndex, columns, 'purchase_order_report.xlsx');
        } else if (format === 'print') {
            printData(dataWithIndex, columns, 'Purchase Order Report');
        }
    };

    // ── Row click handler ──────────────────────────────────────────────────────
    const handleRowClick = (po) => {
        setSelectedPO(po);
        setShowModal(true);
    };

    return (
        <div className="container-fluid">
            <style dangerouslySetInnerHTML={{__html: `
                .controls-container {
                    align-items: flex-start !important;
                }
                .search-bar-container {
                    position: relative !important;
                }
                .search-bar-container .search-icon {
                    left: 12px !important;
                    top: 50% !important;
                    transform: translateY(-50%) !important;
                }
            `}} />

            {/* ── Controls Bar ──────────────────────────────────────────────── */}
            <div className="row">
                <div className="col-lg-12">
                <div className="card">
                    <div className="card-body">

                    <div className="d-flex flex-column gap-3 w-100 mb-4 controls-container">

                        {/* Top Row: View Switcher + Export Buttons */}
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                            <div className="d-flex align-items-start">
                                <div className="d-flex p-1 bg-light rounded-pill" style={{ maxWidth: 'fit-content', border: '1px solid #eaebf0' }}>
                                    <button
                                        className={`btn btn-sm rounded-pill px-4 py-2 fw-semibold d-flex align-items-center ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-muted bg-transparent border-0'}`}
                                        onClick={() => setViewMode('list')}
                                        style={{ border: viewMode === 'list' ? '1px solid #eaebf0' : 'none', color: viewMode === 'list' ? '#00b8d9' : '', transition: 'all 0.2s ease-in-out' }}
                                    >
                                        <i className="fa fa-list me-2"></i> List
                                    </button>
                                    <button
                                        className={`btn btn-sm rounded-pill px-4 py-2 fw-semibold d-flex align-items-center ${viewMode === 'graph' ? 'bg-white shadow-sm' : 'text-muted bg-transparent border-0'}`}
                                        onClick={() => setViewMode('graph')}
                                        style={{ border: viewMode === 'graph' ? '1px solid #eaebf0' : 'none', color: viewMode === 'graph' ? '#00b8d9' : '', transition: 'all 0.2s ease-in-out' }}
                                    >
                                        <i className="fa fa-chart-bar me-2"></i> Graph
                                    </button>
                                    <button
                                        className={`btn btn-sm rounded-pill px-4 py-2 fw-semibold d-flex align-items-center ${viewMode === 'itemGraph' ? 'bg-white shadow-sm' : 'text-muted bg-transparent border-0'}`}
                                        onClick={() => setViewMode('itemGraph')}
                                        style={{ border: viewMode === 'itemGraph' ? '1px solid #eaebf0' : 'none', color: viewMode === 'itemGraph' ? '#00b8d9' : '', transition: 'all 0.2s ease-in-out' }}
                                    >
                                        <i className="fa fa-chart-line me-2"></i> Item Wise View
                                    </button>
                                </div>
                            </div>

                            {viewMode === 'list' && (
                                <div className="d-flex gap-2">
                                    <button className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center" onClick={() => handleExport('pdf')} title="Export PDF" style={{ width: '38px', height: '38px', borderRadius: '8px' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    </button>
                                    <button className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center" onClick={() => handleExport('excel')} title="Export Excel" style={{ width: '38px', height: '38px', borderRadius: '8px' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                    </button>
                                    <button className="btn btn-sm btn-light border p-0 d-flex align-items-center justify-content-center" onClick={() => handleExport('print')} title="Print" style={{ width: '38px', height: '38px', borderRadius: '8px' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Bottom Row: Date Filters + Search/Month select — stays in ONE row on all screens */}
                        <div className="row flex-nowrap w-100 m-0">
                            <div className="col-4 px-1">
                                <div className="d-flex align-items-center gap-2 w-100">
                                    <label className="form-label mb-0 fw-bold flex-shrink-0 text-nowrap">From:</label>
                                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                        <DatePicker
                                            selected={fromDate ? new Date(fromDate.split('-')[0], fromDate.split('-')[1] - 1, fromDate.split('-')[2]) : null}
                                            onChange={(date) => {
                                                if (!date) return;
                                                const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                                                setFromDate(formatted);
                                                setSelectedMonths([]);
                                            }}
                                            dateFormat={getDatePickerFormat()}
                                            placeholderText={getDatePickerFormat().toLowerCase()}
                                            className="form-control form-control-sm"
                                            wrapperClassName="w-100"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="col-4 px-1">
                                <div className="d-flex align-items-center gap-2 w-100">
                                    <label className="form-label mb-0 fw-bold flex-shrink-0 text-nowrap">To:</label>
                                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                        <DatePicker
                                            selected={toDate ? new Date(toDate.split('-')[0], toDate.split('-')[1] - 1, toDate.split('-')[2]) : null}
                                            onChange={(date) => {
                                                if (!date) return;
                                                const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                                                setToDate(formatted);
                                                setSelectedMonths([]);
                                            }}
                                            dateFormat={getDatePickerFormat()}
                                            placeholderText={getDatePickerFormat().toLowerCase()}
                                            className="form-control form-control-sm"
                                            wrapperClassName="w-100"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="col-4 px-1">
                                {viewMode === 'itemGraph' ? (
                                    <Select
                                        isMulti
                                        options={monthOptions}
                                        value={selectedMonths}
                                        onChange={handleMonthSelectionChange}
                                        placeholder={windowWidth < 1200 ? "Months" : "All Months"}
                                        classNamePrefix="select"
                                        closeMenuOnSelect={false}
                                        hideSelectedOptions={false}
                                        components={{ Option: CheckboxOption }}
                                        styles={{
                                            control: (base) => ({
                                                ...base,
                                                borderRadius: '8px',
                                                borderColor: '#cbd5e1',
                                                minHeight: '49px',
                                                height: '49px',
                                                boxShadow: 'none',
                                                '&:hover': { borderColor: '#94a3b8' },
                                                cursor: 'pointer'
                                            }),
                                            valueContainer: (base) => ({
                                                ...base,
                                                maxHeight: '85px',
                                                overflowY: 'auto'
                                            }),
                                            multiValue: (base) => ({
                                                ...base,
                                                backgroundColor: '#eff6ff',
                                                border: '1px solid #bfdbfe',
                                                borderRadius: '6px',
                                                minWidth: 'max-content'
                                            }),
                                            multiValueLabel: (base) => ({
                                                ...base,
                                                color: '#1d4ed8',
                                                fontWeight: 600,
                                                fontSize: '12px',
                                                padding: '2px 4px'
                                            }),
                                            multiValueRemove: (base) => ({
                                                ...base,
                                                borderRadius: '4px',
                                                color: '#60a5fa',
                                                '&:hover': {
                                                    backgroundColor: '#ef4444',
                                                    color: 'white'
                                                },
                                                cursor: 'pointer'
                                            }),
                                            menu: (base) => ({
                                                ...base,
                                                borderRadius: '8px',
                                                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                                                border: '1px solid #e2e8f0',
                                                zIndex: 9999
                                            }),
                                            option: (base, state) => ({
                                                ...base,
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                backgroundColor: state.isSelected ? '#eff6ff' : state.isFocused ? '#f8fafc' : 'white',
                                                color: state.isSelected ? '#1d4ed8' : '#475569',
                                                cursor: 'pointer',
                                                '&:active': { backgroundColor: '#dbeafe' }
                                            })
                                        }}
                                    />
                                ) : (
                                    <div className="search-bar-container w-100">
                                        <span className="search-icon">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                        </span>
                                        <input
                                            type="text"
                                            className="search-input w-100"
                                            style={{ height: '49px' }}
                                            placeholder="Search..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                {/* ── Conditional View ──────────────────────────────────────── */}

                {viewMode === 'itemGraph' && (
                    <div className="mb-4">
                        <div className="row">
                            <div className="col-12 mb-4">
                                <div>
                                    <div className="p-2">

                                        {/* ── Amount Wise / Quantity Wise Sub-Tabs ── */}
                                        <div className="d-flex justify-content-end mb-4">
                                            <div
                                                className="d-flex align-items-center gap-1"
                                                style={{ background: '#f0f1f3', borderRadius: 999, padding: 3 }}
                                            >
                                                <button
                                                    className="btn btn-sm d-flex align-items-center"
                                                    onClick={() => setItemSubTab('amount')}
                                                    style={{
                                                        borderRadius: 999,
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700,
                                                        padding: '5px 16px',
                                                        border: 'none',
                                                        transition: 'all 0.2s',
                                                        background: itemSubTab === 'amount' ? '#fff' : 'transparent',
                                                        color: itemSubTab === 'amount' ? '#00b8d9' : '#8a8f98',
                                                        boxShadow: itemSubTab === 'amount' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none'
                                                    }}
                                                >
                                                    <i className="fa fa-rupee-sign me-2"></i> Amount Wise View
                                                </button>
                                                <button
                                                    className="btn btn-sm d-flex align-items-center"
                                                    onClick={() => setItemSubTab('quantity')}
                                                    style={{
                                                        borderRadius: 999,
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700,
                                                        padding: '5px 16px',
                                                        border: 'none',
                                                        transition: 'all 0.2s',
                                                        background: itemSubTab === 'quantity' ? '#fff' : 'transparent',
                                                        color: itemSubTab === 'quantity' ? '#00b8d9' : '#8a8f98',
                                                        boxShadow: itemSubTab === 'quantity' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none'
                                                    }}
                                                >
                                                    <i className="fa fa-boxes me-2"></i> Quantity Wise View
                                                </button>
                                            </div>
                                        </div>

                                        {itemSubTab === 'amount' && (
                                            <>
                                                {/* ── Total Amount Bar Chart ── */}
                                                <div className="mb-5 border-bottom pb-5">
                                                    <div className="mb-3">
                                                        <h4 className="mb-1 fw-bold text-dark">Total Purchase Amount (Bar)</h4>
                                                        <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Monthly breakdown of total purchase amount</p>
                                                    </div>
                                                    <div style={{ height: '350px' }}>
                                                        {totalQuantitySeries[0].data.length > 0 ? (
                                                            <ReactApexChart options={itemBarOptions} series={totalQuantitySeries} type="bar" height={350} />
                                                        ) : (
                                                            <div className="d-flex flex-column align-items-center justify-content-center h-100">
                                                                <i className="fa fa-chart-bar text-muted mb-2" style={{ fontSize: '32px', opacity: 0.2 }}></i>
                                                                <p className="text-muted">No purchase data available for the selected period</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mb-4">
                                                    <div className="mb-3">
                                                        <h4 className="mb-1 fw-bold text-dark">Item-Wise Purchase Amount (Line)</h4>
                                                        <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Monthly trend of item purchase amounts</p>
                                                    </div>
                                                    <div className="p-3 rounded" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                        <label className="form-label fw-semibold mb-2" style={{ fontSize: '13px', color: '#475569' }}>
                                                            <i className="fa fa-filter me-2 text-muted"></i> Select Items to Compare:
                                                        </label>
                                                        <div style={{ zIndex: 10 }}>
                                                            <Select
                                                                isMulti
                                                                options={itemOptions}
                                                                value={selectedItems}
                                                                onChange={setSelectedItems}
                                                                placeholder="Search and select items..."
                                                                classNamePrefix="select"
                                                                styles={{
                                                                    control: (base) => ({
                                                                        ...base,
                                                                        borderColor: '#cbd5e1',
                                                                        boxShadow: 'none',
                                                                        '&:hover': { borderColor: '#94a3b8' }
                                                                    }),
                                                                    multiValue: (base) => ({
                                                                        ...base,
                                                                        backgroundColor: '#e0e7ff',
                                                                        borderRadius: '6px'
                                                                    }),
                                                                    multiValueLabel: (base) => ({
                                                                        ...base,
                                                                        color: '#3730a3',
                                                                        fontWeight: 600
                                                                    }),
                                                                    multiValueRemove: (base) => ({
                                                                        ...base,
                                                                        color: '#4f46e5',
                                                                        ':hover': { backgroundColor: '#c7d2fe', color: '#312e81' }
                                                                    })
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ height: '350px' }}>
                                                    {!selectedItems || selectedItems.length === 0 ? (
                                                        <div className="d-flex flex-column align-items-center justify-content-center h-100 py-5">
                                                            <i className="fa fa-chart-line mb-3" style={{ fontSize: '48px', color: '#cbd5e1' }}></i>
                                                            <h6 className="fw-semibold text-secondary mb-2">No items selected</h6>
                                                            <p className="text-muted small">Please select items from the dropdown to view their purchase trends.</p>
                                                        </div>
                                                    ) : itemSeries.length > 0 && sortedMonths.length > 0 ? (
                                                        <ReactApexChart options={itemChartOptions} series={itemSeries} type="line" height={350} />
                                                    ) : (
                                                        <div className="d-flex flex-column align-items-center justify-content-center h-100">
                                                            <i className="fa fa-chart-line text-muted mb-2" style={{ fontSize: '32px', opacity: 0.2 }}></i>
                                                            <p className="text-muted">No item data available for the selected period</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}

                                        {itemSubTab === 'quantity' && (
                                            <>
                                                {/* ── Total Quantity Bar Chart ── */}
                                                <div className="mb-5 border-bottom pb-5">
                                                    <div className="mb-3">
                                                        <h4 className="mb-1 fw-bold text-dark">Total Purchase Quantity (Bar)</h4>
                                                        <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Monthly breakdown of total purchase quantities</p>
                                                    </div>
                                                    <div style={{ height: '350px' }}>
                                                        {totalQtySeries[0].data.length > 0 ? (
                                                            <ReactApexChart options={itemQtyBarOptions} series={totalQtySeries} type="bar" height={350} />
                                                        ) : (
                                                            <div className="d-flex flex-column align-items-center justify-content-center h-100">
                                                                <i className="fa fa-chart-bar text-muted mb-2" style={{ fontSize: '32px', opacity: 0.2 }}></i>
                                                                <p className="text-muted">No purchase quantity data available for the selected period</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mb-4">
                                                    <div className="mb-3">
                                                        <h4 className="mb-1 fw-bold text-dark">Item-Wise Purchase Quantity (Line)</h4>
                                                        <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Monthly trend of item purchase quantities</p>
                                                    </div>
                                                    <div className="p-3 rounded" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                        <label className="form-label fw-semibold mb-2" style={{ fontSize: '13px', color: '#475569' }}>
                                                            <i className="fa fa-filter me-2 text-muted"></i> Select Items to Compare:
                                                        </label>
                                                        <div style={{ zIndex: 10 }}>
                                                            <Select
                                                                isMulti
                                                                options={itemOptions}
                                                                value={selectedItems}
                                                                onChange={setSelectedItems}
                                                                placeholder="Search and select items..."
                                                                classNamePrefix="select"
                                                                styles={{
                                                                    control: (base) => ({
                                                                        ...base,
                                                                        borderColor: '#cbd5e1',
                                                                        boxShadow: 'none',
                                                                        '&:hover': { borderColor: '#94a3b8' }
                                                                    }),
                                                                    multiValue: (base) => ({
                                                                        ...base,
                                                                        backgroundColor: '#e0e7ff',
                                                                        borderRadius: '6px'
                                                                    }),
                                                                    multiValueLabel: (base) => ({
                                                                        ...base,
                                                                        color: '#3730a3',
                                                                        fontWeight: 600
                                                                    }),
                                                                    multiValueRemove: (base) => ({
                                                                        ...base,
                                                                        color: '#4f46e5',
                                                                        ':hover': { backgroundColor: '#c7d2fe', color: '#312e81' }
                                                                    })
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ height: '350px' }}>
                                                    {!selectedItems || selectedItems.length === 0 ? (
                                                        <div className="d-flex flex-column align-items-center justify-content-center h-100 py-5">
                                                            <i className="fa fa-chart-line mb-3" style={{ fontSize: '48px', color: '#cbd5e1' }}></i>
                                                            <h6 className="fw-semibold text-secondary mb-2">No items selected</h6>
                                                            <p className="text-muted small">Please select items from the dropdown above to view their quantity trends.</p>
                                                        </div>
                                                    ) : itemQtySeries.length > 0 && sortedMonths.length > 0 ? (
                                                        <ReactApexChart options={itemQtyChartOptions} series={itemQtySeries} type="line" height={350} />
                                                    ) : (
                                                        <div className="d-flex flex-column align-items-center justify-content-center h-100">
                                                            <i className="fa fa-chart-line text-muted mb-2" style={{ fontSize: '32px', opacity: 0.2 }}></i>
                                                            <p className="text-muted">No item quantity data available for the selected period</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'list' ? (
                    <div>
                        <div>
                            <div className="table-responsive">
                                <table className="table table-responsive-md">
                                    <thead>
                                    <tr>
                                        <th style={{ width: '50px' }}>Sl.No</th>
                                        <th>PO No</th>
                                        <th>Date</th>
                                        <th>Supplier</th>
                                        <th>Order Type</th>
                                        {/* <th>Reference</th> */}
                                        {/* <th>Item Name</th> */}
                                        {/* <th>Warehouse</th> */}
                                        <th className="text-center">Items</th>
                                        <th className="text-end">Total Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan="10" className="text-center py-4">
                                                <div className="d-flex align-items-center justify-content-center gap-2">
                                                    <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                                                    <span>Loading purchase orders...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredData.length === 0 ? (
                                        <tr>
                                            <td colSpan="10" className="text-center py-4 text-muted">
                                                <div style={{ fontSize: '2rem', marginBottom: 8 }}>📋</div>
                                                No purchase orders found.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedData.map((po, idx) => {
                                            const globalIdx = (currentPage - 1) * rowsPerPage + idx;
                                            const items = po.items || [];
                                            const itemNames = items
                                                .map(i => i.product_name)
                                                .filter(Boolean);
                                            const warehouseNames = [...new Set(
                                                items.map(i => i.warehouse_name).filter(Boolean)
                                            )];

                                            return (
                                                <tr
                                                    key={po.id || idx}
                                                    onClick={() => handleRowClick(po)}
                                                    style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#f8f9ff'}
                                                    onMouseLeave={e => e.currentTarget.style.background = ''}
                                                >
                                                    <td>{globalIdx + 1}</td>
                                                    <td>
                                                        <span className="text-primary fw-bold">{po.po_no}</span>
                                                    </td>
                                                    <td>{formatDate(po.entry_date)}</td>
                                                    <td className="fw-semibold">{po.supplier_name || '—'}</td>
                                                    <td>
                                                        <span className="badge badge-light text-dark">
                                                            {(po.order_type || '').replace(/_/g, ' ')}
                                                        </span>
                                                    </td>
                                                    {/* <td>{po.other_reference || '—'}</td> */}
                                                    {/* <td>
                                                        <span
                                                            title={itemNames.join(', ')}
                                                            style={{
                                                                maxWidth: '180px',
                                                                display: 'inline-block',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                                verticalAlign: 'middle'
                                                            }}
                                                        >
                                                            {itemNames.length > 0 ? itemNames.join(', ') : '—'}
                                                        </span>
                                                    </td> */}
                                                    {/* <td>
                                                        <span
                                                            title={warehouseNames.join(', ')}
                                                            style={{
                                                                maxWidth: '140px',
                                                                display: 'inline-block',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                                verticalAlign: 'middle'
                                                            }}
                                                        >
                                                            {warehouseNames.length > 0 ? warehouseNames.join(', ') : '—'}
                                                        </span>
                                                    </td> */}
                                                    <td className="text-center">
                                                        <span
                                                            className="badge"
                                                            style={{
                                                                background: '#eef2ff',
                                                                color: '#6366f1',
                                                                fontWeight: 600,
                                                                fontSize: '0.8rem',
                                                                borderRadius: 6
                                                            }}
                                                        >
                                                            {items.length}
                                                        </span>
                                                    </td>
                                                    <td className="text-end fw-bold text-success">
                                                        {formatCurrency(po.total_amount)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="d-flex justify-content-between align-items-center mt-3 mb-4">
                                <div className="text-muted" style={{ fontSize: '13px' }}>
                                    Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredData.length)} of {filteredData.length} entries
                                </div>
                                <nav>
                                    <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                        <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                            <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
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
                                                        <button type="button" className="page-link" onClick={() => setCurrentPage(pageNumber)} style={{ border: 'none' }}>
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
                                            <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
                                                <i className="la la-angle-right" />
                                            </button>
                                        </li>
                                    </ul>
                                </nav>
                            </div>
                        )}
                        </div>
                    </div>
                ) : viewMode === 'graph' ? (
                    <PurchaseOrderReportCharts data={filteredData} />
                ) : null}
                    </div>
                </div>
                </div>
            </div>

            {/* ── Detail Modal ──────────────────────────────────────────────── */}
            <PODetailModal
                po={selectedPO}
                show={showModal}
                onHide={() => { setShowModal(false); setSelectedPO(null); }}
            />
        </div>
    );
};

export default PurchaseOrderReport;