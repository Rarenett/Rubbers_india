import React, { useContext } from 'react';
import ReactApexChart from 'react-apexcharts';
import { Row, Col, Card } from 'react-bootstrap';
import { ThemeContext } from "../../../context/ThemeContext";

const DailyEntryCharts = ({ data }) => {
    const { background } = useContext(ThemeContext);
    const isDark = background.value === "dark";

    if (!data || data.length === 0) {
        return (
            <Card className="text-center py-5 shadow-sm border-0" style={{ background: isDark ? '#24243e' : '#fff' }}>
                <Card.Body>
                    <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>📊</div>
                    <h5 className="fw-semibold text-muted">No data available for graphs</h5>
                    <p className="text-secondary small">
                        Please adjust your date filter range or add a new daily entry summary.
                    </p>
                </Card.Body>
            </Card>
        );
    }

    // Sort chronologically (oldest to newest) for trends
    const sortedData = [...data].sort((a, b) => {
        if (!a.entry_date) return 1;
        if (!b.entry_date) return -1;
        return new Date(a.entry_date) - new Date(b.entry_date);
    });

    const dates = sortedData.map(item => {
        if (!item.entry_date) return '';
        const d = new Date(item.entry_date + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    });

    // 1. Sales & Outstanding Trend Area Chart
    const salesData = sortedData.map(item => parseFloat(item.total_sales || 0));
    const outstandingData = sortedData.map(item => parseFloat(item.total_outstanding || 0));

    // 2. Daily Production & Sales Quantity Trend
    const productionQtyData = sortedData.map(item =>
        (item.production_items || []).reduce((sum, p) => sum + parseFloat(p.quantity || 0), 0)
    );
    const salesQtyData = sortedData.map(item =>
        (item.production_items || []).reduce((sum, p) => sum + parseFloat(p.sales_quantity || 0), 0)
    );

    // 3. Product Share Donut Chart
    const productTotals = {};
    data.forEach(entry => {
        (entry.production_items || []).forEach(item => {
            const name = item.product_name || `Product #${item.product}`;
            productTotals[name] = (productTotals[name] || 0) + parseFloat(item.quantity || 0);
        });
    });

    const productNames = Object.keys(productTotals);
    const productQuantities = Object.values(productTotals);

    // Common styles
    const textColor = isDark ? '#a1a1c5' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';

    // Sales & Outstanding options (Line Chart)
    const salesTrendOptions = {
        chart: {
            type: 'line',
            toolbar: { show: false },
            zoom: { enabled: false },
            background: 'transparent',
            parentHeightOffset: 0,
        },
        stroke: {
            curve: 'smooth',
            width: 3,
        },
        colors: ['#16a34a', '#dc2626'], // Green for Sales, Red for Outstanding
        dataLabels: { enabled: false },
        grid: {
            borderColor: gridColor,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } }
        },
        xaxis: {
            categories: dates,
            labels: {
                rotate: -30,
                style: {
                    colors: textColor,
                    fontSize: '11px',
                    fontFamily: 'inherit'
                }
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: {
                    colors: textColor,
                    fontSize: '11px',
                    fontFamily: 'inherit'
                },
                formatter: (val) => parseFloat(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }),
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'right',
            labels: { colors: isDark ? '#ffffff' : '#1e293b' },
            fontFamily: 'inherit',
            markers: { radius: 12 }
        },
        tooltip: {
            theme: isDark ? 'dark' : 'light',
            shared: true,
            fillSeriesColor: false,
            y: {
                formatter: (val) => parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            }
        }
    };

    const salesTrendSeries = [
        { name: 'Total Sales', data: salesData },
        { name: 'Total Outstanding', data: outstandingData }
    ];

    // Production & Sales Quantity Trend options (Line Chart)
    const qtyTrendOptions = {
        chart: {
            type: 'line',
            toolbar: { show: false },
            zoom: { enabled: false },
            background: 'transparent',
            parentHeightOffset: 0,
        },
        stroke: {
            curve: 'smooth',
            width: 3,
        },
        colors: ['#6366f1', '#06b6d4'], // Indigo for Production, Cyan for Sales
        dataLabels: { enabled: false },
        grid: {
            borderColor: gridColor,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } }
        },
        xaxis: {
            categories: dates,
            labels: {
                rotate: -30,
                style: {
                    colors: textColor,
                    fontSize: '11px',
                    fontFamily: 'inherit'
                }
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: {
                    colors: textColor,
                    fontSize: '11px',
                    fontFamily: 'inherit'
                },
                formatter: (val) => parseFloat(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) + ' units',
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'right',
            labels: { colors: isDark ? '#ffffff' : '#1e293b' },
            fontFamily: 'inherit',
            markers: { radius: 12 }
        },
        tooltip: {
            theme: isDark ? 'dark' : 'light',
            shared: true,
            fillSeriesColor: false,
            y: {
                formatter: (val) => parseFloat(val || 0).toLocaleString('en-IN') + ' units',
            }
        }
    };

    const qtyTrendSeries = [
        { name: 'Production Quantity', data: productionQtyData },
        { name: 'Sales Quantity', data: salesQtyData }
    ];

    // Daily Production Bar Chart options
    const prodBarOptions = {
        chart: {
            type: 'bar',
            toolbar: { show: false },
            background: 'transparent',
        },
        plotOptions: {
            bar: {
                borderRadius: 5,
                columnWidth: '45%',
                distributed: false,
            }
        },
        colors: ['#6366f1'], // Indigo
        dataLabels: { enabled: false },
        grid: {
            borderColor: gridColor,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } }
        },
        xaxis: {
            categories: dates,
            labels: {
                rotate: -30,
                style: {
                    colors: textColor,
                    fontSize: '11px',
                    fontFamily: 'inherit'
                }
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: {
                    colors: textColor,
                    fontSize: '11px',
                    fontFamily: 'inherit'
                },
                formatter: (val) => parseFloat(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) + ' units',
            }
        },
        tooltip: {
            theme: isDark ? 'dark' : 'light',
            fillSeriesColor: false,
            y: {
                formatter: (val) => parseFloat(val || 0).toLocaleString('en-IN') + ' units',
            }
        }
    };

    const prodBarSeries = [
        { name: 'Produced Quantity', data: productionQtyData }
    ];

    // Product Share options
    const productShareOptions = {
        chart: {
            type: 'donut',
            background: 'transparent',
        },
        labels: productNames,
        colors: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#ec4899', '#14b8a6'],
        stroke: {
            show: true,
            colors: [isDark ? '#24243e' : '#ffffff'],
            width: 2,
        },
        dataLabels: { enabled: false },
        plotOptions: {
            pie: {
                donut: {
                    size: '65%',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '14px',
                            fontFamily: 'inherit',
                            color: isDark ? '#ffffff' : '#1e293b',
                        },
                        value: {
                            show: true,
                            fontSize: '18px',
                            fontFamily: 'inherit',
                            fontWeight: 700,
                            color: isDark ? '#a1a1c5' : '#475569',
                            formatter: (val) => parseFloat(val || 0).toLocaleString('en-IN'),
                        },
                        total: {
                            show: true,
                            label: 'Total Qty',
                            color: isDark ? '#a1a1c5' : '#475569',
                            formatter: (w) => {
                                const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                return total.toLocaleString('en-IN');
                            }
                        }
                    }
                }
            }
        },
        legend: {
            position: 'bottom',
            fontFamily: 'inherit',
            labels: { colors: isDark ? '#ffffff' : '#1e293b' },
            formatter: (seriesName, opts) => {
                const val = opts.w.globals.series[opts.seriesIndex];
                return `${seriesName}: ${parseFloat(val).toLocaleString('en-IN')}`;
            }
        },
        tooltip: {
            theme: isDark ? 'dark' : 'light',
            fillSeriesColor: false,
            y: {
                formatter: (val) => parseFloat(val || 0).toLocaleString('en-IN') + ' units',
            }
        }
    };

    return (
        <div className="daily-entries-charts mt-3">
            <Row className="gy-4">
                {/* Sales & Outstanding Trend (6 Cols) */}
                <Col xl={6} lg={12}>
                    <Card className="shadow-sm border-0 h-100" style={{ borderRadius: '16px', background: isDark ? '#24243e' : '#ffffff' }}>
                        <Card.Header className="bg-transparent border-0 pt-4 px-4 pb-0">
                            <h5 className="mb-0 fw-bold" style={{ color: isDark ? '#fff' : '#1e293b' }}>
                                Sales & Outstanding Amount Trend
                            </h5>
                            <small className="text-muted">Daily tracking of sales vs outstanding balances</small>
                        </Card.Header>
                        <Card.Body className="p-4">
                            <ReactApexChart
                                options={salesTrendOptions}
                                series={salesTrendSeries}
                                type="line"
                                height={300}
                            />
                        </Card.Body>
                    </Card>
                </Col>

                {/* Production & Sales Quantity Trend (6 Cols) */}
                <Col xl={6} lg={12}>
                    <Card className="shadow-sm border-0 h-100" style={{ borderRadius: '16px', background: isDark ? '#24243e' : '#ffffff' }}>
                        <Card.Header className="bg-transparent border-0 pt-4 px-4 pb-0">
                            <h5 className="mb-0 fw-bold" style={{ color: isDark ? '#fff' : '#1e293b' }}>
                                Production & Sales Quantity Trend
                            </h5>
                            <small className="text-muted">Daily tracking of production volume vs sales quantity</small>
                        </Card.Header>
                        <Card.Body className="p-4">
                            <ReactApexChart
                                options={qtyTrendOptions}
                                series={qtyTrendSeries}
                                type="line"
                                height={300}
                            />
                        </Card.Body>
                    </Card>
                </Col>

                {/* Daily Production Quantity Bar Chart (8 Cols) */}
                <Col xl={8} lg={12}>
                    <Card className="shadow-sm border-0 h-100" style={{ borderRadius: '16px', background: isDark ? '#24243e' : '#ffffff' }}>
                        <Card.Header className="bg-transparent border-0 pt-4 px-4 pb-0">
                            <h5 className="mb-0 fw-bold" style={{ color: isDark ? '#fff' : '#1e293b' }}>
                                Daily Production Quantity Trend
                            </h5>
                            <small className="text-muted">Total units manufactured per day</small>
                        </Card.Header>
                        <Card.Body className="p-4">
                            <ReactApexChart
                                options={prodBarOptions}
                                series={prodBarSeries}
                                type="bar"
                                height={300}
                            />
                        </Card.Body>
                    </Card>
                </Col>

                {/* Product Share Donut (4 Cols) */}
                <Col xl={4} lg={12}>
                    <Card className="shadow-sm border-0 h-100" style={{ borderRadius: '16px', background: isDark ? '#24243e' : '#ffffff' }}>
                        <Card.Header className="bg-transparent border-0 pt-4 px-4 pb-0">
                            <h5 className="mb-0 fw-bold" style={{ color: isDark ? '#fff' : '#1e293b' }}>
                                Production Product Share
                            </h5>
                            <small className="text-muted">Breakdown of product volume mix</small>
                        </Card.Header>
                        <Card.Body className="p-4 d-flex align-items-center justify-content-center">
                            {productNames.length > 0 ? (
                                <div className="w-100">
                                    <ReactApexChart
                                        options={productShareOptions}
                                        series={productQuantities}
                                        type="donut"
                                        height={300}
                                    />
                                </div>
                            ) : (
                                <div className="text-muted text-center py-5">
                                    <span style={{ fontSize: '2rem' }}>🏭</span>
                                    <p className="small mb-0 mt-2">No production items recorded in this range.</p>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default DailyEntryCharts;
