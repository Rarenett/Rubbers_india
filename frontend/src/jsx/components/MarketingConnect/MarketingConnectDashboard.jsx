import './marketing-cute.css';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '../../../context/TitleContext';

const MarketingConnectDashboard = () => {
    usePageTitle("Marketing Connect");
    const navigate = useNavigate();

    const modules = [
        { title: 'ATTENDANCE', desc: "Mark today's attendance", icon: '📍', path: '/market_connect_master/attendance' },
        { title: 'TRANSPORT', desc: "Record today's travel", icon: '🚗', path: '/market_connect_master/transport' },
        { title: 'LEADS', desc: "Register a new lead", icon: '🎯', path: '/market_connect_master/leads' },
        { title: 'SHOP VISIT', desc: "Register / visit a shop", icon: '🏪', path: '/market_connect_master/shop-visit' },
        { title: 'ORDERS', desc: "Create customer orders", icon: '🛒', path: '/market_connect_master/orders' },
        { title: 'FOLLOW UP', desc: "Manage lead follow-ups", icon: '🤝', path: '/market_connect_master/leads', state: { activeTab: 'followup', isFollowUpSection: true }, iconScale: 1.35 },
    ];

    return (
        <div className="container-fluid" style={{ background: 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)', padding: '15px', minHeight: '100vh', overflowX: 'hidden' }}>
            <div className="row">
                <div className="col-12 text-center mb-4 mt-4" style={{ animation: 'popIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
                    <div style={{ display: 'inline-block', background: '#fff', padding: '12px 24px', borderRadius: '30px', boxShadow: '0 8px 20px rgba(112, 128, 175, 0.15)', marginBottom: '15px' }}>
                        <h2 className="mb-0" style={{ fontFamily: 'DM Serif Display', color: '#6366f1', letterSpacing: '0.5px' }}>Marketing Connect</h2>
                    </div>
                    <p className="fw-bold" style={{ color: '#64748b', fontSize: '1.1rem', letterSpacing: '0.5px' }}>Welcome, Employee ✨</p>
                </div>
            </div>
            <div className="row px-2">
                {modules.map((mod, i) => (
                    <div className="col-6 col-md-3 mb-4" key={i} style={{ animation: `popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`, animationDelay: `${i * 0.1}s`, opacity: 0 }}>
                        <div 
                            className="card h-100 marketing-card" 
                            style={{ 
                                borderRadius: '22px', 
                                cursor: 'pointer', 
                                border: 'none',
                                background: 'rgba(255, 255, 255, 0.95)',
                                backdropFilter: 'blur(10px)'
                            }}
                            onClick={() => navigate(mod.path, { state: mod.state })}
                        >
                            <div className="card-body text-center p-4 d-flex flex-column justify-content-center align-items-center">
                                <div className="marketing-icon-wrapper" style={{ fontSize: '2.2rem' }}>
                                    <span 
                                        style={{ 
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transform: mod.iconScale ? `scale(${mod.iconScale})` : 'none',
                                            transformOrigin: 'center center',
                                            lineHeight: 1
                                        }}
                                    >
                                        {mod.icon}
                                    </span>
                                </div>
                                <h5 style={{ fontWeight: '800', fontSize: '1rem', color: '#1e293b', letterSpacing: '0.5px' }}>{mod.title}</h5>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 0, fontWeight: '500' }}>{mod.desc}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MarketingConnectDashboard;
