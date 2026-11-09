import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import SalesService from '../../../services/SalesService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import ReactApexChart from 'react-apexcharts';
import Select, { components } from 'react-select';
import DatePicker from 'react-datepicker';
import { Modal, Button, Card } from 'react-bootstrap';

const formatCurrency = (val) => (
    <>{parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
);

const InvoiceDetailModal = ({ invoice, show, onHide }) => {
    if (!invoice) return null;

    const items = invoice.items || [];
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
                    invoice Detail — {invoice.invoice_no}
                </Modal.Title>
            </Modal.Header>

            <Modal.Body className="p-4">
                {/* invoice Header Info */}
                <div className="d-flex flex-wrap gap-3 mb-4">
                    <div className="flex-fill p-3 rounded-3 text-center" style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}>
                        <div className="small text-muted mb-1" style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Customer</div>
                        <div className="fw-bold" style={{ fontSize: '0.95rem', color: '#6366f1' }}>{invoice.customer_ledger_name || '—'}</div>
                    </div>
                    <div className="flex-fill p-3 rounded-3 text-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <div className="small text-muted mb-1" style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Amount</div>
                        <div className="fw-bold" style={{ fontSize: '0.95rem', color: '#16a34a' }}>{formatCurrency(invoice.total_amount)}</div>
                    </div>
                    <div className="flex-fill p-3 rounded-3 text-center" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                        <div className="small text-muted mb-1" style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Order Type</div>
                        <div className="fw-bold" style={{ fontSize: '0.95rem', color: '#d97706' }}>{(invoice.order_type || '').replace(/_/g, ' ')}</div>
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
                            {items.map((item, idx) => {
                                const itemGstAmt = parseFloat(item.gst_amount || 0) || (parseFloat(item.cgst_amount || 0) + parseFloat(item.sgst_amount || 0) + parseFloat(item.igst_amount || 0));
                                return (
                                    <tr key={idx}>
                                        <td className="text-muted">{idx + 1}</td>
                                        <td className="fw-semibold">{item.product_name || '—'}</td>
                                        <td>{item.warehouse_name || '—'}</td>
                                        <td className="text-end">{item.quantity}</td>
                                        <td className="text-end">{formatCurrency(item.rate)}</td>
                                        <td className="text-end">{item.gst_percent}%</td>
                                        <td className="text-end">{formatCurrency(itemGstAmt)}</td>
                                        <td className="text-end fw-bold">{formatCurrency(item.amount)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot style={{ background: '#f8f9fa', fontWeight: 700 }}>
                            <tr>
                                <td colSpan="6" className="text-end">Totals:</td>
                                <td className="text-end">{formatCurrency(totalGST)}</td>
                                <td className="text-end">{formatCurrency(totalBaseAmount)}</td>
                            </tr>
                            <tr>
                                <td colSpan="7" className="text-end" style={{ color: '#16a34a' }}>Grand Total:</td>
                                <td className="text-end" style={{ color: '#16a34a', fontSize: '1rem' }}>{formatCurrency(invoice.total_amount)}</td>
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

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CustomerSalesInvoiceReportList = () => {
    // ── State ──────────────────────────────────────────────────────────────
    const [salesInvoices, setSalesInvoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('list');
    const [itemSubTab, setItemSubTab] = useState('amount'); // 'amount' | 'quantity'
    const [selectedItems, setSelectedItems] = useState([]);
    const [selectedMonths, setSelectedMonths] = useState([]);
    const [filterCustomer, setFilterCustomer] = useState('');
    const [selectedInvoice, setselectedInvoice] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemCurrentPage, setItemCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
        setItemCurrentPage(1);
    }, [searchTerm, filterCustomer]);

    const allUniqueCustomers = useMemo(() => {
        return [...new Set(salesInvoices.map(item => item.customer_ledger_name).filter(Boolean))].sort();
    }, [salesInvoices]);


    // Default to current month
    const currentDate = new Date();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    const [fromDate, setFromDate] = useState(
        localStorage.getItem('active_fy_start') || `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`
    );
    const [toDate, setToDate] = useState(
        localStorage.getItem('active_fy_end') || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
    );

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

    // ── Fetch ──────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (fromDate) params.from_date = fromDate;
            if (toDate) params.to_date = toDate;

            const res = await SalesService.getSalesInvoices(params);
            setSalesInvoices(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching customer sales report:', err);
        } finally {
            setLoading(false);
        }
    }, [fromDate, toDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ── Filtered list (client-side search & date filter) ───────────────────
    const filteredData = salesInvoices.filter((item) => {
        const term = searchTerm.toLowerCase();

        let dateInRange = true;
        const itemDate = item.entry_date ? item.entry_date.split('T')[0] : null;
        if (fromDate && (!itemDate || itemDate < fromDate)) dateInRange = false;
        if (toDate && (!itemDate || itemDate > toDate)) dateInRange = false;

        let customerMatches = true;
        if (filterCustomer && item.customer_ledger_name !== filterCustomer) {
            customerMatches = false;
        }

        return dateInRange && customerMatches && (
            (item.invoice_no || '').toLowerCase().includes(term) ||
            (item.entry_date || '').toLowerCase().includes(term) ||
            (item.customer_ledger_name || '').toLowerCase().includes(term) ||
            (item.status || '').toLowerCase().includes(term) ||
            (item.approval_status || '').toLowerCase().includes(term) ||
            String(item.total_amount || '').toLowerCase().includes(term)
        );
    });

    // ── Pagination Logic ───────────────────────────────────────────────────
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);


    // ── Chart Logic ────────────────────────────────────────────────────────
    // ── Item-Wise Graph Logic ──────────────────────────────────────────────
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
                    itemNamesSet.add(itemName);

                    const amountVal = parseFloat(item.amount) || parseFloat(item.net_amount) || parseFloat(item.total_amount) || 0;
                    const qtyVal = parseFloat(item.quantity) || 0;

                    if (!itemMonthlyDataMap[monthYear][itemName]) {
                        itemMonthlyDataMap[monthYear][itemName] = 0;
                    }
                    itemMonthlyDataMap[monthYear][itemName] += amountVal;

                    if (!itemTotalMap[itemName]) {
                        itemTotalMap[itemName] = 0;
                    }
                    itemTotalMap[itemName] += amountVal;

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

    const allAvailableMonths = [];
    if (fromDate && toDate) {
        let start = new Date(fromDate);
        let end = new Date(toDate);
        start = new Date(start.getFullYear(), start.getMonth(), 1);
        end = new Date(end.getFullYear(), end.getMonth(), 1);
        let current = start;
        while (current <= end) {
            const year = current.getFullYear();
            const m = current.getMonth() + 1;
            const monthStr = m < 10 ? `0${m}` : `${m}`;
            allAvailableMonths.push(`${year}-${monthStr}`);
            current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        }
    } else {
        for (let year = 2025; year <= 2026; year++) {
            for (let m = 1; m <= 12; m++) {
                const monthStr = m < 10 ? `0${m}` : `${m}`;
                allAvailableMonths.push(`${year}-${monthStr}`);
            }
        }
    }

    const filteredItemMonthCategories = selectedMonths.length > 0
        ? allAvailableMonths.filter(m => selectedMonths.some(sm => sm.value === m))
        : allAvailableMonths;

    const monthOptions = [
        { value: 'all', label: 'Select All' },
        ...allAvailableMonths.map(m => {
            const [year, month] = m.split('-');
            return { value: m, label: `${monthNames[parseInt(month, 10) - 1]} ${year}` };
        })
    ];

    const itemNames = Array.from(itemNamesSet).sort((a, b) =>
        itemSubTab === 'quantity'
            ? (itemTotalQtyMap[b] || 0) - (itemTotalQtyMap[a] || 0)
            : (itemTotalMap[b] || 0) - (itemTotalMap[a] || 0)
    );

    const prevsalesInvoicesForTop5 = useRef(null);
    const prevTabForTop5 = useRef(null);

    useEffect(() => {
        if (prevsalesInvoicesForTop5.current !== salesInvoices || prevTabForTop5.current !== itemSubTab) {
            prevsalesInvoicesForTop5.current = salesInvoices;
            prevTabForTop5.current = itemSubTab;

            if (itemNames.length > 0) {
                const top5 = itemNames.slice(0, 5).map(name => ({ label: name, value: name }));
                setSelectedItems(top5);
            } else if (salesInvoices.length === 0) {
                setSelectedItems([]);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [salesInvoices, itemSubTab]);

    const itemSeriesAmount = itemNames.map(itemName => {
        return {
            name: itemName,
            data: filteredItemMonthCategories.map(month => (itemMonthlyDataMap[month] && itemMonthlyDataMap[month][itemName]) || 0)
        };
    });

    const itemSeriesQty = itemNames.map(itemName => {
        return {
            name: itemName,
            data: filteredItemMonthCategories.map(month => (itemMonthlyQtyMap[month] && itemMonthlyQtyMap[month][itemName]) || 0)
        };
    });

    const totalAmountMonthData = filteredItemMonthCategories.map(month => {
        let monthTotal = 0;
        itemNames.forEach(itemName => {
            monthTotal += (itemMonthlyDataMap[month] && itemMonthlyDataMap[month][itemName]) || 0;
        });
        return monthTotal;
    });

    const totalQuantityMonthData = filteredItemMonthCategories.map(month => {
        let monthTotal = 0;
        itemNames.forEach(itemName => {
            monthTotal += (itemMonthlyQtyMap[month] && itemMonthlyQtyMap[month][itemName]) || 0;
        });
        return monthTotal;
    });

    const totalAmountSeries = [{ name: 'Total Amount', data: totalAmountMonthData }];
    const totalQuantitySeries = [{ name: 'Total Quantity', data: totalQuantityMonthData }];

    const itemOptions = itemNames.map(name => ({ label: name, value: name }));
    const filteredItemSeriesAmount = selectedItems.length > 0
        ? itemSeriesAmount.filter(s => selectedItems.some(item => item.value === s.name))
        : [];
    const filteredItemSeriesQty = selectedItems.length > 0
        ? itemSeriesQty.filter(s => selectedItems.some(item => item.value === s.name))
        : [];

    const formattedItemMonthCategories = filteredItemMonthCategories.map(m => {
        const [year, month] = m.split('-');
        return `${monthNames[parseInt(month, 10) - 1]} ${year}`;
    });

    const itemChartOptionsBase = {
        tooltip: {
            shared: true,
            intersect: false,
            custom: function ({ series, seriesIndex, dataPointIndex, w }) {
                const category = w.globals.labels[dataPointIndex];
                let items = [];
                series.forEach((s, i) => {
                    if (s[dataPointIndex] > 0) {
                        items.push({
                            name: w.globals.seriesNames[i],
                            val: s[dataPointIndex],
                            color: w.globals.colors[i]
                        });
                    }
                });

                items.sort((a, b) => b.val - a.val);

                let html = `<div class="apexcharts-tooltip-title" style="font-family: Inter, sans-serif; font-size: 13px; font-weight: 600; padding: 8px 12px; background: #f8f9fa; border-bottom: 1px solid #eaebf0; margin-bottom: 0;">${category}</div>`;
                html += `<div class="apexcharts-tooltip-series-group apexcharts-active" style="display: flex; flex-direction: column; padding: 8px 12px; gap: 8px;">`;

                items.forEach(item => {
                    html += `
                        <div class="d-flex align-items-center justify-content-between" style="font-family: Inter, sans-serif; font-size: 13px;">
                            <div class="d-flex align-items-center">
                                <span style="background-color: ${item.color}; width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 8px;"></span>
                                <span style="color: #64748b;">${item.name}</span>
                            </div>
                            <span style="font-weight: 600; color: #1e293b; margin-left: 16px;">${itemSubTab === 'amount' ? item.val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : item.val.toLocaleString() + ' units'}</span>
                        </div>
                    `;
                });

                if (items.length === 0) {
                    html += `<div style="font-family: Inter, sans-serif; font-size: 13px; color: #64748b;">No items</div>`;
                }

                html += `</div>`;
                return html;
            }
        },
        chart: {
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: false }
        },
        dataLabels: { enabled: false },
        xaxis: {
            categories: formattedItemMonthCategories,
            labels: {
                style: { colors: '#64748b', fontSize: '13px', fontWeight: 600 }
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: { colors: '#64748b', fontSize: '13px', fontWeight: 500 }
            }
        },
        grid: {
            borderColor: '#f1f5f9',
            strokeDashArray: 4,
            xaxis: { lines: { show: true } },
            yaxis: { lines: { show: true } },
            padding: { top: 20, right: 20, bottom: 0, left: 20 }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'right',
            fontSize: '13px',
            markers: { radius: 12 }
        }
    };

    const itemBarOptions = {
        ...itemChartOptionsBase,
        chart: { ...itemChartOptionsBase.chart, type: 'bar', height: 350 },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '55%',
                borderRadius: 4,
            },
        },
        stroke: { show: true, width: 2, colors: ['transparent'] }
    };

    const itemLineOptions = {
        ...itemChartOptionsBase,
        chart: { ...itemChartOptionsBase.chart, type: 'line', height: 350 },
        stroke: { curve: 'smooth', width: 3 },
        markers: { size: 4, strokeWidth: 2, hover: { size: 6 } },
        legend: {
            ...itemChartOptionsBase.legend,
            show: selectedItems.length > 0
        }
    };

    const chartDataMap = {};
    filteredData.forEach(item => {
        const customerName = item.customer_ledger_name || 'Unknown Customer';

        if (!chartDataMap[customerName]) {
            chartDataMap[customerName] = { total: 0, count: 0 };
        }
        chartDataMap[customerName].total += parseFloat(item.total_amount) || 0;
        chartDataMap[customerName].count += 1;
    });

    const categories = Object.keys(chartDataMap).sort();
    const seriesData = categories.map(key => chartDataMap[key].total);
    const orderCountData = categories.map(key => chartDataMap[key].count);

    const totalSalesAmount = seriesData.reduce((acc, curr) => acc + curr, 0);

    const chartOptions = {
        chart: {
            type: 'bar',
            height: 400,
            toolbar: { show: false },
            fontFamily: 'Inter, sans-serif'
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '35%',
                borderRadius: 6,
                borderRadiusApplication: 'end'
            },
        },
        dataLabels: { enabled: false },
        stroke: { show: true, width: 2, colors: ['transparent'] },
        xaxis: {
            categories: categories,
            labels: {
                rotate: -45,
                rotateAlways: true,
                style: {
                    colors: '#64748b',
                    fontSize: '12px',
                    fontWeight: 500,
                }
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                formatter: function (val) {
                    return '' + val.toLocaleString('en-IN');
                },
                style: {
                    colors: '#64748b',
                    fontSize: '13px',
                    fontWeight: 500,
                }
            }
        },
        grid: {
            borderColor: '#f1f5f9',
            strokeDashArray: 4,
            yaxis: {
                lines: { show: true }
            }
        },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'light',
                type: 'vertical',
                shadeIntensity: 0.25,
                gradientToColors: ['#3b82f6'],
                inverseColors: false,
                opacityFrom: 1,
                opacityTo: 0.8,
                stops: [0, 100]
            }
        },
        tooltip: {
            theme: 'light',
            custom: function ({ series, seriesIndex, dataPointIndex, w }) {
                const displayKey = w.globals.labels[dataPointIndex];
                const val = series[seriesIndex][dataPointIndex];
                const formattedVal = "" + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const count = orderCountData[dataPointIndex];

                return `
                    <div style="font-family: Inter, sans-serif; font-size: 13px; min-width: 170px; background: #fff;">
                        <div style="font-weight: 600; padding: 8px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #1e293b;">
                            ${displayKey}
                        </div>
                        <div style="padding: 10px 12px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                <div style="display: flex; align-items: center;">
                                    <span style="display: inline-block; width: 10px; height: 10px; background-color: #1e40af; border-radius: 50%; margin-right: 8px;"></span>
                                    <span style="color: #64748b;">Total Amount:</span>
                                </div>
                                <span style="font-weight: 600; color: #1e293b;">${formattedVal}</span>
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center;">
                                    <span style="display: inline-block; width: 10px; height: 10px; background-color: #10b981; border-radius: 50%; margin-right: 8px;"></span>
                                    <span style="color: #64748b;">Orders:</span>
                                </div>
                                <span style="font-weight: 600; color: #1e293b;">${count}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
        },
        colors: ['#1e40af']
    };

    const series = [{
        name: 'Total Amount',
        data: seriesData
    }];

    // ── Customer Donut Chart Logic ─────────────────────────────────────────
    const donutOptions = {
        chart: {
            type: 'donut',
            fontFamily: 'Inter, sans-serif'
        },
        labels: categories,
        dataLabels: { enabled: false },
        plotOptions: {
            pie: {
                donut: {
                    size: '75%',
                    labels: {
                        show: true,
                        name: { show: true, fontSize: '14px', color: '#64748b' },
                        value: {
                            show: true,
                            fontSize: '16px',
                            fontWeight: 'bold',
                            color: '#1e293b',
                            formatter: function (val) {
                                return "" + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            }
                        }
                    }
                }
            }
        },
        legend: {
            position: 'bottom',
            fontSize: '13px',
            markers: { radius: 12 }
        },
        tooltip: {
            theme: 'light',
            fillSeriesColor: false,
            y: {
                formatter: function (val) {
                    return "" + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
            }
        },
        stroke: { show: true, colors: ['#fff'], width: 2 },
        colors: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#d946ef']
    };

    // ── Helper ─────────────────────────────────────────────────────────────
    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Delivered': return 'badge badge-success light';
            case 'Pending': return 'badge badge-warning light';
            case 'Cancelled': return 'badge badge-danger light';
            case 'Shipped': return 'badge badge-info light';
            case 'On Hold': return 'badge badge-secondary light';
            default: return 'badge bg-light text-dark';
        }
    };

    const getApprovalStatusBadgeClass = (status) => {
        switch (status) {
            case 'Approved': return 'badge badge-success light';
            case 'Not Approved': return 'badge badge-warning light';
            case 'Rejected': return 'badge badge-danger light';
            default: return 'badge bg-light text-dark';
        }
    };

    const handleDateInputAndSyncMonths = (newFrom, newTo) => {
        setFromDate(newFrom);
        setToDate(newTo);
        setSelectedMonths([]);
    };

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

    const handleExport = (format) => {
        let dataToExport = [];
        let columns = [];
        let title = '';

        {
            columns = [
                { header: 'Sl. No.', dataKey: 'index' },
                { header: 'Order No', dataKey: 'invoice_no' },
                { header: 'Entry Date', dataKey: 'entry_date' },
                { header: 'Customer', dataKey: 'customer_ledger_name', formatter: (v) => v || '—' },
                { header: 'Approval Status', dataKey: 'approval_status', formatter: (v) => v || '—' },
                { header: 'Status', dataKey: 'status' },
                { header: 'Total Amount', dataKey: 'total_amount' }
            ];
            dataToExport = filteredData.map((d, i) => ({
                ...d,
                index: i + 1,
                entry_date: d.entry_date ? d.entry_date.split('T')[0].split('-').reverse().join('-') : '—'
            }));
            title = `Customer Wise Sales Report (${fromDate || 'All'} to ${toDate || 'All'})`;
        }

        if (format === 'pdf') exportToPDF(dataToExport, columns, 'customer_sales_report.pdf', title);
        else if (format === 'excel') exportToExcel(dataToExport, columns, 'customer_sales_report.xlsx');
        else if (format === 'print') printData(dataToExport, columns, title);
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="container-fluid">
            <style dangerouslySetInnerHTML={{__html: `
                .search-bar-container {
                    position: relative !important;
                }
                .search-bar-container .search-icon {
                    left: 12px !important;
                    top: 50% !important;
                    transform: translateY(-50%) !important;
                }
            `}} />
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Body>
                            <div className="d-flex flex-column gap-3 w-100 mb-4 controls-container">

                                {/* Top Row: View Switcher + Export Buttons */}
                                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 w-100">
                                    <div className="d-flex p-1 bg-light rounded-pill" style={{ maxWidth: 'fit-content', border: '1px solid #eaebf0' }}>
                                        <button
                                            className={`btn btn-sm rounded-pill px-4 py-2 fw-semibold d-flex align-items-center ${activeTab === 'list' ? 'bg-white shadow-sm' : 'text-muted bg-transparent border-0'}`}
                                            onClick={() => { setActiveTab('list'); setFilterCustomer(''); }}
                                            style={{ border: activeTab === 'list' ? '1px solid #eaebf0' : 'none', color: activeTab === 'list' ? '#1e40af' : '', transition: 'all 0.2s ease-in-out' }}
                                        >
                                            <i className="fa fa-list me-2"></i> List View
                                        </button>
                                        <button
                                            className={`btn btn-sm rounded-pill px-4 py-2 fw-semibold d-flex align-items-center ${activeTab === 'graph' ? 'bg-white shadow-sm' : 'text-muted bg-transparent border-0'}`}
                                            onClick={() => setActiveTab('graph')}
                                            style={{ border: activeTab === 'graph' ? '1px solid #eaebf0' : 'none', color: activeTab === 'graph' ? '#1e40af' : '', transition: 'all 0.2s ease-in-out' }}
                                        >
                                            <i className="fa fa-chart-bar me-2"></i> Graphical View
                                        </button>
                                        <button
                                            className={`btn btn-sm rounded-pill px-4 py-2 fw-semibold d-flex align-items-center ${activeTab === 'itemGraph' ? 'bg-white shadow-sm' : 'text-muted bg-transparent border-0'}`}
                                            onClick={() => setActiveTab('itemGraph')}
                                            style={{ border: activeTab === 'itemGraph' ? '1px solid #eaebf0' : 'none', color: activeTab === 'itemGraph' ? '#1e40af' : '', transition: 'all 0.2s ease-in-out' }}
                                        >
                                            <i className="fa fa-chart-line me-2"></i> Item Wise View
                                        </button>
                                    </div>

                                    {activeTab === 'list' && (
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

                                {/* Bottom Row: Date Filters + Search/Customer/Month select — stays in ONE row on all screens */}
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
                                                        handleDateInputAndSyncMonths(formatted, toDate);
                                                    }}
                                                    dateFormat="dd-MM-yyyy"
                                                    placeholderText="dd-mm-yyyy"
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
                                                        handleDateInputAndSyncMonths(fromDate, formatted);
                                                    }}
                                                    dateFormat="dd-MM-yyyy"
                                                    placeholderText="dd-mm-yyyy"
                                                    className="form-control form-control-sm"
                                                    wrapperClassName="w-100"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-4 px-1">
                                        <div className="d-flex align-items-center gap-2 w-100">
                                            {(activeTab === 'graph' || activeTab === 'itemGraph') && (
                                                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                                    <select
                                                        className="form-select form-select-sm w-100"
                                                        value={filterCustomer}
                                                        onChange={(e) => setFilterCustomer(e.target.value)}
                                                        style={{ height: 49, borderRadius: 8 }}
                                                    >
                                                        <option value="">All Customers</option>
                                                        {allUniqueCustomers.map(cust => (
                                                            <option key={cust} value={cust}>{cust}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {activeTab === 'itemGraph' && (
                                                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                                    <Select
                                                        isMulti
                                                        options={monthOptions}
                                                        value={selectedMonths}
                                                        onChange={handleMonthSelectionChange}
                                                        placeholder="All Months"
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
                                                                boxShadow: 'none',
                                                                '&:hover': { borderColor: '#94a3b8' },
                                                                cursor: 'pointer'
                                                            }),
                                                            valueContainer: (base) => ({
                                                                ...base,
                                                                maxHeight: '49px',
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
                                                </div>
                                            )}

                                            {activeTab === 'list' && (
                                                <div className="search-bar-container w-100">
                                                    <span className="search-icon">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                                    </span>
                                                    <input
                                                        type="text"
                                                        className="search-input w-100"
                                                        style={{ height: '49px' }}
                                                        placeholder="Search report..."
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                    <div className="tab-content mt-4 px-4 pb-4">
                        {activeTab === 'list' && (
                            <>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h4 className="mb-0">Customer wise Sales Invoice Report</h4>
                                </div>
                                <div className="table-responsive">
                                    <table className="fd-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '60px' }}>Sl.No</th>
                                                <th>Order No.</th>
                                                <th>Entry Date</th>
                                                <th>Customer Name</th>
                                                {/* <th>Approval Status</th> */}
                                                <th>Status</th>
                                                <th className="text-end">Total Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loading ? (
                                                <tr><td colSpan="7" className="text-center py-4">Loading report...</td></tr>
                                            ) : filteredData.length === 0 ? (
                                                <tr><td colSpan="7" className="text-center py-4 text-muted">No Sales Invoices found for the selected date range.</td></tr>
                                            ) : currentItems.map((order, idx) => (
                                                <tr key={order.id || idx} style={{ cursor: 'pointer' }} onClick={() => { setselectedInvoice(order); setShowModal(true); }}>
                                                    <td>{indexOfFirstItem + idx + 1}</td>
                                                    <td>
                                                        <span className="text-primary fw-bold">{order.invoice_no}</span>
                                                    </td>
                                                    <td>{order.entry_date ? order.entry_date.split('-').reverse().join('-') : '—'}</td>
                                                    <td className="fw-semibold">{order.customer_ledger_name || '—'}</td>
                                                    {/* <td>
                                                        <span className={getApprovalStatusBadgeClass(order.approval_status)}>
                                                            {order.approval_status || '—'}
                                                        </span>
                                                    </td> */}
                                                    <td>
                                                        <span className={getStatusBadgeClass(order.status)}>
                                                            {order.status || 'Pending'}
                                                        </span>
                                                    </td>
                                                    <td className="text-end fw-bold text-success">
                                                        {order.total_amount}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {filteredData.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredData.length)} of {filteredData.length} entries
                                        </div>
                                            {totalPages > 1 && (
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
                                            )}
                                        </div>
                                    )}

                            </>
                        )}
                        {activeTab === 'itemGraph' && (
                            <>
                                <div className="row mt-3">
                                    <div className="col-12 mb-4">
                                        <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                            <div className="card-body p-4 p-md-5">
                                                <div className="d-flex flex-wrap justify-content-end align-items-center mb-4 gap-3">
                                                    <div className="d-flex" style={{ background: '#f8f9fa', padding: '4px', borderRadius: 999, border: '1px solid #e9ecef' }}>
                                                        <button
                                                            className="btn btn-sm d-flex align-items-center"
                                                            onClick={() => setItemSubTab('amount')}
                                                            style={{
                                                                borderRadius: 999,
                                                                fontSize: '0.78rem',
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

                                                <div className="mb-4">
                                                    <h4 className="mb-1 fw-bold text-dark">
                                                        {itemSubTab === 'amount' ? 'Total Sales Amount (Bar)' : 'Total Sales Quantity (Bar)'}
                                                    </h4>
                                                    <p className="text-muted mb-0" style={{ fontSize: '14px' }}>
                                                        {itemSubTab === 'amount' ? 'Monthly breakdown of total sales amount' : 'Monthly breakdown of total quantities sold'}
                                                    </p>
                                                </div>
                                                {formattedItemMonthCategories.length > 0 ? (
                                                    <ReactApexChart options={{
                                                        ...itemBarOptions,
                                                        yaxis: { labels: { formatter: (val) => itemSubTab === 'amount' ? '' + val.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : val, style: { colors: '#64748b', fontSize: '13px', fontWeight: 500 } } }
                                                    }} series={itemSubTab === 'amount' ? totalAmountSeries : totalQuantitySeries} type="bar" height={350} />
                                                ) : (
                                                    <div className="text-center py-5">
                                                        <div className="mb-3">
                                                            <i className="fa fa-chart-bar" style={{ fontSize: '3rem', color: '#cbd5e1' }}></i>
                                                        </div>
                                                        <h5 className="text-muted fw-semibold">No item data available</h5>
                                                        <p className="text-muted" style={{ fontSize: '14px' }}>Adjust the date filters to see item sales trends.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="row mt-2">
                                    <div className="col-12 mb-4">
                                        <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                            <div className="card-body p-4 p-md-5">
                                                <div className="mb-4">
                                                    <div className="mb-3">
                                                        <h4 className="mb-1 fw-bold text-dark">
                                                            {itemSubTab === 'amount' ? 'Item-Wise Sales Amount (Line)' : 'Item-Wise Sales Quantity (Line)'}
                                                        </h4>
                                                        <p className="text-muted mb-0" style={{ fontSize: '14px' }}>
                                                            {itemSubTab === 'amount' ? 'Monthly trend of item sales amounts' : 'Monthly trend of item quantities sold'}
                                                        </p>
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
                                                                        borderRadius: '8px',
                                                                        borderColor: '#cbd5e1',
                                                                        minHeight: '42px',
                                                                        boxShadow: 'none',
                                                                        '&:hover': { borderColor: '#94a3b8' },
                                                                        cursor: 'pointer',
                                                                        fontSize: '13px'
                                                                    }),
                                                                    multiValue: (base) => ({
                                                                        ...base,
                                                                        backgroundColor: '#f1f5f9',
                                                                        borderRadius: '6px',
                                                                        padding: '2px'
                                                                    }),
                                                                    multiValueLabel: (base) => ({
                                                                        ...base,
                                                                        color: '#334155',
                                                                        fontWeight: 500,
                                                                        fontSize: '13px'
                                                                    }),
                                                                    multiValueRemove: (base) => ({
                                                                        ...base,
                                                                        borderRadius: '4px',
                                                                        color: '#64748b',
                                                                        '&:hover': {
                                                                            backgroundColor: '#ef4444',
                                                                            color: 'white'
                                                                        }
                                                                    })
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {formattedItemMonthCategories.length > 0 && (itemSubTab === 'amount' ? filteredItemSeriesAmount.length > 0 : filteredItemSeriesQty.length > 0) ? (
                                                    <ReactApexChart options={{
                                                        ...itemLineOptions,
                                                        yaxis: { labels: { formatter: (val) => itemSubTab === 'amount' ? '' + val.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : val, style: { colors: '#64748b', fontSize: '13px', fontWeight: 500 } } }
                                                    }} series={itemSubTab === 'amount' ? filteredItemSeriesAmount : filteredItemSeriesQty} type="line" height={350} />
                                                ) : (
                                                    <div className="text-center py-5">
                                                        <div className="mb-3">
                                                            <i className="fa fa-chart-line" style={{ fontSize: '3rem', color: '#cbd5e1' }}></i>
                                                        </div>
                                                        <h5 className="text-muted fw-semibold">No items selected</h5>
                                                        <p className="text-muted" style={{ fontSize: '14px' }}>Please select items from the dropdown to view their sales trends.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        {activeTab === 'graph' && (
                            <>
                                {/* Summary Tiles */}
                                <div className="row mt-3">
                                    <div className="col-xl-6 col-md-6 mb-4">
                                        <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                            <div className="card-body p-4 d-flex align-items-center">
                                                <div className="rounded-circle d-flex justify-content-center align-items-center" style={{ width: '60px', height: '60px', backgroundColor: 'rgba(30, 64, 175, 0.1)' }}>
                                                    <i className="fa fa-shopping-cart" style={{ fontSize: '1.5rem', color: '#1e40af' }}></i>
                                                </div>
                                                <div className="ms-4">
                                                    <p className="text-muted mb-1 fw-bold text-uppercase tracking-wider" style={{ fontSize: '12px', letterSpacing: '0.5px' }}>Total Sales Invoices</p>
                                                    <h3 className="mb-0 fw-bold text-dark">{filteredData.length}</h3>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-xl-6 col-md-6 mb-4">
                                        <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                            <div className="card-body p-4 d-flex align-items-center">
                                                <div className="rounded-circle d-flex justify-content-center align-items-center" style={{ width: '60px', height: '60px', backgroundColor: 'rgba(30, 64, 175, 0.1)' }}>
                                                    <i className="fa fa-wallet" style={{ fontSize: '1.5rem', color: '#1e40af' }}></i>
                                                </div>
                                                <div className="ms-4">
                                                    <p className="text-muted mb-1 fw-bold text-uppercase tracking-wider" style={{ fontSize: '12px', letterSpacing: '0.5px' }}>Total Revenue</p>
                                                    <h3 className="mb-0 fw-bold text-dark">
                                                        {formatCurrency(totalSalesAmount)}
                                                    </h3>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="row mt-1">
                                    <div className="col-xl-8 col-lg-12 mb-4">
                                        <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                            <div className="card-body p-4 p-md-5">
                                                <div className="d-flex flex-wrap justify-content-between align-items-start align-items-md-center mb-5 gap-3">
                                                    <div>
                                                        <h4 className="mb-1 fw-bold text-dark">Sales Invoices by Customer</h4>
                                                        <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Showing total sales amount grouped by customer</p>
                                                    </div>
                                                </div>

                                                {categories.length > 0 ? (
                                                    <ReactApexChart options={chartOptions} series={series} type="bar" height={400} />
                                                ) : (
                                                    <div className="text-center py-5">
                                                        <div className="mb-3">
                                                            <i className="fa fa-chart-bar" style={{ fontSize: '3rem', color: '#cbd5e1' }}></i>
                                                        </div>
                                                        <h5 className="text-muted fw-semibold">No data available</h5>
                                                        <p className="text-muted" style={{ fontSize: '14px' }}>Adjust the date filters to see sales trends.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-xl-4 col-lg-12 mb-4">
                                        <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                            <div className="card-body p-4 p-md-5">
                                                <div className="mb-5">
                                                    <h4 className="mb-1 fw-bold text-dark">Sales Invoices Distribution</h4>
                                                    <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Distribution of sales among top customers</p>
                                                </div>

                                                {categories.length > 0 ? (
                                                    <div className="d-flex justify-content-center align-items-center h-100" style={{ minHeight: '300px' }}>
                                                        <ReactApexChart options={donutOptions} series={seriesData} type="donut" width="100%" />
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-5">
                                                        <div className="mb-3">
                                                            <i className="fa fa-chart-pie" style={{ fontSize: '3rem', color: '#cbd5e1' }}></i>
                                                        </div>
                                                        <h5 className="text-muted fw-semibold">No data available</h5>
                                                        <p className="text-muted" style={{ fontSize: '14px' }}>Adjust the date filters to see customer distribution.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </>
                        )}
                    </div>
                        </Card.Body>
                    </Card>
                </div>
            </div>

            <InvoiceDetailModal
                invoice={selectedInvoice}
                show={showModal}
                onHide={() => { setShowModal(false); setselectedInvoice(null); }}
            />
        </div>
    );
};

export default CustomerSalesInvoiceReportList;