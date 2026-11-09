import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ThemeContext } from '../../context/ThemeContext';

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/settings`;

const getAuthHeaders = () => {
    try {
        const userDetails = localStorage.getItem('userDetails');
        if (!userDetails) return {};
        const { access } = JSON.parse(userDetails);
        return { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' };
    } catch {
        return {};
    }
};

const fetchCount = async (endpoint) => {
    try {
        const res = await axios.get(`${API_BASE_URL}/${endpoint}/`, { headers: getAuthHeaders() });
        if (Array.isArray(res.data)) return res.data.length;
        if (typeof res.data?.table_count === 'number') return res.data.table_count;
        if (typeof res.data?.count === 'number') return res.data.count;
        if (Array.isArray(res.data?.results)) return res.data.results.length;
        return 0;
    } catch {
        return 0;
    }
};


const settingsCards = [
    {
        key: 'company',
        title: 'Company Profile',
        description: 'Manage your core company information, logo, and global settings.',
        icon: 'fa-building',
        color: '#4fc3f7',
        endpoint: 'company',
        manageUrl: '/company-settings',
        tab: 'profile',
        label: 'PROFILES',
    },
    {
        key: 'branches',
        title: 'Branches',
        description: 'Configure and manage company branches across locations.',
        icon: 'fa-code-branch',
        color: '#a78bfa',
        endpoint: 'branches',
        manageUrl: '/company-settings',
        tab: 'branches',
        label: 'BRANCHES',
    },
    {
        key: 'factories',
        title: 'Factories',
        description: 'Register and manage factories under branches or company.',
        icon: 'fa-industry',
        color: '#34d399',
        endpoint: 'factories',
        manageUrl: '/company-settings',
        tab: 'factories',
        label: 'FACTORIES',
    },
    {
        key: 'warehouses',
        title: 'Warehouses',
        description: 'Manage storage locations linked to company, branches, or factories.',
        icon: 'fa-warehouse',
        color: '#fbbf24',
        endpoint: 'warehouses',
        manageUrl: '/company-settings',
        tab: 'warehouses',
        label: 'WAREHOUSES',
    },
    {
        key: 'currencies',
        title: 'Currency Master',
        description: 'Define and manage all currencies used across the system.',
        icon: 'fa-coins',
        color: '#f87171',
        endpoint: 'currencies',
        manageUrl: '/manage-currencies',
        label: 'CURRENCIES',
    },
    {
        key: 'exchange-rates',
        title: 'Exchange Rates',
        description: 'Configure currency exchange rates for multi-currency operations.',
        icon: 'fa-exchange-alt',
        color: '#fb923c',
        endpoint: 'exchange-rates',
        manageUrl: '/manage-currencies',
        label: 'RATES',
    },
    {
        key: 'languages',
        title: 'Language Master',
        description: 'Add and manage languages supported in the ERP system.',
        icon: 'fa-language',
        color: '#38bdf8',
        endpoint: 'languages',
        manageUrl: '/manage-languages',
        label: 'LANGUAGES',
    },
    {
        key: 'financial-years',
        title: 'Financial Years',
        description: 'Set financial year periods for accounting and reporting.',
        icon: 'fa-calendar-alt',
        color: '#c084fc',
        endpoint: 'company-financial-years',
        manageUrl: '/company-settings',
        tab: 'fy',
        label: 'YEARS',
    },
    {
        key: 'prefix-types',
        title: 'Prefix Types',
        description: 'Define different types of prefixes for transactions like Invoices and Vouchers.',
        icon: 'fa-tags',
        color: '#ec4899',
        endpoint: 'prefix-types',
        manageUrl: '/manage-prefix-type',
        label: 'TYPES',
    },
    {
        key: 'prefix-configurations',
        title: 'Prefix Configurations',
        description: 'Configure document number formats with prefixes, padding, and starting numbers.',
        icon: 'fa-list-ol',
        color: '#8b5cf6',
        endpoint: 'prefix-configurations',
        manageUrl: '/manage-prefix-configuration',
        label: 'CONFIGS',
    },
    {
        key: 'database-backup',
        title: 'Database Backup',
        description: 'Export and download database backups in SQL or JSON format.',
        icon: 'fa-database',
        color: '#10b981',
        endpoint: 'backup/info',
        manageUrl: '/database-backup',
        label: 'BACKUPS',
    },
];


const CompanySettingsDashboard = () => {
    const [counts, setCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [time, setTime] = useState(new Date());
    const { background } = useContext(ThemeContext);
    const isDark = background?.value === 'dark';

    // Theme tokens
    const theme = {
        heroBg: isDark
            ? 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)'
            : 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #1e1b4b 100%)',
        heroBorder: isDark ? 'rgba(99,102,241,0.35)' : 'rgba(165,180,252,0.6)',
        heroGlow: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.25)',
        cardBg: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
        cardBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        cardHoverShadow: isDark ? '0 16px 40px rgba(0,0,0,0.4)' : '0 16px 40px rgba(0,0,0,0.1)',
        titleColor: isDark ? '#f1f5f9' : '#0f172a',
        descColor: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)',
        countLabel: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
        btnBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        btnBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
        btnColor: isDark ? '#fff' : '#1e293b',
        summaryBg: isDark
            ? 'linear-gradient(135deg, #0f172a 0%, #1a1a2e 100%)'
            : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        summaryBorder: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
        summaryTitle: isDark ? '#f1f5f9' : '#0f172a',
        summaryLabel: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)',
        overviewLabel: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
        iconBg: (color) => isDark ? `${color}22` : `${color}18`,
        iconBorder: (color) => isDark ? `${color}44` : `${color}55`,
    };

    useEffect(() => {
        const loadCounts = async () => {
            const results = {};
            await Promise.all(settingsCards.map(async (card) => {
                results[card.key] = await fetchCount(card.endpoint);
            }));
            setCounts(results);
            setLoading(false);
        };
        loadCounts();
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (dt) => dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formatDate = (dt) => dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div style={{ minHeight: '100vh', background: 'transparent', fontFamily: "'Inter', sans-serif" }}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

            {/* Breadcrumb */}
            <div className="page-titles">
                <button 
                    onClick={() => window.history.back()} 
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>

            {/* Hero Banner */}
            <div style={{
                background: theme.heroBg,
                borderRadius: '16px',
                padding: '36px 40px',
                marginBottom: '28px',
                border: `1px solid ${theme.heroBorder}`,
                boxShadow: `0 4px 40px ${theme.heroGlow}`,
                position: 'relative',
                overflow: 'hidden',
            }}>
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundImage: `radial-gradient(ellipse at 80% 50%, ${theme.heroGlow} 0%, transparent 60%)`,
                    pointerEvents: 'none'
                }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h1 style={{ color: '#fff', fontWeight: 800, fontSize: '2rem', marginBottom: '8px', letterSpacing: '-0.5px' }}>
                            The <span style={{ color: '#a5b4fc' }}>Settings</span> Hub
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', marginBottom: 0 }}>
                            Centralized control for company configurations, currencies, languages &amp; org structure.
                            <br />Manage everything from one place with real-time visibility.
                        </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.5rem', fontVariantNumeric: 'tabular-nums' }}>
                            {formatTime(time)}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', marginTop: '4px' }}>
                            {formatDate(time)}
                        </div>
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', display: 'inline-block', boxShadow: '0 0 8px #34d399' }} />
                            <span style={{ color: '#34d399', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '1px' }}>SYSTEM ACTIVE</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cards Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                gap: '20px',
                marginBottom: '28px',
            }}>
                {settingsCards.map((card) => (
                    <div key={card.key}
                        style={{
                            background: theme.cardBg,
                            border: `1px solid ${theme.cardBorder}`,
                            borderRadius: '14px',
                            padding: '24px',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = theme.cardHoverShadow;
                            e.currentTarget.style.borderColor = `${card.color}66`;
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.borderColor = theme.cardBorder;
                        }}
                    >
                        {/* Subtle color glow corner */}
                        <div style={{
                            position: 'absolute', top: 0, right: 0, width: '80px', height: '80px',
                            background: `radial-gradient(circle at top right, ${card.color}22 0%, transparent 70%)`,
                            pointerEvents: 'none'
                        }} />

                        {/* Top row: icon + count */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                            <div style={{
                                width: '50px', height: '50px', borderRadius: '12px',
                                background: theme.iconBg(card.color),
                                border: `1px solid ${theme.iconBorder(card.color)}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <i className={`fa ${card.icon}`} style={{ fontSize: '20px', color: card.color }} />
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ color: card.color, fontWeight: 800, fontSize: '2rem', lineHeight: 1 }}>
                                    {loading ? <span style={{ fontSize: '1.2rem', opacity: 0.4 }}>…</span> : (counts[card.key] ?? 0)}
                                </div>
                                <div style={{ color: theme.countLabel, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '1.5px', marginTop: '2px' }}>
                                    {card.label}
                                </div>
                            </div>
                        </div>

                        {/* Title + description */}
                        <h4 style={{ color: theme.titleColor, fontWeight: 700, fontSize: '1.05rem', marginBottom: '6px' }}>
                            {card.title}
                        </h4>
                        <p style={{ color: theme.descColor, fontSize: '0.82rem', marginBottom: '20px', lineHeight: 1.6 }}>
                            {card.description}
                        </p>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {/* Manage Button */}
                            <Link
                                to={card.tab ? `${card.manageUrl}?tab=${card.tab}` : card.manageUrl}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    padding: '9px 14px', borderRadius: '8px',
                                    background: theme.btnBg,
                                    border: `1px solid ${theme.btnBorder}`,
                                    color: theme.btnColor, textDecoration: 'none',
                                    fontSize: '0.82rem', fontWeight: 600,
                                    transition: 'all 0.2s ease',
                                    flex: '1',
                                    justifyContent: 'center',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = `${card.color}18`;
                                    e.currentTarget.style.borderColor = `${card.color}80`;
                                    e.currentTarget.style.color = card.color;
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = theme.btnBg;
                                    e.currentTarget.style.borderColor = theme.btnBorder;
                                    e.currentTarget.style.color = theme.btnColor;
                                }}
                            >
                                <i className="fa fa-cog" style={{ fontSize: '11px' }} /> Manage
                            </Link>

                            {/* View Button */}
                            <Link
                                to={`/settings-report/${card.key}`}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    padding: '9px 14px', borderRadius: '8px',
                                    background: `${card.color}12`,
                                    border: `1px solid ${card.color}44`,
                                    color: card.color, textDecoration: 'none',
                                    fontSize: '0.82rem', fontWeight: 600,
                                    transition: 'all 0.2s ease',
                                    flex: '1',
                                    justifyContent: 'center',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = `${card.color}28`;
                                    e.currentTarget.style.borderColor = `${card.color}88`;
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = `${card.color}12`;
                                    e.currentTarget.style.borderColor = `${card.color}44`;
                                }}
                            >
                                <i className="fa fa-eye" style={{ fontSize: '11px' }} /> View
                            </Link>
                        </div>
                    </div>
                ))}
            </div>

            {/* Summary Bar */}
            <div style={{
                background: theme.summaryBg,
                border: `1px solid ${theme.summaryBorder}`,
                borderRadius: '14px',
                padding: '20px 28px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '24px',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <div>
                    <div style={{ color: theme.overviewLabel, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '1.2px', marginBottom: '4px' }}>
                        SYSTEM OVERVIEW
                    </div>
                    <div style={{ color: theme.summaryTitle, fontWeight: 700, fontSize: '1rem' }}>
                        Total Configured Entities
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
                    {settingsCards.map(card => (
                        <div key={card.key} style={{ textAlign: 'center' }}>
                            <div style={{ color: card.color, fontWeight: 800, fontSize: '1.5rem', lineHeight: 1 }}>
                                {loading ? '–' : (counts[card.key] ?? 0)}
                            </div>
                            <div style={{ color: theme.summaryLabel, fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.8px', marginTop: '4px' }}>
                                {card.title}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CompanySettingsDashboard;
