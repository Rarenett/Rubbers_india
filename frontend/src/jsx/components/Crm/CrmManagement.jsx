import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ThemeContext } from "../../../context/ThemeContext";
import CrmDashboard from './CrmDashboard';
import LeadList from './LeadList';
import LeadCreate from './LeadCreate';
import LeadDetail from './LeadDetail';
import TeleCallingDashboard from '../crm_new/TeleCallingDashboard';
import TeleCallingInteraction from './TeleCallingInteraction';
import LeadCategoryManagement from './LeadCategoryManagement';
import PerformanceDashboard from './PerformanceDashboard';
import CallerMyLeads from '../crm_new/CallerMyLeads';
import CrmReports from '../crm_new/CrmReports';
import axiosInstance from '../../../services/AxiosInstance';

// Tab definitions used by both CrmHeader and CrmManagement shell
const TAB_ITEMS = [
    { id: 'dashboard',    url: '/crm/dashboard',    label: 'Management Central', icon: 'fa fa-th-large' },
    { id: 'leads',        url: '/crm/leads',        label: 'Lead Ecosystem',     icon: 'fa fa-users' },
    { id: 'telecalling',  url: '/crm/telecalling',  label: 'Tele-calling Dept',  icon: 'fa fa-phone' },
    { id: 'interactions', url: '/crm/interactions', label: 'My Interactions',    icon: 'fa fa-headphones' },
    { id: 'performance',  url: '/crm/performance',  label: 'Performance',        icon: 'fa fa-line-chart' },
];

// Map URL pathname segments → tab id (for highlighting the active tab)
const URL_TO_TAB = {
    'dashboard':    'dashboard',
    'leads':        'leads',
    'telecalling':  'telecalling',
    'performance':  'performance',
    'reports':      'performance',
    'caller-leads': 'caller-leads',
    'my-leads':     'caller-leads',
    'categories':   null,   // no top-level tab highlight
    'sources':      null,
    'lead-sources': null,
    'services':     null,
    'crm-services': null,
    'offers':       null,
    'crm-offers':   null,
    'create-lead':  'leads',
    'edit-lead':    'leads',
    'lead-detail':  'leads',
    'converted-leads-report': 'performance',
    'leads-report': 'performance',
};

/**
 * CrmHeader — reusable header + tab-bar for all dedicated CRM pages.
 * Exported so individual route pages can render it directly.
 */
