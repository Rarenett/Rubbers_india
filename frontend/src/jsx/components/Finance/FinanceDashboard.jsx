import React, { useState, useEffect } from 'react';
import ReactApexChart from 'react-apexcharts';
import { Link } from 'react-router-dom';
import { Dropdown } from 'react-bootstrap';
import axiosInstance from '../../../services/AxiosInstance';
import { usePageTitle } from '../../../context/TitleContext';


const AnimatedNumber = ({ value, duration = 1200, prefix = '₹', decimals = 2 }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let start = 0;
        const end = parseFloat(value);
        if (isNaN(end) || end === 0) { setCount(0); return; }
        
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            setCount(easeProgress * end);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                setCount(end);
            }
        };
        window.requestAnimationFrame(step);
    }, [value, duration]);

    return (
        <React.Fragment>
            <span className="rupee">{prefix}</span>
            {count.toLocaleString(undefined, {minimumFractionDigits: decimals, maximumFractionDigits: decimals})}
        </React.Fragment>
    );
};

const FinanceDashboard = () => {
    const themeColors = {
        dark: '#0f172a',      // slate-900
        primary: '#6366f1',   // indigo-500
        secondary: '#10b981', // emerald-500
        tertiary: '#0ea5e9',  // sky-500
        light: '#f1f5f9',     // slate-100
        lighter: '#f8fafc',   // slate-50
        bg: 'transparent',
        warning: '#f59e0b',   // amber-500
        danger: '#ef4444'     // red-500
    };

    usePageTitle("FinBoard");

    const [cashflowDays, setCashflowDays] = useState(7);
    const [expenseDays, setExpenseDays] = useState('all');
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState({
        kpis: { income: 0, expense: 0, sale: 0, capex: 0 },
        cashflow: { dates: [], inflow: [], outflow: [], net_profit: [] },
        expenseBreakdown: [],
        incomeBreakdown: [],
        operatingAccounts: [],
        totalLiquid: 0,
        recentActivities: [],
        totalReceivables: 0,
        totalPayables: 0,
        topDebtors: [],
        topCreditors: []
    });

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                const response = await axiosInstance.get(`/api/finance/dashboard/?days=${cashflowDays}&expenseDays=${expenseDays}`);
                setDashboardData(response.data);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [cashflowDays, expenseDays]);

    // -------------------
    // Chart 1: Cashflow (Area)
    // -------------------
    const cashflowSeries = [
        { name: 'Inflow', data: dashboardData.cashflow.inflow },
        { name: 'Outflow', data: dashboardData.cashflow.outflow }
    ];

    const cashflowOptions = {
        chart: {
            height: 280,
            type: 'area',
            toolbar: { show: false },
            fontFamily: 'Inter, Arial, sans-serif',
            sparkline: { enabled: false },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 800,
                animateGradually: { enabled: true, delay: 150 },
                dynamicAnimation: { enabled: true, speed: 350 }
            }
        },
        colors: [themeColors.secondary, themeColors.primary],
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 3, lineCap: 'round' },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [0, 100]
            }
        },
        xaxis: {
            categories: dashboardData.cashflow.dates,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: { style: { colors: '#94a3b8', fontSize: '12px', fontWeight: 500 } }
        },
        yaxis: {
            labels: { style: { colors: '#94a3b8', fontSize: '12px', fontWeight: 500 } }
        },
        grid: {
            borderColor: 'rgba(0,0,0,0.04)',
            strokeDashArray: 4,
            xaxis: { lines: { show: true } },
            yaxis: { lines: { show: true } },
        },
        legend: { position: 'top', horizontalAlign: 'right', fontSize: '12px', markers: { radius: 12 }, fontWeight: 600 },
        tooltip: { theme: 'light', style: { fontSize: '13px' } },
    };

    // -------------------
    // Chart 2: Expense Breakdown (Radial Bar)
    // -------------------
    const expenseRadialSeries = dashboardData.expenseBreakdown.map(e => e.value);
    const expenseLabels = dashboardData.expenseBreakdown.map(e => e.name);
    const safeRadialSeries = expenseRadialSeries.length > 0 ? expenseRadialSeries : [1];
    const safeLabels = expenseLabels.length > 0 ? expenseLabels : ['No Expenses'];

    const expenseRadialOptions = {
        chart: {
            type: 'radialBar',
            height: 260,
            fontFamily: 'Arial, sans-serif'
        },
        colors: [themeColors.primary, themeColors.secondary, themeColors.tertiary, '#f6c23e'],
        plotOptions: {
            radialBar: {
                hollow: { size: '30%' },
                track: { background: 'transparent' },
                dataLabels: { name: { show: false }, value: { show: false } }
            }
        },
        stroke: { lineCap: 'round' },
        labels: safeLabels,
    };

    const expenseTotal = dashboardData.expenseBreakdown.reduce((acc, curr) => acc + curr.value, 0);

    // -------------------
    // Chart 3: Income Breakdown (Donut)
    // -------------------
    const incomeSeries = dashboardData.incomeBreakdown.map(i => i.value);
    const incomeLabels = dashboardData.incomeBreakdown.map(i => i.name);
    const safeIncomeSeries = incomeSeries.length > 0 ? incomeSeries : [1];
    const safeIncomeLabels = incomeLabels.length > 0 ? incomeLabels : ['No Income'];

    const incomeOptions = {
        chart: {
            type: 'donut',
            height: 260,
            fontFamily: 'Arial, sans-serif'
        },
        colors: [themeColors.secondary, themeColors.tertiary, themeColors.primary, '#f6c23e'],
        labels: safeIncomeLabels,
        dataLabels: { enabled: false },
        plotOptions: {
            pie: {
                donut: {
                    size: '70%',
                    labels: {
                        show: true,
                        name: { fontSize: '11px', color: '#888' },
                        value: { fontSize: '16px', fontWeight: 700, color: themeColors.dark }
                    }
                }
            }
        },
        stroke: { show: false },
        legend: { show: false },
    };

    const incomeTotal = dashboardData.incomeBreakdown.reduce((acc, curr) => acc + curr.value, 0);

    // -------------------
    // Chart 4: Payables vs Receivables (Bar)
    // -------------------
    const arApSeries = [{
        name: 'Amount',
        data: [dashboardData.totalReceivables, dashboardData.totalPayables]
    }];
    
    const arApOptions = {
        chart: {
            type: 'bar',
            height: 180,
            toolbar: { show: false },
            fontFamily: 'Arial, sans-serif'
        },
        plotOptions: {
            bar: {
                horizontal: true,
                borderRadius: 4,
                barHeight: '40%',
                distributed: true,
            }
        },
        colors: [themeColors.secondary, '#ff5c5c'],
        dataLabels: {
            enabled: true,
            textAnchor: 'start',
            style: { colors: ['#fff'] },
            formatter: function (val) {
                return '₹ ' + val.toLocaleString();
            },
            offsetX: 0,
        },
        xaxis: {
            categories: ['Receivables (To Receive)', 'Payables (To Pay)'],
            labels: { show: false },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: { style: { colors: themeColors.dark, fontSize: '11px', fontWeight: 600 } }
        },
        grid: { show: false },
        legend: { show: false },
        tooltip: { theme: 'light' }
    };

    // -------------------
    // Chart 5: Operating Accounts (Donut)
    // -------------------
    const operatingSeries = dashboardData.operatingAccounts.map(a => a.balance);
    const operatingLabels = dashboardData.operatingAccounts.map(a => a.name);
    const safeOperatingSeries = operatingSeries.length > 0 ? operatingSeries : [1];
    const safeOperatingLabels = operatingLabels.length > 0 ? operatingLabels : ['No Accounts'];

    const operatingOptions = {
        chart: {
            type: 'donut',
            height: 250,
            fontFamily: 'Arial, sans-serif'
        },
        labels: safeOperatingLabels,
        colors: [themeColors.tertiary, themeColors.primary, themeColors.secondary, '#f6c23e', '#e74a3b'],
        dataLabels: { enabled: false },
        plotOptions: {
            pie: {
                donut: {
                    size: '75%',
                    labels: {
                        show: true,
                        name: { fontSize: '11px', color: '#888' },
                        value: { fontSize: '16px', fontWeight: 700, color: themeColors.dark, formatter: (val) => '₹ ' + parseFloat(val).toLocaleString() }
                    }
                }
            }
        },
        stroke: { width: 2 },
        legend: { position: 'bottom', fontSize: '11px', markers: { radius: 12 } },
    };

    // -------------------
    // Chart 6: Net Profit Trend (Line)
    // -------------------
    const netProfitSeries = [
        { name: 'Net Profit', data: dashboardData.cashflow.net_profit || [] }
    ];
    const netProfitOptions = {
        chart: {
            height: 240,
            type: 'line',
            toolbar: { show: false },
            fontFamily: 'Inter, Arial, sans-serif',
            animations: { enabled: true, easing: 'easeinout', speed: 800 }
        },
        colors: [themeColors.tertiary],
        stroke: { curve: 'smooth', width: 3 },
        xaxis: {
            categories: dashboardData.cashflow.dates,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: { style: { colors: '#94a3b8', fontSize: '12px' } }
        },
        yaxis: {
            labels: { style: { colors: '#94a3b8', fontSize: '12px' } }
        },
        grid: { borderColor: 'rgba(0,0,0,0.04)', strokeDashArray: 4 },
        tooltip: { theme: 'light', style: { fontSize: '13px' } },
        markers: { size: 4, colors: '#fff', strokeColors: themeColors.tertiary, strokeWidth: 2 }
    };

    // -------------------
    // Chart 7: Daily Income vs Expense (Grouped Bar)
    // -------------------
    const dailyIncExpSeries = [
        { name: 'Inflow', data: dashboardData.cashflow.inflow },
        { name: 'Outflow', data: dashboardData.cashflow.outflow }
    ];
    const dailyIncExpOptions = {
        chart: { type: 'bar', height: 240, toolbar: { show: false }, fontFamily: 'Inter, Arial, sans-serif' },
        plotOptions: { bar: { horizontal: false, columnWidth: '50%', borderRadius: 4 } },
        colors: [themeColors.secondary, themeColors.warning],
        dataLabels: { enabled: false },
        stroke: { show: true, width: 2, colors: ['transparent'] },
        xaxis: {
            categories: dashboardData.cashflow.dates,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: { style: { colors: '#94a3b8', fontSize: '12px' } }
        },
        yaxis: { labels: { style: { colors: '#94a3b8', fontSize: '12px' } } },
        grid: { borderColor: 'rgba(0,0,0,0.04)', strokeDashArray: 4 },
        legend: { position: 'top', horizontalAlign: 'right', fontSize: '12px' },
        tooltip: { theme: 'light' },
    };

    // -------------------
    // Chart 8: Top Debtors (Horizontal Bar)
    // -------------------
    const debtorsData = (dashboardData.topDebtors || []).map(d => d.value);
    const debtorsCategories = (dashboardData.topDebtors || []).map(d => d.name.length > 15 ? d.name.substring(0,15) + '...' : d.name);
    
    const topDebtorsSeries = [{ name: 'Receivables', data: debtorsData }];
    const topDebtorsOptions = {
        chart: { type: 'bar', height: 240, toolbar: { show: false }, fontFamily: 'Inter, Arial, sans-serif' },
        plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '50%', dataLabels: { position: 'top' } } },
        colors: [themeColors.primary],
        dataLabels: {
            enabled: true,
            textAnchor: 'start',
            style: { colors: [themeColors.dark], fontSize: '12px', fontWeight: 600 },
            formatter: function (val) {
                return '₹ ' + val.toLocaleString();
            },
            offsetX: 10,
        },
        xaxis: { categories: debtorsCategories, labels: { style: { colors: '#94a3b8', fontSize: '11px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis: { labels: { style: { colors: themeColors.dark, fontSize: '11px', fontWeight: 600 } } },
        grid: { borderColor: 'rgba(0,0,0,0.04)', strokeDashArray: 4 },
        tooltip: { theme: 'light' }
    };

    if (loading) {
        return (
            <div className="container-fluid d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid" style={{ backgroundColor: themeColors.bg, minHeight: '100vh' }}>
            <style>
            {`
            .rupee { font-family: 'Arial', sans-serif !important; font-weight: inherit; }
            .glass-card {
                background: rgba(255, 255, 255, 0.85);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.4);
                border-radius: 16px;
                box-shadow: 0 8px 30px rgba(0,0,0,0.03);
                padding: 16px 20px;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                margin-bottom: 20px;
                position: relative;
                overflow: hidden;
            }
            .glass-card::before {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0; height: 3px;
                background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.3), transparent);
                opacity: 0;
                transition: opacity 0.3s;
            }
            .glass-card:hover {
                transform: translateY(-4px) scale(1.01);
                box-shadow: 0 15px 40px rgba(99, 102, 241, 0.08);
            }
            .glass-card:hover::before { opacity: 1; }
            
            .animate-slide-up {
                animation: slideUpFade 0.5s ease-out forwards;
                opacity: 0;
                transform: translateY(20px);
            }
            .delay-1 { animation-delay: 0.1s; }
            .delay-2 { animation-delay: 0.15s; }
            .delay-3 { animation-delay: 0.2s; }
            
            @keyframes slideUpFade {
                to { opacity: 1; transform: translateY(0); }
            }
            
            @keyframes pulse-ring {
                0% { transform: scale(0.8); opacity: 0.5; }
                100% { transform: scale(2.5); opacity: 0; }
            }
            
            .live-indicator {
                position: relative; width: 8px; height: 8px;
                background-color: ${themeColors.secondary};
                border-radius: 50%; display: inline-block; margin-right: 10px;
            }
            .live-indicator::before {
                content: ''; position: absolute; left: -3px; top: -3px; width: 14px; height: 14px;
                background-color: ${themeColors.secondary}; border-radius: 50%; z-index: -1;
                animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
            }

            .kpi-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
            .kpi-icon-wrap { display: flex; align-items: center; color: #64748b; font-weight: 600; font-size: 13px; }
            .kpi-icon {
                width: 40px; height: 40px; border-radius: 10px;
                display: flex; align-items: center; justify-content: center;
                font-size: 18px; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); margin-right: 12px;
            }
            .glass-card:hover .kpi-icon { transform: scale(1.1) rotate(5deg); }
            
            .kpi-icon.primary-icon { color: ${themeColors.primary}; background: rgba(99, 102, 241, 0.12); }
            .kpi-icon.success-icon { color: ${themeColors.secondary}; background: rgba(16, 185, 129, 0.12); }
            .kpi-icon.warning-icon { color: ${themeColors.warning}; background: rgba(245, 158, 11, 0.12); }
            .kpi-icon.info-icon { color: ${themeColors.tertiary}; background: rgba(14, 165, 233, 0.12); }
            .kpi-icon.danger-icon { color: ${themeColors.danger}; background: rgba(239, 68, 68, 0.12); }

            .kpi-value { font-size: 22px; font-weight: 800; color: ${themeColors.dark}; margin: 0; letter-spacing: -0.5px; }
            
            .section-title {
                font-size: 15px; font-weight: 800; color: ${themeColors.dark};
                margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;
            }
            
            .legend-item { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 8px 12px; border-radius: 8px; transition: background 0.2s; }
            .legend-item:hover { background: rgba(241, 245, 249, 0.8); }
            .legend-dot { width: 10px; height: 10px; border-radius: 3px; margin-right: 12px; }
            .legend-text h6 { margin: 0; font-size: 13px; font-weight: 700; color: ${themeColors.dark}; }
            .legend-text span { font-size: 11px; color: #64748b; font-weight: 500; }
            .legend-percent { font-size: 13px; font-weight: 700; color: ${themeColors.dark}; }
            
            .activity-item { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 10px 12px; border-radius: 10px; transition: all 0.2s; border: 1px solid transparent; background: transparent;}
            .activity-item:hover { background: #fff; border-color: rgba(226, 232, 240, 0.8); box-shadow: 0 4px 12px rgba(0,0,0,0.03); transform: translateX(3px); }
            .activity-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-right: 12px; font-size: 14px; transition: transform 0.2s;}
            .activity-item:hover .activity-icon { transform: scale(1.1); }
            `}
            </style>
            
            <div className="row mb-3">
                {/* <div className="col-12">
                    <h2 style={{ color: themeColors.dark, fontWeight: 800 }}>Dashboard</h2>
                </div> */}
            </div>

            {/* KPIs Row */}
            <div className="row mb-4">
                <div className="col-xl-3 col-sm-6 mb-4 mb-xl-0">
                    {/* KPI Income */}
                    <div className="glass-card animate-slide-up delay-1" style={{ marginBottom: 0, height: '100%' }}>
                                <div className="kpi-row">
                                    <div className="kpi-icon-wrap"><div className="kpi-icon primary-icon"><i className="fas fa-arrow-down"></i></div> Income</div>
                                </div>
                                <div className="d-flex align-items-baseline mt-2">
                                    <h3 className="kpi-value"><AnimatedNumber value={dashboardData.kpis.income} /></h3>
                                </div>
                            </div>
                </div>
                <div className="col-xl-3 col-sm-6 mb-4 mb-xl-0">
                    {/* KPI Expense */}
                    <div className="glass-card animate-slide-up delay-1" style={{ marginBottom: 0, height: '100%' }}>
                                <div className="kpi-row">
                                    <div className="kpi-icon-wrap"><div className="kpi-icon warning-icon"><i className="fas fa-arrow-up"></i></div> Expense</div>
                                </div>
                                <div className="d-flex align-items-baseline mt-2">
                                    <h3 className="kpi-value"><AnimatedNumber value={dashboardData.kpis.expense} /></h3>
                                </div>
                            </div>
                </div>
                <div className="col-xl-3 col-sm-6 mb-4 mb-sm-0">
                    {/* KPI Sale */}
                    <div className="glass-card animate-slide-up delay-1" style={{ marginBottom: 0, height: '100%' }}>
                                <div className="kpi-row">
                                    <div className="kpi-icon-wrap"><div className="kpi-icon success-icon"><i className="fas fa-tags"></i></div> Total Sale Value</div>
                                </div>
                                <div className="d-flex align-items-baseline mt-2">
                                    <h3 className="kpi-value"><AnimatedNumber value={dashboardData.kpis.sale} /></h3>
                                </div>
                            </div>
                </div>
                <div className="col-xl-3 col-sm-6">
                    {/* KPI Capex */}
                    <div className="glass-card animate-slide-up delay-1" style={{ marginBottom: 0, height: '100%' }}>
                                <div className="kpi-row">
                                    <div className="kpi-icon-wrap"><div className="kpi-icon info-icon"><i className="fas fa-building"></i></div> Total Capital Expenditure</div>
                                </div>
                                <div className="d-flex align-items-baseline mt-2">
                                    <h3 className="kpi-value"><AnimatedNumber value={dashboardData.kpis.capex} /></h3>
                                </div>
                            </div>
                </div>
            </div>

            {/* Row 1: Cashflow & Recent Activities */}
            <div className="row mb-4">
                <div className="col-xl-8 mb-4 mb-xl-0">
                    <div className="glass-card h-100 animate-slide-up delay-2 ">
                        <div className="section-title">
                            <div><div className="live-indicator"></div>Cashflow</div>
                            <Dropdown>
                                <Dropdown.Toggle variant="link" size="sm" className="p-0 text-decoration-none shadow-none" style={{ fontSize: '12px', fontWeight: 500, color: '#888' }}>
                                    Last {cashflowDays} Days
                                </Dropdown.Toggle>
                                <Dropdown.Menu align="end" style={{ fontSize: '13px' }}>
                                    <Dropdown.Item onClick={() => setCashflowDays(7)}>Last 7 Days</Dropdown.Item>
                                    <Dropdown.Item onClick={() => setCashflowDays(15)}>Last 15 Days</Dropdown.Item>
                                    <Dropdown.Item onClick={() => setCashflowDays(30)}>Last 30 Days</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </div>
                        <div className="">
                            <span style={{ fontSize: '11px', color: '#888' }}>Total Liquid</span>
                            <h2 style={{ color: themeColors.dark, fontWeight: 700, margin: 0 }}><AnimatedNumber value={dashboardData.totalLiquid} /></h2>
                        </div>
                        <div id="cashflow-chart">
                            <ReactApexChart options={{...cashflowOptions, chart: {...cashflowOptions.chart, height: 350}}} series={cashflowSeries} type="area" height={350} />
                        </div>
                    </div>
                </div>
                <div className="col-xl-4">
                    <div className="glass-card h-100 animate-slide-up delay-3 " style={{ height: '100%' }}>
                        <div className="section-title ">
                            <div><div className="live-indicator"></div>Recent Activities</div>
                            <i className="fas fa-ellipsis-h text-muted"></i>
                        </div>
                        <span style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '15px' }}>Latest</span>
                        
                        {dashboardData.recentActivities.map(act => (
                            <div className="activity-item" key={`${act.type}-${act.id}`}>
                                <div className="d-flex align-items-center">
                                    <div className="activity-icon" style={{
                                        color: act.type === 'Receipt' ? themeColors.secondary : (act.type === 'Payment' ? themeColors.danger : themeColors.primary),
                                        background: act.type === 'Receipt' ? 'rgba(16, 185, 129, 0.15)' : (act.type === 'Payment' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)')
                                    }}>
                                        <i className={`fas fa-${act.type === 'Receipt' ? 'arrow-down' : (act.type === 'Payment' ? 'arrow-up' : 'random')}`}></i>
                                    </div>
                                    <div>
                                        <h6 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: themeColors.dark }}>{act.desc}</h6>
                                        <span style={{ fontSize: '11px', color: '#888' }}>{act.date}</span>
                                    </div>
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: act.type === 'Payment' ? themeColors.danger : themeColors.secondary }}>
                                    {act.type === 'Payment' ? '-' : '+'}<AnimatedNumber value={act.amount} />
                                </span>
                            </div>
                        ))}
                        {dashboardData.recentActivities.length === 0 && (
                            <div className="text-muted text-center pb-2" style={{ fontSize: '12px' }}>No recent activities</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Row 2: Breakdowns & Operating Accounts */}
            <div className="row mb-4">
                <div className="col-xl-4 mb-4 mb-xl-0">
                    <div className="glass-card h-100 animate-slide-up delay-3 d-flex flex-column  " style={{ height: '100%' }}>
                        <div className="section-title">
                            <span>Income Breakdown</span>
                            <Dropdown>
                                <Dropdown.Toggle variant="link" size="sm" className="p-0 text-decoration-none shadow-none" style={{ fontSize: '12px', fontWeight: 500, color: '#888' }}>
                                    {expenseDays === 'all' ? 'All Time' : `Last ${expenseDays} Days`}
                                </Dropdown.Toggle>
                                <Dropdown.Menu align="end" style={{ fontSize: '13px' }}>
                                    <Dropdown.Item onClick={() => setExpenseDays('all')} active={expenseDays === 'all'}>All Time</Dropdown.Item>
                                    <Dropdown.Item onClick={() => setExpenseDays(30)} active={expenseDays === 30}>Last 30 Days</Dropdown.Item>
                                    <Dropdown.Item onClick={() => setExpenseDays(90)} active={expenseDays === 90}>Last 90 Days</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </div>
                        <div className="d-flex justify-content-center align-items-center ">
                            <ReactApexChart options={{...incomeOptions, chart: {...incomeOptions.chart, height: 250}}} series={safeIncomeSeries} type="donut" height={250} />
                        </div>
                        <div className="legend-list ">
                            {dashboardData.incomeBreakdown.map((item, index) => {
                                const colors = [themeColors.secondary, themeColors.tertiary, themeColors.primary, '#f6c23e'];
                                const percent = incomeTotal > 0 ? Math.round((item.value / incomeTotal) * 100) : 0;
                                return (
                                    <div className="legend-item" key={index}>
                                        <div className="d-flex align-items-center">
                                            <div className="legend-dot" style={{ background: colors[index % colors.length] }}></div>
                                            <div className="legend-text">
                                                <h6>{item.name}</h6>
                                                <span><AnimatedNumber value={item.value} /></span>
                                            </div>
                                        </div>
                                        <div className="legend-percent">{percent}%</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
                <div className="col-xl-4 mb-4 mb-xl-0">
                    <div className="glass-card h-100 animate-slide-up delay-2 d-flex flex-column" style={{ height: '100%' }}>
                        <div className="section-title">
                            <span>Expense Breakdown</span>
                            <Dropdown>
                                <Dropdown.Toggle variant="link" size="sm" className="p-0 text-decoration-none shadow-none" style={{ fontSize: '12px', fontWeight: 500, color: '#888' }}>
                                    {expenseDays === 'all' ? 'All Time' : `Last ${expenseDays} Days`}
                                </Dropdown.Toggle>
                                <Dropdown.Menu align="end" style={{ fontSize: '13px' }}>
                                    <Dropdown.Item onClick={() => setExpenseDays('all')} active={expenseDays === 'all'}>All Time</Dropdown.Item>
                                    <Dropdown.Item onClick={() => setExpenseDays(30)} active={expenseDays === 30}>Last 30 Days</Dropdown.Item>
                                    <Dropdown.Item onClick={() => setExpenseDays(90)} active={expenseDays === 90}>Last 90 Days</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </div>
                        
                        <div className="d-flex justify-content-center align-items-center ">
                            <ReactApexChart options={{...expenseRadialOptions, chart: {...expenseRadialOptions.chart, height: 250}}} series={safeRadialSeries} type="radialBar" height={250} />
                        </div>

                        <div className=" ">
                            <span style={{ fontSize: '11px', color: '#888' }}>Total Top Expenses</span>
                            <div className="d-flex align-items-center">
                                <h2 style={{ color: themeColors.dark, fontWeight: 700, margin: '0 10px 0 0' }}><AnimatedNumber value={expenseTotal} /></h2>
                            </div>
                        </div>

                        <div className="legend-list mt-auto">
                            {dashboardData.expenseBreakdown.map((item, index) => {
                                const colors = [themeColors.primary, themeColors.secondary, themeColors.tertiary, '#f6c23e'];
                                const percent = expenseTotal > 0 ? Math.round((item.value / expenseTotal) * 100) : 0;
                                return (
                                    <div className="legend-item" key={index}>

                                        <div className="d-flex align-items-center">
                                            <div className="legend-dot" style={{ background: colors[index % colors.length] }}></div>
                                            <div className="legend-text">
                                                <h6>{item.name}</h6>
                                                <span><AnimatedNumber value={item.value} /></span>
                                            </div>
                                        </div>
                                        <div className="legend-percent">{percent}%</div>
                                    </div>
                                )
                            })}
                            {dashboardData.expenseBreakdown.length === 0 && (
                                <div className="text-muted text-center" style={{ fontSize: '12px' }}>No expense data available</div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="col-xl-4">
                    <div className="glass-card h-100 animate-slide-up delay-3 " style={{ height: '100%' }}>
                        <div className="section-title ">
                            <span>Operating Accounts</span>
                            <i className="fas fa-building text-muted"></i>
                        </div>
                        <div className="">
                            <span style={{ fontSize: '11px', color: '#888' }}>Total Liquid Cash</span>
                            <h2 style={{ color: themeColors.dark, fontWeight: 700, margin: 0 }}><AnimatedNumber value={dashboardData.totalLiquid} /></h2>
                        </div>
                        
                        <div className="d-flex justify-content-center align-items-center ">
                            <ReactApexChart options={{...operatingOptions, chart: {...operatingOptions.chart, height: 250}}} series={safeOperatingSeries} type="donut" height={250} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Row 3: Trends */}
            <div className="row mb-4">
                <div className="col-xl-6 mb-4 mb-xl-0">
                    <div className="glass-card animate-slide-up delay-3 h-100" style={{ marginBottom: 0 }}>
                                <div className="section-title ">
                                    <span>Net Profit Trend</span>
                                    <i className="fas fa-chart-line text-muted"></i>
                                </div>
                                <div className="">
                                    <ReactApexChart options={{...netProfitOptions, chart: {...netProfitOptions.chart, height: 300}}} series={netProfitSeries} type="line" height={300} />
                                </div>
                            </div>
                </div>
                <div className="col-xl-6">
                    <div className="glass-card animate-slide-up delay-3 h-100" style={{ marginBottom: 0 }}>
                                <div className="section-title ">
                                    <span>Income vs Expense</span>
                                    <i className="fas fa-chart-bar text-muted"></i>
                                </div>
                                <div className="">
                                    <ReactApexChart options={{...dailyIncExpOptions, chart: {...dailyIncExpOptions.chart, height: 300}}} series={dailyIncExpSeries} type="bar" height={300} />
                                </div>
                            </div>
                </div>
            </div>

            {/* Row 4: Debtors / Creditors */}
            <div className="row">
                <div className="col-xl-6 mb-4 mb-xl-0">
                    <div className="glass-card h-100 animate-slide-up delay-2 " style={{ height: '100%' }}>
                        <div className="section-title ">
                            <span>Outstanding</span>
                            <i className="fas fa-ellipsis-h text-muted"></i>
                        </div>
                        <span style={{ fontSize: '11px', color: '#888' }}>Receivables vs Payables</span>
                        
                        <div className="">
                            <ReactApexChart options={{...arApOptions, chart: {...arApOptions.chart, height: 300}}} series={arApSeries} type="bar" height={300} />
                        </div>
                    </div>
                </div>
                <div className="col-xl-6">
                    <div className="glass-card h-100 animate-slide-up delay-3  " style={{ height: '100%' }}>
                        <div className="section-title ">
                            <span>Top 5 Receivables</span>
                            <i className="fas fa-users text-muted"></i>
                        </div>
                        <div className="">
                            <ReactApexChart options={{...topDebtorsOptions, chart: {...topDebtorsOptions.chart, height: 300}}} series={topDebtorsSeries} type="bar" height={300} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinanceDashboard;
