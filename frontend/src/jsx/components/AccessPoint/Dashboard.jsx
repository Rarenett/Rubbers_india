import React, { useState, useEffect, Fragment, useContext } from 'react';
import { Row, Col, Card, Badge, Table } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import {
    getGates,
    getGateCategories,
    getGateSubCategories,
    getEntryTags,
    getVisitors,
    getGateEntries
} from '../../../services/GateManagementService';
import AppointmentService from '../../../services/AppointmentService';
import { ThemeContext } from "../../../context/ThemeContext";
import { usePermission } from '../../../hooks/usePermission';

const AnimatedCounter = ({ end, duration = 1000 }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime = null;
        let animationFrame;
        const animate = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            setCount(Math.floor(progress * end));
            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            }
        };
        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [end, duration]);

    return <span>{count}</span>;
};

const AccessPointDashboard = ({ embedded = false }) => {
    const navigate = useNavigate();
    const { background } = useContext(ThemeContext);
    const isDark = background.value === "dark";
    const { can } = usePermission();

    const [stats, setStats] = useState({
        gates: 0,
        categories: 0,
        subcategories: 0,
        tags: 0,
        visitors: 0,
        entries: 0
    });
    const [recentEntries, setRecentEntries] = useState([]);
    const [todayAppointments, setTodayAppointments] = useState([]);
    const [currentTime, setCurrentTime] = useState(new Date());

    const getFullImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
            return path;
        }
        const baseUrl = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${baseUrl}${cleanPath}`;
    };

    useEffect(() => {
        fetchStats();
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchStats = async () => {
        try {
            const requests = [];
            if (can('gates', 'view')) requests.push(getGates().then(data => ({ type: 'gates', count: data.length })));
            if (can('access-point-categories', 'view')) requests.push(getGateCategories().then(data => ({ type: 'categories', count: data.length })));
            if (can('access-point-subcategories', 'view')) requests.push(getGateSubCategories().then(data => ({ type: 'subcategories', count: data.length })));
            if (can('entry-tags', 'view')) requests.push(getEntryTags().then(data => ({ type: 'tags', count: data.length })));
            if (can('visitors', 'view')) requests.push(getVisitors().then(data => ({ type: 'visitors', count: data.length })));
            if (can('gate-entry', 'view')) requests.push(getGateEntries().then(data => ({ type: 'entries', data })));
            if (can('appointments', 'view')) requests.push(AppointmentService.getTodayAppointments().then(data => ({ type: 'appointments', data })));

            if (requests.length === 0) return;

            const results = await Promise.allSettled(requests);
            
            const newStats = { ...stats };
            let entriesData = [];
            let appointmentsData = [];

            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    const res = result.value;
                    if (res.type === 'entries') {
                        newStats.entries = res.data.length;
                        entriesData = res.data;
                    } else if (res.type === 'appointments') {
                        appointmentsData = res.data;
                    } else {
                        newStats[res.type] = res.count;
                    }
                }
            });

            setStats(newStats);
            const sortedEntries = entriesData.sort((a, b) => new Date(b.entry_time) - new Date(a.entry_time));
            setRecentEntries(sortedEntries.slice(0, 5));
            setTodayAppointments(appointmentsData);
        } catch (error) {
            console.error("Error fetching stats", error);
        }
    };

    const navItems = [
        {
            title: "Gate Registration",
            desc: "Register and manage physical gate checkpoints.",
            icon: "fa fa-door-closed",
            to: "/access-point/gates",
            color: "primary",
            delay: "0.1s",
            count: stats.gates,
            countUnit: "Gates",
            module: "gates"
        },
        {
            title: "Category Master",
            desc: "Define visitor categories and UI color codes.",
            icon: "fa fa-layer-group",
            to: "/access-point/categories",
            color: "info",
            delay: "0.2s",
            count: stats.categories,
            countUnit: "Categories",
            module: "access-point-categories"
        },
        {
            title: "Sub-Category Master",
            desc: "Add specific sub-types for each category.",
            icon: "fa fa-stream",
            to: "/access-point/subcategories",
            color: "success",
            delay: "0.3s",
            count: stats.subcategories,
            countUnit: "Sub-Categories",
            module: "access-point-subcategories"
        },
        {
            title: "Tag Management",
            desc: "Issue tags and auto-generate serial tags.",
            icon: "fa fa-tags",
            to: "/access-point/entry-tags",
            color: "warning",
            delay: "0.4s",
            count: stats.tags,
            countUnit: "Tags",
            module: "entry-tags"
        },
        {
            title: "Visitor Registration",
            desc: "Search, register and manage visitor records.",
            icon: "fa fa-id-badge",
            to: "/access-point/visitors",
            color: "danger",
            delay: "0.5s",
            count: stats.visitors,
            countUnit: "Visitors",
            module: "visitors"
        },
        {
            title: "Gate Entry Registration",
            desc: "Record and manage entry/exit for visitors.",
            icon: "fa fa-sign-in-alt",
            to: "/access-point/gate-entry",
            color: "primary",
            delay: "0.6s",
            count: stats.entries,
            countUnit: "Entries",
            module: "gate-entry"
        }
    ];

    const visibleNavItems = navItems.filter(item => {
        if (item.module) {
            return can(item.module, 'view');
        }
        return true;
    });

    const content = (
        <Fragment>
            {!embedded && (
                <div className="page-titles">
                <button 
                    onClick={() => window.history.back()} 
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>
            )}

            {/* Welcome Banner */}
            {!embedded && (
                <Row className="mb-4">
                    <Col xl={12}>
                        <Card className="glass-card banner-gradient-border fade-up border-0 overflow-hidden">
                            <Card.Body className="p-5 d-flex justify-content-between align-items-center position-relative">
                                <div className="z-index-1">
                                    <h1 className="mb-3 fw-light welcome-text" style={{ fontSize: '2.8rem', letterSpacing: '-1px' }}>
                                        The <span className="fw-bold">AccessCore</span> Hub
                                    </h1>
                                    <p className="mb-0 banner-subtext fs-18 max-w-600 opacity-70">
                                        Strategic infrastructure management for your physical entry points.
                                        Powered by real-time monitoring and advanced visitor tracking.
                                    </p>
                                </div>
                                <div className="text-end z-index-1 d-none d-md-block">
                                    <div className="time-display glass-pill mb-2">
                                        <i className="fa fa-clock me-2 text-info opacity-50"></i>
                                        <span className="fw-bold time-text">{currentTime.toLocaleTimeString()}</span>
                                    </div>
                                    <div className="glass-pill-sm">
                                        <span className="live-indicator-cyan me-2"></span>
                                        <span className="text-info font-w500 small text-uppercase ls-1">System Active</span>
                                    </div>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            )}

            <Row className="mb-4">
                {visibleNavItems.map((item, index) => (
                    <Col xl={item.title.includes("Registration") ? 6 : 3} lg={6} md={6} sm={12} key={index} className="mb-4">
                        <Card className="glass-card module-card-premium fade-up h-100" style={{ animationDelay: item.delay }}>
                            <Card.Body className="p-4 d-flex flex-column h-100 position-relative">
                                <div className="d-flex justify-content-between align-items-start mb-4">
                                    <div className="module-icon-box-sm">
                                        <i className={item.icon} style={{ color: '#00d2ff', fontSize: '24px' }}></i>
                                    </div>
                                    <div className="text-end">
                                        <div className="stats-badge-minimal">
                                            <span className="fs-18 fw-800 welcome-text d-block lh-1">
                                                <AnimatedCounter end={item.count} />
                                            </span>
                                            <span className="x-small text-uppercase ls-1 text-muted fw-600" style={{ fontSize: '0.65rem' }}>{item.countUnit}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-grow-1">
                                    <h5 className="mb-2 fw-bold welcome-text fs-18">{item.title}</h5>
                                    <p className="banner-subtext mb-4 fs-14 opacity-70" style={{ lineHeight: '1.5' }}>{item.desc}</p>
                                </div>
                                <Link to={item.to} className="btn-manage-pill mt-auto">
                                    <span>Manage {item.title.split(' ')[0]}</span>
                                    <i className="fa fa-chevron-right ms-2 fs-10"></i>
                                </Link>
                                <div className="card-glass-glow"></div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Separated Appointments Section */}
            {can('appointments', 'view') && (
                <>
                    <div className="d-flex align-items-center mb-3 mt-5 fade-up" style={{ animationDelay: '0.6s' }}>
                        <h4 className="mb-0 me-auto section-title welcome-text fw-700">Today's Expected Appointments</h4>
                        <Link to="/appointments" className="btn btn-link text-primary btn-sm fw-600 p-0 text-decoration-none">View All</Link>
                    </div>
                    <Row className="mb-4">
                        <Col xl={12}>
                            <Card className="glass-card fade-up border-0" style={{ animationDelay: '0.7s' }}>
                                <Card.Body className="p-0">
                                    <div className="table-responsive">
                                        <Table hover className="theme-table mb-0">
                                            <thead>
                                                <tr>
                                                    <th className="ps-4">Visitor</th>
                                                    <th>Time</th>
                                                    <th>Meeting With</th>
                                                    <th>Category</th>
                                                    <th>Purpose</th>
                                                    <th className="pe-4 text-end">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {todayAppointments.length > 0 ? todayAppointments.map((app, index) => (
                                                    <tr key={index}>
                                                        <td className="ps-4">
                                                            <div>
                                                                <div className="fw-700 welcome-text" style={{ fontSize: '0.88rem' }}>{app.visitor_name}</div>
                                                                <div className="banner-subtext opacity-50" style={{ fontSize: '0.75rem' }}>{app.visitor_phone}</div>
                                                            </div>
                                                        </td>
                                                        <td><span className="welcome-text fw-600 fs-13">{app.appointment_time.substring(0, 5)}</span></td>
                                                        <td><span className="welcome-text fw-600 fs-13">{app.concerned_staff_name}</span></td>
                                                        <td>
                                                            <Badge bg="none" className="px-2 py-1 text-uppercase fw-800 ls-1"
                                                                style={{
                                                                    fontSize: '10px',
                                                                    background: isDark ? 'rgba(0, 210, 255, 0.1)' : 'rgba(0, 210, 255, 0.05)',
                                                                    color: '#00d2ff',
                                                                    border: '1px solid rgba(0, 210, 255, 0.2)'
                                                                }}>
                                                                {app.visitor_category_name || 'General'}
                                                            </Badge>
                                                        </td>
                                                        <td><span className="banner-subtext opacity-70 fs-13 text-truncate d-block" style={{ maxWidth: '150px' }}>{app.purpose_of_visit}</span></td>
                                                        <td className="pe-4 text-end">
                                                            <Link to={`/access-point/gate-entry?appointmentId=${app.id}`} className="action-icon-btn d-inline-flex ms-auto">
                                                                <i className="fa fa-sign-in-alt fs-12"></i>
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr><td colSpan="6" className="text-center py-5 banner-subtext">No appointments for today.</td></tr>
                                                )}
                                            </tbody>
                                        </Table>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </>
            )}

            {/* Recent Gate Entries Section */}
            {can('gate-entry', 'view') && (
                <>
                <div className="d-flex align-items-center mb-3 mt-5 fade-up" style={{ animationDelay: '0.8s' }}>
                    <h4 className="mb-0 me-auto section-title welcome-text fw-700">Recent Gate Entries</h4>
                    <Link to="/access-point/gate-entries" className="btn btn-link text-primary btn-sm fw-600 p-0 text-decoration-none">View All</Link>
                </div>

                <Row className="mb-4">
                    <Col xl={12}>
                        <Card className="glass-card fade-up border-0" style={{ animationDelay: '0.9s' }}>
                            <Card.Body className="p-0">
                                <div className="table-responsive">
                                    <Table hover className="theme-table mb-0">
                                        <thead>
                                            <tr>
                                                <th className="ps-4">Visitor</th>
                                                <th>Gate</th>
                                                <th>Official</th>
                                                <th className="d-none d-md-table-cell">Department</th>
                                                <th>Entry Time</th>
                                                <th>Status</th>
                                                <th className="pe-4 text-end">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentEntries.length > 0 ? recentEntries.map((entry, index) => (
                                                <tr key={index}>
                                                    <td className="ps-4" style={{ width: '250px' }}>
                                                        <div className="d-flex align-items-center">
                                                            <div
                                                                className="visitor-img-wrapper me-3"
                                                                style={{
                                                                    width: '42px',
                                                                    height: '42px',
                                                                    minWidth: '42px',
                                                                    borderRadius: '50%',
                                                                    overflow: 'hidden',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    border: '2px solid rgba(0, 210, 255, 0.3)'
                                                                }}
                                                            >
                                                                <img
                                                                    src={entry.visitor_photo ? getFullImageUrl(entry.visitor_photo) : 'https://via.placeholder.com/42'}
                                                                    style={{
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        objectFit: 'cover',
                                                                        display: 'block'
                                                                    }}
                                                                    alt=""
                                                                />
                                                            </div>
                                                            <div className="text-truncate" style={{ maxWidth: '180px' }}>
                                                                <div className="fw-700 welcome-text" style={{ fontSize: '0.88rem' }}>{entry.visitor_name}</div>
                                                                <div className="banner-subtext opacity-50" style={{ fontSize: '0.75rem' }}>{entry.visitor_mobile || entry.visitor_phone}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td><span className="welcome-text fw-600 fs-13">{entry.gate_name || entry.entry_gate_no}</span></td>
                                                    <td><span className="welcome-text fw-600 fs-13">{entry.official_name || entry.employee_name}</span></td>
                                                    <td className="d-none d-md-table-cell"><span className="banner-subtext opacity-70 fs-13">{entry.department_name}</span></td>
                                                    <td>
                                                        <span className="banner-subtext opacity-70 fs-13">
                                                            {new Date(entry.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <Badge bg="none" className="px-3 py-1 text-uppercase ls-1 fw-800"
                                                            style={{
                                                                fontSize: '10px',
                                                                backgroundColor: entry.exit_time ? 'rgba(255, 95, 125, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                                color: entry.exit_time ? '#ff5f7d' : '#10b981',
                                                                border: `1px solid ${entry.exit_time ? 'rgba(255, 95, 125, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
                                                            }}>
                                                            {entry.exit_time ? "Exited" : "Inside"}
                                                        </Badge>
                                                    </td>
                                                    <td className="pe-4 text-end">
                                                        <div className="d-flex justify-content-end">
                                                            <Link to={`/access-point/gate-entry/${entry.id}`} className="action-icon-btn">
                                                                <i className="fa fa-eye fs-12"></i>
                                                            </Link>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="7" className="text-center py-5 banner-subtext">No recent entries found.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </Table>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
                </>
            )}
        </Fragment>
    );

    if (embedded) return content;

    return (
        <div className={`dashboard-theme-parent ${isDark ? 'theme-dark' : 'theme-light'}`}>
            <div className="z-index-1 position-relative">
                {content}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .dashboard-theme-parent {
                    position: relative;
                    min-height: 100vh;
                    transition: all 0.5s ease;
                    font-family: 'Inter', sans-serif;
                }

                .welcome-text { transition: color 0.3s ease; }
                .banner-subtext { transition: color 0.3s ease; }

                .glass-card {
                    backdrop-filter: blur(12px) !important;
                    border-radius: 12px !important;
                    transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                    background: ${isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.9)'} !important;
                    border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'} !important;
                    box-shadow: ${isDark ? '0 10px 40px rgba(0, 0, 0, 0.4)' : '0 10px 30px rgba(0,0,0,0.05)'} !important;
                }

                /* Card Enhancements */
                .module-card-premium {
                    overflow: hidden;
                }

                .module-card-premium:hover {
                    border-color: #00d2ff !important;
                    box-shadow: ${isDark ? '0 15px 45px rgba(0, 210, 255, 0.15)' : '0 12px 35px rgba(0, 210, 255, 0.1)'} !important;
                    transform: translateY(-5px);
                }

                .stats-badge-minimal {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                }

                .btn-manage-pill {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0.8rem 1.5rem;
                    background: ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafd'};
                    border-radius: 12px;
                    color: ${isDark ? '#fff' : '#1e293b'} !important;
                    text-decoration: none !important;
                    font-weight: 700;
                    font-size: 0.9rem;
                    transition: all 0.3s ease;
                    border: 1px solid transparent;
                }

                .btn-manage-pill:hover {
                    background: #00d2ff !important;
                    color: #fff !important;
                    box-shadow: 0 5px 15px rgba(0, 210, 255, 0.3);
                }

                .card-glass-glow {
                    position: absolute;
                    top: -50%;
                    right: -50%;
                    width: 200px;
                    height: 200px;
                    background: radial-gradient(circle, rgba(0, 210, 255, 0.05) 0%, transparent 70%);
                    pointer-events: none;
                    transition: all 0.6s ease;
                    z-index: 0;
                }

 .ls-1 { letter-spacing: 1px; }

                /* Table Styling */
                .theme-table thead th {
                    background: ${isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)'} !important;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: ${isDark ? 'rgba(255, 255, 255, 0.5)' : '#475569'} !important;
                    padding: 1.2rem 1rem !important;
                    border: none !important;
                }

                .theme-table tbody tr {
                    border-bottom: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'} !important;
                    transition: background 0.2s ease;
                }

                .theme-table tbody tr:hover {
                    background: ${isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)'} !important;
                }

                .theme-table td {
                    padding: 1.2rem 1rem !important;
                    vertical-align: middle !important;
                    border: none !important;
                }

                .action-icon-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: ${isDark ? '#cbd5e1' : '#475569'};
                    transition: all 0.2s;
                }

                .action-icon-btn:hover {
                    background: #00d2ff !important;
                    color: #fff !important;
                    transform: scale(1.1);
                }

                .visitor-img-wrapper {
                    border: 2px solid rgba(0, 210, 255, 0.2);
                    padding: 2px;
                }

                .live-indicator-cyan {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    background-color: #00d2ff;
                    border-radius: 50%;
                    box-shadow: 0 0 10px #00d2ff;
                    animation: blink 2s infinite;
                }

                @keyframes blink {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(1.2); }
                    100% { opacity: 1; transform: scale(1); }
                }

                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .fade-up {
                    opacity: 0;
                    animation: fadeUp 0.8s cubic-bezier(0.165, 0.84, 0.44, 1) forwards;
                }

                /* Dark Theme Overrides */
                .theme-dark .welcome-text { color: #fff !important; }
                .theme-dark .banner-subtext { color: rgba(255,255,255,0.7) !important; }
                
                /* Light Theme Overrides */
                .theme-light .welcome-text { color: #0f172a !important; }
                .theme-light .banner-subtext { color: #475569 !important; }
                .theme-light .glass-pill { background: rgba(0, 0, 0, 0.03); }
                .theme-light .glass-pill-sm { background: rgba(0, 0, 0, 0.02); }
                `
            }} />
        </div>
    );
};

export default AccessPointDashboard;
