import React, { useMemo } from 'react';
import Chart from 'react-apexcharts';

const PurchaseReturnReportCharts = ({ data = [] }) => {

    // ── 1. Monthly Purchase Trend ──────────────────────────────────────────────
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const targetYear = useMemo(() => {
        for (const pr of data) {
            if (pr.entry_date) return new Date(pr.entry_date).getFullYear();
        }
        return new Date().getFullYear();
    }, [data]);

    const monthlyTrend = useMemo(() => {
        const map = {};
        // Initialize all 12 months for the target year
        for (let i = 1; i <= 12; i++) {
            const monthStr = i < 10 ? `0${i}` : `${i}`;
            map[`${targetYear}-${monthStr}`] = 0;
        }
        data.forEach(pr => {
            if (!pr.entry_date) return;
            const parts = pr.entry_date.split('-');
            if (parts.length === 3) {
                const monthYear = `${parts[0]}-${parts[1]}`;
                if (map[monthYear] !== undefined) {
                    map[monthYear] += parseFloat(pr.total_amount) || 0;
                }
            }
        });
        const sorted = Object.keys(map).sort();
        return {
            values: sorted.map(k => parseFloat(map[k].toFixed(2)))
        };
    }, [data, targetYear]);

    const monthlyOptions = {
        chart: {
            type: 'area',
            height: 350,
            fontFamily: 'Inter, sans-serif',
            toolbar: {
                show: true,
                tools: { download: true, selection: false, zoom: false, zoomin: false, zoomout: false, pan: false, reset: false }
            },
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
            categories: monthNames,
            labels: {
                style: { colors: '#64748b', fontSize: '13px', fontWeight: 600 }
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            min: 0,
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
                    return "" + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
            },
            marker: { show: false }
        }
    };

    const monthlySeries = [{ name: 'Monthly Purchase', data: monthlyTrend.values }];

    // ── 2. Daily Purchase Returns ───────────────────────────────────────────────
    const dailyData = useMemo(() => {
        const map = {};
        data.forEach(pr => {
            const date = pr.entry_date || 'Unknown';
            if (!map[date]) {
                map[date] = { total: 0, count: 0 };
            }
            map[date].total += parseFloat(pr.total_amount) || 0;
            map[date].count += 1;
        });
        const sorted = Object.keys(map).sort();
        return {
            categories: sorted,
            values: sorted.map(date => parseFloat(map[date].total.toFixed(2))),
            counts: sorted.map(date => map[date].count)
        };
    }, [data]);

    const dailyOptions = {
        chart: {
            type: 'bar',
            fontFamily: 'Inter, sans-serif',
            toolbar: {
                show: true,
                tools: { download: true, selection: false, zoom: false, zoomin: false, zoomout: false, pan: false, reset: false }
            }
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '20%',
                borderRadius: 6,
                borderRadiusApplication: 'end'
            },
        },
        dataLabels: { enabled: false },
        stroke: { show: true, width: 2, colors: ['transparent'] },
        xaxis: {
            categories: dailyData.categories,
            labels: {
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
                const count = dailyData.counts[dataPointIndex];

                return `
                    <div style="font-family: Inter, sans-serif; font-size: 13px; min-width: 170px; background: #fff;">
                        <div style="font-weight: 600; padding: 8px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #1e293b;">
                            ${displayDate}
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

    const dailySeries = [{ name: 'Total Amount', data: dailyData.values }];

    // ── 3. Supplier Donut Chart ────────────────────────────────────────────────
    const supplierDonutData = useMemo(() => {
        const map = {};
        data.forEach(pr => {
            const supplier = pr.supplier_name || 'Unknown';
            if (!map[supplier]) {
                map[supplier] = 0;
            }
            map[supplier] += parseFloat(pr.total_amount) || 0;
        });
        const labels = Object.keys(map);
        const series = labels.map(sup => map[sup]);
        return { labels, series };
    }, [data]);

    const supplierDonutOptions = {
        chart: {
            type: 'donut',
            fontFamily: 'Inter, sans-serif',
            toolbar: {
                show: true,
                tools: { download: true }
            }
        },
        labels: supplierDonutData.labels,
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

    // ── No data fallback ───────────────────────────────────────────────────────
    if (data.length === 0) {
        return (
            <div className="text-center py-5 text-muted">
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#adb5bd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="20" x2="12" y2="10"></line>
                        <line x1="18" y1="20" x2="18" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="16"></line>
                    </svg>
                </div>
                <div className="fw-semibold" style={{ fontSize: '1rem' }}>No data available for charts</div>
                <div className="small mt-1">Create some Purchase Returns to see graphical insights.</div>
            </div>
        );
    }

    // ── Icons (feather-style, stroke-based) ────────────────────────────────────
    const TrendingUpIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
            <polyline points="17 6 23 6 23 12"></polyline>
        </svg>
    );

    const BuildingIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path>
            <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path>
            <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path>
            <path d="M10 6h4"></path>
            <path d="M10 10h4"></path>
            <path d="M10 14h4"></path>
            <path d="M10 18h4"></path>
        </svg>
    );

    const RefreshIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
    );

    const BarChartIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#adb5bd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="20" x2="12" y2="10"></line>
            <line x1="18" y1="20" x2="18" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="16"></line>
        </svg>
    );

    // ── Card wrapper for each chart ────────────────────────────────────────────
    const ChartCard = ({ title, subtitle, icon, children }) => (
        <div
            style={{
                background: '#fff',
                border: '1.5px solid #e9ecef',
                borderRadius: 14,
                padding: '20px 24px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
            }}
        >
            <div className="mb-3">
                <div className="d-flex align-items-center gap-2 fw-bold text-dark" style={{ fontSize: '0.95rem' }}>
                    {icon}
                    {title}
                </div>
                {subtitle && (
                    <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: 2 }}>{subtitle}</div>
                )}
            </div>
            {children}
        </div>
    );

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(12, 1fr)',
                gap: '20px'
            }}
        >
            {/* Daily Purchase Returns + Supplier wise Order Value — side by side */}
            <div
                style={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '20px'
                }}
            >
                <div style={{ flex: '2 1 480px' }}>
                    <ChartCard icon={<BarChartIcon />} title="Daily Purchase Returns" subtitle="Purchase orders aggregated by date">
                        <Chart options={dailyOptions} series={dailySeries} type="bar" height={360} />
                    </ChartCard>
                </div>

                <div style={{ flex: '1 1 320px' }}>
                    <ChartCard icon={<BuildingIcon />} title="Supplier wise Order Value" subtitle="Purchase order amount by supplier">
                        <Chart options={supplierDonutOptions} series={supplierDonutData.series} type="donut" height={360} />
                    </ChartCard>
                </div>
            </div>

            {/* Monthly Purchase Trend — full width */}
            <div style={{ gridColumn: '1 / -1' }}>
                <ChartCard icon={<TrendingUpIcon />} title="Monthly Purchase Trend" subtitle="Total PR amount aggregated by month">
                    <Chart options={monthlyOptions} series={monthlySeries} type="area" height={350} />
                </ChartCard>
            </div>
        </div>
    );
};

export default PurchaseReturnReportCharts;  