export const CrmHeader = ({ activeTabId }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [reminders, setReminders] = useState([]);

    // Derive active tab from prop OR current URL
    const pathSegment = location.pathname.split('/').filter(Boolean)[1]; // e.g. 'leads'
    const resolvedTab = activeTabId || URL_TO_TAB[pathSegment] || 'dashboard';

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const checkReminders = async () => {
            try {
                const res = await axiosInstance.get('/api/crm/assignments/?mine=true');
                if (res.status === 200) {
                    const now = new Date();
                    const upcoming = res.data.filter(a => {
                        if (!a.target_time) return false;
                        const target = new Date(a.target_time);
                        const diffMinutes = (target - now) / (1000 * 60);
                        return diffMinutes > 0 && diffMinutes <= 60;
                    });
                    setReminders(upcoming);
                }
            } catch (error) {
                console.error('Reminder polling failed', error);
            }
        };
        checkReminders();
        const reminderInterval = setInterval(checkReminders, 60000);
        return () => clearInterval(reminderInterval);
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
                .crm-management-container {
                    padding: 2.5rem;
                    background-color: var(--crm-bg);
                    min-height: 100vh;
                    transition: all 0.3s ease;
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
                .crm-tab-content {
                    animation: crmSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes crmSlideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.98); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }

                @media (max-width: 991px) {
                    .crm-management-container {
                        padding: 1.25rem !important;
                    }
                    .crm-header-strip {
                        margin-bottom: 1.5rem !important;
                        border-radius: 1.2rem !important;
                    }
                    .crm-header-top {
                        padding: 1.25rem 1.5rem !important;
                    }
                    .crm-tabs-row {
                        padding: 0 1.25rem 1.25rem !important;
                        gap: 0.75rem !important;
                        overflow-x: auto !important;
                        white-space: nowrap !important;
                        -webkit-overflow-scrolling: touch !important;
                        scrollbar-width: none !important;
                    }
                    .crm-tabs-row::-webkit-scrollbar {
                        display: none !important;
                    }
                    .crm-tab-item {
                        flex-shrink: 0 !important;
                        padding: 0.65rem 1.1rem !important;
                        font-size: 0.88rem !important;
                    }
                }

                @media (max-width: 576px) {
                    .crm-management-container {
                        padding: 0.75rem !important;
                    }
                    .crm-header-strip {
                        margin-bottom: 1rem !important;
                        border-radius: 1rem !important;
                    }
                    .crm-header-top {
                        padding: 1rem 1rem !important;
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 0.75rem !important;
                    }
                    .crm-logo-text {
                        font-size: 1.5rem !important;
                    }
                    .crm-tabs-row {
                        padding: 0 0.75rem 0.85rem !important;
                        gap: 0.5rem !important;
                    }
                    .crm-tab-item {
                        padding: 0.5rem 0.85rem !important;
                        font-size: 0.8rem !important;
                        border-radius: 8px !important;
                    }
                }
            `}</style>

            <div className="crm-header-strip">
                <div className="crm-header-top">
                    <div className="crm-logo-text">
                        The <span>CRM</span> Hub
                    </div>
                    <div className="crm-time-chip d-none d-md-block">
                        <span className="me-3">
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()}
                        </span>
                        {reminders.length > 0 && (
                            <div
                                className="crm-status-pill reminder-active mr-3"
                                style={{ background: '#ff5e5e22', color: '#ff5e5e', marginRight: '1rem', cursor: 'pointer' }}
                                onClick={() => navigate('/crm/interactions')}
                            >
                                <i className="fa fa-bell-o mr-1"></i> {reminders.length} REMINDERS
                            </div>
                        )}
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

// ---------------------------------------------------------------------------
// CrmManagement — backward-compat shell (used by /crm and /crm/manage/:tab)
// New dedicated URLs render child components directly via index.jsx routes.
// ---------------------------------------------------------------------------
const CrmManagement = () => {
    const { background } = useContext(ThemeContext);
    const isDark = background.value === "dark";
    const { tab = 'dashboard', id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(tab);

    useEffect(() => {
        setActiveTab(tab);
    }, [tab]);

    // Navigate to dedicated URLs when switching tabs
    const handleTabChange = (newTab) => {
        const found = TAB_ITEMS.find(t => t.id === newTab);
        if (found) {
            navigate(found.url);
        } else {
            // fallback for sub-views (create-lead, lead-detail, edit-lead)
            navigate(`/crm/manage/${newTab}`);
        }
    };

    return (
        <div className={`crm-management-container ${isDark ? 'theme-dark' : 'theme-light'}`} style={{ backgroundColor: 'var(--crm-bg)', minHeight: '100vh' }}>
            <CrmHeader activeTabId={activeTab} />

            <div className="crm-tab-content">
                {activeTab === 'dashboard' && <CrmDashboard embedded={true} />}
                {activeTab === 'leads' && <LeadList embedded={true} />}
                {activeTab === 'create-lead' && <LeadCreate embedded={true} />}
                {activeTab === 'telecalling' && <TeleCallingDashboard />}
                {activeTab === 'interactions' && <TeleCallingInteraction assignmentId={id} onComplete={() => handleTabChange('telecalling')} />}
                {activeTab === 'caller-leads' && <CallerMyLeads />}
                {activeTab === 'categories' && <LeadCategoryManagement />}
                {(activeTab === 'performance' || activeTab === 'reports') && <CrmReports />}
                {activeTab === 'lead-detail' && <LeadDetail id={id} />}
                {activeTab === 'edit-lead' && <LeadCreate id={id} editMode={true} embedded={true} />}
            </div>
        </div>
    );
};

export default CrmManagement;
