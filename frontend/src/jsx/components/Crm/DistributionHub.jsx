import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const TAB_ITEMS = [
    { id: 'distribution-zones', url: '/crm/distribution-zones', label: 'Distribution Zones', icon: 'fa fa-map-marker' },
    { id: 'distributor-leads',  url: '/crm/distributor-leads',  label: 'Distributor Lead',   icon: 'fa fa-truck' },
    { id: 'vendor-leads',       url: '/crm/vendor-leads',       label: 'Vendor Lead',        icon: 'fa fa-industry' },
    { id: 'leads-list',         url: '/crm/leads-list',         label: 'All Leads List',     icon: 'fa fa-users' },
];

const URL_TO_TAB = {
    'distribution-zones': 'distribution-zones',
    'distributor-leads':  'distributor-leads',
    'vendor-leads':       'vendor-leads',
    'leads-list':         'leads-list',
};

export const DistributionHeader = ({ activeTabId }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [currentTime, setCurrentTime] = useState(new Date());

    const pathSegment = location.pathname.split('/').filter(Boolean)[1]; 
    const resolvedTab = activeTabId || URL_TO_TAB[pathSegment] || 'distribution-zones';

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <>
            <style>{`
                :root {
                    --crm-bg: #f8fafd;
                    --crm-card-bg: #ffffff;
                    --crm-accent: #00d1ff;
                    --crm-accent-soft: rgba(0, 209, 255, 0.1);
                    --crm-text-primary: #1e293b;
                    --crm-text-secondary: #64748b;
                    --crm-border: #e2e8f0;
                    --crm-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
                    --crm-card-radius: 1.5rem;
                }
                [data-theme-version="dark"] {
                    --crm-bg: #0b0e14;
                    --crm-card-bg: #151c26;
                    --crm-text-primary: #ffffff;
                    --crm-text-secondary: #94a3b8;
                    --crm-border: rgba(255, 255, 255, 0.05);
                    --crm-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
                }
                .crm-header-strip {
                    background: var(--crm-card-bg);
                    border-radius: var(--crm-card-radius);
                    padding: 0;
                    box-shadow: var(--crm-shadow);
                    margin-bottom: 2.5rem;
                    border: 1px solid var(--crm-border);
                    backdrop-filter: blur(10px);
                    overflow: hidden;
                }
                .crm-header-top {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 2rem 3rem;
                }
                .crm-logo-text {
                    font-size: 2.2rem;
                    font-weight: 800;
                    color: var(--crm-text-primary);
                    letter-spacing: -0.5px;
                }
                .crm-logo-text span {
                    color: var(--crm-accent);
                    font-weight: 800;
                }
                .crm-time-chip {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    font-size: 0.9rem;
                    color: var(--crm-text-secondary);
                    font-weight: 500;
                }
                .crm-status-pill {
                    background: var(--crm-accent-soft);
                    padding: 0.4rem 1rem;
                    border-radius: 2rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    text-transform: uppercase;
                    font-size: 0.8rem;
                    letter-spacing: 0.5px;
                    color: var(--crm-accent);
                    font-weight: 700;
                }
                .crm-status-dot {
                    width: 8px;
                    height: 8px;
                    background: var(--crm-accent);
                    border-radius: 50%;
                    box-shadow: 0 0 10px var(--crm-accent);
                }
                .crm-tabs-row {
                    display: flex;
                    gap: 1.5rem;
                    padding: 0 3rem 1.5rem;
                }
                .crm-tab-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.8rem 1.5rem;
                    border-radius: 12px;
                    font-weight: 700;
                    color: var(--crm-text-secondary);
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 1px solid transparent;
                }
                .crm-tab-item:hover {
                    color: var(--crm-text-primary);
                    background: var(--crm-accent-soft);
                    transform: translateY(-2px);
                }
                .crm-tab-item.active {
                    background: var(--crm-accent);
                    color: #fff;
                    box-shadow: 0 8px 20px rgba(0, 209, 255, 0.25);
                    border-color: var(--crm-accent);
                }
                .crm-tab-item i { font-size: 1.1rem; }
            `}</style>

            <div className="crm-header-strip">
                <div className="crm-header-top">
                    <div className="crm-logo-text">
                        Distribution <span>Hub</span>
                    </div>
                    <div className="crm-time-chip d-none d-md-block">
                        <span className="me-3">
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()}
                        </span>
                        <div className="crm-status-pill">
                            <div className="crm-status-dot"></div>
                            SYSTEM ACTIVE
                        </div>
                    </div>
                </div>
                <div className="crm-tabs-row">
                    {TAB_ITEMS.map(t => (
                        <div
                            key={t.id}
                            className={`crm-tab-item ${resolvedTab === t.id ? 'active' : ''}`}
                            onClick={() => navigate(t.url)}
                        >
                            <i className={t.icon}></i>
                            <span>{t.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

const DistributionHub = ({ children }) => {
    return (
        <div style={{ padding: '2.5rem', backgroundColor: 'var(--crm-bg)', minHeight: '100vh' }}>
            <DistributionHeader />
            <div className="crm-tab-content">
                {children}
            </div>
        </div>
    );
};

export default DistributionHub;
