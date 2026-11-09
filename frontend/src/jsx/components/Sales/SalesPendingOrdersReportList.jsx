import React, { useState, useEffect, useCallback } from 'react';
import SalesService from '../../../services/SalesService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import { formatDate, getDatePickerFormat } from '../../../utils/dateUtils';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import ReactApexChart from 'react-apexcharts';
import { Card } from 'react-bootstrap';
import { usePageTitle } from '../../../context/TitleContext';

const CustomDateInput = React.forwardRef(({ value, onClick, onChange, placeholder }, ref) => (
    <input
        value={value}
        onClick={onClick}
        onChange={onChange}
        placeholder={placeholder}
        ref={ref}
        className="form-control w-100"
        style={{ height: '49px', borderRadius: '8px' }}
    />
));

const formatCurrency = (val) => (
    <>{parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
);

const SalesPendingOrdersReportList = () => {
    usePageTitle("Pending Sales Order Report");
    // ── State ──────────────────────────────────────────────────────────────
    const [salesOrders, setSalesOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('list');
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    
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
            params.status = 'Pending';
            
            const res = await SalesService.getSalesOrders(params);
            setSalesOrders(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching sales report:', err);
        } finally {
            setLoading(false);
        }
    }, [fromDate, toDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ── Filtered list (client-side search & date filter) ───────────────────
    const filteredData = salesOrders.filter((item) => {
        const term = searchTerm.toLowerCase();
        
        let dateInRange = true;
        const itemDate = item.entry_date ? item.entry_date.split('T')[0] : null;
        if (fromDate && (!itemDate || itemDate < fromDate)) dateInRange = false;
        if (toDate && (!itemDate || itemDate > toDate)) dateInRange = false;

        return dateInRange && (
            (item.so_no || '').toLowerCase().includes(term) ||
            (item.entry_date || '').toLowerCase().includes(term) ||
            (item.customer_ledger_name || '').toLowerCase().includes(term) ||
            (item.status || '').toLowerCase().includes(term) ||
            String(item.total_amount || '').toLowerCase().includes(term)
        );
    });

    // ── Pagination Logic ───────────────────────────────────────────────────
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    // ── Chart Logic ────────────────────────────────────────────────────────
    const chartDataMap = {};
    filteredData.forEach(item => {
        const date = item.entry_date || 'Unknown';
        if (!chartDataMap[date]) {
            chartDataMap[date] = { total: 0, count: 0 };
        }
        chartDataMap[date].total += parseFloat(item.total_amount) || 0;
        chartDataMap[date].count += 1;
    });

    const categories = Object.keys(chartDataMap).sort();
    const seriesData = categories.map(date => chartDataMap[date].total);
    const orderCountData = categories.map(date => chartDataMap[date].count);

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
                rotate: -90,
                rotateAlways: true,
                formatter: function (val) {
                    if (!val) return val;
                    const parts = val.split('-');
                    if (parts.length === 3) return `${parts[2]}-${parts[1]}`;
                    return val;
                },
                style: {
                    colors: '#64748b',
                    fontSize: '13px',
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
            custom: function({series, seriesIndex, dataPointIndex, w}) {
                const dateRaw = w.globals.labels[dataPointIndex];
                let displayDate = dateRaw;
                if (dateRaw && dateRaw.includes('-')) {
                    const parts = dateRaw.split('-');
                    if (parts.length === 3) displayDate = `${parts[2]}-${parts[1]}`;
                }
                const val = series[seriesIndex][dataPointIndex];
                const formattedVal = "" + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const count = orderCountData[dataPointIndex];

                return `
                    <div style="font-family: Inter, sans-serif; font-size: 13px; min-width: 170px; background: #fff;">
                        <div style="font-weight: 600; padding: 8px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #1e293b;">
                            ${displayDate}
                        </div>
                        <div style="padding: 10px 12px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                <div style="display: flex; align-items: center;">
                                    <span style="display: inline-block; width: 10px; height: 10px; background-color: #1e40af; border-radius: 50%; margin-right: 8px;"></span>
                                    <span style="color: #64748b;">Total Sales:</span>
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
        name: 'Total Sales',
        data: seriesData
    }];

    // ── Customer Donut Chart Logic ─────────────────────────────────────────
    const customerDataMap = {};
    filteredData.forEach(item => {
        const customer = item.customer_ledger_name || 'Unknown';
        if (!customerDataMap[customer]) {
            customerDataMap[customer] = 0;
        }
        customerDataMap[customer] += parseFloat(item.total_amount) || 0;
    });

    const customerLabels = Object.keys(customerDataMap);
    const customerSeries = customerLabels.map(cust => customerDataMap[cust]);

    const donutOptions = {
        chart: {
            type: 'donut',
            fontFamily: 'Inter, sans-serif'
        },
        labels: customerLabels,
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

    // ── Monthly Area Chart Logic ───────────────────────────────────────────
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const targetYear = fromDate ? new Date(fromDate).getFullYear() : new Date().getFullYear();

    const monthlyDataMap = {};
    // Initialize all 12 months for the target year
    for (let i = 1; i <= 12; i++) {
        const monthStr = i < 10 ? `0${i}` : `${i}`;
        monthlyDataMap[`${targetYear}-${monthStr}`] = 0;
    }

    filteredData.forEach(item => {
        const dateStr = item.entry_date;
        if (dateStr) {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                const monthYear = `${parts[0]}-${parts[1]}`;
                if (monthlyDataMap[monthYear] !== undefined) {
                    monthlyDataMap[monthYear] += parseFloat(item.total_amount) || 0;
                }
            }
        }
    });

    const monthCategories = Object.keys(monthlyDataMap).sort();
    const monthSeriesData = monthCategories.map(m => monthlyDataMap[m]);
    const formattedMonthCategories = monthNames;

    const areaOptions = {
        chart: {
            type: 'area',
            height: 350,
            toolbar: { show: false },
            fontFamily: 'Inter, sans-serif',
            zoom: { enabled: false },
            dropShadow: {
                enabled: true,
                top: 5,
                left: 0,
                blur: 6,
                color: '#1e40af',
                opacity: 0.15
            }
        },
        dataLabels: { enabled: false },
        stroke: { 
            curve: 'smooth', 
            width: 4,
            colors: ['#1e40af'] 
        },
        markers: {
            size: 6,
            colors: ['#fff'],
            strokeColors: '#1e40af',
            strokeWidth: 3,
            hover: { size: 8 }
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.5,
                opacityTo: 0.0,
                stops: [0, 90, 100],
                colorStops: [
                    { offset: 0, color: '#1e40af', opacity: 0.5 },
                    { offset: 100, color: '#1e40af', opacity: 0.0 }
                ]
            }
        },
        xaxis: {
            categories: formattedMonthCategories,
            labels: {
                style: { colors: '#64748b', fontSize: '13px', fontWeight: 600 }
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            min: 0, // This fixes the weird scaling for single data points
            labels: {
                formatter: function (val) {
                    return '' + val.toLocaleString('en-IN');
                },
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
        tooltip: {
            theme: 'light',
            y: {
                formatter: function (val) {
                    return "" + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                }
            },
            marker: { show: false }
        }
    };

    const areaSeries = [{
        name: 'Monthly Sales',
        data: monthSeriesData
    }];

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

    const formatDateTime = (v) => {
        if (!v) return '—';
        try {
            const date = new Date(v);
            if (isNaN(date.getTime())) return v;
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            let hours = date.getHours();
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            return `${dd}-${mm}-${yyyy} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
        } catch (e) {
            return String(v);
        }
    };

    const handleExport = (format) => {
        const columns = [
            { header: '#', dataKey: 'index' },
            { header: 'Order No', dataKey: 'so_no' },
            { header: 'Order Date', dataKey: 'entry_date' },
            { header: 'Customer', dataKey: 'customer_ledger_name', formatter: (v) => v || '—' },
            { header: 'Delivery Date & Time', dataKey: 'preferred_delivery_date', formatter: formatDateTime },
            { header: 'Total Amount', dataKey: 'total_amount' }
        ];
        const dataWithIndex = filteredData.map((d, i) => ({ ...d, index: i + 1 }));
        const title = `Pending Orders Report (${fromDate || 'All'} to ${toDate || 'All'})`;

        if (format === 'pdf') exportToPDF(dataWithIndex, columns, 'pending_orders_report.pdf', title);
        else if (format === 'excel') exportToExcel(dataWithIndex, columns, 'pending_orders_report.xlsx');
        else if (format === 'print') printData(dataWithIndex, columns, title);
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Body>
                    <div className="d-flex flex-column gap-3 w-100 mb-4">
                        {/* Top Row: Tabs & Export Buttons */}
                        <div className="d-flex justify-content-between align-items-center flex-nowrap gap-2 w-100">
                            {/* Tabs */}
                            <div className="d-flex p-1 bg-light rounded-pill" style={{ maxWidth: 'fit-content', border: '1px solid #eaebf0' }}>
                                <button className={`btn btn-sm rounded-pill px-4 py-2 fw-semibold d-flex align-items-center ${activeTab === 'list' ? 'bg-white shadow-sm' : 'text-muted bg-transparent border-0'}`} onClick={() => setActiveTab('list')} style={{ border: activeTab === 'list' ? '1px solid #eaebf0' : 'none', color: activeTab === 'list' ? '#1e40af' : '', transition: 'all 0.2s ease-in-out' }}>
                                    <i className="fa fa-list me-2"></i> List View
                                </button>
                                <button className={`btn btn-sm rounded-pill px-4 py-2 fw-semibold d-flex align-items-center ${activeTab === 'graph' ? 'bg-white shadow-sm' : 'text-muted bg-transparent border-0'}`} onClick={() => setActiveTab('graph')} style={{ border: activeTab === 'graph' ? '1px solid #eaebf0' : 'none', color: activeTab === 'graph' ? '#1e40af' : '', transition: 'all 0.2s ease-in-out' }}>
                                    <i className="fa fa-chart-bar me-2"></i> Graphical View
                                </button>
                            </div>
                            
                            {/* Export Buttons */}
                            {activeTab === 'list' && (
                                <div className="d-flex gap-2">
                                    <button className="btn btn-light border p-0" onClick={() => handleExport('pdf')} title="Export PDF" style={{ height: '40px', width: '40px', borderRadius: '8px' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    </button>
                                    <button className="btn btn-light border p-0" onClick={() => handleExport('excel')} title="Export Excel" style={{ height: '40px', width: '40px', borderRadius: '8px' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                    </button>
                                    <button className="btn btn-light border p-0" onClick={() => handleExport('print')} title="Print" style={{ height: '40px', width: '40px', borderRadius: '8px' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Bottom Row: Date Filters + Search */}
                        <div className="row flex-nowrap w-100 m-0">
                            <div className="col-4 px-1">
                                <div className="d-flex align-items-center gap-2 w-100">
                                    <label className="form-label mb-0 fw-bold flex-shrink-0 text-nowrap">From:</label>
                                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                        <DatePicker
                                            customInput={<CustomDateInput />}
                                            selected={fromDate ? new Date(fromDate.split('-')[0], fromDate.split('-')[1] - 1, fromDate.split('-')[2]) : null}
                                            onChange={(date) => {
                                                if (!date) {
                                                    setFromDate('');
                                                    return;
                                                }
                                                const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                                                setFromDate(formatted);
                                            }}
                                            dateFormat={getDatePickerFormat()}
                                            placeholderText={getDatePickerFormat().toLowerCase()}
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
                                            customInput={<CustomDateInput />}
                                            selected={toDate ? new Date(toDate.split('-')[0], toDate.split('-')[1] - 1, toDate.split('-')[2]) : null}
                                            onChange={(date) => {
                                                if (!date) {
                                                    setToDate('');
                                                    return;
                                                }
                                                const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                                                setToDate(formatted);
                                            }}
                                            dateFormat={getDatePickerFormat()}
                                            placeholderText={getDatePickerFormat().toLowerCase()}
                                            wrapperClassName="w-100"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="col-4 px-1">
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
                            </div>
                        </div>
                    </div>

                    <div className="tab-content mt-4 px-4 pb-4">
                        {activeTab === 'list' && (
                            <>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    {/* <h4 className="mb-0">Pending Sales Order Report</h4> */}
                                </div>
                                <div className="table-responsive">
                                    <table className="fd-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '60px' }}>Sl.No</th>
                                                <th>Order No.</th>
                                                <th>Order Date</th>
                                                <th>Customer Name</th>
                                                <th>Delivery Date & Time</th>
                                                <th className="text-end">Total Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loading ? (
                                                <tr><td colSpan="5" className="text-center py-4">Loading report...</td></tr>
                                            ) : filteredData.length === 0 ? (
                                                <tr><td colSpan="5" className="text-center py-4 text-muted">No sales orders found for the selected date range.</td></tr>
                                            ) : currentItems.map((order, idx) => (
                                                <tr key={order.id || idx}>
                                                    <td>{indexOfFirstItem + idx + 1}</td>
                                                    <td>
                                                        <span className="text-primary fw-bold">{order.so_no}</span>
                                                    </td>
                                                    <td>{formatDate(order.entry_date)}</td>
                                                    <td className="fw-semibold">{order.customer_ledger_name || '—'}</td>
                                                    <td>{formatDateTime(order.preferred_delivery_date)}</td>
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
                                                    <p className="text-muted mb-1 fw-bold text-uppercase tracking-wider" style={{ fontSize: '12px', letterSpacing: '0.5px' }}>Total Sales Orders</p>
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
                                                    <h4 className="mb-1 fw-bold text-dark">Daily Sales Trend</h4>
                                                    <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Showing total sales amount grouped by order date</p>
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
                                                <h4 className="mb-1 fw-bold text-dark">Sales by Customer</h4>
                                                <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Distribution of sales among customers</p>
                                            </div>
                                            
                                            {customerLabels.length > 0 ? (
                                                <div className="d-flex justify-content-center align-items-center h-100" style={{ minHeight: '300px' }}>
                                                    <ReactApexChart options={donutOptions} series={customerSeries} type="donut" width="100%" />
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
                            
                            <div className="row mt-2">
                                <div className="col-12 mb-4">
                                    <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                        <div className="card-body p-4 p-md-5">
                                            <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
                                                <div>
                                                    <h4 className="mb-0" style={{ fontWeight: '600', color: '#1e293b' }}>Pending Orders Report</h4>
                                                    <p className="mb-0" style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>Overview of your pending sales orders.</p>
                                                </div>
                                                <div className="d-flex align-items-center">
                                                    <span className="badge bg-light text-dark px-3 py-2" style={{ border: '1px solid #eaebf0', borderRadius: '8px' }}>
                                                        <i className="fa fa-calendar-alt text-muted me-2"></i> Monthly Aggregation
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {monthCategories.length > 0 ? (
                                                <ReactApexChart options={areaOptions} series={areaSeries} type="area" height={350} />
                                            ) : (
                                                <div className="text-center py-5">
                                                    <div className="mb-3">
                                                        <i className="fa fa-chart-area" style={{ fontSize: '3rem', color: '#cbd5e1' }}></i>
                                                    </div>
                                                    <h5 className="text-muted fw-semibold">No data available</h5>
                                                    <p className="text-muted" style={{ fontSize: '14px' }}>Adjust the date filters to see monthly trends.</p>
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
        </div>
    );
};

export default SalesPendingOrdersReportList;
