import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Row, Col, Card } from 'react-bootstrap';
import { ThemeContext } from "../../../context/ThemeContext";
import './AccessPoint.css';

import AccessPointDashboard from './Dashboard';
import GateEntryForm from './GateEntryForm';
import VisitorRegistration from './VisitorRegistration';
import GateEntryList from './GateEntryList';
import ActivityReport from './ActivityReport';
import GateEntryReport from './GateEntryReport';
import MyVisitorApprovals from './MyVisitorApprovals';
import VehicleGateManagement from './VehicleGateManagement';
import VisitorReallocation from './VisitorReallocation';

const StaticParticles = () => {
    const canvasRef = React.useRef(null);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const handleResize = () => {
            const width = canvas.width = window.innerWidth;
            const height = canvas.height = window.innerHeight;

            ctx.clearRect(0, 0, width, height);

            const spacing = 40; // Spacing between dots
            const cols = Math.ceil(width / spacing);
            const rows = Math.ceil(height / spacing);

            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    const x = i * spacing;
                    const y = j * spacing;
                    const size = 0.8;
                    const opacity = 0.15;

                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, 2 * Math.PI);
                    ctx.fillStyle = `rgba(0, 210, 255, ${opacity})`;
                    ctx.fill();
                }
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return <canvas ref={canvasRef} className="ap-globe-canvas" />;
};

