import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../../services/AxiosInstance';

const CrmDashboard = ({ embedded }) => {
    const navigate = useNavigate();
    const [leadCount, setLeadCount] = useState(0);
    const [currentTime] = useState(new Date());

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const res = await axiosInstance.get('/api/crm/leads/');
                if (res.status === 200) {
                    setLeadCount(res.data.length);
                }
            } catch (error) {
                console.error("Error fetching metrics:", error);
            }
        };
        fetchMetrics();
    }, []);

    const stats = [
        { label: 'Total Leads', value: leadCount, icon: '📄', color: 'var(--crm-accent)' },
        { label: 'Conversion Rate', value: '24.5%', icon: '📈', color: '#10b981' },
        { label: 'Open Deals', value: '84', icon: '💼', color: '#f59e0b' },
        { label: 'Revenue', value: '$45k', icon: '💰', color: '#8b5cf6' },
    ];

    const quickActions = [
        {
            title: 'Lead Management',
            desc: 'View and manage your potential customers.',
            icon: <i className="fa fa-users"></i>,
            path: '/crm/leads'
        },
        {
            title: 'Lead Generation',
            desc: 'Capture new opportunities into the system.',
            icon: <i className="fa fa-plus-circle"></i>,
            path: '/crm/leads/create'
        },
        {
            title: 'Lead Categories',
            desc: 'Organize and classify leads into different categories.',
            icon: <i className="fa fa-tags"></i>,
            path: '/crm/categories'
        },
        {
            title: 'CRM Analytics',
            desc: 'Coming soon: Track sales performance and trends.',
            icon: <i className="fa fa-chart-line"></i>,
            path: '#',
            disabled: true
        }
    ];

    return (
        <div className="crm-dash">
            <style>{`
                .crm-hero-card {
                    background: var(--crm-card-bg);
                    border-radius: var(--crm-card-radius);
                    padding: 3rem;
                    box-shadow: var(--crm-shadow);
                    margin-bottom: 2.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border: 1px solid var(--crm-border);
                }

                .crm-hero-content h1 {
                    font-size: 2.5rem;
                    font-weight: 800;
                    color: var(--crm-text-primary);
                    margin-bottom: 0.75rem;
                    letter-spacing: -0.5px;
                }

                .crm-hero-content h1 span {
                    color: var(--crm-accent);
                }

                .crm-hero-content p {
                    color: var(--crm-text-secondary);
                    font-size: 1.1rem;
                    max-width: 600px;
                    line-height: 1.6;
                }

                /* Stats Bar */
                .crm-stats-bar {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 1.5rem;
                    margin-bottom: 3rem;
                }

                .crm-stat-mini-card {
                    background: var(--crm-card-bg);
                    padding: 1.5rem;
                    border-radius: 1.25rem;
                    box-shadow: var(--crm-shadow);
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 1px solid var(--crm-border);
                }

                .crm-stat-mini-card:hover {
                    transform: translateY(-5px);
                    border-color: var(--crm-accent-soft);
                }

                .crm-stat-icon-box {
                    width: 54px;
                    height: 54px;
                    background: var(--crm-accent-soft);
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.6rem;
                    color: var(--crm-accent);
                }

                .crm-stat-info label {
                    display: block;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    color: var(--crm-text-secondary);
                    letter-spacing: 1.5px;
                    font-weight: 700;
                    margin-bottom: 0.3rem;
                }

                .crm-stat-info h2 {
                    font-size: 2.1rem;
                    font-weight: 800;
                    margin: 0;
                    color: var(--crm-text-primary);
                }

                /* Quick Actions */
                .crm-action-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 3rem;
                }

                .crm-action-card {
                    background: var(--crm-card-bg);
                    border-radius: var(--crm-card-radius);
                    padding: 2rem;
                    box-shadow: var(--crm-shadow);
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    cursor: pointer;
                    border: 1px solid var(--crm-border);
                    position: relative;
                    overflow: hidden;
                }

                .crm-action-card:hover:not(.disabled) {
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
                    transform: translateY(-8px);
                    border-color: var(--crm-accent);
                }

                .crm-action-card.disabled {
                    opacity: 0.6;
                    cursor: default;
                }

                .crm-action-icon {
                    font-size: 2rem;
                    color: var(--crm-accent);
                }

                .crm-action-content h3 {
                    font-size: 1.3rem;
                    font-weight: 800;
                    margin-bottom: 0.5rem;
                    color: var(--crm-text-primary);
                }

                .crm-action-content p {
                    font-size: 0.9rem;
                    color: var(--crm-text-secondary);
                    line-height: 1.6;
                }

                .crm-action-footer {
                    margin-top: auto;
                    background: var(--crm-accent-soft);
                    padding: 0.75rem;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                    font-weight: 700;
                    color: var(--crm-text-primary);
                    font-size: 0.85rem;
                    transition: all 0.3s;
                }

                .crm-action-card:hover:not(.disabled) .crm-action-footer {
                    background: var(--crm-accent);
                    color: #fff;
                }
            `}</style>

            {/* Stats Bar */}
            <div className="crm-stats-bar">
                {stats.map((s, i) => (
                    <div key={i} className="crm-stat-mini-card">
                        <div className="crm-stat-icon-box" style={{ color: s.color, background: `${s.color}15` }}>
                            {s.icon}
                        </div>
                        <div className="crm-stat-info">
                            <label>{s.label}</label>
                            <h2 style={{ color: s.label === 'Overdue' ? '#ef4444' : 'inherit' }}>{s.value}</h2>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <h2 className="fs-22 font-w800 mb-4" style={{ color: 'var(--crm-text-primary)' }}>Execution Centers</h2>
            <div className="crm-action-grid">
                {quickActions.map((action, idx) => (
                    <div 
                        key={idx} 
                        className={`crm-action-card ${action.disabled ? 'disabled' : ''}`}
                        onClick={() => !action.disabled && navigate(action.path)}
                    >
                        <div className="crm-action-icon">{action.icon}</div>
                        <div className="crm-action-content">
                            <h3>{action.title}</h3>
                            <p>{action.desc}</p>
                        </div>
                        <div className="crm-action-footer">
                            Go to {action.title.split(' ')[0]} <span>›</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CrmDashboard;
