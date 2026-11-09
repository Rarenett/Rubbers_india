import React, { useState, useEffect, useCallback } from 'react';
import SalesService from '../../../services/SalesService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import ReactApexChart from 'react-apexcharts';
import { Card } from 'react-bootstrap';

import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { getDatePickerFormat } from '../../../utils/dateUtils';
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

const SalesDriverReportList = () => {
    usePageTitle("Driver Wise Sales Order Report");
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
            
            const res = await SalesService.getSalesOrders(params);
            setSalesOrders(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching driver vehicle report:', err);
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
            (item.driver_name || '').toLowerCase().includes(term) ||
            (item.dispatch_through || '').toLowerCase().includes(term) ||
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
        const driverName = item.driver_name || 'Unassigned Driver';
        const groupKey = driverName;
        
        if (!chartDataMap[groupKey]) {
            chartDataMap[groupKey] = { total: 0, count: 0 };
        }
        chartDataMap[groupKey].total += parseFloat(item.total_amount) || 0;
        chartDataMap[groupKey].count += 1;
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
            custom: function({series, seriesIndex, dataPointIndex, w}) {
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

    // ── Driver Donut Chart Logic ─────────────────────────────────────────
    const driverDataMap = {};
    filteredData.forEach(item => {
        const driver = item.driver_name || 'Unassigned Driver';
        if (!driverDataMap[driver]) {
            driverDataMap[driver] = 0;
        }
        driverDataMap[driver] += parseFloat(item.total_amount) || 0;
    });

    const driverLabels = Object.keys(driverDataMap);
    const driverSeries = driverLabels.map(dr => driverDataMap[dr]);

    const donutOptions = {
        chart: {
            type: 'donut',
            fontFamily: 'Inter, sans-serif'
        },
        labels: driverLabels,
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

    const handleExport = (format) => {
        const columns = [
            { header: '#', dataKey: 'index' },
            { header: 'Order No', dataKey: 'so_no' },
            { header: 'Order Date', dataKey: 'entry_date' },
            { header: 'Customer', dataKey: 'customer_ledger_name', formatter: (v) => v || '—' },
            { header: 'Driver Name', dataKey: 'driver_name', formatter: (v) => v || '—' },
            
            { header: 'Status', dataKey: 'status' },
            { header: 'Total Amount', dataKey: 'total_amount' }
        ];
        const dataWithIndex = filteredData.map((d, i) => ({ ...d, index: i + 1 }));
        const title = `Driver Sales Report (${fromDate || 'All'} to ${toDate || 'All'})`;

        if (format === 'pdf') exportToPDF(dataWithIndex, columns, 'driver_sales_report.pdf', title);
        else if (format === 'excel') exportToExcel(dataWithIndex, columns, 'driver_sales_report.xlsx');
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
                            {/* FROM DATE */}
                            <div className="col-4 px-1">
                                <div className="d-flex align-items-center gap-2 w-100">
                                    <label className="form-label mb-0 fw-bold flex-shrink-0 text-nowrap">From:</label>
                                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                        <DatePicker
                                            customInput={<CustomDateInput />}
                                            selected={fromDate ? new Date(fromDate.split('-')[0], fromDate.split('-')[1] - 1, fromDate.split('-')[2]) : null}
                                            onChange={(date) => {
                                                if (!date) return;
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
                            
                            {/* TO DATE */}
                            <div className="col-4 px-1">
                                <div className="d-flex align-items-center gap-2 w-100">
                                    <label className="form-label mb-0 fw-bold flex-shrink-0 text-nowrap">To:</label>
                                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                        <DatePicker
                                            customInput={<CustomDateInput />}
                                            selected={toDate ? new Date(toDate.split('-')[0], toDate.split('-')[1] - 1, toDate.split('-')[2]) : null}
                                            onChange={(date) => {
                                                if (!date) return;
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
                            
                            {/* LAST COLUMN: Search */}
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

                    <div className="tab-content mt-4">
                        {activeTab === 'list' && (
                            <>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    {/* <h4 className="mb-0">Driver wise Sales Order Report</h4> */}
                                </div>
                                <div className="table-responsive">
                                    <table className="fd-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '60px' }}>Sl.No</th>
                                                <th>Order No.</th>
                                                <th>Order Date</th>
                                                <th>Customer Name</th>
                                                <th>Driver Name</th>
                                                <th>Status</th>
                                                <th className="text-end">Total Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loading ? (
                                                <tr><td colSpan="8" className="text-center py-4">Loading report...</td></tr>
                                            ) : filteredData.length === 0 ? (
                                                <tr><td colSpan="8" className="text-center py-4 text-muted">No sales orders found for the selected date range.</td></tr>
                                            ) : currentItems.map((order, idx) => (
                                                <tr key={order.id || idx}>
                                                    <td>{indexOfFirstItem + idx + 1}</td>
                                                    <td>
                                                        <span className="text-primary fw-bold">{order.so_no}</span>
                                                    </td>
                                                    <td>{order.entry_date ? order.entry_date.split('-').reverse().join('-') : '—'}</td>
                                                    <td className="fw-semibold">{order.customer_ledger_name || '—'}</td>
                                                    <td>{order.driver_name || '—'}</td>
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
                                                    <h4 className="mb-1 fw-bold text-dark">Sales by Driver/Vehicle</h4>
                                                    <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Showing total sales amount grouped by driver</p>
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
                                                <h4 className="mb-1 fw-bold text-dark">Sales by Driver</h4>
                                                <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Distribution of sales among drivers</p>
                                            </div>
                                            
                                            {driverLabels.length > 0 ? (
                                                <div className="d-flex justify-content-center align-items-center h-100" style={{ minHeight: '300px' }}>
                                                    <ReactApexChart options={donutOptions} series={driverSeries} type="donut" width="100%" />
                                                </div>
                                            ) : (
                                                <div className="text-center py-5">
                                                    <div className="mb-3">
                                                        <i className="fa fa-chart-pie" style={{ fontSize: '3rem', color: '#cbd5e1' }}></i>
                                                    </div>
                                                    <h5 className="text-muted fw-semibold">No data available</h5>
                                                    <p className="text-muted" style={{ fontSize: '14px' }}>Adjust the date filters to see driver distribution.</p>
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

export default SalesDriverReportList;