const AccessPointManagement = () => {
    const { background } = useContext(ThemeContext);
    const isDark = background.value === "dark";
    const { tab = 'dashboard' } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(tab);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        setActiveTab(tab);
    }, [tab]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleTabChange = (newTab) => {
        setActiveTab(newTab);
        navigate(`/access-point/manage/${newTab}`);
    };

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: 'fa fa-th-large' },
        { id: 'gate-entry', label: 'Gate Entry', icon: 'fa fa-sign-in-alt' },
        { id: 'visitors', label: 'Visitors', icon: 'fa fa-users' },
        { id: 'vehicles', label: 'Vehicles', icon: 'fa fa-truck' },
        { id: 'reallocation', label: 'Reallocation', icon: 'fa fa-exchange-alt' },
        { id: 'my-approvals', label: 'My Approvals', icon: 'fa fa-check-circle' },
        { id: 'history', label: 'Logs', icon: 'fa fa-history' },
        { id: 'reports', label: 'Report', icon: 'fa fa-file-chart-line' },
        { id: 'settings', label: 'Setup', icon: 'fa fa-cog' }
    ];

    return (
        <div className={`ap-management-container ${isDark ? 'theme-dark' : 'theme-light'}`}>
            {/* Premium Background Elements */}
            <StaticParticles />
            <div className="ap-glow-sphere ap-sphere-1"></div>
            <div className="ap-glow-sphere ap-sphere-2"></div>

            <div className="ap-content-wrapper">
                {/* Combined Header Strip — 2-line layout */}
                <div className="ap-combined-header">
                    {/* Row 1: Title + Live meta */}
                    <div className="ap-header-row1">
                        <div className="ap-logo-text">
                            The <span>AccessCore</span> Hub
                        </div>
                        <div className="ap-header-meta d-none d-md-flex">
                            <div className="ap-time-chip">
                                <i className="fa fa-clock me-2 opacity-50"></i>
                                <span className="fw-bold">{currentTime.toLocaleTimeString()}</span>
                            </div>
                            <div className="ap-status-chip">
                                <span className="live-dot"></span>
                                <span className="status-text">System Active</span>
                            </div>
                        </div>
                    </div>
                    {/* Row 2: Tab navigation */}
                    <div className="ap-tabs-inline">
                        {tabs.map((t) => (
                            <div
                                key={t.id}
                                className={`ap-tab-item ${activeTab === t.id ? 'active' : ''}`}
                                onClick={() => handleTabChange(t.id)}
                            >
                                <i className={`${t.icon} ap-tab-icon`}></i>
                                <span>{t.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="ap-tab-content">
                    { activeTab === 'dashboard' && <AccessPointDashboard embedded={true} /> }
                    { activeTab === 'gate-entry' && <GateEntryForm embedded={true} /> }
                    { activeTab === 'visitors' && <VisitorRegistration embedded={true} /> }
                    { activeTab === 'vehicles' && <VehicleGateManagement embedded={true} /> }
                    { activeTab === 'reallocation' && <VisitorReallocation embedded={true} /> }
                    { activeTab === 'my-approvals' && <MyVisitorApprovals embedded={true} /> }
                    { activeTab === 'history' && <GateEntryList embedded={true} /> }
                    { activeTab === 'reports' && <GateEntryReport embedded={true} /> }
                    { activeTab === 'settings' && (
                        <div className="ap-section-card">
                            <h4 className="mb-4">System Setup</h4>
                            <Row>
                                <Col md={3} className="mb-3">
                                    <Card className="h-100 ap-setup-card" onClick={() => navigate('/access-point/gates')}>
                                        <Card.Body className="text-center py-4">
                                            <i className="fa fa-door-closed fs-3 mb-2 text-primary d-block"></i>
                                            <h6 className="mb-0">Gates</h6>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col md={3} className="mb-3">
                                    <Card className="h-100 ap-setup-card" onClick={() => navigate('/access-point/categories')}>
                                        <Card.Body className="text-center py-4">
                                            <i className="fa fa-layer-group fs-3 mb-2 text-info d-block"></i>
                                            <h6 className="mb-0">Categories</h6>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col md={3} className="mb-3">
                                    <Card className="h-100 ap-setup-card" onClick={() => navigate('/access-point/subcategories')}>
                                        <Card.Body className="text-center py-4">
                                            <i className="fa fa-stream fs-3 mb-2 text-success d-block"></i>
                                            <h6 className="mb-0">Sub-Categories</h6>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col md={3} className="mb-3">
                                    <Card className="h-100 ap-setup-card" onClick={() => navigate('/access-point/entry-tags')}>
                                        <Card.Body className="text-center py-4">
                                            <i className="fa fa-tags fs-3 mb-2 text-warning d-block"></i>
                                            <h6 className="mb-0">Entry Tags</h6>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col md={3} className="mb-3">
                                    <Card className="h-100 ap-setup-card" onClick={() => navigate('/access-point/vehicle-types')}>
                                        <Card.Body className="text-center py-4">
                                            <i className="fa fa-truck-moving fs-3 mb-2 text-danger d-block"></i>
                                            <h6 className="mb-0">Vehicle Types</h6>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col md={3} className="mb-3">
                                    <Card className="h-100 ap-setup-card" onClick={() => navigate('/access-point/approveless-configs')}>
                                        <Card.Body className="text-center py-4">
                                            <i className="fa fa-user-shield fs-3 mb-2 text-success d-block"></i>
                                            <h6 className="mb-0">Approveless Entry</h6>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col md={3} className="mb-3">
                                    <Card className="h-100 ap-setup-card" onClick={() => navigate('/access-point/equipments')}>
                                        <Card.Body className="text-center py-4">
                                            <i className="fa fa-tools fs-3 mb-2 text-primary d-block"></i>
                                            <h6 className="mb-0">Tools & Equipments</h6>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col md={3} className="mb-3">
                                    <Card className="h-100 ap-setup-card" onClick={() => navigate('/access-point/employee-vehicles')}>
                                        <Card.Body className="text-center py-4">
                                            <i className="fa fa-car-side fs-3 mb-2 text-warning d-block"></i>
                                            <h6 className="mb-0">Employee Vehicles</h6>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>
                            <hr />
                            <Card className="glass-card border-0 mt-4 fade-up" style={{ background: isDark ? 'rgba(0, 210, 255, 0.03)' : 'rgba(0, 210, 255, 0.01)', border: '1px dashed rgba(0, 210, 255, 0.2) !important' }}>
                                <Card.Body className="text-center py-4">
                                    <i className="fa fa-tools fs-3 mb-2 text-info opacity-50 d-block"></i>
                                    <p className={`mb-0 ${isDark ? 'text-white-50' : 'text-dark-50'} fw-600 ls-1 fs-12 text-uppercase`}>
                                        Advanced configurations and global settings are coming soon.
                                    </p>
                                </Card.Body>
                            </Card>
                        </div>
                    )}
                </div>

            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                /* ── Module Container & Backgrounds ── */
                .ap-management-container {
                    min-height: 100vh;
                    position: relative;
                    padding: 2.5rem;
                    overflow: hidden;
                    transition: all 0.5s ease;
                }
                .ap-management-container.theme-dark {
                    background: #050a12; /* Very dark base */
                    background: radial-gradient(circle at 50% 0%, #152a4e 0%, #050a12 70%);
                }
                .ap-management-container.theme-light {
                    background: radial-gradient(circle at 50% 0%, #f0f7ff 0%, #ffffff 85%);
                }

                .ap-content-wrapper {
                    position: relative;
                    z-index: 5;
                }

                /* Canvas Globe */
                .ap-globe-canvas {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 1;
                    pointer-events: none;
                    opacity: 0.8;
                }

                /* Glowing Spheres */
                .ap-glow-sphere {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(120px);
                    z-index: 0;
                    pointer-events: none;
                }
                .ap-sphere-1 {
                    top: -15%; left: 10%;
                    width: 600px; height: 600px;
                    background: radial-gradient(circle, rgba(0, 210, 255, 0.12) 0%, transparent 75%);
                    animation: floatSphere 15s ease-in-out infinite alternate;
                }
                .ap-sphere-2 {
                    bottom: -20%; right: 10%;
                    width: 800px; height: 800px;
                    background: radial-gradient(circle, rgba(0, 114, 255, 0.08) 0%, transparent 75%);
                    animation: floatSphere 20s ease-in-out infinite alternate-reverse;
                }
                @keyframes floatSphere {
                    from { transform: translate(-20px, -20px) scale(1); }
                    to { transform: translate(40px, 40px) scale(1.15); }
                }

                /* ── Combined Header Strip — Premium ── */
                .ap-combined-header {
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                    background: linear-gradient(135deg, #0d1b2e 0%, #0f2440 50%, #0d1b2e 100%);
                    border: 1px solid rgba(0, 210, 255, 0.25);
                    border-radius: 1.25rem;
                    padding: 0;
                    margin-bottom: 1.5rem;
                    box-shadow:
                        0 4px 32px rgba(0, 180, 255, 0.12),
                        0 1px 0 rgba(255,255,255,0.04) inset,
                        0 0 0 1px rgba(0, 210, 255, 0.08);
                    overflow: hidden;
                    position: relative;
                }
                .theme-light .ap-combined-header {
                    background: linear-gradient(135deg, #ffffff 0%, #f0f7ff 50%, #ffffff 100%);
                    border: 1px solid rgba(0, 114, 255, 0.15);
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
                }

                /* Subtle animated shimmer line at top */
                .ap-combined-header::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0;
                    height: 2px;
                    background: linear-gradient(90deg, transparent, #00d2ff, #0072ff, #00d2ff, transparent);
                    background-size: 200% 100%;
                    animation: shimmerBar 4s linear infinite;
                }
                @keyframes shimmerBar {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }

                /* Row 1: Title + meta */
                .ap-header-row1 {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 2.2rem 3rem 1.8rem;
                }
                .ap-logo-text {
                    font-size: 2.4rem;
                    font-weight: 800;
                    letter-spacing: -0.8px;
                    background: linear-gradient(90deg, #ffffff 0%, #a0d8ef 60%, #00d2ff 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .theme-light .ap-logo-text {
                    background: linear-gradient(90deg, #050a12 0%, #152a4e 60%, #3b82f6 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .ap-logo-text span {
                    background: linear-gradient(90deg, #00d2ff, #0072ff);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    font-weight: 900;
                }
                
                /* Row 2: Tabs */
                .ap-tabs-inline {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                    padding: 1rem 2.5rem 1.6rem;
                    border-top: 1px solid rgba(0, 210, 255, 0.1);
                }
                .theme-light .ap-tabs-inline {
                    border-top: 1px solid rgba(0, 114, 255, 0.08);
                }

                /* Meta (time + status) */
                .ap-header-meta {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 0.35rem;
                }
                .ap-time-chip {
                    font-size: 1.3rem;
                    font-weight: 700;
                    color: rgba(255,255,255,0.9);
                    font-variant-numeric: tabular-nums;
                    letter-spacing: 0.5px;
                }
                .theme-light .ap-time-chip {
                    color: #050a12;
                }

                .ap-time-chip i { opacity: 0.5; }
                .ap-status-chip {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    color: #00d2ff;
                }
                .theme-light .ap-status-chip {
                    color: #3b82f6;
                }

                .live-dot {
                    display: inline-block;
                    width: 8px; height: 8px;
                    background: #00f2fe;
                    border-radius: 50%;
                    box-shadow: 0 0 10px #00f2fe, 0 0 20px rgba(0,242,254,0.4);
                    animation: liveBlink 2s ease-in-out infinite;
                }
                .theme-light .live-dot {
                    background: #3b82f6;
                    box-shadow: 0 0 10px rgba(59, 130, 246, 0.4);
                }

                @keyframes liveBlink {
                    0%, 100% { opacity: 1; box-shadow: 0 0 10px #00f2fe, 0 0 20px rgba(0,242,254,0.4); }
                    50% { opacity: 0.4; box-shadow: 0 0 4px #00f2fe; }
                }

                /* Tab buttons inside header */
                .ap-combined-header .ap-tab-item {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    padding: 0.6rem 1.4rem;
                    border-radius: 0.75rem;
                    font-size: 1rem;
                    font-weight: 600;
                    color: rgba(255,255,255,0.45);
                    cursor: pointer;
                    transition: all 0.22s ease;
                    border: 1px solid transparent;
                    letter-spacing: 0.2px;
                    position: relative;
                    overflow: hidden;
                }
                .theme-light .ap-combined-header .ap-tab-item {
                    color: rgba(5, 10, 18, 0.4);
                }

                .ap-combined-header .ap-tab-item:hover {
                    color: rgba(255,255,255,0.9);
                    background: rgba(0,210,255,0.08);
                    border-color: rgba(0,210,255,0.25);
                }
                .theme-light .ap-combined-header .ap-tab-item:hover {
                    color: #050a12;
                    background: rgba(59, 130, 246, 0.05);
                    border-color: rgba(59, 130, 246, 0.1);
                }

                .ap-combined-header .ap-tab-item.active {
                    color: #fff;
                    background: linear-gradient(135deg, rgba(0,114,255,0.35), rgba(0,210,255,0.25));
                    border-color: rgba(0,210,255,0.6);
                    box-shadow: 0 0 20px rgba(0,210,255,0.25), inset 0 1px 0 rgba(255,255,255,0.15);
                }
                .theme-light .ap-combined-header .ap-tab-item.active {
                    background: linear-gradient(135deg, #0072ff, #00d2ff);
                    border-color: #0072ff;
                    box-shadow: 0 4px 12px rgba(0, 114, 255, 0.2);
                }

                .ap-combined-header .ap-tab-item.active .ap-tab-icon {
                    color: #00d2ff;
                    filter: drop-shadow(0 0 6px #00d2ff);
                }
                .theme-light .ap-combined-header .ap-tab-item.active .ap-tab-icon {
                    color: #fff;
                    filter: none;
                }

                .ap-combined-header .ap-tab-icon {
                    font-size: 1.1rem;
                    transition: all 0.2s ease;
                }

                /* Setup cards */
                .ap-setup-card {
                    transition: all 0.3s ease;
                    border: 1px solid var(--ap-border);
                    cursor: pointer;
                    background: var(--ap-card-bg);
                }
                .ap-setup-card:hover {
                    transform: translateY(-5px);
                    border-color: var(--ap-accent);
                    background: var(--ap-stat-bg);
                }
            `}} />
        </div>
    );
};

export default AccessPointManagement;
