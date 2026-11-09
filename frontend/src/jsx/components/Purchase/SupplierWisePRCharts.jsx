import React, { useMemo } from 'react';
import Chart from 'react-apexcharts';

const SupplierWisePRCharts = ({ data = [], donutData = null, fromDate = '', toDate = '' }) => {

    // ── 1. Supplier wise Order Value (Bar Chart) ──────────────────────────────
    const supplierValueSeries = useMemo(() => {
        // Use the passed fromDate/toDate to filter and set date range
        const from = fromDate ? new Date(fromDate) : null;
        const to = toDate ? new Date(toDate) : null;

        const filteredData = data.filter(pr => {
            if (!pr.entry_date) return false;
            const d = new Date(pr.entry_date);
            if (from && d < from) return false;
            if (to && d > to) return false;
            return true;
        });

        // 1. Get unique suppliers
        const currentSuppliers = [...new Set(filteredData.map(pr => pr.supplier_name || 'Unknown'))].sort();
        // 2. Get unique dates
        const sortedDates = [...new Set(filteredData.map(pr => pr.entry_date))].sort();

        // Map each supplier into a series
        const series = currentSuppliers.map(supName => {
            const seriesData = sortedDates.map(dStr => {
                const amount = filteredData
                    .filter(pr => pr.entry_date === dStr && (pr.supplier_name || 'Unknown') === supName)
                    .reduce((sum, pr) => sum + (parseFloat(pr.total_amount) || 0), 0);
                return parseFloat(amount.toFixed(2));
            });
            return {
                name: supName,
                data: seriesData
            };
        });

        return {
            dates: sortedDates.length ? sortedDates : ['No Data'],
            series: series.length ? series : [{ name: 'No Data', data: [0] }]
        };
    }, [data, fromDate, toDate]);

    const supplierValueOptions = {
        chart: {
            type: 'bar',
            stacked: false,
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: true, tools: { download: true } }
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '60%',
                borderRadius: 4,
                borderRadiusApplication: 'end',
                dataLabels: { position: 'top' }
            }
        },
        dataLabels: {
            enabled: true,
            offsetY: -20,
            style: { colors: ['#1e293b'], fontSize: '11px', fontWeight: 600 },
            formatter: function (val) {
                if (val === 0) return '';
                if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
                return val.toLocaleString('en-IN');
            }
        },
        xaxis: {
            categories: supplierValueSeries.dates,
            title: { text: 'Date', style: { color: '#64748b', fontSize: '12px', fontWeight: 600 } },
            labels: {
                style: { colors: '#1e293b', fontSize: '12px', fontWeight: 600 },
                formatter: function (val) {
                    if (!val || val === 'No Data') return val;
                    const d = new Date(val);
                    return String(d.getDate()).padStart(2, '0') + '-' + d.toLocaleString('default', { month: 'short' });
                }
            }
        },
        yaxis: {
            title: { text: 'Purchase Amount', style: { color: '#64748b', fontSize: '12px', fontWeight: 600 } },
            labels: {
                style: { colors: '#64748b', fontSize: '13px', fontWeight: 500 },
                formatter: function (val) {
                    if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
                    return val.toLocaleString('en-IN');
                }
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'right'
        },
        tooltip: {
            theme: 'light',
            y: {
                formatter: function (val) {
                    return "" + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
            }
        }
    };

    // ── 2. Supplier wise PR Count (Donut Chart) ────────────────────────────────
    const supplierCountData = useMemo(() => {
        const sourceData = donutData || data;
        const map = {};
        sourceData.forEach(pr => {
            const supplier = pr.supplier_name || 'Unknown';
            if (!map[supplier]) {
                map[supplier] = 0;
            }
            map[supplier] += parseFloat(pr.total_amount) || 0;
        });
        const labels = Object.keys(map);
        const series = labels.map(sup => map[sup]);
        return { labels, series };
    }, [data, donutData]);

    const supplierCountOptions = {
        chart: {
            type: 'donut',
            fontFamily: 'Inter, sans-serif',
            toolbar: {
                show: true,
                tools: { download: true }
            }
        },
        labels: supplierCountData.labels,
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
        colors: ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#d946ef', '#3b82f6']
    };

    // ── 3. Supplier wise Monthly Trend (Area Chart) ────────────────────────────
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const targetYear = useMemo(() => {
        for (const pr of data) {
            if (pr.entry_date) return new Date(pr.entry_date).getFullYear();
        }
        return new Date().getFullYear();
    }, [data]);

    const monthlyTrend = useMemo(() => {
        const map = {};
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
            toolbar: { show: true, tools: { download: true } },
            zoom: { enabled: false },
            dropShadow: { enabled: true, top: 5, left: 0, blur: 6, color: '#1e40af', opacity: 0.15 }
        },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 4, colors: ['#1e40af'] },
        markers: { size: 6, colors: ['#fff'], strokeColors: '#1e40af', strokeWidth: 3, hover: { size: 8 } },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.0, stops: [0, 90, 100],
                colorStops: [ { offset: 0, color: '#1e40af', opacity: 0.5 }, { offset: 100, color: '#1e40af', opacity: 0.0 } ]
            }
        },
        xaxis: {
            categories: monthNames,
            labels: { style: { colors: '#64748b', fontSize: '13px', fontWeight: 600 } },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            min: 0,
            labels: {
                formatter: function (val) { return '' + val.toLocaleString('en-IN'); },
                style: { colors: '#64748b', fontSize: '13px', fontWeight: 500 }
            }
        },
        grid: {
            borderColor: '#f1f5f9', strokeDashArray: 4,
            xaxis: { lines: { show: true } }, yaxis: { lines: { show: true } },
            padding: { top: 20, right: 20, bottom: 0, left: 20 }
        },
        tooltip: {
            theme: 'light',
            y: { formatter: function (val) { return "" + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } },
            marker: { show: false }
        }
    };

    const monthlySeries = [{ name: 'Monthly Purchase', data: monthlyTrend.values }];

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

    const BarChartIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
    );

    const TrendIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e40af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
            <polyline points="17 6 23 6 23 12"></polyline>
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
            <div style={{ gridColumn: '1 / span 7' }}>
                <ChartCard icon={<BarChartIcon />} title="Supplier wise Order Value" subtitle="Total purchase return amount by supplier">
                    <Chart options={supplierValueOptions} series={supplierValueSeries.series} type="bar" height={360} />
                </ChartCard>
            </div>

            <div style={{ gridColumn: '8 / span 5' }}>
                <ChartCard icon={<BuildingIcon />} title="Supplier wise PR Count" subtitle="Number of purchase returns per supplier">
                    <Chart options={supplierCountOptions} series={supplierCountData.series} type="donut" height={360} />
                </ChartCard>
            </div>

            <div style={{ gridColumn: '1 / span 12' }}>
                <ChartCard icon={<TrendIcon />} title="Supplier wise Monthly Trend" subtitle="Monthly purchase return amount trend">
                    <Chart options={monthlyOptions} series={monthlySeries} type="area" height={350} />
                </ChartCard>
            </div>
        </div>
    );
};

export default SupplierWisePRCharts;
