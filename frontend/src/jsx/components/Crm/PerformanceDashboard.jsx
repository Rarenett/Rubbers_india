import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../services/AxiosInstance';
import Chart from 'react-apexcharts';

const PerformanceDashboard = () => {
    const [performance, setPerformance] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPerformance = async () => {
            try {
                const res = await axiosInstance.get('/api/crm/performance-stats/');
                if (res.status === 200) {
                    setPerformance(res.data);
                }
            } catch (error) {
                console.error("Error fetching performance", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPerformance();
    }, []);

    const topPerformer = performance.length > 0 
        ? [...performance].sort((a, b) => b.conversion_rate - a.conversion_rate)[0]
        : null;

    const summary = {
        totalLeads: performance.reduce((acc, curr) => acc + curr.total_leads, 0),
        totalConversions: performance.reduce((acc, curr) => acc + curr.conversions, 0),
        totalProcessed: performance.reduce((acc, curr) => acc + curr.processed_leads, 0),
        avgConversion: performance.length > 0 
            ? (performance.reduce((acc, curr) => acc + curr.conversion_rate, 0) / performance.length).toFixed(1)
            : 0
    };

    // Donut Chart: Department Outcome Distribution
    const donutOptions = {
        chart: {
            type: 'donut',
            dropShadow: {
                enabled: true,
                color: '#000',
                top: 10,
                left: 0,
                blur: 10,
                opacity: 0.1
            }
        },
        colors: ['#00d1ff', '#198754', '#ffc107', '#dc3545'],
        labels: ['Lead Funnel', 'Opportunities', 'In-Progress', 'Disqualified'],
        plotOptions: {
            pie: {
                startAngle: -90,
                endAngle: 90,
                offsetY: 10,
                donut: {
                    size: '75%',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '14px',
                            fontWeight: 800,
                            color: '#64748b',
                            offsetY: -10
                        },
                        value: {
                            show: true,
                            fontSize: '28px',
                            fontWeight: 900,
                            color: 'var(--crm-text-primary)',
                            offsetY: 10,
                            formatter: (val) => val
                        },
                        total: {
                            show: true,
                            label: 'TOTAL WINS',
                            color: '#64748b',
                            formatter: () => summary.totalConversions
                        }
                    }
                }
            }
        },
        grid: { padding: { bottom: -80 } },
        stroke: { show: true, width: 8, colors: ['var(--crm-card-bg)'] },
        dataLabels: { enabled: false },
        legend: {
            show: true,
            position: 'bottom',
            horizontalAlign: 'center',
            fontWeight: 700,
            fontSize: '12px',
            markers: { radius: 12 },
            itemMargin: { horizontal: 10, vertical: 5 }
        },
        tooltip: {
            theme: 'dark',
            fillSeriesColor: false
        }
    };

    const pendingLeads = summary.totalLeads - summary.totalProcessed;
    const disqualifiedLeads = summary.totalProcessed - summary.totalConversions;

    const donutSeries = [
        summary.totalLeads, 
        summary.totalConversions, 
        pendingLeads > 0 ? pendingLeads : 0, 
        disqualifiedLeads > 0 ? disqualifiedLeads : 0
    ];

    const getRadialOptions = (color) => ({
        chart: { type: 'radialBar', sparkline: { enabled: true } },
        plotOptions: {
            radialBar: {
                hollow: { size: '60%' },
                track: { background: 'var(--crm-bg)', strokeWidth: '100%' },
                dataLabels: {
                    name: { show: false },
                    value: {
                        show: true,
                        fontSize: '14px',
                        fontWeight: 900,
                        offsetY: 6,
                        color: 'var(--crm-text-primary)'
                    }
                }
            }
        },
        colors: [color],
        stroke: { lineCap: 'round' }
    });

    return (
        <div className="performance-dashboard-view">
            <style>{`
                .perf-summary-bar {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2.5rem;
                }

                .summary-card {
                    background: var(--crm-card-bg);
                    border: 1px solid var(--crm-border);
                    border-radius: 24px;
                    padding: 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    box-shadow: var(--crm-shadow);
                }

                .chart-container-premium {
                    background: var(--crm-card-bg);
                    border: 1px solid var(--crm-border);
                    border-radius: 30px;
                    padding: 3rem;
                    margin-bottom: 2.5rem;
                    box-shadow: var(--crm-shadow);
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    position: relative;
                    overflow: hidden;
                }

                .chart-info-side {
                    flex: 1;
                    min-width: 300px;
                    padding-right: 2rem;
                    z-index: 1;
                }

                .donut-wrapper {
                    flex: 1;
                    min-width: 350px;
                    display: flex;
                    justify-content: center;
                    z-index: 1;
                }

                .glow-bg {
                    position: absolute;
                    width: 300px;
                    height: 300px;
                    background: var(--crm-accent);
                    filter: blur(150px);
                    opacity: 0.1;
                    top: 50%;
                    left: 70%;
                    transform: translate(-50%, -50%);
                    pointer-events: none;
                }

                .stat-pill-list {
                    list-style: none;
                    padding: 0; margin: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .stat-pill-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.5rem;
                    background: var(--crm-bg);
                    border-radius: 18px;
                    border: 1px solid var(--crm-border);
                    transition: all 0.3s;
                }

                .stat-pill-item:hover {
                    transform: translateX(10px);
                    border-color: var(--crm-accent);
                }

                .leaderboard-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 1.5rem;
                }

                .perf-card {
                    background: var(--crm-card-bg);
                    border: 1px solid var(--crm-border);
                    border-radius: 24px;
                    padding: 2rem;
                    box-shadow: var(--crm-shadow);
                }
            `}</style>

            <div className="mb-4">
                <h3 className="fw-900 text-primary">Department Outcome DNA</h3>
                <p className="text-secondary fw-700">Holistic distribution of tele-calling impact metrics.</p>
            </div>

            {loading ? (
                <div className="text-center py-5 opacity-50">Mapping performance genome...</div>
            ) : performance.length === 0 ? (
                <div className="text-center py-5 text-secondary card p-5 border-dashed">
                    <i className="fa fa-pie-chart fa-3x mb-3 opacity-10"></i>
                    <p className="fw-700">Waiting for interaction signals...</p>
                </div>
            ) : (
                <>
                    <div className="perf-summary-bar">
                        <div className="summary-card">
                            <div className="summary-icon" style={{ color: '#00d1ff', background: 'rgba(0,209,255,0.1)', padding: '12px', borderRadius: '15px' }}>
                                <i className="fa fa-fire"></i>
                            </div>
                            <div>
                                <small className="text-secondary fw-800">PIPELINE</small>
                                <h4 className="m-0 fw-900">{summary.totalLeads}</h4>
                            </div>
                        </div>
                        <div className="summary-card">
                            <div className="summary-icon" style={{ color: '#198754', background: 'rgba(25,135,84,0.1)', padding: '12px', borderRadius: '15px' }}>
                                <i className="fa fa-gem"></i>
                            </div>
                            <div>
                                <small className="text-secondary fw-800">WINS</small>
                                <h4 className="m-0 fw-900">{summary.totalConversions}</h4>
                            </div>
                        </div>
                        <div className="summary-card">
                            <div className="summary-icon" style={{ color: '#fd7e14', background: 'rgba(253,126,20,0.1)', padding: '12px', borderRadius: '15px' }}>
                                <i className="fa fa-bolt"></i>
                            </div>
                            <div>
                                <small className="text-secondary fw-800">TEAM RATE</small>
                                <h4 className="m-0 fw-900">{summary.avgConversion}%</h4>
                            </div>
                        </div>
                    </div>

                    <div className="chart-container-premium">
                        <div className="glow-bg"></div>
                        <div className="chart-info-side">
                            <div className="badge badge-primary mb-3 px-3 py-2">LIVE DISTRIBUTION</div>
                            <h4 className="fw-900 mb-4">Overall Funnel Health</h4>
                            <div className="stat-pill-list">
                                <div className="stat-pill-item">
                                    <span className="text-secondary fw-800 xsmall">CONVERSION EFFICIENCY</span>
                                    <span className="fw-900 text-success">+{summary.avgConversion}%</span>
                                </div>
                                <div className="stat-pill-item">
                                    <span className="text-secondary fw-800 xsmall">ACTIVE PROJECT VELOCITY</span>
                                    <span className="fw-900 text-primary">HIGH</span>
                                </div>
                            </div>
                        </div>
                        <div className="donut-wrapper">
                            <Chart 
                                options={donutOptions} 
                                series={donutSeries} 
                                type="donut" 
                                height={380} 
                            />
                        </div>
                    </div>

                    <div className="leaderboard-grid">
                        {performance.map(perf => (
                            <div key={perf.id} className="perf-card">
                                <div className="d-flex justify-content-between align-items-center mb-4">
                                    <div className="d-flex align-items-center gap-3">
                                        <div style={{
                                            width: '50px', height: '50px', borderRadius: '16px',
                                            background: 'var(--crm-accent-soft)', color: 'var(--crm-accent)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 900
                                        }}>
                                            {perf.full_name?.charAt(0)}
                                        </div>
                                        <div>
                                            <h6 className="m-0 fw-900">{perf.full_name}</h6>
                                            <small className="text-secondary fw-700">Total Ops: {perf.conversions}</small>
                                        </div>
                                    </div>
                                    <div style={{ width: '65px', height: '65px' }}>
                                        <Chart 
                                            options={getRadialOptions(perf.conversion_rate > 30 ? '#198754' : '#00d1ff')} 
                                            series={[perf.conversion_rate]} 
                                            type="radialBar" 
                                            width="100%"
                                        />
                                    </div>
                                </div>
                                
                                <div className="d-flex justify-content-between pt-3 border-top">
                                    <div className="text-center">
                                        <h5 className="m-0 fw-900">{perf.total_leads}</h5>
                                        <small className="text-secondary fw-800 xsmall">PIPELINE</small>
                                    </div>
                                    <div className="text-center">
                                        <h5 className="m-0 fw-900 text-primary">{perf.efficiency}%</h5>
                                        <small className="text-secondary fw-800 xsmall">PRODUCTIVITY</small>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default PerformanceDashboard;
