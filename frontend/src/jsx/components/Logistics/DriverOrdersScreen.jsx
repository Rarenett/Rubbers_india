import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import SalesService from '../../../services/SalesService';

const T = {
    ink: '#0f1624',
    inkMuted: '#3d4a5c',
    slate: '#6b7a90',
    cloud: '#eef1f6',
    white: '#ffffff',
    surface: '#f5f7fa',
    accent: '#3b5bdb',
    accentSoft: '#e8edfd',
    success: '#10b981',
    danger: '#dc2626',
    gold: '#c9a84c',
    rSm: '8px',
    rMd: '14px',
    rLg: '20px',
    shSm: '0 1px 3px rgba(15,22,36,0.06), 0 1px 2px rgba(15,22,36,0.04)',
    shMd: '0 4px 16px rgba(15,22,36,0.07), 0 1px 4px rgba(15,22,36,0.05)',
};

const DriverOrdersScreen = () => {
    const navigate = useNavigate();
    const { auth } = useSelector(state => state.auth);
    const user = auth?.user || {};
    const loggedInName = user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.username || user.email || '';
        
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Apply background styling to container
        const containerFluid = document.querySelector('.container-fluid');
        const contentBody = document.querySelector('.content-body');
        let ogCBg = '', ogCPad = '', ogBBg = '';
        if (containerFluid) {
            ogCBg = containerFluid.style.background;
            ogCPad = containerFluid.style.padding;
            containerFluid.style.setProperty('background', T.surface, 'important');
            containerFluid.style.setProperty('padding', '0', 'important');
        }
        if (contentBody) {
            ogBBg = contentBody.style.background;
            contentBody.style.setProperty('background', T.surface, 'important');
        }
        return () => {
            if (containerFluid) { containerFluid.style.background = ogCBg; containerFluid.style.padding = ogCPad; }
            if (contentBody) { contentBody.style.background = ogBBg; }
        };
    }, []);

    useEffect(() => {
        const fetchOrders = async () => {
            setLoading(true);
            try {
                const res = await SalesService.getSalesOrders();
                const allOrders = Array.isArray(res.data) ? res.data : [];
                // Filter orders where the driver's name matches the logged-in user's name and delivery date is today
                const todayStrForOrders = new Date().toISOString().split('T')[0];
                const driverOrders = allOrders.filter(order => {
                    if (!order.driver_name || !loggedInName) return false;
                    const isSameDriver = order.driver_name.toLowerCase() === loggedInName.toLowerCase();
                    const isToday = order.preferred_delivery_date && order.preferred_delivery_date.startsWith(todayStrForOrders);
                    return isSameDriver && isToday;
                });
                setOrders(driverOrders);
            } catch (err) {
                console.error('Error fetching orders:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, [loggedInName]);

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: T.surface, gap: '20px' }}>
                <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
                <div style={{ width: '48px', height: '48px', border: `3px solid ${T.cloud}`, borderTopColor: T.accent, borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
                <p style={{ color: T.ink, fontWeight: '700', fontFamily: "'DM Sans',sans-serif" }}>Loading Your Orders...</p>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: T.surface, fontFamily: "'DM Sans', sans-serif" }}>
            {/* Global CSS */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap');
                @keyframes slideUp { from { transform:translateY(8px);opacity:0 } to { transform:translateY(0);opacity:1 } }
                .order-card { animation: slideUp 0.3s ease both; transition: transform 0.2s, box-shadow 0.2s; }
                .order-card:hover { transform: translateY(-3px); box-shadow: ${T.shMd}; border-color: #d2dce8; }
                .action-btn { transition: all 0.2s ease; }
                .action-btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
            `}</style>

            {/* Header */}
            <div style={{
                background: 'linear-gradient(160deg, #0f1e45 0%, #1a2f6b 55%, #243580 100%)',
                padding: '30px 20px',
                borderBottomLeftRadius: '32px',
                borderBottomRightRadius: '32px',
                color: T.white,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 12px 36px rgba(15,30,69,0.15)',
                marginBottom: '30px'
            }}>
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.06)' }} />
                <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.28)', borderRadius: '20px', padding: '4px 12px', marginBottom: '12px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: T.gold }} />
                        <span style={{ fontSize: '0.65rem', fontWeight: '700', letterSpacing: '0.1em', color: T.gold, textTransform: 'uppercase' }}>Logistics</span>
                    </div>
                    <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: '2.2rem', margin: 0 }}>My Orders</h1>
                    <p style={{ color: 'rgba(255,255,255,0.7)', margin: '8px 0 0', fontSize: '0.95rem' }}>View and manage your assigned deliveries.</p>
                </div>
            </div>

            {/* List */}
            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 20px 40px' }}>
                {orders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', background: T.white, borderRadius: T.rLg, border: `1px solid ${T.cloud}` }}>
                        <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📦</div>
                        <h3 style={{ color: T.ink, fontFamily: "'DM Serif Display',serif" }}>No Assigned Orders</h3>
                        <p style={{ color: T.slate, fontSize: '0.95rem' }}>You currently have no orders assigned to you.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {orders.map((order, idx) => (
                            <div key={order.id || idx} className="order-card" style={{
                                background: T.white, borderRadius: T.rLg, padding: '24px',
                                boxShadow: T.shSm, border: `1px solid ${T.cloud}`,
                                display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px',
                                position: 'relative', overflow: 'hidden'
                            }}>
                                {/* Decorative left border line */}
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: order.status === 'Pending' ? '#f59e0b' : (order.status === 'In Transit' ? T.accent : T.success) }} />
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: '1 1 auto', paddingLeft: '8px' }}>
                                    <div style={{
                                        width: '56px', height: '56px', borderRadius: '16px',
                                        background: T.accentSoft, color: T.accent,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.6rem', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5)'
                                    }}>
                                        📦
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: '800', color: T.accent, letterSpacing: '0.05em', textTransform: 'uppercase', background: 'rgba(59,91,219,0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                                                {order.so_no}
                                            </div>
                                            <div style={{ 
                                                background: order.status === 'Pending' ? '#fef3c7' : (order.status === 'In Transit' ? T.accentSoft : '#d1fae5'), 
                                                color: order.status === 'Pending' ? '#b45309' : (order.status === 'In Transit' ? T.accent : '#047857'),
                                                padding: '2px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700',
                                                border: `1px solid ${order.status === 'Pending' ? '#fde68a' : (order.status === 'In Transit' ? '#c3d2f8' : '#a7f3d0')}`
                                            }}>
                                                • {order.status || 'Pending'}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: T.ink, marginBottom: '6px', fontFamily: "'DM Serif Display',serif" }}>
                                            {order.customer_ledger_name || 'Unknown Party'}
                                        </div>
                                        <div style={{ fontSize: '0.9rem', color: T.slate, display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                {order.preferred_delivery_date ? new Date(order.preferred_delivery_date).toLocaleDateString('en-GB') : 'No Date Set'}
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                                {order.delivery_location_name || order.delivery_location || 'Standard Location'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                    <button 
                                        onClick={() => navigate('/driver-operations', { state: { partyId: order.customer_ledger } })}
                                        style={{
                                            background: `linear-gradient(135deg, ${T.accent} 0%, #2f49c5 100%)`, 
                                            color: T.white, border: 'none',
                                            padding: '12px 28px', borderRadius: T.rMd,
                                            fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            boxShadow: '0 8px 16px rgba(59,91,219,0.25)',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(59,91,219,0.35)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(59,91,219,0.25)'; }}
                                    >
                                        <span style={{ fontSize: '1.2rem' }}>🚚</span> Start Delivery
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DriverOrdersScreen;
