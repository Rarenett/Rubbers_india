import React, { useMemo } from 'react';
import Chart from 'react-apexcharts';

const CustomerWiseCharts = ({ data = [], donutData = null, fromDate = '', toDate = '' }) => {

    // ── 1. Customer wise Order Value (Bar Chart) ──────────────────────────────
    const customerValueSeries = useMemo(() => {
        const from = fromDate ? new Date(fromDate) : null;
        const to = toDate ? new Date(toDate) : null;

        const filteredData = data.filter(item => {
            if (!item.entry_date) return false;
            const d = new Date(item.entry_date);
            if (from && d < from) return false;
            if (to && d > to) return false;
            return true;
        });

        // 1. Get unique customers
        const currentCustomers = [...new Set(filteredData.map(item => item.customer_ledger_name || 'Unknown Customer'))].sort();
        // 2. Get unique dates
        const sortedDates = [...new Set(filteredData.map(item => item.entry_date))].sort();

        // Map each customer into a series
        const series = currentCustomers.map(custName => {
            const seriesData = sortedDates.map(dStr => {
                const amount = filteredData
                    .filter(item => item.entry_date === dStr && (item.customer_ledger_name || 'Unknown Customer') === custName)
                    .reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
                return parseFloat(amount.toFixed(2));
            });
            return {
                name: custName,
                data: seriesData
            };
        });

        return {
            dates: sortedDates.length ? sortedDates : ['No Data'],
            series: series.length ? series : [{ name: 'No Data', data: [0] }]
        };
    }, [data, fromDate, toDate]);

    const customerValueOptions = {
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
            categories: customerValueSeries.dates,
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
            title: { text: 'Sales Amount', style: { color: '#64748b', fontSize: '12px', fontWeight: 600 } },
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

    // ── 2. Customer wise Sales Orders (Donut Chart) ───────────────────────────
    const customerCountData = useMemo(() => {
        const sourceData = donutData || data;
        const map = {};
        sourceData.forEach(item => {
            const customer = item.customer_ledger_name || 'Unknown Customer';
            if (!map[customer]) {
                map[customer] = 0;
            }
            map[customer] += parseFloat(item.total_amount) || 0;
        });
        const labels = Object.keys(map);
        const series = labels.map(cust => map[cust]);
        return { labels, series };
    }, [data, donutData]);

    const customerCountOptions = {
        chart: {
            type: 'donut',
            fontFamily: 'Inter, sans-serif',
            toolbar: {
                show: true,
                tools: { download: true }
            }
        },
        labels: customerCountData.labels,
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

    // ── 3. Customer wise Monthly Trend (Area Chart) ───────────────────────────
    const monthlyTrend = useMemo(() => {
        let startYear, startMonth, endYear, endMonth;
        if (fromDate && toDate) {
            const fParts = fromDate.split('-');
            const tParts = toDate.split('-');
            startYear = parseInt(fParts[0], 10);
            startMonth = parseInt(fParts[1], 10);
            endYear = parseInt(tParts[0], 10);
            endMonth = parseInt(tParts[1], 10);
        } else {
            let year = new Date().getFullYear();
            for (const item of data) {
                if (item.entry_date) {
                    year = new Date(item.entry_date).getFullYear();
                    break;
                }
            }
            startYear = year;
            startMonth = 1;
            endYear = year;
            endMonth = 12;
        }

        const map = {};
        const labels = [];
        let curYear = startYear;
        let curMonth = startMonth;
        const monthNamesShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

        while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
            const mStr = curMonth < 10 ? `0${curMonth}` : `${curMonth}`;
            const key = `${curYear}-${mStr}`;
            map[key] = 0;
            const label = startYear === endYear ? monthNamesShort[curMonth - 1] : `${monthNamesShort[curMonth - 1]} ${curYear}`;
            labels.push(label);

            curMonth++;
            if (curMonth > 12) {
                curMonth = 1;
                curYear++;
            }
        }

        data.forEach(item => {
            if (!item.entry_date) return;
            const parts = item.entry_date.split('-');
            if (parts.length >= 2) {
                const monthYear = `${parts[0]}-${parts[1]}`;
                if (map[monthYear] !== undefined) {
                    const amt = parseFloat(item.total_amount || item.amount || item.net_amount || 0);
                    map[monthYear] += amt;
                }
            }
        });

        const sortedKeys = Object.keys(map).sort();
        return {
            labels: labels.length ? labels : ['No Data'],
            values: sortedKeys.map(k => parseFloat((map[k] || 0).toFixed(2)))
        };
    }, [data, fromDate, toDate]);

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
            categories: monthlyTrend.labels,
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

    const monthlySeries = [{ name: 'Monthly Sales', data: monthlyTrend.values }];

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
                <div className="small mt-1">Create some Sales Orders to see graphical insights.</div>
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
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
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
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <div style={{ width: '100%' }}>
                    {children}
                </div>
            </div>
        </div>
    );

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(12, 1fr)',
                gap: '20px',
                alignItems: 'stretch'
            }}
        >
            <div style={{ gridColumn: '1 / span 7', display: 'flex' }}>
                <ChartCard icon={<BarChartIcon />} title="Customer wise Order Value" subtitle="Total sales order amount by customer">
                    <Chart options={customerValueOptions} series={customerValueSeries.series} type="bar" height={360} />
                </ChartCard>
            </div>

            <div style={{ gridColumn: '8 / span 5', display: 'flex' }}>
                <ChartCard icon={<BuildingIcon />} title="Customer wise Sales Orders" subtitle="Sales order amount distribution by customer">
                    <Chart options={customerCountOptions} series={customerCountData.series} type="donut" height={360} />
                </ChartCard>
            </div>

            <div style={{ gridColumn: '1 / span 12', display: 'flex' }}>
                <ChartCard icon={<TrendIcon />} title="Customer wise Monthly Trend" subtitle="Monthly sales order amount trend">
                    <Chart options={monthlyOptions} series={monthlySeries} type="area" height={350} />
                </ChartCard>
            </div>
        </div>
    );
};

export default CustomerWiseCharts;
